import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          username: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          bpm: number
          key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          bpm?: number
          key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          bpm?: number
          key?: string | null
          updated_at?: string
        }
      }
      audio_clips: {
        Row: {
          id: string
          project_id: string
          song_part: string
          element: string
          genre: string
          storage_path: string
          storage_url: string
          waveform_data: number[]
          duration: number
          bpm: number | null
          detected_key: string | null
          volume: number
          is_looping: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          song_part: string
          element: string
          genre: string
          storage_path: string
          storage_url: string
          waveform_data: number[]
          duration: number
          bpm?: number | null
          detected_key?: string | null
          volume?: number
          is_looping?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          song_part?: string
          element?: string
          genre?: string
          storage_path?: string
          storage_url?: string
          waveform_data?: number[]
          duration?: number
          bpm?: number | null
          detected_key?: string | null
          volume?: number
          is_looping?: boolean
        }
      }
      audio_chops: {
        Row: {
          id: string
          clip_id: string
          name: string
          start_time: number
          end_time: number
          storage_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          name: string
          start_time: number
          end_time: number
          storage_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          name?: string
          start_time?: number
          end_time?: number
          storage_path?: string | null
        }
      }
      audio_effects: {
        Row: {
          id: string
          clip_id: string
          reverb_enabled: boolean
          reverb_amount: number
          delay_enabled: boolean
          delay_time: number
          delay_feedback: number
          filter_enabled: boolean
          filter_frequency: number
          filter_type: string
          distortion_enabled: boolean
          distortion_amount: number
          compression_enabled: boolean
          compression_threshold: number
          compression_ratio: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          reverb_enabled?: boolean
          reverb_amount?: number
          delay_enabled?: boolean
          delay_time?: number
          delay_feedback?: number
          filter_enabled?: boolean
          filter_frequency?: number
          filter_type?: string
          distortion_enabled?: boolean
          distortion_amount?: number
          compression_enabled?: boolean
          compression_threshold?: number
          compression_ratio?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          reverb_enabled?: boolean
          reverb_amount?: number
          delay_enabled?: boolean
          delay_time?: number
          delay_feedback?: number
          filter_enabled?: boolean
          filter_frequency?: number
          filter_type?: string
          distortion_enabled?: boolean
          distortion_amount?: number
          compression_enabled?: boolean
          compression_threshold?: number
          compression_ratio?: number
          updated_at?: string
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
