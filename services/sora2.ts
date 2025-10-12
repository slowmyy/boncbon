export interface Sora2VideoRequest {
  prompt: string;
  duration?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface Sora2VideoResponse {
  videoUrl: string;
  taskId: string;
  duration: number;
}

export class Sora2Service {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateVideo(
    params: Sora2VideoRequest,
    onProgress?: (progress: number) => void
  ): Promise<Sora2VideoResponse> {
    console.log('🎬 [SORA2] Début génération:', {
      prompt: params.prompt.substring(0, 50) + '...',
      duration: params.duration || 5,
      aspectRatio: params.aspectRatio || '16:9'
    });

    if (onProgress) onProgress(10);

    const response = await fetch('/api/sora2-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.duration || 5,
        aspect_ratio: params.aspectRatio || '16:9'
      })
    });

    if (onProgress) onProgress(30);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [SORA2] Erreur API:', errorData);
      throw new Error(errorData.error || 'Erreur lors de la génération Sora-2');
    }

    if (onProgress) onProgress(50);

    const data = await response.json();

    if (!data.videoUrl) {
      throw new Error('Aucune URL de vidéo retournée');
    }

    if (onProgress) onProgress(100);

    console.log('✅ [SORA2] Vidéo générée:', data.videoUrl);

    return {
      videoUrl: data.videoUrl,
      taskId: data.taskId || 'unknown',
      duration: params.duration || 5
    };
  }

  getDimensions(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '16:9':
        return { width: 1920, height: 1080 };
      case '9:16':
        return { width: 1080, height: 1920 };
      case '1:1':
        return { width: 1080, height: 1080 };
      default:
        return { width: 1920, height: 1080 };
    }
  }
}

export const sora2Service = new Sora2Service(
  process.env.EXPO_PUBLIC_COMET_API_KEY || ''
);
