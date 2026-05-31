import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { providerForModel, DEFAULT_MODEL_ID } from '../services/models';

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

// Fetch image attachments and convert them to Gemini inlineData parts. Skips
// any that fail to fetch and stops once a total-bytes budget is reached, so a
// big or broken attachment can't blow up the request.
const MAX_IMAGE_BYTES_TOTAL = 15 * 1024 * 1024;

const buildImageParts = async (
  images: { url: string; mimeType: string }[],
): Promise<{ inlineData: { mimeType: string; data: string } }[]> => {
  const parts: { inlineData: { mimeType: string; data: string } }[] = [];
  let total = 0;
  for (const img of images) {
    if (!img?.url || !img?.mimeType?.startsWith('image/')) continue;
    try {
      const resp = await fetch(img.url);
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (total + buf.length > MAX_IMAGE_BYTES_TOTAL) break;
      total += buf.length;
      parts.push({ inlineData: { mimeType: img.mimeType, data: buf.toString('base64') } });
    } catch (error) {
      console.error('Failed to fetch attachment for vision input:', error);
    }
  }
  return parts;
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
    const images = Array.isArray(body.images) ? body.images : [];

    if (!personaWithoutAvatar?.id || !personaWithoutAvatar?.name || !personaWithoutAvatar?.prompt || !chatTopic) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const requestedModel =
      typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL_ID;
    const provider = providerForModel(requestedModel);

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

    const imageNote = images.length
      ? 'The user attached the image(s) below with their latest message. Take them into account.\n\n'
      : '';
    const userPromptText = `This is the chat history so far:\n${formattedHistory}\n\n${imageNote}Your turn is next. What is your reply?`;
    const wantStream = body.stream === true;

    // Open a Server-Sent Events response and return a `send(obj)` writer.
    const openSse = () => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      return (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    // ==================== OPENAI ====================
    if (provider === 'openai') {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        const msg = 'OPENAI_API_KEY is not configured on the server.';
        if (wantStream) { const send = openSse(); send({ error: msg }); res.end(); return; }
        return res.status(500).json({ error: msg });
      }
      const openai = new OpenAI({ apiKey: openaiKey });
      // Vision: attach images as image_url parts (OpenAI fetches the URLs).
      const userContent: any = images.length
        ? [
            { type: 'text', text: userPromptText },
            ...images
              .filter((i: any) => i?.url)
              .map((i: any) => ({ type: 'image_url', image_url: { url: i.url } })),
          ]
        : userPromptText;
      const messages: any = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent },
      ];

      if (wantStream) {
        const send = openSse();
        try {
          const stream = await openai.chat.completions.create({
            model: requestedModel,
            messages,
            temperature: 0.9,
            stream: true,
          });
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) send({ delta });
          }
          send({ done: true, sources: [] }); // OpenAI has no built-in web search
        } catch (streamError) {
          console.error('OpenAI stream error:', streamError);
          send({ error: streamError instanceof Error ? streamError.message : 'stream failed' });
        } finally {
          res.end();
        }
        return;
      }

      const completion = await openai.chat.completions.create({
        model: requestedModel,
        messages,
        temperature: 0.9,
      });
      const text = completion.choices?.[0]?.message?.content?.trim() ?? '';
      return res.status(200).json({ text, sources: [] });
    }

    // ==================== GEMINI ====================
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const config: Record<string, any> = {
      systemInstruction,
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
    };
    if (personaWithoutAvatar.canSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    const imageParts = await buildImageParts(images);
    const contents = [
      { role: 'user', parts: [{ text: userPromptText }, ...imageParts] },
    ];

    if (wantStream) {
      const send = openSse();
      try {
        const stream = await ai.models.generateContentStream({ model: requestedModel, contents, config });
        let grounding: any = undefined;
        for await (const chunk of stream) {
          const delta = chunk.text ?? '';
          if (delta) send({ delta });
          const gm = chunk.candidates?.[0]?.groundingMetadata;
          if (gm) grounding = gm;
        }
        send({ done: true, sources: personaWithoutAvatar.canSearch ? extractSources(grounding) : [] });
      } catch (streamError) {
        console.error('Error streaming persona response:', streamError);
        send({ error: streamError instanceof Error ? streamError.message : 'stream failed' });
      } finally {
        res.end();
      }
      return;
    }

    const response = await ai.models.generateContent({ model: requestedModel, contents, config });
    const responseText = response.text?.trim() ?? '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = personaWithoutAvatar.canSearch ? extractSources(groundingMetadata) : [];
    return res.status(200).json({ text: responseText, sources });
  } catch (error) {
    console.error('Error generating persona response:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate persona response.',
    });
  }
}
