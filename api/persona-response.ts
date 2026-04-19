import { GoogleGenAI } from '@google/genai';
import type { Persona, Message, Source } from './types';
import { USER_ID } from './constants';

type PersonaResponseRequestBody = {
  persona: Persona;
  chatTopic: string;
  history: Message[];
  allPersonasInChat: Persona[];
  personasMap: Record<string, Persona>;
};

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

const extractSources = (groundingMetadata: any): Source[] => {
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
    .filter((source: Source | null): source is Source => source !== null && source.uri !== '')
    .slice(0, 3);
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      persona,
      chatTopic,
      history = [],
      allPersonasInChat = [],
      personasMap = {},
    } = (req.body || {}) as PersonaResponseRequestBody;

    if (!persona?.id || !persona?.name || !persona?.prompt || !chatTopic) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const otherPersonas = allPersonasInChat
      .filter((participant) => participant.id !== persona.id)
      .map((participant) => participant.name)
      .join(', ');
    const formattedHistory = formatChatHistory(history, personasMap);

    const systemInstruction = `You are in a group chat. The chat topic is: "${chatTopic}".
Your persona is "${persona.name}". Your personality is: "${persona.prompt}".
The other participants are: User${otherPersonas ? `, ${otherPersonas}` : ''}.
You must respond as "${persona.name}". Your response must be in character.
Do not prefix your response with your name (e.g., don't write "${persona.name}:"). Just provide the message content.`;

    const config: Record<string, any> = {
      systemInstruction,
      temperature: 0.9,
      topP: 1,
      topK: 1,
    };

    if (persona.canSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `This is the chat history so far:\n${formattedHistory}\n\nYour turn is next. What is your reply?`,
      config,
    });

    const responseText = response.text?.trim() ?? '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = persona.canSearch ? extractSources(groundingMetadata) : [];

    return res.status(200).json({
      text: responseText,
      sources,
    });
  } catch (error) {
    console.error('Error generating persona response:', error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate persona response.',
    });
  }
}
