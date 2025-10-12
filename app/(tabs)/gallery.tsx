import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Download, Share, X, RotateCcw, Info, ChevronDown, ChevronUp, Play } from 'lucide-react-native';
import { storageService, StoredImage } from '@/services/storage';
import ProfileHeader from '@/components/ProfileHeader';
import { Video } from 'expo-av';
import { galleryEvents } from '@/services/galleryEvents';

const { width: screenWidth } = Dimensions.get('window');
const imageSize = (screenWidth - 60) / 2;

type MediaType = 'photos' | 'videos';

const VideoThumbnail = ({ item, onPress }: { item: StoredImage; onPress: (item: StoredImage) => void }) => {
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [actualUrl, setActualUrl] = useState<string>(item.url);

  useEffect(() => {
    const loadUrl = async () => {
      if (item.isLocalRef) {
        try {
          const url = await storageService.getImageUrl(item);
          setActualUrl(url);
        } catch (error) {
          console.error('Error loading video URL:', error);
        }
      }
    };
    loadUrl();
  }, [item]);

  const handlePress = useCallback(() => {
    const resolvedUrl = actualUrl && actualUrl.trim() !== '' ? actualUrl : item.url;
    onPress({ ...item, resolvedUrl });
  }, [actualUrl, item, onPress]);

  return (
    <TouchableOpacity
      style={styles.imageItem}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.videoOverlay}>
        <View style={styles.playIconContainer}>
          <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        {item.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(item.duration)}s
            </Text>
          </View>
        )}
      </View>

      <Video
        source={{ uri: actualUrl }}
        style={styles.thumbnailImage}
        resizeMode="cover"
        shouldPlay={false}
        isLooping={false}
        isMuted
        onLoad={() => setThumbnailLoaded(true)}
      />

      {!thumbnailLoaded && (
        <View style={styles.imageLoader}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const ImageThumbnail = ({ item, onPress }: { item: StoredImage; onPress: (item: StoredImage) => void }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [actualImageUrl, setActualImageUrl] = useState<string>(item.url);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, Math.random() * 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadActualUrl = async () => {
      if (item.isLocalRef) {
        try {
          const url = await storageService.getImageUrl(item);
          setActualImageUrl(url);
        } catch (error) {
          console.error('Error loading image URL:', error);
          setImageError(true);
        }
      }
    };
    loadActualUrl();
  }, [item]);

  const handlePress = useCallback(() => {
    const resolvedUrl = !imageError && imageLoaded && actualImageUrl
      ? actualImageUrl
      : item.url;
    onPress({ ...item, resolvedUrl });
  }, [actualImageUrl, imageError, imageLoaded, item, onPress]);

  return (
    <TouchableOpacity
      style={styles.imageItem}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {!imageLoaded && !imageError && (
        <View style={styles.imageLoader}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      )}

      {imageError ? (
        <View style={styles.imageError}>
          <Text style={styles.imageErrorText}>❌</Text>
          <Text style={styles.imageErrorSubtext}>Erreur</Text>
        </View>
      ) : (
        shouldLoad && (
          <Image
            source={{ uri: actualImageUrl }}
            style={[styles.thumbnailImage, { opacity: imageLoaded ? 1 : 0 }]}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            resizeMode="cover"
            fadeDuration={300}
            cache="force-cache"
            priority="normal"
          />
        )
      )}
    </TouchableOpacity>
  );
};

const GalleryItem = ({ item, onPress }: { item: StoredImage; onPress: (item: StoredImage) => void }) => {
  if (item.isVideo) {
    return <VideoThumbnail item={item} onPress={onPress} />;
  }
  return <ImageThumbnail item={item} onPress={onPress} />;
};

export default function Gallery() {
  const [allMedia, setAllMedia] = useState<StoredImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<MediaType>('photos');

  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setSelectedImage(null);
    setShowDetails(false);
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      const storedImages = storageService.getAllImages();
      const storedVideos = storageService.getAllVideos();

      const images: StoredImage[] = storedImages.map(img => ({ ...img, isVideo: false }));
      const videos: StoredImage[] = storedVideos.map(vid => ({ ...vid, isVideo: true }));

      const combined = [...images, ...videos].sort((a, b) => b.timestamp - a.timestamp);

      console.log('Médias chargés:', {
        images: images.length,
        videos: videos.length,
        total: combined.length
      });

      setAllMedia(combined);
    } catch (error) {
      console.error('Erreur lors du chargement des médias:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedia();

    const handleNewMedia = () => {
      console.log('[GALLERY] Nouveau média détecté, rechargement...');
      loadMedia();
    };

    galleryEvents.onNewMedia(handleNewMedia);

    return () => {
      galleryEvents.removeNewMediaListener(handleNewMedia);
    };
  }, [loadMedia]);

  const filteredMedia = useMemo(() => {
    if (activeFilter === 'photos') {
      return allMedia.filter(item => !item.isVideo);
    } else {
      return allMedia.filter(item => item.isVideo);
    }
  }, [allMedia, activeFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMedia();
    setRefreshing(false);
  }, [loadMedia]);

  const handleImagePress = useCallback(async (image: StoredImage) => {
    try {
      console.log('📸 [GALLERY] Ouverture image:', image.id);
      // Résoudre l'URL AVANT d'ouvrir le modal
      const resolvedUrl = await storageService.getImageUrl(image);

      console.log('✅ [GALLERY] URL résolue:', resolvedUrl?.substring(0, 100) || 'vide');

      setSelectedImage({
        ...image,
        resolvedUrl: resolvedUrl || image.url
      });
      setIsModalVisible(true);
      setShowDetails(false);
    } catch (error) {
      console.error('❌ [GALLERY] Erreur résolution URL:', error);
      // Fallback : utiliser l'URL d'origine
      setSelectedImage({ ...image, resolvedUrl: image.url });
      setIsModalVisible(true);
      setShowDetails(false);
    }
  }, []);

  const handleDeleteImage = useCallback((image: StoredImage) => {
    Alert.alert(
      `Supprimer ${image.isVideo ? 'la vidéo' : 'l\'image'}`,
      `Êtes-vous sûr de vouloir supprimer ${image.isVideo ? 'cette vidéo' : 'cette image'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            if (image.isVideo) {
              storageService.deleteVideo(image.id);
            } else {
              storageService.deleteImage(image.id);
            }
            loadMedia();
            if (selectedImage?.id === image.id) {
              handleCloseModal();
            }
          },
        },
      ]
    );
  }, [selectedImage, loadMedia, handleCloseModal]);

  const handleDownloadImage = useCallback(async (image: StoredImage) => {
    setIsDownloading(true);
    try {
      const extension = image.isVideo ? 'mp4' : 'png';
      const filename = `genly-${image.prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${image.timestamp}.${extension}`;
      await storageService.downloadImage(image.url, filename, image);

      const mediaType = image.isVideo ? 'Vidéo' : 'Image';
      const successMessage = Platform.OS === 'web'
        ? `${mediaType} téléchargée avec succès!`
        : `${mediaType} sauvegardée dans votre galerie!`;

      Alert.alert('Succès', successMessage);
    } catch (error) {
      const mediaType = image.isVideo ? 'la vidéo' : 'l\'image';
      Alert.alert('Erreur', error instanceof Error ? error.message : `Impossible de télécharger ${mediaType}`);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const handleShareImage = useCallback(async (image: StoredImage) => {
    setIsSharing(true);
    try {
      await storageService.shareImage(image.url, image.prompt, image);
      
      if (Platform.OS === 'web') {
        Alert.alert('Succès', 'Image partagée avec succès!');
      }
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de partager l\'image');
    } finally {
      setIsSharing(false);
    }
  }, []);

  const handleClearAll = useCallback(() => {
    const mediaType = activeFilter === 'photos' ? 'toutes les images' : 'toutes les vidéos';
    Alert.alert(
      'Vider la galerie',
      `Êtes-vous sûr de vouloir supprimer ${mediaType} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: async () => {
            if (activeFilter === 'photos') {
              await storageService.clearAllImages();
            } else {
              await storageService.clearAllVideos();
            }
            loadMedia();
            handleCloseModal();
          },
        },
      ]
    );
  }, [activeFilter, loadMedia, handleCloseModal]);

  const getCfgDescription = useCallback((value?: number) => {
    if (!value) return '';
    if (value <= 1.5) return 'Très créatif';
    if (value <= 2.5) return 'Créatif';
    if (value <= 4) return 'Équilibré';
    if (value <= 6) return 'Fidèle';
    return 'Très fidèle';
  }, []);

  // Optimisation avec useMemo pour éviter les re-renders inutiles
  const renderImageItem = useCallback(({ item }: { item: StoredImage }) => {
    return <GalleryItem item={item} onPress={handleImagePress} />;
  }, [handleImagePress]);

  const keyExtractor = useCallback((item: StoredImage) => item.id, []);

  const renderEmptyState = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Aucune image générée</Text>
      <Text style={styles.emptySubtitle}>
        Vos images générées apparaîtront ici automatiquement
      </Text>
    </View>
  ), []);

  const renderLoadingState = useMemo(() => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Chargement de la galerie...</Text>
    </View>
  ), []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ProfileHeader />
        <SafeAreaView style={styles.safeArea}>
          {renderLoadingState}
        </SafeAreaView>
      </View>
    );
  }

  const photosCount = allMedia.filter(m => !m.isVideo).length;
  const videosCount = allMedia.filter(m => m.isVideo).length;

  return (
    <View style={styles.container}>
      <ProfileHeader />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Galerie</Text>
          <Text style={styles.subtitle}>
            {photosCount} photo{photosCount !== 1 ? 's' : ''} · {videosCount} vidéo{videosCount !== 1 ? 's' : ''}
          </Text>

          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === 'photos' && styles.filterTabActive
              ]}
              onPress={() => setActiveFilter('photos')}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === 'photos' && styles.filterTabTextActive
              ]}>
                Photos ({photosCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === 'videos' && styles.filterTabActive
              ]}
              onPress={() => setActiveFilter('videos')}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === 'videos' && styles.filterTabTextActive
              ]}>
                Vidéos ({videosCount})
              </Text>
            </TouchableOpacity>
          </View>

          {filteredMedia.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <RotateCcw size={16} color="#FF6B35" />
              <Text style={styles.clearButtonText}>
                Vider {activeFilter === 'photos' ? 'les photos' : 'les vidéos'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredMedia}
          renderItem={renderImageItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                Aucun{activeFilter === 'videos' ? 'e vidéo générée' : 'e photo générée'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Vos {activeFilter === 'videos' ? 'vidéos générées' : 'images générées'} apparaîtront ici
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          // Optimisations de performance améliorées
          removeClippedSubviews={true}
          maxToRenderPerBatch={4} // Réduire encore plus pour éviter les erreurs de quota
          updateCellsBatchingPeriod={100} // Augmenter pour réduire la charge
          initialNumToRender={4} // Réduire le nombre initial
          windowSize={8} // Réduire la fenêtre de rendu
          // Améliore les performances de scroll
          decelerationRate="fast"
          bounces={true}
          bouncesZoom={false}
          // Optimisation mémoire
          legacyImplementation={false}
        />

        {/* Modal pour afficher l'image en grand */}
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseModal}
        >
          <ModalImageView
            selectedImage={selectedImage}
            onClose={handleCloseModal}
            onDownload={handleDownloadImage}
            onShare={handleShareImage}
            onDelete={handleDeleteImage}
            isDownloading={isDownloading}
            isSharing={isSharing}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            getCfgDescription={getCfgDescription}
          />
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// Separate component for modal image view to handle async image loading
const ModalImageView = ({ 
  selectedImage, 
  onClose, 
  onDownload, 
  onShare, 
  onDelete,
  isDownloading,
  isSharing,
  showDetails,
  setShowDetails,
  getCfgDescription
}: {
  selectedImage: StoredImage | null;
  onClose: () => void;
  onDownload: (image: StoredImage) => void;
  onShare: (image: StoredImage) => void;
  onDelete: (image: StoredImage) => void;
  isDownloading: boolean;
  isSharing: boolean;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
  getCfgDescription: (value?: number) => string;
}) => {
  const [actualImageUrl, setActualImageUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!selectedImage) {
      setActualImageUrl('');
      setImageLoading(false);
      return () => {
        isMounted = false;
      };
    }

    console.log('🔄 [MODAL] Chargement image:', {
      id: selectedImage.id,
      hasResolvedUrl: !!selectedImage.resolvedUrl,
      urlPreview: selectedImage.url?.substring(0, 80) || 'vide'
    });

    const hasResolvedUrl = Boolean(selectedImage.resolvedUrl && selectedImage.resolvedUrl.trim() !== '');
    const fallbackUrl = hasResolvedUrl ? selectedImage.resolvedUrl! : selectedImage.url;

    if (hasResolvedUrl) {
      console.log('✅ [MODAL] Utilisation URL résolue directement');
      setActualImageUrl(fallbackUrl);
      setImageLoading(false);
      return () => {
        isMounted = false;
      };
    }

    // Définir l'URL de fallback immédiatement pour éviter l'écran noir
    setActualImageUrl(fallbackUrl);
    setImageLoading(true);

    const loadActualUrl = async () => {
      try {
        console.log('🔄 [MODAL] Chargement asynchrone URL...');
        const url = await storageService.getImageUrl(selectedImage);
        if (!isMounted) return;

        if (url && url.trim() !== '') {
          console.log('✅ [MODAL] URL chargée avec succès');
          setActualImageUrl(url);
        } else {
          console.warn('⚠️ [MODAL] URL vide retournée, utilisation fallback');
          setActualImageUrl(fallbackUrl);
        }
      } catch (error) {
        console.error('❌ [MODAL] Erreur chargement URL:', error);
        if (isMounted) {
          setActualImageUrl(fallbackUrl);
        }
      } finally {
        if (isMounted) {
          setImageLoading(false);
        }
      }
    };

    loadActualUrl();

    return () => {
      isMounted = false;
    };
  }, [selectedImage]);

  if (!selectedImage) return null;

  const getMediaAspectRatio = () => {
    if (selectedImage.isVideo && selectedImage.videoWidth && selectedImage.videoHeight) {
      return selectedImage.videoWidth / selectedImage.videoHeight;
    }
    return 16 / 9;
  };

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.mediaViewContainer}>
          {imageLoading || !actualImageUrl ? (
            <View style={styles.modalImageLoading}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.modalLoadingText}>
                Chargement {selectedImage.isVideo ? 'de la vidéo' : 'de l\'image'}...
              </Text>
            </View>
          ) : selectedImage.isVideo ? (
            <View style={[styles.videoModalContainer, { aspectRatio: getMediaAspectRatio() }]}>
              <Video
                source={{ uri: actualImageUrl }}
                style={styles.mediaFill}
                resizeMode="contain"
                shouldPlay
                isLooping
                useNativeControls
              />
            </View>
          ) : (
            <Image
              source={{ uri: actualImageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
              cache="force-cache"
              priority="high"
            />
          )}
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.modalActionButton, isDownloading && styles.modalActionButtonDisabled]}
            onPress={() => onDownload(selectedImage)}
            disabled={isDownloading}
          >
            <Download size={20} color="#007AFF" />
            <Text style={styles.modalActionText}>
              {isDownloading ? 'Téléchargement...' : Platform.OS === 'web' ? 'Télécharger' : 'Sauvegarder'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalActionButton, isSharing && styles.modalActionButtonDisabled]}
            onPress={() => onShare(selectedImage)}
            disabled={isSharing}
          >
            <Share size={20} color="#007AFF" />
            <Text style={styles.modalActionText}>
              {isSharing ? 'Partage...' : 'Partager'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={() => onDelete(selectedImage)}
          >
            <Trash2 size={20} color="#FF3B30" />
            <Text style={[styles.modalActionText, styles.deleteText]}>Supprimer</Text>
          </TouchableOpacity>
        </View>

        {/* Bouton pour afficher/masquer les détails */}
        <TouchableOpacity
          style={styles.detailsToggleButton}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Info size={20} color="#007AFF" />
          <Text style={styles.detailsToggleText}>
            {showDetails ? 'Masquer les détails' : 'Voir les détails'}
          </Text>
          {showDetails ? (
            <ChevronUp size={20} color="#007AFF" />
          ) : (
            <ChevronDown size={20} color="#007AFF" />
          )}
        </TouchableOpacity>

        {showDetails && (
          <View style={styles.imageDetails}>
            <Text style={styles.detailTitle}>
              Détails {selectedImage.isVideo ? 'de la vidéo' : 'de l\'image'}
            </Text>
            <Text style={styles.detailText}>
              <Text style={styles.detailLabel}>Prompt: </Text>
              "{selectedImage.prompt}"
            </Text>
            {selectedImage.isVideo && selectedImage.duration && (
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Durée: </Text>
                {Math.floor(selectedImage.duration)} secondes
              </Text>
            )}
            {selectedImage.style && selectedImage.style !== 'No Style' && (
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Style: </Text>
                {selectedImage.style}
              </Text>
            )}
            {selectedImage.model && (
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Modèle: </Text>
                {selectedImage.model}
              </Text>
            )}
            {selectedImage.format && (
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Format: </Text>
                {selectedImage.format} {selectedImage.dimensions && `(${selectedImage.dimensions})`}
              </Text>
            )}
            {selectedImage.cfgScale && (
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Respect du prompt: </Text>
                {selectedImage.cfgScale.toFixed(1)} ({getCfgDescription(selectedImage.cfgScale)})
              </Text>
            )}
            {selectedImage.negativePrompt && (
              <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>Prompt négatif: </Text>
                "{selectedImage.negativePrompt}"
              </Text>
            )}
            <Text style={styles.detailText}>
              <Text style={styles.detailLabel}>Généré le: </Text>
              {new Date(selectedImage.timestamp).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    alignItems: 'center',
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    width: '90%',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterTabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE5E5',
    gap: 6,
  },
  clearButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  playIconContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 40,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
  gridContainer: {
    padding: 20,
    paddingTop: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  imageItem: {
    width: imageSize,
    height: imageSize,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  imageLoader: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    gap: 8,
  },
  imageError: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
  },
  imageErrorText: {
    fontSize: 24,
    marginBottom: 4,
  },
  imageErrorSubtext: {
    fontSize: 12,
    color: '#666666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  mediaViewContainer: {
    width: '100%',
    maxHeight: '70%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalImageLoading: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  modalLoadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  fullImage: {
    width: '100%',
    height: '60%',
  },
  videoModalContainer: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaFill: {
    width: '100%',
    height: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  modalActionButtonDisabled: {
    opacity: 0.6,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  deleteText: {
    color: '#FF3B30',
  },
  detailsToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 10,
  },
  detailsToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  imageDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    marginTop: 0,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
    lineHeight: 20,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#000000',
  },
});