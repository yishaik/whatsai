import React from 'react';
import { XMarkIcon } from './icons';

interface SourceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
}

const SourceViewerModal: React.FC<SourceViewerModalProps> = ({ isOpen, onClose, url }) => {
  if (!isOpen || !url) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-panel-bg rounded-lg shadow-xl w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-item-hover-bg flex justify-between items-center flex-shrink-0">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-accent-blue truncate"
          >
            {url}
          </a>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-grow bg-white">
          <iframe
            src={url}
            title="Source Viewer"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
};

export default SourceViewerModal;