import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Renders an OpenGraph preview card for a URL once the backend has fetched it.
// Shows nothing while pending / on error / for content-less pages.
const LinkPreviewCard: React.FC<{ url: string }> = ({ url }) => {
  const preview = useQuery(api.links.getLinkPreview, { url });

  if (!preview || preview.status !== 'done') return null;
  if (!preview.title && !preview.description && !preview.imageUrl) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-item-active-bg rounded-lg overflow-hidden hover:bg-item-hover-bg transition-colors"
    >
      {preview.imageUrl && (
        <img
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          className="w-full max-h-40 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="p-2">
        <p className="text-xs text-text-secondary truncate">{preview.siteName || hostOf(url)}</p>
        {preview.title && (
          <p className="text-sm font-semibold text-text-primary line-clamp-2">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{preview.description}</p>
        )}
      </div>
    </a>
  );
};

export default LinkPreviewCard;
