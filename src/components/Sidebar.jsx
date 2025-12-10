import React from 'react';
import { MessageSquare, MoreVertical, Search, Users, Bot, Settings, X, Sparkles } from 'lucide-react';

export default function Sidebar({ 
  characters, 
  chats, 
  activeChatId, 
  view, 
  typingStatus, 
  apiKey, 
  setView, 
  setActiveChatId, 
  setShowNewCharModal, 
  setShowNewChatModal, 
  setShowNewGroupModal, 
  setShowSettingsModal, 
  setShowPromptGeneratorModal, 
  setShowChatHistoryModal, 
  setChatHistoryToView, 
  deleteChat 
}) {
  
  return (
    <div className={`flex flex-col bg-white w-full md:w-[30%] lg:w-[30%] border-l border-gray-200 transition-all duration-300 ${view === 'chat' ? 'hidden md:flex' : 'flex'}`}>
      {/* Header */}
      <div className="bg-[#f0f2f5] px-4 py-3 flex justify-between items-center shrink-0 border-r border-gray-300">
        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden cursor-pointer" onClick={() => setShowSettingsModal(true)}>
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=UserMain" alt="Me" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-4 text-[#54656f]">
          <button onClick={() => setShowSettingsModal(true)} title="הגדרות"><Settings className={`w-6 h-6 ${!apiKey ? 'text-red-500 animate-pulse' : ''}`} /></button>
          <button onClick={() => setShowPromptGeneratorModal(true)} title="יצירת פרומפט עם AI"><Sparkles className="w-6 h-6" /></button>
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
                {chat.type === 'group' && chat.topic && (
                  <div className="text-[11px] text-[#8696a0] truncate">נושא: {chat.topic}</div>
                )}
                <div className="flex items-center gap-1 text-[#667781] text-sm truncate h-5">
                  {chat.type === 'group' && lastMsg && lastMsg.senderId !== 'user' && (
                     <span className="font-bold text-xs text-gray-800">{characters.find(c => c.id === lastMsg.senderId)?.name}: </span>
                  )}
                  <span className="truncate w-full flex items-center gap-1">
                    {typingStatus[chat.id] ? <span className="text-[#00a884] italic">מקליד/ה...</span> : (
                      <>
                         {lastMsg?.image && <span className="text-xs">[תמונה]</span>}
                         {lastMsg ? (lastMsg.text || (lastMsg.image ? 'תמונה' : '')) : ''}
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={(e) => {
                  e.stopPropagation();
                  setChatHistoryToView(chat);
                  setShowChatHistoryModal(true);
                }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 p-1" title="היסטוריית שיחה">
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}