'use client';

import React from 'react';
import { Play, Pause } from 'lucide-react';
import { SongPart } from '@/types';

interface SongPartSelectorProps {
  songParts: SongPart[];
  onPartSelect: (partId: string) => void;
  playingPartId?: string | null;
  onMainPlayPause?: () => void;
  isMainPlaying?: boolean;
}

const Bars: React.FC<{ active: boolean }>=({ active })=>{
  return (
    <span className="inline-flex items-end gap-[2px] mr-2">
      {[4,8,5].map((h, i)=> (
        <span
          key={i}
          className={`w-[2px] rounded-sm bg-white ${active ? 'animate-pulse' : 'opacity-40'}`}
          style={{ height: active ? `${h + (i*2)}px` : `${h}px` }}
        />
      ))}
    </span>
  );
};

const SongPartSelector: React.FC<SongPartSelectorProps> = ({
  songParts,
  onPartSelect,
  playingPartId,
  onMainPlayPause,
  isMainPlaying,
}) => {
  return (
    <div className="w-full px-4 py-3">
      <div className="flex gap-6 overflow-x-auto scrollbar-hide items-center">
        {/* Leading play/pause button to match new UI */}
        <button
          onClick={onMainPlayPause}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center hover:bg-gray-200 transition-colors"
          aria-label="Play current part"
        >
          {isMainPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
        {songParts.map((part) => (
          <button
            key={part.id}
            onClick={() => onPartSelect(part.id)}
            className={`
              flex-shrink-0 px-4 py-2 rounded-full text-lg font-medium transition-all duration-200 flex items-center
              ${part.isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'bg-transparent text-white hover:bg-gray-800'
              }
            `}
          >
            {playingPartId === part.id && <Bars active={true} />}
            <span className="capitalize">{part.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SongPartSelector;
