'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface WaveformDisplayProps {
  waveform: number[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeToggle: () => void;
  isMuted: boolean;
  className?: string;
  hideOverlayPlayButton?: boolean;
  hideVolumeButton?: boolean;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveform,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onVolumeToggle,
  isMuted,
  className = '',
  hideOverlayPlayButton = false,
  hideVolumeButton = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;
      onSeek(newTime);
    }
  };

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`relative bg-gray-800 rounded-lg ${className}`}>
      <div
        ref={containerRef}
        className="relative h-32 cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        {/* Waveform bars */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-end justify-center h-24 gap-px">
            {waveform.map((amplitude, index) => {
              const height = Math.max(2, (amplitude * 24) + 2);
              return (
                <div
                  key={index}
                  className="bg-white rounded-sm"
                  style={{
                    width: '2px',
                    height: `${height}px`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
          style={{ left: `${playheadPosition}%` }}
        />

        {/* Play/Pause button overlay */}
        {!hideOverlayPlayButton && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause();
              }}
              className="pointer-events-auto bg-black/50 hover:bg-black/70 rounded-full p-3 transition-all duration-200"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </button>
          </div>
        )}

        {/* Volume control */}
        {!hideVolumeButton && (
          <button
            onClick={onVolumeToggle}
            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all duration-200"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-white" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default WaveformDisplay;
