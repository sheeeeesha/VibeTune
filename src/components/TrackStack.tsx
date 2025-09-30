'use client';

import React, { useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Trash2, MoreHorizontal, Plus, Minus, Scissors, Music, Sliders } from 'lucide-react';
import { AudioClip } from '@/types';
import WaveformDisplay from './WaveformDisplay';

interface TrackStackProps {
  clips: AudioClip[];
  onPlayPause: (clipId: string) => void; // plays/pauses entire part of this clip
  onLoop: (clipId: string) => void;
  onEditTab: (clipId: string, tab: 'chops' | 'notes' | 'fx') => void;
  onDelete: (clipId: string) => void;
  onSeek: (clipId: string, time: number) => void;
  onVolumeToggle: (clipId: string) => void;
  onVolumeAdjust?: (clipId: string, delta: number) => void;
  onBpmAdjust?: (clipId: string, delta: number) => void;
}

const TrackStack: React.FC<TrackStackProps> = ({
  clips,
  onPlayPause,
  onLoop,
  onEditTab,
  onDelete,
  onSeek,
  onVolumeToggle,
  onVolumeAdjust,
  onBpmAdjust,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && clips.length > 0) {
      const newestClip = clips[clips.length - 1];
      const clipElement = document.getElementById(`track-${newestClip.id}`);
      if (clipElement) {
        clipElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [clips]);

  if (clips.length === 0) {
    return null;
  }

  const partLabel = (part: string) => part.replace('-', ' ');

  return (
    <div className="w-full px-4 py-4">
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            id={`track-${clip.id}`}
            className="flex-shrink-0 w-[520px] max-w-[90vw] rounded-xl bg-[#0f1012] border border-gray-800/80 hover:border-gray-700 transition-colors p-0 shadow-[0_8px_24px_rgba(0,0,0,0.25)] overflow-hidden"
            style={{ scrollSnapAlign: index === clips.length - 1 ? 'center' : 'start' }}
          >
            {/* Waveform card body */}
            <div className="p-5">
              {/* Top row: chip meta and more */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-white text-gray-900 text-xs font-semibold capitalize">
                    {partLabel(clip.songPart)}
                  </span>
                  <span className="text-gray-300 text-sm">
                    <span className="capitalize">{clip.element}</span> {" "} {clip.genre}
                  </span>
                </div>
                <TrackMenu
                  volumeLabel={`${Math.round((clip.volume ?? 1) * 100)}%`}
                  bpmLabel={`${clip.bpm ?? 120} bpm`}
                  onVolumeInc={() => onVolumeAdjust && onVolumeAdjust(clip.id, +0.1)}
                  onVolumeDec={() => onVolumeAdjust && onVolumeAdjust(clip.id, -0.1)}
                  onBpmInc={() => onBpmAdjust && onBpmAdjust(clip.id, +2)}
                  onBpmDec={() => onBpmAdjust && onBpmAdjust(clip.id, -2)}
                  onChop={() => onEditTab(clip.id, 'chops')}
                  onNotes={() => onEditTab(clip.id, 'notes')}
                  onFx={() => onEditTab(clip.id, 'fx')}
                  onDelete={() => onDelete(clip.id)}
                />
              </div>

              {/* Waveform */}
              <div className="mb-4 relative">
                <WaveformDisplay
                  waveform={clip.waveform}
                  isPlaying={clip.isPlaying}
                  currentTime={0}
                  duration={clip.duration}
                  onPlayPause={() => onPlayPause(clip.id)}
                  onSeek={(time) => onSeek(clip.id, time)}
                  onVolumeToggle={() => onVolumeToggle(clip.id)}
                  isMuted={false}
                  className="h-28"
                />
                {/* Volume indicator bar */}
                <div className="absolute left-4 right-4 -bottom-2">
                  <div className="h-1.5 bg-gray-700/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${Math.round((clip.volume ?? 1) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer control bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#111318] border-t border-gray-800">
              <button
                onClick={() => onPlayPause(clip.id)}
                className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center hover:bg-gray-200 transition-colors"
                aria-label="Play clip"
              >
                {clip.isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <div className="text-gray-300 text-sm flex-1 ml-3 truncate flex items-center gap-3">
                <span className="truncate"><span className="capitalize">{clip.element}</span> {clip.genre} • {clip.duration}s</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-xs">Vol {Math.round((clip.volume ?? 1) * 100)}%</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-xs">{clip.bpm ?? 120} bpm</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onLoop(clip.id)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                    clip.isLooping ? 'bg-orange-500 text-white' : 'bg-transparent border border-gray-600 text-white hover:border-gray-500'
                  }`}
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" />
                  Loop
                </button>
                <button
                  onClick={() => onEditTab(clip.id, 'chops')}
                  className="px-3 py-1.5 text-xs rounded-full bg-transparent border border-gray-600 text-white hover:border-gray-500"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Three-dot contextual menu for track actions
const TrackMenu: React.FC<{
  volumeLabel: string;
  bpmLabel: string;
  onVolumeInc: () => void;
  onVolumeDec: () => void;
  onBpmInc: () => void;
  onBpmDec: () => void;
  onChop: () => void;
  onNotes: () => void;
  onFx: () => void;
  onDelete: () => void;
}> = ({ volumeLabel, bpmLabel, onVolumeInc, onVolumeDec, onBpmInc, onBpmDec, onChop, onNotes, onFx, onDelete }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-full hover:bg-gray-800 text-gray-300"
        aria-label="More"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[#111318] border border-gray-800 rounded-xl shadow-2xl p-3 z-10">
          <div className="flex items-center justify-between py-2 text-sm text-gray-200">
            <span>volume · {volumeLabel}</span>
            <div className="flex items-center gap-3">
              <button onClick={onVolumeInc} className="w-6 h-6 rounded-full bg-gray-800 text-gray-200 flex items-center justify-center">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={onVolumeDec} className="w-6 h-6 rounded-full bg-gray-800 text-gray-200 flex items-center justify-center">
                <Minus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 text-sm text-gray-200 border-t border-gray-800">
            <span>{bpmLabel}</span>
            <div className="flex items-center gap-3">
              <button onClick={onBpmInc} className="w-6 h-6 rounded-full bg-gray-800 text-gray-200 flex items-center justify-center">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={onBpmDec} className="w-6 h-6 rounded-full bg-gray-800 text-gray-200 flex items-center justify-center">
                <Minus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <button onClick={onChop} className="w-full flex items-center gap-3 py-2 text-sm text-gray-200 hover:text-white">
            <Scissors className="w-4 h-4" />
            Chop
          </button>
          <button onClick={onNotes} className="w-full flex items-center gap-3 py-2 text-sm text-gray-200 hover:text-white">
            <Music className="w-4 h-4" />
            Notes
          </button>
          <button onClick={onFx} className="w-full flex items-center gap-3 py-2 text-sm text-gray-200 hover:text-white">
            <Sliders className="w-4 h-4" />
            FX
          </button>
          <button onClick={onDelete} className="w-full flex items-center gap-3 py-2 text-sm text-red-400 hover:text-red-300 border-t border-gray-800">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default TrackStack;
