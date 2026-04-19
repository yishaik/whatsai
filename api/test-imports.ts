import { GoogleGenAI } from '@google/genai';
import type { Persona, Message, Source } from './types';
import { USER_ID } from './constants';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'No API key' });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Test with types
    const persona: Persona = {
      id: 'test',
      name: 'Assistant',
      avatar: '',
      prompt: 'You are a helpful assistant',
      canSearch: false
    };
    
    const chatTopic = 'Test chat';
    const history: Message[] = [];
    const allPersonasInChat: Persona[] = [];
    const personasMap: Record<string, Persona> = {};
    
    const otherPersonas = allPersonasInChat
      .filter((participant) => participant.id !== persona.id)
      .map((participant) => participant.name)
      .join(', ');
    
    const formattedHistory = history
      .map((message) => {
        const authorName = message.authorId === USER_ID
          ? 'User'
          : personasMap[message.authorId]?.name || 'Unknown Persona';
        return `${authorName}: ${message.text}`;
      })
      .join('\n');
    
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
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `This is the chat history so far:\n${formattedHistory}\n\nYour turn is next. What is your reply?`,
      config,
    });
    
    return res.status(200).json({
      text: response.text,
      success: true,
      imports: 'OK'
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed',
      imports: 'FAILED'
    });
  }
}
