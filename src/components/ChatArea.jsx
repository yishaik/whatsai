import React from 'react';
import { Search, Users, MoreVertical, ArrowRight, Image as ImageIcon } from 'lucide-react';
import ChatInput from './ChatInput';

export default function ChatArea({ 
  activeChat, 
  characters, 
  view, 
  typingStatus, 
  activeChatId, 
  messagesEndRef, 
  apiKey, 
  setView, 
  setShowGroupManageModal, 
  setGroupEdit, 
  setShowParticipantsModal, 
  setParticipantsDraft, 
  setShowEditPersonaModal, 
  setPersonaToEdit, 
  handleSendMessage 
}) {
  
  return (
    <div className={`bg-[#efeae2] flex-col w-full md:w-[70%] lg:w-[70%] relative ${view === 'list' ? 'hidden md:flex' : 'flex'}`}>
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

      {activeChat ? (
        <>
          {/* Top Bar */}
          <div className="bg-[#f0f2f5] px-4 py-2.5 flex justify-between items-center shrink-0 z-10 border-l border-gray-300 sticky top-0">
            <div className="flex items-center gap-4">
              <button className="md:hidden" onClick={() => setView('list')}><ArrowRight className="w-6 h-6 text-[#54656f]" /></button>
              <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer"><img src={activeChat.avatar} alt="" className="w-full h-full object-cover" /></div>
              <div className="cursor-pointer">
                <div className="text-[#111b21] font-normal">{activeChat.name}</div>
                <div className="text-xs text-[#667781] flex items-center gap-2">
                   {typingStatus[activeChatId] ? <span className="text-[#00a884] font-medium animate-pulse">מקליד/ה...</span> : (activeChat.type === 'group' ? activeChat.participants.map(pid => characters.find(c => c.id === pid)?.name).join(', ') : 'מחובר/ת (AI)')}
                   {activeChat.type === 'group' && (
                     <button className="text-[11px] text-[#00a884] underline decoration-dotted" onClick={() => {
                       const g = activeChat;
                       setGroupEdit({ name: g.name || '', topic: g.topic || '', systemPrompt: g.systemPrompt || '', participants: Array.isArray(g.participants) ? [...g.participants] : [] });
                       setShowGroupManageModal(true);
                     }}>ערוך קבוצה</button>
                   )}
                </div>
                {activeChat.type === 'group' && activeChat.topic && (
                  <div className="text-[11px] text-[#8696a0]">נושא: {activeChat.topic}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-[#54656f]">
              <Search className="w-5 h-5 cursor-pointer" />
              {activeChat.type === 'group' && (
                <Users 
                  className="w-5 h-5 cursor-pointer" 
                  title="משתתפים"
                  onClick={() => { setParticipantsDraft(activeChat.participants || []); setShowParticipantsModal(true); }}
                />
              )}
              <MoreVertical 
                className="w-5 h-5 cursor-pointer" 
                onClick={() => {
                  if (activeChat.type === 'direct') {
                    const pid = activeChat.participants[0];
                    const persona = characters.find(c => c.id === pid);
                    if (persona) { setPersonaToEdit(persona); setShowEditPersonaModal(true); }
                  } else {
                    const g = activeChat;
                    setGroupEdit({ name: g.name || '', topic: g.topic || '', systemPrompt: g.systemPrompt || '', participants: Array.isArray(g.participants) ? [...g.participants] : [] });
                    setShowGroupManageModal(true);
                  }
                }}
                title="עריכה"
              />
            </div>
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
           <svg className="w-32 h-32 text-[#d1d7db] mb-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
           <h1 className="text-3xl text-[#41525d] font-light mb-4">WhatsApp AI Generator</h1>
           <div className="text-[#667781] text-sm text-center max-w-md leading-6">
             כעת כולל תמיכה בתמונות (Vision)!<br/>שלח תמונה לדמות והיא תגיב למה שהיא רואה.
           </div>
           {!apiKey && <button onClick={() => setShowSettingsModal(true)} className="mt-6 bg-[#00a884] text-white px-6 py-2 rounded-full hover:bg-[#008f6f] shadow-sm">הגדר מפתח API להתחלה</button>}
        </div>
      )}
    </div>
  );
}