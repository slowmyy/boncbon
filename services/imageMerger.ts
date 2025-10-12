export interface MergedImageResult {
  file: File;
  width: number;
  height: number;
  size: number;
}

// Fonction pour convertir File en Image
function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Erreur chargement image'));
    img.src = URL.createObjectURL(file);
  });
}

// ✅ FONCTION DE FUSION CORRIGÉE
export async function mergeImagesForSelfieFixed(
  leftImage: File, 
  rightImage: File
): Promise<File> {
  
  console.log('🔄 [MERGE] Fusion d\'images améliorée');
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Canvas non supporté'));
      return;
    }
    
    // Dimensions optimisées pour Runware API
    const finalWidth = 1280;
    const finalHeight = 832;
    const halfWidth = 640;
    
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    // Fond blanc
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, finalWidth, finalHeight);
    
    let loadedCount = 0;
    const images = [new Image(), new Image()];
    
    function onImageLoad() {
      loadedCount++;
      console.log(`📸 Image ${loadedCount}/2 chargée`);
      
      if (loadedCount === 2) {
        try {
          // Dessiner image gauche
          ctx.drawImage(images[0], 0, 0, halfWidth, finalHeight);
          
          // Dessiner image droite
          ctx.drawImage(images[1], halfWidth, 0, halfWidth, finalHeight);
          
          console.log('🎨 Images dessinées sur canvas');
          
          // Convertir en blob avec qualité élevée
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Erreur création blob'));
              return;
            }
            
            const mergedFile = new File(
              [blob], 
              'selfie-merged.jpg', 
              { 
                type: 'image/jpeg',
                lastModified: Date.now()
              }
            );
            
            console.log('✅ [MERGE] Fusion terminée:', mergedFile.size, 'bytes');
            
            // Nettoyer
            URL.revokeObjectURL(images[0].src);
            URL.revokeObjectURL(images[1].src);
            
            resolve(mergedFile);
            
          }, 'image/jpeg', 0.9);
          
        } catch (drawError) {
          console.error('❌ Erreur dessin:', drawError);
          reject(new Error('Erreur fusion images'));
        }
      }
    }
    
    function onImageError(error: any) {
      console.error('❌ Erreur chargement image:', error);
      reject(new Error('Erreur chargement image'));
    }
    
    // Charger les images
    images[0].onload = onImageLoad;
    images[1].onload = onImageLoad;
    images[0].onerror = onImageError;
    images[1].onerror = onImageError;
    
    // Créer les URLs
    try {
      images[0].src = URL.createObjectURL(leftImage);
      images[1].src = URL.createObjectURL(rightImage);
      console.log('🔗 URLs créées pour les images');
    } catch (urlError) {
      console.error('❌ Erreur création URL:', urlError);
      reject(new Error('Erreur création URL'));
    }
  });
}

// FONCTION PRINCIPALE DE FUSION (legacy - gardée pour compatibilité)
export async function mergeImagesForSelfie(
  leftImage: File, 
  rightImage: File
): Promise<MergedImageResult> {
  
  console.log('🔄 [MERGE] Début fusion images');
  console.log('📁 Image gauche:', leftImage.name, leftImage.size);
  console.log('📁 Image droite:', rightImage.name, rightImage.size);
  
  try {
    // Utiliser la nouvelle fonction corrigée
    const mergedFile = await mergeImagesForSelfieFixed(leftImage, rightImage);
    
    return {
      file: mergedFile,
      width: 1280,
      height: 832,
      size: mergedFile.size
    };
    
  } catch (error) {
    console.error('❌ [MERGE] Erreur fusion:', error);
    throw new Error(`Fusion échouée: ${error}`);
  }
}

// Test de la fusion (pour validation)
export async function testImageMerging(): Promise<MergedImageResult> {
  console.log('🧪 Test fusion images...');
  
  // Créer 2 images de test colorées
  const canvas1 = document.createElement('canvas');
  const ctx1 = canvas1.getContext('2d')!;
  canvas1.width = 200;
  canvas1.height = 200;
  ctx1.fillStyle = '#FF0000'; // Rouge
  ctx1.fillRect(0, 0, 200, 200);
  
  const canvas2 = document.createElement('canvas');
  const ctx2 = canvas2.getContext('2d')!;
  canvas2.width = 200;
  canvas2.height = 200;
  ctx2.fillStyle = '#0000FF'; // Bleu
  ctx2.fillRect(0, 0, 200, 200);
  
  // Convertir en Files
  const blob1 = await new Promise<Blob>(resolve => canvas1.toBlob(resolve!));
  const blob2 = await new Promise<Blob>(resolve => canvas2.toBlob(resolve!));
  
  const file1 = new File([blob1], 'test1.jpg', { type: 'image/jpeg' });
  const file2 = new File([blob2], 'test2.jpg', { type: 'image/jpeg' });
  
  // Tester la fusion
  const result = await mergeImagesForSelfie(file1, file2);
  console.log('✅ Test fusion OK:', result);
  
  return result;
}