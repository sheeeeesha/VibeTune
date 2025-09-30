'use client';

import React from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface RecordingButtonProps {
  isRecording: boolean;
  isGenerating: boolean;
  onToggleRecording: () => void;
}

const RecordingButton: React.FC<RecordingButtonProps> = ({
  isRecording,
  isGenerating,
  onToggleRecording,
}) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onToggleRecording}
        className={`
          w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
          ${isRecording || isGenerating
            ? 'gradient-animation shadow-lg shadow-orange-500/30'
            : 'bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-500/20'
          }
          ${isRecording || isGenerating ? 'scale-105' : 'hover:scale-105'}
        `}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isGenerating ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>
      
      <div className="text-center">
        {isRecording && (
          <p className="text-white text-sm">recording...</p>
        )}
        {isGenerating && (
          <p className="text-white text-sm">generating...</p>
        )}
      </div>
    </div>
  );
};

export default RecordingButton;
