
import React from 'react';
import { ChatRoom, Message } from '../types';
import { PlusIcon, UsersIcon, TrashIcon, Bars3Icon } from './icons';
import Avatar from './Avatar';

interface ChatListProps {
  chatRooms: ChatRoom[];
  activeChatId: string | null;
  setActiveChatId: (id: string) => void;
  onNewChat: () => void;
  onManagePersonas: () => void;
  onDeleteChat: (id: string) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const truncate = (text: string, length: number) => {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

const ChatListItem: React.FC<{
  chat: ChatRoom;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ chat, isActive, onClick, onDelete }) => {
  const lastMessage: Message | undefined = chat.messages[chat.messages.length - 1];
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
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
      {showDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-icon-default hover:text-red-500 p-1 rounded flex-shrink-0 transition-colors"
          title="Delete chat"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

const ChatList: React.FC<ChatListProps> = ({
  chatRooms,
  activeChatId,
  setActiveChatId,
  onNewChat,
  onManagePersonas,
  onDeleteChat,
  isMobileOpen,
  onMobileClose,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <div
        className={`
          fixed md:relative z-40 md:z-auto
          h-full
          w-[85%] max-w-sm md:w-full md:max-w-none md:w-1/3 lg:w-1/4
          bg-panel-bg border-r border-item-hover-bg flex flex-col
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <header className="p-3 bg-panel-header-bg flex justify-between items-center h-[60px]">
          <h1 className="text-lg font-semibold text-text-primary">AI Chats</h1>
          <div className="flex items-center gap-2">
            <button onClick={onNewChat} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg" title="New chat">
              <PlusIcon className="h-6 w-6" />
            </button>
            <button onClick={onManagePersonas} className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg" title="Manage personas">
              <UsersIcon className="h-6 w-6" />
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
                onClick={() => { setActiveChatId(chat.id); onMobileClose(); }}
                onDelete={() => {
                  if (confirm(`Delete "${chat.topic}"?`)) {
                    onDeleteChat(chat.id);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default ChatList;
