declare namespace Cloudflare {
  interface Env {
    AI: {
      run(
        model: string,
        input: Record<string, unknown>,
        options?: Record<string, unknown>,
      ): Promise<unknown>;
    };
    PersonaVoiceAgent: unknown;
    ALLOWED_ORIGINS: string;
  }
}

interface Env extends Cloudflare.Env {}
