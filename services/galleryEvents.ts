class GalleryEventEmitter {
  private listeners: Set<() => void> = new Set();

  notifyNewMedia() {
    console.log('[GALLERY_EVENTS] Notification nouveau média, listeners:', this.listeners.size);
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[GALLERY_EVENTS] Erreur dans listener:', error);
      }
    });
  }

  onNewMedia(callback: () => void) {
    console.log('[GALLERY_EVENTS] Ajout listener');
    this.listeners.add(callback);
  }

  removeNewMediaListener(callback: () => void) {
    console.log('[GALLERY_EVENTS] Retrait listener');
    this.listeners.delete(callback);
  }
}

export const galleryEvents = new GalleryEventEmitter();
