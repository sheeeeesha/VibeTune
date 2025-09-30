import { supabase } from '@/lib/supabase'
import { AudioClip, AudioChop, AudioEffects } from '@/types'
import type { Tables, Inserts, Updates } from '@/lib/supabase'

export class DatabaseService {
  // User management
  static async createUser(email: string, username: string) {
    const { data, error } = await supabase
      .from('users')
      .insert({ email, username })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  }

  // Project management
  static async createProject(userId: string, name: string, bpm: number = 120, key?: string) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name, bpm, key })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getProjects(userId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  }

  static async updateProject(projectId: string, updates: Partial<Updates<'projects'>>) {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async deleteProject(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    
    if (error) throw error
  }

  // Audio clip management
  static async createAudioClip(clipData: {
    projectId: string
    songPart: string
    element: string
    genre: string
    storagePath: string
    storageUrl: string
    waveform: number[]
    duration: number
    bpm?: number
    detectedKey?: string
    volume?: number
    isLooping?: boolean
  }) {
    const { data, error } = await supabase
      .from('audio_clips')
      .insert({
        project_id: clipData.projectId,
        song_part: clipData.songPart,
        element: clipData.element,
        genre: clipData.genre,
        storage_path: clipData.storagePath,
        storage_url: clipData.storageUrl,
        waveform_data: clipData.waveform,
        duration: clipData.duration,
        bpm: clipData.bpm,
        detected_key: clipData.detectedKey,
        volume: clipData.volume || 1.0,
        is_looping: clipData.isLooping || true
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getAudioClips(projectId: string) {
    const { data, error } = await supabase
      .from('audio_clips')
      .select(`
        *,
        audio_chops (*),
        audio_effects (*)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data
  }

  static async updateAudioClip(clipId: string, updates: Partial<Updates<'audio_clips'>>) {
    const { data, error } = await supabase
      .from('audio_clips')
      .update(updates)
      .eq('id', clipId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async deleteAudioClip(clipId: string) {
    const { error } = await supabase
      .from('audio_clips')
      .delete()
      .eq('id', clipId)
    
    if (error) throw error
  }

  // Audio chops management
  static async createAudioChops(clipId: string, chops: Omit<AudioChop, 'id'>[]) {
    const chopsData = chops.map(chop => ({
      clip_id: clipId,
      name: chop.name,
      start_time: chop.startTime,
      end_time: chop.endTime,
      storage_path: chop.audioBuffer ? `chops/${clipId}/${chop.name}.mp3` : null
    }))

    const { data, error } = await supabase
      .from('audio_chops')
      .insert(chopsData)
      .select()
    
    if (error) throw error
    return data
  }

  static async getAudioChops(clipId: string) {
    const { data, error } = await supabase
      .from('audio_chops')
      .select('*')
      .eq('clip_id', clipId)
      .order('start_time', { ascending: true })
    
    if (error) throw error
    return data
  }

  // Audio effects management
  static async createAudioEffects(clipId: string, effects: AudioEffects) {
    const { data, error } = await supabase
      .from('audio_effects')
      .insert({
        clip_id: clipId,
        reverb_enabled: effects.reverb.enabled,
        reverb_amount: effects.reverb.amount,
        delay_enabled: effects.delay.enabled,
        delay_time: effects.delay.time,
        delay_feedback: effects.delay.feedback,
        filter_enabled: effects.filter.enabled,
        filter_frequency: effects.filter.frequency,
        filter_type: effects.filter.type,
        distortion_enabled: effects.distortion.enabled,
        distortion_amount: effects.distortion.amount,
        compression_enabled: effects.compression.enabled,
        compression_threshold: effects.compression.threshold,
        compression_ratio: effects.compression.ratio
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateAudioEffects(clipId: string, effects: AudioEffects) {
    const { data, error } = await supabase
      .from('audio_effects')
      .update({
        reverb_enabled: effects.reverb.enabled,
        reverb_amount: effects.reverb.amount,
        delay_enabled: effects.delay.enabled,
        delay_time: effects.delay.time,
        delay_feedback: effects.delay.feedback,
        filter_enabled: effects.filter.enabled,
        filter_frequency: effects.filter.frequency,
        filter_type: effects.filter.type,
        distortion_enabled: effects.distortion.enabled,
        distortion_amount: effects.distortion.amount,
        compression_enabled: effects.compression.enabled,
        compression_threshold: effects.compression.threshold,
        compression_ratio: effects.compression.ratio,
        updated_at: new Date().toISOString()
      })
      .eq('clip_id', clipId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getAudioEffects(clipId: string) {
    const { data, error } = await supabase
      .from('audio_effects')
      .select('*')
      .eq('clip_id', clipId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found
    return data
  }

  // Storage management
  static async uploadAudioFile(file: File, path: string) {
    const { data, error } = await supabase.storage
      .from('audio-files')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) throw error
    return data
  }

  static async getAudioFileUrl(path: string) {
    const { data } = supabase.storage
      .from('audio-files')
      .getPublicUrl(path)
    
    return data.publicUrl
  }

  static async deleteAudioFile(path: string) {
    const { error } = await supabase.storage
      .from('audio-files')
      .remove([path])
    
    if (error) throw error
  }

  // Convert database types to app types
  static convertToAudioClip(dbClip: Tables<'audio_clips'> & {
    audio_chops?: Tables<'audio_chops'>[]
    audio_effects?: Tables<'audio_effects'>
  }): AudioClip {
    return {
      id: dbClip.id,
      songPart: dbClip.song_part,
      element: dbClip.element,
      genre: dbClip.genre,
      audioUrl: dbClip.storage_url,
      waveform: dbClip.waveform_data,
      duration: dbClip.duration,
      isPlaying: false,
      isLooping: dbClip.is_looping,
      createdAt: new Date(dbClip.created_at),
      volume: dbClip.volume,
      bpm: dbClip.bpm,
      key: dbClip.detected_key,
      chops: dbClip.audio_chops?.map(chop => ({
        id: chop.id,
        startTime: chop.start_time,
        endTime: chop.end_time,
        name: chop.name,
        audioBuffer: undefined // Will be loaded when needed
      })),
      effects: dbClip.audio_effects ? {
        reverb: {
          enabled: dbClip.audio_effects.reverb_enabled,
          amount: dbClip.audio_effects.reverb_amount
        },
        delay: {
          enabled: dbClip.audio_effects.delay_enabled,
          time: dbClip.audio_effects.delay_time,
          feedback: dbClip.audio_effects.delay_feedback
        },
        filter: {
          enabled: dbClip.audio_effects.filter_enabled,
          frequency: dbClip.audio_effects.filter_frequency,
          type: dbClip.audio_effects.filter_type as 'lowpass' | 'highpass' | 'bandpass'
        },
        distortion: {
          enabled: dbClip.audio_effects.distortion_enabled,
          amount: dbClip.audio_effects.distortion_amount
        },
        compression: {
          enabled: dbClip.audio_effects.compression_enabled,
          threshold: dbClip.audio_effects.compression_threshold,
          ratio: dbClip.audio_effects.compression_ratio
        }
      } : undefined
    }
  }
}
