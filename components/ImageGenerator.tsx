import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { Wand as Wand2, Download, Share, RefreshCw, Crown, Settings, RotateCcw, Sparkles, Palette, X, Upload, Image as ImageIcon, Zap, Brain, Cpu, Play } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runwareService, UserPlan } from '@/services/runware';
import { storageService } from '@/services/storage';
import ProfileHeader from '@/components/ProfileHeader';

const { width: screenWidth } = Dimensions.get('window');

// Types
interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: number;
  model?: string;
  cfgScale?: number;
  negativePrompt?: string;
  format?: string;
  dimensions?: string;
  style?: string;
}

// Styles disponibles
const STYLES = [
  { id: 'none', name: 'No Style', emoji: '🎯' },
  { id: 'photorealistic', name: 'Photorealistic', emoji: '📸' },
  { id: 'digital-art', name: 'Digital Art', emoji: '🎨' },
  { id: 'fantasy', name: 'Fantasy', emoji: '🧙‍♂️' },
  { id: 'anime', name: 'Anime', emoji: '🎌' },
  { id: 'cyberpunk', name: 'Cyberpunk', emoji: '🤖' },
  { id: 'vintage', name: 'Vintage', emoji: '📷' },
  { id: 'minimalist', name: 'Minimalist', emoji: '⚪' },
  { id: 'watercolor', name: 'Watercolor', emoji: '🎭' },
  { id: 'oil-painting', name: 'Oil Painting', emoji: '🖼️' },
  { id: 'sketch', name: 'Sketch', emoji: '✏️' },
  { id: 'pop-art', name: 'Pop Art', emoji: '💥' },
  { id: 'surreal', name: 'Surreal', emoji: '🌀' },
  { id: 'noir', name: 'Film Noir', emoji: '🎬' },
  { id: 'impressionist', name: 'Impressionist', emoji: '🌅' },
];

// Formats d'image disponibles - Updated to use supported dimensions
const FORMATS = [
  {
    id: 'square',
    name: 'Square',
    width: 1024,
    height: 1024,
    emoji: '⬜',
    aspectRatio: 1
  },
  {
    id: 'portrait',
    name: 'Portrait',
    width: 832,
    height: 1280,
    emoji: '📱',
    aspectRatio: 832/1280
  },
  {
    id: 'landscape',
    name: 'Landscape',
    width: 1280,
    height: 832,
    emoji: '🖥️',
    aspectRatio: 1280/832
  },
  {
    id: 'square-4k',
    name: 'Square 4K',
    width: 4096,
    height: 4096,
    emoji: '🔲',
    aspectRatio: 1
  },
  {
    id: 'portrait-4k',
    name: 'Portrait 4K',
    width: 2880,
    height: 5120,
    emoji: '📲',
    aspectRatio: 2880/5120
  },
  {
    id: 'landscape-4k',
    name: 'Landscape 4K',
    width: 3840,
    height: 2160,
    emoji: '🖼️',
    aspectRatio: 3840/2160
  },
];

// Options de qualité disponibles
const QUALITY_OPTIONS = [
  { id: 'standard', name: 'Standard', emoji: '⚡', description: 'Rapide et efficace', model: 'runware:100@1', modelName: 'Flux Schnell' },
  { id: 'ultra', name: 'Ultra', emoji: '💎', description: 'Qualité maximale', model: 'gemini-2.5-flash-image', modelName: 'Gemini 2.5 Flash (Image)' },
];

// 31 prompts de haute qualité pour inspirer la créativité
const INSPIRATION_PROMPTS = [
  "A majestic dragon soaring through storm clouds above a medieval castle",
  "Cyberpunk street scene with neon lights reflecting on wet pavement at night",
  "Serene Japanese garden with cherry blossoms and a traditional tea house",
  "Underwater city with bioluminescent coral and futuristic architecture",
  "Steampunk airship floating above Victorian London in golden hour light",
  "Mystical forest with glowing mushrooms and ethereal fairy lights",
  "Space station orbiting a distant planet with multiple moons",
  "Ancient Egyptian temple with hieroglyphs illuminated by torchlight",
  "Cozy library with floating books and magical swirling energy",
  "Post-apocalyptic cityscape reclaimed by nature and wildlife",
  "Crystal cave with prismatic light refractions and gem formations",
  "Floating islands connected by rainbow bridges in a cloudy sky",
  "Vintage 1950s diner on a desert highway under starry night",
  "Enchanted treehouse village in an ancient redwood forest",
  "Art nouveau mansion with stained glass windows and ornate details",
  "Alien marketplace with exotic creatures and strange technologies",
  "Northern lights dancing over a frozen lake with ice sculptures",
  "Clockwork city with mechanical gears and steam-powered contraptions",
  "Tropical paradise with crystal clear water and exotic birds",
  "Gothic cathedral interior with dramatic light streaming through windows",
  "Futuristic laboratory with holographic displays and advanced equipment",
  "Peaceful mountain monastery perched on a cliff at sunrise",
  "Whimsical candy land with gumdrop trees and chocolate rivers",
  "Ancient ruins overgrown with vines in a misty jungle",
  "Cozy winter cabin with smoke rising from chimney in snowy forest",
  "Surreal dreamscape with melting clocks and impossible geometry",
  "Bustling medieval marketplace with merchants and colorful banners",
  "Elegant ballroom with crystal chandeliers and dancing couples",
  "Mysterious lighthouse on a rocky coast during a thunderstorm",
  "Zen rock garden with perfectly raked sand and balanced stones",
  "Fantastical library tower stretching infinitely upward with spiral staircases"
];

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>(runwareService.getUserPlan());
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[0]);
  const [selectedQuality, setSelectedQuality] = useState(QUALITY_OPTIONS[0]);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImage2, setReferenceImage2] = useState<string | null>(null);
  const [referenceImage3, setReferenceImage3] = useState<string | null>(null);
  
  // Filtrer les formats selon le modèle sélectionné
  const getAvailableFormats = () => {
    if (referenceImage) {
      return []; // Format automatique avec image de référence
    }
    
    const currentModel = selectedQuality.model;
    const supportedDimensions = runwareService.getSupportedDimensions(currentModel);
    
    return FORMATS.filter(format => 
      supportedDimensions.some(dim => 
        dim.width === format.width && dim.height === format.height
      )
    );
  };
  
  // États pour l'animation de chargement
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingIconIndex, setLoadingIconIndex] = useState(0);
  
  // États pour l'animation d'apparition de l'image
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageReadyToShow, setImageReadyToShow] = useState(false);
  const [shouldAnimateImage, setShouldAnimateImage] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const imageOpacityAnim = useRef(new Animated.Value(0)).current;
  const imageScaleAnim = useRef(new Animated.Value(0.8)).current;

  // Icônes de chargement qui tournent
  const loadingIcons = [Brain, Cpu, Sparkles, Zap];

  // Animation de pulsation continue
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

  // Cycle des icônes de chargement
  useEffect(() => {
    let iconInterval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;

    if (isGenerating) {
      // Changer l'icône toutes les 1.5 secondes
      iconInterval = setInterval(() => {
        setLoadingIconIndex((prev) => (prev + 1) % loadingIcons.length);
      }, 1500);

      // Simuler la progression
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 15 + 5; // Progression aléatoire entre 5% et 20%
        if (progress > 90) progress = 90; // Ne jamais atteindre 100% avant la fin
        setLoadingProgress(progress);
        
        // Animation de la barre de progression
        Animated.timing(progressAnim, {
          toValue: progress / 100,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      }, 800);
    }

    return () => {
      if (iconInterval) clearInterval(iconInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isGenerating]);

  // Animation d'apparition de l'image - SEULEMENT quand shouldAnimateImage est true ET que l'image est prête
  useEffect(() => {
    if (shouldAnimateImage && imageReadyToShow && !imageLoadError) {
      // Reset des valeurs d'animation
      imageOpacityAnim.setValue(0);
      imageScaleAnim.setValue(0.8);
      
      // Animation d'apparition
      Animated.parallel([
        Animated.timing(imageOpacityAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(imageScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldAnimateImage(false); // Reset pour la prochaine fois
      });
    }
  }, [shouldAnimateImage, imageReadyToShow, imageLoadError]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageLoadError(false);
    setImageReadyToShow(true);
  };

  const handleImageError = () => {
    setImageLoadError(true);
    setImageLoaded(false);
    setImageReadyToShow(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Prompt requis', 'Veuillez entrer une description pour générer une image.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingIconIndex(0);
    
    // Reset des états d'image pour la nouvelle génération
    setImageLoaded(false);
    setImageLoadError(false);
    setImageReadyToShow(false);
    setShouldAnimateImage(true);
    
    // Ne pas supprimer l'image précédente immédiatement pour éviter l'écran noir
    // setGeneratedImage(null);

    try {
      // Construire le prompt avec le style sélectionné
      const styledPrompt = selectedStyle.id === 'none' 
        ? prompt 
        : `${prompt}, ${selectedStyle.name.toLowerCase()} style`;

      // Déterminer le modèle à utiliser selon la qualité sélectionnée
      let selectedModel;
      let currentModelName;
      let actualCfgScale;
      let actualNegativePrompt;
      
      if (referenceImage || referenceImage2 || referenceImage3) {
        // Si une image de référence est présente, FORCER le modèle Ultra (Gemini 2.5 Flash)
        selectedModel = 'gemini-2.5-flash-image';
        currentModelName = 'Gemini 2.5 Flash (Ultra - Image de référence)';
      } else {
        // Sinon, utiliser le modèle selon la qualité sélectionnée
        const qualityOption = QUALITY_OPTIONS.find(q => q.id === selectedQuality.id);
        selectedModel = qualityOption?.model || 'runware:100@1';
        currentModelName = qualityOption?.modelName || 'Flux Schnell';
      }

      // Construire les paramètres selon le modèle
      actualCfgScale = (referenceImage || referenceImage2 || referenceImage3) ? 3.5 :
        selectedQuality.id === 'standard' ? 2.5 :
        selectedQuality.id === 'ultra' ? 3.5 :
        selectedQuality.id === 'max' ? undefined :
        undefined;

      actualNegativePrompt = (referenceImage || referenceImage2 || referenceImage3) ?
        "blurry, low quality, distorted, deformed" :
        selectedQuality.id === 'standard' ? undefined :
        selectedQuality.id === 'ultra' ? "blurry, low quality, distorted, deformed" :
        selectedQuality.id === 'max' ? undefined :
        undefined;

      // Construire le tableau des images de référence
      let referenceImages: string[] = [];
      if (referenceImage) referenceImages.push(referenceImage);
      if (referenceImage2) referenceImages.push(referenceImage2);
      if (referenceImage3) referenceImages.push(referenceImage3);

      const params = {
        width: selectedFormat.width,
        height: selectedFormat.height,
        referenceImage: referenceImages.length > 0 ? referenceImages[0] : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        model: selectedModel,
        cfgScale: actualCfgScale,
        negativePrompt: actualNegativePrompt || undefined,
      };
      const imageUrl = await runwareService.generateImage(styledPrompt, params);

      // Animation finale de progression
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();

      setLoadingProgress(100);

      const newImage: GeneratedImage = {
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        model: currentModelName,
        cfgScale: actualCfgScale,
        negativePrompt: actualNegativePrompt || undefined,
        format: selectedFormat.name,
        dimensions: `${selectedFormat.width}x${selectedFormat.height}`,
        style: selectedStyle.name,
      };

      setGeneratedImage(newImage);

      // Sauvegarder l'image
      await storageService.saveImage({
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        model: currentModelName,
        cfgScale: actualCfgScale,
        negativePrompt: actualNegativePrompt || undefined,
        format: selectedFormat.name,
        dimensions: `${selectedFormat.width}x${selectedFormat.height}`,
        style: selectedStyle.name,
      });

    } catch (error) {
      console.error('Generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate image. Please try again.');
      setShouldAnimateImage(false);
      // En cas d'erreur, remettre l'image précédente si elle existait
      setError('❌ La génération a échoué. Réessayez ou modifiez votre prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const filename = `genly-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.png`;
      await storageService.downloadImage(generatedImage.url, filename, generatedImage);
      
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
      await storageService.shareImage(generatedImage.url, generatedImage.prompt, generatedImage);
      
      if (Platform.OS === 'web') {
        Alert.alert('Succès', 'Image partagée avec succès!');
      }
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de partager l\'image');
    }
  };

  const handleAnimateImage = async () => {
    if (!generatedImage) return;

    try {
      console.log('🎬 [ANIMATE] Début du processus d\'animation');
      
      // Générer un timestamp unique pour éviter les conflits
      const uniqueTimestamp = Date.now();
      console.log('🎬 [ANIMATE] Timestamp unique:', uniqueTimestamp);
      
      // Stocker l'image générée dans AsyncStorage pour la récupérer dans le générateur vidéo
      const imageData = {
        url: generatedImage.url,
        prompt: generatedImage.prompt,
        timestamp: uniqueTimestamp,
        fromImageGenerator: true, // Flag pour identifier la source
        originalTimestamp: generatedImage.timestamp
      };
      
      await AsyncStorage.setItem('pendingVideoReferenceImage', JSON.stringify(imageData));
      
      console.log('✅ [ANIMATE] Image sauvegardée dans AsyncStorage');
      console.log('🎬 [ANIMATE] Données sauvées:', imageData);
      
      // Naviguer vers l'onglet vidéo
      router.push('/(tabs)/video');
      
      console.log('✅ [ANIMATE] Navigation vers l\'onglet vidéo');
      
    } catch (error) {
      console.error('❌ [ANIMATE] Erreur lors de la préparation:', error);
      // En cas d'erreur, nettoyer le storage
      try {
        await AsyncStorage.removeItem('pendingVideoReferenceImage');
      } catch (cleanupError) {
        console.error('❌ [ANIMATE] Erreur nettoyage:', cleanupError);
      }
      Alert.alert('Erreur', 'Impossible de transférer l\'image vers le générateur vidéo');
    }
  };

  const handleRandomPrompt = () => {
    const randomPrompt = INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)];
    setPrompt(randomPrompt);
    
    // Vérifier si le format actuel est supporté par le modèle sélectionné
    const availableFormats = getAvailableFormats();
    if (availableFormats.length > 0 && !availableFormats.find(f => f.id === selectedFormat.id)) {
      setSelectedFormat(availableFormats[0]);
    }
  };

  const handleImportImage = async () => {
    try {
      // Demander les permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour importer une image.');
        return;
      }

      // Ouvrir le sélecteur d'images SANS contrainte de format
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // SUPPRIMÉ: allowsEditing pour éviter le crop forcé
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setReferenceImage(result.assets[0].uri);
        // Forcer automatiquement le modèle Ultra quand une image est uploadée
        const ultraModel = QUALITY_OPTIONS.find(q => q.id === 'ultra');
        if (ultraModel) {
          setSelectedQuality(ultraModel);
        }
      }
    } catch (error) {
      console.error('Error importing image:', error);
      Alert.alert('Erreur', 'Impossible d\'importer l\'image. Veuillez réessayer.');
    }
  };

  const handleImportImage2 = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour importer une image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setReferenceImage2(result.assets[0].uri);
        // Forcer automatiquement le modèle Ultra quand une image est uploadée
        const ultraModel = QUALITY_OPTIONS.find(q => q.id === 'ultra');
        if (ultraModel) {
          setSelectedQuality(ultraModel);
        }
      }
    } catch (error) {
      console.error('Error importing image 2:', error);
      Alert.alert('Erreur', 'Impossible d\'importer l\'image. Veuillez réessayer.');
    }
  };

  const handleImportImage3 = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission requise', 'L\'accès à la galerie est nécessaire pour importer une image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setReferenceImage3(result.assets[0].uri);
        // Forcer automatiquement le modèle Ultra quand une image est uploadée
        const ultraModel = QUALITY_OPTIONS.find(q => q.id === 'ultra');
        if (ultraModel) {
          setSelectedQuality(ultraModel);
        }
      }
    } catch (error) {
      console.error('Error importing image 3:', error);
      Alert.alert('Erreur', 'Impossible d\'importer l\'image. Veuillez réessayer.');
    }
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage(null);
    // Revenir au modèle Standard quand l'image est supprimée
    const standardModel = QUALITY_OPTIONS.find(q => q.id === 'standard');
    if (standardModel) {
      setSelectedQuality(standardModel);
    }
  };

  const handleRemoveReferenceImage2 = () => {
    setReferenceImage2(null);
    // Si aucune image de référence n'est présente, revenir au modèle Standard
    if (!referenceImage && !referenceImage3) {
      const standardModel = QUALITY_OPTIONS.find(q => q.id === 'standard');
      if (standardModel) {
        setSelectedQuality(standardModel);
      }
    }
  };

  const handleRemoveReferenceImage3 = () => {
    setReferenceImage3(null);
    // Si aucune image de référence n'est présente, revenir au modèle Standard
    if (!referenceImage && !referenceImage2) {
      const standardModel = QUALITY_OPTIONS.find(q => q.id === 'standard');
      if (standardModel) {
        setSelectedQuality(standardModel);
      }
    }
  };

  const getCfgDescription = (value: number) => {
    if (value <= 1.5) return 'Très créatif';
    if (value <= 2.5) return 'Créatif';
    if (value <= 4) return 'Équilibré';
    if (value <= 6) return 'Fidèle';
    return 'Très fidèle';
  };

  // Obtenir le nom du modèle actuel en fonction de la présence d'une image de référence
  const getCurrentModelDisplay = () => {
    return runwareService.getCurrentModelDisplayName(!!(referenceImage || referenceImage2 || referenceImage3));
  };

  return (
    <View style={styles.container}>
      {/* ProfileHeader positionné de manière absolue et complètement fixe */}
      <ProfileHeader />
      
      {/* ScrollView avec padding pour éviter le chevauchement */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // Propriétés critiques pour empêcher l'interaction avec l'icône
        scrollEventThrottle={16}
        bounces={true}
        // S'assurer que le scroll ne peut pas affecter les éléments en position absolue
        nestedScrollEnabled={false}
        // Propriétés pour isoler complètement le scroll
        removeClippedSubviews={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Genly</Text>
          <Text style={styles.subtitle}>AI Image Generator</Text>
          
          <View style={[styles.planBadge, userPlan.isPremium ? styles.premiumBadge : styles.freeBadge]}>
            {userPlan.isPremium && <Crown size={16} color="#FFD700" />}
            <Text style={[styles.planText, userPlan.isPremium ? styles.premiumText : styles.freeText]}>
              {getCurrentModelDisplay()}
            </Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Section principale de saisie */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Décrivez votre image</Text>
            <TouchableOpacity style={styles.randomButton} onPress={handleRandomPrompt}>
              <RefreshCw size={16} color="#007AFF" />
              <Text style={styles.randomButtonText}>Inspiration</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.textInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ex: Un chat astronaute flottant dans l'espace avec des étoiles scintillantes..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Section d'import d'image de référence */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <View style={styles.referenceImageLabelContainer}>
              <ImageIcon size={18} color="#000000" />
              <Text style={styles.label}>Images de référence</Text>
              {(referenceImage || referenceImage2 || referenceImage3) && (
                <View style={styles.fluxContextBadge}>
                  <Text style={styles.fluxContextText}>Gemini 2.5 Flash</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.multipleImagesContainer}>
            {/* Image 1 */}
            <View style={styles.imageSlot}>
              <Text style={styles.imageSlotLabel}>Image 1</Text>
              {referenceImage ? (
                <View style={styles.referenceImageContainer}>
                  <Image source={{ uri: referenceImage }} style={styles.referenceImagePreview} />
                  <TouchableOpacity 
                    style={styles.removeReferenceButton}
                    onPress={handleRemoveReferenceImage}
                  >
                    <X size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.importButtonSmall} onPress={handleImportImage}>
                  <Upload size={20} color="#007AFF" />
                  <Text style={styles.importButtonSmallText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Image 2 */}
            <View style={styles.imageSlot}>
              <Text style={styles.imageSlotLabel}>Image 2</Text>
              {referenceImage2 ? (
                <View style={styles.referenceImageContainer}>
                  <Image source={{ uri: referenceImage2 }} style={styles.referenceImagePreview} />
                  <TouchableOpacity 
                    style={styles.removeReferenceButton}
                    onPress={handleRemoveReferenceImage2}
                  >
                    <X size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.importButtonSmall} onPress={handleImportImage2}>
                  <Upload size={20} color="#007AFF" />
                  <Text style={styles.importButtonSmallText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Image 3 */}
            <View style={styles.imageSlot}>
              <Text style={styles.imageSlotLabel}>Image 3</Text>
              {referenceImage3 ? (
                <View style={styles.referenceImageContainer}>
                  <Image source={{ uri: referenceImage3 }} style={styles.referenceImagePreview} />
                  <TouchableOpacity 
                    style={styles.removeReferenceButton}
                    onPress={handleRemoveReferenceImage3}
                  >
                    <X size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.importButtonSmall} onPress={handleImportImage3}>
                  <Upload size={20} color="#007AFF" />
                  <Text style={styles.importButtonSmallText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.multipleImagesNote}>
            💡 Vous pouvez ajouter jusqu'à 3 images de référence pour le modèle Gemini 2.5 Flash
          </Text>
        </View>

        {/* Sélection du style */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <View style={styles.styleLabelContainer}>
              <Palette size={18} color="#000000" />
              <Text style={styles.label}>Style artistique</Text>
            </View>
            {STYLES.length > 6 && (
              <TouchableOpacity onPress={() => setShowAllStyles(!showAllStyles)}>
                <Text style={styles.showMoreText}>
                  {showAllStyles ? 'Voir moins' : `+${STYLES.length - 6} styles`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stylesScrollView}>
            <View style={styles.stylesContainer}>
              {(showAllStyles ? STYLES : STYLES.slice(0, 6)).map((style) => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.styleButton,
                    selectedStyle.id === style.id && styles.selectedStyleButton
                  ]}
                  onPress={() => setSelectedStyle(style)}
                >
                  <Text style={styles.styleEmoji}>{style.emoji}</Text>
                  <Text style={[
                    styles.styleButtonText,
                    selectedStyle.id === style.id && styles.selectedStyleButtonText
                  ]}>
                    {style.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Sélection du format */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Format d'image</Text>
            {(referenceImage || referenceImage2 || referenceImage3) && (
              <View style={styles.autoFormatBadge}>
                <Text style={styles.autoFormatText}>Format automatique</Text>
              </View>
            )}
          </View>
          
          {(referenceImage || referenceImage2 || referenceImage3) ? (
            <View style={styles.disabledFormatsContainer}>
              <Text style={styles.disabledFormatsText}>
                📐 Le format sera automatiquement adapté à vos images de référence
              </Text>
            </View>
          ) : (
            <View style={styles.formatsContainer}>
              {getAvailableFormats().map((format) => (
                <TouchableOpacity
                  key={format.id}
                  style={[
                    styles.formatButton,
                    selectedFormat.id === format.id && styles.selectedFormatButton
                  ]}
                  onPress={() => setSelectedFormat(format)}
                >
                  <Text style={styles.formatEmoji}>{format.emoji}</Text>
                  <Text style={[
                    styles.formatButtonText,
                    selectedFormat.id === format.id && styles.selectedFormatButtonText
                  ]}>
                    {format.name}
                  </Text>
                  <Text style={styles.formatDimensions}>
                    {format.width}×{format.height}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Sélection de la qualité */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Qualité de génération</Text>
          <View style={styles.qualityContainer}>
            {QUALITY_OPTIONS.map((quality) => (
              <TouchableOpacity
                key={quality.id}
                style={[
                  styles.qualityButton,
                  selectedQuality.id === quality.id && styles.selectedQualityButton,
                  (referenceImage || referenceImage2 || referenceImage3) && quality.id !== 'ultra' && styles.disabledQualityButton
                ]}
                onPress={() => {
                  // Si une image de référence est présente, seul Ultra peut être sélectionné
                  if ((referenceImage || referenceImage2 || referenceImage3) && quality.id !== 'ultra') {
                    return;
                  }
                  setSelectedQuality(quality);
                  
                  // Vérifier si le format actuel est supporté par le nouveau modèle
                  const newAvailableFormats = runwareService.getSupportedDimensions(quality.model);
                  const isCurrentFormatSupported = newAvailableFormats.some(dim => 
                    dim.width === selectedFormat.width && dim.height === selectedFormat.height
                  );
                  
                  if (!isCurrentFormatSupported && newAvailableFormats.length > 0) {
                    // Trouver le format correspondant dans FORMATS
                    const newFormat = FORMATS.find(format => 
                      newAvailableFormats.some(dim => 
                        dim.width === format.width && dim.height === format.height
                      )
                    );
                    if (newFormat) {
                      setSelectedFormat(newFormat);
                    }
                  }
                }}
                disabled={(referenceImage || referenceImage2 || referenceImage3) && quality.id !== 'ultra'}
              >
                <Text style={styles.qualityEmoji}>{quality.emoji}</Text>
                <Text style={[
                  styles.qualityButtonText,
                  selectedQuality.id === quality.id && styles.selectedQualityButtonText,
                  (referenceImage || referenceImage2 || referenceImage3) && quality.id !== 'ultra' && styles.disabledQualityButtonText
                ]}>
                  {quality.name}
                </Text>
                <Text style={styles.qualityDescription}>
                  {quality.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(referenceImage || referenceImage2 || referenceImage3) && (
            <Text style={styles.qualityNote}>
              💡 Seul le modèle Ultra peut traiter les images de référence
            </Text>
          )}
        </View>

        {/* Bouton de génération */}
        <TouchableOpacity
          style={[
            styles.generateButton, 
            isGenerating && styles.generateButtonDisabled,
            userPlan.isPremium && styles.premiumGenerateButton
          ]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          <View style={styles.buttonContent}>
            <Animated.View style={[styles.buttonIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              {isGenerating ? (
                React.createElement(loadingIcons[loadingIconIndex], { 
                  size: 24, 
                  color: "#FFFFFF" 
                })
              ) : (
                <Wand2 size={24} color="#FFFFFF" />
              )}
            </Animated.View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Génération en cours...' : 'Générer l\'image'}
              </Text>
              {isGenerating && (
                <Text style={styles.progressText}>
                  {Math.round(loadingProgress)}%
                </Text>
              )}
            </View>
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

        {/* Affichage de l'image avec animation de chargement intégrée */}
        {(generatedImage || isGenerating) && (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>
              {isGenerating ? 'Génération en cours...' : 'Image générée'}
            </Text>
            
            <View style={[
              styles.imageContainer,
              { aspectRatio: selectedFormat.width / selectedFormat.height }
            ]}>
              {/* Animation de chargement dans le cadre */}
              {isGenerating && (
                <View style={styles.loadingInFrame}>
                  <Animated.View style={[
                    styles.loadingIconInFrame,
                    { transform: [{ scale: pulseAnim }] }
                  ]}>
                    {React.createElement(loadingIcons[loadingIconIndex], { 
                      size: 48, 
                      color: "#007AFF" 
                    })}
                  </Animated.View>
                  <Text style={styles.loadingTextInFrame}>
                    {(referenceImage || referenceImage2 || referenceImage3) ? 'Génération multi-images...' : 'Création de votre image...'}
                  </Text>
                  <Text style={styles.loadingProgressInFrame}>
                    {Math.round(loadingProgress)}%
                  </Text>
                </View>
              )}

              {/* Placeholder pendant le chargement de l'image - SEULEMENT si l'image n'est pas prête ET qu'on n'est pas en train de générer */}
              {generatedImage && !imageReadyToShow && !imageLoadError && !isGenerating && (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.imagePlaceholderText}>Chargement de l'image...</Text>
                </View>
              )}

              {/* Image générée avec animation */}
              {generatedImage && !isGenerating && (
                <Animated.View style={[
                  styles.generatedImageContainer,
                  {
                    opacity: shouldAnimateImage ? imageOpacityAnim : (imageReadyToShow ? 1 : 0),
                    transform: [{ 
                      scale: shouldAnimateImage ? imageScaleAnim : (imageReadyToShow ? 1 : 0.8) 
                    }]
                  }
                ]}>
                  <Image
                    source={{ uri: generatedImage.url }}
                    style={styles.generatedImage}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    resizeMode="cover"
                  />
                </Animated.View>
              )}

              {/* Afficher l'image précédente en arrière-plan pendant la génération pour éviter l'écran noir */}
              {generatedImage && isGenerating && (
                <View style={[styles.generatedImageContainer, { opacity: 0.3 }]}>
                  <Image
                    source={{ uri: generatedImage.url }}
                    style={styles.generatedImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Message d'erreur de chargement d'image */}
              {imageLoadError && (
                <View style={styles.imageErrorContainer}>
                  <Text style={styles.imageErrorText}>❌</Text>
                  <Text style={styles.imageErrorMessage}>
                    Erreur lors du chargement de l'image
                  </Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => {
                      setImageLoadError(false);
                      setImageLoaded(false);
                      setImageReadyToShow(false);
                      setShouldAnimateImage(true);
                    }}
                  >
                    <Text style={styles.retryButtonText}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {/* Actions seulement quand l'image est générée ET prête */}
            {generatedImage && !isGenerating && imageReadyToShow && (
              <>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
                    <Download size={20} color="#007AFF" />
                    <Text style={styles.actionButtonText}>
                      {Platform.OS === 'web' ? 'Télécharger' : 'Sauvegarder'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                    <Share size={20} color="#007AFF" />
                    <Text style={styles.actionButtonText}>Partager</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.animateButton} onPress={handleAnimateImage}>
                    <Play size={20} color="#FFFFFF" />
                    <Text style={styles.animateButtonText}>Animer</Text>
                  </TouchableOpacity>
                </View>

                {/* Informations sur l'image générée */}
                <View style={styles.imageInfo}>
                  <Text style={styles.imageInfoTitle}>Détails de génération</Text>
                  <Text style={styles.imageInfoText}>
                    <Text style={styles.imageInfoLabel}>Modèle: </Text>
                    {generatedImage.model}
                  </Text>
                  <Text style={styles.imageInfoText}>
                    <Text style={styles.imageInfoLabel}>Format: </Text>
                    {generatedImage.format} ({generatedImage.dimensions})
                  </Text>
                  <Text style={styles.imageInfoText}>
                    <Text style={styles.imageInfoLabel}>Style: </Text>
                    {generatedImage.style}
                  </Text>
                  <Text style={styles.imageInfoText}>
                    <Text style={styles.imageInfoLabel}>Qualité: </Text>
                    {selectedQuality.name} ({generatedImage.model})
                  </Text>
                  {generatedImage.cfgScale && (
                    <Text style={styles.imageInfoText}>
                      <Text style={styles.imageInfoLabel}>CFG Scale: </Text>
                      {generatedImage.cfgScale} ({getCfgDescription(generatedImage.cfgScale)})
                    </Text>
                  )}
                  {(referenceImage || referenceImage2 || referenceImage3) && (
                    <Text style={styles.imageInfoText}>
                      <Text style={styles.imageInfoLabel}>Images de référence: </Text>
                      {[referenceImage, referenceImage2, referenceImage3].filter(Boolean).length} image(s)
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    // Container relatif pour créer un contexte de positionnement
    position: 'relative',
    // S'assurer que le container ne peut pas affecter l'icône de profil
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    // S'assurer que le ScrollView ne peut pas affecter les éléments en position absolue
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    // Padding top très important pour s'assurer que le contenu ne passe jamais sous l'icône
    paddingTop: 120, // Augmenté encore plus pour être sûr
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  freeBadge: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  premiumBadge: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
  },
  freeText: {
    color: '#007AFF',
  },
  premiumText: {
    color: '#B8860B',
  },
  errorContainer: {
    backgroundColor: '#FFE6E6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFB3B3',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  randomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 6,
  },
  randomButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  referenceImageLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fluxContextBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  fluxContextText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '600',
  },
  referenceImageContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  referenceImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    // Permettre l'affichage libre de l'image sans contrainte de ratio
    resizeMode: 'cover',
  },
  removeReferenceButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  importButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  importButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  importButtonSubtext: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  multipleImagesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  imageSlot: {
    flex: 1,
    alignItems: 'center',
  },
  imageSlotLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  importButtonSmall: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    gap: 4,
    minHeight: 80,
    justifyContent: 'center',
    width: '100%',
  },
  importButtonSmallText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  multipleImagesNote: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  advancedToggleText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  advancedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  imageContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingInFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 248, 248, 0.95)',
    zIndex: 2,
    gap: 12,
  },
  loadingIconInFrame: {
    marginBottom: 8,
  },
  loadingTextInFrame: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadingProgressInFrame: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    gap: 12,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  generatedImageContainer: {
    width: '100%',
    height: '100%',
  },
  generatedImage: {
    width: '100%',
    height: '100%',
  },
  imageErrorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    gap: 12,
  },
  imageErrorText: {
    fontSize: 32,
  },
  imageErrorMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  styleLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  showMoreText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
  },
  stylesScrollView: {
    marginBottom: 8,
  },
  stylesContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  styleButton: {
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    minWidth: 80,
    gap: 6,
  },
  selectedStyleButton: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  styleEmoji: {
    fontSize: 24,
  },
  styleButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  selectedStyleButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  formatsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  formatButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  selectedFormatButton: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  formatEmoji: {
    fontSize: 24,
  },
  formatButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  selectedFormatButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  formatDimensions: {
    fontSize: 11,
    color: '#999999',
  },
  qualityContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  qualityButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    gap: 6,
  },
  selectedQualityButton: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  qualityEmoji: {
    fontSize: 24,
  },
  qualityButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  selectedQualityButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  qualityDescription: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'center',
  },
  disabledQualityButton: {
    opacity: 0.4,
    backgroundColor: '#F0F0F0',
  },
  disabledQualityButtonText: {
    color: '#CCCCCC',
  },
  autoFormatBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  autoFormatText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '600',
  },
  disabledFormatsContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  disabledFormatsText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  qualityNote: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  generateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 30,
    overflow: 'hidden',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  premiumGenerateButton: {
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  buttonIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonTextContainer: {
    alignItems: 'center',
    gap: 4,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
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
    marginHorizontal: 20,
    marginBottom: 30,
  },
  resultLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  animateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  animateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imageInfo: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  imageInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  imageInfoText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  imageInfoLabel: {
    fontWeight: '600',
    color: '#000000',
  },
});