export interface SongPart {
  id: string;
  name: string;
  label: string;
  isActive: boolean;
}

export interface MusicalElement {
  id: string;
  name: string;
  label: string;
  isActive: boolean;
}

export interface Genre {
  id: string;
  name: string;
  label: string;
  isActive: boolean;
}

export interface AudioClip {
  id: string;
  songPart: string;
  element: string;
  genre: string;
  audioUrl: string;
  waveform: number[];
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  createdAt: Date;
  volume?: number; // 0.0 - 1.0
  bpm?: number; // base bpm of the clip
  // Audio processing metadata
  audioBuffer?: AudioBuffer; // Web Audio buffer for processing
  chops?: AudioChop[]; // Chop points and segments
  key?: string; // Detected musical key (e.g., "C", "Am", "F#m")
  effects?: AudioEffects; // Applied effects
}

export interface AudioChop {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  name: string;
  audioBuffer?: AudioBuffer; // Pre-sliced buffer
}

export interface AudioEffects {
  reverb: { enabled: boolean; amount: number; }; // 0-1
  delay: { enabled: boolean; time: number; feedback: number; }; // time in ms, feedback 0-1
  filter: { enabled: boolean; frequency: number; type: 'lowpass' | 'highpass' | 'bandpass'; }; // Hz
  distortion: { enabled: boolean; amount: number; }; // 0-1
  compression: { enabled: boolean; threshold: number; ratio: number; }; // dB, ratio
}

export interface RecordingState {
  isRecording: boolean;
  isGenerating: boolean;
  showHoldText: boolean;
}

export type EditTab = 'chops' | 'notes' | 'fx';

export interface EditState {
  isOpen: boolean;
  activeTab: EditTab;
  selectedClip: AudioClip | null;
}
