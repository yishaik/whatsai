import React, { useState, useRef } from 'react';
import { Smile, Plus, Send, X } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled }) {
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
    <div className="bg-[#f0f2f5] px-4 py-2 flex flex-col z-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
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