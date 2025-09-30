'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, RotateCcw, Plus, Minus } from 'lucide-react';
import { AudioClip, AudioChop } from '@/types';
import { audioProcessor } from '@/services/AudioProcessor';

interface ChopsPageProps {
  clip: AudioClip;
}

export default function ChopsPage() {
  const router = useRouter();
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [chops, setChops] = useState<AudioChop[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedChop, setSelectedChop] = useState<string | null>(null);
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [sourceNode, setSourceNode] = useState<MediaElementAudioSourceNode | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  useEffect(() => {
    // Wait a bit for localStorage data to be available
    const loadClipData = () => {
      const clipData = localStorage.getItem('currentEditingClip');
      console.log('Chops Page - Looking for clip data:', clipData);
      
      if (clipData) {
        try {
          const parsedClip = JSON.parse(clipData);
          console.log('Chops Page - Parsed clip:', parsedClip);
          setClip(parsedClip);
          
          if (parsedClip.chops) {
            setChops(parsedClip.chops);
          }
          
          // Create audio element for playback
          const audio = new Audio(parsedClip.audioUrl);
          audio.crossOrigin = 'anonymous';
          setAudioElement(audio);
          
          // Initialize Web Audio API
          initializeAudioContext(audio);
        } catch (error) {
          console.error('Chops Page - Error parsing clip data:', error);
        }
      } else {
        console.log('Chops Page - No clip data found in localStorage');
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
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  const handleCreateChops = async () => {
    if (!clip) return;
    
    setIsProcessing(true);
    try {
      const audioBuffer = await audioProcessor.loadAudioBuffer(clip.audioUrl);
      // Create 8 chops for drum pad interface
      const chopPoints = Array.from({ length: 7 }, (_, i) => (clip.duration / 8) * (i + 1));
      const newChops = await audioProcessor.createChops(audioBuffer, chopPoints);
      setChops(newChops);
    } catch (error) {
      console.error('Failed to create chops:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const playChop = (chop: AudioChop) => {
    if (typeof window === 'undefined') return;
    audioProcessor.playChop(chop, 0.7);
    setSelectedChop(chop.id);
    setTimeout(() => setSelectedChop(null), 200);
  };

  const handleSave = () => {
    if (clip) {
      const updatedClip = { ...clip, chops };
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
        <h1 className="text-lg font-semibold">Edit Track - Chops</h1>
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
            <RotateCcw className="w-4 h-4" />
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

      {/* Chops Grid */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Chops</h2>
          <button
            onClick={handleCreateChops}
            disabled={isProcessing}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg text-sm transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Auto Chop'}
          </button>
        </div>

        {chops.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {chops.map((chop, index) => (
              <button
                key={chop.id}
                onClick={() => playChop(chop)}
                className={`aspect-square rounded-lg border-2 transition-all ${
                  selectedChop === chop.id
                    ? 'border-orange-500 bg-orange-500/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col items-center justify-center h-full p-2">
                  <div className="text-sm font-medium">Chop {index + 1}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {chop.startTime.toFixed(1)}s - {chop.endTime.toFixed(1)}s
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-12">
            <div className="text-6xl mb-4">🎵</div>
            <p className="text-lg mb-2">No chops created yet</p>
            <p className="text-sm">Click "Auto Chop" to create segments</p>
          </div>
        )}
      </div>
    </div>
  );
}
