'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Plus, Minus } from 'lucide-react';
import { AudioClip } from '@/types';
import { audioProcessor } from '@/services/AudioProcessor';

interface NotesPageProps {
  clip: AudioClip;
}

export default function NotesPage() {
  const router = useRouter();
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [detectedKey, setDetectedKey] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [sourceNode, setSourceNode] = useState<MediaElementAudioSourceNode | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const majorKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const minorKeys = ['Am', 'Bm', 'Cm', 'Dm', 'Em', 'Fm', 'Gm'];

  useEffect(() => {
    // Wait a bit for localStorage data to be available
    const loadClipData = () => {
      const clipData = localStorage.getItem('currentEditingClip');
      console.log('Notes Page - Looking for clip data:', clipData);
      
      if (clipData) {
        try {
          const parsedClip = JSON.parse(clipData);
          console.log('Notes Page - Parsed clip:', parsedClip);
          setClip(parsedClip);
          loadAudioData(parsedClip);
          
          // Create audio element for playback
          const audio = new Audio(parsedClip.audioUrl);
          audio.crossOrigin = 'anonymous';
          setAudioElement(audio);
          
          // Initialize Web Audio API
          initializeAudioContext(audio);
        } catch (error) {
          console.error('Notes Page - Error parsing clip data:', error);
        }
      } else {
        console.log('Notes Page - No clip data found in localStorage');
      }
    };

    // Try immediately
    loadClipData();
    
    // If no data found, try again after a short delay
    if (!localStorage.getItem('currentEditingClip')) {
      const timeoutId = setTimeout(loadClipData, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  const initializeAudioContext = (audio: HTMLAudioElement) => {
    if (typeof window === 'undefined') return;
    
    try {
      const ctx = new (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      
      // Connect source -> gain -> destination
      source.connect(gain);
      gain.connect(ctx.destination);
      
      setAudioContext(ctx);
      setSourceNode(source);
      setGainNode(gain);
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  };

  const handlePlayPause = () => {
    if (!audioElement || !audioContext) return;
    
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      audioElement.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  // Apply real-time transposition
  useEffect(() => {
    if (!audioElement || transpose === 0) {
      if (audioElement) {
        audioElement.playbackRate = 1;
      }
      return;
    }
    
    // Simple pitch shifting using playback rate
    // This is a basic implementation - for true pitch shifting without tempo change,
    // you'd need more advanced algorithms like PSOLA or phase vocoder
    const semitoneRatio = Math.pow(2, transpose / 12);
    audioElement.playbackRate = semitoneRatio;
  }, [transpose, audioElement]);

  // Apply real-time BPM adjustment
  useEffect(() => {
    if (!audioElement) return;
    
    // Convert BPM to playback rate (assuming base BPM of 120)
    const baseBpm = 120;
    const playbackRate = bpm / baseBpm;
    audioElement.playbackRate = playbackRate;
  }, [bpm, audioElement]);

  const handleBpmChange = (delta: number) => {
    setBpm(prev => Math.max(60, Math.min(200, prev + delta)));
  };

  const loadAudioData = async (clipData: AudioClip) => {
    if (typeof window === 'undefined') return;
    
    setIsProcessing(true);
    try {
      const audioBuffer = await audioProcessor.loadAudioBuffer(clipData.audioUrl);
      const key = await audioProcessor.detectKey(audioBuffer);
      setDetectedKey(key);
    } catch (error) {
      console.error('Failed to detect key:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranspose = (delta: number) => {
    setTranspose(prev => Math.max(-12, Math.min(12, prev + delta)));
  };

  const handleSave = () => {
    if (clip) {
      const updatedClip = { ...clip, key: detectedKey };
      localStorage.setItem('editingClip', JSON.stringify(updatedClip));
    }
    router.back();
  };

  if (!clip) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">No clip selected</div>
          <div className="text-sm text-gray-400 mb-4">
            Please go back and try editing a clip again.
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">Edit Track - Notes</h1>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          Save
        </button>
      </div>

      {/* Waveform and Controls */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative h-24 bg-gray-900 rounded-lg mb-4">
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
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: '30%' }} />
          
          {/* Play button */}
          <button 
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="bg-black/50 rounded-full p-2">
              {isPlaying ? (
                <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                  <div className="w-2 h-4 bg-black"></div>
                  <div className="w-2 h-4 bg-black ml-1"></div>
                </div>
              ) : (
                <div className="w-6 h-6 bg-white rounded-sm ml-0.5"></div>
              )}
            </div>
          </button>
        </div>

        {/* BPM Controls */}
        <div className="flex items-center justify-center gap-4">
          <button 
            onClick={() => handleBpmChange(-5)}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-full"></div>
          </button>
          <span className="text-2xl font-mono min-w-[80px] text-center">{bpm} bpm</span>
          <button 
            onClick={() => handleBpmChange(5)}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key Detection and Transposition */}
      <div className="p-4">
        <div className="text-center mb-8">
          <h2 className="text-lg font-medium mb-4">Key & Transposition</h2>
          <div className="text-gray-400 text-sm mb-6">
            Detected Key: <span className="text-white font-mono text-lg">
              {isProcessing ? 'Analyzing...' : detectedKey || 'Unknown'}
            </span>
          </div>
        </div>
        
        {/* Circular Key Selector */}
        <div className="flex justify-center mb-8">
          <div className="relative w-80 h-80">
            {/* Outer circle with note buttons */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-700 bg-gray-900">
              {notes.map((note, index) => {
                const angle = (index * 30) - 90; // Start from top
                const x = 50 + 40 * Math.cos((angle * Math.PI) / 180);
                const y = 50 + 40 * Math.sin((angle * Math.PI) / 180);
                const isDetected = detectedKey.includes(note);
                const isMajor = majorKeys.includes(note);
                const isMinor = minorKeys.some(key => key.includes(note));
                
                return (
                  <button
                    key={index}
                    className={`absolute w-12 h-12 rounded-full border-2 transition-all ${
                      isDetected
                        ? 'border-orange-500 bg-orange-500 text-black'
                        : isMajor || isMinor
                        ? 'border-white bg-white text-black'
                        : 'border-gray-600 bg-gray-800 text-white hover:border-gray-500'
                    }`}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="text-sm font-medium">{note}</div>
                  </button>
                );
              })}
            </div>
            
            {/* Center chord display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
                <span className="text-white text-lg font-medium">
                  {isProcessing ? '?' : detectedKey || '?'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Transposition Controls */}
        <div className="text-center">
          <label className="block text-sm text-gray-300 mb-4">Transpose (semitones)</label>
          <div className="flex items-center justify-center gap-6">
            <button 
              onClick={() => handleTranspose(-1)}
              className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
            >
              <Minus className="w-6 h-6" />
            </button>
            <span className="text-white font-mono text-2xl w-16 text-center">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button 
              onClick={() => handleTranspose(1)}
              className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-4 text-gray-400 text-sm">
            <p>Transposition will be applied in real-time</p>
          </div>
        </div>
      </div>
    </div>
  );
}
