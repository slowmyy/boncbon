import { mergeImagesForSelfieFixed } from './imageMerger';
import { Platform } from 'react-native';
import { runwareService } from './runware';

// Conversion File vers Base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result || !result.includes(',')) {
        reject(new Error('Erreur conversion Base64'));
        return;
      }
      const base64 = result.split(',')[1];
      console.log('✅ Conversion Base64 OK, taille:', base64.length);
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsDataURL(file);
  });
}

// Conversion URI vers File (pour mobile)
async function uriToFile(uri: string, filename: string): Promise<File> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
}

// Génération UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ✅ FONCTION D'UPLOAD CORRIGÉE
async function uploadMergedImageFixed(mergedFile: File, apiKey: string): Promise<string> {
  console.log('📤 [UPLOAD] Début upload image fusionnée');
  console.log('📁 Fichier:', mergedFile.name, mergedFile.size, 'bytes');
  
  // Validate inputs
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Clé API Runware invalide ou manquante');
  }
  
  if (!mergedFile || mergedFile.size === 0) {
    throw new Error('Fichier image invalide');
  }
  
  try {
    // ÉTAPE 1: Conversion Base64 sécurisée
    const base64Data = await fileToBase64(mergedFile);
    
    // ÉTAPE 2: Requête d'upload EXACTE
    const uploadRequest = {
      taskType: "imageUpload",
      taskUUID: generateUUID(),
      image: base64Data,
      filename: mergedFile.name || 'selfie-merged.jpg'
    };
    
    console.log('📡 Envoi upload request...');
    
    // ÉTAPE 3: Use proxy API route to avoid CORS issues
    const response = await fetch('/api/runware', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([uploadRequest]) // Runware attend un array
    });
    
    console.log('📨 Réponse upload status:', response.status);
    console.log('📨 Réponse upload headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      // Read response body once as text to avoid "body stream already read" error
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.error('❌ Upload error data:', errorData);
      } catch {
        errorData = { error: errorText };
      }
      
      // Check for specific error types
      if (response.status === 401) {
        throw new Error('Clé API Runware invalide pour l\'upload');
      } else if (response.status === 413) {
        throw new Error('Fichier trop volumineux pour l\'upload');
      }
      
      console.error('❌ Upload failed:', errorText);
      throw new Error(`Upload HTTP ${response.status}: ${errorData.error || errorText}`);
    }
    
    // ÉTAPE 4: Parse JSON response directly
    let data;
    try {
      data = await response.json();
      console.log('📋 Data parsée:', data);
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      throw new Error('Réponse API invalide');
    }
    
    // ÉTAPE 5: Extraction de l'URL
    // Check if response has data property (nested structure) or is direct array
    const results = data.data || data;
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      console.error('❌ Structure de réponse invalide:', data);
      throw new Error('Réponse upload vide ou invalide');
    }
    
    const uploadResult = results[0];
    console.log('🔍 Premier élément:', uploadResult);
    
    // Vérifier plusieurs formats possibles d'URL
    const imageURL = uploadResult.imageURL || 
                     uploadResult.url || 
                     uploadResult.image_url ||
                     uploadResult.imagePath;
    
    if (!imageURL) {
      console.error('❌ Aucune URL trouvée dans:', uploadResult);
      throw new Error('Pas d\'URL dans la réponse upload');
    }
    
    console.log('✅ [UPLOAD] Succès! URL:', imageURL);
    return imageURL;
    
  } catch (error) {
    console.error('💥 [UPLOAD] Erreur complète:', error);
    
    // Better error classification for upload
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Impossible de contacter l\'API Runware pour l\'upload. Vérifiez votre connexion.');
    } else if (error.message.includes('CORS')) {
      throw new Error('Erreur CORS lors de l\'upload. L\'API doit autoriser votre domaine.');
    } else if (error.message.includes('401') || error.message.includes('Clé API')) {
      throw new Error('Clé API invalide pour l\'upload.');
    } else {
      throw new Error(`Upload échoué: ${error.message}`);
    }
  }
}

// Génération avec retry
async function generateSelfieImage(referenceURL: string, prompt: string, apiKey: string) {
  console.log('🎨 Génération selfie...');
  
  // Validate API key format
  if (!apiKey || apiKey.length < 10) {
    throw new Error('Clé API Runware invalide ou manquante');
  }
  
  // Validate reference URL
  if (!referenceURL || !referenceURL.startsWith('http')) {
    throw new Error('URL de référence invalide');
  }
  
  const generateRequest = {
    taskType: "imageInference",
    taskUUID: generateUUID(),
    positivePrompt: prompt,
    model: "bfl:3@1", // Flux Context Pro pour les images de référence
    height: 1248, // Portrait format (supporté par Runware API)
    width: 832,
    numberResults: 1,
    referenceImages: [referenceURL], // Format correct pour Flux Context Pro
    outputType: ["dataURI", "URL"],
    outputFormat: "JPEG",
    outputQuality: 95,
    includeCost: true
  };
  
  // Retry 3 fois
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`🎯 Tentative génération ${attempt}/3`);
      console.log('🔗 API URL:', 'https://api.runware.ai/v1');
      console.log('🔑 API Key présente:', !!apiKey);
      console.log('🔑 API Key longueur:', apiKey.length);
      console.log('📸 Reference URL:', referenceURL);
      
      // Use proxy API route to avoid CORS issues
      const response = await fetch('/api/runware', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([generateRequest])
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        // Read response body once as text to avoid "body stream already read" error
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error('❌ Generate error data:', errorData);
        } catch {
          errorData = { error: errorText };
        }
        
        // Check for specific error types
        if (response.status === 401) {
          throw new Error('Clé API Runware invalide. Vérifiez votre clé API.');
        } else if (response.status === 403) {
          throw new Error('Accès refusé. Vérifiez vos permissions API.');
        } else if (response.status === 429) {
          throw new Error('Limite de taux dépassée. Attendez avant de réessayer.');
        }
        
        throw new Error(`Generate HTTP ${response.status}: ${errorData.error || errorText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('❌ Erreur parsing JSON génération:', parseError);
        throw new Error('Réponse API génération invalide');
      }
      
      // Check if response has data property or is direct array
      const results = data.data || data;
      
      if (!results || !Array.isArray(results) || results.length === 0) {
        throw new Error('Pas de résultat dans la réponse');
      }
      
      const imageUrl = results[0]?.imageURL || results[0]?.imagePath;
      if (!imageUrl) {
        throw new Error('Pas d\'image dans la réponse');
      }
      
      console.log('✅ Génération réussie');
      return results[0];
      
    } catch (error) {
      console.log(`❌ Tentative ${attempt} échouée:`, error);
      
      // Better error classification
      if (error.message.includes('Failed to fetch')) {
        console.error('🌐 Erreur réseau détectée:', {
          message: error.message,
          attempt: attempt,
          apiUrl: 'https://api.runware.ai/v1',
          hasApiKey: !!apiKey,
          referenceUrl: referenceURL
        });
        
        if (attempt === 3) {
          throw new Error('Impossible de contacter l\'API Runware. Vérifiez votre connexion internet et votre clé API.');
        }
      } else if (error.message.includes('CORS')) {
        throw new Error('Erreur CORS. L\'API Runware doit autoriser votre domaine.');
      } else if (error.message.includes('401') || error.message.includes('Clé API')) {
        throw new Error('Clé API Runware invalide. Vérifiez votre configuration.');
      }
      
      if (attempt === 3) {
        throw new Error(`Génération échouée après 3 tentatives: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw new Error('Génération impossible');
}

// ✅ FONCTION SELFIE EFFECT FINALE
export async function applySelfieWithCelebrityEffect(
  userPhoto: File | string,
  celebrityPhoto: File | string,
  customPrompt?: string,
  apiKey?: string
) {
  
  console.log('🎬 [SELFIE EFFECT] Version corrigée');
  
  // Enhanced validation
  console.log('🔍 [VALIDATION] Vérification des paramètres:', {
    hasUserPhoto: !!userPhoto,
    hasCelebrityPhoto: !!celebrityPhoto,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    userPhotoType: typeof userPhoto,
    celebrityPhotoType: typeof celebrityPhoto
  });
  
  try {
    // Validation stricte
    if (!userPhoto) {
      throw new Error('Photo utilisateur manquante');
    }
    
    if (!celebrityPhoto) {
      throw new Error('Photo célébrité manquante');
    }
    
    if (!apiKey || apiKey.length < 10) {
      throw new Error('Clé API Runware manquante ou invalide. Vérifiez votre fichier .env');
    }
    
    console.log('✅ Validations OK');
    
    // ÉTAPE 1: Conversion en Files si nécessaire
    let userFile: File;
    let celebrityFile: File;
    
    if (typeof userPhoto === 'string') {
      console.log('🔄 Conversion URI utilisateur vers File...');
      userFile = await uriToFile(userPhoto, 'user-photo.jpg');
    } else {
      userFile = userPhoto;
    }
    
    if (typeof celebrityPhoto === 'string') {
      console.log('🔄 Conversion URI célébrité vers File...');
      celebrityFile = await uriToFile(celebrityPhoto, 'celebrity-photo.jpg');
    } else {
      celebrityFile = celebrityPhoto;
    }
    
    // Vérifier que les fichiers ne sont pas vides
    if (userFile.size === 0) {
      throw new Error('Photo utilisateur invalide');
    }
    
    if (celebrityFile.size === 0) {
      throw new Error('Photo célébrité invalide');
    }
    
    // ÉTAPE 2: Fusion avec nouvelle fonction
    console.log('🔄 Fusion des images...');
    let mergedFile: File;
    
    if (Platform.OS === 'web') {
      // Web: fusion réelle des images
      mergedFile = await mergeImagesForSelfieFixed(userFile, celebrityFile);
    } else {
      // Mobile: créer une fusion simple côte à côte
      console.log('📱 Fusion mobile simplifiée...');
      
      // Pour mobile, on va créer une fusion basique en utilisant canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        // Fallback: utiliser seulement l'image utilisateur
        console.warn('⚠️ Canvas non disponible, utilisation image utilisateur seule');
        mergedFile = userFile;
      } else {
        // Créer une fusion simple
        canvas.width = 1024;
        canvas.height = 512;
        
        // Fond blanc
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1024, 512);
        
        // Charger et dessiner les images
        const img1 = new Image();
        const img2 = new Image();
        
        await new Promise((resolve, reject) => {
          let loadedCount = 0;
          
          const onLoad = () => {
            loadedCount++;
            if (loadedCount === 2) {
              // Dessiner les deux images côte à côte
              ctx.drawImage(img1, 0, 0, 512, 512);
              ctx.drawImage(img2, 512, 0, 512, 512);
              resolve(null);
            }
          };
          
          img1.onload = onLoad;
          img2.onload = onLoad;
          img1.onerror = reject;
          img2.onerror = reject;
          
          img1.src = URL.createObjectURL(userFile);
          img2.src = URL.createObjectURL(celebrityFile);
        });
        
        // Convertir canvas en File
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
        });
        
        mergedFile = new File([blob], 'merged-mobile.jpg', { type: 'image/jpeg' });
        
        // Nettoyer
        URL.revokeObjectURL(img1.src);
        URL.revokeObjectURL(img2.src);
      }
    }
    
    // ÉTAPE 3: Upload avec fonction corrigée
    console.log('📤 Upload avec fonction corrigée...');
    const referenceURL = await uploadMergedImageFixed(mergedFile, apiKey);
    
    // ÉTAPE 4: Prompt automatique spécialisé iPhone selfie style
    const SELFIE_WITH_STAR_PROMPT = customPrompt || `Take an extremely ordinary and unremarkable iPhone selfie, with no clear subject or sense of composition-just a quick accidental snapshot. The photo has slight motion blur and uneven lighting from streetlights or indoor lamps, causing mild overexposure in some areas. The angle is cute and giving the picture a deliberately mediocre feel, as if it was taken absentmindedly while pulling the phone from a pocket.
The main character is uploaded first person, and the second person next to him/her, both caught in a casual, imperfect moment. The background shows a lively los angeles street light at night, with neon lights, traffic, and blurry figures passing by. The overall look is intentionally plain and random, capturing the authentic vibe of a poorly composed, spontaneous iPhone selfie.`;
    
    console.log('🎨 Génération avec prompt iPhone style...');
    const result = await generateSelfieImage(referenceURL, SELFIE_WITH_STAR_PROMPT, apiKey);
    
    console.log('🎉 [SELFIE EFFECT] SUCCÈS TOTAL !');
    
    return {
      imageURL: result.imageURL,
      taskUUID: result.taskUUID,
      cost: result.cost || 0,
      mergedFileSize: mergedFile.size,
      referenceURL: referenceURL,
      usedPrompt: "Automatic iPhone selfie style",
      platform: Platform.OS
    };
    
  } catch (error) {
    console.error('💥 [SELFIE EFFECT] ERREUR FINALE:', error);
    
    // Messages utilisateur friendly
    if (error.message.includes('Network request failed') || 
        error.message.includes('Failed to fetch') || 
        error.message.includes('Impossible de contacter')) {
      throw new Error('Impossible de contacter l\'API Runware. Vérifiez votre connexion internet et votre clé API.');
    } else if (error.message.includes('401')) {
      throw new Error('Clé API Runware invalide. Vérifiez votre configuration.');
    } else if (error.message.includes('CORS')) {
      throw new Error('Erreur CORS. Contactez le support pour la configuration du domaine.');
    } else if (error.message.includes('Fusion échouée')) {
      throw new Error('Impossible de fusionner les images. Vérifiez le format.');
    } else if (error.message.includes('Clé API')) {
      throw new Error('Problème avec la clé API Runware. Vérifiez votre configuration.');
    } else {
      throw new Error(`Selfie échoué: ${error.message}`);
    }
  }
}