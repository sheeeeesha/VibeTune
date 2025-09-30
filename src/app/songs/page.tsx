'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, MoreVertical, Share, Trash2, Plus, ArrowLeft, Edit, Edit3 } from 'lucide-react';
import { LocalSongService } from '@/services/LocalSongService';
import { AudioClip } from '@/types';

interface Song {
  id: string;
  name: string;
  bpm: number;
  key: string | null;
  duration: number;
  clips: AudioClip[];
  created_at: string;
  isPlaying: boolean;
}

export default function SongsPage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<{ [songId: string]: number }>({});
  const [renamingSongId, setRenamingSongId] = useState<string | null>(null);
  const [newSongName, setNewSongName] = useState<string>('');

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      // For now, we'll use a mock user ID - in a real app, this would come from auth
      const userId = 'mock-user-id';
      const songs = await LocalSongService.getUserSongs(userId);
      setSongs(songs);
    } catch (error) {
      console.error('Failed to load songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = async (songId: string) => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }

    if (playingSongId === songId) {
      // Pause current song
      setPlayingSongId(null);
    } else {
      // Play new song
      try {
        // Create a combined audio from all clips
        const audioBlob = await createCombinedAudio(song.clips);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.addEventListener('timeupdate', () => {
          const progress = (audio.currentTime / audio.duration) * 100;
          setPlaybackProgress(prev => ({ ...prev, [songId]: progress }));
        });

        audio.addEventListener('ended', () => {
          setPlayingSongId(null);
          setCurrentAudio(null);
          setPlaybackProgress(prev => ({ ...prev, [songId]: 0 }));
        });

        await audio.play();
        setCurrentAudio(audio);
        setPlayingSongId(songId);
      } catch (error) {
        console.error('Failed to play song:', error);
        // Fallback: just show visual feedback
        setPlayingSongId(songId);
      }
    }
  };

  // Create combined audio from clips using actual audio data
  const createCombinedAudio = async (clips: AudioClip[]): Promise<Blob> => {
    if (clips.length === 0) {
      // Return empty audio if no clips
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
      const wavBuffer = bufferToWav(buffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      
      // Calculate total duration
      const totalDuration = clips.reduce((total, clip) => total + clip.duration, 0);
      const totalLength = Math.floor(sampleRate * totalDuration);
      
      // Create a buffer for the combined audio
      const combinedBuffer = audioContext.createBuffer(1, totalLength, sampleRate);
      const combinedChannelData = combinedBuffer.getChannelData(0);
      
      let currentOffset = 0;
      
      // Process each clip
      for (const clip of clips) {
        if (clip.audioUrl) {
          try {
            // Load the audio file
            const response = await fetch(clip.audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get the audio data
            const sourceData = audioBuffer.getChannelData(0);
            const clipLength = Math.min(sourceData.length, Math.floor(sampleRate * clip.duration));
            
            // Copy the audio data to the combined buffer
            for (let i = 0; i < clipLength && currentOffset + i < totalLength; i++) {
              combinedChannelData[currentOffset + i] = sourceData[i];
            }
            
            currentOffset += clipLength;
          } catch (error) {
            console.warn(`Failed to load audio for clip ${clip.id}:`, error);
            // Skip this clip and continue
            currentOffset += Math.floor(sampleRate * clip.duration);
          }
        } else {
          // Skip clips without audio URLs
          currentOffset += Math.floor(sampleRate * clip.duration);
        }
      }
      
      // Convert to WAV
      const wavBuffer = bufferToWav(combinedBuffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('Failed to create combined audio:', error);
      // Fallback: create a simple tone
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = clips.reduce((total, clip) => total + clip.duration, 0);
      const length = sampleRate * duration;
      
      const buffer = audioContext.createBuffer(1, length, sampleRate);
      const channelData = buffer.getChannelData(0);
      
      // Generate a simple tone for demonstration
      for (let i = 0; i < length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.1;
      }
      
      const wavBuffer = bufferToWav(buffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    }
  };

  // Simple WAV encoder
  const bufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return arrayBuffer;
  };

  const handleDelete = async (songId: string) => {
    if (confirm('Are you sure you want to delete this song?')) {
      try {
        await LocalSongService.deleteSong(songId);
        setSongs(prev => prev.filter(song => song.id !== songId));
        setShowContextMenu(null);
      } catch (error) {
        console.error('Failed to delete song:', error);
      }
    }
  };

  const handleEdit = (song: Song) => {
    // Store song data in localStorage for the main page to load
    localStorage.setItem('editingSong', JSON.stringify(song));
    // Navigate to main page
    router.push('/');
  };

  const handleRename = (song: Song) => {
    setRenamingSongId(song.id);
    setNewSongName(song.name);
    setShowContextMenu(null);
  };

  const handleRenameSubmit = async () => {
    if (!renamingSongId || !newSongName.trim()) return;

    try {
      // Update the song name in localStorage
      const existingSongs = LocalSongService.getStoredSongs();
      const updatedSongs = existingSongs.map(song => 
        song.id === renamingSongId 
          ? { ...song, name: newSongName.trim() }
          : song
      );
      localStorage.setItem(LocalSongService.STORAGE_KEY, JSON.stringify(updatedSongs));
      
      // Update local state
      setSongs(prev => prev.map(song => 
        song.id === renamingSongId 
          ? { ...song, name: newSongName.trim() }
          : song
      ));
      
      setRenamingSongId(null);
      setNewSongName('');
    } catch (error) {
      console.error('Failed to rename song:', error);
      alert('Failed to rename song. Please try again.');
    }
  };

  const handleRenameCancel = () => {
    setRenamingSongId(null);
    setNewSongName('');
  };

  const handleShare = async (song: Song) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: song.name,
          text: `Check out my song "${song.name}" created with VibeTune!`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `Check out my song "${song.name}" created with VibeTune! ${window.location.href}`
        );
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <div className="text-lg">Loading your songs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">My Songs</h1>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Song
        </button>
      </div>

      {/* Songs List */}
      <div className="p-4">
        {songs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-xl font-medium mb-2">No songs yet</h2>
            <p className="text-gray-400 mb-6">Create your first song to get started</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Create New Song
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {songs.map((song) => (
              <div
                key={song.id}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Play Button */}
                  <button
                    onClick={() => handlePlayPause(song.id)}
                    className="w-12 h-12 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    {playingSongId === song.id ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </button>

                  {/* Waveform */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {renamingSongId === song.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={newSongName}
                            onChange={(e) => setNewSongName(e.target.value)}
                            className="bg-gray-700 text-white px-2 py-1 rounded text-lg font-medium flex-1 min-w-0"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSubmit();
                              } else if (e.key === 'Escape') {
                                handleRenameCancel();
                              }
                            }}
                          />
                          <button
                            onClick={handleRenameSubmit}
                            className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleRenameCancel}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-lg font-medium text-white truncate">
                          {song.name}
                        </h3>
                      )}
                      <span className="text-sm text-gray-400">
                        {song.bpm} bpm {song.key && song.key}
                      </span>
                    </div>
                    
                    {/* Waveform Visualization */}
                    <div className="relative h-8 bg-gray-800 rounded-lg overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-end justify-center h-6 gap-px">
                          {Array.from({ length: 60 }).map((_, index) => (
                            <div
                              key={index}
                              className="bg-white rounded-sm"
                              style={{
                                width: '2px',
                                height: `${Math.random() * 12 + 2}px`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Playhead */}
                      {playingSongId === song.id && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" 
                             style={{ left: `${playbackProgress[song.id] || 0}%` }} />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
                      <span>{formatDuration(song.duration)}</span>
                      <span>{formatDate(song.created_at)}</span>
                    </div>
                  </div>

                  {/* Context Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowContextMenu(showContextMenu === song.id ? null : song.id)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {showContextMenu === song.id && (
                      <div className="absolute right-0 top-12 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                        <button
                          onClick={() => {
                            handleEdit(song);
                            setShowContextMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleRename(song)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleShare(song)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-sm"
                        >
                          <Share className="w-4 h-4" />
                          Share
                        </button>
                        <button
                          onClick={() => handleDelete(song.id)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-sm text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close context menu */}
      {showContextMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowContextMenu(null)}
        />
      )}
    </div>
  );
}
