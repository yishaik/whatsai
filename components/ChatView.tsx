import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { ChatRoom, Persona, Message, Attachment, ReminderInput, UsageInfo } from '../types';
import { USER_ID } from '../constants';
import MessageBubble from './MessageBubble';
import { SendIcon, ChatBubbleLeftRightIcon, PencilIcon, TrashIcon, PaperClipIcon, XMarkIcon, PhoneIcon, PhotoIcon, ClockIcon, MicrophoneIcon } from './icons';
import Avatar from './Avatar';
import SourceViewerModal from './SourceViewerModal';
// Lazy so @google/genai (the Live SDK) only loads when a call actually starts.
const VoiceCallOverlay = lazy(() => import('./VoiceCallOverlay'));
import { generatePersonaResponse, streamPersonaResponse } from '../services/geminiService';
import { speak, stopSpeaking, ttsSupported } from '../services/speech';
import { moderateText, describeCategories } from '../services/moderation';
import { fetchSuggestions } from '../services/suggest';
import { transcribeAudio } from '../services/transcribe';
import { isSameDay } from '../services/time';
import DateSeparator from './DateSeparator';

// v1 attachments: images only, capped in count and size.
const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
// Text-based document attachments: read client-side and folded into the message
// as context. (PDF/binary parsing is a follow-up — needs pdfjs.)
const MAX_DOCS = 3;
const MAX_DOC_BYTES = 256 * 1024; // 256KB raw
const MAX_DOC_CHARS = 20000; // per-file char cap fed to the model
const DOC_EXT_RE = /\.(txt|md|markdown|csv|tsv|json|jsonl|log|xml|ya?ml|ini|toml|ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|c|h|cpp|cc|cs|php|sh|bash|sql|html?|css|scss)$/i;
const isTextDoc = (f: File): boolean =>
  f.type.startsWith('text/') || f.type === 'application/json' || DOC_EXT_RE.test(f.name);

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
  onDeleteMessage: (messageId: string) => Promise<unknown> | void;
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

const ChatView: React.FC<ChatViewProps> = ({ chatRoom, personasMap, authReady, defaultModel, onSendMessage, onUploadFile, onGenerateImage, onScheduleReminder, onRecordUsage, onDeleteMessage, onClaimResponse, onOpenReminders, onEditChat, onDeleteChat }) => {
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
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      setPendingDocs([]);
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
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
    const acceptedImages: File[] = [];
    const acceptedDocs: File[] = [];
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        if (f.size > MAX_FILE_BYTES) { errors.push(`${f.name}: over 10MB`); continue; }
        acceptedImages.push(f);
      } else if (isTextDoc(f)) {
        if (f.size > MAX_DOC_BYTES) { errors.push(`${f.name}: text file over 256KB`); continue; }
        acceptedDocs.push(f);
      } else {
        errors.push(`${f.name}: unsupported (images and text documents only)`);
      }
    }
    if (acceptedImages.length) {
      setPendingFiles(prev => {
        const room = MAX_ATTACHMENTS - prev.length;
        if (acceptedImages.length > room) errors.push(`Up to ${MAX_ATTACHMENTS} images per message`);
        return [...prev, ...acceptedImages.slice(0, Math.max(0, room))];
      });
    }
    if (acceptedDocs.length) {
      setPendingDocs(prev => {
        const room = MAX_DOCS - prev.length;
        if (acceptedDocs.length > room) errors.push(`Up to ${MAX_DOCS} documents per message`);
        return [...prev, ...acceptedDocs.slice(0, Math.max(0, room))];
      });
    }
    setAttachError(errors.length ? errors.join(' · ') : null);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removePendingDoc = (index: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index));
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
    if (!text && pendingFiles.length === 0 && pendingDocs.length === 0) return;

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

    // Fold attached text documents into the message as context for the model.
    let finalText = text;
    if (pendingDocs.length > 0) {
      const parts: string[] = [];
      for (const doc of pendingDocs) {
        try {
          const raw = await doc.text();
          const clipped = raw.slice(0, MAX_DOC_CHARS);
          parts.push(`\n\n[Attached document: ${doc.name}]\n${clipped}${raw.length > MAX_DOC_CHARS ? '\n…(truncated)' : ''}`);
        } catch {
          // skip unreadable doc
        }
      }
      if (parts.length) finalText = (text + parts.join('')).trim();
    }

    try {
      await onSendMessage(chatRoom.id, {
        authorId: USER_ID,
        text: finalText,
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
    setPendingDocs([]);
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

  // Auto-grow the composer textarea to fit its content (up to a max height,
  // after which it scrolls). Runs whenever the text changes, including when
  // it's cleared after sending or filled by transcription.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputText]);
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

  // Record a voice message, transcribe it (OpenAI whisper), and append the text
  // to the composer. Toggling while recording stops and transcribes.
  const handleMicClick = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAttachError('Voice recording is not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          if (text) setInputText((prev) => (prev ? prev + ' ' : '') + text);
        } catch (err) {
          setAttachError(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      setRecording(true);
      setAttachError(null);
    } catch {
      setAttachError('Microphone permission was denied.');
    }
  };

  const handleStop = () => {
    generationAbortRef.current?.abort();
    setTypingPersonas(new Set());
    setStreamingText({});
  };

  // Regenerate one persona reply: delete it, then generate a fresh response for
  // that persona against the conversation up to (but excluding) that reply.
  const handleRegenerate = async (message: Message) => {
    if (!chatRoom || isGenerating || message.authorId === USER_ID) return;
    const persona = personasMap[message.authorId];
    if (!persona) return;
    const idx = chatRoom.messages.findIndex((m) => m.id === message.id);
    if (idx < 0) return;
    const history = chatRoom.messages.slice(0, idx);
    const chatId = chatRoom.id;
    const personasInChat = chatRoom.personaIds.map((id) => personasMap[id]).filter((p): p is Persona => Boolean(p));
    const model = persona.model || chatRoom.model || defaultModel;

    try {
      await onDeleteMessage(message.id);
    } catch (error) {
      console.error('Failed to delete message for regenerate:', error);
      return;
    }

    const controller = new AbortController();
    generationAbortRef.current = controller;
    const { signal } = controller;
    setTypingPersonas((prev) => new Set(prev).add(persona.id));
    try {
      let response: Awaited<ReturnType<typeof streamPersonaResponse>>;
      try {
        response = await streamPersonaResponse(
          persona, chatRoom.topic, history, personasInChat, personasMap, model, [],
          (full) => { if (!signal.aborted) setStreamingText((prev) => ({ ...prev, [persona.id]: full })); },
          chatRoom.temperature, chatRoom.summary, signal,
        );
      } catch (streamError) {
        if (signal.aborted) return;
        response = await generatePersonaResponse(persona, chatRoom.topic, history, personasInChat, personasMap, model, [], chatRoom.temperature, chatRoom.summary, signal);
      }
      if (signal.aborted) return;
      const outMod = await moderateText(response.text);
      if (signal.aborted) return;
      const replyText = outMod.flagged ? '⚠️ This reply was withheld (content policy).' : response.text;
      onSendMessage(chatId, { authorId: persona.id, text: replyText, sources: outMod.flagged ? [] : response.sources });
      if (response.usage) onRecordUsage(response.usage);
    } catch (error) {
      if (signal.aborted) return;
      console.error('Regenerate failed for', persona.name, error);
      setFailedPersonas((prev) => [...prev, persona.name]);
    } finally {
      setStreamingText((prev) => { const next = { ...prev }; delete next[persona.id]; return next; });
      setTypingPersonas((prev) => { const s = new Set(prev); s.delete(persona.id); return s; });
    }
  };

  const isGenerating = typingPersonas.size > 0;

  // Fetch suggested next messages when it's the user's turn (chat empty, or the
  // last message is from a persona) and nothing is generating. Fails soft.
  useEffect(() => {
    if (!chatRoom || isGenerating) { setSuggestions([]); return; }
    const msgs = chatRoom.messages;
    const last = msgs[msgs.length - 1];
    const userTurn = msgs.length === 0 || (last && last.authorId !== USER_ID);
    if (!userTurn) { setSuggestions([]); return; }
    suggestAbortRef.current?.abort();
    const controller = new AbortController();
    suggestAbortRef.current = controller;
    const history = msgs.slice(-10).map((m) => ({
      author: m.authorId === USER_ID ? 'User' : personasMap[m.authorId]?.name || 'Unknown',
      text: m.text,
    }));
    const personaNames = chatPersonas.map((p) => p.name);
    fetchSuggestions(chatRoom.topic, personaNames, history, controller.signal)
      .then((s) => { if (!controller.signal.aborted) setSuggestions(s); })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoom?.id, chatRoom?.messages.length, isGenerating]);

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
        {chatRoom.messages.map((msg, i) => {
          const prev = i > 0 ? chatRoom.messages[i - 1] : null;
          const showSeparator = !prev || !isSameDay(prev.timestamp, msg.timestamp);
          return (
            <React.Fragment key={msg.id}>
              {showSeparator && <DateSeparator ts={msg.timestamp} />}
              <MessageBubble
                message={msg}
                persona={msg.authorId !== USER_ID ? personasMap[msg.authorId] : null}
                isOwnMessage={msg.authorId === USER_ID}
                onSourceClick={setViewingSourceUrl}
                canSpeak={canSpeak}
                isSpeaking={speakingId === msg.id}
                onToggleSpeak={() => handleToggleSpeak(msg)}
                onRegenerate={msg.authorId !== USER_ID ? () => handleRegenerate(msg) : undefined}
                canRegenerate={!isGenerating && authReady}
              />
            </React.Fragment>
          );
        })}
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
        {pendingDocs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingDocs.map((doc, i) => (
              <span key={`${doc.name}-${i}`} className="flex items-center gap-1.5 bg-item-active-bg rounded-md pl-2 pr-1 py-1 text-xs text-text-primary">
                <PaperClipIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="max-w-[10rem] truncate">{doc.name}</span>
                <button type="button" onClick={() => removePendingDoc(i)} className="text-icon-default hover:text-red-500 p-0.5" title="Remove">
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        {attachError && (
          <p className="text-xs text-red-400 mb-2">{attachError}</p>
        )}
        {suggestions.length > 0 && !inputText.trim() && !isGenerating && pendingFiles.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setInputText(s); setSuggestions([]); }}
                className="text-sm text-left bg-item-active-bg hover:bg-item-hover-bg text-text-primary rounded-2xl px-3 py-1.5 border border-item-hover-bg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-1.5 sm:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,text/*,.md,.markdown,.csv,.tsv,.json,.jsonl,.log,.xml,.yaml,.yml,.ini,.toml,.ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.c,.h,.cpp,.cs,.php,.sh,.sql,.html,.css"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isGenerating || !authReady || uploading || generatingImage || transcribing || moderating}
            title={recording ? 'Stop recording' : 'Record a voice message'}
            className={`p-2 rounded-full hover:bg-item-hover-bg flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${recording ? 'text-red-500 animate-pulse' : 'text-icon-default hover:text-icon-strong'}`}
          >
            {transcribing ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            ) : (
              <MicrophoneIcon className="h-6 w-6" />
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating || !authReady || uploading || generatingImage || (pendingFiles.length >= MAX_ATTACHMENTS && pendingDocs.length >= MAX_DOCS)}
            title="Attach images or text documents"
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
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline. Skip while an IME
              // composition is active so CJK input isn't cut off mid-word.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={!authReady ? "Connecting..." : isGenerating ? "AI is responding..." : uploading ? "Uploading..." : generatingImage ? "Generating image..." : moderating ? "Checking…" : "Type a message, @mention a persona, or describe an image..."}
            disabled={isGenerating || !authReady || uploading || generatingImage || moderating}
            className="flex-1 min-w-0 resize-none max-h-40 overflow-y-auto bg-item-active-bg rounded-lg p-3 text-text-primary outline-none focus:ring-2 focus:ring-accent-green disabled:opacity-50 disabled:cursor-not-allowed leading-snug"
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && pendingFiles.length === 0 && pendingDocs.length === 0) || isGenerating || !authReady || uploading || generatingImage || moderating}
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
            personas={chatPersonas}
            initialPersona={callPersona}
            chatTopic={chatRoom.topic}
            onClose={() => setCallPersona(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ChatView;
