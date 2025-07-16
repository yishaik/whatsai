import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';

interface StorageInfo {
  key: string;
  size: number;
  sizeStr: string;
}

const StorageManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  const calculateStorageSize = () => {
    const info: StorageInfo[] = [];
    let total = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        const size = new Blob([value]).size;
        total += size;
        info.push({
          key,
          size,
          sizeStr: formatBytes(size)
        });
      }
    }

    info.sort((a, b) => b.size - a.size);
    setStorageInfo(info);
    setTotalSize(total);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearItem = (key: string) => {
    if (confirm(`Are you sure you want to delete "${key}"? This action cannot be undone.`)) {
      localStorage.removeItem(key);
      calculateStorageSize();
    }
  };

  const clearAllExceptPersonas = () => {
    if (confirm('Clear all data except personas? This will delete all chat history.')) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== 'personas') {
          keys.push(key);
        }
      }
      keys.forEach(key => localStorage.removeItem(key));
      calculateStorageSize();
      alert('Chat history cleared. Reload the page to see changes.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      calculateStorageSize();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-panel-bg rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-item-hover-bg flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">Storage Manager</h2>
          <button onClick={onClose} className="text-icon-default hover:text-text-primary">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-6">
            <p className="text-text-secondary mb-2">
              Total localStorage usage: <span className="text-text-primary font-bold">{formatBytes(totalSize)}</span>
            </p>
            <p className="text-sm text-text-secondary">
              Browser limit is typically 5-10MB. If you're seeing quota errors, clear some data below.
            </p>
          </div>

          <div className="mb-4">
            <button
              onClick={clearAllExceptPersonas}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Clear All Chat History
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Storage Breakdown:</h3>
            {storageInfo.map(({ key, sizeStr }) => (
              <div key={key} className="flex justify-between items-center bg-item-active-bg p-3 rounded-lg">
                <div>
                  <span className="text-text-primary font-medium">{key}</span>
                  <span className="text-text-secondary ml-2">({sizeStr})</span>
                </div>
                <button
                  onClick={() => clearItem(key)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageManager; 