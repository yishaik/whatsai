
import React from 'react';
import { ChatRoom, Message } from '../types';
import { PlusIcon, UsersIcon, CircleStackIcon } from './icons';
import Avatar from './Avatar';

interface ChatListProps {
  chatRooms: ChatRoom[];
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
  onNewChat: () => void;
  onManagePersonas: () => void;
  onManageStorage: () => void;
}

const truncate = (text: string, length: number) => {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

const ChatListItem: React.FC<{ chat: ChatRoom; isActive: boolean; onClick: () => void }> = ({ chat, isActive, onClick }) => {
  const lastMessage: Message | undefined = chat.messages[chat.messages.length - 1];

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-item-hover-bg ${isActive ? 'bg-item-active-bg' : 'hover:bg-item-hover-bg'}`}
    >
      <Avatar src={chat.avatar} seed={chat.topic} size={48} />
      <div className="flex-1 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="text-text-primary font-semibold truncate">{chat.topic}</p>
          {lastMessage && (
            <p className="text-xs text-text-secondary flex-shrink-0">
              {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <p className="text-sm text-text-secondary truncate">
          {lastMessage ? truncate(lastMessage.text, 30) : 'No messages yet'}
        </p>
      </div>
    </div>
  );
};

const ChatList: React.FC<ChatListProps> = ({ chatRooms, activeChatId, setActiveChatId, onNewChat, onManagePersonas, onManageStorage }) => {
  return (
    <div className="w-full md:w-1/3 lg:w-1/4 bg-panel-bg border-r border-item-hover-bg flex flex-col">
      <header className="p-3 bg-panel-header-bg flex justify-between items-center h-[60px]">
        <h1 className="text-lg font-semibold text-text-primary">AI Chats</h1>
        <div className="flex items-center gap-2">
          <button onClick={onNewChat} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg" title="New chat">
            <PlusIcon className="h-6 w-6" />
          </button>
          <button onClick={onManagePersonas} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg" title="Manage personas">
            <UsersIcon className="h-6 w-6" />
          </button>
          <button onClick={onManageStorage} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg" title="Storage manager">
            <CircleStackIcon className="h-6 w-6" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {chatRooms.length === 0 ? (
          <div className="p-6 text-center text-text-secondary">
            <p>No chats yet.</p>
            <button onClick={onNewChat} className="mt-4 text-accent-green font-semibold">
              Create your first chat
            </button>
          </div>
        ) : (
          chatRooms.map(chat => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onClick={() => setActiveChatId(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;
