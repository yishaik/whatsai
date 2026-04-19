import { GoogleGenAI } from '@google/genai';

export default async function handler(_req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'No API key' });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Try to generate content with the model
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: 'Say hello in one word',
      config: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    });
    
    return res.status(200).json({
      success: true,
      response: response.text,
      model: 'gemini-3.1-flash-lite-preview'
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      model: 'gemini-3.1-flash-lite-preview'
    });
  }
}
