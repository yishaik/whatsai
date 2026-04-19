import { GoogleGenAI } from '@google/genai';

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
    
    // Simple test
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: 'Say hello',
      config: {
        temperature: 0.9,
      },
    });
    
    return res.status(200).json({
      text: response.text,
      success: true
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed',
    });
  }
}
