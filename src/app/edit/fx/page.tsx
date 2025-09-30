'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, Minus, Droplets, Hand, Music, Volume2 } from 'lucide-react';
import { AudioClip, AudioEffects } from '@/types';

type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

export default function FXPage() {
  const router = useRouter();
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [effects, setEffects] = useState<AudioEffects>({
    reverb: { enabled: false, amount: 0.5 },
    delay: { enabled: false, time: 250, feedback: 0.3 },
    filter: { enabled: false, frequency: 1000, type: 'lowpass' },
    distortion: { enabled: false, amount: 0.5 },
    compression: { enabled: false, threshold: -24, ratio: 4 }
  });
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [sourceNode, setSourceNode] = useState<MediaElementAudioSourceNode | null>(null);
  const [gainNode, setGainNode] = useState<GainNode | null>(null);

  const effectControls = [
    {
      id: 'wet',
      name: 'Wet',
      icon: Droplets,
      value: effects.reverb.amount,
      onChange: (val: number) => setEffects(prev => ({
        ...prev,
        reverb: { ...prev.reverb, amount: val }
      })),
      enabled: effects.reverb.enabled,
      onToggle: () => setEffects(prev => ({
        ...prev,
        reverb: { ...prev.reverb, enabled: !prev.reverb.enabled }
      })),
      min: 0,
      max: 1,
      step: 0.1,
      unit: '%',
      visual: 'grid'
    },
    {
      id: 'cutoff',
      name: 'Cut Off',
      icon: Hand,
      value: effects.filter.frequency,
      onChange: (val: number) => setEffects(prev => ({
        ...prev,
        filter: { ...prev.filter, frequency: val }
      })),
      enabled: effects.filter.enabled,
      onToggle: () => setEffects(prev => ({
        ...prev,
        filter: { ...prev.filter, enabled: !prev.filter.enabled }
      })),
      min: 100,
      max: 8000,
      step: 100,
      unit: 'Hz',
      visual: 'button'
    },
    {
      id: 'resonance',
      name: 'Resonan',
      icon: Music,
      value: effects.filter.frequency / 1000, // Normalize for display
      onChange: (val: number) => setEffects(prev => ({
        ...prev,
        filter: { ...prev.filter, frequency: val * 1000 }
      })),
      enabled: effects.filter.enabled,
      onToggle: () => setEffects(prev => ({
        ...prev,
        filter: { ...prev.filter, enabled: !prev.filter.enabled }
      })),
      min: 0.1,
      max: 8,
      step: 0.1,
      unit: '',
      visual: 'lines'
    },
    {
      id: 'decay',
      name: 'Decay',
      icon: Volume2,
      value: effects.delay.time / 1000, // Convert to seconds
      onChange: (val: number) => setEffects(prev => ({
        ...prev,
        delay: { ...prev.delay, time: val * 1000 }
      })),
      enabled: effects.delay.enabled,
      onToggle: () => setEffects(prev => ({
        ...prev,
        delay: { ...prev.delay, enabled: !prev.delay.enabled }
      })),
      min: 0.1,
      max: 2,
      step: 0.1,
      unit: 's',
      visual: 'circles'
    }
  ];

  useEffect(() => {
    // Wait a bit for localStorage data to be available
    const loadClipData = () => {
      const clipData = localStorage.getItem('currentEditingClip');
      console.log('FX Page - Looking for clip data:', clipData);
      
      if (clipData) {
        try {
          const parsedClip = JSON.parse(clipData);
          console.log('FX Page - Parsed clip:', parsedClip);
          setClip(parsedClip);
          
          if (parsedClip.effects) {
            setEffects(parsedClip.effects);
          }
          
          // Create audio element for playback
          const audio = new Audio(parsedClip.audioUrl);
          audio.crossOrigin = 'anonymous';
          setAudioElement(audio);
          
          // Initialize Web Audio API
          initializeAudioContext(audio);
        } catch (error) {
          console.error('FX Page - Error parsing clip data:', error);
        }
      } else {
        console.log('FX Page - No clip data found in localStorage');
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
      const ctx = new (window.AudioContext || (window as WindowWithAudio).webkitAudioContext)();
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

  // Apply real-time effects when effects state changes
  useEffect(() => {
    if (!audioContext || !sourceNode || !gainNode) return;
    
    // Disconnect existing chain
    sourceNode.disconnect();
    gainNode.disconnect();
    
    // Rebuild effects chain
    let currentNode: AudioNode = sourceNode;
    
    // Reverb effect
    if (effects.reverb.enabled) {
      const convolver = audioContext.createConvolver();
      const reverbGain = audioContext.createGain();
      reverbGain.gain.value = effects.reverb.amount;
      
      // Create simple reverb impulse
      const length = audioContext.sampleRate * 2;
      const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
      }
      convolver.buffer = impulse;
      
      currentNode.connect(convolver);
      convolver.connect(reverbGain);
      currentNode = reverbGain;
    }
    
    // Filter effect
    if (effects.filter.enabled) {
      const filter = audioContext.createBiquadFilter();
      filter.type = effects.filter.type as BiquadFilterType;
      filter.frequency.value = effects.filter.frequency;
      filter.Q.value = 1;
      
      currentNode.connect(filter);
      currentNode = filter;
    }
    
    // Distortion effect
    if (effects.distortion.enabled) {
      const distortion = audioContext.createWaveShaper();
      const amount = effects.distortion.amount;
      const samples = 44100;
      const curve = new Float32Array(samples);
      
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20) / (1 + Math.abs(x) * 20);
      }
      distortion.curve = curve;
      distortion.oversample = '4x';
      
      currentNode.connect(distortion);
      currentNode = distortion;
    }
    
    // Delay effect
    if (effects.delay.enabled) {
      const delay = audioContext.createDelay(1);
      const delayGain = audioContext.createGain();
      const feedbackGain = audioContext.createGain();
      
      delay.delayTime.value = effects.delay.time / 1000;
      feedbackGain.gain.value = effects.delay.feedback;
      delayGain.gain.value = 0.3;
      
      currentNode.connect(delay);
      delay.connect(feedbackGain);
      feedbackGain.connect(delay);
      delay.connect(delayGain);
      
      const merge = audioContext.createGain();
      currentNode.connect(merge);
      delayGain.connect(merge);
      currentNode = merge;
    }
    
    // Compression effect
    if (effects.compression.enabled) {
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = effects.compression.threshold;
      compressor.knee.value = 30;
      compressor.ratio.value = effects.compression.ratio;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      
      currentNode.connect(compressor);
      currentNode = compressor;
    }
    
    // Connect to gain and destination
    currentNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
  }, [effects, audioContext, sourceNode, gainNode]);

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

  const handleSave = () => {
    if (clip) {
      const updatedClip = { ...clip, effects };
      localStorage.setItem('editingClip', JSON.stringify(updatedClip));
    }
    router.back();
  };

  const renderVisual = (visual: string, value: number, enabled: boolean) => {
    const normalizedValue = Math.min(1, Math.max(0, value));
    const fillWidth = `${normalizedValue * 100}%`;
    
    switch (visual) {
      case 'grid': // Wet - Raindrop pattern
        return (
          <div className="w-20 h-12 bg-gray-800 rounded border border-orange-500 overflow-hidden relative">
            <div 
              className="absolute inset-0 bg-black"
              style={{ width: fillWidth }}
            >
              <div className="grid grid-cols-8 gap-0.5 h-full p-1">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm ${
                      enabled ? 'bg-orange-500' : 'bg-gray-600'
                    }`}
                    style={{ 
                      height: '2px',
                      opacity: Math.random() * 0.8 + 0.2
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case 'button': // Cut Off - Diagonal lines pattern
        return (
          <div className="w-20 h-12 bg-gray-800 rounded border border-orange-500 overflow-hidden relative">
            <div 
              className="absolute inset-0 bg-black"
              style={{ width: fillWidth }}
            >
              <div className="h-full flex items-center justify-center">
                <div className="w-full h-full relative">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`absolute w-1 ${
                        enabled ? 'bg-orange-500' : 'bg-gray-600'
                      }`}
                      style={{
                        height: '100%',
                        left: `${i * 12}%`,
                        transform: 'rotate(45deg)',
                        transformOrigin: 'center'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'lines': // Resonance - Concentric circles pattern
        return (
          <div className="w-20 h-12 bg-gray-800 rounded border border-orange-500 overflow-hidden relative">
            <div 
              className="absolute inset-0 bg-black"
              style={{ width: fillWidth }}
            >
              <div className="h-full flex items-center justify-center">
                <div className="relative w-8 h-8">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`absolute rounded-full border ${
                        enabled ? 'border-orange-500' : 'border-gray-600'
                      }`}
                      style={{
                        width: `${(i + 1) * 8}px`,
                        height: `${(i + 1) * 8}px`,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        opacity: 0.7 - (i * 0.15)
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'circles': // Decay - Zigzag pattern
        return (
          <div className="w-20 h-12 bg-gray-800 rounded border border-orange-500 overflow-hidden relative">
            <div 
              className="absolute inset-0 bg-black"
              style={{ width: fillWidth }}
            >
              <div className="h-full flex items-center justify-center">
                <svg width="32" height="24" viewBox="0 0 32 24" className="w-full h-full">
                  <path
                    d="M2,12 L8,4 L14,20 L20,8 L26,16 L30,12"
                    stroke={enabled ? '#f97316' : '#6b7280'}
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="w-20 h-12 bg-gray-800 rounded border border-orange-500"></div>;
    }
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
        <h1 className="text-lg font-semibold">Edit Track - FX</h1>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          Save
        </button>
      </div>

      {/* BPM and Volume Controls */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {/* Volume Controls */}
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
              <Minus className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <button className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* BPM Control */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleBpmChange(-5)}
              className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-lg font-mono min-w-[60px] text-center">{bpm} bpm</span>
            <button 
              onClick={() => handleBpmChange(5)}
              className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Waveform Display */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative h-32 bg-gray-900 rounded-lg overflow-hidden">
          {/* Waveform visualization */}
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
          
          {/* Selection/Loop Region */}
          <div className="absolute top-2 bottom-2 left-1/4 right-1/3 border-2 border-white rounded">
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rounded-full"></div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"></div>
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
        
        {/* Crop Sound Label */}
        <div className="text-right text-sm text-gray-400 mt-2">crop sound</div>
      </div>

      {/* Effects Controls */}
      <div className="p-4">
        <div className="space-y-4">
          {effectControls.map((control) => {
            const Icon = control.icon;
            return (
              <div key={control.id} className="flex items-center gap-4">
                {/* Icon */}
                <div className="w-12 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                {/* Visual Pattern */}
                <div className="flex-1">
                  {renderVisual(control.visual, control.value, control.enabled)}
                </div>
                
                {/* Control Info */}
                <div className="w-20 text-right">
                  <div className="text-white text-sm font-medium">{control.name}</div>
                  <div className="text-gray-400 text-xs">
                    {Math.round(control.value * (control.unit === '%' ? 100 : 1))}{control.unit}
                  </div>
                </div>
                
                {/* Toggle Button */}
                <button
                  onClick={control.onToggle}
                  className={`w-8 h-8 rounded transition-colors ${
                    control.enabled ? 'bg-orange-500' : 'bg-gray-600'
                  }`}
                />
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Effects will be applied in real-time during playback</p>
        </div>
      </div>
    </div>
  );
}
