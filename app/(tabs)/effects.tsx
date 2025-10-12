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
  Sparkles
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { runwareService } from '@/services/runware';
import { storageService } from '@/services/storage';
import ProfileHeader from '@/components/ProfileHeader';

// Types pour les effets
interface Effect {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  backgroundColor: string;
  slots: number;
  prompt: string;
}

// Configuration des effets avec leurs prompts uniques
const EFFECTS: Effect[] = [
  {
    id: 'celebrity',
    title: 'Celebrity IA',
    description: 'Avec une star',
    icon: Star,
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
    slots: 2,
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
    prompt: 'Inpaint a realistic homeless person (adult) naturally integrated into the uploaded photo. The person must match the original camera perspective, lighting, colors, shadows and grain. Placement: context-appropriate (e.g., if indoors → sleeping in bed or sitting against wall; if outdoors → standing by the door, leaning on steps). Appearance: worn but neutral clothing (hoodie, jacket, scarf, beanie, old backpack). Clothing must not contain logos, text, or offensive elements. Skin tone, gender, and age can adapt to the scene for maximum realism. Preserve all other details of the original photo unchanged. Final result must be photorealistic, ultra-detailed, natural skin texture, no sharp edges or cutouts.'
  }
];

export default function Effects() {
  const [selectedEffect, setSelectedEffect] = useState<Effect | null>(null);
  const [uploadedImages, setUploadedImages] = useState<{ [key: number]: string }>({});
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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
    } else {
      pulseAnim.setValue(1);
      progressAnim.setValue(0);
    }
  }, [isGenerating]);

  const handleEffectSelect = (effect: Effect) => {
    setSelectedEffect(effect);
    setUploadedImages({});
    setGeneratedImage(null);
    setError(null);
  };

  const handleBackToGallery = () => {
    setSelectedEffect(null);
    setUploadedImages({});
    setGeneratedImage(null);
    setError(null);
  };

  const handleImageUpload = async (slotIndex: number) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour importer une image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadedImages(prev => ({
          ...prev,
          [slotIndex]: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Erreur', 'Impossible d\'importer l\'image. Veuillez réessayer.');
    }
  };

  const handleGenerate = async () => {
    if (!selectedEffect) return;

    const requiredImages = Object.keys(uploadedImages).length;
    if (requiredImages < selectedEffect.slots) {
      Alert.alert('Images manquantes', `Veuillez ajouter ${selectedEffect.slots} image(s) pour continuer.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Récupérer toutes les images uploadées pour les effets multi-images
      const referenceImages = Object.values(uploadedImages);
      const referenceImage = selectedEffect.slots === 1 ? referenceImages[0] : undefined;
      
      const imageUrl = await runwareService.generateImage(selectedEffect.prompt, {
        referenceImage: referenceImage,
        referenceImages: selectedEffect.slots > 1 ? referenceImages : undefined,
        model: 'gemini-2.5-flash-image'
      });

      setGeneratedImage(imageUrl);

      // Sauvegarder l'image générée
      await storageService.saveImage({
        url: imageUrl,
        prompt: selectedEffect.prompt,
        timestamp: Date.now(),
        model: 'Gemini 2.5 Flash Image',
        format: selectedEffect.title,
        style: selectedEffect.description,
      });

    } catch (error) {
      console.error('Error generating image:', error);
      setError(error instanceof Error ? error.message : 'Une erreur est survenue lors de la génération.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const filename = `genly-${selectedEffect?.id}-${Date.now()}.png`;
      await storageService.downloadImage(generatedImage, filename);
      
      const successMessage = Platform.OS === 'web' 
        ? 'Image téléchargée avec succès!' 
        : 'Image sauvegardée dans votre galerie!';
      
      Alert.alert('Succès', successMessage);
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de télécharger l\'image');
    }
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    try {
      await storageService.shareImage(generatedImage, selectedEffect?.prompt || '');
      
      if (Platform.OS === 'web') {
        Alert.alert('Succès', 'Image partagée avec succès!');
      }
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de partager l\'image');
    }
  };

  // Vue galerie d'effets (grid compact)
  if (!selectedEffect) {
    return (
      <View style={styles.container}>
        <ProfileHeader />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Effets IA</Text>
            <Text style={styles.subtitle}>Transformez vos photos avec l'intelligence artificielle</Text>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.effectsGrid}
            showsVerticalScrollIndicator={false}
          >
            {EFFECTS.map((effect) => (
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
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Vue effet sélectionné
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

        <ScrollView style={styles.effectScrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.effectContent}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Section upload d'images */}
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
                      { borderColor: selectedEffect.color, backgroundColor: selectedEffect.backgroundColor }
                    ]}
                    onPress={() => handleImageUpload(index)}
                  >
                    {uploadedImages[index] ? (
                      <Image source={{ uri: uploadedImages[index] }} style={styles.uploadedImage} />
                    ) : (
                      <View style={styles.uploadPlaceholder}>
                        <Upload size={32} color={selectedEffect.color} />
                        <Text style={[styles.uploadText, { color: selectedEffect.color }]}>
                          {selectedEffect.id === 'figurine' ? 'Ajouter une image' : `Image ${index + 1}`}
                        </Text>
                        {selectedEffect.id === 'figurine' && (
                          <Text style={styles.uploadSubtext}>Pour créer votre figurine</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Bouton de génération */}
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
                    <Sparkles size={20} color="#FFFFFF" />
                  )}
                </Animated.View>
                <Text style={styles.generateButtonText}>
                  {isGenerating ? 'Génération en cours...' : `Créer ${selectedEffect.title}`}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Résultat généré */}
            {generatedImage && (
              <View style={styles.resultSection}>
                <Text style={styles.resultTitle}>
                  {selectedEffect.id === 'figurine' ? 'Votre figurine est prête !' : 'Résultat'}
                </Text>
                
                <View style={[
                  styles.resultContainer,
                  selectedEffect.id === 'figurine' && styles.figurineShowcase
                ]}>
                  <Image source={{ uri: generatedImage }} style={styles.resultImage} />
                  
                  {selectedEffect.id === 'figurine' && (
                    <View style={styles.figurineDetails}>
                      <Text style={styles.figurineTitle}>Figurine de Collection</Text>
                      <Text style={styles.figurineSpecs}>Échelle 1/7 • Style Réaliste</Text>
                      <Text style={styles.figurineDescription}>
                        Figurine haute qualité avec socle acrylique et emballage premium
                      </Text>
                    </View>
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

            {/* Section Effets Image */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Effets Image</Text>
              <View style={styles.effectsGrid}>
                {EFFECTS.map((effect) => (
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
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Section Effets Vidéo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Effets Vidéo</Text>
              <View style={styles.effectsGrid}>
                <View style={styles.comingSoonCard}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                  <Text style={styles.comingSoonSubtext}>Effets vidéo à venir</Text>
                </View>
              </View>
            </View>
          </View>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    paddingLeft: 4,
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  comingSoonCard: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 4,
    textAlign: 'center',
  },
  comingSoonSubtext: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
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
  headerSpacer: {
    width: 32,
  },
  effectScrollView: {
    flex: 1,
  },
  effectContent: {
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  uploadSection: {
    marginBottom: 30,
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
  uploadSubtext: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  generateButton: {
    borderRadius: 16,
    marginBottom: 30,
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
  resultSection: {
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
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
    alignItems: 'center',
  },
  figurineShowcase: {
    padding: 24,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  resultImage: {
    width: 280,
    height: 280,
    borderRadius: 12,
    marginBottom: 16,
  },
  figurineDetails: {
    alignItems: 'center',
    gap: 4,
  },
  figurineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  figurineSpecs: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  figurineDescription: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
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