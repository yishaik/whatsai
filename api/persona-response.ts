import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

// Per-IP rate limit, backed by Convex (shared across lambda instances), so this
// paid endpoint can't be hammered directly. Inlined (no cross-dir import — that
// breaks the ESM serverless runtime); fails OPEN if Convex is unreachable.
const clientIp = (req: any): string =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  String(req.headers['x-real-ip'] || '') ||
  'unknown';

const ipLimitOk = async (req: any, action: string): Promise<boolean> => {
  const url = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) return true;
  try {
    const client = new ConvexHttpClient(url);
    const ref = makeFunctionReference<'mutation'>('chat:consumeIpLimit');
    return await client.mutation(ref, { ip: clientIp(req), action });
  } catch (error) {
    console.error('IP rate-limit check failed (allowing):', error);
    return true;
  }
};

// Provider detection is inlined (not imported from ../services/models) because
// this serverless function runs as ESM and a cross-directory relative import
// fails to resolve at runtime (ERR_MODULE_NOT_FOUND). The client keeps the full
// registry; the server only needs default + provider routing.
const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite-preview';
const providerForModel = (id: string): 'openai' | 'gemini' =>
  /^(gpt|o\d|chatgpt)/i.test(id) ? 'openai' : 'gemini';

// ==================== TOOL-USE (SKILLS) ====================
// Persona "skills" map to callable tools. `web_search` is handled natively
// (Gemini googleSearch) and is NOT a function tool. The rest are function
// tools used via provider function-calling. The whole tool path is wrapped in a
// fallback to plain generation, so a tool/SDK mismatch can never break a reply.
const MAX_TOOL_ROUNDS = 3;
const FETCH_MAX_BYTES = 200_000;

const isBlockedHost = (host: string): boolean =>
  /^(localhost$|127\.|0\.0\.0\.0|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i.test(host);

const stripHtml = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const runTool = async (name: string, args: any, timezone: string): Promise<string> => {
  try {
    if (name === 'fetch_url') {
      const raw = String(args?.url || '');
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        return 'Invalid URL.';
      }
      if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) return 'URL not allowed.';
      const resp = await fetch(u.toString(), { headers: { 'User-Agent': 'WhatsAI-bot/1.0' } });
      if (!resp.ok) return `Fetch failed: HTTP ${resp.status}.`;
      const buf = Buffer.from(await resp.arrayBuffer());
      const text = stripHtml(buf.subarray(0, FETCH_MAX_BYTES).toString('utf8'));
      return text.slice(0, 2000) || 'No readable text found at that URL.';
    }
    if (name === 'calculate') {
      const expr = String(args?.expression || '');
      if (!/^[-+*/().\d\s%]+$/.test(expr)) return 'Only basic arithmetic (+ - * / % parentheses) is supported.';
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${expr});`)();
      return String(val);
    }
    if (name === 'datetime') {
      return `Current time: ${new Date().toISOString()} (UTC). The user's timezone is "${timezone}".`;
    }
    return `Unknown tool: ${name}`;
  } catch (error) {
    return `Tool error: ${error instanceof Error ? error.message : 'failed'}`;
  }
};

// JSON-schema tool declarations (OpenAI shape; converted for Gemini below).
const TOOL_DECLS: Record<string, { name: string; description: string; parameters: any }> = {
  fetch_url: {
    name: 'fetch_url',
    description: 'Fetch a web page and return its readable text (truncated). Use to read a URL the user shared or look something up at a known URL.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'Absolute http(s) URL to fetch.' } }, required: ['url'] },
  },
  calculate: {
    name: 'calculate',
    description: 'Evaluate a basic arithmetic expression, e.g. "(2+3)*4".',
    parameters: { type: 'object', properties: { expression: { type: 'string', description: 'Arithmetic expression.' } }, required: ['expression'] },
  },
  datetime: {
    name: 'datetime',
    description: "Get the current date/time and the user's timezone.",
    parameters: { type: 'object', properties: {} },
  },
};

// Gemini wants uppercase Type enum values; uppercase every `type` recursively.
const toGeminiSchema = (schema: any): any => {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(schema)) {
      out[k] = k === 'type' && typeof v === 'string' ? v.toUpperCase() : toGeminiSchema(v);
    }
    return out;
  }
  return schema;
};

// Which function tools a persona's skills enable (web_search excluded — native).
const functionToolsFor = (skills: string[]): { name: string; description: string; parameters: any }[] =>
  skills.filter((s) => s !== 'web_search' && TOOL_DECLS[s]).map((s) => TOOL_DECLS[s]);

type Persona = {
  id: string;
  name: string;
  avatar?: string;
  prompt: string;
  canSearch?: boolean;
  skills?: string[];
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
    if (!(await ipLimitOk(req, 'ai'))) {
      return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
    }

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
    // Per-chat temperature override, clamped to a safe range; default 0.9.
    const temperature =
      typeof body.temperature === 'number' && isFinite(body.temperature)
        ? Math.max(0, Math.min(2, body.temperature))
        : 0.9;

    const otherPersonas = allPersonasInChat
      .filter((participant: any) => participant.id !== personaWithoutAvatar.id)
      .map((participant: any) => participant.name)
      .join(', ');
    const formattedHistory = formatChatHistory(history, personasMap);

    const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'UTC';
    const nowIso = new Date().toISOString();
    // Reminder/recurring-message capability. The model emits a strict token only
    // when the user actually asks; the client parses it, strips it from the
    // displayed text, and persists the reminder (auth stays on the client). A
    // text token (not provider function-calling) so it works uniformly across
    // Gemini/OpenAI and streaming, and never conflicts with Google Search.
    const reminderInstruction = `

You can schedule reminders or recurring messages for the user. The current time is ${nowIso} (UTC); the user's timezone is "${timezone}".
If — and ONLY if — the user clearly asks to be reminded of something or to repeat a message on a schedule, first reply naturally (briefly confirm what you'll send and when), then append on a NEW LINE a token of EXACTLY this form (and nothing after it):
[[REMINDER]]{"text":"<message to post at that time>","when":"<absolute ISO 8601 datetime with timezone offset>","repeat":"none"}
Set "repeat" to one of "none" (one-off), "hourly", "daily", "weekly", or "monthly". Compute "when" as the first occurrence, interpreting relative times ("in 10 minutes", "tomorrow at 9am") in the user's timezone. Never output this token unless the user actually requested a reminder, and never mention the token or its format in your reply.`;

    const systemInstruction = `You are in a group chat. The chat topic is: "${chatTopic}".
Your persona is "${personaWithoutAvatar.name}". Your personality is: "${personaWithoutAvatar.prompt}".
The other participants are: User${otherPersonas ? `, ${otherPersonas}` : ''}.
You must respond as "${personaWithoutAvatar.name}". Your response must be in character.
Do not prefix your response with your name (e.g., don't write "${personaWithoutAvatar.name}:"). Just provide the message content.${reminderInstruction}`;

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

    // Skills → tools. `web_search` is native (Gemini googleSearch); the rest are
    // function tools handled via the buffered tool-calling path below.
    const skills = Array.isArray(personaWithoutAvatar.skills) ? personaWithoutAvatar.skills : [];
    const webSearch = personaWithoutAvatar.canSearch === true || skills.includes('web_search');
    const functionTools = functionToolsFor(skills);

    // Emit a buffered (non-streamed) result as either a single SSE delta or JSON.
    const emitBuffered = (text: string, usage: any) => {
      if (wantStream) {
        const send = openSse();
        if (text) send({ delta: text });
        send({ done: true, sources: [], usage });
        res.end();
      } else {
        res.status(200).json({ text, sources: [], usage });
      }
    };

    // ==================== TOOL-CALLING PATH (skill-enabled personas) ====================
    // Only personas with function-tool skills take this buffered path; everyone
    // else keeps the streaming paths below. Wrapped in a fallback to plain
    // generation so a tool/SDK mismatch degrades to a normal reply, never an error.
    if (functionTools.length > 0) {
      let finalText = '';
      const usageOut = { provider, model: requestedModel, inputTokens: 0, outputTokens: 0 };
      try {
        if (provider === 'openai') {
          const openaiKey = process.env.OPENAI_API_KEY;
          if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');
          const openai = new OpenAI({ apiKey: openaiKey });
          const userContent: any = images.length
            ? [{ type: 'text', text: userPromptText }, ...images.filter((i: any) => i?.url).map((i: any) => ({ type: 'image_url', image_url: { url: i.url } }))]
            : userPromptText;
          const msgs: any[] = [{ role: 'system', content: systemInstruction }, { role: 'user', content: userContent }];
          const tools: any = functionTools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const allowTools = round < MAX_TOOL_ROUNDS - 1;
            const completion = await openai.chat.completions.create({ model: requestedModel, messages: msgs, temperature, ...(allowTools ? { tools } : {}) });
            usageOut.inputTokens += completion.usage?.prompt_tokens ?? 0;
            usageOut.outputTokens += completion.usage?.completion_tokens ?? 0;
            const msg = completion.choices?.[0]?.message;
            const calls = msg?.tool_calls ?? [];
            if (!allowTools || calls.length === 0) {
              finalText = msg?.content?.trim() ?? '';
              break;
            }
            msgs.push(msg);
            for (const tc of calls) {
              let a: any = {};
              try { a = JSON.parse((tc as any).function.arguments || '{}'); } catch { a = {}; }
              const result = await runTool((tc as any).function.name, a, timezone);
              msgs.push({ role: 'tool', tool_call_id: (tc as any).id, content: result });
            }
          }
        } else {
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const fnDecls = functionTools.map((t) => toGeminiSchema({ name: t.name, description: t.description, parameters: t.parameters }));
          const baseCfg: Record<string, any> = { systemInstruction, temperature, topP: 0.95, topK: 40 };
          const toolCfg = { ...baseCfg, tools: [{ functionDeclarations: fnDecls }] };
          const imageParts = await buildImageParts(images);
          const contents: any[] = [{ role: 'user', parts: [{ text: userPromptText }, ...imageParts] }];
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const allowTools = round < MAX_TOOL_ROUNDS - 1;
            const resp = await ai.models.generateContent({ model: requestedModel, contents, config: allowTools ? toolCfg : baseCfg });
            if (resp.usageMetadata) {
              usageOut.inputTokens += resp.usageMetadata.promptTokenCount ?? 0;
              usageOut.outputTokens += resp.usageMetadata.candidatesTokenCount ?? 0;
            }
            const calls = resp.functionCalls ?? [];
            if (!allowTools || calls.length === 0) {
              finalText = resp.text?.trim() ?? '';
              break;
            }
            const modelContent = resp.candidates?.[0]?.content;
            if (modelContent) contents.push(modelContent);
            const parts: any[] = [];
            for (const call of calls) {
              const result = await runTool(call.name as string, (call as any).args || {}, timezone);
              parts.push({ functionResponse: { name: call.name, response: { result } } });
            }
            contents.push({ role: 'user', parts });
          }
        }
      } catch (toolError) {
        console.error('Tool-calling failed, falling back to plain generation:', toolError);
        try {
          if (provider === 'openai') {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
            const userContent: any = images.length
              ? [{ type: 'text', text: userPromptText }, ...images.filter((i: any) => i?.url).map((i: any) => ({ type: 'image_url', image_url: { url: i.url } }))]
              : userPromptText;
            const c = await openai.chat.completions.create({ model: requestedModel, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userContent }], temperature });
            finalText = c.choices?.[0]?.message?.content?.trim() ?? '';
            usageOut.inputTokens += c.usage?.prompt_tokens ?? 0;
            usageOut.outputTokens += c.usage?.completion_tokens ?? 0;
          } else {
            const ai = new GoogleGenAI({ apiKey: getApiKey() });
            const imageParts = await buildImageParts(images);
            const r = await ai.models.generateContent({ model: requestedModel, contents: [{ role: 'user', parts: [{ text: userPromptText }, ...imageParts] }], config: { systemInstruction, temperature, topP: 0.95, topK: 40 } });
            finalText = r.text?.trim() ?? '';
            if (r.usageMetadata) {
              usageOut.inputTokens += r.usageMetadata.promptTokenCount ?? 0;
              usageOut.outputTokens += r.usageMetadata.candidatesTokenCount ?? 0;
            }
          }
        } catch (fallbackError) {
          const msg = fallbackError instanceof Error ? fallbackError.message : 'generation failed';
          if (wantStream) { const send = openSse(); send({ error: msg }); res.end(); return; }
          return res.status(500).json({ error: msg });
        }
      }
      emitBuffered(finalText, usageOut);
      return;
    }

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
            temperature,
            stream: true,
            stream_options: { include_usage: true },
          });
          let inputTokens = 0;
          let outputTokens = 0;
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) send({ delta });
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens ?? 0;
              outputTokens = chunk.usage.completion_tokens ?? 0;
            }
          }
          // OpenAI has no built-in web search.
          send({ done: true, sources: [], usage: { provider: 'openai', model: requestedModel, inputTokens, outputTokens } });
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
        temperature,
      });
      const text = completion.choices?.[0]?.message?.content?.trim() ?? '';
      const u = completion.usage;
      return res.status(200).json({
        text,
        sources: [],
        usage: { provider: 'openai', model: requestedModel, inputTokens: u?.prompt_tokens ?? 0, outputTokens: u?.completion_tokens ?? 0 },
      });
    }

    // ==================== GEMINI ====================
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const config: Record<string, any> = {
      systemInstruction,
      temperature,
      topP: 0.95,
      topK: 40,
    };
    if (webSearch) {
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
        let usageMeta: any = undefined;
        for await (const chunk of stream) {
          const delta = chunk.text ?? '';
          if (delta) send({ delta });
          const gm = chunk.candidates?.[0]?.groundingMetadata;
          if (gm) grounding = gm;
          if (chunk.usageMetadata) usageMeta = chunk.usageMetadata;
        }
        send({
          done: true,
          sources: webSearch ? extractSources(grounding) : [],
          usage: { provider: 'gemini', model: requestedModel, inputTokens: usageMeta?.promptTokenCount ?? 0, outputTokens: usageMeta?.candidatesTokenCount ?? 0 },
        });
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
    const sources = webSearch ? extractSources(groundingMetadata) : [];
    const um = response.usageMetadata;
    return res.status(200).json({
      text: responseText,
      sources,
      usage: { provider: 'gemini', model: requestedModel, inputTokens: um?.promptTokenCount ?? 0, outputTokens: um?.candidatesTokenCount ?? 0 },
    });
  } catch (error) {
    console.error('Error generating persona response:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate persona response.',
    });
  }
}
