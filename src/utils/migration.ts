import { DatabaseService } from '@/services/DatabaseService'
import { AudioClip } from '@/types'

export class MigrationHelper {
  // Migrate localStorage data to Supabase
  static async migrateFromLocalStorage(userId: string, projectName: string = 'Migrated Project') {
    try {
      // Get clips from localStorage
      const clipsData = localStorage.getItem('clips')
      if (!clipsData) {
        console.log('No clips found in localStorage')
        return
      }

      const clips: AudioClip[] = JSON.parse(clipsData)
      if (clips.length === 0) {
        console.log('No clips to migrate')
        return
      }

      // Create a new project
      const project = await DatabaseService.createProject(userId, projectName)
      console.log('Created project:', project.id)

      // Migrate each clip
      for (const clip of clips) {
        try {
          // Download the audio file from the current URL
          const response = await fetch(clip.audioUrl)
          const audioBlob = await response.blob()
          const audioFile = new File([audioBlob], `clip-${clip.id}.mp3`, { type: 'audio/mpeg' })

          // Create storage path
          const storagePath = `projects/${project.id}/clips/${clip.id}.mp3`

          // Upload to Supabase Storage
          const uploadResult = await DatabaseService.uploadAudioFile(audioFile, storagePath)
          const storageUrl = DatabaseService.getAudioFileUrl(storagePath)

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
          })

          // Migrate chops if they exist
          if (clip.chops && clip.chops.length > 0) {
            await DatabaseService.createAudioChops(dbClip.id, clip.chops)
          }

          // Migrate effects if they exist
          if (clip.effects) {
            await DatabaseService.createAudioEffects(dbClip.id, clip.effects)
          }

          console.log(`Migrated clip: ${clip.id}`)
        } catch (error) {
          console.error(`Failed to migrate clip ${clip.id}:`, error)
        }
      }

      console.log('Migration completed successfully!')
      return project
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }

  // Clear localStorage after successful migration
  static clearLocalStorage() {
    localStorage.removeItem('clips')
    localStorage.removeItem('editingClip')
    console.log('LocalStorage cleared')
  }

  // Get migration status
  static getMigrationStatus() {
    const clipsData = localStorage.getItem('clips')
    const hasClips = clipsData && JSON.parse(clipsData).length > 0
    const hasEditingClip = localStorage.getItem('editingClip')
    
    return {
      hasClips,
      hasEditingClip: !!hasEditingClip,
      needsMigration: hasClips || hasEditingClip
    }
  }
}
