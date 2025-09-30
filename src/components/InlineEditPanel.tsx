'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Music, Sliders, Scissors, Play, Pause, Save } from 'lucide-react';
import { AudioClip } from '@/types';

interface InlineEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedClip: AudioClip) => void;
  selectedClip: AudioClip | null;
  editMode: 'chops' | 'notes' | 'fx' | null;
}

// Musical theory constants
const SCALE_DEGREE_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_SCALE_PATTERN = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_PATTERN = [0, 2, 3, 5, 7, 8, 10];

// Visual Slider Component
interface VisualSliderProps {
  value: number;
  onChange: (value: number) => void;
  pattern: 'raindrops' | 'diagonal' | 'circles' | 'zigzag';
  color: string;
}

const VisualSlider: React.FC<VisualSliderProps> = ({ value, onChange, pattern, color }) => {
  const renderPattern = () => {
    const fillWidth = `${value * 100}%`;
    
    switch (pattern) {
      case 'raindrops':
        return (
          <div className="relative h-8 bg-black rounded-full overflow-hidden">
            <div 
              className="absolute inset-0 rounded-full"
              style={{ 
                width: fillWidth,
                background: `repeating-linear-gradient(
                  45deg,
                  ${color} 0px,
                  ${color} 2px,
                  transparent 2px,
                  transparent 4px
                )`
              }}
            />
          </div>
        );
      case 'diagonal':
        return (
          <div className="relative h-8 bg-black rounded-full overflow-hidden">
            <div 
              className="absolute inset-0 rounded-full"
              style={{ 
                width: fillWidth,
                background: `repeating-linear-gradient(
                  -45deg,
                  ${color} 0px,
                  ${color} 3px,
                  transparent 3px,
                  transparent 6px
                )`
              }}
            />
          </div>
        );
      case 'circles':
        return (
          <div className="relative h-8 bg-black rounded-full overflow-hidden">
            <div 
              className="absolute inset-0 rounded-full"
              style={{ 
                width: fillWidth,
                background: `radial-gradient(circle at 50% 50%, ${color} 1px, transparent 1px)`,
                backgroundSize: '8px 8px'
              }}
            />
          </div>
        );
      case 'zigzag':
        return (
          <div className="relative h-8 bg-black rounded-full overflow-hidden">
            <div 
              className="absolute inset-0 rounded-full"
              style={{ 
                width: fillWidth,
                background: `repeating-linear-gradient(
                  90deg,
                  ${color} 0px,
                  ${color} 2px,
                  transparent 2px,
                  transparent 4px
                )`
              }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {renderPattern()}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

const InlineEditPanel: React.FC<InlineEditPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedClip,
  editMode,
}) => {
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [sourceNode, setSourceNode] = useState<MediaElementAudioSourceNode | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  // Effects state for FX mode
  const [effects, setEffects] = useState({
    wet: { enabled: true, amount: 0.3 },
    cutoff: { enabled: true, frequency: 2000 },
    resonance: { enabled: true, amount: 0.2 },
    decay: { enabled: true, amount: 0.4 },
    reverb: { enabled: false, amount: 0.5 },
    delay: { enabled: false, time: 0.3, feedback: 0.2 },
    distortion: { enabled: false, amount: 0.2 },
    filter: { enabled: false, frequency: 1000, type: 'lowpass' as const },
    compressor: { enabled: false, threshold: -24, ratio: 4 },
  });

  // Chops state for Chops mode
  const [chops, setChops] = useState<{ 
    id: string; 
    startTime: number; 
    endTime: number; 
    duration: number;
    name: string;
    audioUrl?: string;
  }[]>([]);
  const [selectedChopIndex, setSelectedChopIndex] = useState<number | null>(null);
  const [chopSelection, setChopSelection] = useState({ start: 20, end: 60 });
  const [playheadPosition, setPlayheadPosition] = useState(30);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'selection' | 'start' | 'end' | null>(null);

  // Notes state for Notes mode
  const [detectedKey, setDetectedKey] = useState<string>('Cm');
  const [keyType, setKeyType] = useState<'major' | 'minor'>('minor');
  const [keyConfidence, setKeyConfidence] = useState<number>(85);
  const [transpose, setTranspose] = useState(0);
  const [selectedScaleDegrees, setSelectedScaleDegrees] = useState<number[]>([0, 2, 3, 5, 7, 8, 10]); // Natural minor scale
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Calculate current scale and transposed key
  const currentScale = useMemo(() => {
    const rootNote = detectedKey.replace(/[^A-G#b]/, '');
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    if (rootIndex === -1) return NOTE_NAMES;
    
    const pattern = keyType === 'major' ? MAJOR_SCALE_PATTERN : MINOR_SCALE_PATTERN;
    return pattern.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
  }, [detectedKey, keyType]);

  const transposedKey = useMemo(() => {
    const rootNote = detectedKey.replace(/[^A-G#b]/, '');
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    if (rootIndex === -1) return detectedKey;
    
    const newIndex = (rootIndex + transpose + 12) % 12;
    return NOTE_NAMES[newIndex] + (keyType === 'major' ? '' : 'm');
  }, [detectedKey, transpose, keyType]);

  const commonChords = useMemo(() => {
    const rootNote = detectedKey.replace(/[^A-G#b]/, '');
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    if (rootIndex === -1) return [];
    
    const pattern = keyType === 'major' ? MAJOR_SCALE_PATTERN : MINOR_SCALE_PATTERN;
    const scale = pattern.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
    
    return [
      scale[0], // I chord
      scale[1] + 'm', // ii chord
      scale[2] + 'm', // iii chord
      scale[3], // IV chord
      scale[4], // V chord
      scale[5] + 'm', // vi chord
      scale[6] + 'dim' // vii chord
    ];
  }, [detectedKey, keyType]);

  // Define handleMouseMove before useEffect
  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !dragType) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

    if (dragType === 'selection') {
      const delta = percentage - chopSelection.start;
      setChopSelection(prev => ({
        start: Math.max(0, prev.start + delta),
        end: Math.min(100, prev.end + delta)
      }));
    } else if (dragType === 'start') {
      setChopSelection(prev => ({
        ...prev,
        start: Math.max(0, Math.min(prev.end - 5, percentage))
      }));
    } else if (dragType === 'end') {
      setChopSelection(prev => ({
        ...prev,
        end: Math.min(100, Math.max(prev.start + 5, percentage))
      }));
    }
  }, [isDragging, dragType, chopSelection.start]);

  useEffect(() => {
    if (selectedClip) {
      setClip(selectedClip);
      initializeAudio(selectedClip.audioUrl);
      
      // Load existing chops if any
      if (selectedClip.chops) {
        setChops(selectedClip.chops.map(chop => ({
          ...chop,
          duration: chop.endTime - chop.startTime
        })));
      }
    }
  }, [selectedClip]);

  // Add mouse and touch event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e: Event) => handleMouseMove(e as unknown as React.MouseEvent | React.TouchEvent);
      const handleUp = () => handleMouseUp();
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleUp);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleUp);
      };
    }
  }, [isDragging, dragType, chopSelection, handleMouseMove]);

  const initializeAudio = (audioUrl: string) => {
    if (typeof window === 'undefined') return;

    try {
      const audio = new Audio(audioUrl);
      audio.crossOrigin = 'anonymous';
      setAudioElement(audio);

      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass();
      setAudioContext(context);

      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      
      source.connect(gain);
      gain.connect(context.destination);
      
      setSourceNode(source);
      setGainNode(gain);

      audio.addEventListener('ended', () => setIsPlaying(false));
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  };

  const handlePlayPause = () => {
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const handleEffectChange = (effectName: string, property: string, value: number | boolean) => {
    setEffects(prev => ({
      ...prev,
      [effectName]: {
        ...prev[effectName as keyof typeof prev],
        [property]: value
      }
    }));
  };

  // Chopping functions
  const handleSelectionStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragType('selection');
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, type: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
  };

  const adjustTempo = (delta: number) => {
    setTempo(prev => Math.max(60, Math.min(200, prev + delta)));
  };

  const adjustVolume = (delta: number) => {
    setVolume(prev => Math.max(0, Math.min(2, prev + delta)));
    if (audioElement) {
      audioElement.volume = Math.max(0, Math.min(2, volume + delta));
    }
  };

  const createChop = () => {
    if (chopSelection.start >= chopSelection.end) return;

    const totalDuration = clip?.duration || 0;
    const startTime = (chopSelection.start / 100) * totalDuration;
    const endTime = (chopSelection.end / 100) * totalDuration;
    const duration = endTime - startTime;

    const newChop = {
      id: `chop-${Date.now()}`,
      startTime,
      endTime,
      duration,
      name: `Chop ${chops.length + 1}`,
      audioUrl: clip?.audioUrl
    };

    setChops(prev => [...prev, newChop]);
    
    // Auto-select the new chop
    setSelectedChopIndex(chops.length);
  };

  const handleChopPadClick = (index: number) => {
    if (chops[index]) {
      setSelectedChopIndex(selectedChopIndex === index ? null : index);
    } else {
      // If empty pad, create a chop at current selection
      createChop();
    }
  };

  const playSelectedChop = () => {
    if (!selectedChop || !audioElement) return;
    
    audioElement.currentTime = selectedChop.startTime;
    audioElement.play();
    
    // Update playhead position
    const interval = setInterval(() => {
      if (audioElement.currentTime >= selectedChop.endTime) {
        audioElement.pause();
        clearInterval(interval);
      }
      setPlayheadPosition((audioElement.currentTime / audioElement.duration) * 100);
    }, 100);
  };

  const deleteSelectedChop = () => {
    if (selectedChopIndex === null) return;
    
    setChops(prev => prev.filter((_, index) => index !== selectedChopIndex));
    setSelectedChopIndex(null);
  };

  const selectedChop = selectedChopIndex !== null ? chops[selectedChopIndex] : null;

  // Notes functions
  const toggleScaleDegree = (degree: number) => {
    setSelectedScaleDegrees(prev => 
      prev.includes(degree) 
        ? prev.filter(d => d !== degree)
        : [...prev, degree].sort()
    );
  };

  const detectKey = async () => {
    setIsAnalyzing(true);
    
    // Simulate key detection analysis
    setTimeout(() => {
      const keys = ['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'];
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const isMinor = randomKey.includes('m');
      
      setDetectedKey(randomKey);
      setKeyType(isMinor ? 'minor' : 'major');
      setKeyConfidence(Math.floor(Math.random() * 30) + 70); // 70-100%
      setIsAnalyzing(false);
    }, 2000);
  };

  const playScale = () => {
    if (!audioElement) return;
    
    // Play the current scale notes
    const scaleNotes = currentScale;
    let currentNote = 0;
    
    const playNextNote = () => {
      if (currentNote < scaleNotes.length) {
        // In a real implementation, you would play the actual note
        console.log(`Playing note: ${scaleNotes[currentNote]}`);
        currentNote++;
        setTimeout(playNextNote, 500);
      }
    };
    
    playNextNote();
  };

  // FX Preset functions
  const applyPreset = (preset: 'subtle' | 'aggressive' | 'ambient' | 'reset') => {
    switch (preset) {
      case 'subtle':
        setEffects({
          ...effects,
          wet: { enabled: true, amount: 0.15 },
          cutoff: { enabled: true, frequency: 3000 },
          resonance: { enabled: true, amount: 0.1 },
          decay: { enabled: true, amount: 0.2 },
        });
        break;
      case 'aggressive':
        setEffects({
          ...effects,
          wet: { enabled: true, amount: 0.8 },
          cutoff: { enabled: true, frequency: 800 },
          resonance: { enabled: true, amount: 0.7 },
          decay: { enabled: true, amount: 0.9 },
        });
        break;
      case 'ambient':
        setEffects({
          ...effects,
          wet: { enabled: true, amount: 0.6 },
          cutoff: { enabled: true, frequency: 1500 },
          resonance: { enabled: true, amount: 0.4 },
          decay: { enabled: true, amount: 0.8 },
        });
        break;
      case 'reset':
        setEffects({
          ...effects,
          wet: { enabled: true, amount: 0.3 },
          cutoff: { enabled: true, frequency: 2000 },
          resonance: { enabled: true, amount: 0.2 },
          decay: { enabled: true, amount: 0.4 },
        });
        break;
    }
  };

  const handleSave = () => {
    if (!clip) return;

    const updatedClip: AudioClip = {
      ...clip,
      effects: editMode === 'fx' ? {
        wet: effects.wet,
        cutoff: effects.cutoff,
        resonance: effects.resonance,
        decay: effects.decay,
        reverb: effects.reverb,
        delay: effects.delay,
        distortion: effects.distortion,
        filter: effects.filter,
        compression: effects.compressor,
      } : clip.effects,
      chops: editMode === 'chops' ? chops : clip.chops,
    };

    onSave(updatedClip);
    onClose();
  };

  if (!isOpen || !clip || !editMode) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl mx-auto max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-white text-lg font-medium">
            Edit {editMode.toUpperCase()} - {clip.songPart} {clip.element}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Waveform Display */}
          <div className="mb-6">
            <div className="relative h-32 bg-gray-800 rounded-lg overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-end justify-center h-24 gap-px">
                  {Array.from({ length: 120 }).map((_, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-sm"
                      style={{
                        width: '2px',
                        height: `${Math.random() * 20 + 4}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: '30%' }} />
              
              {/* Play/Pause button */}
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="bg-black/50 rounded-full p-2">
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-1" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Edit Mode Specific Content */}
          {editMode === 'fx' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-medium">Audio Effects</h3>
              
              {/* Waveform with Selection Region */}
              <div className="relative">
                <div className="relative h-24 bg-gray-800 rounded-lg overflow-hidden">
                  {/* Waveform visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end justify-center h-16 gap-px">
                      {Array.from({ length: 100 }).map((_, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-sm"
                          style={{
                            width: '2px',
                            height: `${Math.random() * 20 + 4}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Playhead */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500" 
                    style={{ left: `${playheadPosition}%` }} 
                  />
                  
                  {/* Selection line */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white" 
                    style={{ left: '10%' }} 
                  />
                </div>
                
                {/* Crop Sound Label */}
                <div className="text-right text-sm text-yellow-400 mt-2">crop sound</div>
              </div>

              {/* Tempo and Volume Controls */}
              <div className="flex items-center justify-between">
                {/* Volume Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => adjustVolume(-0.1)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <button 
                    onClick={() => adjustVolume(0.1)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>

                {/* Tempo Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => adjustTempo(-5)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="px-3 py-1 bg-gray-700 rounded text-white text-sm font-medium">
                    {tempo} bpm
                  </div>
                  <button 
                    onClick={() => adjustTempo(5)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Professional FX Controls */}
              <div className="space-y-6">
                {/* Wet Control */}
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full opacity-80"></div>
                      </div>
                      <span className="text-yellow-400 font-medium text-lg">Wet</span>
                    </div>
                    <span className="text-white font-bold text-lg">{Math.round(effects.wet.amount * 100)}%</span>
                  </div>
                  <VisualSlider
                    value={effects.wet.amount}
                    onChange={(value) => handleEffectChange('wet', 'amount', value)}
                    pattern="raindrops"
                    color="white"
                  />
                </div>

                {/* Cut Off Control */}
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-white transform rotate-45"></div>
                      </div>
                      <span className="text-yellow-400 font-medium text-lg">Cut Off</span>
                    </div>
                    <span className="text-white font-bold text-lg">{effects.cutoff.frequency}Hz</span>
                  </div>
                  <VisualSlider
                    value={effects.cutoff.frequency / 8000}
                    onChange={(value) => handleEffectChange('cutoff', 'frequency', value * 8000)}
                    pattern="diagonal"
                    color="white"
                  />
                </div>

                {/* Resonance Control */}
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full border-2 border-white"></div>
                      </div>
                      <span className="text-yellow-400 font-medium text-lg">Resona</span>
                    </div>
                    <span className="text-white font-bold text-lg">{Math.round(effects.resonance.amount * 100)}%</span>
                  </div>
                  <VisualSlider
                    value={effects.resonance.amount}
                    onChange={(value) => handleEffectChange('resonance', 'amount', value)}
                    pattern="circles"
                    color="white"
                  />
                </div>

                {/* Decay Control */}
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-white transform rotate-12"></div>
                      </div>
                      <span className="text-yellow-400 font-medium text-lg">Decay</span>
                    </div>
                    <span className="text-white font-bold text-lg">{Math.round(effects.decay.amount * 100)}%</span>
                  </div>
                  <VisualSlider
                    value={effects.decay.amount}
                    onChange={(value) => handleEffectChange('decay', 'amount', value)}
                    pattern="zigzag"
                    color="white"
                  />
                </div>
              </div>

              {/* Effect Presets */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-white font-medium mb-3">Effect Presets</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyPreset('subtle')}
                    className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Subtle
                  </button>
                  <button
                    onClick={() => applyPreset('aggressive')}
                    className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Aggressive
                  </button>
                  <button
                    onClick={() => applyPreset('ambient')}
                    className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Ambient
                  </button>
                  <button
                    onClick={() => applyPreset('reset')}
                    className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {editMode === 'chops' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-medium">Audio Chops</h3>
              
              {/* Waveform with Selection Region */}
              <div className="relative">
                <div 
                  className="relative h-24 bg-gray-800 rounded-lg overflow-hidden"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                >
                  {/* Waveform visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end justify-center h-16 gap-px">
                      {Array.from({ length: 100 }).map((_, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-sm"
                          style={{
                            width: '2px',
                            height: `${Math.random() * 20 + 4}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Selection/Loop Region */}
                  <div 
                    className="absolute top-2 bottom-2 border-2 border-white rounded cursor-move touch-none"
                    style={{
                      left: `${chopSelection.start}%`,
                      right: `${100 - chopSelection.end}%`,
                    }}
                    onMouseDown={handleSelectionStart}
                    onTouchStart={handleSelectionStart}
                  >
                    <div className="absolute -top-1 -left-1 w-3 h-3 sm:w-2 sm:h-2 bg-white rounded-full cursor-ew-resize touch-none" 
                         onMouseDown={(e) => handleResizeStart(e, 'start')}
                         onTouchStart={(e) => handleResizeStart(e, 'start')} />
                    <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-2 sm:h-2 bg-white rounded-full cursor-ew-resize touch-none"
                         onMouseDown={(e) => handleResizeStart(e, 'end')}
                         onTouchStart={(e) => handleResizeStart(e, 'end')} />
                  </div>
                  
                  {/* Playhead */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500" 
                    style={{ left: `${playheadPosition}%` }} 
                  />
                </div>
                
                {/* Crop Sound Label */}
                <div className="text-right text-sm text-gray-400 mt-2">crop sound</div>
              </div>

              {/* Tempo and Volume Controls */}
              <div className="flex items-center justify-between">
                {/* Volume Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => adjustVolume(-0.1)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <button 
                    onClick={() => adjustVolume(0.1)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>

                {/* Tempo Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => adjustTempo(-5)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="px-3 py-1 bg-gray-700 rounded text-white text-sm font-medium">
                    {tempo} bpm
                  </div>
                  <button 
                    onClick={() => adjustTempo(5)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Chopping Pads Grid */}
              <div className="space-y-4">
                <h4 className="text-white font-medium">Chop Pads</h4>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {Array.from({ length: 6 }).map((_, index) => {
                    const chop = chops[index];
                    const isSelected = selectedChopIndex === index;
                    const isEmpty = !chop;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleChopPadClick(index)}
                        className={`
                          aspect-square rounded-lg border-2 transition-all duration-200
                          ${isSelected 
                            ? 'bg-white border-white' 
                            : isEmpty 
                              ? 'bg-gray-800 border-gray-600 hover:border-gray-500' 
                              : 'bg-orange-500 border-orange-500 hover:bg-orange-600'
                          }
                        `}
                      >
                        {chop && (
                          <div className="p-2">
                            <div className="text-xs text-center text-white font-medium">
                              Chop {index + 1}
                            </div>
                            <div className="text-xs text-center text-white/70">
                              {Math.round(chop.duration * 100) / 100}s
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chop Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={createChop}
                  disabled={chopSelection.start >= chopSelection.end}
                  className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Create Chop
                </button>
                <button
                  onClick={playSelectedChop}
                  disabled={!selectedChop}
                  className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Play Chop
                </button>
              </div>

              {/* Selected Chop Details */}
              {selectedChop && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h5 className="text-white font-medium mb-2">Selected Chop Details</h5>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div>Start: {Math.round(selectedChop.startTime * 100) / 100}s</div>
                    <div>End: {Math.round(selectedChop.endTime * 100) / 100}s</div>
                    <div>Duration: {Math.round(selectedChop.duration * 100) / 100}s</div>
                  </div>
                  <button
                    onClick={deleteSelectedChop}
                    className="mt-3 bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700 transition-colors"
                  >
                    Delete Chop
                  </button>
                </div>
              )}
            </div>
          )}

          {editMode === 'notes' && (
            <div className="space-y-6">
              <h3 className="text-white text-lg font-medium">Musical Notes & Key Detection</h3>
              
              {/* Waveform with Selection Region */}
              <div className="relative">
                <div className="relative h-24 bg-gray-800 rounded-lg overflow-hidden">
                  {/* Waveform visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end justify-center h-16 gap-px">
                      {Array.from({ length: 100 }).map((_, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-sm"
                          style={{
                            width: '2px',
                            height: `${Math.random() * 20 + 4}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Playhead */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500" 
                    style={{ left: `${playheadPosition}%` }} 
                  />
                  
                  {/* Selection line */}
                  <div 
                    className="absolute top-1/2 w-full h-px bg-white opacity-50"
                    style={{ left: `${playheadPosition}%` }}
                  />
                </div>
              </div>

              {/* Tempo and Volume Controls */}
              <div className="flex items-center justify-between">
                {/* Volume Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => adjustVolume(-0.1)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <button 
                    onClick={() => adjustVolume(0.1)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>

                {/* Tempo Controls */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => adjustTempo(-5)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="px-3 py-1 bg-gray-700 rounded text-white text-sm font-medium">
                    {tempo} bpm
                  </div>
                  <button 
                    onClick={() => adjustTempo(5)}
                    className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Circular Notes Interface */}
              <div className="flex justify-center">
                <div className="relative w-80 h-80 sm:w-96 sm:h-96">
                  {/* Outer ring with scale degrees */}
                  <div className="absolute inset-0 rounded-full border-2 border-gray-600 bg-gray-800 shadow-lg">
                    {/* Scale degree markers */}
                    {Array.from({ length: 12 }).map((_, index) => {
                      const angle = (index * 30) - 90; // Start from top
                      const x = 50 + 45 * Math.cos(angle * Math.PI / 180);
                      const y = 50 + 45 * Math.sin(angle * Math.PI / 180);
                      const isActive = selectedScaleDegrees.includes(index);
                      const isInScale = currentScale.some(note => {
                        const rootNote = detectedKey.replace(/[^A-G#b]/, '');
                        const rootIndex = NOTE_NAMES.indexOf(rootNote);
                        const noteIndex = (rootIndex + index) % 12;
                        return NOTE_NAMES[noteIndex] === note;
                      });
                      
                      return (
                        <button
                          key={index}
                          onClick={() => toggleScaleDegree(index)}
                          className={`absolute w-8 h-8 sm:w-6 sm:h-6 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 ${
                            isActive 
                              ? 'bg-white scale-110 shadow-lg' 
                              : isInScale
                                ? 'bg-orange-500 hover:bg-orange-400'
                                : 'bg-gray-500 hover:bg-gray-400'
                          }`}
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        >
                          <span className={`text-xs font-bold ${
                            isActive ? 'text-gray-900' : 'text-white'
                          }`}>
                            {SCALE_DEGREE_NAMES[index]}
                          </span>
                        </button>
                      );
                    })}
                    
                    {/* Connection lines for active scale degrees */}
                    {selectedScaleDegrees.length > 1 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {selectedScaleDegrees.map((degree, index) => {
                          if (index === 0) return null;
                          const prevDegree = selectedScaleDegrees[index - 1];
                          const angle1 = (prevDegree * 30) - 90;
                          const angle2 = (degree * 30) - 90;
                          const x1 = 50 + 45 * Math.cos(angle1 * Math.PI / 180);
                          const y1 = 50 + 45 * Math.sin(angle1 * Math.PI / 180);
                          const x2 = 50 + 45 * Math.cos(angle2 * Math.PI / 180);
                          const y2 = 50 + 45 * Math.sin(angle2 * Math.PI / 180);
                          
                          return (
                            <line
                              key={`line-${prevDegree}-${degree}`}
                              x1={`${x1}%`}
                              y1={`${y1}%`}
                              x2={`${x2}%`}
                              y2={`${y2}%`}
                              stroke="rgba(255, 255, 255, 0.3)"
                              strokeWidth="1"
                            />
                          );
                        })}
                      </svg>
                    )}
                  </div>

                  {/* Inner circle with key display */}
                  <div className="absolute inset-8 rounded-full bg-gray-700 border-2 border-gray-500 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
                        {detectedKey || 'Cm'}
                      </div>
                      <div className="text-sm text-gray-300">
                        {keyType === 'major' ? 'Major' : 'Minor'}
                      </div>
                    </div>
                  </div>

                  {/* Transpose controls */}
                  <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                    <button
                      onClick={() => setTranspose(transpose - 1)}
                      className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                    >
                      -
                    </button>
                    <div className="px-3 py-1 bg-gray-700 rounded text-white text-sm font-medium min-w-[60px] text-center">
                      {transpose > 0 ? `+${transpose}` : transpose}
                    </div>
                    <button
                      onClick={() => setTranspose(transpose + 1)}
                      className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Key Detection and Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-white font-medium mb-3">Key Analysis</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Detected Key:</span>
                      <span className="text-white font-medium">{detectedKey || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Confidence:</span>
                      <span className="text-white font-medium">{keyConfidence}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Scale Type:</span>
                      <span className="text-white font-medium capitalize">{keyType}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={detectKey}
                      disabled={isAnalyzing}
                      className="flex-1 bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600 disabled:bg-gray-600 transition-colors"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Key'}
                    </button>
                    <button
                      onClick={playScale}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                    >
                      Play Scale
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg">
                  <h4 className="text-white font-medium mb-3">Transposition</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Current:</span>
                      <span className="text-white font-medium">{detectedKey || 'Cm'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Transposed:</span>
                      <span className="text-white font-medium">{transposedKey}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {transpose > 0 ? `+${transpose} semitones up` : 
                       transpose < 0 ? `${transpose} semitones down` : 
                       'No transposition'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scale and Chord Information */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-white font-medium mb-3">Scale Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-300 mb-2">Scale Notes:</div>
                    <div className="flex flex-wrap gap-1">
                      {currentScale.map((note, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 rounded text-xs ${
                            selectedScaleDegrees.includes(index)
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-300 mb-2">Common Chords:</div>
                    <div className="flex flex-wrap gap-1">
                      {commonChords.map((chord, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs"
                        >
                          {chord}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlineEditPanel;
