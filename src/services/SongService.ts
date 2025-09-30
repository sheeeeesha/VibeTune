import { DatabaseService } from './DatabaseService';
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

export class SongService {
  // Create a new song from clips
  static async createSong(
    userId: string,
    songName: string,
    clips: AudioClip[],
    bpm: number = 120,
    key?: string
  ): Promise<Song> {
    try {
      // Create project
      const project = await DatabaseService.createProject(userId, songName, bpm, key);
      
      // Upload clips to storage and save to database
      const uploadedClips = await Promise.all(
        clips.map(async (clip) => {
          // Download the audio file
          const response = await fetch(clip.audioUrl);
          const audioBlob = await response.blob();
          const audioFile = new File([audioBlob], `clip-${clip.id}.mp3`, { type: 'audio/mpeg' });
          
          // Create storage path
          const storagePath = `projects/${project.id}/clips/${clip.id}.mp3`;
          
          // Upload to Supabase Storage
          await DatabaseService.uploadAudioFile(audioFile, storagePath);
          const storageUrl = DatabaseService.getAudioFileUrl(storagePath);
          
          // Save to database
          const dbClip = await DatabaseService.createAudioClip({
            projectId: project.id,
            songPart: clip.songPart,
            element: clip.element,
            genre: clip.genre,
            storagePath,
            storageUrl,
            waveform: clip.waveform,
            duration: clip.duration,
            bpm: clip.bpm,
            detectedKey: clip.key,
            volume: clip.volume,
            isLooping: clip.isLooping
          });
          
          // Save chops if they exist
          if (clip.chops && clip.chops.length > 0) {
            await DatabaseService.createAudioChops(dbClip.id, clip.chops);
          }
          
          // Save effects if they exist
          if (clip.effects) {
            await DatabaseService.createAudioEffects(dbClip.id, clip.effects);
          }
          
          return DatabaseService.convertToAudioClip(dbClip);
        })
      );
      
      return {
        id: project.id,
        name: project.name,
        bpm: project.bpm,
        key: project.key,
        duration: uploadedClips.reduce((total, clip) => total + clip.duration, 0),
        clips: uploadedClips,
        created_at: project.created_at,
        isPlaying: false
      };
    } catch (error) {
      console.error('Failed to create song:', error);
      throw error;
    }
  }

  // Get all songs for a user
  static async getUserSongs(userId: string): Promise<Song[]> {
    try {
      const projects = await DatabaseService.getProjects(userId);
      
      const songsWithClips = await Promise.all(
        projects.map(async (project) => {
          const clips = await DatabaseService.getAudioClips(project.id);
          return {
            id: project.id,
            name: project.name,
            bpm: project.bpm,
            key: project.key,
            duration: clips.reduce((total, clip) => total + clip.duration, 0),
            clips: clips.map(clip => DatabaseService.convertToAudioClip(clip)),
            created_at: project.created_at,
            isPlaying: false
          };
        })
      );
      
      return songsWithClips;
    } catch (error) {
      console.error('Failed to get user songs:', error);
      throw error;
    }
  }

  // Get a specific song
  static async getSong(songId: string): Promise<Song | null> {
    try {
      const clips = await DatabaseService.getAudioClips(songId);
      if (clips.length === 0) return null;
      
      // Get project info from first clip
      const project = await DatabaseService.getProjects('').then(projects => 
        projects.find(p => p.id === songId)
      );
      
      if (!project) return null;
      
      return {
        id: project.id,
        name: project.name,
        bpm: project.bpm,
        key: project.key,
        duration: clips.reduce((total, clip) => total + clip.duration, 0),
        clips: clips.map(clip => DatabaseService.convertToAudioClip(clip)),
        created_at: project.created_at,
        isPlaying: false
      };
    } catch (error) {
      console.error('Failed to get song:', error);
      throw error;
    }
  }

  // Delete a song
  static async deleteSong(songId: string): Promise<void> {
    try {
      await DatabaseService.deleteProject(songId);
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
      await DatabaseService.updateProject(songId, updates);
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
}
