import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface VideoMetadata {
  prompt: string;
  model: string;
  duration: number;
  width: number;
  height: number;
  metadata?: Record<string, any>;
}

export interface StoredVideo {
  id: string;
  prompt: string;
  model: string;
  duration: number;
  width: number;
  height: number;
  storage_path: string;
  public_url: string;
  created_at: string;
  metadata?: Record<string, any>;
}

class SupabaseVideoStorage {
  async uploadVideoFromUrl(videoUrl: string, metadata: VideoMetadata): Promise<StoredVideo> {
    console.log('📤 [SUPABASE] Upload vidéo depuis URL:', videoUrl.substring(0, 100));

    try {
      const response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('📦 [SUPABASE] Blob récupéré:', blob.size, 'bytes');

      const filename = `sora2-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;
      const filePath = `${filename}`;

      console.log('⬆️ [SUPABASE] Upload vers storage:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, blob, {
          contentType: 'video/mp4',
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ [SUPABASE] Erreur upload:', uploadError);
        throw uploadError;
      }

      console.log('✅ [SUPABASE] Upload réussi:', uploadData.path);

      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('🔗 [SUPABASE] URL publique:', publicUrl);

      const { data: videoRecord, error: dbError } = await supabase
        .from('videos')
        .insert({
          prompt: metadata.prompt,
          model: metadata.model,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          storage_path: filePath,
          public_url: publicUrl,
          metadata: metadata.metadata || {}
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ [SUPABASE] Erreur DB:', dbError);
        await supabase.storage.from('videos').remove([filePath]);
        throw dbError;
      }

      console.log('✅ [SUPABASE] Vidéo enregistrée en DB:', videoRecord.id);

      return videoRecord as StoredVideo;
    } catch (error) {
      console.error('💥 [SUPABASE] Erreur complète:', error);
      throw error;
    }
  }

  async getAllVideos(): Promise<StoredVideo[]> {
    console.log('📥 [SUPABASE] Récupération de toutes les vidéos');

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ [SUPABASE] Erreur récupération:', error);
        throw error;
      }

      console.log('✅ [SUPABASE] Vidéos récupérées:', data?.length || 0);
      return (data || []) as StoredVideo[];
    } catch (error) {
      console.error('💥 [SUPABASE] Erreur getAllVideos:', error);
      return [];
    }
  }

  async deleteVideo(id: string): Promise<void> {
    console.log('🗑️ [SUPABASE] Suppression vidéo:', id);

    try {
      const { data: video, error: fetchError } = await supabase
        .from('videos')
        .select('storage_path')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ [SUPABASE] Erreur récupération vidéo:', fetchError);
        throw fetchError;
      }

      if (video?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([video.storage_path]);

        if (storageError) {
          console.warn('⚠️ [SUPABASE] Erreur suppression storage:', storageError);
        }
      }

      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('❌ [SUPABASE] Erreur suppression DB:', deleteError);
        throw deleteError;
      }

      console.log('✅ [SUPABASE] Vidéo supprimée');
    } catch (error) {
      console.error('💥 [SUPABASE] Erreur deleteVideo:', error);
      throw error;
    }
  }

  async clearAllVideos(): Promise<void> {
    console.log('🧹 [SUPABASE] Nettoyage de toutes les vidéos');

    try {
      const videos = await this.getAllVideos();

      for (const video of videos) {
        if (video.storage_path) {
          await supabase.storage
            .from('videos')
            .remove([video.storage_path]);
        }
      }

      const { error } = await supabase
        .from('videos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error('❌ [SUPABASE] Erreur nettoyage:', error);
        throw error;
      }

      console.log('✅ [SUPABASE] Toutes les vidéos supprimées');
    } catch (error) {
      console.error('💥 [SUPABASE] Erreur clearAllVideos:', error);
      throw error;
    }
  }
}

export const supabaseVideoStorage = new SupabaseVideoStorage();
