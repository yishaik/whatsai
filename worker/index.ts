import { Agent, routeAgentRequest, type Connection, type WSMessage } from "agents";
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type VoiceTurnContext,
} from "@cloudflare/voice";

// Cloudflare's recommended live-voice stack: Durable Object + @cloudflare/voice
// (Deepgram Flux STT, Aura TTS, Workers AI LLM). Audio stays on the Worker —
// Vercel is a poor host for long-lived WebSockets.

const VoiceAgent = withVoice(Agent, { historyLimit: 16, maxMessageCount: 200 });

const VOICE_LLM = "@cf/meta/llama-3.1-8b-instruct-fast";
const AURA_SPEAKERS = new Set([
  "angus",
  "asteria",
  "arcas",
  "orion",
  "orpheus",
  "athena",
  "luna",
  "zeus",
  "perseus",
  "helios",
  "hera",
  "stella",
]);

const DEFAULT_SYSTEM =
  "You are on a live voice call. Stay in character. Speak naturally and concisely, like a real phone conversation. Reply in the user's language.";

type PersonaState = {
  systemInstruction: string;
  speaker: string;
  personaName: string;
};

type PersonaPayload = {
  type?: string;
  systemInstruction?: unknown;
  speaker?: unknown;
  personaName?: unknown;
};

export class PersonaVoiceAgent extends VoiceAgent<Env, PersonaState> {
  initialState: PersonaState = {
    systemInstruction: DEFAULT_SYSTEM,
    speaker: "asteria",
    personaName: "",
  };

  transcriber = new WorkersAIFluxSTT(this.ai);
  tts = new WorkersAITTS(this.ai, {
    model: "@cf/deepgram/aura-1",
    speaker: "asteria",
  });

  private get ai() {
    return (this as unknown as { env: Env }).env.AI;
  }

  private applyPersona(data: PersonaPayload) {
    const systemInstruction =
      typeof data.systemInstruction === "string" && data.systemInstruction.trim()
        ? data.systemInstruction.trim().slice(0, 8000)
        : this.state.systemInstruction;
    const speakerRaw = typeof data.speaker === "string" ? data.speaker.trim().toLowerCase() : "";
    const speaker = AURA_SPEAKERS.has(speakerRaw) ? speakerRaw : this.state.speaker;
    const personaName =
      typeof data.personaName === "string" ? data.personaName.trim().slice(0, 80) : this.state.personaName;

    if (speaker !== this.state.speaker) {
      this.tts = new WorkersAITTS(this.ai, {
        model: "@cf/deepgram/aura-1",
        speaker,
      });
    }

    this.setState({ systemInstruction, speaker, personaName });
  }

  onMessage(_connection: Connection, message: WSMessage) {
    if (typeof message !== "string") return;
    try {
      const data = JSON.parse(message) as PersonaPayload;
      if (data?.type === "set_persona") this.applyPersona(data);
    } catch {
      /* not a custom JSON message */
    }
  }

  async onTurn(transcript: string, context: VoiceTurnContext) {
    const system = this.state.systemInstruction || DEFAULT_SYSTEM;
    const history = context.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const result = await this.ai.run(VOICE_LLM, {
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: transcript },
      ],
      max_tokens: 220,
      stream: true,
    });

    if (result instanceof ReadableStream) {
      return tokensFromAiStream(result, context.signal);
    }
    if (result && typeof result === "object" && "response" in result) {
      return String((result as { response?: string }).response ?? "");
    }
    return "";
  }
}

async function* tokensFromAiStream(stream: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as { response?: string };
          if (json.response) yield json.response;
        } catch {
          /* partial SSE frame */
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
}

function isAllowedOrigin(origin: string | null, allowed: string): boolean {
  if (!origin) return true;
  const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".vercel.app") && host.includes("whatsai")) return true;
  } catch {
    return false;
  }
  return false;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    const origin = request.headers.get("Origin");
    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS || "")) {
      return new Response("Forbidden", { status: 403 });
    }

    return (
      (await routeAgentRequest(request, env, {
        cors: true,
        onBeforeConnect: async (req) => {
          const reqOrigin = req.headers.get("Origin");
          if (!isAllowedOrigin(reqOrigin, env.ALLOWED_ORIGINS || "")) {
            return new Response("Forbidden", { status: 403 });
          }
        },
      })) || new Response("Not found", { status: 404 })
    );
  },
};
