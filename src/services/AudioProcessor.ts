/**
 * Professional Audio Processing Service
 * Handles chopping, key detection, and real-time effects
 */

import { AudioClip, AudioChop, AudioEffects } from '@/types';

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private bufferCache = new Map<string, AudioBuffer>();

  constructor() {
    // Don't initialize AudioContext in constructor to avoid SSR issues
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      if (typeof window === 'undefined') {
        throw new Error('AudioContext is not available in server environment');
      }
      this.audioContext = new (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Load audio file into AudioBuffer for processing
   */
  async loadAudioBuffer(audioUrl: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(audioUrl)) {
      return this.bufferCache.get(audioUrl)!;
    }

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = this.getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      this.bufferCache.set(audioUrl, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to load audio buffer:', error);
      throw error;
    }
  }

  /**
   * CHOP FEATURE: Create audio chops at specified time points
   */
  async createChops(audioBuffer: AudioBuffer, chopPoints: number[]): Promise<AudioChop[]> {
    const chops: AudioChop[] = [];
    const sampleRate = audioBuffer.sampleRate;
    const audioContext = this.getAudioContext();
    
    // Sort chop points and add start/end
    const points = [0, ...chopPoints.sort((a, b) => a - b), audioBuffer.duration];
    
    for (let i = 0; i < points.length - 1; i++) {
      const startTime = points[i];
      const endTime = points[i + 1];
      
      if (endTime - startTime < 0.1) continue; // Skip very short chops
      
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.floor(endTime * sampleRate);
      const length = endSample - startSample;
      
      // Create new buffer for this chop
      const chopBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        length,
        sampleRate
      );
      
      // Copy audio data
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const chopData = chopBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          chopData[i] = sourceData[startSample + i];
        }
      }
      
      chops.push({
        id: `chop-${Date.now()}-${i}`,
        startTime,
        endTime,
        name: `Chop ${i + 1}`,
        audioBuffer: chopBuffer
      });
    }
    
    return chops;
  }

  /**
   * CHOP FEATURE: Play a specific chop
   */
  playChop(chop: AudioChop, volume: number = 1): AudioBufferSourceNode {
    const audioContext = this.getAudioContext();
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = chop.audioBuffer!;
    gainNode.gain.value = volume;
    
    source.connect(gainNode).connect(audioContext.destination);
    source.start();
    
    return source;
  }

  /**
   * NOTES FEATURE: Detect musical key from audio buffer
   */
  async detectKey(audioBuffer: AudioBuffer): Promise<string> {
    // Simplified key detection using chroma analysis
    const sampleRate = audioBuffer.sampleRate;
    const fftSize = 2048;
    const hopSize = 512;
    
    // Get mono channel for analysis
    const channelData = audioBuffer.getChannelData(0);
    const chroma = new Array(12).fill(0);
    
    // Simple chroma analysis (in production, use more sophisticated algorithms)
    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const frame = channelData.slice(i, i + fftSize);
      const energy = this.computeChroma(frame, sampleRate);
      
      for (let j = 0; j < 12; j++) {
        chroma[j] += energy[j];
      }
    }
    
    // Find dominant key
    const keyMap = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const majorKeys = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
    const minorKeys = [9, 11, 0, 2, 4, 5, 7]; // Am, Bm, Cm, Dm, Em, Fm, Gm
    
    let maxEnergy = 0;
    let detectedKey = 'C';
    
    // Check major keys
    for (const root of majorKeys) {
      let energy = 0;
      for (let i = 0; i < 7; i++) {
        energy += chroma[(root + majorKeys[i]) % 12];
      }
      if (energy > maxEnergy) {
        maxEnergy = energy;
        detectedKey = keyMap[root];
      }
    }
    
    // Check minor keys
    for (const root of minorKeys) {
      let energy = 0;
      for (let i = 0; i < 7; i++) {
        energy += chroma[(root + minorKeys[i]) % 12];
      }
      if (energy > maxEnergy) {
        maxEnergy = energy;
        detectedKey = keyMap[root] + 'm';
      }
    }
    
    return detectedKey;
  }

  /**
   * NOTES FEATURE: Transpose audio by semitones
   */
  async transposeAudio(audioBuffer: AudioBuffer, semitones: number): Promise<AudioBuffer> {
    if (semitones === 0) return audioBuffer;
    
    const ratio = Math.pow(2, semitones / 12);
    const newSampleRate = Math.round(audioBuffer.sampleRate * ratio);
    
    const audioContext = this.getAudioContext();
    const newBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      Math.round(audioBuffer.length / ratio),
      audioBuffer.sampleRate
    );
    
    // Simple pitch shifting (in production, use more sophisticated algorithms)
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < outputData.length; i++) {
        const sourceIndex = i * ratio;
        const index = Math.floor(sourceIndex);
        const fraction = sourceIndex - index;
        
        if (index < inputData.length - 1) {
          outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
        }
      }
    }
    
    return newBuffer;
  }

  /**
   * FX FEATURE: Create effects chain
   */
  createEffectsChain(effects: AudioEffects): {
    input: GainNode;
    output: GainNode;
    nodes: AudioNode[];
  } {
    const audioContext = this.getAudioContext();
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const nodes: AudioNode[] = [];
    
    let currentNode: AudioNode = input;
    
    // Reverb
    if (effects.reverb.enabled) {
      const convolver = audioContext.createConvolver();
      const reverbBuffer = this.createReverbBuffer(effects.reverb.amount);
      convolver.buffer = reverbBuffer;
      currentNode.connect(convolver);
      currentNode = convolver;
      nodes.push(convolver);
    }
    
    // Delay
    if (effects.delay.enabled) {
      const delay = audioContext.createDelay();
      const feedback = audioContext.createGain();
      const wet = audioContext.createGain();
      
      delay.delayTime.value = effects.delay.time / 1000;
      feedback.gain.value = effects.delay.feedback;
      wet.gain.value = 0.3;
      
      currentNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      
      const merger = audioContext.createChannelMerger(2);
      currentNode.connect(merger, 0, 0);
      wet.connect(merger, 0, 1);
      
      currentNode = merger;
      nodes.push(delay, feedback, wet, merger);
    }
    
    // Filter
    if (effects.filter.enabled) {
      const filter = audioContext.createBiquadFilter();
      filter.type = effects.filter.type;
      filter.frequency.value = effects.filter.frequency;
      filter.Q.value = 1;
      
      currentNode.connect(filter);
      currentNode = filter;
      nodes.push(filter);
    }
    
    // Distortion
    if (effects.distortion.enabled) {
      const distortion = this.createDistortionNode(effects.distortion.amount);
      currentNode.connect(distortion);
      currentNode = distortion;
      nodes.push(distortion);
    }
    
    // Compression
    if (effects.compression.enabled) {
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = effects.compression.threshold;
      compressor.ratio.value = effects.compression.ratio;
      compressor.knee.value = 30;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      
      currentNode.connect(compressor);
      currentNode = compressor;
      nodes.push(compressor);
    }
    
    currentNode.connect(output);
    
    return { input, output, nodes };
  }

  /**
   * Helper: Compute chroma features from audio frame
   */
  private computeChroma(frame: Float32Array, sampleRate: number): number[] {
    const chroma = new Array(12).fill(0);
    
    // Simple FFT approximation (in production, use proper FFT)
    for (let i = 0; i < frame.length; i++) {
      const frequency = (i * sampleRate) / frame.length;
      if (frequency < 80 || frequency > 5000) continue;
      
      const midiNote = 12 * Math.log2(frequency / 440) + 69;
      const chromaIndex = Math.floor(midiNote) % 12;
      const energy = Math.abs(frame[i]);
      
      chroma[chromaIndex] += energy;
    }
    
    return chroma;
  }

  /**
   * Helper: Create reverb impulse response
   */
  private createReverbBuffer(amount: number): AudioBuffer {
    const audioContext = this.getAudioContext();
    const length = audioContext.sampleRate * 2; // 2 seconds
    const buffer = audioContext.createBuffer(2, length, audioContext.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2) * amount;
      }
    }
    
    return buffer;
  }

  /**
   * Helper: Create distortion node
   */
  private createDistortionNode(amount: number): WaveShaperNode {
    const audioContext = this.getAudioContext();
    const distortion = audioContext.createWaveShaper();
    const samples = 44100;
    const curve = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * (1 + amount * 10)) * (1 - amount * 0.3);
    }
    
    distortion.curve = curve;
    distortion.oversample = '4x';
    
    return distortion;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.bufferCache.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Singleton instance
export const audioProcessor = new AudioProcessor();
