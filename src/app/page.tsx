'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SongPart, MusicalElement, Genre, AudioClip, RecordingState, EditState, EditTab } from '@/types';
import SongPartSelector from '@/components/SongPartSelector';
import ElementSelector from '@/components/ElementSelector';
import GenreSelector from '@/components/GenreSelector';
import RecordingButton from '@/components/RecordingButton';
import WaveformDisplay from '@/components/WaveformDisplay';
import TrackStack from '@/components/TrackStack';
import InlineEditPanel from '@/components/InlineEditPanel';
import UploadAudioButton from '@/components/UploadAudioButton';
import { LocalSongService } from '@/services/LocalSongService';

export default function Home() {
  const router = useRouter();
  
  // State for song parts
  const [songParts, setSongParts] = useState<SongPart[]>([
    { id: 'intro', name: 'intro', label: 'intro', isActive: true },
    { id: 'hook', name: 'hook', label: 'hook', isActive: false },
    { id: 'verse', name: 'verse', label: 'verse', isActive: false },
    { id: 'build', name: 'build', label: 'build', isActive: false },
    { id: 'drop', name: 'drop', label: 'drop', isActive: false },
    { id: 'bridge', name: 'bridge', label: 'bridge', isActive: false },
    { id: 'last-verse', name: 'last-verse', label: 'last verse', isActive: false },
    { id: 'outro', name: 'outro', label: 'outro', isActive: false },
  ]);

  // State for musical elements
  const [elements, setElements] = useState<MusicalElement[]>([
    { id: 'beats', name: 'beats', label: 'beats', isActive: true },
    { id: 'melody', name: 'melody', label: 'melody', isActive: false },
    { id: 'vocals', name: 'vocals', label: 'vocals', isActive: false },
    { id: 'bass', name: 'bass', label: 'bass', isActive: false },
  ]);

  // State for genres (removed '+' placeholder)
  const [genres, setGenres] = useState<Genre[]>([
    { id: 'hiphop', name: 'hiphop', label: 'hiphop', isActive: true },
    { id: 'rnb', name: 'rnb', label: 'RnB', isActive: false },
    { id: 'noai', name: 'noai', label: 'no AI', isActive: false },
  ]);

  const addCustomGenre = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, '-');
    setGenres((prev) => {
      const deactivated = prev.map((g) => ({ ...g, isActive: false }));
      const exists = deactivated.some((g) => g.id === id);
      const newId = exists ? `${id}-${Date.now()}` : id;
      const custom: Genre = { id: newId, name: label, label, isActive: true };
      return [...deactivated, custom];
    });
  };

  // State for audio clips
  const [clips, setClips] = useState<AudioClip[]>([]);

  // State for recording
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isGenerating: false,
    showHoldText: false,
  });

  // State for editing
  const [editState, setEditState] = useState<EditState>({
    isOpen: false,
    activeTab: 'chops',
    selectedClip: null,
  });

  // Inline edit state
  const [inlineEditMode, setInlineEditMode] = useState<'chops' | 'notes' | 'fx' | null>(null);

  // State for current waveform (during recording or for main display)
  const [currentWaveform, setCurrentWaveform] = useState<number[]>([]);
  const [isPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('');

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);

  // Load song data when coming from edit button
  React.useEffect(() => {
    const editingSong = localStorage.getItem('editingSong');
    if (editingSong) {
      try {
        const song = JSON.parse(editingSong);
        console.log('Loading song for editing:', song);
        
        // Load the clips from the song
        setClips(song.clips || []);
        
        // Clear the editing song data
        localStorage.removeItem('editingSong');
        
        // Show a message to the user
        alert(`Loaded song "${song.name}" for editing! You can now edit the clips.`);
      } catch (error) {
        console.error('Failed to load song for editing:', error);
        localStorage.removeItem('editingSong');
      }
    }
  }, []);

  // Generate mock waveform data
  const generateMockWaveform = () => {
    return Array.from({ length: 100 }, () => Math.random());
  };

  // Handle song part selection
  const handlePartSelect = (partId: string) => {
    setSongParts(parts => parts.map(part => ({
      ...part,
      isActive: part.id === partId
    })));
  };

  // Handle element selection
  const handleElementSelect = (elementId: string) => {
    setElements(elements => elements.map(element => ({
      ...element,
      isActive: element.id === elementId
    })));
  };

  // Handle genre selection
  const handleGenreSelect = (genreId: string) => {
    setGenres(genres => genres.map(genre => ({
      ...genre,
      isActive: genre.id === genreId
    })));
  };

  // Start/Stop recording toggle
  const toggleRecording = async () => {
    if (recordingState.isGenerating) return;

    if (!recordingState.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options: MediaRecorderOptions = { mimeType: 'audio/webm' } as MediaRecorderOptions;
        const recorder = new MediaRecorder(stream, options);
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          await generateFromAudio(blob);
          // stop tracks
          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setRecordingState(prev => ({ ...prev, isRecording: true }));
        setCurrentWaveform(generateMockWaveform());
      } catch (err) {
        console.error('Mic permission / recording error:', err);
      }
    } else {
      // stop
      mediaRecorderRef.current?.stop();
      setRecordingState(prev => ({ ...prev, isRecording: false }));
      setCurrentWaveform([]);
    }
  };

  function randomSeed() {
    // 32-bit signed int range
    return Math.floor(Math.random() * 2_147_483_647);
  }

  async function getBlobDurationSeconds(blob: Blob): Promise<number> {
    // Decode via HTMLAudioElement to get duration
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.src = url;
      audio.addEventListener('loadedmetadata', () => {
        const secs = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
        URL.revokeObjectURL(url);
        resolve(Math.round(secs));
      });
      // Fallback timeout
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
        resolve(30);
      }, 4000);
    });
  }

  async function generateFromAudio(blob: Blob) {
    try {
      setRecordingState(prev => ({ ...prev, isGenerating: true }));
      const activePart = songParts.find(part => part.isActive);
      const activeElement = elements.find(element => element.isActive);
      const activeGenre = genres.find(genre => genre.isActive);
      if (!activePart || !activeElement || !activeGenre) return;

      const durationSeconds = await getBlobDurationSeconds(blob);
      const seed = String(randomSeed());

      const formData = new FormData();
      formData.append('songPart', activePart.name);
      formData.append('element', activeElement.name);
      formData.append('genre', activeGenre.name);
      formData.append('totalSeconds', String(durationSeconds));
      formData.append('strength', '0.6');
      formData.append('seed', seed);
      if (extraPrompt.trim()) formData.append('prompt', extraPrompt.trim());
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/backend/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Generation failed');
      const result = await response.json();

      if (result.success) {
        const newClip: AudioClip = {
          id: Date.now().toString(),
          songPart: activePart.name,
          element: activeElement.name,
          genre: activeGenre.name,
          audioUrl: result.audioUrl,
          waveform: result.waveform,
          duration: result.duration,
          isPlaying: true,
          isLooping: true,
          createdAt: new Date(),
          volume: 1,
          bpm: 120,
        };
        setClips((prev) => [...prev, newClip]);
        setTimeout(() => playClipIndependent(newClip.id, true), 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecordingState(prev => ({ ...prev, isGenerating: false }));
    }
  }

  async function generateFromFile(file: File) {
    try {
      setRecordingState(prev => ({ ...prev, isGenerating: true }));
      const activePart = songParts.find(part => part.isActive);
      const activeElement = elements.find(element => element.isActive);
      const activeGenre = genres.find(genre => genre.isActive);
      if (!activePart || !activeElement || !activeGenre) return;

      const blob = file.slice(0, file.size, file.type || 'audio/*');
      const durationSeconds = await getBlobDurationSeconds(blob);
      const seed = String(randomSeed());

      const formData = new FormData();
      formData.append('songPart', activePart.name);
      formData.append('element', activeElement.name);
      formData.append('genre', activeGenre.name);
      formData.append('totalSeconds', String(durationSeconds));
      formData.append('strength', '0.6');
      formData.append('seed', seed);
      if (extraPrompt.trim()) formData.append('prompt', extraPrompt.trim());
      formData.append('audio', file, file.name);

      const response = await fetch('/backend/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Generation failed');
      const result = await response.json();

      if (result.success) {
        const newClip: AudioClip = {
          id: Date.now().toString(),
          songPart: activePart.name,
          element: activeElement.name,
          genre: activeGenre.name,
          audioUrl: result.audioUrl,
          waveform: result.waveform,
          duration: result.duration,
          isPlaying: true,
          isLooping: true,
          createdAt: new Date(),
          volume: 1,
          bpm: 120,
        };
        setClips((prev) => [...prev, newClip]);
        setTimeout(() => playClipIndependent(newClip.id, true), 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecordingState(prev => ({ ...prev, isGenerating: false }));
    }
  }

  // Audio elements registry for independent playback
  const audioMap = React.useRef<Map<string, HTMLAudioElement>>(new Map());
  const gainMap = React.useRef<Map<string, GainNode>>(new Map());
  const playbackRateMap = React.useRef<Map<string, number>>(new Map());
  const baseBpmMap = React.useRef<Map<string, number>>(new Map());
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };
  const ensureContext = () => {
    if (!audioCtxRef.current) {
      const w = window as WindowWithAudio;
      const Ctor = window.AudioContext || w.webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    // Try to resume context on user gesture
    try { audioCtxRef.current.resume(); } catch {}
    return audioCtxRef.current;
  };
  const sequenceEndedHandlerRef = React.useRef<(() => void) | null>(null);
  const [sequenceState, setSequenceState] = useState<{ isPlaying: boolean; queue: string[]; currentIndex: number }>({
    isPlaying: false,
    queue: [],
    currentIndex: 0,
  });

  // Play a single clip exclusively (stop others)
  const playClip = (clipId: string, loop = false) => {
    setClips((prev) => prev.map(c => ({ ...c, isPlaying: c.id === clipId, isLooping: c.id === clipId ? loop : c.isLooping })));
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // stop others
    audioMap.current.forEach((el, id) => {
      if (id !== clipId) { el.pause(); el.currentTime = 0; }
    });

    let el = audioMap.current.get(clipId);
    if (!el) {
      el = new Audio(clip.audioUrl);
      el.crossOrigin = 'anonymous';
      audioMap.current.set(clipId, el);
      // route through Web Audio for volume/tempo control if possible
      try {
        const ctx = ensureContext();
        const source = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        gain.gain.value = clip.volume ?? 1;
        source.connect(gain).connect(ctx.destination);
        gainMap.current.set(clipId, gain);
      } catch (err) {
        console.warn('Falling back to element volume for clip', clipId, err);
        el.volume = clip.volume ?? 1;
      }
      playbackRateMap.current.set(clipId, 1);
      if (!baseBpmMap.current.has(clipId)) {
        baseBpmMap.current.set(clipId, clip.bpm ?? 120);
      }
    }
    el.loop = loop;
    el.play().catch(console.error);
  };

  // Play a single clip independently (do not stop others)
  const playClipIndependent = (clipId: string, loop = false) => {
    setClips((prev) => prev.map(c => c.id === clipId ? { ...c, isPlaying: true, isLooping: loop } : c));
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    let el = audioMap.current.get(clipId);
    if (!el) {
      el = new Audio(clip.audioUrl);
      el.crossOrigin = 'anonymous';
      audioMap.current.set(clipId, el);
      try {
        const ctx = ensureContext();
        const source = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        gain.gain.value = clip.volume ?? 1;
        source.connect(gain).connect(ctx.destination);
        gainMap.current.set(clipId, gain);
      } catch (err) {
        el.volume = clip.volume ?? 1;
      }
      playbackRateMap.current.set(clipId, 1);
      if (!baseBpmMap.current.has(clipId)) {
        baseBpmMap.current.set(clipId, clip.bpm ?? 120);
      }
    }
    el.loop = loop;
    el.play().catch(console.error);
  };

  const playPart = (partName: string) => {
    const partClips = clips.filter(c => c.songPart === partName);
    // stop others first
    audioMap.current.forEach((el, id) => {
      const clip = clips.find(c => c.id === id);
      if (clip && clip.songPart !== partName) { el.pause(); el.currentTime = 0; }
    });
    // start all clips in the part
    partClips.forEach(c => {
      let el = audioMap.current.get(c.id);
      if (!el) {
        el = new Audio(c.audioUrl);
        el.crossOrigin = 'anonymous';
        audioMap.current.set(c.id, el);
        try {
          const ctx = ensureContext();
          const source = ctx.createMediaElementSource(el);
          const gain = ctx.createGain();
          gain.gain.value = c.volume ?? 1;
          source.connect(gain).connect(ctx.destination);
          gainMap.current.set(c.id, gain);
        } catch (err) {
          console.warn('Falling back to element volume for clip', c.id, err);
          el.volume = c.volume ?? 1;
        }
        playbackRateMap.current.set(c.id, 1);
        if (!baseBpmMap.current.has(c.id)) {
          baseBpmMap.current.set(c.id, c.bpm ?? 120);
        }
      }
      el.loop = false;
      el.currentTime = 0;
      el.play().catch(console.error);
    });
    setClips(prev => prev.map(x => x.songPart === partName ? { ...x, isPlaying: true } : { ...x, isPlaying: false }));
  };

  const pausePart = (partName: string) => {
    const partClips = clips.filter(c => c.songPart === partName);
    partClips.forEach(c => {
      const el = audioMap.current.get(c.id);
      el?.pause();
    });
    setClips(prev => prev.map(x => x.songPart === partName ? { ...x, isPlaying: false } : x));
  };

  const pauseClip = (clipId: string) => {
    setClips((prev) => prev.map(c => ({ ...c, isPlaying: c.id === clipId ? false : c.isPlaying })));
    const el = audioMap.current.get(clipId);
    el?.pause();
  };

  // Handle track operations
  const handleClipPlayPause = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    if (clip.isPlaying) {
      pauseClip(clipId);
    } else {
      playClipIndependent(clipId, clip.isLooping);
    }
  };

  const handleClipLoop = (clipId: string) => {
    setClips((prev) => prev.map(c => c.id === clipId ? { ...c, isLooping: !c.isLooping } : c));
    const el = audioMap.current.get(clipId);
    if (el) el.loop = !el.loop;
  };

  const handleClipEdit = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      setEditState({
        isOpen: true,
        activeTab: 'chops',
        selectedClip: clip,
      });
    }
  };

  const handleClipEditTab = (clipId: string, tab: EditTab) => {
    const clip = clips.find(c => c.id === clipId);
    console.log('Main Page - Looking for clip with ID:', clipId);
    console.log('Main Page - Available clips:', clips.map(c => ({ id: c.id, songPart: c.songPart })));
    console.log('Main Page - Found clip:', clip);

    if (clip) {
      setEditState({
        isOpen: true,
        activeTab: tab,
        selectedClip: clip,
      });
      setInlineEditMode(tab);
      console.log('Main Page - Edit state set with clip:', clip);
    } else {
      console.error('Main Page - Clip not found with ID:', clipId);
    }
  };

  const handleClipDelete = (clipId: string) => {
    setClips(clips => clips.filter(clip => clip.id !== clipId));
  };

  const handleInlineEditSave = (updatedClip: AudioClip) => {
    setClips(prev => prev.map(clip => 
      clip.id === updatedClip.id ? updatedClip : clip
    ));
    setInlineEditMode(null);
    setEditState({
      isOpen: false,
      activeTab: 'chops',
      selectedClip: null,
    });
  };

  const handleInlineEditClose = () => {
    setInlineEditMode(null);
    setEditState({
      isOpen: false,
      activeTab: 'chops',
      selectedClip: null,
    });
  };

  const handleClipSeek = (clipId: string, time: number) => {
    // Handle seeking for specific clip
    console.log(`Seeking clip ${clipId} to time ${time}`);
  };

  const handleClipVolumeToggle = (clipId: string) => {
    const gain = gainMap.current.get(clipId);
    const el = audioMap.current.get(clipId);
    if (gain) {
      const isMutedNow = gain.gain.value > 0;
      gain.gain.value = isMutedNow ? 0 : 1;
    } else if (el) {
      el.volume = el.volume > 0 ? 0 : 1;
    }
  };

  const adjustClipVolume = (clipId: string, delta: number) => {
    setClips((prev) => prev.map(c => c.id === clipId ? { ...c, volume: Math.min(1, Math.max(0, (c.volume ?? 1) + delta)) } : c));
    const gain = gainMap.current.get(clipId);
    const el = audioMap.current.get(clipId);
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      const next = Math.min(1, Math.max(0, (clip.volume ?? 1) + delta));
      if (gain) gain.gain.value = next;
      if (el) el.volume = next;
    }
  };

  const adjustClipBpm = (clipId: string, delta: number) => {
    // Update clip bpm in state and adjust playback rate relative to base bpm
    setClips((prev) => prev.map(c => {
      if (c.id !== clipId) return c;
      const currentBpm = c.bpm ?? 120;
      const nextBpm = Math.max(60, Math.min(200, currentBpm + delta));
      return { ...c, bpm: nextBpm };
    }));

    const el = audioMap.current.get(clipId);
    if (el) {
      const base = baseBpmMap.current.get(clipId) ?? 120;
      const clip = clips.find(x => x.id === clipId);
      const currentBpm = clip?.bpm ?? 120;
      const targetBpm = Math.max(60, Math.min(200, currentBpm + delta));
      const rate = Math.max(0.5, Math.min(1.5, targetBpm / base));
      el.playbackRate = rate;
      playbackRateMap.current.set(clipId, rate);
    }
  };

  // Canonical song order
  const SONG_ORDER = ['intro', 'hook', 'verse', 'build', 'drop', 'bridge', 'last-verse', 'outro'] as const;
  type SongOrderId = typeof SONG_ORDER[number];

  const getActivePart = () => songParts.find(p => p.isActive);
  const setActivePartById = (id: string) => setSongParts(parts => parts.map(p => ({ ...p, isActive: p.id === id })));

  const activePart = getActivePart();
  const visibleClips = clips.filter(c => c.songPart === (activePart?.name || ''));
  const currentlyPlayingClip = clips.find(c => c.isPlaying);
  const playingPartId = currentlyPlayingClip ? songParts.find(p => p.name === currentlyPlayingClip.songPart)?.id || null : null;

  const handleNextSongPart = () => {
    const currentId = (activePart?.id || 'intro') as SongOrderId;
    const idx = SONG_ORDER.indexOf(currentId);
    const nextIdx = Math.min(idx + 1, SONG_ORDER.length - 1);
    setActivePartById(SONG_ORDER[nextIdx]);
  };

  const handleFinishSong = async () => {
    try {
      // Show loading state
      setRecordingState(prev => ({ ...prev, isGenerating: true }));
      
      // Get all clips from all parts
      const allClips = clips.filter(clip => clip.songPart && clip.audioUrl);
      
      if (allClips.length === 0) {
        alert('No clips to save. Please create some audio clips first.');
        setRecordingState(prev => ({ ...prev, isGenerating: false }));
        return;
      }
      
      console.log('Creating song with clips:', allClips.length);
      
      // Generate song name
      const songName = LocalSongService.generateSongName(allClips);
      const bpm = LocalSongService.getMostCommonBPM(allClips);
      const key = LocalSongService.getMostCommonKey(allClips);
      
      console.log('Song details:', { songName, bpm, key });
      
      // For now, use a mock user ID - in a real app, this would come from auth
      const userId = 'mock-user-id';
      
      // Create the song
      const song = await LocalSongService.createSong(userId, songName, allClips, bpm, key || undefined);
      
      console.log('Song created successfully:', song.id);
      
      // Show success message
      alert(`Song "${song.name}" saved successfully!`);
      
      // Clear current clips
      setClips([]);
      setCurrentWaveform([]);
      
      // Reset to intro
      setActivePartById('intro');
      
      // Navigate to songs list
      router.push('/songs');
      
    } catch (error) {
      console.error('Failed to save song:', error);
      alert(`Failed to save song: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRecordingState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  // Handle main waveform controls
  const handleMainPlayPause = () => {
    // Controls sequential playback across parts
    if (!sequenceState.isPlaying) {
      // Build queue of part names that have at least one clip
      const queue: string[] = [];
      SONG_ORDER.forEach((partId) => {
        const partName = songParts.find(p => p.id === partId)?.name;
        if (!partName) return;
        const partClips = clips.filter(c => c.songPart === partName);
        if (partClips.length > 0) queue.push(partName);
      });
      if (queue.length === 0) return;

      const playFromQueue = (index: number) => {
        const partName = queue[index];
        if (!partName) {
          setSequenceState({ isPlaying: false, queue: [], currentIndex: 0 });
          return;
        }

        // remove previous handler
        if (sequenceEndedHandlerRef.current) {
          sequenceEndedHandlerRef.current();
          sequenceEndedHandlerRef.current = null;
        }

        // play all clips in this part simultaneously, then proceed after the longest duration
        playPart(partName);
        const longest = Math.max(...clips.filter(c => c.songPart === partName).map(c => c.duration || 0));
        const timer = setTimeout(() => {
          const nextIndex = index + 1;
          if (nextIndex < queue.length) {
            setSequenceState(prev => ({ ...prev, currentIndex: nextIndex }));
            playFromQueue(nextIndex);
          } else {
            setSequenceState({ isPlaying: false, queue: [], currentIndex: 0 });
          }
        }, Math.max(0, longest * 1000));
        sequenceEndedHandlerRef.current = () => clearTimeout(timer);
      };

      setSequenceState({ isPlaying: true, queue, currentIndex: 0 });
      playFromQueue(0);
    } else {
      // Stop sequence
      const currentPart = sequenceState.queue[sequenceState.currentIndex];
      if (currentPart) pausePart(currentPart);
      if (sequenceEndedHandlerRef.current) {
        sequenceEndedHandlerRef.current();
        sequenceEndedHandlerRef.current = null;
      }
      setSequenceState({ isPlaying: false, queue: [], currentIndex: 0 });
    }
  };

  const handleMainSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleMainVolumeToggle = () => {
    setIsMuted(!isMuted);
  };

  // Reload clip data from localStorage (for when returning from edit pages)
  const reloadClipFromStorage = () => {
    // Only reload if we're on the main page
    if (window.location.pathname !== '/') {
      console.log('Main Page - Not on main page, skipping reload');
      return;
    }

    const editingClipData = localStorage.getItem('currentEditingClip');
    if (editingClipData) {
      try {
        const updatedClip = JSON.parse(editingClipData);
        console.log('Main Page - Reloading clip from storage:', updatedClip.id);
        
        setClips(prev => prev.map(clip => 
          clip.id === updatedClip.id ? updatedClip : clip
        ));
        
        // Clear the editing clip from localStorage after a short delay
        // This ensures the edit page has time to read the data first
        setTimeout(() => {
          localStorage.removeItem('currentEditingClip');
          console.log('Main Page - Clip updated successfully');
        }, 100);
      } catch (error) {
        console.error('Main Page - Failed to reload clip from storage:', error);
      }
    } else {
      console.log('Main Page - No editing clip data found');
    }
  };

  // Listen for page focus to reload clip data when returning from edit pages
  React.useEffect(() => {
    const handleFocus = () => {
      // Only reload when returning to the main page
      if (window.location.pathname === '/') {
        console.log('Main Page - Focus event triggered, reloading clip data');
        reloadClipFromStorage();
      }
    };

    // Only use focus event, no periodic checking
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Disable reload when navigating to edit pages
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      // Don't clear localStorage when navigating to edit pages
      console.log('Main Page - Navigating away, preserving localStorage');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Compute next part label
  const currentId = (activePart?.id || 'intro') as SongOrderId;
  const idx = SONG_ORDER.indexOf(currentId);
  const nextIdx = Math.min(idx + 1, SONG_ORDER.length - 1);
  const nextLabel = songParts.find(p => p.id === SONG_ORDER[nextIdx])?.label || 'next';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">VibeTune</h1>
        <button
          onClick={() => router.push('/songs')}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          My Songs
        </button>
      </div>

      {/* Song Part Selector */}
      <SongPartSelector
        songParts={songParts}
        onPartSelect={handlePartSelect}
        playingPartId={playingPartId}
        onMainPlayPause={handleMainPlayPause}
        isMainPlaying={sequenceState.isPlaying}
      />

      {/* Element Selector */}
      <ElementSelector
        elements={elements}
        onElementSelect={handleElementSelect}
      />

      {/* Genre Selector */}
      <GenreSelector
        genres={genres}
        onGenreSelect={handleGenreSelect}
        onAddCustomGenre={addCustomGenre}
      />

      {/* Creative Direction */}
      <div className="px-4 mt-2">
        <label className="block text-sm text-gray-300 mb-1">Creative direction (optional)</label>
        <textarea
          value={extraPrompt}
          onChange={(e) => setExtraPrompt(e.target.value)}
          placeholder="Describe vibe, instruments, mood, references..."
          className="w-full h-20 resize-none rounded-lg bg-gray-800 border border-gray-700 focus:border-gray-600 outline-none p-3 text-sm text-white placeholder-gray-500"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 py-6">
        {currentWaveform.length > 0 ? (
          // Show waveform during recording
          <WaveformDisplay
            waveform={currentWaveform}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={0}
            onPlayPause={handleMainPlayPause}
            onSeek={handleMainSeek}
            onVolumeToggle={handleMainVolumeToggle}
            isMuted={isMuted}
            className="h-48"
          />
        ) : visibleClips.length > 0 ? (
          // Show track stack when we have clips
          <TrackStack
            clips={visibleClips}
            onPlayPause={handleClipPlayPause}
            onLoop={handleClipLoop}
            onEditTab={handleClipEditTab}
            onDelete={handleClipDelete}
            onSeek={handleClipSeek}
            onVolumeToggle={handleClipVolumeToggle}
            onVolumeAdjust={adjustClipVolume}
            onBpmAdjust={adjustClipBpm}
          />
        ) : (
          // Empty state
          <div className="flex items-center justify-center h-48 text-gray-500">
            <div className="text-center">
              <div className="text-lg mb-2 capitalize">No clips in {activePart?.name || 'this part'} yet</div>
              <div className="text-sm">Record or upload to generate for this section</div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 flex justify-center">
            <RecordingButton
              isRecording={recordingState.isRecording}
              isGenerating={recordingState.isGenerating}
              onToggleRecording={toggleRecording}
            />
          </div>
          <UploadAudioButton onFileSelected={(file) => generateFromFile(file)} />
        </div>

        <button
          onClick={currentId === 'outro' ? handleFinishSong : handleNextSongPart}
          disabled={recordingState.isGenerating}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-600 disabled:opacity-50 text-white rounded-full transition-colors font-medium capitalize flex items-center justify-center gap-2"
        >
          {recordingState.isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving Song...
            </>
          ) : (
            currentId === 'outro' ? 'Done' : `Go to ${nextLabel}`
          )}
        </button>
      </div>

      {/* Edit Modal */}
      <InlineEditPanel
        isOpen={editState.isOpen}
        onClose={handleInlineEditClose}
        onSave={handleInlineEditSave}
        selectedClip={editState.selectedClip}
        editMode={inlineEditMode}
      />
    </div>
  );
}