interface RunwareImageRequest {
  taskType: 'imageInference';
  taskUUID: string;
  positivePrompt: string;
  negativePrompt?: string;
  model: string;
  width?: number;
  height?: number;
  steps?: number;
  CFGScale?: number;
  seed?: number;
  scheduler?: string;
  outputFormat?: 'WEBP' | 'JPG' | 'PNG' | 'JPEG';
  outputType?: 'URL' | 'base64Data' | string[];
  includeCost?: boolean;
  numberResults?: number;
  outputQuality?: number;
  // CORRECTION: Utiliser referenceImages (pluriel) comme dans le playground
  referenceImages?: string[];
  maskImage?: string;
  responseModalities?: string[];
}

interface RunwareUploadRequest {
  taskType: 'imageUpload';
  taskUUID: string;
  image: string; // Base64 data URL
  filename?: string;
}

interface RunwareResponse {
  data: Array<{
    taskType: string;
    imageURL?: string;
    imageBase64Data?: string;
    imagePath?: string;
    cost?: number;
    seed?: number;
    taskUUID?: string;
  }>;
  errors?: Array<{
    code: string;
    message: string;
    parameter?: string;
    type?: string;
    documentation?: string;
    taskUUID?: string;
  }>;
}


export interface UserPlan {
  isPremium: boolean;
  model: string;
  displayName: string;
}

// ✅ CONSTANTES GEMINI
const GEMINI_IMAGE_MODEL_ID = 'gemini-2.5-flash-image';

const isGeminiFlashId = (modelId: string) =>
  modelId?.toLowerCase()?.includes('gemini') && modelId?.toLowerCase()?.includes('flash') && modelId?.toLowerCase()?.includes('image');

// Fonction pour générer un UUID v4 valide
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Fonction pour générer un masque blanc obligatoire pour Gemini 2.5 Flash
function generateWhiteInitImageBase64(width: number = 512, height: number = 512): string {
  // Créer une image blanche de la taille spécifiée
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: PNG blanc 1x1 pixel
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==";
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // Remplir avec du blanc
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/png');
}

// Fonction pour générer un masque noir obligatoire pour Gemini 2.5 Flash
function generateBlackMaskBase64(width: number = 512, height: number = 512): string {
  // Créer un masque noir de la taille spécifiée
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: PNG noir 1x1 pixel
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWP///8/AwAC/gD/2Q8HvAAAAABJRU5ErkJggg==";
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // Remplir avec du noir
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/png');
}

export class RunwareService {
  private apiKey: string;
  private apiUrl: string;
  private userPlan: UserPlan;
  private cometApiKey: string;
  private falApiKey: string;

  // Model configurations optimized for best quality - Fixed dimensions to use supported values
  private readonly models = {
    free: {
      id: 'runware:100@1',
      displayName: 'Flux Schnell (Gratuit)',
      steps: 4,
      CFGScale: 2.5,
      scheduler: 'FlowMatchEulerDiscreteScheduler',
      outputFormat: "PNG" as const,
      outputQuality: 90,
      supportedDimensions: [
        { width: 832, height: 1280 }, // Portrait
        { width: 1280, height: 832 }, // Landscape
        { width: 1024, height: 1024 } // Square
      ]
    },
    premium: {
      id: 'heinrundiffusion:130@100',
      displayName: 'Juggernaut Pro',
      steps: 50,
      CFGScale: 8.0,
      scheduler: 'EulerAncestralDiscreteScheduler',
      outputFormat: "JPEG" as const,
      outputQuality: 100,
      supportsNegativePrompt: true,
      supportedDimensions: [
        { width: 832, height: 1280 }, // Portrait
        { width: 1280, height: 832 }  // Landscape only - no square support
      ]
    },
    ultra: {
      id: 'gemini-2.5-flash-image',
      displayName: 'Gemini 2.5 Flash Image (Ultra)',
      api: 'comet-api',
      supportedDimensions: [
        { width: 832, height: 1280 }, // Portrait
        { width: 1280, height: 832 }, // Landscape
        { width: 1024, height: 1024 } // Square
      ]
    },
    // Modèle spécialisé pour les images de référence
    fluxContextPro: {
      id: 'gemini-2.5-flash-image',
      displayName: 'Gemini 2.5 Flash Image (Référence)',
      api: 'comet-api',
      supportedDimensions: [
        { width: 832, height: 1280 }, // Portrait
        { width: 1280, height: 832 }, // Landscape
        { width: 1024, height: 1024 } // Square
      ]
    }
  };

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_RUNWARE_API_KEY || '';
    this.apiUrl = process.env.EXPO_PUBLIC_RUNWARE_API_URL || 'https://api.runware.ai/v1';
    this.cometApiKey = process.env.EXPO_PUBLIC_COMET_API_KEY || '';
    this.falApiKey = '';

    // Validation des clés API
    this.validateApiKey();

    // Initialize with free plan
    this.userPlan = {
      isPremium: false,
      model: this.models.free.id,
      displayName: this.models.free.displayName
    };
  }

  validateApiKey(): void {
    console.log('🔑 [VALIDATION] Vérification de la clé API Runware...');

    if (!this.apiKey) {
      console.error('❌ [VALIDATION] Clé API Runware manquante');
      console.error('💡 [SOLUTION] Ajoutez EXPO_PUBLIC_RUNWARE_API_KEY dans votre fichier .env');
      return;
    }

    if (this.apiKey.length < 20) {
      console.error('❌ [VALIDATION] Clé API Runware trop courte (probablement invalide)');
      console.error('💡 [SOLUTION] Vérifiez que la clé API complète est dans votre .env');
      return;
    }

    if (!this.apiKey.startsWith('rw-')) {
      console.log('ℹ️ [VALIDATION] Clé API ne commence pas par "rw-" mais peut être valide');
    }

    console.log('✅ [VALIDATION] Format de clé API Runware correct');
    console.log('🔑 [INFO] Clé API:', this.apiKey.substring(0, 8) + '...' + this.apiKey.slice(-4));
  }

  getUserPlan(): UserPlan {
    return { ...this.userPlan };
  }

  upgradeToPremium(): void {
    this.userPlan = {
      isPremium: true,
      model: this.models.premium.id,
      displayName: this.models.premium.displayName
    };
  }

  downgradeToFree(): void {
    this.userPlan = {
      isPremium: false,
      model: this.models.free.id,
      displayName: this.models.free.displayName
    };
  }

  /**
   * Get supported dimensions for a model
   */
  getSupportedDimensions(modelId: string) {
    const model = this.getModelConfigById(modelId);
    return model.supportedDimensions || [];
  }

  /**
   * Détermine automatiquement le modèle à utiliser en fonction de la présence d'une image de référence
   */
  getModelForGeneration(hasReferenceImage: boolean) {
    // Utiliser le modèle selon le plan de l'utilisateur, sans redirection automatique
    return this.userPlan.isPremium ? this.models.premium : this.models.free;
  }

  /**
   * Obtient le nom d'affichage du modèle actuel en fonction du contexte
   */
  getCurrentModelDisplayName(hasReferenceImage: boolean): string {
    const model = this.getModelForGeneration(hasReferenceImage);
    return model.displayName;
  }

  /**
   * Convertit une image URI en base64 pour l'envoi à l'API
   */
  async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      console.log('🔄 [CONVERSION] Début de conversion de l\'image:', {
        uri: imageUri.substring(0, 100) + '...',
        fullUri: imageUri,
        isHttpUrl: imageUri.startsWith('http://') || imageUri.startsWith('https://'),
        isFileUrl: imageUri.startsWith('file://'),
        isContentUrl: imageUri.startsWith('content://'),
        isDataUrl: imageUri.startsWith('data:'),
        isBlobUrl: imageUri.startsWith('blob:'),
        length: imageUri.length
      });

      // Si c'est déjà une data URL (base64), on la retourne telle quelle
      if (imageUri.startsWith('data:')) {
        console.log('✅ [CONVERSION] Data URL détectée, utilisation directe');
        return imageUri;
      }

      // Pour toutes les autres URIs (file://, content://, blob:, http://, etc.), on doit les convertir en base64
      console.log('🔄 [CONVERSION] URI détectée, conversion en base64...');
      
      // Utiliser fetch pour lire le fichier
      console.log('📡 [CONVERSION] Tentative de fetch de l\'image...');
      const response = await fetch(imageUri);
      
      console.log('📡 [CONVERSION] Réponse fetch reçue:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        console.error('❌ [CONVERSION] Erreur fetch:', response.status, response.statusText);
        throw new Error(`Impossible de lire l'image: ${response.status} ${response.statusText}`);
      }

      console.log('🔄 [CONVERSION] Conversion en blob...');
      const blob = await response.blob();
      console.log('📊 [CONVERSION] Blob créé:', {
        size: blob.size,
        type: blob.type,
        sizeKB: Math.round(blob.size / 1024),
        sizeMB: Math.round(blob.size / (1024 * 1024) * 100) / 100
      });

      // Vérifier que le blob n'est pas vide
      if (blob.size === 0) {
        console.error('❌ [CONVERSION] Blob vide détecté!');
        throw new Error('L\'image sélectionnée est vide ou corrompue');
      }

      // Vérifier le type MIME
      if (!blob.type.startsWith('image/')) {
        console.warn('⚠️ [CONVERSION] Type MIME non-image détecté:', blob.type);
      }
      
      console.log('🔄 [CONVERSION] Début de la conversion FileReader...');
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onloadstart = () => {
          console.log('🔄 [CONVERSION] FileReader: Début de lecture...');
        };
        
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            console.log(`🔄 [CONVERSION] FileReader: Progression ${Math.round(percentComplete)}%`);
          }
        };
        
        reader.onloadend = () => {
          console.log('🔄 [CONVERSION] FileReader: Lecture terminée');
          const base64String = reader.result as string;
          
          console.log('✅ [CONVERSION] Conversion base64 réussie:', {
            totalLength: base64String.length,
            preview: base64String.substring(0, 100) + '...',
            isEmpty: base64String.length === 0,
            isValidDataUrl: base64String.startsWith('data:'),
            mimeType: base64String.match(/data:([^;]+);/)?.[1] || 'non détecté',
            base64Part: base64String.includes(',') ? base64String.split(',')[1].substring(0, 50) + '...' : 'pas de virgule trouvée'
          });
          
          if (!base64String || base64String.length === 0) {
            console.error('❌ [CONVERSION] Base64 string est vide!');
            reject(new Error('La conversion base64 a produit une chaîne vide'));
            return;
          }
          
          if (!base64String.startsWith('data:')) {
            console.error('❌ [CONVERSION] Base64 string ne commence pas par data:!');
            reject(new Error('Format de données invalide après conversion'));
            return;
          }
          
          resolve(base64String);
        };
        
        reader.onerror = (error) => {
          console.error('❌ [CONVERSION] Erreur FileReader:', error);
          console.error('❌ [CONVERSION] Détails de l\'erreur FileReader:', {
            error: reader.error,
            readyState: reader.readyState,
            result: reader.result
          });
          reject(new Error('Erreur lors de la lecture du fichier image'));
        };
        
        console.log('🔄 [CONVERSION] Démarrage de readAsDataURL...');
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ [CONVERSION] Erreur lors de la conversion de l\'image en base64:', error);
      console.error('❌ [CONVERSION] Stack trace:', error instanceof Error ? error.stack : 'Pas de stack trace');
      throw new Error(`Impossible de traiter l'image de référence: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Upload une image vers Runware et retourne l'URL
   * ÉTAPE OBLIGATOIRE avant d'utiliser une image de référence
   */
  async uploadImageToRunware(base64Image: string, filename?: string): Promise<string> {
    try {
      console.log('📤 [UPLOAD] Début de l\'upload vers Runware:', {
        imageLength: base64Image.length,
        imagePreview: base64Image.substring(0, 100) + '...',
        filename: filename || 'image.png',
        isValidBase64: base64Image.startsWith('data:'),
        mimeType: base64Image.match(/data:([^;]+);/)?.[1] || 'non détecté'
      });

      const uploadRequest: RunwareUploadRequest = {
        taskType: "imageUpload",
        taskUUID: generateUUID(),
        image: base64Image,
        filename: filename || 'reference-image.png'
      };

      console.log('📤 [UPLOAD] Requête d\'upload préparée:', {
        taskType: uploadRequest.taskType,
        taskUUID: uploadRequest.taskUUID,
        filename: uploadRequest.filename,
        imageSize: `${Math.round(base64Image.length / 1024)}KB`,
        hasImage: !!uploadRequest.image
      });

      const response = await fetch(`${this.apiUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        mode: 'cors',
        body: JSON.stringify([uploadRequest]) // Runware attend toujours un array
      });

      console.log('📥 [UPLOAD] Réponse d\'upload reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        // Read response body once as text to avoid "body stream already read" error
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('❌ [UPLOAD] Erreur d\'upload:', errorText);
        throw new Error(`Erreur lors de l'upload de l'image: ${response.status} - ${errorData.error || errorText}`);
      }

      let data: RunwareResponse;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('❌ [UPLOAD] Erreur parsing JSON upload:', parseError);
        throw new Error('Réponse API upload invalide');
      }
      
      console.log('📊 [UPLOAD] Données d\'upload reçues:', {
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
        hasErrors: !!data.errors,
        errorsLength: data.errors?.length || 0,
        firstDataItem: data.data?.[0] ? {
          taskType: data.data[0].taskType,
          hasImageURL: !!data.data[0].imageURL,
          hasImagePath: !!data.data[0].imagePath,
          imageURL: data.data[0].imageURL?.substring(0, 100) + '...'
        } : null
      });

      // Vérifier les erreurs
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        console.error('❌ [UPLOAD] Erreur API lors de l\'upload:', error);
        throw new Error(`Erreur d'upload: ${error.code} - ${error.message}`);
      }

      // Vérifier la réponse
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error('❌ [UPLOAD] Format de réponse d\'upload invalide');
        throw new Error('Format de réponse d\'upload invalide');
      }

      const uploadResult = data.data[0];
      const uploadedImageUrl = uploadResult.imageURL || uploadResult.imagePath;

      if (!uploadedImageUrl) {
        console.error('❌ [UPLOAD] Pas d\'URL d\'image dans la réponse d\'upload:', uploadResult);
        throw new Error('Pas d\'URL d\'image retournée par l\'upload');
      }

      console.log('✅ [UPLOAD] Image uploadée avec succès:', {
        originalSize: `${Math.round(base64Image.length / 1024)}KB`,
        uploadedUrl: uploadedImageUrl,
        taskUUID: uploadResult.taskUUID
      });

      return uploadedImageUrl;
    } catch (error) {
      console.error('❌ [UPLOAD] Erreur lors de l\'upload de l\'image:', error);
      throw new Error(`Impossible d'uploader l'image de référence: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Test the Runware API integration
   */
  async testRunwareIntegration(): Promise<boolean> {
    const testRequest: RunwareImageRequest = {
      taskType: "imageInference",
      taskUUID: generateUUID(),
      positivePrompt: "test integration",
      model: "civitai:618692@691639",
      width: 832,
      height: 1248, // Fixed: Use supported dimension
      steps: 4,
      CFGScale: 2.5,
      scheduler: "FlowMatchEulerDiscreteScheduler",
      outputFormat: "PNG",
      outputType: "URL",
      includeCost: true
    };

    try {
      const response = await fetch(`${this.apiUrl}/image/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        mode: 'cors',
        body: JSON.stringify([testRequest]) // Runware attend un array
      });

      if (response.status !== 200) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        console.error('VALIDATION FAILED:', errorData);
        throw new Error('Runware API test failed');
      }

      return true;
    } catch (error) {
      console.error('Runware integration test failed:', error);
      return false;
    }
  }

  async generateImage(prompt: string, options?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    cfgScale?: number;
    referenceImage?: string; // URI de l'image de référence (legacy)
    referenceImages?: string[] | string; // Support multiple images pour Gemini
    model?: string; // Modèle à utiliser
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Clé API Runware manquante. Vérifiez votre fichier .env');
    }
    
    if (this.apiKey.length < 10) {
      throw new Error('Clé API Runware invalide. Vérifiez votre configuration');
    }

    // Vérification critique: Le modèle Ultra (inpainting) nécessite obligatoirement une image de référence
    // Note: Gemini 2.5 Flash Image ne nécessite plus obligatoirement une image de référence

    // Déterminer automatiquement le modèle à utiliser
    const hasReferenceImage = !!options?.referenceImage;
    
    let selectedModel: any;
    if (options?.model) {
      // Utiliser le modèle spécifié
      const modelConfig = this.getModelConfigById(options.model);
      selectedModel = {
        ...modelConfig,
        width: options?.width || 832,
        height: options?.height || 1280
      };
    } else {
      // Utiliser la logique existante
      selectedModel = this.getModelForGeneration(hasReferenceImage);
    }

    console.log('🎯 [GENERATION] Début de génération d\'image:', {
      hasReferenceImage,
      selectedModel: selectedModel.id,
      modelName: selectedModel.displayName,
      isGemini: selectedModel.id === GEMINI_IMAGE_MODEL_ID,
      modelOptions: options?.model,
      referenceImageUri: options?.referenceImage ? options.referenceImage.substring(0, 100) + '...' : 'aucune',
      referenceImageLength: options?.referenceImage?.length || 0,
      referenceImageType: options?.referenceImage ? (
        options.referenceImage.startsWith('data:') ? 'base64' :
        options.referenceImage.startsWith('http') ? 'http' :
        options.referenceImage.startsWith('file:') ? 'file' :
        options.referenceImage.startsWith('blob:') ? 'blob' :
        'autre'
      ) : 'aucune',
      dimensions: `${options?.width || 'auto'}x${options?.height || 'auto'}`
    });

    // ✅ ROUTEUR DE GÉNÉRATION
    if (selectedModel.id === GEMINI_IMAGE_MODEL_ID) {
      console.log('🔮 [ROUTER] Routage vers Gemini 2.5 Flash Image (CometAPI)');
      return await this.generateWithCometAPI({
        prompt: prompt,
        referenceImages: options?.referenceImages || options?.referenceImage || null,
      });
    }

    // Autres modèles classiques (Flux Schnell, Juggernaut Pro)
    console.log('⚡ [ROUTER] Routage vers modèle classique via Runware');
    return await this.generateWithClassicAPI(prompt, selectedModel, options);
  }

  /**
   * Génération avec l'API classique (Flux Schnell, Juggernaut Pro)
   */
  async generateWithClassicAPI(prompt: string, selectedModel: any, options?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    cfgScale?: number;
    referenceImage?: string;
  }): Promise<string> {
    try {
      // Construire le payload selon le type de modèle
      const requestBody = this.buildPayloadForModel(selectedModel.id, prompt, selectedModel, options);

      
      // Traitement spécial pour image de référence avec modèles classiques (pas Gemini)
      if (options?.referenceImage) {
        try {
          console.log('📸 [REFERENCE] Traitement image de référence...');
          const base64Image = await this.convertImageToBase64(options.referenceImage);
          const uploadedImageUrl = await this.uploadImageToRunware(base64Image, 'reference-image.png');
          requestBody.referenceImages = [uploadedImageUrl];
          console.log('✅ [REFERENCE] Image de référence ajoutée');
        } catch (error) {
          console.error('❌ [REFERENCE] Erreur traitement image de référence:', error);
          throw new Error(`Impossible de traiter l'image de référence: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }
      
      console.log('🚀 [REQUEST] Envoi vers API Runware:', {
        model: requestBody.model,
        dimensions: `${requestBody.width}x${requestBody.height}`,
        hasReferenceImages: !!requestBody.referenceImages,
        payloadType: 'complet'
      });
      
      const response = await fetch('/api/runware', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([requestBody])
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(`Runware API error: ${response.status} - ${errorData.error || errorText}`);
      }

      const data: RunwareResponse = await response.json();
      
      // Vérifier les erreurs dans la réponse
      if (data.errors && data.errors.length > 0) {
        const error = data.errors[0];
        console.error('❌ [RESPONSE] Runware API Error:', error);
        throw new Error(`Runware API error: ${error.code} - ${error.message}`);
      }

      // Validate response format
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error('❌ [RESPONSE] Format de réponse invalide - pas de tableau data');
        throw new Error('Invalid response format from Runware API - no data array');
      }

      const imageResult = data.data[0];
      const imageUrl = imageResult.imageURL || imageResult.imagePath;

      if (!imageUrl) {
        console.error('❌ [RESPONSE] Pas d\'URL d\'image dans la réponse:', imageResult);
        throw new Error('Invalid response format from Runware API - no image URL');
      }

      console.log('✅ [SUCCESS] Image générée:', {
        model: selectedModel.displayName,
        imageUrl: imageUrl.substring(0, 100) + '...',
        cost: imageResult.cost,
        seed: imageResult.seed
      });

      return imageUrl;
      
    } catch (error) {
      console.error('❌ [CLASSIC] Erreur génération:', error);
      throw error;
    }
  }

  /**
   * ✅ GÉNÉRATION AVEC COMET API (GEMINI 2.5 FLASH IMAGE)
   * → Patch pour supporter plusieurs images (jusqu'à 3).
   */
  private async generateWithCometAPI(input: { 
    prompt: string; 
    referenceImages?: string[] | string | null 
  }): Promise<string> {
    try {
      console.log("🚀 [COMET] Démarrage génération i2i Gemini 2.5");

      if (!this.cometApiKey) {
        throw new Error("Clé API CometAPI manquante. Vérifiez EXPO_PUBLIC_COMET_API_KEY");
      }

      const parts: any[] = [{ text: input.prompt }];

      // Normaliser → toujours un tableau d'images
      let images: string[] = [];
      if (typeof input.referenceImages === "string") {
        images = [input.referenceImages];
      } else if (Array.isArray(input.referenceImages)) {
        images = input.referenceImages.slice(0, 3); // max 3 images
      }

      for (const img of images) {
        console.log("📸 [COMET] Conversion image de référence...");
        const { mime_type, data } = await this.toBase64(img);
        parts.push({ inline_data: { mime_type, data } });
        console.log("✅ [COMET] inline_data ajouté:", { mime_type, dataLen: data.length });
      }

      const payload = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"]
        }
      };

      console.log("📦 [COMET] Payload final:", JSON.stringify(payload).substring(0, 400) + "...");

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers["Authorization"] = this.cometApiKey.startsWith("sk-")
        ? this.cometApiKey
        : `Bearer ${this.cometApiKey}`;

      const res = await fetch(
        "https://api.cometapi.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        { method: "POST", headers, body: JSON.stringify(payload) }
      );

      console.log("📥 [COMET] Réponse brute:", res.status, res.statusText);

      const raw = await res.text();
      if (!res.ok) {
        console.error("❌ [COMET] Erreur HTTP:", raw.slice(0, 200));
        throw new Error(`Erreur CometAPI: ${res.status} - ${res.statusText}`);
      }

      let dataJson: any;
      try { dataJson = JSON.parse(raw); }
      catch {
        console.error("❌ [COMET] Parse JSON échoué:", raw.slice(0, 200));
        throw new Error("Réponse CometAPI non JSON");
      }

      console.log("🔎 [COMET] Top-level keys:", Object.keys(dataJson));

      // Extraction image robuste
      const img = this.extractFirstImageFromCometResponse(dataJson);
      console.log("✅ [COMET] Image extraite avec succès");
      return img;

    } catch (error) {
      console.error("💥 [COMET] Erreur generateWithCometAPI:", error);
      throw new Error(
        `Impossible de générer l'image avec CometAPI: ${
          error instanceof Error ? error.message : "Erreur inconnue"
        }`
      );
    }
  }

  // ✅ Helper universel pour convertir une image en base64 exploitable par Comet
  private async toBase64(uri: string): Promise<{ mime_type: string; data: string }> {
    console.log("📸 [toBase64] Image reçue:", uri.substring(0, 100) + "...");

    // Cas 1: déjà une dataURL base64
    if (uri.startsWith("data:")) {
      console.log("✅ [toBase64] DataURL détectée, pas de fetch nécessaire");
      const match = uri.match(/^data:([^;]+);base64,(.*)$/);
      return { mime_type: match?.[1] || "image/jpeg", data: match?.[2] || "" };
    }

    // Cas 2: URI classique (http://, file://, blob://…)
    console.log("🌐 [toBase64] Fetch de l'image externe...");
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Impossible de fetch l'image: ${response.status}`);

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const mime_type = blob.type || "image/jpeg";
    console.log("✅ [toBase64] Blob reçu:", { size: blob.size, mime: mime_type });

    // Conversion chunkée pour éviter les plantages
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
    }
    const data = btoa(binary);

    console.log("✅ [toBase64] Conversion base64 OK, taille:", data.length);
    return { mime_type, data };
  }

  // --- ADD: helper d'extraction robuste
  extractFirstImageFromCometResponse(resp: any): string {
    console.log('🔎 [EXTRACT] Début extraction image...');
    console.log('🔎 [EXTRACT] Response structure:', {
      topKeys: Object.keys(resp || {}),
      responseType: typeof resp,
      isArray: Array.isArray(resp)
    });
    
    // A) Schéma Gemini natif
    const candidates = resp?.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      console.log('🔍 [EXTRACT] Vérification candidates...');
      for (const cand of candidates) {
        const parts = cand?.content?.parts;
        if (Array.isArray(parts)) {
          console.log('🔍 [EXTRACT] Parts trouvées:', parts.length);
          for (const part of parts) {
            // Vérifier les deux formats possibles selon la doc CometAPI
            const inline = part?.inline_data || part?.inlineData;
            const mime = inline?.mime_type || inline?.mimeType;
            const b64 = inline?.data;
            
            console.log('🔍 [EXTRACT] Part analysée:', {
              hasInlineData: !!inline,
              mimeType: mime,
              hasData: !!b64,
              dataLength: b64?.length || 0,
              partKeys: Object.keys(part || {}),
              inlineKeys: Object.keys(inline || {})
            });
            
            if (b64 && typeof b64 === 'string' && b64.length > 100) {
              console.log('✅ [EXTRACT] Image trouvée (format Gemini natif)');
              console.log('✅ [EXTRACT] Image details:', {
                mimeType: mime,
                dataLength: b64.length,
                dataPreview: b64.substring(0, 100) + '...'
              });
              return `data:${mime || 'image/png'};base64,${b64}`;
            }
          }
        }
      }
    }

    // B) Schéma OpenAI-like
    const choices = resp?.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      console.log('🔍 [EXTRACT] Vérification choices...');
      const content = choices[0]?.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          // URL d'image
          const url = block?.image_url?.url;
          if (typeof url === 'string' && url.startsWith('http')) {
            console.log('✅ [EXTRACT] Image trouvée (URL)');
            return url;
          }
          // Base64 OpenAI-like
          const b64 = block?.b64_json;
          if (typeof b64 === 'string' && b64.length > 100) {
            console.log('✅ [EXTRACT] Image trouvée (base64 OpenAI)');
            return `data:image/png;base64,${b64}`;
          }
        }
      }
    }

    // C) Fallback générique : scan récursif
    console.log('🔍 [EXTRACT] Scan récursif...');
    const stack = [resp];
    let scannedObjects = 0;
    while (stack.length) {
      const cur = stack.pop();
      scannedObjects++;
      if (scannedObjects > 100) {
        console.warn('⚠️ [EXTRACT] Trop d\'objets scannés, arrêt du scan récursif');
        break;
      }
      if (cur && typeof cur === 'object') {
        // Heuristique base64 + mime
        const mime = cur.mime_type || cur.mimeType;
        const data = cur.data;
        if (mime && typeof data === 'string' && data.length > 100) {
          console.log('✅ [EXTRACT] Image trouvée (scan récursif)');
          console.log('✅ [EXTRACT] Recursive find details:', {
            mimeType: mime,
            dataLength: data.length,
            objectKeys: Object.keys(cur)
          });
          return `data:${mime};base64,${data}`;
        }
        for (const k of Object.keys(cur)) {
          const v = cur[k];
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    }

    // Log minimal et erreur claire
    const topKeys = resp ? Object.keys(resp).slice(0, 12) : [];
    console.error('❌ [EXTRACT] Aucune image trouvée. Clés principales:', topKeys);
    console.error('❌ [EXTRACT] Réponse complète (premiers 3000 chars):', JSON.stringify(resp, null, 2).substring(0, 3000));
    
    // Diagnostic supplémentaire
    if (resp?.candidates) {
      console.error('❌ [EXTRACT] Diagnostic candidates:', resp.candidates.map((c, i) => ({
        index: i,
        hasContent: !!c?.content,
        hasParts: !!c?.content?.parts,
        partsCount: c?.content?.parts?.length || 0,
        partTypes: c?.content?.parts?.map(p => Object.keys(p || {})) || []
      })));
    }
    
    throw new Error('Aucune image trouvée dans la réponse CometAPI');
  }

  /**
   * Construit le payload selon le type de modèle
   */
  buildPayloadForModel(modelId: string, prompt: string, selectedModel: any, options?: {
    negativePrompt?: string;
    width?: number;
    height?: number;
    cfgScale?: number;
  }): RunwareImageRequest {
    // Construire le payload complet pour les modèles classiques
    const basePayload: RunwareImageRequest = {
      taskType: "imageInference",
      taskUUID: generateUUID(),
      positivePrompt: prompt,
      model: modelId,
      width: options?.width || 832,
      height: options?.height || 1280,
      steps: selectedModel.steps || 4,
      CFGScale: options?.cfgScale || selectedModel.CFGScale || 2.5,
      scheduler: selectedModel.scheduler || "FlowMatchEulerDiscreteScheduler",
      outputFormat: selectedModel.outputFormat || "PNG",
      outputType: "URL",
      includeCost: true,
      numberResults: 1,
      outputQuality: selectedModel.outputQuality || 90
    };

    // Ajouter le prompt négatif si fourni
    if (options?.negativePrompt) {
      basePayload.negativePrompt = options.negativePrompt;
    }

    console.log('📦 [PAYLOAD] Payload construit:', {
      model: basePayload.model,
      dimensions: `${basePayload.width}x${basePayload.height}`,
      steps: basePayload.steps,
      CFGScale: basePayload.CFGScale,
      scheduler: basePayload.scheduler,
      hasNegativePrompt: !!basePayload.negativePrompt
    });

    return basePayload;
  }

  /**
   * Obtenir le nom d'affichage d'un modèle par son ID
   */
  getModelDisplayName(modelId: string): string {
    // ✅ GEMINI 2.5 FLASH IMAGE
    if (modelId === GEMINI_IMAGE_MODEL_ID) return 'Gemini 2.5 Flash Image (Ultra)';

    const modelMap: { [key: string]: string } = {
      'runware:100@1': 'Flux Schnell',
      'heinrundiffusion:130@100': 'Juggernaut Pro',
    };
    return modelMap[modelId] || 'Modèle personnalisé';
  }

  /**
   * Get model configuration by ID (missing method)
   */
  getModelConfigById(modelId: string) {
    if (modelId.trim() === 'gemini-2.5-flash-image') {
      return this.models.ultra;
    }
    if (modelId.trim() === 'rundiffusion:130@100') {
      return this.models.premium;
    }
    return this.models.free;
  }
}

export const runwareService = new RunwareService();