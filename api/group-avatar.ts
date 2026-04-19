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
    throw new Error('Group avatar generation was blocked, likely due to safety policies.');
  }

  return `data:image/png;base64,${base64ImageBytes}`;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { topic, personaNames = [] } = req.body || {};

    if (!topic) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const participantsText =
      personaNames.length > 3
        ? `${personaNames.slice(0, 3).join(', ')} and others`
        : personaNames.join(', ');

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: `A simple, circular, vector-art avatar for a group chat. The chat topic is "${topic}" with participants: ${participantsText}. The avatar should represent the theme or concept of the discussion. Clean, modern design with a flat background.`,
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
    console.error('Error generating group avatar:', error);

    const message =
      error instanceof Error
        ? /safety|policy|blocked/i.test(error.message)
          ? 'Group avatar generation was blocked due to safety policies. Please use a different topic.'
          : `Failed to generate group avatar: ${error.message}`
        : 'An unknown error occurred during group avatar generation.';

    return res.status(500).json({ error: message });
  }
}
