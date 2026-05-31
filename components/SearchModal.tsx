import React, { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { XMarkIcon, MagnifyingGlassIcon } from './icons';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

// Highlight the matched query within a snippet (case-insensitive, first match).
const Snippet: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    const clipped = text.length > 160 ? text.slice(0, 160) + '…' : text;
    return <span>{clipped}</span>;
  }
  const start = Math.max(0, idx - 40);
  const pre = (start > 0 ? '…' : '') + text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const post = text.slice(idx + query.length, idx + query.length + 80) + (idx + query.length + 80 < text.length ? '…' : '');
  return (
    <span>
      {pre}
      <mark className="bg-accent-green/40 text-text-primary rounded px-0.5">{match}</mark>
      {post}
    </span>
  );
};

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectChat }) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setDebounced('');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const results = useQuery(
    api.chat.searchMessages,
    debounced.length >= 2 ? { query: debounced } : 'skip',
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-start z-50 pt-[10vh]" onClick={onClose}>
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-lg mx-3 max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-item-hover-bg flex items-center gap-2">
          <MagnifyingGlassIcon className="h-5 w-5 text-icon-default flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all messages…"
            className="flex-1 bg-transparent text-text-primary outline-none"
          />
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="p-6 text-center text-sm text-text-secondary">Type at least 2 characters to search.</p>
          ) : results === undefined ? (
            <p className="p-6 text-center text-sm text-text-secondary">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-secondary">No messages found.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.messageId}>
                  <button
                    onClick={() => { onSelectChat(r.chatId); onClose(); }}
                    className="w-full text-left px-4 py-3 hover:bg-item-hover-bg border-b border-item-hover-bg/50"
                  >
                    <div className="flex justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-accent-blue truncate">{r.chatTopic}</span>
                      <span className="text-xs text-text-secondary flex-shrink-0">{new Date(r.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      <span className="text-text-primary">{r.authorName}: </span>
                      <Snippet text={r.text} query={debounced} />
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
