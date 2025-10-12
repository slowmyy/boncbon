export interface Sora2VideoRequest {
  prompt: string;
  duration?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
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
      duration: params.duration || 5,
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
          duration: params.duration || 5,
          aspect_ratio: params.aspectRatio || '16:9'
        })
      });

      console.log('📥 [SORA2 SERVICE] Réponse API:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (onProgress) onProgress(30);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ [SORA2 SERVICE] Erreur API:', errorData);

        throw new Error(
          errorData.error ||
          errorData.details ||
          `Erreur lors de la génération Sora-2 (${response.status})`
        );
      }

      if (onProgress) onProgress(50);

      const responseText = await response.text();
      console.log('📝 [SORA2 SERVICE] Réponse brute:', responseText.substring(0, 500));

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ [SORA2 SERVICE] Erreur parsing JSON:', parseError);
        throw new Error('Réponse invalide du serveur Sora-2');
      }

      console.log('📊 [SORA2 SERVICE] Données reçues:', {
        topLevelKeys: Object.keys(data),
        hasVideoUrl: !!data.videoUrl,
        hasVideoURL: !!data.videoURL,
        hasUrl: !!data.url
      });

      let finalVideoUrl: string | null = null;

      if (data.videoUrl && typeof data.videoUrl === 'string') {
        finalVideoUrl = data.videoUrl;
      } else if (data.videoURL && typeof data.videoURL === 'string') {
        finalVideoUrl = data.videoURL;
      } else if (data.url && typeof data.url === 'string') {
        finalVideoUrl = data.url;
      } else if (data.video_url && typeof data.video_url === 'string') {
        finalVideoUrl = data.video_url;
      }

      if (!finalVideoUrl || !finalVideoUrl.startsWith('http')) {
        console.error('❌ [SORA2 SERVICE] Aucune URL valide:', JSON.stringify(data, null, 2));
        throw new Error('URL de vidéo manquante ou invalide');
      }

      console.log('✅ [SORA2 SERVICE] URL extraite:', finalVideoUrl);

      if (onProgress) onProgress(100);

      const result: Sora2VideoResponse = {
        videoUrl: finalVideoUrl,
        taskId: data.taskId || 'unknown',
        duration: params.duration || 5,
        source: data.source
      };

      console.log('🎉 [SORA2 SERVICE] Retour du résultat:', {
        videoUrl: result.videoUrl.substring(0, 100) + '...',
        taskId: result.taskId,
        duration: result.duration,
        source: result.source
      });

      return result;

    } catch (error) {
      console.error('💥 [SORA2 SERVICE] Erreur complète:', error);

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Erreur inconnue lors de la génération Sora-2');
      }
    }
  }

  getDimensions(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '16:9':
        return { width: 1280, height: 720 };
      case '9:16':
        return { width: 720, height: 1280 };
      case '1:1':
        return { width: 1024, height: 1024 };
      default:
        return { width: 1280, height: 720 };
    }
  }
}

export const sora2Service = new Sora2Service(
  process.env.EXPO_PUBLIC_COMET_API_KEY || ''
);
