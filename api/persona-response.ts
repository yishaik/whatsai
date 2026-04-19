import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY not set' });
    }
    
    const body = req.body || {};
    const persona = body.persona || {};
    const chatTopic = body.chatTopic || 'Test';
    const history = body.history || [];
    
    if (!persona.id || !persona.name || !persona.prompt) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const formattedHistory = history
      .map((message: any) => `${message.authorId || 'User'}: ${message.text || ''}`)
      .join('\n');
    
    const systemInstruction = `You are "${persona.name}". ${persona.prompt}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `Chat history:\n${formattedHistory}\n\nReply:`,
      config: {
        systemInstruction,
        temperature: 0.9,
      },
    });

    return res.status(200).json({
      text: response.text,
      sources: [],
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed',
    });
  }
}
