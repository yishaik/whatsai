import { GoogleGenAI } from "@google/genai";
import { Persona, Message, Source } from '../types';
import { USER_ID } from '../constants';

if (!process.env.API_KEY) {
  console.error("API_KEY environment variable not set. Please set it to use the Gemini API.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

function formatChatHistory(history: Message[], personasMap: { [id: string]: Persona }): string {
  return history.map(msg => {
    const authorName = msg.authorId === USER_ID ? 'User' : (personasMap[msg.authorId]?.name || 'Unknown Persona');
    return `${authorName}: ${msg.text}`;
  }).join('\n');
}

export const generatePersonaResponse = async (
  persona: Persona,
  chatTopic: string,
  history: Message[],
  allPersonasInChat: Persona[],
  personasMap: { [id: string]: Persona }
): Promise<{ text: string; sources: Source[] }> => {
  const otherPersonas = allPersonasInChat.filter(p => p.id !== persona.id).map(p => p.name).join(', ');
  const formattedHistory = formatChatHistory(history, personasMap);

  const systemInstruction = `You are in a group chat. The chat topic is: "${chatTopic}".
Your persona is "${persona.name}". Your personality is: "${persona.prompt}".
The other participants are: User, ${otherPersonas}.
You must respond as "${persona.name}". Your response must be in character.
Do not prefix your response with your name (e.g., don't write "${persona.name}:"). Just provide the message content.`;
  
  const contents = `This is the chat history so far:
${formattedHistory}

Your turn is next. What is your reply?`;

  const config: any = {
    systemInstruction: systemInstruction,
    temperature: 0.9,
    topP: 1,
    topK: 1,
  };

  if (persona.canSearch) {
    config.tools = [{googleSearch: {}}];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: config,
    });
    
    const responseText = response.text?.trim() ?? '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

    let sources: Source[] = [];
    if (persona.canSearch && groundingMetadata?.groundingChunks?.length) {
      sources = groundingMetadata.groundingChunks
        .map((chunk: any) => {
          if (chunk.web && chunk.web.uri) {
            return { title: chunk.web.title || "Untitled Source", uri: chunk.web.uri };
          }
          return null;
        })
        .filter((s: Source | null): s is Source => s !== null && s.uri !== '')
        .slice(0, 3); // Limit to 3 sources
    }

    return { text: responseText, sources };

  } catch (error) {
    console.error(`Error generating response for ${persona.name}:`, error);
    return { text: "I'm having trouble thinking right now...", sources: [] };
  }
};

export const generateAvatar = async (name: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `A simple, circular, vector-art avatar for a chat profile. The character is named '${name}' and has this personality: '${prompt}'. The avatar should be clean, modern, and easily recognizable in a small size. Flat background color.`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes = response.generatedImages[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }
    
    // The API succeeded but returned no images. This is the most likely path for a safety block.
    throw new Error('Avatar generation was blocked, likely due to safety policies. Please try a different name or prompt.');

  } catch (error) {
    console.error(`Error generating avatar for ${name}:`, error);
    // The API call itself failed. This could be due to various reasons, including safety.
    if (error instanceof Error) {
      // Check if the error message from the SDK indicates a safety issue.
      if (/safety|policy|blocked/i.test(error.message)) {
        throw new Error('Avatar generation was blocked due to safety policies. Please use a different name or prompt.');
      }
      // For other API errors (network, auth, etc.)
      throw new Error(`Failed to generate avatar due to an API error: ${error.message}`);
    }
    // Fallback for non-Error exceptions
    throw new Error('An unknown error occurred during avatar generation.');
  }
};

export const generateGroupChatAvatar = async (topic: string, personaNames: string[]): Promise<string> => {
  try {
    const participantsText = personaNames.length > 3 
      ? `${personaNames.slice(0, 3).join(', ')} and others`
      : personaNames.join(', ');
      
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `A simple, circular, vector-art avatar for a group chat. The chat topic is "${topic}" with participants: ${participantsText}. The avatar should represent the theme or concept of the discussion. Clean, modern design with a flat background.`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes = response.generatedImages[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }
    
    throw new Error('Group avatar generation was blocked, likely due to safety policies.');

  } catch (error) {
    console.error(`Error generating group avatar for ${topic}:`, error);
    if (error instanceof Error) {
      if (/safety|policy|blocked/i.test(error.message)) {
        throw new Error('Group avatar generation was blocked due to safety policies. Please use a different topic.');
      }
      throw new Error(`Failed to generate group avatar: ${error.message}`);
    }
    throw new Error('An unknown error occurred during group avatar generation.');
  }
};