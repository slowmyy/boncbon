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
    console.log('🔧 [SORA2 SERVICE] Initialisé');
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
      throw new Error('Clé API CometAPI manquante');
    }

    if (onProgress) onProgress(10);

    try {
      console.log('📡 [SORA2] Appel DIRECT à CometAPI');

      const requestBody = {
        model: 'sora-2',
        messages: [
          {
            role: 'user',
            content: `${params.prompt}. Duration: ${params.duration || 10}s. Aspect ratio: ${params.aspectRatio || '16:9'}`
          }
        ],
        stream: false,
        max_tokens: 500
      };

      console.log('📡 [SORA2] Requête:', requestBody);

      if (onProgress) onProgress(20);

      const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 [SORA2] Réponse:', {
        status: response.status,
        ok: response.ok
      });

      if (onProgress) onProgress(40);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [SORA2] Erreur:', errorText);
        throw new Error(`CometAPI error ${response.status}`);
      }

      if (onProgress) onProgress(60);

      const data = await response.json();
      console.log('📊 [SORA2] Réponse complète:', JSON.stringify(data, null, 2));

      if (onProgress) onProgress(70);

      const statusUrl = data.links?.source || data.source;

      if (statusUrl) {
        console.log('🔗 [SORA2] Status URL:', statusUrl);
        console.log('⏳ [SORA2] Polling...');

        const videoUrl = await this.pollStatusUrl(statusUrl, onProgress);

        return {
          videoUrl: videoUrl,
          taskId: data.id || 'sora2-' + Date.now(),
          duration: params.duration || 10,
          source: 'sora-2-comet-api'
        };
      }

      const content = data.choices?.[0]?.message?.content;
      if (content && typeof content === 'string') {
        const mp4Match = content.match(/https?:\/\/[^\s"]+\.mp4/);
        if (mp4Match) {
          console.log('✅ [SORA2] Vidéo trouvée directement:', mp4Match[0]);
          if (onProgress) onProgress(100);

          return {
            videoUrl: mp4Match[0],
            taskId: data.id || 'sora2-' + Date.now(),
            duration: params.duration || 10,
            source: 'sora-2-comet-api'
          };
        }
      }

      throw new Error('Aucune vidéo ni lien de status dans la réponse');

    } catch (error) {
      console.error('💥 [SORA2] Erreur:', error);

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Erreur inconnue lors de la génération Sora-2');
      }
    }
  }

  private async pollStatusUrl(statusUrl: string, onProgress?: (progress: number) => void): Promise<string> {
    let attempts = 0;
    const maxAttempts = 120;
    const pollInterval = 5000;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 [SORA2 POLL] Tentative ${attempts}/${maxAttempts}`);

      try {
        const statusRes = await fetch(statusUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': '*/*'
          }
        });

        if (statusRes.ok) {
          const text = await statusRes.text();
          console.log(`📝 [SORA2 POLL] Response (${text.length} chars)`);

          const patterns = [
            /High-quality video generated[\s\S]*?(https?:\/\/[^\s\]"<]+\.mp4)/i,
            /https?:\/\/[^\s\]"<]+\.mp4/i,
            /(?:video_url|videoUrl)["']?\s*:\s*["']?(https?:\/\/[^\s"']+\.mp4)/i
          ];

          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              const videoUrl = (match[1] || match[0]).replace(/[,;)\]}>]+$/, '').trim();
              if (videoUrl.startsWith('http') && videoUrl.includes('.mp4')) {
                console.log('✅ [SORA2 POLL] Vidéo trouvée:', videoUrl);
                if (onProgress) onProgress(100);
                return videoUrl;
              }
            }
          }
        }

        const progress = 70 + (attempts / maxAttempts) * 25;
        if (onProgress) onProgress(Math.min(95, progress));

      } catch (pollError) {
        console.warn('⚠️ [SORA2 POLL] Erreur (continue):', pollError);
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new Error('Timeout: vidéo non récupérée après 10 minutes');
  }

  getDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensions = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1024, height: 1024 }
    };
    return dimensions[aspectRatio as keyof typeof dimensions] || dimensions['16:9'];
  }
}

export const sora2Service = new Sora2Service(
  process.env.EXPO_PUBLIC_COMET_API_KEY || ''
);
