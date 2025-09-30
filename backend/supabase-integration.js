const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[WARN] Supabase credentials not found. Database operations will fail.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class SupabaseService {
  // Upload audio file to Supabase Storage
  static async uploadAudioFile(file, path) {
    try {
      const { data, error } = await supabase.storage
        .from('audio-files')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading to Supabase Storage:', error);
      throw error;
    }
  }

  // Get public URL for audio file
  static getAudioFileUrl(path) {
    const { data } = supabase.storage
      .from('audio-files')
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  // Save audio clip to database
  static async saveAudioClip(clipData) {
    try {
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
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving audio clip:', error);
      throw error;
    }
  }

  // Create a new project
  static async createProject(userId, name, bpm = 120, key = null) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name,
          bpm,
          key
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Get user's projects
  static async getUserProjects(userId) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user projects:', error);
      throw error;
    }
  }

  // Get project's audio clips
  static async getProjectClips(projectId) {
    try {
      const { data, error } = await supabase
        .from('audio_clips')
        .select(`
          *,
          audio_chops (*),
          audio_effects (*)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching project clips:', error);
      throw error;
    }
  }

  // Save audio effects
  static async saveAudioEffects(clipId, effects) {
    try {
      const { data, error } = await supabase
        .from('audio_effects')
        .upsert({
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
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving audio effects:', error);
      throw error;
    }
  }

  // Save audio chops
  static async saveAudioChops(clipId, chops) {
    try {
      const chopsData = chops.map(chop => ({
        clip_id: clipId,
        name: chop.name,
        start_time: chop.startTime,
        end_time: chop.endTime,
        storage_path: chop.storagePath || null
      }));

      const { data, error } = await supabase
        .from('audio_chops')
        .insert(chopsData)
        .select();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving audio chops:', error);
      throw error;
    }
  }

  // Delete audio file and database record
  static async deleteAudioClip(clipId) {
    try {
      // First get the clip to find the storage path
      const { data: clip, error: fetchError } = await supabase
        .from('audio_clips')
        .select('storage_path')
        .eq('id', clipId)
        .single();
      
      if (fetchError) throw fetchError;

      // Delete from storage
      if (clip.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('audio-files')
          .remove([clip.storage_path]);
        
        if (storageError) console.warn('Error deleting from storage:', storageError);
      }

      // Delete from database (cascades to chops and effects)
      const { error: dbError } = await supabase
        .from('audio_clips')
        .delete()
        .eq('id', clipId);
      
      if (dbError) throw dbError;
      
      return true;
    } catch (error) {
      console.error('Error deleting audio clip:', error);
      throw error;
    }
  }
}

module.exports = { SupabaseService };
