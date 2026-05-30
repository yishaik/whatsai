import React from 'react';
import { Message, Persona, Source, Attachment } from '../types';
import Avatar from './Avatar';
import { LinkIcon, PaperClipIcon } from './icons';

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

const AttachmentView: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const isImage = attachment.mimeType.startsWith('image/') && !!attachment.url;
  if (isImage) {
    return (
      <a href={attachment.url!} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url!}
          alt={attachment.name}
          loading="lazy"
          className="rounded-lg max-h-64 w-full object-cover bg-item-active-bg"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-item-active-bg rounded-lg p-2 text-sm text-text-primary hover:bg-item-hover-bg"
    >
      <PaperClipIcon className="h-4 w-4 flex-shrink-0 text-icon-default" />
      <span className="truncate">{attachment.name}</span>
    </a>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, persona, isOwnMessage, onSourceClick }) => {
  const alignment = isOwnMessage ? 'justify-end' : 'justify-start';
  const bubbleColor = isOwnMessage ? 'bg-message-out' : 'bg-message-in';
  const authorName = isOwnMessage ? 'You' : persona?.name || 'Unknown';
  const authorColor = isOwnMessage ? 'text-accent-green' : 'text-accent-blue';
  const attachments = message.attachments ?? [];

  return (
    <div className={`flex items-end gap-2 w-full ${alignment}`}>
      {!isOwnMessage && (
        <div className="mb-2">
            <Avatar src={persona?.avatar} name={persona?.name} size={32} />
        </div>
      )}
      <div className={`flex flex-col max-w-[85%] sm:max-w-sm md:max-w-md lg:max-w-2xl`}>
        {!isOwnMessage && (
            <span className={`text-sm font-bold mb-1 ml-3 ${authorColor}`}>
                {authorName}
            </span>
        )}
        {attachments.length > 0 && (
          <div className={`grid gap-1 mb-1 ${attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {attachments.map((att, i) => (
              <AttachmentView key={i} attachment={att} />
            ))}
          </div>
        )}
        {message.text && (
          <div className={`px-4 py-2 rounded-lg text-text-primary ${bubbleColor}`}>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
        )}
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