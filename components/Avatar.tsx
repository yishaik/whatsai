
import React from 'react';

// For generating colors for text-based avatars (like for chat rooms)
const COLORS = ['#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', '#f4511e'];

const stringToColor = (str: string): string => {
  if (!str) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

interface AvatarProps {
  src?: string; // Image src (data URL or web URL)
  seed?: string; // Seed for text-based avatar if src is not provided
  size?: number;
  name?: string; // For alt text or initial
}

const Avatar: React.FC<AvatarProps> = ({ src, seed, size = 40, name }) => {
  // If an image source is provided, use it.
  if (src) {
    return (
      <img
        src={src}
        alt={name || seed || 'avatar'}
        className="rounded-full object-cover"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: '#2A3942', // item-active-bg as placeholder
        }}
      />
    );
  }

  // Otherwise, fall back to the initial-based avatar.
  const displaySeed = seed || name || '?';
  const color = stringToColor(displaySeed);
  const initial = displaySeed ? displaySeed.charAt(0).toUpperCase() : '?';

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        fontSize: `${size / 2}px`
      }}
      aria-label={name || seed}
    >
      {initial}
    </div>
  );
};

export default Avatar;
