import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import Avatar from './Avatar';

// Read-only public view of a shared chat, rendered when the app is opened with
// a ?share=<token> query param. No auth required — gated purely on the token.
const SharedChatView: React.FC<{ shareId: string }> = ({ shareId }) => {
  const data = useQuery(api.sharing.getSharedChat, { shareId });

  if (data === undefined) {
    return (
      <div className="h-[100dvh] w-screen bg-chat-bg text-text-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading…</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="h-[100dvh] w-screen bg-chat-bg text-text-primary flex flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-light">Link unavailable</h1>
        <p className="text-text-secondary">This shared chat doesn’t exist or sharing was turned off.</p>
        <a href="/" className="text-accent-green hover:underline">Go to WhatsAI</a>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen bg-chat-bg text-white flex flex-col antialiased">
      <header className="p-3 bg-panel-header-bg flex items-center gap-4 h-[60px]">
        <Avatar src={data.avatar} seed={data.topic} size={40} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-text-primary truncate">{data.topic}</h2>
          <p className="text-xs text-text-secondary">Shared read-only conversation</p>
        </div>
        <a href="/" className="text-sm text-accent-green hover:underline flex-shrink-0">Open WhatsAI</a>
      </header>

      <main className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
        {data.messages.length === 0 && (
          <p className="text-center text-text-secondary mt-8">No messages.</p>
        )}
        {data.messages.map((m) => {
          const isUser = m.authorId === 'user';
          return (
            <div key={m.id} className={`flex items-end gap-2 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && <div className="mb-2"><Avatar src={m.authorAvatar} name={m.authorName} size={32} /></div>}
              <div className="flex flex-col max-w-[85%] sm:max-w-md lg:max-w-2xl">
                {!isUser && <span className="text-sm font-bold mb-1 ml-3 text-accent-blue">{m.authorName}</span>}
                <div className={`px-4 py-2 rounded-lg text-text-primary ${isUser ? 'bg-message-out' : 'bg-message-in'}`}>
                  {m.attachments.map((a, i) =>
                    a.url && a.mimeType.startsWith('image/') ? (
                      <img key={i} src={a.url} alt={a.name} className="rounded-md mb-2 max-h-64" />
                    ) : (
                      <p key={i} className="text-xs text-text-secondary">📎 {a.name}</p>
                    ),
                  )}
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                  {m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                      {m.sources.map((s, i) => (
                        <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="block text-xs text-accent-blue hover:underline truncate">
                          🔗 {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default SharedChatView;
