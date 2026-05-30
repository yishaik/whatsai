import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatRoom, Persona, Message, Attachment } from '../types';
import { USER_ID } from '../constants';
import MessageBubble from './MessageBubble';
import { SendIcon, ChatBubbleLeftRightIcon, PencilIcon, TrashIcon, PaperClipIcon, XMarkIcon } from './icons';
import Avatar from './Avatar';
import SourceViewerModal from './SourceViewerModal';
import { generatePersonaResponse } from '../services/geminiService';

// v1 attachments: images only, capped in count and size.
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

interface ChatViewProps {
  chatRoom: ChatRoom | null;
  personasMap: { [id: string]: Persona };
  authReady: boolean;
  onSendMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  onUploadFile: (file: File) => Promise<Attachment>;
  onClaimResponse: (chatId: string, triggerMessageId: string, personaId: string) => Promise<boolean>;
  onEditChat?: () => void;
  onDeleteChat?: () => void;
}

// Thumbnail for a not-yet-sent image, with its own object-URL lifecycle.
const PendingThumb: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div className="relative flex-shrink-0">
      {url && <img src={url} alt={file.name} className="h-16 w-16 rounded-md object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white rounded-full p-0.5 hover:bg-red-600"
        title="Remove"
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const TypingIndicator: React.FC<{ persona: Persona }> = ({ persona }) => (
    <div className="flex items-center gap-2 p-2">
        <Avatar src={persona.avatar} name={persona.name} size={32} />
        <div className="flex items-center gap-1.5 bg-message-in px-4 py-2 rounded-lg">
            <span className="h-2 w-2 bg-text-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="h-2 w-2 bg-text-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="h-2 w-2 bg-text-secondary rounded-full animate-bounce"></span>
        </div>
    </div>
);

const ChatView: React.FC<ChatViewProps> = ({ chatRoom, personasMap, authReady, onSendMessage, onUploadFile, onClaimResponse, onEditChat, onDeleteChat }) => {
  const [inputText, setInputText] = useState('');
  const [typingPersonas, setTypingPersonas] = useState<Set<string>>(new Set());
  const [failedPersonas, setFailedPersonas] = useState<string[]>([]);
  const [viewingSourceUrl, setViewingSourceUrl] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track which user messages have already triggered AI responses
  const respondedToRef = useRef<Set<string>>(new Set());
  // Track the previous chatRoom ID to detect chat switches
  const prevChatRoomIdRef = useRef<string | null>(null);
  // Aborts in-flight response generation when the chat changes or unmounts
  const generationAbortRef = useRef<AbortController | null>(null);

  // Reset responded tracking and cancel in-flight generation when switching chats
  useEffect(() => {
    if (chatRoom?.id !== prevChatRoomIdRef.current) {
      generationAbortRef.current?.abort();
      generationAbortRef.current = null;
      respondedToRef.current = new Set();
      prevChatRoomIdRef.current = chatRoom?.id || null;
      setTypingPersonas(new Set());
      setFailedPersonas([]);
      setPendingFiles([]);
      setAttachError(null);
    }
  }, [chatRoom?.id]);

  // Cancel any in-flight generation on unmount
  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort();
    };
  }, []);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatRoom?.messages, typingPersonas]);
  
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file later
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) { errors.push(`${f.name}: only images are supported`); continue; }
      if (f.size > MAX_FILE_BYTES) { errors.push(`${f.name}: over 10MB`); continue; }
      accepted.push(f);
    }
    setPendingFiles(prev => {
      const room = MAX_ATTACHMENTS - prev.length;
      if (accepted.length > room) errors.push(`Up to ${MAX_ATTACHMENTS} images per message`);
      return [...prev, ...accepted.slice(0, Math.max(0, room))];
    });
    setAttachError(errors.length ? errors.join(' · ') : null);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!chatRoom || typingPersonas.size !== 0 || !authReady || uploading) return;
    if (!text && pendingFiles.length === 0) return;

    setFailedPersonas([]);

    let attachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        attachments = await Promise.all(pendingFiles.map(f => onUploadFile(f)));
      } catch (error) {
        console.error('Attachment upload failed:', error);
        setAttachError('Upload failed — please try again.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSendMessage(chatRoom.id, {
      authorId: USER_ID,
      text,
      sources: [],
      attachments: attachments.length ? attachments : undefined,
    });
    setInputText('');
    setPendingFiles([]);
    setAttachError(null);
  };

  const triggerAIResponses = useCallback(async (lastMessage: Message) => {
    if (!chatRoom || lastMessage.authorId !== USER_ID) return;

    // Prevent this client from re-triggering for the same message
    if (respondedToRef.current.has(lastMessage.id)) return;
    respondedToRef.current.add(lastMessage.id);

    // Snapshot chat context; it must not change mid-loop if the user navigates.
    const chatId = chatRoom.id;
    const chatTopic = chatRoom.topic;
    // Running history accumulates each persona's reply as it lands, so later
    // personas in this round react to earlier ones — a real group conversation
    // rather than N monologues all answering the same stale snapshot.
    const runningHistory = [...chatRoom.messages];

    // Image attachments on the user's message become vision input for the round.
    const triggerImages = (lastMessage.attachments ?? [])
        .filter(a => a.mimeType.startsWith('image/') && !!a.url)
        .map(a => ({ url: a.url as string, mimeType: a.mimeType }));

    // Skip personas that were deleted while still referenced by this chat.
    const personasInChat = chatRoom.personaIds
        .map(id => personasMap[id])
        .filter((p): p is Persona => Boolean(p));

    const controller = new AbortController();
    generationAbortRef.current = controller;
    const { signal } = controller;

    for (const persona of personasInChat) {
        if (signal.aborted) return;

        // Atomically claim this reply so that across all clients viewing this
        // shared chat, only one generates it. Skip if another client owns it.
        let won = false;
        try {
            won = await onClaimResponse(chatId, lastMessage.id, persona.id);
        } catch (error) {
            // Claim infra error: skip rather than risk a duplicate. The other
            // client (if any) still handles it; otherwise the user can re-send.
            console.error("Failed to claim response slot for", persona.name, error);
        }
        if (signal.aborted) return;
        if (!won) continue;

        setTypingPersonas(prev => new Set(prev).add(persona.id));
        try {
            const response = await generatePersonaResponse(persona, chatTopic, runningHistory, personasInChat, personasMap, triggerImages, signal);
            if (signal.aborted) return;
            // Make this reply visible to the next persona in the round. Convex's
            // live query will reconcile the real message; this is only the local
            // context fed to subsequent personas this round.
            runningHistory.push({
                id: `pending-${lastMessage.id}-${persona.id}`,
                authorId: persona.id,
                text: response.text,
                timestamp: lastMessage.timestamp + runningHistory.length,
                sources: response.sources,
            });
            onSendMessage(chatId, {
                authorId: persona.id,
                text: response.text,
                sources: response.sources,
            });
        } catch (error) {
            if (signal.aborted) return;
            console.error("Failed to get AI response for", persona.name, error);
            setFailedPersonas(prev => [...prev, persona.name]);
        } finally {
            setTypingPersonas(prev => {
                const newSet = new Set(prev);
                newSet.delete(persona.id);
                return newSet;
            });
        }
    }
  }, [chatRoom, personasMap, onSendMessage, onClaimResponse]);
  
  useEffect(() => {
    if (chatRoom && chatRoom.messages.length > 0) {
        const lastMessage = chatRoom.messages[chatRoom.messages.length - 1];
        if (lastMessage.authorId === USER_ID) {
            triggerAIResponses(lastMessage);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoom?.messages]);

  const isGenerating = typingPersonas.size > 0;

  if (!chatRoom) {
    return (
      <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col items-center justify-center text-center p-8 bg-chat-bg">
        <ChatBubbleLeftRightIcon className="h-24 w-24 text-icon-default opacity-30" />
        <h2 className="mt-4 text-2xl font-light text-text-primary">Welcome to AI Persona Chat</h2>
        <p className="mt-2 text-text-secondary">Select a chat to start messaging or create a new one.</p>
      </div>
    );
  }

  return (
    <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col bg-chat-bg">
      <header className="p-3 bg-panel-header-bg flex items-center gap-4 h-[60px] border-l border-black">
        <Avatar src={chatRoom.avatar} seed={chatRoom.topic} size={40} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-text-primary truncate">{chatRoom.topic}</h2>
          <p className="text-sm text-text-secondary truncate">
            {['You', ...chatRoom.personaIds.map(id => personasMap[id]?.name || 'Unknown')].join(', ')}
          </p>
        </div>
        {onEditChat && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button 
              onClick={onEditChat}
              className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg"
              title="Edit chat"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            {onDeleteChat && (
              <button 
                onClick={() => { if (confirm('Delete this chat?')) onDeleteChat(); }}
                className="text-icon-default hover:text-red-500 p-2 rounded-full hover:bg-item-hover-bg transition-colors"
                title="Delete chat"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
        {chatRoom.messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            persona={msg.authorId !== USER_ID ? personasMap[msg.authorId] : null}
            isOwnMessage={msg.authorId === USER_ID}
            onSourceClick={setViewingSourceUrl}
          />
        ))}
        {Array.from(typingPersonas).map(id => (
            personasMap[id] ? <TypingIndicator key={id} persona={personasMap[id]} /> : null
        ))}
        {failedPersonas.map((name, i) => (
            <div key={`fail-${i}`} className="text-center text-xs text-red-400 bg-red-500/10 rounded-lg py-1.5 px-3 mx-auto max-w-md">
                ⚠️ {name} couldn't respond. Please try again.
            </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-3 bg-panel-header-bg">
        {pendingFiles.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {pendingFiles.map((file, i) => (
              <PendingThumb key={`${file.name}-${i}`} file={file} onRemove={() => removePendingFile(i)} />
            ))}
          </div>
        )}
        {attachError && (
          <p className="text-xs text-red-400 mb-2">{attachError}</p>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating || !authReady || uploading || pendingFiles.length >= MAX_ATTACHMENTS}
            title="Attach images"
            className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperClipIcon className="h-6 w-6" />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={!authReady ? "Connecting..." : isGenerating ? "AI is responding..." : uploading ? "Uploading..." : "Type a message..."}
            disabled={isGenerating || !authReady || uploading}
            className="flex-1 bg-item-active-bg rounded-lg p-3 text-text-primary outline-none focus:ring-2 focus:ring-accent-green disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && pendingFiles.length === 0) || isGenerating || !authReady || uploading}
            className={`rounded-full p-3 text-white transition flex-shrink-0 ${
              isGenerating || uploading
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-accent-green hover:bg-opacity-90 disabled:bg-gray-500 disabled:cursor-not-allowed'
            }`}
          >
            {isGenerating || uploading ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <SendIcon className="h-6 w-6" />
            )}
          </button>
        </form>
      </footer>
      
      <SourceViewerModal 
        isOpen={!!viewingSourceUrl} 
        url={viewingSourceUrl}
        onClose={() => setViewingSourceUrl(null)} 
      />
    </div>
  );
};

export default ChatView;
