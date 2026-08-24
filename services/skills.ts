// Catalog of per-persona skills. Each skill maps to a capability the persona
// can use when replying. `web_search` is native (Gemini Google Search); the
// rest are function-calling tools implemented server-side in api/persona-response.
export interface SkillDef {
  id: string;
  label: string;
  description: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'web_search', label: 'Web search', description: 'Look up real-time info (Gemini only; ignored on Cloudflare and GPT).' },
  { id: 'fetch_url', label: 'Read URLs', description: 'Fetch and read the contents of a web page.' },
  { id: 'calculate', label: 'Calculator', description: 'Do exact arithmetic.' },
  { id: 'datetime', label: 'Date & time', description: 'Know the current date/time and timezone.' },
  { id: 'youtube_stats', label: 'YouTube stats', description: 'Channel and recent-video stats for the connected YouTube account (Open Connector).' },
  { id: 'mx_lookup', label: 'Mail/DNS lookup', description: 'MX, SPF, DMARC, DNS, and blacklist checks via MxToolbox (Open Connector).' },
  { id: 'telegram_notify', label: 'Telegram ping', description: 'Send a text message through the Telegram ops bot (Open Connector). Off by default.' },
];

export const SKILL_LABELS: Record<string, string> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s.label]),
);
