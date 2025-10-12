export interface SeedreamOptions {
  width?: number;
  height?: number;
  format?: 'square' | 'portrait' | 'landscape';
}

export class SeedreamService {
  private readonly dimensions = {
    square: { width: 4096, height: 4096 },       // Carré 4K (1:1)
    portrait: { width: 2160, height: 3840 },     // Portrait 4K (9:16)
    landscape: { width: 3840, height: 2160 }     // Paysage 4K (16:9)
  };

  constructor() {
    console.log('[SEEDREAM] Service initialized');
  }

  async generateImage(prompt: string, options?: SeedreamOptions): Promise<string> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }

    console.log('[SEEDREAM] Starting generation:', {
      prompt: prompt.substring(0, 100),
      options
    });

    const dimensions = this.getDimensions(options);
    console.log('[SEEDREAM] Using dimensions:', dimensions);

    const payload = {
      api: 'fal-ai',
      service: 'fal-ai',
      prompt: prompt,
      image_size: {
        width: dimensions.width,
        height: dimensions.height
      }
    };

    console.log('[SEEDREAM] Sending to proxy:', payload);

    try {
      const response = await fetch('/api/runware', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[SEEDREAM] Proxy response:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[SEEDREAM] Error:', errorData);

        throw new Error(
          errorData.message ||
          errorData.error ||
          `Generation failed with status ${response.status}`
        );
      }

      const data = await response.json();
      console.log('[SEEDREAM] Response data:', {
        hasImages: !!data.images,
        imagesCount: data.images?.length || 0
      });

      const imageUrl = this.extractImageUrl(data);

      if (!imageUrl) {
        console.error('[SEEDREAM] No image URL found in response:', data);
        throw new Error('No image URL in response');
      }

      console.log('[SEEDREAM] Success! Image URL:', imageUrl.substring(0, 80));

      return imageUrl;

    } catch (error) {
      console.error('[SEEDREAM] Generation failed:', error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Image generation failed: ' + String(error));
    }
  }

  private getDimensions(options?: SeedreamOptions): { width: number; height: number } {
    if (options?.width && options?.height) {
      return {
        width: options.width,
        height: options.height
      };
    }

    if (options?.format) {
      return this.dimensions[options.format];
    }

    return this.dimensions.portrait;
  }

  private extractImageUrl(data: any): string | null {
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const firstImage = data.images[0];

      if (typeof firstImage === 'object' && firstImage.url) {
        return firstImage.url;
      }

      if (typeof firstImage === 'string') {
        return firstImage;
      }
    }

    if (data.image && typeof data.image === 'object' && data.image.url) {
      return data.image.url;
    }

    if (data.url && typeof data.url === 'string') {
      return data.url;
    }

    return null;
  }
}

export const seedreamService = new SeedreamService();
