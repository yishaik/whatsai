import React from 'react';
import { Message, Persona, Source } from '../types';
import { USER_ID } from '../constants';
import Avatar from './Avatar';
import { LinkIcon } from './icons';

interface MessageBubbleProps {
  message: Message;
  persona: Persona | null;
  isOwnMessage: boolean;
  onSourceClick: (url: string) => void;
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

const SourceCard: React.FC<{ source: Source; onSourceClick: (url: string) => void }> = ({ source, onSourceClick }) => {
  return (
    <button
      onClick={() => onSourceClick(source.uri)}
      className="bg-item-active-bg p-2 rounded-lg text-left hover:bg-item-hover-bg transition-colors w-full flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start gap-2">
          <LinkIcon className="h-4 w-4 text-accent-blue flex-shrink-0 mt-1" />
          <p className="font-semibold text-text-primary text-sm leading-tight line-clamp-2">{source.title}</p>
        </div>
      </div>
      <p className="text-xs text-text-secondary mt-1 pl-6 truncate">{getDomain(source.uri)}</p>
    </button>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, persona, isOwnMessage, onSourceClick }) => {
  const alignment = isOwnMessage ? 'justify-end' : 'justify-start';
  const bubbleColor = isOwnMessage ? 'bg-message-out' : 'bg-message-in';
  const authorName = isOwnMessage ? 'You' : persona?.name || 'Unknown';
  const authorColor = isOwnMessage ? 'text-accent-green' : 'text-accent-blue';
  
  return (
    <div className={`flex items-end gap-2 w-full ${alignment}`}>
      {!isOwnMessage && (
        <div className="mb-2">
            <Avatar src={persona?.avatar} name={persona?.name} size={32} />
        </div>
      )}
      <div className={`flex flex-col max-w-sm md:max-w-md lg:max-w-2xl`}>
        {!isOwnMessage && (
            <span className={`text-sm font-bold mb-1 ml-3 ${authorColor}`}>
                {authorName}
            </span>
        )}
        <div className={`px-4 py-2 rounded-lg text-text-primary ${bubbleColor}`}>
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 grid grid-cols-1 gap-2">
            {message.sources.map((source, index) => (
              <SourceCard key={index} source={source} onSourceClick={onSourceClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;