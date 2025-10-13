export interface Sora2VideoRequest {
  prompt: string;
  duration?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  style?: string;
}

export interface Sora2VideoResponse {
  videoUrl: string;
  taskId: string;
  duration: number;
  source?: string;
}

export class Sora2Service {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('🔧 [SORA2 SERVICE] Initialisé avec clé API:', !!apiKey);
  }

  async generateVideo(
    params: Sora2VideoRequest,
    onProgress?: (progress: number) => void
  ): Promise<Sora2VideoResponse> {
    console.log('🎬 [SORA2 SERVICE] Début génération:', {
      prompt: params.prompt.substring(0, 50) + '...',
      duration: params.duration || 10,
      aspectRatio: params.aspectRatio || '16:9'
    });

    if (!this.apiKey) {
      throw new Error('Clé API CometAPI manquante pour Sora-2');
    }

    if (onProgress) onProgress(10);

    try {
      const response = await fetch('/api/sora2-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          duration: params.duration || 10,
          aspect_ratio: params.aspectRatio || '16:9',
          style: params.style || 'realistic'
        })
      });

      console.log('📥 [SORA2 SERVICE] Réponse API:', {
        status: response.status,
        ok: response.ok
      });

      if (onProgress) onProgress(30);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ [SORA2 SERVICE] Erreur API:', errorData);
        throw new Error(
          errorData.error || errorData.details || `Erreur ${response.status}`
        );
      }

      if (onProgress) onProgress(50);

      const data = await response.json();
      console.log('📊 [SORA2 SERVICE] Données reçues:', {
        success: data.success,
        hasVideoUrl: !!data.videoUrl,
        taskId: data.taskId
      });

      if (!data.success || !data.videoUrl) {
        console.error('❌ [SORA2 SERVICE] Réponse invalide:', data);
        throw new Error(data.error || 'URL de vidéo non retournée');
      }

      if (onProgress) onProgress(100);

      console.log('✅ [SORA2 SERVICE] Vidéo générée:', data.videoUrl);

      const result: Sora2VideoResponse = {
        videoUrl: data.videoUrl,
        taskId: data.taskId || 'unknown',
        duration: params.duration || 10,
        source: 'sora-2-comet-api'
      };

      return result;

    } catch (error) {
      console.error('💥 [SORA2 SERVICE] Erreur:', error);

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Erreur inconnue lors de la génération Sora-2');
      }
    }
  }

  getDimensions(aspectRatio: string): { width: number; height: number } {
    return { width: 0, height: 0 };
  }
}

export const sora2Service = new Sora2Service(
  process.env.EXPO_PUBLIC_COMET_API_KEY || ''
);
