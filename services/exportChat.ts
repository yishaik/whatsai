import { Message } from '../types';

// Format a chat as Markdown for export/download.
export const exportChatMarkdown = (
  topic: string,
  messages: Message[],
  nameFor: (authorId: string) => string,
): string => {
  const lines: string[] = [`# ${topic}`, '', `_Exported ${new Date().toLocaleString()}_`, ''];
  for (const m of messages) {
    const who = m.authorId === 'user' ? 'You' : nameFor(m.authorId);
    lines.push(`**${who}** · _${new Date(m.timestamp).toLocaleString()}_`, '');
    if (m.text) lines.push(m.text, '');
    for (const a of m.attachments ?? []) lines.push(`📎 ${a.name}`, '');
    for (const s of m.sources ?? []) lines.push(`> [${s.title}](${s.uri})`, '');
    lines.push('---', '');
  }
  return lines.join('\n');
};

// Trigger a client-side file download.
export const downloadText = (filename: string, content: string, mime = 'text/markdown'): void => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Safe filename from a chat topic.
export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'chat';
