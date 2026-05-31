import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { ChatRoom, Persona, Message, Attachment, ReminderInput, UsageInfo } from '../types';
import { USER_ID } from '../constants';
import MessageBubble from './MessageBubble';
import { SendIcon, ChatBubbleLeftRightIcon, PencilIcon, TrashIcon, PaperClipIcon, XMarkIcon, PhoneIcon, PhotoIcon, ClockIcon } from './icons';
import Avatar from './Avatar';
import SourceViewerModal from './SourceViewerModal';
// Lazy so @google/genai (the Live SDK) only loads when a call actually starts.
const VoiceCallOverlay = lazy(() => import('./VoiceCallOverlay'));
import { generatePersonaResponse, streamPersonaResponse } from '../services/geminiService';
import { speak, stopSpeaking, ttsSupported } from '../services/speech';
import { moderateText, describeCategories } from '../services/moderation';

// v1 attachments: images only, capped in count and size.
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

interface ChatViewProps {
  chatRoom: ChatRoom | null;
  personasMap: { [id: string]: Persona };
  authReady: boolean;
  defaultModel: string;
  onSendMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => void | Promise<void>;
  onUploadFile: (file: File) => Promise<Attachment>;
  onGenerateImage: (prompt: string) => Promise<Attachment>;
  onScheduleReminder: (chatId: string, personaId: string, reminder: ReminderInput) => Promise<void>;
  onRecordUsage: (usage: UsageInfo) => void;
  onClaimResponse: (chatId: string, triggerMessageId: string, personaId: string) => Promise<boolean>;
  onOpenReminders: () => void;
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

// A persona's reply as it streams in, with a blinking cursor. Kept deliberately
// simple (no link/source processing — that happens once the final message lands
// in Convex).
const StreamingBubble: React.FC<{ persona: Persona; text: string }> = ({ persona, text }) => (
    <div className="flex items-end gap-2 w-full justify-start">
        <div className="mb-2"><Avatar src={persona.avatar} name={persona.name} size={32} /></div>
        <div className="flex flex-col max-w-[85%] sm:max-w-sm md:max-w-md lg:max-w-2xl">
            <span className="text-sm font-bold mb-1 ml-3 text-accent-blue">{persona.name}</span>
            <div className="px-4 py-2 rounded-lg text-text-primary bg-message-in">
                <p className="whitespace-pre-wrap">{text}<span className="animate-pulse">▋</span></p>
            </div>
        </div>
    </div>
);

const ChatView: React.FC<ChatViewProps> = ({ chatRoom, personasMap, authReady, defaultModel, onSendMessage, onUploadFile, onGenerateImage, onScheduleReminder, onRecordUsage, onClaimResponse, onOpenReminders, onEditChat, onDeleteChat }) => {
  const [inputText, setInputText] = useState('');
  const [typingPersonas, setTypingPersonas] = useState<Set<string>>(new Set());
  const [streamingText, setStreamingText] = useState<Record<string, string>>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [failedPersonas, setFailedPersonas] = useState<string[]>([]);
  const [callPersona, setCallPersona] = useState<Persona | null>(null);
  const [showCallPicker, setShowCallPicker] = useState(false);
  const canSpeak = ttsSupported();
  const [viewingSourceUrl, setViewingSourceUrl] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
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
      setStreamingText({});
      setFailedPersonas([]);
      setPendingFiles([]);
      setAttachError(null);
      setGeneratingImage(false);
      stopSpeaking();
      setSpeakingId(null);
      setCallPersona(null);
      setShowCallPicker(false);
    }
  }, [chatRoom?.id]);

  // Cancel any in-flight generation and stop speech on unmount
  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  const handleToggleSpeak = (msg: Message) => {
    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(msg.id);
    speak(msg.text, msg.authorId, {
      onend: () => setSpeakingId(prev => (prev === msg.id ? null : prev)),
      onerror: () => setSpeakingId(prev => (prev === msg.id ? null : prev)),
    });
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatRoom?.messages, typingPersonas, streamingText]);
  
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

  const handleGenerateImage = async () => {
    const prompt = inputText.trim();
    if (!chatRoom || !authReady || !prompt || generatingImage || uploading || typingPersonas.size !== 0) return;
    setAttachError(null);
    setGeneratingImage(true);
    try {
      const attachment = await onGenerateImage(prompt);
      await onSendMessage(chatRoom.id, {
        authorId: USER_ID,
        text: prompt,
        sources: [],
        attachments: [attachment],
      });
      setInputText('');
    } catch (error) {
      console.error('Image generation failed:', error);
      setAttachError(`Image generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!chatRoom || typingPersonas.size !== 0 || !authReady || uploading || moderating) return;
    if (!text && pendingFiles.length === 0) return;

    setFailedPersonas([]);

    // Screen the user's text (fails open). Blocks clearly harmful input before
    // it's posted; attachments/empty text skip the check.
    if (text) {
      setModerating(true);
      const mod = await moderateText(text);
      setModerating(false);
      if (mod.flagged) {
        const reason = describeCategories(mod.categories);
        setAttachError(`Message blocked${reason ? ` (${reason})` : ''}. Please revise and try again.`);
        return;
      }
    }

    let attachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        attachments = await Promise.all(pendingFiles.map(f => onUploadFile(f)));
      } catch (error) {
        console.error('Attachment upload failed:', error);
        setAttachError(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    try {
      await onSendMessage(chatRoom.id, {
        authorId: USER_ID,
        text,
        sources: [],
        attachments: attachments.length ? attachments : undefined,
      });
    } catch (error) {
      console.error('Sending message failed:', error);
      setAttachError(`Send failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setInputText('');
    setPendingFiles([]);
    setAttachError(null);
    setMentionQuery(null);
  };

  const triggerAIResponses = useCallback(async (lastMessage: Message) => {
    if (!chatRoom || lastMessage.authorId !== USER_ID) return;

    // Prevent this client from re-triggering for the same message
    if (respondedToRef.current.has(lastMessage.id)) return;
    respondedToRef.current.add(lastMessage.id);

    // Snapshot chat context; it must not change mid-loop if the user navigates.
    const chatId = chatRoom.id;
    const chatTopic = chatRoom.topic;
    const chatModel = chatRoom.model;
    const chatTemperature = chatRoom.temperature;
    const chatSummary = chatRoom.summary;
    const maxResponders = chatRoom.maxResponders;
    const chatRiffRounds = chatRoom.riffRounds;
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

    // @mention targeting: if the user @mentions one or more participants by
    // name, only those reply (overriding the maxResponders cap). Otherwise the
    // per-chat cap applies (default: all). The full participant list is always
    // passed as context so responders know who else is in the room.
    const mentioned = personasInChat.filter((p) =>
        lastMessage.text.toLowerCase().includes('@' + p.name.toLowerCase()));
    const responders = mentioned.length > 0
        ? mentioned
        : typeof maxResponders === 'number' && maxResponders > 0
            ? personasInChat.slice(0, maxResponders)
            : personasInChat;

    const controller = new AbortController();
    generationAbortRef.current = controller;
    const { signal } = controller;

    // One persona's turn: claim (cross-client dedupe), generate (streaming with
    // a non-streaming fallback), moderate, post, record usage + reminders. Used
    // by both the user-triggered round and the persona-to-persona riff rounds.
    const runTurn = async (
        persona: Persona,
        triggerId: string,
        images: { url: string; mimeType: string }[],
    ) => {
        let won = false;
        try {
            won = await onClaimResponse(chatId, triggerId, persona.id);
        } catch (error) {
            // Claim infra error: skip rather than risk a duplicate.
            console.error("Failed to claim response slot for", persona.name, error);
        }
        if (signal.aborted || !won) return;

        // Model fallback chain: per-persona override → per-chat default → user default.
        const model = persona.model || chatModel || defaultModel;

        setTypingPersonas(prev => new Set(prev).add(persona.id));
        try {
            let response: Awaited<ReturnType<typeof streamPersonaResponse>>;
            try {
                response = await streamPersonaResponse(
                    persona, chatTopic, runningHistory, personasInChat, personasMap, model, images,
                    (full) => {
                        if (!signal.aborted) {
                            setStreamingText(prev => ({ ...prev, [persona.id]: full }));
                        }
                    },
                    chatTemperature,
                    chatSummary,
                    signal,
                );
            } catch (streamError) {
                if (signal.aborted) return;
                // Streaming failed — fall back to the non-streaming endpoint.
                console.warn("Streaming failed, falling back to non-streaming:", streamError);
                response = await generatePersonaResponse(persona, chatTopic, runningHistory, personasInChat, personasMap, model, images, chatTemperature, chatSummary, signal);
            }
            if (signal.aborted) return;
            // Screen the persona's reply (fails open). Flagged output is replaced
            // before it's persisted, so the stored/shared message is always safe.
            const outMod = await moderateText(response.text);
            if (signal.aborted) return;
            const replyText = outMod.flagged ? '⚠️ This reply was withheld (content policy).' : response.text;
            const replySources = outMod.flagged ? [] : response.sources;
            // Make this reply visible to the next persona in the round.
            runningHistory.push({
                id: `pending-${triggerId}-${persona.id}`,
                authorId: persona.id,
                text: replyText,
                timestamp: lastMessage.timestamp + runningHistory.length,
                sources: replySources,
            });
            onSendMessage(chatId, {
                authorId: persona.id,
                text: replyText,
                sources: replySources,
            });
            // Tokens were spent regardless of whether the reply was withheld.
            if (response.usage) onRecordUsage(response.usage);
            if (!outMod.flagged) {
                for (const reminder of response.reminders ?? []) {
                    onScheduleReminder(chatId, persona.id, reminder).catch((err) =>
                        console.error('Failed to schedule reminder:', err),
                    );
                }
            }
        } catch (error) {
            if (signal.aborted) return;
            console.error("Failed to get AI response for", persona.name, error);
            setFailedPersonas(prev => [...prev, persona.name]);
        } finally {
            setStreamingText(prev => {
                const next = { ...prev };
                delete next[persona.id];
                return next;
            });
            setTypingPersonas(prev => {
                const newSet = new Set(prev);
                newSet.delete(persona.id);
                return newSet;
            });
        }
    };

    // User-triggered round: the addressed/eligible responders reply in order.
    for (const persona of responders) {
        if (signal.aborted) return;
        await runTurn(persona, lastMessage.id, triggerImages);
    }

    // Persona-to-persona riffing (opt-in per chat): extra rounds where every
    // participant continues the conversation among themselves. Capped at 3, and
    // aborts the moment the user sends again (re-trigger) or hits Stop. The
    // posted messages are persona-authored, so they don't re-trigger this.
    const riffRounds = Math.min(Math.max(chatRiffRounds ?? 0, 0), 3);
    for (let round = 0; round < riffRounds; round++) {
        for (const persona of personasInChat) {
            if (signal.aborted) return;
            await runTurn(persona, `riff:${lastMessage.id}:${round}`, []);
        }
    }
  }, [chatRoom, personasMap, onSendMessage, onScheduleReminder, onRecordUsage, onClaimResponse, defaultModel]);
  
  useEffect(() => {
    if (chatRoom && chatRoom.messages.length > 0) {
        const lastMessage = chatRoom.messages[chatRoom.messages.length - 1];
        if (lastMessage.authorId === USER_ID) {
            triggerAIResponses(lastMessage);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoom?.messages]);

  // Mention autocomplete: when the input ends with "@<fragment>", offer chat
  // participants whose name matches; selecting one inserts "@Name ".
  const handleInputChange = (v: string) => {
    setInputText(v);
    const m = v.match(/@([^\s@]*)$/);
    setMentionQuery(m ? m[1] : null);
  };
  const completeMention = (name: string) => {
    setInputText((prev) => prev.replace(/@[^\s@]*$/, '@' + name + ' '));
    setMentionQuery(null);
  };
  const chatPersonas = chatRoom
    ? chatRoom.personaIds.map((id) => personasMap[id]).filter((p): p is Persona => Boolean(p))
    : [];
  const mentionMatches = mentionQuery !== null
    ? chatPersonas.filter((p) => p.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  const handleStop = () => {
    generationAbortRef.current?.abort();
    setTypingPersonas(new Set());
    setStreamingText({});
  };

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
        <button
          onClick={onOpenReminders}
          className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0"
          title="Reminders"
        >
          <ClockIcon className="h-5 w-5" />
        </button>

        {chatRoom.personaIds.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowCallPicker(v => !v)}
              className="text-icon-default hover:text-accent-green p-2 rounded-full hover:bg-item-hover-bg"
              title="Voice call a persona"
            >
              <PhoneIcon className="h-5 w-5" />
            </button>
            {showCallPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCallPicker(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-panel-bg border border-item-hover-bg rounded-lg shadow-xl py-1">
                  <p className="px-3 py-1 text-xs text-text-secondary">Call a persona</p>
                  {chatRoom.personaIds
                    .map(id => personasMap[id])
                    .filter((p): p is Persona => Boolean(p))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setCallPersona(p); setShowCallPicker(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-item-hover-bg text-left"
                      >
                        <Avatar src={p.avatar} name={p.name} size={28} />
                        <span className="text-sm text-text-primary truncate">{p.name}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

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
            canSpeak={canSpeak}
            isSpeaking={speakingId === msg.id}
            onToggleSpeak={() => handleToggleSpeak(msg)}
          />
        ))}
        {Array.from(typingPersonas).map(id => {
            const persona = personasMap[id];
            if (!persona) return null;
            const partial = streamingText[id];
            return partial
                ? <StreamingBubble key={id} persona={persona} text={partial} />
                : <TypingIndicator key={id} persona={persona} />;
        })}
        {failedPersonas.map((name, i) => (
            <div key={`fail-${i}`} className="text-center text-xs text-red-400 bg-red-500/10 rounded-lg py-1.5 px-3 mx-auto max-w-md">
                ⚠️ {name} couldn't respond. Please try again.
            </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-3 bg-panel-header-bg">
        {isGenerating && (
          <div className="flex justify-center mb-2">
            <button
              type="button"
              onClick={handleStop}
              className="text-xs bg-item-active-bg hover:bg-item-hover-bg text-text-secondary hover:text-text-primary rounded-full px-3 py-1"
            >
              ■ Stop
            </button>
          </div>
        )}
        {mentionMatches.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {mentionMatches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => completeMention(p.name)}
                className="flex items-center gap-1.5 bg-item-active-bg hover:bg-item-hover-bg rounded-full pl-1 pr-3 py-1"
              >
                <Avatar src={p.avatar} name={p.name} size={20} />
                <span className="text-sm text-text-primary">{p.name}</span>
              </button>
            ))}
          </div>
        )}
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
            disabled={isGenerating || !authReady || uploading || generatingImage || pendingFiles.length >= MAX_ATTACHMENTS}
            title="Attach images"
            className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperClipIcon className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={!inputText.trim() || isGenerating || !authReady || uploading || generatingImage}
            title="Generate an image from your text"
            className="text-icon-default hover:text-accent-blue p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatingImage ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            ) : (
              <PhotoIcon className="h-6 w-6" />
            )}
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={!authReady ? "Connecting..." : isGenerating ? "AI is responding..." : uploading ? "Uploading..." : generatingImage ? "Generating image..." : moderating ? "Checking…" : "Type a message, @mention a persona, or describe an image..."}
            disabled={isGenerating || !authReady || uploading || generatingImage || moderating}
            className="flex-1 bg-item-active-bg rounded-lg p-3 text-text-primary outline-none focus:ring-2 focus:ring-accent-green disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && pendingFiles.length === 0) || isGenerating || !authReady || uploading || generatingImage || moderating}
            className={`rounded-full p-3 text-white transition flex-shrink-0 ${
              isGenerating || uploading || moderating
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-accent-green hover:bg-opacity-90 disabled:bg-gray-500 disabled:cursor-not-allowed'
            }`}
          >
            {isGenerating || uploading || moderating ? (
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

      {callPersona && (
        <Suspense fallback={null}>
          <VoiceCallOverlay
            persona={callPersona}
            chatTopic={chatRoom.topic}
            onClose={() => setCallPersona(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ChatView;
