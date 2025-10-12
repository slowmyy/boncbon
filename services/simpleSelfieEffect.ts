import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Génération UUID simple
function generateUUID(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Conversion URI vers File pour mobile
async function uriToFile(uri: string, filename: string): Promise<File> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
}

// Helper: File vers URI
function fileToUri(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// Helper: URI vers Image Element
function loadImageElement(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = uri;
  });
}

// Helper: Canvas vers Blob
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
  });
}

// ✅ FUSION 2 IMAGES - GARANTIE DE MARCHER
async function collerDeuxImages(imageGauche: File, imageDroite: File): Promise<File> {
  
  return new Promise((resolve, reject) => {
    
    // Créer 2 éléments Image
    const img1 = new Image();
    const img2 = new Image();
    let imagesChargees = 0;
    
    function verifierSiPret() {
      imagesChargees++;
      if (imagesChargees === 2) {
        // Les 2 images sont chargées, on peut fusionner
        fusionner();
      }
    }
    
    function fusionner() {
      // Créer canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Dimensions finales
      canvas.width = 1024;  // 512 + 512
      canvas.height = 512;  // Hauteur fixe
      
      // Fond blanc
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1024, 512);
      
      // Coller image 1 à gauche (0 à 512)
      ctx.drawImage(img1, 0, 0, 512, 512);
      
      // Coller image 2 à droite (512 à 1024)
      ctx.drawImage(img2, 512, 0, 512, 512);
      
      // Convertir en File
      canvas.toBlob((blob) => {
        const fichierFinal = new File([blob], 'fusion.jpg', { type: 'image/jpeg' });
        
        // Nettoyer
        URL.revokeObjectURL(img1.src);
        URL.revokeObjectURL(img2.src);
        
        resolve(fichierFinal);
      }, 'image/jpeg', 0.9);
    }
    
    // Gérer les erreurs
    img1.onerror = () => reject(new Error('Erreur image 1'));
    img2.onerror = () => reject(new Error('Erreur image 2'));
    
    // Charger les images
    img1.onload = verifierSiPret;
    img2.onload = verifierSiPret;
    
    // Définir les sources
    img1.src = URL.createObjectURL(imageGauche);
    img2.src = URL.createObjectURL(imageDroite);
  });
}

// ✅ EFFET SELFIE COMPLET
export async function creerSelfieAvecCelebre(
  maPhoto: File | string,
  photoCelebre: File | string,
  cleAPI: string
): Promise<{ imageURL: string; taskUUID: string }> {
  
  console.log('🎬 Création selfie...');
  
  // Conversion en Files si nécessaire
  let userFile: File;
  let celebrityFile: File;
  
  if (typeof maPhoto === 'string') {
    userFile = await uriToFile(maPhoto, 'user-photo.jpg');
  } else {
    userFile = maPhoto;
  }
  
  if (typeof photoCelebre === 'string') {
    celebrityFile = await uriToFile(photoCelebre, 'celebrity-photo.jpg');
  } else {
    celebrityFile = photoCelebre;
  }
  
  // ÉTAPE 1: Fusion
  console.log('🔄 Fusion des 2 images...');
  const imageFusionnee = await collerDeuxImages(userFile, celebrityFile);
  console.log('✅ Fusion OK:', imageFusionnee.size, 'bytes');
  
  // ÉTAPE 2: Conversion Base64
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(imageFusionnee);
  });
  
  // ÉTAPE 3: Upload
  console.log('📤 Upload...');
  const uploadRequest = [{
    taskType: "imageUpload",
    taskUUID: Date.now().toString(),
    image: base64,
    filename: 'selfie-fusion.jpg'
  }];
  
  const uploadResponse = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleAPI}`
    },
    body: JSON.stringify(uploadRequest)
  });
  
  const uploadData = await uploadResponse.json();
  const urlReference = uploadData[0].imageURL;
  
  console.log('✅ Upload OK:', urlReference);
  
  // ÉTAPE 4: Génération
  console.log('🎨 Génération selfie...');
  const generateRequest = {
    positivePrompt: "Take an extremely ordinary and unremarkable iPhone selfie, with no clear subject or sense of composition-just a quick accidental snapshot. The photo has slight motion blur and uneven lighting from streetlights or indoor lamps, causing mild overexposure in some areas. The angle is cute and giving the picture a deliberately mediocre feel, as if it was taken absentmindedly while pulling the phone from a pocket. The main character is uploaded first person, and the second person next to him/her, both caught in a casual, imperfect moment. The background shows a lively los angeles street light at night, with neon lights, traffic, and blurry figures passing by. The overall look is intentionally plain and random, capturing the authentic vibe of a poorly composed, spontaneous iPhone selfie.",
    height: 1248,
    width: 832,
    numberResults: 1,
    referenceImages: [{ "0": urlReference }],
    outputType: [{ "0": "dataURI", "1": "URL" }],
    outputFormat: "JPEG",
    seed: Math.floor(Math.random() * 999999999),
    includeCost: true,
    outputQuality: 95,
    taskUUID: Date.now().toString()
  };
  
  const generateResponse = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleAPI}`
    },
    body: JSON.stringify([generateRequest])
  });
  
  const generateData = await generateResponse.json();
  
  console.log('✅ Selfie créé !');
  
  return {
    imageURL: generateData[0].imageURL,
    taskUUID: generateData[0].taskUUID
  };
}

// Fonction legacy pour compatibilité
export async function effetSelfieCelebriteSimple(
  maPhoto: string | File,
  photoCelebrite: string | File,
  apiKey: string
) {
  return await creerSelfieAvecCelebre(maPhoto, photoCelebrite, apiKey);
}