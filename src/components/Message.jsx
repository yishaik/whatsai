import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

export default function Message({ 
  msg, 
  isUser, 
  senderChar, 
  activeChat, 
  characters 
}) {
  return (
    <div className={`flex flex-col mb-2 max-w-[85%] md:max-w-[65%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}>
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
}