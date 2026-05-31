// Catalog of per-persona skills. Each skill maps to a capability the persona
// can use when replying. `web_search` is native (Gemini Google Search); the
// rest are function-calling tools implemented server-side in api/persona-response.
export interface SkillDef {
  id: string;
  label: string;
  description: string;
}

export const SKILLS: SkillDef[] = [
  { id: 'web_search', label: 'Web search', description: 'Look up real-time info (Gemini only; ignored on GPT).' },
  { id: 'fetch_url', label: 'Read URLs', description: 'Fetch and read the contents of a web page.' },
  { id: 'calculate', label: 'Calculator', description: 'Do exact arithmetic.' },
  { id: 'datetime', label: 'Date & time', description: 'Know the current date/time and timezone.' },
];

export const SKILL_LABELS: Record<string, string> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s.label]),
);
