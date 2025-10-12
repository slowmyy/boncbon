export interface PixVerseEffect {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'transformation' | 'thematic' | 'creative' | 'animation';
  requiresImage: boolean;
  maxImages?: number;
}

export interface PixVerseStyle {
  id: string;
  name: string;
  emoji: string;
}

export interface PixVerseResolution {
  id: string;
  name: string;
  width: number;
  height: number;
  emoji: string;
}

export interface PixVerseVideoRequest {
  prompt: string;
  effect?: string;
  style?: string;
  cameraMovement?: string;
  motionMode?: 'normal' | 'fast';
  soundEffectSwitch?: boolean;
  soundEffectContent?: string;
  referenceImage?: string;
  width?: number;
  height?: number;
  duration?: 5;
  outputFormat?: 'MP4' | 'WEBM';
}

export interface PixVerseVideoResponse {
  videoURL: string;
  taskUUID: string;
  cost?: number;
  duration: number;
  resolution: string;
}

export const PIXVERSE_EFFECTS: PixVerseEffect[] = [
  {
    id: 'muscle_surge',
    name: 'Muscle Surge',
    description: 'Transformation musculaire spectaculaire',
    emoji: '💪',
    category: 'transformation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'bikini_up',
    name: 'Bikini Up',
    description: 'Transformation en tenue de plage',
    emoji: '👙',
    category: 'transformation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'huge_cutie',
    name: 'Huge Cutie',
    description: 'Version adorable géante',
    emoji: '🧸',
    category: 'transformation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'baby_face',
    name: 'Baby Face',
    description: 'Transformation en bébé',
    emoji: '👶',
    category: 'transformation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'kiss_me_ai',
    name: 'Kiss Me AI',
    description: 'Effet romantique avec IA',
    emoji: '💋',
    category: 'thematic',
    requiresImage: true,
    maxImages: 2
  },
  {
    id: 'warmth_of_jesus',
    name: 'Warmth of Jesus',
    description: 'Ambiance spirituelle chaleureuse',
    emoji: '✨',
    category: 'thematic',
    requiresImage: false
  },
  {
    id: 'holy_wings',
    name: 'Holy Wings',
    description: 'Ailes angéliques divines',
    emoji: '👼',
    category: 'thematic',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'thunder_god',
    name: 'Thunder God',
    description: 'Transformation en dieu du tonnerre',
    emoji: '⚡',
    category: 'thematic',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'black_myth_wukong',
    name: 'Black Myth: Wukong',
    description: 'Style du Roi Singe légendaire',
    emoji: '🐵',
    category: 'thematic',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'liquid_metal',
    name: 'Liquid Metal',
    description: 'Transformation métal liquide',
    emoji: '🌊',
    category: 'creative',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: '3d_figurine_factor',
    name: '3D Figurine',
    description: 'Conversion en figurine 3D',
    emoji: '🎭',
    category: 'creative',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'earth_zoom_challenge',
    name: 'Earth Zoom',
    description: 'Zoom spectaculaire depuis l\'espace',
    emoji: '🌍',
    category: 'creative',
    requiresImage: false
  },
  {
    id: 'venom',
    name: 'Venom',
    description: 'Transformation en symbiote',
    emoji: '🕷️',
    category: 'creative',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'zombie_mode',
    name: 'Zombie Mode',
    description: 'Transformation zombie horrifique',
    emoji: '🧟',
    category: 'creative',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'jiggle_jiggle',
    name: 'Jiggle Jiggle',
    description: 'Animation dansante rebondissante',
    emoji: '🎵',
    category: 'animation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'ai_dance',
    name: 'AI Dance',
    description: 'Danse générée par IA',
    emoji: '💃',
    category: 'animation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'vroom_dance',
    name: 'Vroom Dance',
    description: 'Danse énergique style voiture',
    emoji: '🏎️',
    category: 'animation',
    requiresImage: true,
    maxImages: 1
  },
  {
    id: 'pole_dance',
    name: 'Pole Dance',
    description: 'Danse acrobatique',
    emoji: '🎪',
    category: 'animation',
    requiresImage: true,
    maxImages: 1
  }
];

export const PIXVERSE_STYLES: PixVerseStyle[] = [
  { id: 'none', name: 'Aucun', emoji: '⚪' },
  { id: 'anime', name: 'Anime', emoji: '🎌' },
  { id: '3d_animation', name: '3D Animation', emoji: '🎬' },
  { id: 'clay', name: 'Clay', emoji: '🧱' },
  { id: 'comic', name: 'Comic', emoji: '💥' },
  { id: 'cyberpunk', name: 'Cyberpunk', emoji: '🌃' }
];

export const PIXVERSE_RESOLUTIONS: PixVerseResolution[] = [
  { id: '720p_16_9', name: '720p Paysage (16:9)', width: 1280, height: 720, emoji: '🖥️' },
  { id: '720p_1_1', name: '720p Carré (1:1)', width: 720, height: 720, emoji: '⬜' },
  { id: '720p_9_16', name: '720p Portrait (9:16)', width: 720, height: 1280, emoji: '📲' }
];

export class PixVerseService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_RUNWARE_API_KEY || '';
    this.apiUrl = process.env.EXPO_PUBLIC_RUNWARE_API_URL || 'https://api.runware.ai/v1';
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async detectImageFormat(imageUri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;

          if (ratio > 1.5) {
            resolve({ width: 1280, height: 720 });
          } else if (ratio < 0.7) {
            resolve({ width: 720, height: 1280 });
          } else {
            resolve({ width: 720, height: 720 });
          }
        };
        img.onerror = () => resolve({ width: 1280, height: 720 });
        img.src = imageUri;
      } else {
        resolve({ width: 1280, height: 720 });
      }
    });
  }

  private async uploadImage(imageUri: string): Promise<string> {
    console.log('📤 [PIXVERSE] Upload image de référence...');

    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];

          const uploadRequest = {
            taskType: 'imageUpload',
            taskUUID: this.generateUUID(),
            image: reader.result,
            filename: 'pixverse-reference.jpg'
          };

          const uploadResponse = await fetch('/api/runware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([uploadRequest])
          });

          if (!uploadResponse.ok) {
            reject(new Error('Upload failed'));
            return;
          }

          const data = await uploadResponse.json();
          const uploadResult = data.data?.[0] || data[0];
          const imageURL = uploadResult?.imageURL || uploadResult?.imagePath;

          if (!imageURL) {
            reject(new Error('No imageURL in upload response'));
            return;
          }

          console.log('✅ [PIXVERSE] Image uploadée:', imageURL);
          resolve(imageURL);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ [PIXVERSE] Erreur upload:', error);
      throw error;
    }
  }

  async generateVideo(params: PixVerseVideoRequest, onProgress?: (progress: number) => void): Promise<PixVerseVideoResponse> {
    if (!this.apiKey) {
      throw new Error('Clé API Runware manquante');
    }

    console.log('🎬 [PIXVERSE] Début génération:', {
      effect: params.effect,
      style: params.style,
      hasReferenceImage: !!params.referenceImage
    });

    try {
      if (onProgress) onProgress(10);

      let frameImages: string[] | undefined;
      let dimensions = { width: 1280, height: 720 };

      if (params.referenceImage) {
        console.log('📤 [PIXVERSE] Détection format image...');
        dimensions = await this.detectImageFormat(params.referenceImage);
        console.log('📐 [PIXVERSE] Format détecté:', dimensions);

        console.log('📤 [PIXVERSE] Upload image de référence...');
        if (onProgress) onProgress(20);
        const imageURL = await this.uploadImage(params.referenceImage);
        frameImages = [imageURL];
      }

      if (onProgress) onProgress(30);

      const videoRequest: any = {
        taskType: 'videoInference',
        taskUUID: this.generateUUID(),
        model: 'pixverse:1@5',
        positivePrompt: params.prompt,
        width: dimensions.width,
        height: dimensions.height,
        duration: 5,
        outputFormat: 'MP4',
        deliveryMethod: 'async',
        outputType: 'URL',
        includeCost: true
      };

      if (frameImages) {
        videoRequest.frameImages = frameImages;
      }

      const providerSettings: any = {};

      if (params.effect) {
        providerSettings.effect = params.effect;
      } else if (params.cameraMovement) {
        providerSettings.cameraMovement = params.cameraMovement;
      }

      if (params.style && params.style !== 'none') {
        providerSettings.style = params.style;
      }

      if (params.motionMode) {
        providerSettings.motionmode = params.motionMode;
      }

      if (params.soundEffectSwitch !== undefined) {
        providerSettings.soundEffectSwitch = params.soundEffectSwitch;
      }

      if (params.soundEffectContent) {
        providerSettings.soundEffectContent = params.soundEffectContent;
      }

      if (Object.keys(providerSettings).length > 0) {
        videoRequest.providerSettings = { pixverse: providerSettings };
      }

      console.log('🚀 [PIXVERSE] Envoi requête:', {
        model: videoRequest.model,
        effect: providerSettings.effect,
        style: providerSettings.style,
        hasFrameImages: !!videoRequest.frameImages
      });

      const response = await fetch('/api/runware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([videoRequest])
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PixVerse generation failed: ${response.status} - ${errorText}`);
      }

      if (onProgress) onProgress(40);

      const taskUUID = videoRequest.taskUUID;
      console.log('⏳ [PIXVERSE] Tâche lancée, polling...', taskUUID);

      return await this.pollForResult(taskUUID, onProgress);

    } catch (error) {
      console.error('❌ [PIXVERSE] Erreur génération:', error);
      throw error;
    }
  }

  private async pollForResult(taskUUID: string, onProgress?: (progress: number) => void): Promise<PixVerseVideoResponse> {
    let attempts = 0;
    const maxAttempts = 240;
    let delay = 3000;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;

      const progress = 40 + (attempts / maxAttempts) * 55;
      if (onProgress) onProgress(Math.min(95, progress));

      try {
        const statusRequest = {
          taskType: 'getResponse',
          taskUUID: taskUUID
        };

        const statusResponse = await fetch('/api/runware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([statusRequest])
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const results = statusData.data || statusData;

          if (Array.isArray(results)) {
            for (const result of results) {
              if (result.taskUUID === taskUUID) {
                if (result.status === 'success' && (result.videoURL || result.videoPath)) {
                  const videoUrl = result.videoURL || result.videoPath;
                  console.log('✅ [PIXVERSE] Vidéo prête:', videoUrl);

                  if (onProgress) onProgress(100);

                  return {
                    videoURL: videoUrl,
                    taskUUID: taskUUID,
                    cost: result.cost,
                    duration: result.duration || 5,
                    resolution: `${result.width}x${result.height}`
                  };
                }

                if (result.status === 'error') {
                  throw new Error(result.message || 'PixVerse generation error');
                }
              }
            }
          }
        }
      } catch (pollError) {
        console.warn('⚠️ [PIXVERSE] Erreur polling (continue):', pollError);
      }

      delay = Math.min(delay * 1.1, 5000);
    }

    throw new Error('Timeout - vidéo PixVerse non prête après 12 minutes');
  }

  getEffectById(effectId: string): PixVerseEffect | undefined {
    return PIXVERSE_EFFECTS.find(e => e.id === effectId);
  }

  getEffectsByCategory(category: string): PixVerseEffect[] {
    return PIXVERSE_EFFECTS.filter(e => e.category === category);
  }
}

export const pixverseService = new PixVerseService();
