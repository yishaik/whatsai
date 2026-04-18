import { GoogleGenAI } from '@google/genai';

const getApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  return apiKey;
};

const extractImage = (response: any): string => {
  const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;

  if (!base64ImageBytes) {
    throw new Error(
      'Avatar generation was blocked, likely due to safety policies. Please try a different name or prompt.'
    );
  }

  return `data:image/png;base64,${base64ImageBytes}`;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, prompt } = req.body || {};

    if (!name || !prompt) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `A simple, circular, vector-art avatar for a chat profile. The character is named '${name}' and has this personality: '${prompt}'. The avatar should be clean, modern, and easily recognizable in a small size. Flat background color.`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '1:1',
      },
    });

    return res.status(200).json({
      image: extractImage(response),
    });
  } catch (error) {
    console.error('Error generating avatar:', error);

    const message =
      error instanceof Error
        ? /safety|policy|blocked/i.test(error.message)
          ? 'Avatar generation was blocked due to safety policies. Please use a different name or prompt.'
          : `Failed to generate avatar due to an API error: ${error.message}`
        : 'An unknown error occurred during avatar generation.';

    return res.status(500).json({ error: message });
  }
}
