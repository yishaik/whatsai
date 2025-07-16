import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatRoom, Persona, Message } from '../types';
import { USER_ID } from '../constants';
import MessageBubble from './MessageBubble';
import { SendIcon, ChatBubbleLeftRightIcon, PencilIcon } from './icons';
import Avatar from './Avatar';
import SourceViewerModal from './SourceViewerModal';
import { generatePersonaResponse } from '../services/geminiService';

interface ChatViewProps {
  chatRoom: ChatRoom | null;
  personasMap: { [id: string]: Persona };
  onSendMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  onEditChat?: () => void;
}

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

const ChatView: React.FC<ChatViewProps> = ({ chatRoom, personasMap, onSendMessage, onEditChat }) => {
  const [inputText, setInputText] = useState('');
  const [typingPersonas, setTypingPersonas] = useState<Set<string>>(new Set());
  const [viewingSourceUrl, setViewingSourceUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatRoom?.messages, typingPersonas]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && chatRoom) {
      onSendMessage(chatRoom.id, {
        authorId: USER_ID,
        text: inputText.trim(),
        sources: [],
      });
      setInputText('');
    }
  };

  const triggerAIResponses = useCallback(async (lastMessage: Message) => {
    if (!chatRoom || lastMessage.authorId !== USER_ID) return;

    const personasInChat = chatRoom.personaIds.map(id => personasMap[id]);
    
    for (const persona of personasInChat) {
        setTypingPersonas(prev => new Set(prev).add(persona.id));
        try {
            // A small delay to make it seem more natural
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            const response = await generatePersonaResponse(persona, chatRoom.topic, [...chatRoom.messages], personasInChat, personasMap);
            onSendMessage(chatRoom.id, {
                authorId: persona.id,
                text: response.text,
                sources: response.sources,
            });
        } catch (error) {
            console.error("Failed to get AI response for", persona.name, error);
        } finally {
            setTypingPersonas(prev => {
                const newSet = new Set(prev);
                newSet.delete(persona.id);
                return newSet;
            });
        }
    }
  }, [chatRoom, personasMap, onSendMessage]);
  
  useEffect(() => {
    if (chatRoom && chatRoom.messages.length > 0) {
        const lastMessage = chatRoom.messages[chatRoom.messages.length - 1];
        if (lastMessage.authorId === USER_ID) {
            triggerAIResponses(lastMessage);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoom?.messages]);


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
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-text-primary">{chatRoom.topic}</h2>
          <p className="text-sm text-text-secondary">
            {['You', ...chatRoom.personaIds.map(id => personasMap[id]?.name || 'Unknown')].join(', ')}
          </p>
        </div>
        {onEditChat && (
          <button 
            onClick={onEditChat}
            className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg"
            title="Edit chat"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
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
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-3 bg-panel-header-bg">
        <form onSubmit={handleSendMessage} className="flex items-center gap-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-item-active-bg rounded-lg p-3 text-text-primary outline-none focus:ring-2 focus:ring-accent-green"
          />
          <button type="submit" disabled={!inputText.trim()} className="bg-accent-green rounded-full p-3 text-white disabled:bg-gray-500 disabled:cursor-not-allowed transition">
            <SendIcon className="h-6 w-6" />
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