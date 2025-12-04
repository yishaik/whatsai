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
  Camera
} from 'lucide-react';

// --- Constants & Config ---
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const APP_NAME = "WhatsApp AI Generator";

// Updated Models List (Focus on Multimodal support)
const AVAILABLE_MODELS = [
  { id: "google/gemini-2.0-flash-lite-preview-02-05:free", name: "Gemini 2.0 Flash Lite (Free, Vision Supported)" },
  { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Exp (Free, Vision Supported)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free, Text Only)" },
  { id: "qwen/qwen-2.5-vl-72b-instruct:free", name: "Qwen 2.5 VL 72B (Free, Vision Supported)" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (Paid, Vision Supported)" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Paid, Vision Supported)" },
  { id: "custom", name: "אחר (הזנה ידנית)..." }
];

const INITIAL_CHARACTERS = [
  {
    id: 'c1',
    name: 'סחבק',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    systemPrompt: 'אתה חבר טוב, מצחיק, ישראלי, משתמש בסלנג (אח שלי, נשמה, כפרה), ואוהב לעזור. אתה כותב קצר וקולע.',
    color: 'text-blue-500'
  },
  {
    id: 'c2',
    name: 'מבקר אמנות',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Picasso',
    systemPrompt: 'אתה מבקר אמנות מתנשא אך מבריק. אתה מנתח תמונות לעומק, מתייחס לקומפוזיציה וצבעים, ומשתמש במילים גבוהות.',
    color: 'text-purple-500'
  }
];

export default function App() {
  // --- State ---
  
  // API & Config
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('or_api_key') || '');
  const [selectedModelId, setSelectedModelId] = useState(() => localStorage.getItem('or_model_id') || AVAILABLE_MODELS[0].id);
  const [customModelInput, setCustomModelInput] = useState(() => localStorage.getItem('or_custom_model') || '');

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

  // Inputs State
  const [newCharData, setNewCharData] = useState({ name: '', avatar: '', systemPrompt: '' });
  const [selectedForGroup, setSelectedForGroup] = useState([]);
  const [groupName, setGroupName] = useState('');
  
  const messagesEndRef = useRef(null);

  // --- Effects ---
  useEffect(() => { localStorage.setItem('app_characters', JSON.stringify(characters)); }, [characters]);
  useEffect(() => { localStorage.setItem('app_chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem('or_api_key', apiKey); }, [apiKey]);
  useEffect(() => { 
    localStorage.setItem('or_model_id', selectedModelId);
    if (selectedModelId === 'custom') localStorage.setItem('or_custom_model', customModelInput);
  }, [selectedModelId, customModelInput]);

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
    const chat = chats.find(c => c.id === activeChatId);
    if (chat) {
      setTypingStatus(prev => ({ ...prev, [activeChatId]: true }));

      const responders = chat.participants;
      
      // Parallel processing for group chats
      responders.forEach(async (charId) => {
        const character = characters.find(c => c.id === charId);
        if (character) {
          try {
            const aiText = await fetchOpenRouterResponse(character, chat.messages, text, imageBase64);
            
            const aiMessage = {
              id: Date.now().toString() + Math.random(),
              senderId: character.id,
              text: aiText,
              timestamp: Date.now()
            };

            setChats(prevChats => prevChats.map(c => {
              if (c.id === activeChatId) {
                return { ...c, messages: [...c.messages, aiMessage] };
              }
              return c;
            }));
          } catch (error) {
            console.error("AI Error:", error);
          }
        }
      });

      setTimeout(() => setTypingStatus(prev => ({ ...prev, [activeChatId]: false })), 4000);
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

    const messagesPayload = [
      {
        role: "system",
        content: `${character.systemPrompt}\n\nהקשר: שיחת וואטסאפ. שמך: "${character.name}". השב בקצרה ובעברית. אם נשלחת תמונה, התייחס אליה.`
      },
      ...recentHistory,
      {
        role: "user",
        content: currentMessageContent
      }
    ];

    const modelToUse = getActiveModelString();

    try {
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

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices[0].message.content;

    } catch (err) {
      return `(שגיאה: ${err.message || "תקלה בתקשורת"})`;
    }
  };

  // --- Helper Functions ---
  const createCharacter = () => {
    if (!newCharData.name || !newCharData.systemPrompt) return;
    const newChar = {
      id: `c${Date.now()}`,
      name: newCharData.name,
      avatar: newCharData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newCharData.name + Date.now()}`,
      systemPrompt: newCharData.systemPrompt,
      color: 'text-teal-600'
    };
    setCharacters([...characters, newChar]);
    setNewCharData({ name: '', avatar: '', systemPrompt: '' });
    setShowNewCharModal(false);
  };

  const startDirectChat = (character) => {
    const existing = chats.find(c => c.type === 'direct' && c.participants.includes(character.id));
    if (existing) {
      setActiveChatId(existing.id);
    } else {
      const newChat = { id: `chat${Date.now()}`, type: 'direct', participants: [character.id], name: character.name, avatar: character.avatar, messages: [], unread: 0 };
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
      unread: 0
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setSelectedForGroup([]);
    setGroupName('');
    setShowNewGroupModal(false);
    setView('chat');
  };

  const deleteChat = (e, chatId) => {
    e.stopPropagation();
    setChats(chats.filter(c => c.id !== chatId));
    if (activeChatId === chatId) setActiveChatId(null);
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-[#dfdfdf] text-gray-900 font-sans overflow-hidden" dir="rtl">
      <div className="fixed top-0 left-0 right-0 h-32 bg-[#00a884] z-0"></div>

      <div className="relative z-10 flex w-full max-w-[1600px] h-full mx-auto shadow-lg overflow-hidden xl:my-5 xl:h-[calc(100vh-40px)] xl:rounded-xl bg-white">
        
        {/* SIDEBAR */}
        <div className={`flex flex-col bg-white w-full md:w-[30%] lg:w-[30%] border-l border-gray-200 transition-all duration-300 ${view === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="bg-[#f0f2f5] px-4 py-3 flex justify-between items-center shrink-0 border-r border-gray-300">
            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden cursor-pointer" onClick={() => setShowSettingsModal(true)}>
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=UserMain" alt="Me" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-4 text-[#54656f]">
              <button onClick={() => setShowSettingsModal(true)} title="הגדרות"><Settings className={`w-6 h-6 ${!apiKey ? 'text-red-500 animate-pulse' : ''}`} /></button>
              <button onClick={() => setShowNewGroupModal(true)} title="קבוצה חדשה"><Users className="w-6 h-6" /></button>
              <button onClick={() => setShowNewChatModal(true)} title="שיחה חדשה"><MessageSquare className="w-6 h-6" /></button>
              <button onClick={() => setShowNewCharModal(true)} title="צור דמות AI"><Bot className="w-6 h-6" /></button>
            </div>
          </div>
          
          {/* Search */}
          <div className="px-3 py-2 bg-white border-b border-gray-100">
            <div className="bg-[#f0f2f5] rounded-lg px-4 py-1.5 flex items-center gap-4">
              <Search className="w-5 h-5 text-[#54656f]" />
              <input type="text" placeholder="חיפוש" className="bg-transparent border-none outline-none w-full text-sm placeholder:text-[#54656f]" />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {chats.length === 0 && <div className="p-4 text-center text-gray-400 text-sm mt-10">אין שיחות פעילות.</div>}
            {chats.map(chat => {
              const lastMsg = chat.messages[chat.messages.length - 1];
              return (
                <div 
                  key={chat.id}
                  onClick={() => { setActiveChatId(chat.id); setView('chat'); }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-gray-100 group ${activeChatId === chat.id ? 'bg-[#f0f2f5]' : ''}`}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                    <img src={chat.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[17px] text-[#111b21] font-normal truncate">{chat.name}</span>
                      {lastMsg && <span className="text-xs text-[#667781]">{new Date(lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[#667781] text-sm truncate h-5">
                      {chat.type === 'group' && lastMsg && lastMsg.senderId !== 'user' && (
                         <span className="font-bold text-xs text-gray-800">{characters.find(c => c.id === lastMsg.senderId)?.name}: </span>
                      )}
                      <span className="truncate w-full flex items-center gap-1">
                        {typingStatus[chat.id] ? <span className="text-[#00a884] italic">מקליד/ה...</span> : (
                          <>
                             {lastMsg?.image && <ImageIcon className="w-3 h-3 inline mr-1" />}
                             {lastMsg ? (lastMsg.text || (lastMsg.image ? 'תמונה' : '')) : ''}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHAT AREA */}
        <div className={`bg-[#efeae2] flex-col w-full md:w-[70%] lg:w-[70%] relative ${view === 'list' ? 'hidden md:flex' : 'flex'}`}>
          <div className="absolute inset-0 opacity-40 pointer-events-none z-0" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

          {activeChatId ? (
            <>
              {/* Top Bar */}
              <div className="bg-[#f0f2f5] px-4 py-2.5 flex justify-between items-center shrink-0 z-10 border-l border-gray-300">
                <div className="flex items-center gap-4">
                  <button className="md:hidden" onClick={() => setView('list')}><ArrowRight className="w-6 h-6 text-[#54656f]" /></button>
                  <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer"><img src={activeChat.avatar} alt="" className="w-full h-full object-cover" /></div>
                  <div className="cursor-pointer">
                    <div className="text-[#111b21] font-normal">{activeChat.name}</div>
                    <div className="text-xs text-[#667781]">
                       {typingStatus[activeChatId] ? <span className="text-[#00a884] font-medium animate-pulse">מקליד/ה...</span> : (activeChat.type === 'group' ? activeChat.participants.map(pid => characters.find(c => c.id === pid)?.name).join(', ') : 'מחובר/ת (AI)')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[#54656f]"><Search className="w-5 h-5 cursor-pointer" /><MoreVertical className="w-5 h-5 cursor-pointer" /></div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar flex flex-col">
                {activeChat.messages.map((msg) => {
                  const isUser = msg.senderId === 'user';
                  const senderChar = !isUser ? characters.find(c => c.id === msg.senderId) : null;
                  return (
                    <div key={msg.id} className={`flex flex-col mb-2 max-w-[85%] md:max-w-[65%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}>
                      <div className={`rounded-lg p-1.5 relative shadow-sm text-sm md:text-[15px] leading-relaxed ${isUser ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                        {!isUser && activeChat.type === 'group' && senderChar && <div className={`text-xs font-bold mb-1 px-1 ${senderChar.color || 'text-orange-500'}`}>{senderChar.name}</div>}
                        
                        {/* Image Render */}
                        {msg.image && (
                          <div className="mb-1 rounded-md overflow-hidden">
                            <img src={msg.image} alt="attachment" className="max-w-full max-h-[300px] object-cover" />
                          </div>
                        )}
                        
                        {msg.text && <div className="px-2 pb-1 pt-1 whitespace-pre-wrap" dir="auto">{msg.text}</div>}
                        
                        <div className="float-left px-2 pb-1 flex items-end gap-1 select-none">
                           <span className="text-[10px] text-[#667781]">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                           {isUser && <span className="text-[#53bdeb] text-[14px]">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <ChatInput onSendMessage={handleSendMessage} disabled={!apiKey} />
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#f0f2f5] border-b-[6px] border-[#25d366] z-10">
               <Bot className="w-32 h-32 text-[#d1d7db] mb-6" />
               <h1 className="text-3xl text-[#41525d] font-light mb-4">WhatsApp AI Generator</h1>
               <div className="text-[#667781] text-sm text-center max-w-md leading-6">
                 כעת כולל תמיכה בתמונות (Vision)!<br/>שלח תמונה לדמות והיא תגיב למה שהיא רואה.
               </div>
               {!apiKey && <button onClick={() => setShowSettingsModal(true)} className="mt-6 bg-[#00a884] text-white px-6 py-2 rounded-full hover:bg-[#008f6f] shadow-sm">הגדר מפתח API להתחלה</button>}
            </div>
          )}
        </div>
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
                    {AVAILABLE_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                  </select>
               </div>
               {selectedModelId === 'custom' && (
                 <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Model ID</label>
                    <input type="text" className="w-full border border-gray-300 rounded p-2 ltr bg-gray-50 outline-none" value={customModelInput} onChange={(e) => setCustomModelInput(e.target.value)} placeholder="e.g., anthropic/claude-3-opus" dir="ltr" />
                 </div>
               )}
               <button onClick={() => setShowSettingsModal(false)} className="w-full bg-[#00a884] text-white py-2 rounded hover:bg-[#008f6f] mt-4">שמור וסגור</button>
           </div>
        </Modal>
      )}
      
      {showNewCharModal && (
        <Modal title="יצירת דמות חדשה" onClose={() => setShowNewCharModal(false)}>
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-600 mb-1">שם</label><input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.name} onChange={e => setNewCharData({...newCharData, name: e.target.value})} /></div>
            <div><label className="block text-sm text-gray-600 mb-1">תמונה (URL)</label><input className="w-full border p-2 rounded outline-none focus:border-[#00a884]" value={newCharData.avatar} onChange={e => setNewCharData({...newCharData, avatar: e.target.value})} dir="ltr" /></div>
            <div><label className="block text-sm text-gray-600 mb-1">System Prompt</label><textarea className="w-full border p-2 rounded h-24 resize-none outline-none focus:border-[#00a884]" value={newCharData.systemPrompt} onChange={e => setNewCharData({...newCharData, systemPrompt: e.target.value})} /></div>
            <button onClick={createCharacter} className="w-full bg-[#00a884] text-white py-2 rounded hover:bg-[#008f6f]" disabled={!newCharData.name}>צור דמות</button>
          </div>
        </Modal>
      )}

      {showNewChatModal && (
        <Modal title="שיחה חדשה" onClose={() => setShowNewChatModal(false)}>
          {characters.length === 0 ? <p className="text-gray-500 text-center">אין אנשי קשר.</p> : 
          <div className="space-y-2 max-h-[300px] overflow-y-auto">{characters.map(char => (
               <div key={char.id} onClick={() => startDirectChat(char)} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer"><img src={char.avatar} alt="" className="w-10 h-10 rounded-full bg-gray-200" /><div className="font-medium">{char.name}</div></div>
          ))}</div>}
        </Modal>
      )}

      {showNewGroupModal && (
        <Modal title="קבוצה חדשה" onClose={() => setShowNewGroupModal(false)}>
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
        </Modal>
      )}
    </div>
  );
}

// --- Chat Input with Image Support ---

function ChatInput({ onSendMessage, disabled }) {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (text.trim() || selectedImage) {
      onSendMessage(text, selectedImage);
      setText('');
      setSelectedImage(null);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-[#f0f2f5] px-4 py-2 flex flex-col z-10">
      {/* Image Preview */}
      {selectedImage && (
        <div className="flex p-2 bg-[#e9edef] rounded-t-lg mx-2 mb-[-5px] relative self-start border border-b-0 border-gray-300 z-0">
           <img src={selectedImage} alt="Preview" className="h-20 rounded border border-gray-300" />
           <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -left-2 bg-gray-500 text-white rounded-full p-0.5 hover:bg-red-500"><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="flex items-center gap-2 w-full relative z-10">
        <div className="text-[#54656f] cursor-pointer hover:text-gray-800 transition-colors"><Smile className="w-6 h-6" /></div>
        
        {/* Attachment Button */}
        <div 
          className="text-[#54656f] cursor-pointer hover:text-gray-800 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="w-6 h-6" />
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileSelect}
        />

        <div className="flex-1 bg-white rounded-lg px-4 py-2 flex items-center shadow-sm">
          <input 
            className="w-full bg-transparent border-none outline-none text-[15px] text-[#111b21] placeholder:text-[#54656f]"
            placeholder={disabled ? "הגדר מפתח API..." : "הקלד/י הודעה"}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !disabled && handleSend()}
            dir="auto"
            disabled={disabled}
          />
        </div>
        <button 
          onClick={handleSend} 
          disabled={disabled || (!text.trim() && !selectedImage)}
          className="text-[#54656f] disabled:opacity-50 transition-all duration-200 transform active:scale-90"
        >
          {(text.trim() || selectedImage) ? <Send className="w-6 h-6 text-[#00a884]" /> : <span className="w-6 h-6 block" />} 
        </button>
      </div>
    </div>
  );
}

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
