import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ✅ FUSION SANS CANVAS - EXPO SEULEMENT
export async function fusionImagesMobile(
  image1: File, 
  image2: File
): Promise<string> {
  
  console.log('🔄 Fusion mobile sans canvas...');
  
  try {
    // 1. Convertir Files en base64
    const base64_1 = await fileToBase64(image1);
    const base64_2 = await fileToBase64(image2);
    
    // 2. Sauvegarder temporairement
    const tempDir = FileSystem.cacheDirectory + 'temp/';
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    
    const uri1 = tempDir + 'img1.jpg';
    const uri2 = tempDir + 'img2.jpg';
    
    await FileSystem.writeAsStringAsync(uri1, base64_1, { 
      encoding: FileSystem.EncodingType.Base64 
    });
    await FileSystem.writeAsStringAsync(uri2, base64_2, { 
      encoding: FileSystem.EncodingType.Base64 
    });
    
    console.log('✅ Images sauvées temporairement');
    
    // 3. Redimensionner à 512x512 chacune
    const resized1 = await ImageManipulator.manipulateAsync(
      uri1,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const resized2 = await ImageManipulator.manipulateAsync(
      uri2, 
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    console.log('✅ Images redimensionnées');
    
    // 4. Lire les images redimensionnées en base64
    const final1 = await FileSystem.readAsStringAsync(resized1.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    const final2 = await FileSystem.readAsStringAsync(resized2.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    // 5. Créer SVG avec les 2 images côte à côte
    const svgContent = `
      <svg width="1024" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="512" fill="white"/>
        <image href="data:image/jpeg;base64,${final1}" x="0" y="0" width="512" height="512"/>
        <image href="data:image/jpeg;base64,${final2}" x="512" y="0" width="512" height="512"/>
      </svg>
    `;
    
    // 6. Sauvegarder le SVG et le convertir
    const svgUri = tempDir + 'fusion.svg';
    await FileSystem.writeAsStringAsync(svgUri, svgContent);
    
    console.log('✅ SVG créé');
    
    // 7. Convertir SVG en JPEG avec ImageManipulator
    const finalImage = await ImageManipulator.manipulateAsync(
      svgUri,
      [],
      { 
        compress: 0.9, 
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    console.log('✅ Fusion terminée:', finalImage.uri);
    
    // 8. Nettoyer les fichiers temporaires
    await FileSystem.deleteAsync(tempDir, { idempotent: true });
    
    return finalImage.uri;
    
  } catch (error) {
    console.error('❌ Erreur fusion mobile:', error);
    throw new Error('Fusion impossible sur mobile');
  }
}

// ✅ EFFET SELFIE MOBILE
export async function effetSelfieMobile(
  maPhoto: File | string,
  photoCelebre: File | string, 
  apiKey: string
) {
  console.log('🎬 Effet selfie mobile...');
  
  try {
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
    
    // 1. Fusion mobile
    const uriFusion = await fusionImagesMobile(userFile, celebrityFile);
    
    // 2. Lire l'image fusionnée
    const base64Fusion = await FileSystem.readAsStringAsync(uriFusion, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    // 3. Upload à l'API
    const uploadRequest = [{
      taskType: "imageUpload",
      taskUUID: generateUUID(),
      image: base64Fusion,
      filename: 'fusion-mobile.jpg'
    }];
    
    const uploadResponse = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(uploadRequest)
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const uploadData = await uploadResponse.json();
    const urlReference = uploadData[0]?.imageURL || uploadData[0]?.url || uploadData[0]?.image_url;
    
    if (!urlReference) {
      throw new Error('Upload raté - pas d\'URL');
    }
    
    console.log('✅ Upload mobile OK');
    
    // 4. Génération
    const generateRequest = {
      taskType: "imageInference",
      taskUUID: generateUUID(),
      positivePrompt: "Take an extremely ordinary and unremarkable iPhone selfie, with no clear subject or sense of composition-just a quick accidental snapshot. The photo has slight motion blur and uneven lighting from streetlights or indoor lamps, causing mild overexposure in some areas. The angle is cute and giving the picture a deliberately mediocre feel, as if it was taken absentmindedly while pulling the phone from a pocket. The main character is uploaded first person, and the second person next to him/her, both caught in a casual, imperfect moment. The background shows a lively los angeles street light at night, with neon lights, traffic, and blurry figures passing by. The overall look is intentionally plain and random, capturing the authentic vibe of a poorly composed, spontaneous iPhone selfie.",
      model: "bfl:3@1",
      height: 1248,
      width: 832, 
      numberResults: 1,
      referenceImages: [urlReference],
      outputType: ["dataURI", "URL"],
      outputFormat: "JPEG",
      seed: Math.floor(Math.random() * 999999999),
      includeCost: true,
      outputQuality: 95
    };
    
    const generateResponse = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify([generateRequest])
    });
    
    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      throw new Error(`Generate failed: ${generateResponse.status} - ${errorText}`);
    }
    
    const generateData = await generateResponse.json();
    
    const imageURL = generateData[0]?.imageURL || generateData[0]?.imagePath;
    if (!imageURL) {
      throw new Error('Génération ratée - pas d\'image');
    }
    
    console.log('✅ Selfie mobile créé !');
    
    return {
      imageURL: imageURL,
      taskUUID: generateData[0].taskUUID,
      cost: generateData[0].cost || 0,
      platform: Platform.OS
    };
    
  } catch (error) {
    console.error('❌ Erreur effet selfie mobile:', error);
    throw error;
  }
}