import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { galleryEvents } from './galleryEvents';

interface StoredImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  model?: string;
  cfgScale?: number;
  negativePrompt?: string;
  format?: string;
  dimensions?: string;
  style?: string;
  isLocalRef?: boolean;
  isVideo?: boolean;
  duration?: number;
  videoWidth?: number;
  videoHeight?: number;
  resolvedUrl?: string;
}

class StorageService {
  private readonly STORAGE_KEY = 'genly_generated_images';
  private readonly VIDEOS_STORAGE_KEY = 'genly_generated_videos';
  private readonly IDB_NAME = 'GenlyImageStorage';
  private readonly IDB_VERSION = 1;
  private readonly IDB_STORE = 'images';
  private readonly MAX_VIDEOS = 50;

  // IndexedDB helper methods for web
  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = window.indexedDB.open(this.IDB_NAME, this.IDB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.IDB_STORE)) {
          db.createObjectStore(this.IDB_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  private async saveImageToIndexedDB(id: string, dataUrl: string): Promise<void> {
    if (Platform.OS !== 'web') return;

    try {
      // Convert data URL to blob BEFORE opening the transaction
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.IDB_STORE], 'readwrite');
      const store = transaction.objectStore(this.IDB_STORE);
      
      // Use both request success and transaction complete events
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ id, blob });
        
        let requestCompleted = false;
        let transactionCompleted = false;
        
        const checkCompletion = () => {
          if (requestCompleted && transactionCompleted) {
            resolve();
          }
        };
        
        request.onsuccess = () => {
          requestCompleted = true;
          checkCompletion();
        };
        request.onerror = () => reject(request.error);
        
        transaction.oncomplete = () => {
          transactionCompleted = true;
          checkCompletion();
        };
        transaction.onerror = () => reject(transaction.error);
      });
      
      db.close();
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
      throw error;
    }
  }

  private async loadImageFromIndexedDB(id: string): Promise<string | null> {
    if (Platform.OS !== 'web') return null;

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.IDB_STORE], 'readonly');
      const store = transaction.objectStore(this.IDB_STORE);
      
      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      
      if (result && result.blob) {
        // Convert blob back to data URL
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(result.blob);
        });
      }
      
      return null;
    } catch (error) {
      console.error('Error loading from IndexedDB:', error);
      return null;
    }
  }

  private async deleteImageFromIndexedDB(id: string): Promise<void> {
    if (Platform.OS !== 'web') return;

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.IDB_STORE], 'readwrite');
      const store = transaction.objectStore(this.IDB_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.error('Error deleting from IndexedDB:', error);
    }
  }

  private async clearIndexedDB(): Promise<void> {
    if (Platform.OS !== 'web') return;

    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction([this.IDB_STORE], 'readwrite');
      const store = transaction.objectStore(this.IDB_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
    }
  }

  // File system helper methods for native
  private async saveImageToFileSystem(id: string, dataUrl: string): Promise<string> {
    if (Platform.OS === 'web') return dataUrl;

    try {
      const fileUri = FileSystem.documentDirectory + `genly_${id}.png`;
      
      // Extract base64 data from data URL
      const base64Data = dataUrl.split(',')[1];
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return fileUri;
    } catch (error) {
      console.error('Error saving to file system:', error);
      return dataUrl; // Fallback to original
    }
  }

  private async loadImageFromFileSystem(fileUri: string): Promise<string | null> {
    if (Platform.OS === 'web') return fileUri;

    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        const base64Data = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return `data:image/png;base64,${base64Data}`;
      }
      return null;
    } catch (error) {
      console.error('Error loading from file system:', error);
      return null;
    }
  }

  private async deleteImageFromFileSystem(fileUri: string): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Error deleting from file system:', error);
    }
  }

  // Public method to get actual image URL (handles local references)
  async getImageUrl(image: StoredImage): Promise<string> {
    if (!image.isLocalRef) {
      return image.url;
    }

    if (Platform.OS === 'web') {
      const dataUrl = await this.loadImageFromIndexedDB(image.id);
      return dataUrl || image.url;
    } else {
      const dataUrl = await this.loadImageFromFileSystem(image.url);
      return dataUrl || image.url;
    }
  }

  // Sauvegarder une image dans le stockage local
  async saveImage(image: Omit<StoredImage, 'id'>): Promise<StoredImage> {
    const storedImage: StoredImage = {
      ...image,
      id: this.generateId(),
      isLocalRef: false,
      isVideo: image.isVideo || false,
      duration: image.duration,
    };

    // Check if the URL is a large base64 data URL
    const isLargeDataUrl = image.url.startsWith('data:image/') && image.url.length > 5000;

    if (isLargeDataUrl) {
      try {
        if (Platform.OS === 'web') {
          // Save to IndexedDB and store reference
          await this.saveImageToIndexedDB(storedImage.id, image.url);
          storedImage.url = `local_idb://${storedImage.id}`;
          storedImage.isLocalRef = true;
        } else {
          // Save to file system and store file path
          const fileUri = await this.saveImageToFileSystem(storedImage.id, image.url);
          storedImage.url = fileUri;
          storedImage.isLocalRef = true;
        }
      } catch (error) {
        console.error('Error saving large image data:', error);
        // Fallback: save with external URL if available, otherwise skip large data storage
        console.warn('Falling back to external URL storage due to quota limits');
        // Don't throw error, just continue without local storage
      }
    }

    if (storedImage.isVideo) {
      const existingVideos = this.getAllVideos();
      const updatedVideos = [storedImage, ...existingVideos].slice(0, this.MAX_VIDEOS);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(this.VIDEOS_STORAGE_KEY, JSON.stringify(updatedVideos));
          console.log('[STORAGE] Video saved successfully:', storedImage.id);
          galleryEvents.notifyNewMedia();
        } catch (error) {
          console.error('[STORAGE] Error saving video:', error);
        }
      }

      return storedImage;
    }

    const existingImages = this.getAllImages();
    const updatedImages = [storedImage, ...existingImages];
    
    // Limiter à 5 images maximum pour éviter de surcharger le stockage
    const limitedImages = updatedImages.slice(0, 5);
    
    // Clean up old images that were removed from the limit
    const removedImages = updatedImages.slice(5);
    for (const removedImage of removedImages) {
      if (removedImage.isLocalRef) {
        if (Platform.OS === 'web') {
          await this.deleteImageFromIndexedDB(removedImage.id);
        } else {
          await this.deleteImageFromFileSystem(removedImage.url);
        }
      }
    }
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedImages));
        galleryEvents.notifyNewMedia();
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        throw new Error('Unable to save image metadata');
      }
    }

    return storedImage;
  }

  getAllVideos(): StoredImage[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.VIDEOS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading videos from storage:', error);
      return [];
    }
  }

  deleteVideo(id: string): void {
    const videos = this.getAllVideos();
    const filteredVideos = videos.filter(vid => vid.id !== id);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.VIDEOS_STORAGE_KEY, JSON.stringify(filteredVideos));
    }
  }

  clearAllVideos(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.VIDEOS_STORAGE_KEY);
    }
  }

  getAllImages(): StoredImage[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading images from storage:', error);
      return [];
    }
  }

  // Supprimer une image
  async deleteImage(id: string): Promise<void> {
    const images = this.getAllImages();
    const imageToDelete = images.find(img => img.id === id);
    
    if (imageToDelete && imageToDelete.isLocalRef) {
      if (Platform.OS === 'web') {
        await this.deleteImageFromIndexedDB(id);
      } else {
        await this.deleteImageFromFileSystem(imageToDelete.url);
      }
    }
    
    const filteredImages = images.filter(img => img.id !== id);
    
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredImages));
    }
  }

  // Vider toute la galerie
  async clearAllImages(): Promise<void> {
    const images = this.getAllImages();
    
    // Clean up all local references
    for (const image of images) {
      if (image.isLocalRef) {
        if (Platform.OS === 'web') {
          await this.deleteImageFromIndexedDB(image.id);
        } else {
          await this.deleteImageFromFileSystem(image.url);
        }
      }
    }
    
    // Clear IndexedDB completely
    await this.clearIndexedDB();
    
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // Télécharger une image - Compatible mobile et web
  async downloadImage(url: string, filename?: string, image?: StoredImage): Promise<void> {
    try {
      const isVideo = image?.isVideo || false;
      const extension = isVideo ? 'mp4' : 'png';
      const finalFilename = filename || `genly-${isVideo ? 'video' : 'image'}-${Date.now()}.${extension}`;
      let actualUrl = url;

      // If it's a local reference, get the actual image data
      if (image && image.isLocalRef) {
        actualUrl = await this.getImageUrl(image);
      }

      if (Platform.OS === 'web') {
        // Web: Utiliser le téléchargement classique
        const response = await fetch(actualUrl);
        const blob = await response.blob();

        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = finalFilename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(downloadUrl);
      } else {
        // Mobile: Utiliser expo-file-system et expo-media-library

        // 1. Demander les permissions pour la galerie
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Permission d\'accès à la galerie refusée');
        }

        // 2. Télécharger l'image dans le cache
        const fileUri = FileSystem.documentDirectory + finalFilename;
        const downloadResult = await FileSystem.downloadAsync(actualUrl, fileUri);

        if (downloadResult.status !== 200) {
          throw new Error(`Échec du téléchargement ${isVideo ? 'de la vidéo' : 'de l\'image'}`);
        }

        // 3. Sauvegarder dans la galerie
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('Genly', asset, false);

        // 4. Nettoyer le fichier temporaire
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      }
    } catch (error) {
      console.error('Error downloading media:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Impossible de télécharger le média'
      );
    }
  }

  // Partager une image - Compatible mobile et web
  async shareImage(url: string, prompt: string, image?: StoredImage): Promise<void> {
    try {
      let actualUrl = url;

      // If it's a local reference, get the actual image data
      if (image && image.isLocalRef) {
        actualUrl = await this.getImageUrl(image);
      }

      if (Platform.OS === 'web') {
        // Web: Utiliser l'API Web Share ou fallback clipboard
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Generated with Genly',
              text: `Check out this AI-generated image: "${prompt}"`,
              url: actualUrl,
            });
            return;
          } catch (shareError) {
            // Si le partage échoue, on continue vers le fallback
          }
        }
        
        // Fallback: Copier l'URL dans le presse-papiers
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(actualUrl);
        }
      } else {
        // Mobile: Utiliser expo-sharing
        
        // 1. Vérifier si le partage est disponible
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          throw new Error('Le partage n\'est pas disponible sur cet appareil');
        }

        // 2. Télécharger l'image temporairement
        const filename = `genly-share-${Date.now()}.png`;
        const fileUri = FileSystem.cacheDirectory + filename;
        const downloadResult = await FileSystem.downloadAsync(actualUrl, fileUri);
        
        if (downloadResult.status !== 200) {
          throw new Error('Impossible de préparer l\'image pour le partage');
        }

        // 3. Partager l'image
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager l\'image générée',
        });

        // 4. Nettoyer le fichier temporaire après un délai
        setTimeout(async () => {
          try {
            await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
          } catch (cleanupError) {
            console.warn('Erreur lors du nettoyage du fichier temporaire:', cleanupError);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Impossible de partager l\'image'
      );
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const storageService = new StorageService();
export type { StoredImage };