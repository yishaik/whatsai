import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'No API key' });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Try to list models to test the key
    const response = await ai.models.list();
    
    return res.status(200).json({
      success: true,
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 10) + '...',
      modelsCount: response.length || 'unknown'
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      keyLength: (process.env.GEMINI_API_KEY || '').length,
      keyPrefix: (process.env.GEMINI_API_KEY || '').substring(0, 10) + '...'
    });
  }
}
