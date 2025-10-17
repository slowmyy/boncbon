export interface Sora2VideoRequest {
  prompt: string;
  duration?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface Sora2VideoResponse {
  videoUrl: string;
  taskId: string;
  duration: number;
  source: string;
}

export class Sora2Service {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    if (!apiKey) {
      console.warn('⚠️ [SORA2] Clé API CometAPI manquante');
    } else {
      console.log('✅ [SORA2] Service initialisé');
    }
  }

  async generateVideo(
    params: Sora2VideoRequest,
    onProgress?: (progress: number) => void
  ): Promise<Sora2VideoResponse> {

    if (!this.apiKey) {
      throw new Error('Clé API CometAPI manquante. Ajoutez EXPO_PUBLIC_COMET_API_KEY dans votre .env');
    }

    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new Error('Le prompt ne peut pas être vide');
    }

    const duration = params.duration || 10;
    const aspectRatio = params.aspectRatio || '16:9';

    console.log('🎬 [SORA2] Début génération:', {
      prompt: params.prompt.substring(0, 80) + '...',
      duration,
      aspectRatio
    });

    if (onProgress) onProgress(10);

    try {
      const requestBody = {
        model: 'sora-2',
        messages: [
          {
            role: 'user',
            content: `${params.prompt}. Duration: ${duration}s. Aspect ratio: ${aspectRatio}`
          }
        ],
        stream: false,
        max_tokens: 500
      };

      console.log('📡 [SORA2] Envoi requête à CometAPI...');

      if (onProgress) onProgress(20);

      const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [SORA2] Erreur API:', errorText);
        throw new Error(`CometAPI error ${response.status}: ${errorText}`);
      }

      if (onProgress) onProgress(40);

      const data = await response.json();
      console.log('📊 [SORA2] Réponse CometAPI reçue');

      if (onProgress) onProgress(60);

      const statusUrl = data.links?.source || data.source;

      if (statusUrl) {
        console.log('🔗 [SORA2] Status URL trouvée, polling...');
        const videoUrl = await this.pollStatusUrl(statusUrl, onProgress);

        return {
          videoUrl: videoUrl,
          taskId: data.id || `sora2-${Date.now()}`,
          duration: duration,
          source: 'sora-2-comet-api'
        };
      }

      const content = data.choices?.[0]?.message?.content;
      if (content && typeof content === 'string') {
        const mp4Match = content.match(/https?:\/\/[^\s"]+\.mp4/);
        if (mp4Match) {
          const videoUrl = mp4Match[0].replace(/[,;)\]}>]+$/, '').trim();
          console.log('✅ [SORA2] Vidéo trouvée directement:', videoUrl);

          if (onProgress) onProgress(100);

          return {
            videoUrl: videoUrl,
            taskId: data.id || `sora2-${Date.now()}`,
            duration: duration,
            source: 'sora-2-comet-api'
          };
        }
      }

      throw new Error('Aucune vidéo ni lien de status trouvé dans la réponse');

    } catch (error) {
      console.error('💥 [SORA2] Erreur génération:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Erreur inconnue lors de la génération Sora-2');
    }
  }

  private async pollStatusUrl(
    statusUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {

    let attempts = 0;
    const maxAttempts = 120;
    const pollInterval = 5000;

    console.log('⏳ [SORA2] Début polling (max 10 minutes)');

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const statusRes = await fetch(statusUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': '*/*'
          }
        });

        if (statusRes.ok) {
          const text = await statusRes.text();

          if (attempts % 10 === 0) {
            console.log(`🔄 [SORA2] Polling... ${attempts}/${maxAttempts}`);
          }

          const patterns = [
            /High-quality video generated[\s\S]*?(https?:\/\/[^\s\]"<]+\.mp4)/i,
            /https?:\/\/[^\s\]"<]+\.mp4/i,
            /(?:video_url|videoUrl)["']?\s*:\s*["']?(https?:\/\/[^\s"']+\.mp4)/i
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              const rawUrl = match[1] || match[0];
              const videoUrl = rawUrl.replace(/[,;)\]}>]+$/, '').trim();

              if (videoUrl.startsWith('http') && videoUrl.includes('.mp4')) {
                console.log('✅ [SORA2] Vidéo trouvée:', videoUrl);
                if (onProgress) onProgress(100);
                return videoUrl;
              }
            }
          }
        } else {
          console.warn(`⚠️ [SORA2] Status ${statusRes.status} (continue...)`);
        }

        const progress = 60 + (attempts / maxAttempts) * 35;
        if (onProgress) onProgress(Math.min(95, progress));

      } catch (pollError) {
        if (attempts % 20 === 0) {
          console.warn('⚠️ [SORA2] Erreur polling (continue):', pollError);
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout: vidéo non récupérée après 10 minutes');
  }

  getDimensions(aspectRatio: '16:9' | '9:16' | '1:1'): { width: number; height: number } {
    const dimensions = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1024, height: 1024 }
    };
    return dimensions[aspectRatio];
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }
}

export const sora2Service = new Sora2Service(
  process.env.EXPO_PUBLIC_COMET_API_KEY || ''
);
