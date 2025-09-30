import { AudioClip } from '@/types';

export interface Song {
  id: string;
  name: string;
  bpm: number;
  key: string | null;
  duration: number;
  clips: AudioClip[];
  created_at: string;
  isPlaying: boolean;
}

export class LocalSongService {
  private static STORAGE_KEY = 'vibetune_songs';

  // Create a new song from clips
  static async createSong(
    userId: string,
    songName: string,
    clips: AudioClip[],
    bpm: number = 120,
    key?: string
  ): Promise<Song> {
    try {
      const song: Song = {
        id: Date.now().toString(),
        name: songName,
        bpm,
        key: key || null,
        duration: clips.reduce((total, clip) => total + clip.duration, 0),
        clips: clips.map(clip => ({ ...clip, isPlaying: false })),
        created_at: new Date().toISOString(),
        isPlaying: false
      };

      // Save to localStorage
      const existingSongs = this.getStoredSongs();
      const updatedSongs = [...existingSongs, song];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSongs));

      return song;
    } catch (error) {
      console.error('Failed to create song:', error);
      throw error;
    }
  }

  // Get all songs for a user
  static async getUserSongs(userId: string): Promise<Song[]> {
    try {
      return this.getStoredSongs();
    } catch (error) {
      console.error('Failed to get user songs:', error);
      throw error;
    }
  }

  // Get a specific song
  static async getSong(songId: string): Promise<Song | null> {
    try {
      const songs = this.getStoredSongs();
      return songs.find(song => song.id === songId) || null;
    } catch (error) {
      console.error('Failed to get song:', error);
      throw error;
    }
  }

  // Delete a song
  static async deleteSong(songId: string): Promise<void> {
    try {
      const songs = this.getStoredSongs();
      const updatedSongs = songs.filter(song => song.id !== songId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSongs));
    } catch (error) {
      console.error('Failed to delete song:', error);
      throw error;
    }
  }

  // Update song metadata
  static async updateSong(
    songId: string,
    updates: {
      name?: string;
      bpm?: number;
      key?: string;
    }
  ): Promise<void> {
    try {
      const songs = this.getStoredSongs();
      const updatedSongs = songs.map(song => 
        song.id === songId ? { ...song, ...updates } : song
      );
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSongs));
    } catch (error) {
      console.error('Failed to update song:', error);
      throw error;
    }
  }

  // Generate song name from clips
  static generateSongName(clips: AudioClip[]): string {
    const genres = [...new Set(clips.map(clip => clip.genre))];
    const elements = [...new Set(clips.map(clip => clip.element))];
    
    const genreName = genres[0] || 'Unknown';
    const elementName = elements[0] || 'Track';
    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    return `${genreName} ${elementName} - ${timestamp}`;
  }

  // Calculate total duration of clips
  static calculateTotalDuration(clips: AudioClip[]): number {
    return clips.reduce((total, clip) => total + clip.duration, 0);
  }

  // Get most common BPM from clips
  static getMostCommonBPM(clips: AudioClip[]): number {
    const bpmCounts = clips.reduce((counts, clip) => {
      const bpm = clip.bpm || 120;
      counts[bpm] = (counts[bpm] || 0) + 1;
      return counts;
    }, {} as Record<number, number>);
    
    const mostCommonBPM = Object.entries(bpmCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return mostCommonBPM ? parseInt(mostCommonBPM) : 120;
  }

  // Get most common key from clips
  static getMostCommonKey(clips: AudioClip[]): string | null {
    const keyCounts = clips.reduce((counts, clip) => {
      const key = clip.key;
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
      return counts;
    }, {} as Record<string, number>);
    
    const mostCommonKey = Object.entries(keyCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return mostCommonKey || null;
  }

  // Helper method to get stored songs
  static getStoredSongs(): Song[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse stored songs:', error);
      return [];
    }
  }
}
