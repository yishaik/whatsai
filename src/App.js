import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  MoreVertical, 
  Search, 
  ArrowRight, 
  Send, 
  Plus, 
  Users, 
  Bot, 
  X,
  Check,
  Smile,
  Settings,
  Cpu,
  Image as ImageIcon,
  Paperclip,
  Camera,
  RefreshCcw,
  Sparkles,
  Home
} from 'lucide-react';
import { idbGet, idbSet, idbReady } from './db.js';

// --- Logging System ---
const log = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => {
    if (import.meta.env.DEV) console.debug('[DEBUG]', ...args);
  },
  api: (...args) => {
    if (import.meta.env.DEV) console.log('[API]', ...args);
  }
};

// Error types
const ErrorTypes = {
  API_ERROR: 'API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Global error handler
const handleError = (error, context = {}) => {
  if (error instanceof Error) {
    log.error(`${context.type || ErrorTypes.UNKNOWN_ERROR}: ${error.message}`, {
      context: context,
      stack: error.stack
    });
  } else {
    log.error(`${context.type || ErrorTypes.UNKNOWN_ERROR}: ${String(error)}`, {
      context: context
    });
  }

  // Show user-friendly message if not already shown
  if (!context.silent) {
    const userMessage = getUserFriendlyErrorMessage(error, context);
    if (userMessage) {
      alert(userMessage);
    }
  }
};

const getUserFriendlyErrorMessage = (error, context) => {
  if (typeof error === 'string') {
    if (error.includes('API key')) return 'נא להגדיר מפתח API תקין בהגדרות.';
    if (error.includes('network')) return 'בעיית רשת. נא לבדוק את החיבור לאינטרנט.';
  }

  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) return 'לא ניתן להתחבר לשרת. נא לבדוק את החיבור לאינטרנט.';
    if (error.message.includes('401')) return 'מפתח API לא תקין או פג תוקף.';
    if (error.message.includes('429')) return 'חרגת ממגבלת הבקשות. נא להמתין מספר דקות.';
  }

  switch (context.type) {
    case ErrorTypes.API_ERROR:
      return 'שגיאה בתקשורת עם שרת ה-AI. נא לנסות שוב מאוחר יותר.';
    case ErrorTypes.VALIDATION_ERROR:
      return context.message || 'נתונים לא תקינים. נא לבדוק את הקלט.';
    case ErrorTypes.STORAGE_ERROR:
      return 'שגיאה בשמירת נתונים. נא לנסות שוב.';
    default:
      return 'אירעה שגיאה. נא לנסות שוב או לבדוק את יומן השגיאות.';
  }
};

// Error recovery mechanisms
const ErrorRecovery = {
  // Fallback responses when API fails
  getFallbackResponse: (characterName) => {
    const fallbackResponses = [
      `סליחה, ${characterName}, יש בעיה טכנית. אני אנסה לעזור שוב בקרוב!`,
      `אופס, משהו השתבש. אני עדיין כאן, אבל צריך לבדוק את המערכת.`,
      `השרת עסוק כרגע. אני אנסה לתת מענה טוב יותר בהזדמנות אחרת.`,
      `יש בעיה בחיבור. אני אנסה שוב מאוחר יותר.`
    ];
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  },

  // Check if we should retry based on error type
  shouldRetry: (error, attemptCount) => {
    if (attemptCount >= 3) return false;
    
    if (typeof error === 'string') {
      if (error.includes('network') || error.includes('Failed to fetch')) return true;
      if (error.includes('429')) return false; // Don't retry rate limits
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) return true;
      if (error.message.includes('429')) return false;
    }
    
    return true; // Retry most errors
  },

  // Retry with exponential backoff
  retryWithBackoff: async (fn, maxAttempts = 3, delayMs = 1000) => {
    let attempt = 0;
    let lastError = null;
    
    while (attempt < maxAttempts) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt < maxAttempts) {
          const shouldRetry = ErrorRecovery.shouldRetry(error, attempt);
          if (shouldRetry) {
            const backoffDelay = delayMs * Math.pow(2, attempt - 1);
            log.warn(`Attempt ${attempt} failed, retrying in ${backoffDelay}ms...`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          } else {
            break;
          }
        }
      }
    }
    
    throw lastError;
  }
};
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import Message from './components/Message';

// --- Constants & Config ---
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_NAME = "WhatsApp AI Generator";

// Fallback model list (used if fetch fails)
const FALLBACK_MODELS = [
  { id: "google/gemini-2.0-flash-lite-preview-02-05:free", name: "Gemini 2.0 Flash Lite (Vision, Free)" },
  { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Exp (Vision, Free)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Text, Free)" },
  { id: "qwen/qwen-2.5-vl-72b-instruct:free", name: "Qwen 2.5 VL 72B (Vision, Free)" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (Vision)" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Vision)" },
];

const INITIAL_CHARACTERS = [
  {
    id: 'c1',
    name: 'סחבק',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    systemPrompt: 'אתה חבר טוב, מצחיק, ישראלי, משתמש בסלנג (אח שלי, נשמה, כפרה), ואוהב לעזור. אתה כותב קצר וקולע.',
    color: 'text-blue-500',
    modelId: 'inherit', // 'inherit' | specific id | 'custom'
    customModel: '',
    memory: ''
  },
  {
    id: 'c2',
    name: 'מבקר אמנות',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Picasso',
    systemPrompt: 'אתה מבקר אמנות מתנשא אך מבריק. אתה מנתח תמונות לעומק, מתייחס לקומפוזיציה וצבעים, ומשתמש במילים גבוהות.',
    color: 'text-purple-500',
    modelId: 'inherit',
    customModel: '',
    memory: ''
  }
];

// Wrap the main App component with ErrorBoundary
export default function App() {
  // --- State ---
  
  // API & Config
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('or_api_key') || '');
  const [availableModels, setAvailableModels] = useState(() => {
    const stored = localStorage.getItem('or_available_models');
    return stored ? JSON.parse(stored) : FALLBACK_MODELS;
  });
  const [selectedModelId, setSelectedModelId] = useState(() => localStorage.getItem('or_model_id') || (FALLBACK_MODELS[0]?.id || ''));
  const [customModelInput, setCustomModelInput] = useState(() => localStorage.getItem('or_custom_model') || '');
  const [enableMemory, setEnableMemory] = useState(() => (localStorage.getItem('app_enable_memory') ?? 'true') === 'true');
  const [includeDateTimeMeta, setIncludeDateTimeMeta] = useState(() => (localStorage.getItem('app_include_dt_meta') ?? 'true') === 'true');
  const [includeGroupMeta, setIncludeGroupMeta] = useState(() => (localStorage.getItem('app_include_group_meta') ?? 'true') === 'true');

  // Data
  const [characters, setCharacters] = useState(() => {
    const saved = localStorage.getItem('app_characters');
    return saved ? JSON.parse(saved) : INITIAL_CHARACTERS;
  });
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('app_chats');
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [activeChatId, setActiveChatId] = useState(null);
  const [view, setView] = useState('list');
  const [typingStatus, setTypingStatus] = useState({});
  
  // Modals State
  const [showNewCharModal, setShowNewCharModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditPersonaModal, setShowEditPersonaModal] = useState(false);
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);
  const [showPromptGeneratorModal, setShowPromptGeneratorModal] = useState(false);
  const [chatHistoryToView, setChatHistoryToView] = useState(null);
  const [personaToEdit, setPersonaToEdit] = useState(null);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [showGroupManageModal, setShowGroupManageModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [groupEdit, setGroupEdit] = useState({ name: '', topic: '', systemPrompt: '', participants: [] });
  const [promptGeneratorInput, setPromptGeneratorInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // Inputs State
  const [newCharData, setNewCharData] = useState({ name: '', avatar: '', systemPrompt: '', modelId: 'inherit', customModel: '' });
  const [selectedForGroup, setSelectedForGroup] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [participantsDraft, setParticipantsDraft] = useState([]);
  
  const messagesEndRef = useRef(null);

  // --- Effects ---
  // Hydrate from IndexedDB if available
  useEffect(() => {
    (async () => {
      try {
        await idbReady();
        const dbChars = await idbGet('app_characters');
        const dbChats = await idbGet('app_chats');
        if (Array.isArray(dbChars) && dbChars.length) setCharacters(dbChars);
        if (Array.isArray(dbChats)) setChats(dbChats);
      } catch (e) {
        // ignore hydration failure
      }
    })();
  }, []);
  useEffect(() => { 
    try { 
      localStorage.setItem('app_characters', JSON.stringify(characters));
      log.debug('Saved characters to localStorage');
    } catch (error) {
      handleError(error, {
        type: ErrorTypes.STORAGE_ERROR,
        context: { 
          storageType: 'localStorage',
          dataType: 'characters',
          silent: true
        }
      });
    }
    
    idbSet('app_characters', characters).catch((error) => {
      handleError(error, {
        type: ErrorTypes.STORAGE_ERROR,
        context: { 
          storageType: 'IndexedDB',
          dataType: 'characters',
          silent: true
        }
      });
    });
  }, [characters]);
  
  useEffect(() => { 
    try { 
      localStorage.setItem('app_chats', JSON.stringify(chats));
      log.debug('Saved chats to localStorage');
    } catch (error) {
      handleError(error, {
        type: ErrorTypes.STORAGE_ERROR,
        context: { 
          storageType: 'localStorage',
          dataType: 'chats',
          silent: true
        }
      });
    }
    
    idbSet('app_chats', chats).catch((error) => {
      handleError(error, {
        type: ErrorTypes.STORAGE_ERROR,
        context: { 
          storageType: 'IndexedDB',
          dataType: 'chats',
          silent: true
        }
      });
    });
  }, [chats]);
  useEffect(() => { localStorage.setItem('or_api_key', apiKey); }, [apiKey]);
  useEffect(() => { 
    localStorage.setItem('or_model_id', selectedModelId);
    if (selectedModelId === 'custom') localStorage.setItem('or_custom_model', customModelInput);
  }, [selectedModelId, customModelInput]);
  useEffect(() => { localStorage.setItem('or_available_models', JSON.stringify(availableModels)); }, [availableModels]);
  useEffect(() => { localStorage.setItem('app_enable_memory', String(enableMemory)); }, [enableMemory]);
  useEffect(() => { localStorage.setItem('app_include_dt_meta', String(includeDateTimeMeta)); }, [includeDateTimeMeta]);
  useEffect(() => { localStorage.setItem('app_include_group_meta', String(includeGroupMeta)); }, [includeGroupMeta]);

  // Fetch latest models from OpenRouter (top 5)
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': APP_NAME,
          },
        });
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          let models = data.data;
          // Attempt to sort by created desc if present
          models = models.sort((a, b) => (b.created || 0) - (a.created || 0));
          const top5 = models.slice(0, 5).map(m => ({ id: m.id, name: m.name || m.id }));
          // Keep a few known popular options too (de-duped)
          const merged = [];
          const addUnique = (arr) => arr.forEach(m => { if (!merged.find(x => x.id === m.id)) merged.push(m); });
          addUnique(top5);
          addUnique(FALLBACK_MODELS);
          setAvailableModels(merged);
        }
      } catch (_) {
        // ignore, use fallback
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    if (activeChatId && view === 'chat') {
      scrollToBottom();
    }
  }, [chats, activeChatId, view]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- Logic ---

  const activeChat = chats.find(c => c.id === activeChatId);
  const getActiveModelString = () => selectedModelId === 'custom' ? customModelInput : selectedModelId;

  const getModelForCharacter = (character) => {
    if (!character) return getActiveModelString();
    if (character.modelId === 'inherit' || !character.modelId) return getActiveModelString();
    if (character.modelId === 'custom') return character.customModel || getActiveModelString();
    return character.modelId;
  };

  // Enhance persona system prompt using selected model
  const enhancePersonaPrompt = async () => {
    if (!apiKey) {
      alert('נא להגדיר מפתח API של OpenRouter בהגדרות.');
      setShowSettingsModal(true);
      return;
    }
    if (!personaToEdit) return;
    setEnhancingPrompt(true);
    try {
      const modelToUse = getModelForCharacter(personaToEdit);
      const messages = [
        { role: 'system', content: 'אתה עורך מומחה לפרומפטים. החזר גרסה משופרת, תמציתית וברורה לפרומפט המערכת של הדמות — ללא הסברים, רק הטקסט הסופי. שמור על האישיות, הטון, כללי עשה/אל תעשה, ושילוב הקשר: שיחת וואטסאפ, תגובות קצרות בעברית.' },
        { role: 'user', content: `פרומפט מקורי:\n${personaToEdit.systemPrompt}\n\nשפר/י אותו (קצר, חד וברור):` }
      ];
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': APP_NAME,
        },
        body: JSON.stringify({ model: modelToUse, messages, temperature: 0.4, max_tokens: 400 })
      });
      const data = await res.json();
      const improved = data?.choices?.[0]?.message?.content?.trim();
      if (improved) setPersonaToEdit(prev => ({ ...prev, systemPrompt: improved }));
    } catch (e) {
      console.error('Enhance prompt error', e);
      alert('שגיאה בשיפור הפרומפט.');
    } finally {
      setEnhancingPrompt(false);
    }
  };

  const generateSystemPrompt = async () => {
    if (!apiKey) {
      alert('נא להגדיר מפתח API של OpenRouter בהגדרות.');
      setShowSettingsModal(true);
      return;
    }
    if (!promptGeneratorInput.trim()) return;
    setEnhancingPrompt(true);
    try {
      const modelToUse = selectedModelId === 'custom' ? customModelInput : selectedModelId;
      log.info('Generating system prompt with model:', modelToUse);
      
      const messages = [
        { role: 'system', content: 'אתה מומחה ליצירת פרומפטים למערכות AI. צור פרומפט מערכת מקיף ויעיל עבור דמות וואטסאפ AI. הפורמט: אישיות, טון, כללי עשה/אל תעשה, הקשר שיחה, שפה, ואופי התגובות. הכל בקצרה וברור, ללא הסברים.' },
        { role: 'user', content: `צור פרומפט מערכת עבור דמות עם התכונות הבאות:\n\n${promptGeneratorInput}\n\nהחזר רק את הפרומפט הסופי, ללא הסברים או הקדמות.` }
      ];
      
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': APP_NAME,
        },
        body: JSON.stringify({ model: modelToUse, messages, temperature: 0.6, max_tokens: 500 })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP error! status: ${res.status}`;
        
        handleError(errorMessage, {
          type: ErrorTypes.API_ERROR,
          context: {
            function: 'generateSystemPrompt',
            model: modelToUse
          }
        });
        return;
      }

      const data = await res.json();
      
      if (data.error) {
        handleError(data.error, {
          type: ErrorTypes.API_ERROR,
          context: {
            function: 'generateSystemPrompt',
            model: modelToUse
          }
        });
        return;
      }

      const generated = data?.choices?.[0]?.message?.content?.trim();
      if (generated) {
        log.info('Successfully generated system prompt', { length: generated.length });
        setGeneratedPrompt(generated);
      } else {
        log.warn('No prompt generated', { data });
        alert('לא הצלחתי ליצור פרומפט. נא לנסות תיאור שונה.');
      }
    } catch (error) {
      handleError(error, {
        type: ErrorTypes.NETWORK_ERROR,
        context: {
          function: 'generateSystemPrompt'
        }
      });
    } finally {
      setEnhancingPrompt(false);
    }
  };

  const handleSendMessage = async (text, imageBase64 = null) => {
    if (!activeChatId || (!text.trim() && !imageBase64)) return;

    if (!apiKey) {
      alert("נא להגדיר מפתח API של OpenRouter בהגדרות.");
      setShowSettingsModal(true);
      return;
    }

    const newMessage = {
      id: Date.now().toString(),
      senderId: 'user',
      text: text,
      image: imageBase64, // Store image locally for display
      timestamp: Date.now()
    };

    // 1. Add User Message
    setChats(prevChats => prevChats.map(chat => {
      if (chat.id === activeChatId) {
        return { ...chat, messages: [...chat.messages, newMessage] };
      }
      return chat;
    }));

    // 2. Trigger AI
    const original = chats.find(c => c.id === activeChatId);
    if (original) {
      setTypingStatus(prev => ({ ...prev, [activeChatId]: true }));

      // Ensure each persona reads prior personas by generating sequentially
      const responders = original.participants;
      let rollingChat = {
        ...original,
        messages: [...original.messages, newMessage],
        summary: original.summary || ''
      };

      for (const charId of responders) {
        const character = characters.find(c => c.id === charId);
        if (!character) continue;
        try {
          const aiText = await fetchOpenRouterResponse(character, rollingChat.messages, text, imageBase64);
          const aiMessage = {
            id: Date.now().toString() + Math.random(),
            senderId: character.id,
            text: aiText,
            timestamp: Date.now()
          };
          // Update UI and rolling history
          setChats(prevChats => prevChats.map(c => {
            if (c.id === activeChatId) {
              return { ...c, messages: [...c.messages, aiMessage] };
            }
            return c;
          }));
          rollingChat = { ...rollingChat, messages: [...rollingChat.messages, aiMessage] };
          await maybeSummarizeAndRemember(rollingChat);
        } catch (error) {
          console.error('AI Error:', error);
        }
      }

      setTypingStatus(prev => ({ ...prev, [activeChatId]: false }));
    }
  };

  const fetchOpenRouterResponse = async (character, history, userLastMsg, userLastImage) => {
    // Prepare History:
    // To save tokens and complexity, we convert PREVIOUS images in history to a text placeholder "[תמונה]".
    // We ONLY send the actual base64 data for the CURRENT message if it exists.
    
    const recentHistory = history.slice(-6).map(msg => {
      const sender = msg.senderId === 'user' ? 'User' : characters.find(c => c.id === msg.senderId)?.name || 'Bot';
      let content = msg.text;
      if (msg.image) content += " [משתמש צירף תמונה קודמת]"; // Placeholder for history items
      
      return {
        role: msg.senderId === 'user' ? 'user' : 'assistant',
        content: msg.senderId === 'user' ? content : `[${sender}]: ${content}` 
      };
    });

    // Construct Current Message Content (Multimodal if needed)
    let currentMessageContent;
    if (userLastImage) {
      currentMessageContent = [
        { type: "text", text: userLastMsg || "מה אתה רואה בתמונה?" },
        { type: "image_url", image_url: { url: userLastImage } }
      ];
    } else {
      currentMessageContent = userLastMsg;
    }

    // Build memory-aware system content + metadata/context
    const personaMemory = character.memory ? `\n\nזיכרון דמות (פרטים חשובים, העדפות, עובדות):\n${character.memory}` : '';
    const chatSummary = (activeChat?.summary && activeChat.summary.length > 0) ? `\n\nסיכום השיחה עד כה:\n${activeChat.summary}` : '';
    const now = new Date();
    const nowStr = now.toLocaleString('he-IL', { dateStyle: 'full', timeStyle: 'short' });
    const isGroup = activeChat?.type === 'group';
    const participantNames = isGroup ? activeChat.participants.map(pid => characters.find(c => c.id === pid)?.name).filter(Boolean).join(', ') : '';
    const dateLine = includeDateTimeMeta ? `- תאריך ושעה נוכחיים: ${nowStr}.\n` : '';
    const chatTypeLine = includeGroupMeta ? `- סוג שיחה: ${isGroup ? 'קבוצתי' : 'ישיר'}.\n` : '';
    const groupNameLine = (includeGroupMeta && isGroup) ? `- קבוצה: "${activeChat.name}".\n` : '';
    const topicLine = (includeGroupMeta && isGroup && activeChat.topic) ? `- נושא הקבוצה: ${activeChat.topic}.\n` : '';
    const participantsLine = (includeGroupMeta && isGroup) ? `- משתתפים: ${participantNames} + המשתמש.\n` : '';
    const roleLine = includeGroupMeta ? (isGroup 
      ? `- דבר/י אך ורק בתור "${character.name}", ניתן לפנות לאחרים בשמם. אל תענה/י בשם אחרים.`
      : `- שיחה ישירה בין המשתמש לדמות.`) : '';
    const groupSystem = (isGroup && activeChat?.systemPrompt) ? `\n\nהנחיות לקבוצה:\n${activeChat.systemPrompt}` : '';
    const metaBlock = `${dateLine}${chatTypeLine}${groupNameLine}${topicLine}${participantsLine}${roleLine ? roleLine + '\n' : ''}`;
    const systemContent = `${character.systemPrompt}\n\nמטא-נתונים:\n${metaBlock}\nהנחיות:\n- השב/י בקצרה ובעברית (1–3 משפטים).\n- אם נשלחה תמונה, התייחס/י אליה במדויק.\n- שמור/י על עקביות עם הזיכרון והסיכום אם קיימים.${groupSystem}${personaMemory}${chatSummary}`;

    const messagesPayload = [
      {
        role: "system",
        content: systemContent
      },
      ...recentHistory,
      {
        role: "user",
        content: currentMessageContent
      }
    ];

    const modelToUse = getModelForCharacter(character);

    try {
      log.api(`Sending request to OpenRouter with model: ${modelToUse}`);
      log.debug('Request payload:', { model: modelToUse, messages: messagesPayload.length, temperature: 0.7, max_tokens: 300 });

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": APP_NAME,
        },
        body: JSON.stringify({
          "model": modelToUse,
          "messages": messagesPayload,
          "temperature": 0.7,
          "max_tokens": 300,
        })
      });

      log.api(`Received response with status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || `HTTP error! status: ${response.status}`;
        
        handleError(errorMessage, {
          type: ErrorTypes.API_ERROR,
          context: {
            model: modelToUse,
            status: response.status,
            character: character.name
          }
        });
        return `שגיאה: ${errorMessage}`;
      }

      const data = await response.json();
      log.debug('API response:', data);

      if (data.error) {
        handleError(data.error, {
          type: ErrorTypes.API_ERROR,
          context: {
            model: modelToUse,
            character: character.name,
            errorType: data.error.type
          }
        });
        return `שגיאה: ${data.error.message}`;
      }

      if (!data.choices || data.choices.length === 0) {
        log.warn('No choices returned from API', { data, character: character.name });
        return 'לא קיבלתי תגובה מהדמות. נא לנסות שוב.';
      }

      const content = data.choices[0].message.content;
      log.info('Successfully received AI response', { character: character.name, contentLength: content.length });
      return content;

    } catch (error) {
      handleError(error, {
        type: ErrorTypes.NETWORK_ERROR,
        context: {
          model: modelToUse,
          character: character.name,
          function: 'fetchOpenRouterResponse'
        }
      });
      return 'שגיאה ברשת או בשרת. נא לבדוק את החיבור או לנסות שוב מאוחר יותר.';
    }
  };

  // Summarize chat and update persona memory (lightweight, throttled)
  const maybeSummarizeAndRemember = async (chat) => {
    if (!enableMemory || !apiKey) return;
    const total = chat.messages.length;
    if (total < 12 || total % 8 !== 0) return; // throttle frequency

    try {
      const lastWindow = chat.messages.slice(-24).map(m => {
        const who = m.senderId === 'user' ? 'User' : (characters.find(c => c.id === m.senderId)?.name || 'Bot');
        return `${who}: ${m.text || (m.image ? '[תמונה]' : '')}`;
      }).join('\n');

      const summarizerPrompt = [
        { role: 'system', content: 'אתה מסכם שיחות בצורה תמציתית. ציין עובדות חשובות בלבד.' },
        { role: 'user', content: `סכם בקצרה את הדברים החשובים שקרו בשיחה (בהתמקדות בעובדות והעדפות מתמשכות).\n\nשיחה:\n${lastWindow}` }
      ];

      const modelForSummary = selectedModelId === 'custom' ? (customModelInput || selectedModelId) : selectedModelId;
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': APP_NAME,
        },
        body: JSON.stringify({ model: modelForSummary, messages: summarizerPrompt, temperature: 0.2, max_tokens: 200 })
      });
      const data = await res.json();
      const summaryText = data?.choices?.[0]?.message?.content || '';

      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, summary: (c.summary ? (c.summary + '\n' + summaryText) : summaryText) } : c));

      // Extract memory items for personas in this chat
      const memoryPrompt = [
        { role: 'system', content: 'אתה עוזר שיוצר רשימת זיכרון מעשית לדמות על בסיס השיחה.' },
        { role: 'user', content: `שלוף נקודות זיכרון חשובות וקבועות על המשתמש/ים (עובדות, העדפות, סגנון), בפורמט נקודות.\n\nשיחה:\n${lastWindow}` }
      ];
      const res2 = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': APP_NAME,
        },
        body: JSON.stringify({ model: modelForSummary, messages: memoryPrompt, temperature: 0.2, max_tokens: 200 })
      });
      const data2 = await res2.json();
      const memText = data2?.choices?.[0]?.message?.content || '';

      // Append memory to all personas that participated
      setCharacters(prev => prev.map(ch => chat.participants.includes(ch.id) ? { ...ch, memory: (ch.memory ? (ch.memory + '\n' + memText) : memText) } : ch));
    } catch (_) {
      // ignore memory errors
    }
  };

  // --- Helper Functions ---
  const createCharacter = () => {
    if (!newCharData.name || !newCharData.systemPrompt) return;
    const newChar = {
      id: `c${Date.now()}`,
      name: newCharData.name,
      avatar: newCharData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newCharData.name)}-${Date.now()}`,
      systemPrompt: newCharData.systemPrompt,
      color: 'text-teal-600',
      modelId: newCharData.modelId || 'inherit',
      customModel: newCharData.customModel || '',
      memory: ''
    };
    setCharacters([...characters, newChar]);
    setNewCharData({ name: '', avatar: '', systemPrompt: '', modelId: 'inherit', customModel: '' });
    setShowNewCharModal(false);
  };

  const startDirectChat = (character) => {
    const existing = chats.find(c => c.type === 'direct' && c.participants.includes(character.id));
    if (existing) {
      setActiveChatId(existing.id);
    } else {
      const newChat = { id: `chat${Date.now()}`, type: 'direct', participants: [character.id], name: character.name, avatar: character.avatar, messages: [], unread: 0, summary: '' };
      setChats([newChat, ...chats]);
      setActiveChatId(newChat.id);
    }
    setShowNewChatModal(false);
    setView('chat');
  };

  const createGroupChat = () => {
    if (selectedForGroup.length === 0 || !groupName) return;
    const newChat = {
      id: `group${Date.now()}`,
      type: 'group',
      participants: selectedForGroup,
      name: groupName,
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=' + groupName,
      messages: [],
      unread: 0,
      summary: '',
      topic: '',
      systemPrompt: ''
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setSelectedForGroup([]);
    setGroupName('');
    setShowNewGroupModal(false);
    setView('chat');
  };

  const saveGroupEdits = () => {
    if (!groupEdit.name?.trim()) { alert('שם קבוצה נדרש.'); return; }
    if (!Array.isArray(groupEdit.participants) || groupEdit.participants.length === 0) { alert('בחר/י לפחות דמות אחת לקבוצה.'); return; }
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      name: groupEdit.name.trim(),
      topic: groupEdit.topic || '',
      systemPrompt: groupEdit.systemPrompt || '',
      participants: groupEdit.participants
    } : c));
    setShowGroupManageModal(false);
  };

  const deleteChat = (e, chatId) => {
    e.stopPropagation();
    setChats(chats.filter(c => c.id !== chatId));
    if (activeChatId === chatId) setActiveChatId(null);
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-[#dfdfdf] text-gray-900 font-sans overflow-hidden" dir="rtl" style={{ height: '100dvh' }}>
      <div className="fixed top-0 left-0 right-0 h-32 bg-[#00a884] z-0"></div>

      <div className="relative z-10 flex w-full max-w-[1600px] h-full mx-auto shadow-lg overflow-hidden xl:my-5 xl:h-[calc(100vh-40px)] xl:rounded-xl bg-white">
        
        {/* SIDEBAR */}
        <Sidebar
          characters={characters}
          chats={chats}
          activeChatId={activeChatId}
          view={view}
          typingStatus={typingStatus}
          apiKey={apiKey}
          setView={setView}
          setActiveChatId={setActiveChatId}
          setShowNewCharModal={setShowNewCharModal}
          setShowNewChatModal={setShowNewChatModal}
          setShowNewGroupModal={setShowNewGroupModal}
          setShowSettingsModal={setShowSettingsModal}
          setShowPromptGeneratorModal={setShowPromptGeneratorModal}
          setShowChatHistoryModal={setShowChatHistoryModal}
          setChatHistoryToView={setChatHistoryToView}
          deleteChat={deleteChat}
        />

        {/* CHAT AREA */}
        <ChatArea
          activeChat={activeChat}
          characters={characters}
          view={view}
          typingStatus={typingStatus}
          activeChatId={activeChatId}
          messagesEndRef={messagesEndRef}
          apiKey={apiKey}
          setView={setView}
          setShowGroupManageModal={setShowGroupManageModal}
          setGroupEdit={setGroupEdit}
          setShowParticipantsModal={setShowParticipantsModal}
          setParticipantsDraft={setParticipantsDraft}
          setShowEditPersonaModal={setShowEditPersonaModal}
          setPersonaToEdit={setPersonaToEdit}
          handleSendMessage={handleSendMessage}
        />
      </div>

      {/* --- MODALS --- */}
      {showSettingsModal && (
        <Modal title="הגדרות מערכת" onClose={() => setShowSettingsModal(false)}>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">OpenRouter API Key</label>
              <input type="password" className="w-full border border-gray-300 rounded p-2 ltr bg-gray-50 outline-none focus:border-[#00a884]" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-v1-..." dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">בחירת מודל AI</label>
              <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} className="w-full border border-gray-300 rounded p-2 bg-white outline-none focus:border-[#00a884]">
                {availableModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                <option value="custom">אחר (הזנה ידנית)...</option>
              </select>
            </div>
            {selectedModelId === 'custom' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-medium text-gray-600 mb-1">Model ID</label>
                <input type="text" className="w-full border border-gray-300 rounded p-2 ltr bg-gray-50 outline-none" value={customModelInput} onChange={(e) => setCustomModelInput(e.target.value)} placeholder="e.g., anthropic/claude-3-opus" dir="ltr" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input id="dtmeta" type="checkbox" checked={includeDateTimeMeta} onChange={e => setIncludeDateTimeMeta(e.target.checked)} />
              <label htmlFor="dtmeta" className="text-sm">הכלל תאריך ושעה במטא-נתונים</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="groupmeta" type="checkbox" checked={includeGroupMeta} onChange={e => setIncludeGroupMeta(e.target.checked)} />
              <label htmlFor="groupmeta" className="text-sm">הכלל פרטי קבוצה והקשר</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="memtoggle" type="checkbox" checked={enableMemory} onChange={e => setEnableMemory(e.target.checked)} />
              <label htmlFor="memtoggle" className="text-sm">הפעל זיכרון וסיכום שיחה</label>
            </div>
            <button onClick={() => {
              if (confirm('לאפס את הזיכרון לכל הדמויות ואת סיכומי השיחות?')) {
                setCharacters(prev => prev.map(c => ({ ...c, memory: '' })));
                setChats(prev => prev.map(c => ({ ...c, summary: '' })));
              }
            }} className="w-full border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50">אפס זיכרון</button>
            <button onClick={() => setShowSettingsModal(false)} className="w-full bg-[#00a884] text-white py-2 rounded hover:bg-[#008f6f] mt-4">שמור וסגור</button>
          </div>
        </Modal>
      )}
      
      {showNewCharModal && (
        <Modal title="יצירת דמות חדשה" onClose={() => setShowNewCharModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">שם</label>
              <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.name} onChange={e => setNewCharData({...newCharData, name: e.target.value})} />
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600 font-medium">בחר/י או הזן תמונה</label>
              <div className="grid grid-cols-8 gap-2 max-h-[160px] overflow-y-auto p-2 bg-gray-50 rounded-lg border">
                {generateAvatarOptions(newCharData.name || 'User', 24).map((url, i) => (
                  <button key={i} type="button" onClick={() => setNewCharData({ ...newCharData, avatar: url })} 
                          className={`rounded-full border-2 overflow-hidden w-12 h-12 transition-all duration-200 ${newCharData.avatar === url ? 'border-[#00a884] ring-2 ring-[#00a884]/20' : 'border-transparent hover:border-gray-300'}`}>
                    <img src={url} alt="avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => setNewCharData(prev => ({ ...prev, avatar: '' }))} className="text-xs text-gray-600 underline hover:text-red-500">נקה בחירה</button>
                <button type="button" onClick={() => setNewCharData(prev => ({ ...prev, avatar: randomAvatar(prev.name || 'User') }))} className="flex items-center gap-1 text-xs text-[#00a884] hover:text-[#008f6f]"><RefreshCcw className="w-3 h-3"/>אקראי</button>
                <button type="button" onClick={() => {
                  // Generate more diverse avatars
                  const newAvatars = generateAvatarOptions(newCharData.name || 'User', 24);
                  // This will refresh the grid by forcing a re-render
                  setNewCharData(prev => ({ ...prev, avatar: prev.avatar }));
                }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><RefreshCcw className="w-3 h-3"/>רענן אפשרויות</button>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">או הזן כתובת תמונה (URL)</label>
                <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.avatar} onChange={e => setNewCharData({...newCharData, avatar: e.target.value})} dir="ltr" placeholder="https://example.com/image.jpg" />
              </div>
              {newCharData.avatar && (
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                  <div className="text-sm text-gray-600">תצוגה מקדימה:</div>
                  <img src={newCharData.avatar} alt="Preview" className="w-10 h-10 rounded-full object-cover border" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">System Prompt</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={newCharData.systemPrompt} onChange={e => setNewCharData({...newCharData, systemPrompt: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">מודל לדמות זו</label>
              <select value={newCharData.modelId} onChange={e => setNewCharData({ ...newCharData, modelId: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-[#00a884] bg-white">
                <option value="inherit">ברירת מחדל (לפי הגדרות)</option>
                {availableModels.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                <option value="custom">אחר (הזנה ידנית)...</option>
              </select>
              {newCharData.modelId === 'custom' && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Model ID</label>
                  <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.customModel} onChange={e => setNewCharData({ ...newCharData, customModel: e.target.value })} dir="ltr" placeholder="e.g., anthropic/claude-3-opus" />
                </div>
              )}
            </div>
            <button onClick={createCharacter} className="w-full bg-[#00a884] text-white py-2 rounded hover:bg-[#008f6f]" disabled={!newCharData.name}>צור דמות</button>
          </div>
        </Modal>
      )}
      
      {showChatHistoryModal && chatHistoryToView && (
        <Modal title={`היסטוריית שיחות: ${chatHistoryToView.name}`} onClose={() => setShowChatHistoryModal(false)}>
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto border rounded p-3 bg-gray-50">
              {chatHistoryToView.messages.length > 0 ? (
                chatHistoryToView.messages.map((msg, index) => {
                  const senderName = msg.senderId === 'user' ? 'אתה' : (characters.find(c => c.id === msg.senderId)?.name || 'לא ידוע');
                  return (
                    <div key={index} className={`mb-3 p-2 rounded ${msg.senderId === 'user' ? 'bg-blue-50 ml-auto' : 'bg-green-50 mr-auto'} max-w-[80%]`}>
                      <div className="font-medium text-sm">{senderName}</div>
                      <div className="text-sm mt-1">{msg.text}</div>
                      {msg.image && (
                        <div className="mt-2 rounded overflow-hidden">
                          <img src={msg.image} alt="תמונה" className="max-w-full max-h-[200px] object-cover" />
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">{new Date(msg.timestamp).toLocaleString()}</div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500">אין הודעות בהיסטוריה.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                // Export chat history
                const chatText = chatHistoryToView.messages.map(msg => {
                  const senderName = msg.senderId === 'user' ? 'אתה' : (characters.find(c => c.id === msg.senderId)?.name || 'לא ידוע');
                  return `${new Date(msg.timestamp).toLocaleString()} - ${senderName}: ${msg.text}`;
                }).join('\n\n');
                
                const blob = new Blob([chatText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `היסטוריה_${chatHistoryToView.name}_${new Date().toISOString().slice(0,10)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="border px-3 py-2 rounded flex items-center gap-1">
                <Paperclip className="w-4 h-4"/> ייצא טקסט
              </button>
              <button onClick={() => setShowChatHistoryModal(false)} className="ml-auto bg-[#00a884] text-white px-4 py-2 rounded">סגור</button>
            </div>
          </div>
        </Modal>
      )}

      {showPromptGeneratorModal && (
        <Modal title="יצירת פרומפט מערכת עם AI" onClose={() => setShowPromptGeneratorModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">תיאור הדמות או הרעיון</label>
              <textarea 
                className="w-full border p-2 rounded h-32 resize-none outline-none focus:border-[#00a884]"
                value={promptGeneratorInput}
                onChange={e => setPromptGeneratorInput(e.target.value)}
                placeholder="תאר/י את הדמות, האישיות, התפקיד, והמטרה. למשל: 'חבר כיפי שמתמחה במתכונים מהירים, משתמש בסלנג, ונותן טיפים בישול קצרים'"
              />
            </div>
            {generatedPrompt && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">פרומפט שנוצר</label>
                <textarea 
                  className="w-full border p-2 rounded h-32 resize-none outline-none focus:border-[#00a884] bg-gray-50"
                  value={generatedPrompt}
                  readOnly
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => navigator.clipboard.writeText(generatedPrompt)} className="text-xs border px-2 py-1 rounded flex items-center gap-1">
                    <Paperclip className="w-3 h-3"/> העתק
                  </button>
                  <button onClick={() => {
                    setPromptGeneratorInput('');
                    setGeneratedPrompt('');
                  }} className="text-xs border px-2 py-1 rounded">ניקוי</button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowPromptGeneratorModal(false)} className="border px-3 py-2 rounded">בטל</button>
              <button onClick={generateSystemPrompt} disabled={enhancingPrompt} className={`ml-auto bg-[#00a884] text-white px-4 py-2 rounded flex items-center gap-2 ${enhancingPrompt ? 'opacity-70' : 'hover:bg-[#008f6f]'}`}>
                <Sparkles className="w-4 h-4"/>{enhancingPrompt ? 'יוצר...' : 'צור פרומפט'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEditPersonaModal && personaToEdit && (
        <Modal title={`עריכת דמות: ${personaToEdit.name}`} onClose={() => setShowEditPersonaModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">שם</label>
              <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={personaToEdit.name} onChange={e => setPersonaToEdit({ ...personaToEdit, name: e.target.value })} />
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600 font-medium">בחר/י או הזן תמונה</label>
              <div className="grid grid-cols-8 gap-2 max-h-[160px] overflow-y-auto p-2 bg-gray-50 rounded-lg border">
                {generateAvatarOptions(personaToEdit.name || 'User', 24).map((url, i) => (
                  <button key={i} type="button" onClick={() => setPersonaToEdit({ ...personaToEdit, avatar: url })} 
                          className={`rounded-full border-2 overflow-hidden w-12 h-12 transition-all duration-200 ${personaToEdit.avatar === url ? 'border-[#00a884] ring-2 ring-[#00a884]/20' : 'border-transparent hover:border-gray-300'}`}>
                    <img src={url} alt="avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => setPersonaToEdit(prev => ({ ...prev, avatar: '' }))} className="text-xs text-gray-600 underline hover:text-red-500">נקה בחירה</button>
                <button type="button" onClick={() => setPersonaToEdit(prev => ({ ...prev, avatar: randomAvatar(prev.name || 'User') }))} className="flex items-center gap-1 text-xs text-[#00a884] hover:text-[#008f6f]"><RefreshCcw className="w-3 h-3"/>אקראי</button>
                <button type="button" onClick={() => {
                  // Generate more diverse avatars
                  const newAvatars = generateAvatarOptions(personaToEdit.name || 'User', 24);
                  // This will refresh the grid by forcing a re-render
                  setPersonaToEdit(prev => ({ ...prev, avatar: prev.avatar }));
                }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><RefreshCcw className="w-3 h-3"/>רענן אפשרויות</button>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">או הזן כתובת תמונה (URL)</label>
                <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={personaToEdit.avatar} onChange={e => setPersonaToEdit({...personaToEdit, avatar: e.target.value})} dir="ltr" placeholder="https://example.com/image.jpg" />
              </div>
              {personaToEdit.avatar && (
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                  <div className="text-sm text-gray-600">תצוגה מקדימה:</div>
                  <img src={personaToEdit.avatar} alt="Preview" className="w-10 h-10 rounded-full object-cover border" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">System Prompt</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={personaToEdit.systemPrompt} onChange={e => setPersonaToEdit({...personaToEdit, systemPrompt: e.target.value})} />
              <div className="flex gap-2 mt-2">
                <button onClick={enhancePersonaPrompt} disabled={enhancingPrompt} className="text-xs border px-2 py-1 rounded flex items-center gap-1">
                  <Sparkles className="w-3 h-3"/>{enhancingPrompt ? 'משפר...' : 'שפר עם AI'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">מודל לדמות זו</label>
              <select value={personaToEdit.modelId || 'inherit'} onChange={e => setPersonaToEdit({ ...personaToEdit, modelId: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-[#00a884] bg-white">
                <option value="inherit">ברירת מחדל (לפי הגדרות)</option>
                {availableModels.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                <option value="custom">אחר (הזנה ידנית)...</option>
              </select>
              {(personaToEdit.modelId === 'custom') && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Model ID</label>
                  <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={personaToEdit.customModel || ''} onChange={e => setPersonaToEdit({ ...personaToEdit, customModel: e.target.value })} dir="ltr" placeholder="e.g., anthropic/claude-3-opus" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">זיכרון הדמות</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={personaToEdit.memory || ''} onChange={e => setPersonaToEdit({ ...personaToEdit, memory: e.target.value })} placeholder="נקודות זיכרון" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPersonaToEdit(prev => ({ ...prev, memory: '' }))} className="text-xs border px-2 py-1 rounded">נקה זיכרון</button>
                <button onClick={() => {
                  // Find chat history for this persona
                  const personaChats = chats.filter(c => c.type === 'direct' && c.participants.includes(personaToEdit.id));
                  if (personaChats.length > 0) {
                    // Combine all chats into one for viewing
                    const combinedChat = {
                      name: personaToEdit.name,
                      messages: personaChats.flatMap(c => c.messages)
                    };
                    setChatHistoryToView(combinedChat);
                    setShowChatHistoryModal(true);
                  } else {
                    alert('אין היסטוריית שיחות עם דמות זו.');
                  }
                }} className="text-xs border px-2 py-1 rounded">צפה בהיסטוריה</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEditPersonaModal(false)} className="border px-3 py-2 rounded">בטל</button>
              <button onClick={() => {  
                  setShowEditPersonaModal(false);  
                  setCharacters(prev => prev.map(c => c.id === personaToEdit.id ? personaToEdit : c));  
                  setChats(prev => prev.map(ch => {  
                    if (ch.type === 'direct' && ch.participants.includes(personaToEdit.id)) {  
                      return { ...ch, name: personaToEdit.name, avatar: personaToEdit.avatar };  
                    }  
                    return ch;  
                  }));  
                }} className="ml-auto bg-[#00a884] text-white px-4 py-2 rounded">שמור שינויים</button>
            </div>
          </div>
        </Modal>
      )}
      
      {showNewChatModal && (
        <NewChatModal
          characters={characters}
          startDirectChat={startDirectChat}
          onClose={() => setShowNewChatModal(false)}
        />
      )}
      
      {showNewGroupModal && (
        <NewGroupModal
          characters={characters}
          selectedForGroup={selectedForGroup}
          setSelectedForGroup={setSelectedForGroup}
          groupName={groupName}
          setGroupName={setGroupName}
          createGroupChat={createGroupChat}
          onClose={() => setShowNewGroupModal(false)}
        />
      )}
      
      {showParticipantsModal && activeChat && activeChat.type === 'group' && (
        <Modal title="משתתפי קבוצה" onClose={() => setShowParticipantsModal(false)}>
          <div className="space-y-4">
            <div className="max-h-[260px] overflow-y-auto border rounded">
              {characters.map(char => {
                const checked = participantsDraft.includes(char.id);
                return (
                  <label key={char.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <img src={char.avatar} className="w-7 h-7 rounded-full" alt="" />
                      <span>{char.name}</span>
                    </div>
                    <input type="checkbox" checked={checked} onChange={() => setParticipantsDraft(prev => checked ? prev.filter(id => id !== char.id) : [...prev, char.id])} />
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowParticipantsModal(false)} className="border px-3 py-2 rounded">בטל</button>
              <button onClick={() => {
                if (!participantsDraft.length) { alert('בחר/י לפחות דמות אחת.'); return; }
                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, participants: participantsDraft } : c));
                setShowParticipantsModal(false);
              }} className="ml-auto bg-[#00a884] text-white px-4 py-2 rounded">שמור</button>
            </div>
          </div>
        </Modal>
      )}
      
      {showGroupManageModal && activeChat && activeChat.type === 'group' && (
        <Modal title="ניהול קבוצה" onClose={() => setShowGroupManageModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">שם הקבוצה</label>
              <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={groupEdit.name} onChange={e => setGroupEdit(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">נושא הקבוצה (אופציונלי)</label>
              <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={groupEdit.topic} onChange={e => setGroupEdit(prev => ({ ...prev, topic: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">System Prompt של הקבוצה (אופציונלי)</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={groupEdit.systemPrompt} onChange={e => setGroupEdit(prev => ({ ...prev, systemPrompt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">משתתפים</label>
              <div className="max-h-[220px] overflow-y-auto border rounded">
                {characters.map(char => {
                  const checked = groupEdit.participants.includes(char.id);
                  return (
                    <label key={char.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <img src={char.avatar} className="w-7 h-7 rounded-full" alt="" />
                        <span>{char.name}</span>
                      </div>
                      <input type="checkbox" checked={checked} onChange={() => setGroupEdit(prev => ({ ...prev, participants: checked ? prev.participants.filter(id => id !== char.id) : [...prev.participants, char.id] }))} />
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowGroupManageModal(false)} className="border px-3 py-2 rounded">בטל</button>
              <button onClick={saveGroupEdits} className="ml-auto bg-[#00a884] text-white px-4 py-2 rounded">שמור</button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Mobile quick actions (hidden during chat to avoid covering input) */}
      {view !== 'chat' && (
        <MobileActionsBar 
          onHome={() => setView('list')} 
          onNewChat={() => setShowNewChatModal(true)} 
          onNewGroup={() => setShowNewGroupModal(true)} 
          onNewPersona={() => setShowNewCharModal(true)} 
          onSettings={() => setShowSettingsModal(true)}
        />
      )}
    </div>
  );
}

// --- Modal Components ---
function SettingsModal({ 
  apiKey, setApiKey, 
  availableModels, selectedModelId, setSelectedModelId, 
  customModelInput, setCustomModelInput, 
  enableMemory, setEnableMemory, 
  includeDateTimeMeta, setIncludeDateTimeMeta, 
  includeGroupMeta, setIncludeGroupMeta, 
  setCharacters, setChats, 
  onClose 
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">הגדרות מערכת</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">OpenRouter API Key</label>
              <input type="password" className="w-full border border-gray-300 rounded p-2 ltr bg-gray-50 outline-none focus:border-[#00a884]" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-v1-..." dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">בחירת מודל AI</label>
              <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} className="w-full border border-gray-300 rounded p-2 bg-white outline-none focus:border-[#00a884]">
                {availableModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                <option value="custom">אחר (הזנה ידנית)...</option>
              </select>
            </div>
            {selectedModelId === 'custom' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-medium text-gray-600 mb-1">Model ID</label>
                <input type="text" className="w-full border border-gray-300 rounded p-2 ltr bg-gray-50 outline-none" value={customModelInput} onChange={(e) => setCustomModelInput(e.target.value)} placeholder="e.g., anthropic/claude-3-opus" dir="ltr" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input id="dtmeta" type="checkbox" checked={includeDateTimeMeta} onChange={e => setIncludeDateTimeMeta(e.target.checked)} />
              <label htmlFor="dtmeta" className="text-sm">הכלל תאריך ושעה במטא-נתונים</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="groupmeta" type="checkbox" checked={includeGroupMeta} onChange={e => setIncludeGroupMeta(e.target.checked)} />
              <label htmlFor="groupmeta" className="text-sm">הכלל פרטי קבוצה והקשר</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="memtoggle" type="checkbox" checked={enableMemory} onChange={e => setEnableMemory(e.target.checked)} />
              <label htmlFor="memtoggle" className="text-sm">הפעל זיכרון וסיכום שיחה</label>
            </div>
            <button onClick={() => {
              if (confirm('לאפס את הזיכרון לכל הדמויות ואת סיכומי השיחות?')) {
                setCharacters(prev => prev.map(c => ({ ...c, memory: '' })));
                setChats(prev => prev.map(c => ({ ...c, summary: '' })));
              }
            }} className="w-full border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50">אפס זיכרון</button>
            <button onClick={onClose} className="w-full bg-[#00a884] text-white py-2 rounded hover:bg-[#008f6f] mt-4">שמור וסגור</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewCharacterModal({ newCharData, setNewCharData, availableModels, createCharacter, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">יצירת דמות חדשה</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-600 mb-1">שם</label><input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.name} onChange={e => setNewCharData({...newCharData, name: e.target.value})} /></div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">בחר/י או הזן תמונה</label>
              <div className="grid grid-cols-6 gap-2 max-h-[120px] overflow-y-auto p-1 bg-gray-50 rounded border">
                {generateAvatarOptions(newCharData.name || 'User', 12).map((url, i) => (
                  <button key={i} type="button" onClick={() => setNewCharData({ ...newCharData, avatar: url })} className={`rounded-full border ${newCharData.avatar === url ? 'border-[#00a884]' : 'border-transparent'} overflow-hidden w-12 h-12`}>
                    <img src={url} alt="avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setNewCharData(prev => ({ ...prev, avatar: '' }))} className="text-xs text-gray-600 underline">נקה בחירה</button>
                <button type="button" onClick={() => setNewCharData(prev => ({ ...prev, avatar: randomAvatar(prev.name || 'User') }))} className="flex items-center gap-1 text-xs text-[#00a884]"><RefreshCcw className="w-3 h-3"/>אקראי</button>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">או הזן כתובת תמונה (URL)</label>
                <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.avatar} onChange={e => setNewCharData({...newCharData, avatar: e.target.value})} dir="ltr" />
              </div>
            </div>
            <div><label className="block text-sm text-gray-600 mb-1">System Prompt</label><textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={newCharData.systemPrompt} onChange={e => setNewCharData({...newCharData, systemPrompt: e.target.value})} /></div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">מודל לדמות זו</label>
              <select value={newCharData.modelId} onChange={e => setNewCharData({ ...newCharData, modelId: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-[#00a884] bg-white">
                <option value="inherit">ברירת מחדל (לפי הגדרות)</option>
                {availableModels.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                <option value="custom">אחר (הזנה ידנית)...</option>
              </select>
              {newCharData.modelId === 'custom' && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Model ID</label>
                  <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.customModel} onChange={e => setNewCharData({ ...newCharData, customModel: e.target.value })} dir="ltr" placeholder="e.g., anthropic/claude-3-opus" />
                </div>
              )}
            </div>
            <button onClick={createCharacter} className="w-full bg-[#00a884] text-white py-2 rounded hover:bg-[#008f6f]" disabled={!newCharData.name}>צור דמות</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPersonaModal({ 
  personaToEdit, setPersonaToEdit, availableModels, 
  enhancingPrompt, enhancePersonaPrompt, 
  setCharacters, setChats, characters, 
  onClose 
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">עריכת דמות: {personaToEdit.name}</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-600 mb-1">שם</label><input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={personaToEdit.name} onChange={e => setPersonaToEdit({ ...personaToEdit, name: e.target.value })} /></div>
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">בחר/י או הזן תמונה</label>
              <div className="grid grid-cols-6 gap-2 max-h-[120px] overflow-y-auto p-1 bg-gray-50 rounded border">
                {generateAvatarOptions(personaToEdit.name || 'User', 12).map((url, i) => (
                  <button key={i} type="button" onClick={() => setPersonaToEdit({ ...personaToEdit, avatar: url })} className={`rounded-full border ${personaToEdit.avatar === url ? 'border-[#00a884]' : 'border-transparent'} overflow-hidden w-12 h-12`}>
                    <img src={url} alt="avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPersonaToEdit(prev => ({ ...prev, avatar: '' }))} className="text-xs text-gray-600 underline">נקה בחירה</button>
                <button type="button" onClick={() => setPersonaToEdit(prev => ({ ...prev, avatar: randomAvatar(prev.name || 'User') }))} className="flex items-center gap-1 text-xs text-[#00a884]"><RefreshCcw className="w-3 h-3"/>אקראי</button>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">או הזן כתובת תמונה (URL)</label>
                <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={personaToEdit.avatar} onChange={e => setPersonaToEdit({ ...personaToEdit, avatar: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">System Prompt</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={personaToEdit.systemPrompt} onChange={e => setPersonaToEdit({ ...personaToEdit, systemPrompt: e.target.value })} />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={enhancePersonaPrompt} disabled={enhancingPrompt} className={`flex items-center gap-2 px-3 py-1.5 rounded text-white ${enhancingPrompt ? 'bg-gray-400' : 'bg-[#00a884] hover:bg-[#008f6f]'} `}>
                  <Sparkles className="w-4 h-4" />
                  {enhancingPrompt ? 'משפר...' : 'שפר פרומפט בעזרת המודל הנבחר'}
                </button>
                <span className="text-xs text-gray-500">משתמש במודל הדמות שנבחר</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">מודל לדמות זו</label>
              <select value={personaToEdit.modelId || 'inherit'} onChange={e => setPersonaToEdit({ ...personaToEdit, modelId: e.target.value })} className="w-full border p-2 rounded outline-none focus:border-[#00a884] bg-white">
                <option value="inherit">ברירת מחדל (לפי הגדרות)</option>
                {availableModels.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                <option value="custom">אחר (הזנה ידנית)...</option>
              </select>
              {(personaToEdit.modelId === 'custom') && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Model ID</label>
                  <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={personaToEdit.customModel || ''} onChange={e => setPersonaToEdit({ ...personaToEdit, customModel: e.target.value })} dir="ltr" placeholder="e.g., anthropic/claude-3-opus" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">זיכרון הדמות</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={personaToEdit.memory || ''} onChange={e => setPersonaToEdit({ ...personaToEdit, memory: e.target.value })} placeholder="נקודות זיכרון" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPersonaToEdit(prev => ({ ...prev, memory: '' }))} className="text-xs border px-2 py-1 rounded">נקה זיכרון</button>
                <button onClick={() => { 
                  setShowEditPersonaModal(false); 
                  setCharacters(prev => prev.map(c => c.id === personaToEdit.id ? personaToEdit : c)); 
                  setChats(prev => prev.map(ch => {
                    if (ch.type === 'direct' && ch.participants.includes(personaToEdit.id)) {
                      return { ...ch, name: personaToEdit.name, avatar: personaToEdit.avatar };
                    }
                    return ch;
                  }));
                }} className="ml-auto bg-[#00a884] text-white px-3 py-1 rounded">שמור</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewChatModal({ characters, startDirectChat, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">שיחה חדשה</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          {characters.length === 0 ? <p className="text-gray-500 text-center">אין אנשי קשר.</p> : 
          <div className="space-y-2 max-h-[300px] overflow-y-auto">{characters.map(char => (
               <div key={char.id} onClick={() => startDirectChat(char)} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"><img src={char.avatar} alt="" className="w-10 h-10 rounded-full bg-gray-200" /><div className="font-medium">{char.name}</div></div>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}

function NewGroupModal({ characters, selectedForGroup, setSelectedForGroup, groupName, setGroupName, createGroupChat, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">קבוצה חדשה</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <input className="w-full border-b-2 border-[#00a884] p-2 outline-none bg-gray-50" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="נושא הקבוצה..." />
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
              {characters.map(char => {
                const isSelected = selectedForGroup.includes(char.id);
                return (
                  <div key={char.id} onClick={() => isSelected ? setSelectedForGroup(prev => prev.filter(id => id !== char.id)) : setSelectedForGroup(prev => [...prev, char.id])} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer">
                    <div className="flex items-center gap-3"><img src={char.avatar} alt="" className="w-8 h-8 rounded-full" /><span>{char.name}</span></div>
                    {isSelected && <Check className="w-4 h-4 text-[#00a884]" />}
                  </div>
                );
              })}
            </div>
            <button onClick={createGroupChat} disabled={!groupName || selectedForGroup.length === 0} className="w-full bg-[#00a884] text-white py-2 rounded disabled:bg-gray-300">צור קבוצה</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantsModal({ characters, participantsDraft, setParticipantsDraft, activeChatId, setChats, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">משתתפי קבוצה</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <div className="max-h-[260px] overflow-y-auto border rounded">
              {characters.map(char => {
                const checked = participantsDraft.includes(char.id);
                return (
                  <label key={char.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <img src={char.avatar} className="w-7 h-7 rounded-full" alt="" />
                      <span>{char.name}</span>
                    </div>
                    <input type="checkbox" checked={checked} onChange={() => setParticipantsDraft(prev => checked ? prev.filter(id => id !== char.id) : [...prev, char.id])} />
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="border px-3 py-2 rounded">בטל</button>
              <button onClick={() => {
                if (!participantsDraft.length) { alert('בחר/י לפחות דמות אחת.'); return; }
                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, participants: participantsDraft } : c));
                onClose();
              }} className="ml-auto bg-[#00a884] text-white px-4 py-2 rounded">שמור</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupManageModal({ groupEdit, setGroupEdit, characters, saveGroupEdits, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">ניהול קבוצה</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">שם הקבוצה</label>
              <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={groupEdit.name} onChange={e => setGroupEdit(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">נושא הקבוצה (אופציונלי)</label>
              <input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={groupEdit.topic} onChange={e => setGroupEdit(prev => ({ ...prev, topic: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">System Prompt של הקבוצה (אופציונלי)</label>
              <textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={groupEdit.systemPrompt} onChange={e => setGroupEdit(prev => ({ ...prev, systemPrompt: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">משתתפים</label>
              <div className="max-h-[220px] overflow-y-auto border rounded">
                {characters.map(char => {
                  const checked = groupEdit.participants.includes(char.id);
                  return (
                    <label key={char.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <img src={char.avatar} className="w-7 h-7 rounded-full" alt="" />
                        <span>{char.name}</span>
                      </div>
                      <input type="checkbox" checked={checked} onChange={() => setGroupEdit(prev => ({ ...prev, participants: checked ? prev.participants.filter(id => id !== char.id) : [...prev.participants, char.id] }))} />
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="border px-3 py-2 rounded">בטל</button>
              <button onClick={saveGroupEdits} className="ml-auto bg-[#00a884] text-white px-4 py-2 rounded">שמור</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Modal component ---
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#008069] text-white px-4 py-3 flex justify-between items-center shadow-md">
          <h3 className="font-medium text-lg">{title}</h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  );
}

// Wrap the App component with ErrorBoundary for production
export function WrappedApp() {
  return (
    <ErrorBoundary componentName="אפליקציית WhatsApp AI">
      <App />
    </ErrorBoundary>
  );
}

// --- Mobile actions bar ---
function MobileActionsBar({ onHome, onNewChat, onNewGroup, onNewPersona, onSettings }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[900] px-3 pb-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
      <div className="mx-auto max-w-[680px] bg-white rounded-full shadow-lg border border-gray-200 flex justify-around items-center py-2">
        <button onClick={onHome} className="p-2 text-[#54656f]" title="שיחות"><Home className="w-6 h-6"/></button>
        <button onClick={onNewChat} className="p-2 text-[#54656f]" title="שיחה חדשה"><MessageSquare className="w-6 h-6"/></button>
        <button onClick={onNewGroup} className="p-2 text-[#54656f]" title="קבוצה חדשה"><Users className="w-6 h-6"/></button>
        <button onClick={onNewPersona} className="p-2 text-[#54656f]" title="דמות חדשה"><Bot className="w-6 h-6"/></button>
        <button onClick={onSettings} className="p-2 text-[#54656f]" title="הגדרות"><Settings className="w-6 h-6"/></button>
      </div>
    </div>
  );
}

// --- Avatar helpers ---
function generateAvatarOptions(seedBase = 'User', count = 24) {
  const styles = [
    'avataaars', 'adventurer', 'bottts', 'identicon', 'croodles-neutral', 'big-ears', 
    'notionists', 'pixel-art', 'shapes', 'glass', 'thumbs', 'lorelei',
    'micah', 'miniavs', 'open-peeps', 'personas', 'big-smile', 'fun-emoji'
  ];
  const options = [];
  for (let i = 0; i < count; i++) {
    const style = styles[i % styles.length];
    const seed = encodeURIComponent(`${seedBase}-${i}-${Date.now() % 10000}`);
    options.push(`https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`);
  }
  return options;
}

function randomAvatar(seedBase = 'User') {
  const styles = ['avataaars', 'adventurer', 'bottts', 'identicon', 'croodles-neutral', 'big-ears', 'notionists', 'pixel-art', 'shapes', 'glass', 'thumbs', 'lorelei'];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const seed = encodeURIComponent(`${seedBase}-${Math.random().toString(36).slice(2)}`);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    log.error('ErrorBoundary caught an error:', error, errorInfo);
    handleError(error, {
      type: ErrorTypes.UNKNOWN_ERROR,
      context: {
        component: this.props.componentName,
        errorInfo: errorInfo
      }
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-red-50 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full border-2 border-red-200">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-red-600">אירעה שגיאה</h2>
              <button onClick={this.resetError} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-4 text-gray-700">
              <p>משהו השתבש ב-{this.props.componentName || 'אפליקציה'}.</p>
              <p className="text-sm mt-2 text-gray-600">
                {this.state.error.message || 'לא ניתן לטעון את הרכיב.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
              >
                רענן דף
              </button>
              <button 
                onClick={this.resetError}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 transition-colors"
              >
                נסה שוב
              </button>
            </div>
            <div className="mt-4 text-xs text-gray-500 text-center">
              <p>אם הבעיה נמשכת, נא לבדוק את קונסולת הדפדפן לפרטים נוספים.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}