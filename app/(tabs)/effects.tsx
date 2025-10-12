import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CreditCard,
  Star,
  RotateCcw,
  Package,
  Upload,
  Download,
  Share,
  ArrowLeft,
  Sparkles,
  Play,
  Film
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { runwareService } from '@/services/runware';
import { storageService } from '@/services/storage';
import {
  pixverseService,
  PIXVERSE_EFFECTS,
  PIXVERSE_STYLES
} from '@/services/pixverse';
import ProfileHeader from '@/components/ProfileHeader';

type EffectType = 'image' | 'pixverse_video';

interface Effect {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  backgroundColor: string;
  slots: number;
  prompt: string;
  type: EffectType;
  pixverseEffectId?: string;
}

const IMAGE_EFFECTS: Effect[] = [
  {
    id: 'celebrity',
    title: 'Celebrity IA',
    description: 'Avec une star',
    icon: Star,
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
    slots: 2,
    type: 'image',
    prompt: 'Take a photo taken with a Polaroid camera. The photo should look like an ordinary photograph, without an explicit subject or property. The photo should have a slight blur and a consistent light source, like a flash from a dark room, scattered throughout the photo. Don\'t change the face. Change the background behind those two people with white curtains. With that boy standing next to me.'
  },
  {
    id: 'footballcard',
    title: 'Football Card',
    description: 'Carte de joueur',
    icon: CreditCard,
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    slots: 1,
    type: 'image',
    prompt: 'Transforme le personnage en joueur de football style rendu AAA. Pose 3/4 dynamique sur pelouse de stade nocturne. Maillot générique (couleurs personnalisées) sans blason ni sponsor réels. Crée aussi une carte joueur type "Ultimate" avec note globale, poste, et 6 stats (PAC, SHO, PAS, DRI, DEF, PHY) - valeurs fictives. Sur l\'écran d\'ordinateur, montre l\'interface de création de la carte (avant→après). Détails sueur/herbe, DOF léger. Aucune marque officielle. Très haute définition.'
  },
  {
    id: 'polaroid',
    title: 'Polaroid',
    description: 'Style vintage',
    icon: Camera,
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    slots: 2,
    type: 'image',
    prompt: 'Create an image, Take a photo taken with a Polaroid camera. The photo should look like an ordinary photograph, without an explicit subject or property. The photo should have a slight blur and a a dark consistent light source, like a flash from room, scattered throughout the photo. Don\'t Change the face. Change the background behind those two people with White curtains. With me hugging my young self'
  },
  {
    id: 'restoration',
    title: 'Photo-Restauration',
    description: 'Réparer une photo',
    icon: RotateCcw,
    color: '#8B5CF6',
    backgroundColor: '#F3E8FF',
    slots: 1,
    type: 'image',
    prompt: 'Restore and colorize this vintage photograph with ultra-realism. Keep the exact same people, outfits, poses, and background without alteration. Transform the capture as if it were taken today by a professional portrait photographer with high-end modern equipment. Apply vibrant, cinematic color grading with deep saturation, balanced contrast, and studio-level lighting. Sharpen details, enhance textures, and improve clarity while preserving authenticity and natural appearance. High-definition, photorealistic, professional quality.'
  },
  {
    id: 'figurine',
    title: 'Figurine AI',
    description: 'Créer une figurine',
    icon: Package,
    color: '#059669',
    backgroundColor: '#F0FDF4',
    slots: 1,
    type: 'image',
    prompt: 'Crée une figurine commercialisée à l\'échelle 1/7 des personnages de l\'image, dans un style réaliste et dans un environnement réel. La figurine est posée sur un bureau d\'ordinateur. Elle possède un socle rond en acrylique transparent, sans aucun texte sur le socle. Le contenu affiché sur l\'écran d\'ordinateur est le processus de modélisation 3D de cette figurine. À côté de l\'écran se trouve une boite d\'emballage du jouet, conçue dans un style évoquant les figurines de collection haut de gamme, imprimée avec des illustrations originales. L\'emballage présente des illustrations 2D à plat.'
  },
  {
    id: 'homeless',
    title: 'Homeless Prank',
    description: 'Ajouter un SDF',
    icon: Sparkles,
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    slots: 1,
    type: 'image',
    prompt: 'Inpaint a realistic homeless person (adult) naturally integrated into the uploaded photo. The person must match the original camera perspective, lighting, colors, shadows and grain. Placement: context-appropriate (e.g., if indoors → sleeping in bed or sitting against wall; if outdoors → standing by the door, leaning on steps). Appearance: worn but neutral clothing (hoodie, jacket, scarf, beanie, old backpack). Clothing must not contain logos, text, or offensive elements. Skin tone, gender, and age can adapt to the scene for maximum realism. Preserve all other details of the original photo unchanged. Final result must be photorealistic, ultra-detailed, natural skin texture, no sharp edges or cutouts.'
  }
];

const PIXVERSE_VIDEO_EFFECTS: Effect[] = PIXVERSE_EFFECTS.slice(0, 12).map(effect => ({
  id: `pixverse_${effect.id}`,
  title: effect.name,
  description: effect.description,
  icon: Film,
  color: '#FF6B35',
  backgroundColor: '#FFF5F0',
  slots: effect.requiresImage ? (effect.maxImages || 1) : 0,
  type: 'pixverse_video' as EffectType,
  pixverseEffectId: effect.id,
  prompt: `Create an amazing ${effect.name} video effect`
}));

export default function Effects() {
  const [selectedEffect, setSelectedEffect] = useState<Effect | null>(null);
  const [uploadedImages, setUploadedImages] = useState<{ [key: number]: string }>({});
  const [generatedMedia, setGeneratedMedia] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  const [selectedStyle, setSelectedStyle] = useState(PIXVERSE_STYLES[0]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingIconIndex, setLoadingIconIndex] = useState(0);

  const loadingIcons = [Sparkles, Film, Play, Camera];

  useEffect(() => {
    if (isGenerating) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [isGenerating]);

  useEffect(() => {
    let iconInterval: NodeJS.Timeout;
    if (isGenerating) {
      iconInterval = setInterval(() => {
        setLoadingIconIndex((prev) => (prev + 1) % loadingIcons.length);
      }, 1500);
    }
    return () => {
      if (iconInterval) clearInterval(iconInterval);
    };
  }, [isGenerating]);

  const handleEffectSelect = (effect: Effect) => {
    setSelectedEffect(effect);
    setUploadedImages({});
    setGeneratedMedia(null);
    setError(null);
  };

  const handleBackToGallery = () => {
    setSelectedEffect(null);
    setUploadedImages({});
    setGeneratedMedia(null);
    setError(null);
  };

  const handleImageUpload = async (slotIndex: number) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadedImages(prev => ({
          ...prev,
          [slotIndex]: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Erreur', 'Impossible d\'importer l\'image.');
    }
  };

  const handleGenerate = async () => {
    if (!selectedEffect) return;

    const requiredImages = Object.keys(uploadedImages).length;
    if (requiredImages < selectedEffect.slots) {
      Alert.alert('Images manquantes', `Veuillez ajouter ${selectedEffect.slots} image(s).`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedMedia(null);
    setLoadingProgress(0);

    try {
      if (selectedEffect.type === 'image') {
        const referenceImages = Object.values(uploadedImages);
        const referenceImage = selectedEffect.slots === 1 ? referenceImages[0] : undefined;

        const imageUrl = await runwareService.generateImage(selectedEffect.prompt, {
          referenceImage: referenceImage,
          referenceImages: selectedEffect.slots > 1 ? referenceImages : undefined,
          model: 'gemini-2.5-flash-image'
        });

        setGeneratedMedia(imageUrl);

        await storageService.saveImage({
          url: imageUrl,
          prompt: selectedEffect.prompt,
          timestamp: Date.now(),
          model: 'Gemini 2.5 Flash Image',
          format: selectedEffect.title,
          style: selectedEffect.description,
        });

      } else if (selectedEffect.type === 'pixverse_video') {
        console.log('🎬 [EFFECTS] Génération PixVerse vidéo:', selectedEffect.pixverseEffectId);

        const referenceImage = selectedEffect.slots > 0 ? uploadedImages[0] : undefined;

        const videoResult = await pixverseService.generateVideo(
          {
            prompt: selectedEffect.prompt,
            effect: selectedEffect.pixverseEffectId,
            style: selectedStyle.id !== 'none' ? selectedStyle.id : undefined,
            referenceImage: referenceImage,
            outputFormat: 'MP4',
            motionMode: 'normal'
          },
          (progress) => {
            setLoadingProgress(progress);
            Animated.timing(progressAnim, {
              toValue: progress / 100,
              duration: 300,
              easing: Easing.out(Easing.ease),
              useNativeDriver: false,
            }).start();
          }
        );

        setGeneratedMedia(videoResult.videoURL);

        await storageService.saveImage({
          url: videoResult.videoURL,
          prompt: selectedEffect.prompt,
          timestamp: Date.now(),
          model: 'PixVerse v5',
          format: selectedEffect.title,
          style: selectedStyle.name,
          isVideo: true,
          duration: 5,
          dimensions: videoResult.resolution
        });
      }

    } catch (error) {
      console.error('Error generating:', error);
      setError(error instanceof Error ? error.message : 'Erreur de génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedMedia) return;

    try {
      const isVideo = selectedEffect?.type === 'pixverse_video';
      const extension = isVideo ? 'mp4' : 'png';
      const filename = `genly-${selectedEffect?.id}-${Date.now()}.${extension}`;
      await storageService.downloadImage(generatedMedia, filename);

      Alert.alert('Succès', `${isVideo ? 'Vidéo' : 'Image'} téléchargée!`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de télécharger');
    }
  };

  const handleShare = async () => {
    if (!generatedMedia) return;

    try {
      await storageService.shareImage(generatedMedia, selectedEffect?.prompt || '');
      if (Platform.OS === 'web') {
        Alert.alert('Succès', 'Partagé avec succès!');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de partager');
    }
  };

  if (!selectedEffect) {
    const currentEffects = activeTab === 'image' ? IMAGE_EFFECTS : PIXVERSE_VIDEO_EFFECTS;

    return (
      <View style={styles.container}>
        <ProfileHeader />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Effets IA</Text>
            <Text style={styles.subtitle}>Transformez vos photos et vidéos</Text>

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'image' && styles.tabActive]}
                onPress={() => setActiveTab('image')}
              >
                <Camera size={20} color={activeTab === 'image' ? '#007AFF' : '#666'} />
                <Text style={[styles.tabText, activeTab === 'image' && styles.tabTextActive]}>
                  Effets Image
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'video' && styles.tabActive]}
                onPress={() => setActiveTab('video')}
              >
                <Film size={20} color={activeTab === 'video' ? '#FF6B35' : '#666'} />
                <Text style={[styles.tabText, activeTab === 'video' && styles.tabTextActive]}>
                  PixVerse Video
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.effectsGrid}
            showsVerticalScrollIndicator={false}
          >
            {currentEffects.map((effect) => (
              <TouchableOpacity
                key={effect.id}
                style={[styles.effectCard, { backgroundColor: effect.backgroundColor }]}
                onPress={() => handleEffectSelect(effect)}
                activeOpacity={0.8}
              >
                <View style={[styles.effectIconContainer, { backgroundColor: effect.color }]}>
                  <effect.icon size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.effectTitle}>{effect.title}</Text>
                <Text style={styles.effectDescription}>{effect.description}</Text>
                {effect.type === 'pixverse_video' && (
                  <View style={styles.pixverseBadge}>
                    <Text style={styles.pixverseText}>PixVerse v5</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const isVideo = selectedEffect.type === 'pixverse_video';

  return (
    <View style={[styles.container, { backgroundColor: selectedEffect.backgroundColor }]}>
      <ProfileHeader />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.effectHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToGallery}>
            <ArrowLeft size={24} color={selectedEffect.color} />
          </TouchableOpacity>
          <Text style={[styles.effectHeaderTitle, { color: selectedEffect.color }]}>
            {selectedEffect.title}
          </Text>
        </View>

        <ScrollView style={styles.effectScrollView} contentContainerStyle={styles.scrollContent}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {selectedEffect.slots > 0 && (
            <View style={styles.uploadSection}>
              <Text style={styles.sectionTitle}>
                {selectedEffect.slots === 1 ? 'Ajouter une image' : 'Ajouter vos images'}
              </Text>

              <View style={styles.uploadGrid}>
                {Array.from({ length: selectedEffect.slots }, (_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.uploadSlot,
                      { borderColor: selectedEffect.color }
                    ]}
                    onPress={() => handleImageUpload(index)}
                  >
                    {uploadedImages[index] ? (
                      <Image source={{ uri: uploadedImages[index] }} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Upload size={32} color={selectedEffect.color} />
                        <Text style={[styles.uploadText, { color: selectedEffect.color }]}>
                          Image {index + 1}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {isVideo && (
            <>
              <View style={styles.pixverseSection}>
                <Text style={styles.sectionTitle}>Style vidéo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.stylesRow}>
                    {PIXVERSE_STYLES.map((style) => (
                      <TouchableOpacity
                        key={style.id}
                        style={[
                          styles.styleButton,
                          selectedStyle.id === style.id && styles.styleButtonActive
                        ]}
                        onPress={() => setSelectedStyle(style)}
                      >
                        <Text style={styles.styleEmoji}>{style.emoji}</Text>
                        <Text style={styles.styleText}>{style.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  📐 Résolution : 720p (format automatique selon l'image)
                </Text>
                <Text style={styles.infoText}>
                  ⏱️ Durée : 5 secondes
                </Text>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.generateButton,
              { backgroundColor: selectedEffect.color },
              isGenerating && styles.generateButtonDisabled
            ]}
            onPress={handleGenerate}
            disabled={isGenerating || Object.keys(uploadedImages).length < selectedEffect.slots}
          >
            <View style={styles.buttonContent}>
              <Animated.View style={[styles.buttonIconContainer, { transform: [{ scale: pulseAnim }] }]}>
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  React.createElement(loadingIcons[0], { size: 20, color: '#FFFFFF' })
                )}
              </Animated.View>
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Génération...' : `Créer ${isVideo ? 'la vidéo' : 'l\'image'}`}
              </Text>
            </View>
            {isGenerating && (
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    }
                  ]}
                />
              </View>
            )}
          </TouchableOpacity>

          {generatedMedia && (
            <View style={styles.resultSection}>
              <Text style={styles.resultTitle}>Résultat</Text>

              <View style={styles.resultContainer}>
                {isVideo ? (
                  <Video
                    source={{ uri: generatedMedia }}
                    style={styles.resultVideo}
                    useNativeControls
                    resizeMode={'contain' as any}
                    isLooping
                    shouldPlay={false}
                  />
                ) : (
                  <Image source={{ uri: generatedMedia }} style={styles.resultImage} />
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
                  <Download size={20} color={selectedEffect.color} />
                  <Text style={[styles.actionButtonText, { color: selectedEffect.color }]}>
                    Télécharger
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                  <Share size={20} color={selectedEffect.color} />
                  <Text style={[styles.actionButtonText, { color: selectedEffect.color }]}>
                    Partager
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 4,
    width: '100%',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 20,
  },
  effectCard: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  effectIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  effectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  effectDescription: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  pixverseBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pixverseText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  effectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
  },
  effectHeaderTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  effectScrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  uploadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  uploadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  uploadSlot: {
    width: 150,
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pixverseSection: {
    marginBottom: 20,
  },
  stylesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  styleButton: {
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    minWidth: 80,
  },
  styleButtonActive: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B35',
  },
  styleEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  styleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  generateButton: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  buttonIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  resultSection: {
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  resultImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
  },
  resultVideo: {
    width: '100%',
    height: 280,
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
