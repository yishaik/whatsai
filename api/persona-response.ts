import { GoogleGenAI } from '@google/genai';

type Persona = {
  id: string;
  name: string;
  avatar?: string;
  prompt: string;
  canSearch?: boolean;
};

type Message = {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
};

type PersonaResponseRequestBody = {
  persona: Persona;
  chatTopic: string;
  history: Message[];
  allPersonasInChat: Persona[];
  personasMap: Record<string, Persona>;
};

const USER_ID = 'user';

const getApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }
  return apiKey;
};

const formatChatHistory = (
  history: Message[],
  personasMap: Record<string, Persona>
): string => {
  return history
    .map((message) => {
      const authorName =
        message.authorId === USER_ID
          ? 'User'
          : personasMap[message.authorId]?.name || 'Unknown Persona';
      return `${authorName}: ${message.text}`;
    })
    .join('\n');
};

const extractSources = (groundingMetadata: any): { title: string; uri: string }[] => {
  if (!groundingMetadata?.groundingChunks?.length) {
    return [];
  }
  return groundingMetadata.groundingChunks
    .map((chunk: any) => {
      if (chunk.web?.uri) {
        return {
          title: chunk.web.title || 'Untitled Source',
          uri: chunk.web.uri,
        };
      }
      return null;
    })
    .filter((source: any) => source !== null && source.uri !== '')
    .slice(0, 3);
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    
    // Strip out avatar fields to reduce payload size
    const persona = body.persona || {};
    const { avatar: _, ...personaWithoutAvatar } = persona;
    
    const allPersonasInChat = (body.allPersonasInChat || []).map((p: any) => {
      const { avatar, ...rest } = p;
      return rest;
    });
    
    const personasMap: Record<string, Persona> = {};
    if (body.personasMap) {
      for (const [id, p] of Object.entries(body.personasMap as Record<string, any>)) {
        const { avatar, ...rest } = p;
        personasMap[id] = rest;
      }
    }
    
    const chatTopic = body.chatTopic || 'Chat';
    const history = body.history || [];

    if (!personaWithoutAvatar?.id || !personaWithoutAvatar?.name || !personaWithoutAvatar?.prompt || !chatTopic) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const otherPersonas = allPersonasInChat
      .filter((participant: any) => participant.id !== personaWithoutAvatar.id)
      .map((participant: any) => participant.name)
      .join(', ');
    const formattedHistory = formatChatHistory(history, personasMap);

    const systemInstruction = `You are in a group chat. The chat topic is: "${chatTopic}".
Your persona is "${personaWithoutAvatar.name}". Your personality is: "${personaWithoutAvatar.prompt}".
The other participants are: User${otherPersonas ? `, ${otherPersonas}` : ''}.
You must respond as "${personaWithoutAvatar.name}". Your response must be in character.
Do not prefix your response with your name (e.g., don't write "${personaWithoutAvatar.name}:"). Just provide the message content.`;

    const config: Record<string, any> = {
      systemInstruction,
      temperature: 0.9,
      topP: 1,
      topK: 1,
    };

    if (personaWithoutAvatar.canSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `This is the chat history so far:\n${formattedHistory}\n\nYour turn is next. What is your reply?`,
      config,
    });

    const responseText = response.text?.trim() ?? '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = personaWithoutAvatar.canSearch ? extractSources(groundingMetadata) : [];

    return res.status(200).json({
      text: responseText,
      sources,
    });
  } catch (error) {
    console.error('Error generating persona response:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate persona response.',
    });
  }
}
