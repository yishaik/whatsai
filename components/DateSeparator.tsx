import React from 'react';
import { dayLabel } from '../services/time';

// Centered day pill shown between messages from different days.
const DateSeparator: React.FC<{ ts: number }> = ({ ts }) => (
  <div className="flex justify-center my-3">
    <span className="text-xs text-text-secondary bg-panel-bg/90 rounded-full px-3 py-1 shadow-sm">
      {dayLabel(ts)}
    </span>
  </div>
);

export default DateSeparator;
