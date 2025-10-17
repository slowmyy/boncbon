import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Video, 
  Play, 
  Pause, 
  Download, 
  Share, 
  RefreshCw, 
  Settings, 
  Sparkles,
  Film,
  Clock,
  Zap,
  Brain,
  Cpu,
  Upload,
  X
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { runwareService } from '@/services/runware';
import { storageService } from '@/services/storage';
import { useFocusEffect } from '@react-navigation/native';
import ProfileHeader from '@/components/ProfileHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoGenerationService } from '@/utils/runware';

// Generate a valid UUIDv4
const generateUUIDv4 = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Types
interface GeneratedVideo {
  url: string;
  prompt: string;
  timestamp: number;
  duration: number;
  model: string;
  taskUUID: string;
  referenceImage?: string;
}

const VIDEO_INSPIRATION_PROMPTS = [
  "Underwater scene with colorful fish swimming through coral reefs",
  "Steam rising from a hot cup of coffee on a rainy morning",
  "A magical forest with glowing mushrooms and floating particles of light",
  "Clouds forming and transforming in a blue sky time-lapse",
  "A butterfly emerging from its cocoon in macro detail",
  "City lights twinkling as day transitions to night",
  "A campfire crackling under a starry night sky",
  "Lava flowing down a volcanic slope creating new land"
];

// Options de qualité disponibles
const VIDEO_QUALITY_OPTIONS = [
  {
    id: 'standard',
    name: 'Standard',
    emoji: '⚡',
    description: 'Rapide et fluide',
    model: 'bytedance:1@1',
    modelName: 'Seedance 1.0 Lite',
    duration: 6,
    supportedFormats: [
      { id: 'square', name: 'Carré', width: 960, height: 960, emoji: '⬜' },
      { id: 'landscape', name: 'Paysage', width: 1248, height: 704, emoji: '🖥️' },
      { id: 'portrait', name: 'Portrait', width: 832, height: 1120, emoji: '📱' },
    ]
  },
  {
    id: 'ultra',
    name: 'Ultra',
    emoji: '💎',
    description: 'Veo 3 Fast HD',
    model: 'google:3@1',
    modelName: 'Google Veo 3 Fast',
    duration: 8,
    supportedFormats: [
      { id: 'landscape', name: 'Paysage', width: 1920, height: 1080, emoji: '🖥️' },
    ]
  },
];

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState(VIDEO_QUALITY_OPTIONS[0]);
  const [selectedVideoFormat, setSelectedVideoFormat] = useState(VIDEO_QUALITY_OPTIONS[0].supportedFormats[0]);
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoRetryCount, setVideoRetryCount] = useState(0);
  const [isVideoRetrying, setIsVideoRetrying] = useState(false);
  
  // États pour l'animation de chargement
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingIconIndex, setLoadingIconIndex] = useState(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Icônes de chargement qui tournent
  const loadingIcons = [Brain, Cpu, Sparkles, Zap];

  // Service de génération vidéo
  const videoService = useRef<VideoGenerationService | null>(null);

  // Filtrer les formats vidéo disponibles selon la qualité sélectionnée
  const availableVideoFormats = useMemo(() => {
    return selectedQuality.supportedFormats || [];
  }, [selectedQuality]);

  // Filtrer les options de qualité selon la présence d'une image de référence
  const availableQualityOptions = useMemo(() => {
    if (referenceImagePreview) {
      // Si une image est importée, forcer Ultra uniquement
      return VIDEO_QUALITY_OPTIONS.filter(option => option.id === 'ultra');
    }
    // Sinon, toutes les options sont disponibles
    return VIDEO_QUALITY_OPTIONS;
  }, [referenceImagePreview]);

  // S'assurer que le format vidéo sélectionné est disponible
  useEffect(() => {
    const isCurrentFormatAvailable = availableVideoFormats.some(format => format.id === selectedVideoFormat.id);
    if (!isCurrentFormatAvailable && availableVideoFormats.length > 0) {
      setSelectedVideoFormat(availableVideoFormats[0]);
    }
  }, [availableVideoFormats, selectedVideoFormat.id]);

  // Forcer la sélection du modèle Ultra quand une image est importée
  useEffect(() => {
    if (referenceImagePreview) {
      const ultraOption = VIDEO_QUALITY_OPTIONS.find(option => option.id === 'ultra');
      if (ultraOption && selectedQuality.id !== 'ultra') {
        setSelectedQuality(ultraOption);
      }
    }
  }, [referenceImagePreview, selectedQuality.id]);

  useEffect(() => {
    videoService.current = new VideoGenerationService();
    
    // Toujours vérifier les images en attente au chargement
    checkForPendingReferenceImage();
  }, []);

  // Vérifier aussi quand la page devient active (focus)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 [VIDEO] Page vidéo devient active, vérification des images en attente...');
      checkForPendingReferenceImage();
    }, [])
  );

  const checkForPendingReferenceImage = async () => {
    try {
      console.log('🔍 [VIDEO] Vérification des images en attente...');
      const pendingImageData = await AsyncStorage.getItem('pendingVideoReferenceImage');
      
      if (pendingImageData) {
        console.log('📦 [VIDEO] Image en attente trouvée');
        const imageData = JSON.parse(pendingImageData);
        
        // Supprimer IMMÉDIATEMENT l'image en attente pour éviter les doublons
        await AsyncStorage.removeItem('pendingVideoReferenceImage');
        console.log('🗑️ [VIDEO] Image en attente supprimée du storage');
        
        // REMPLACER l'image existante automatiquement
        console.log('🔄 [VIDEO] Remplacement de l\'image de référence...');
        
        // Supprimer l'ancienne image si elle existe
        if (referenceImage || referenceImagePreview) {
          console.log('🗑️ [VIDEO] Suppression de l\'ancienne image de référence');
          setReferenceImage(null);
          setReferenceImagePreview(null);
        }
        
        // Convertir l'URL en File pour le générateur vidéo
        try {
          const response = await fetch(imageData.url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          const file = new File([blob], 'reference-from-generator.jpg', { type: 'image/jpeg' });
          
          // Définir la nouvelle image de référence et le prompt
          setReferenceImage(file);
          setReferenceImagePreview(imageData.url);
          
          // Pré-remplir le prompt seulement s'il est vide ou si on force le remplacement
          if (!prompt.trim() || imageData.fromImageGenerator === true) {
            setPrompt(imageData.prompt || '');
            console.log('📝 [VIDEO] Prompt mis à jour:', imageData.prompt);
          }
          
          console.log('✅ [VIDEO] Image importée automatiquement depuis le générateur d\'images');
          
          // Afficher une notification de succès
          Alert.alert(
            '🎬 Image importée !', 
            'L\'image générée a été automatiquement importée comme référence pour votre vidéo.',
            [{ text: 'Parfait !', style: 'default' }]
          );
          
        } catch (fetchError) {
          console.error('❌ [VIDEO] Erreur lors du téléchargement de l\'image:', fetchError);
          Alert.alert('Erreur', 'Impossible de charger l\'image. Veuillez réessayer.');
        }
        
      } else {
        console.log('ℹ️ [VIDEO] Aucune image en attente trouvée');
      }
    } catch (error) {
      console.error('❌ [VIDEO] Erreur lors de l\'import automatique d\'image:', error);
    }
  };

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

    if (isGenerating) {
      // Changer l'icône toutes les 1.5 secondes
      iconInterval = setInterval(() => {
        setLoadingIconIndex((prev) => (prev + 1) % loadingIcons.length);
      }, 1500);
    }

    return () => {
      if (iconInterval) clearInterval(iconInterval);
    };
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Prompt requis', 'Veuillez entrer une description pour générer une vidéo.');
      return;
    }

    if (!videoService.current) {
      Alert.alert('Erreur', 'Service de génération vidéo non initialisé. Vérifiez votre clé API.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingIconIndex(0);
    setGeneratedVideo(null);
    setVideoLoaded(false);
    setVideoError(false);
    setVideoRetryCount(0);
    setIsVideoRetrying(false);

    try {
      const qualityOption = VIDEO_QUALITY_OPTIONS.find(q => q.id === selectedQuality.id);
      const selectedModel = qualityOption?.model || 'bytedance:1@1';
      const modelName = qualityOption?.modelName || 'Seedance 1.0 Lite';
      const videoDuration = selectedQuality.id === 'max' ? selectedDuration : (qualityOption?.duration || 5);
      const videoWidth = selectedVideoFormat.width;
      const videoHeight = selectedVideoFormat.height;

      console.log('🎬 [VIDEO] Modèle sélectionné:', {
        quality: selectedQuality.id,
        model: selectedModel,
        modelName: modelName,
        duration: videoDuration,
        resolution: `${videoWidth}x${videoHeight}`,
      });

      const videoUrl = await videoService.current!.generateVideo({
        prompt: prompt,
        referenceImage: referenceImage || undefined,
        model: selectedModel,
        width: videoWidth,
        height: videoHeight,
        duration: videoDuration,
        onProgress: (progress) => {
          setLoadingProgress(progress);
          Animated.timing(progressAnim, {
            toValue: progress / 100,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }).start();
        },
      });

      console.log('📹 [VIDEO] URL vidéo finale:', {
        videoUrl: videoUrl,
        videoUrlLength: videoUrl?.length || 0,
        videoUrlPreview: videoUrl?.substring(0, 100) || 'null',
        isValidUrl: videoUrl?.startsWith('http') || false
      });
      console.log('💾 [VIDEO] Création objet vidéo pour sauvegarde');

      const newVideo: GeneratedVideo = {
        url: videoUrl,
        prompt: prompt,
        timestamp: Date.now(),
        duration: videoDuration,
        model: modelName,
        taskUUID: generateUUIDv4(),
        referenceImage: referenceImagePreview || undefined,
      };

      console.log('📺 [VIDEO] Création objet vidéo pour affichage:');
      console.log('  - url:', newVideo.url);
      console.log('  - prompt:', newVideo.prompt);
      console.log('  - duration:', newVideo.duration);
      console.log('  - model:', newVideo.model);
      console.log('  - taskUUID:', newVideo.taskUUID);

      setGeneratedVideo(newVideo);
      console.log('✅ [VIDEO] Vidéo définie dans state React');

      console.log('💾 [VIDEO] Préparation sauvegarde galerie:', {
        url: videoUrl,
        prompt: prompt.substring(0, 50),
        model: modelName,
        duration: videoDuration,
        dimensions: `${videoWidth}x${videoHeight}`,
        isVideo: true
      });

      await storageService.saveImage({
        url: videoUrl,
        prompt: prompt,
        timestamp: Date.now(),
        model: modelName,
        format: `Vidéo ${videoDuration}s`,
        dimensions: `${videoWidth}x${videoHeight}`,
        style: 'Video Generation',
        isVideo: true,
        duration: videoDuration,
        videoWidth: videoWidth,
        videoHeight: videoHeight,
      });

      console.log('✅ [VIDEO] Vidéo sauvegardée dans galerie');
      console.log('🎉 [VIDEO] SUCCÈS COMPLET - Génération vidéo terminée');

    } catch (error) {
      console.error('❌ [VIDEO] Erreur de génération:', error);
      setError('❌ La génération a échoué. Réessayez ou modifiez votre prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRandomPrompt = () => {
    const randomPrompt = VIDEO_INSPIRATION_PROMPTS[Math.floor(Math.random() * VIDEO_INSPIRATION_PROMPTS.length)];
    setPrompt(randomPrompt);
  };

  const handleImportImage = async () => {
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
        // Convertir l'URI en File pour le web
        if (Platform.OS === 'web') {
          const response = await fetch(result.assets[0].uri);
          const blob = await response.blob();
          const file = new File([blob], 'reference-image.jpg', { type: 'image/jpeg' });
          setReferenceImage(file);
        }
        setReferenceImagePreview(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error importing image:', error);
      Alert.alert('Erreur', 'Impossible d\'importer l\'image. Veuillez réessayer.');
    }
  };

  const handleRemoveReferenceImage = () => {
    console.log('🗑️ [VIDEO] Suppression manuelle de l\'image de référence');
    setReferenceImage(null);
    setReferenceImagePreview(null);
  };

  const handleDownload = async () => {
    if (!generatedVideo) return;

    try {
      const filename = `genly-video-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.mp4`;
      await storageService.downloadImage(generatedVideo.url, filename);
      
      const successMessage = Platform.OS === 'web' 
        ? 'Vidéo téléchargée avec succès!' 
        : 'Vidéo sauvegardée dans votre galerie!';
      
      Alert.alert('Succès', successMessage);
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de télécharger la vidéo');
    }
  };

  const handleShare = async () => {
    if (!generatedVideo) return;

    try {
      await storageService.shareImage(generatedVideo.url, generatedVideo.prompt);
      
      if (Platform.OS === 'web') {
        Alert.alert('Succès', 'Vidéo partagée avec succès!');
      }
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de partager la vidéo');
    }
  };

  const handleVideoLoad = (status: any) => {
    console.log('✅ [VIDEO PLAYER] Vidéo chargée:', status);
    setVideoLoaded(true);
    setVideoError(false);
    setVideoRetryCount(0);
    setIsVideoRetrying(false);
  };

  const handleVideoError = (error: any) => {
    console.error('❌ [VIDEO PLAYER] Erreur lecteur:', error?.nativeEvent || error);
    setVideoError(true);
    setVideoLoaded(false);
    setIsVideoRetrying(false);
  };

  const handleRetryVideo = () => {
    if (videoRetryCount >= 3) {
      Alert.alert(
        'Erreur persistante',
        'Impossible de charger la vidéo après plusieurs tentatives. Vérifiez votre connexion internet.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsVideoRetrying(true);
    setVideoError(false);
    setVideoLoaded(false);
    setVideoRetryCount(prev => prev + 1);

    // Forcer le rechargement après un délai
    setTimeout(() => {
      setIsVideoRetrying(false);
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <ProfileHeader />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Film size={32} color="#FF6B35" />
            <Text style={styles.title}>Générateur Vidéo</Text>
          </View>
          <Text style={styles.subtitle}>Créez des vidéos IA avec ByteDance</Text>
        </View>

        {/* Note importante sur l'image de référence */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            💡 Vous pouvez générer des vidéos avec juste un prompt ou ajouter une image de référence
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Section principale de saisie */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Image de référence (optionnel)</Text>
            <TouchableOpacity style={styles.randomButton} onPress={handleRandomPrompt}>
              <RefreshCw size={16} color="#FF6B35" />
              <Text style={styles.randomButtonText}>Inspiration</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.textInput}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ex: Un chat qui joue dans un jardin fleuri au coucher du soleil..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Sélection de la qualité */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Qualité de génération</Text>
          {referenceImagePreview && (
            <Text style={styles.forceUltraNote}>
              💎 Modèle Ultra automatiquement sélectionné pour l'image-to-video
            </Text>
          )}
          <View style={styles.qualityContainer}>
            {availableQualityOptions.map((quality) => (
              <TouchableOpacity
                key={quality.id}
                style={[
                  styles.qualityButton,
                  selectedQuality.id === quality.id && styles.selectedQualityButton,
                  referenceImagePreview && quality.id !== 'ultra' && styles.disabledQualityButton
                ]}
                onPress={() => {
                  // Empêcher la sélection d'autres modèles si une image est importée
                  if (!referenceImagePreview || quality.id === 'ultra') {
                    setSelectedQuality(quality);
                  }
                }}
                disabled={referenceImagePreview && quality.id !== 'ultra'}
              >
                <Text style={styles.qualityEmoji}>{quality.emoji}</Text>
                <Text style={[
                  styles.qualityButtonText,
                  selectedQuality.id === quality.id && styles.selectedQualityButtonText,
                  referenceImagePreview && quality.id !== 'ultra' && styles.disabledQualityButtonText
                ]}>
                  {quality.name}
                </Text>
                <Text style={[
                  styles.qualityDescription,
                  referenceImagePreview && quality.id !== 'ultra' && styles.disabledQualityDescription
                ]}>
                  {quality.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sélection du format vidéo */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Format vidéo</Text>
          <View style={styles.videoFormatsContainer}>
            {availableVideoFormats.map((format) => (
              <TouchableOpacity
                key={format.id}
                style={[
                  styles.videoFormatButton,
                  selectedVideoFormat.id === format.id && styles.selectedVideoFormatButton
                ]}
                onPress={() => setSelectedVideoFormat(format)}
              >
                <Text style={styles.videoFormatEmoji}>{format.emoji}</Text>
                <Text style={[
                  styles.videoFormatButtonText,
                  selectedVideoFormat.id === format.id && styles.selectedVideoFormatButtonText
                ]}>
                  {format.name}
                </Text>
                <Text style={styles.videoFormatDimensions}>
                  {format.width}×{format.height}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings size={16} color="#FF6B35" />
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? 'Masquer' : 'Afficher'} les options avancées
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.inputSection}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Image de référence (optionnel)</Text>
            </View>
            
            {referenceImagePreview ? (
              <View style={styles.referenceImageContainer}>
                <Image source={{ uri: referenceImagePreview }} style={styles.referenceImagePreview} />
                <TouchableOpacity 
                  style={styles.removeReferenceButton}
                  onPress={handleRemoveReferenceImage}
                >
                  <X size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.importButton} onPress={handleImportImage}>
                <Upload size={24} color="#FF6B35" />
                <Text style={styles.importButtonText}>Importer une image</Text>
                <Text style={styles.importButtonSubtext}>Optionnel - pour image-to-video</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bouton de génération */}
        <TouchableOpacity
          style={[
            styles.generateButton, 
            isGenerating && styles.generateButtonDisabled
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
                <Video size={24} color="#FFFFFF" />
              )}
            </Animated.View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Génération en cours...' : 
                 'Générer la vidéo'}
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

        {/* Note d'avertissement */}
        <View style={styles.warningNote}>
          <Text style={styles.warningText}>
            ⚠️ Les contenus inappropriés peuvent échouer et quand même consommer vos crédits.
          </Text>
        </View>
        {/* Affichage de la vidéo */}
        {(generatedVideo || isGenerating) && (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>
              {isGenerating ? 'Génération en cours...' : 'Vidéo générée'}
            </Text>

            <View style={[
              styles.videoContainer,
              generatedVideo && { aspectRatio: selectedVideoFormat.width / selectedVideoFormat.height }
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
                      color: "#FF6B35" 
                    })}
                  </Animated.View>
                  <Text style={styles.loadingTextInFrame}>
                    Création de votre vidéo...
                  </Text>
                  <Text style={styles.loadingProgressInFrame}>
                    {Math.round(loadingProgress)}%
                  </Text>
                </View>
              )}

              {/* Vidéo générée */}
              {generatedVideo && !isGenerating && (
                <>
                  {Platform.OS === 'web' ? (
                    <video
                      src={generatedVideo.url}
                      key={`video-${generatedVideo.timestamp}-${videoRetryCount}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 12,
                      }}
                      controls
                      preload="metadata"
                      crossOrigin="anonymous"
                      onLoadedData={() => handleVideoLoad({ isLoaded: true })}
                      onError={(e) => handleVideoError(e)}
                      onLoadStart={() => {
                        console.log('🔄 [VIDEO] Début chargement vidéo');
                        setVideoLoaded(false);
                        setVideoError(false);
                      }}
                      onCanPlay={() => {
                        console.log('✅ [VIDEO] Vidéo prête à jouer');
                        handleVideoLoad({ isLoaded: true });
                      }}
                    />
                  ) : (
                    <ExpoVideo
                      source={{ uri: generatedVideo.url }}
                      key={`expo-video-${generatedVideo.timestamp}-${videoRetryCount}`}
                      style={styles.video}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      isLooping={false}
                      shouldPlay={false}
                      onLoad={handleVideoLoad}
                      onError={handleVideoError}
                      onLoadStart={() => {
                        console.log('🔄 [VIDEO] Début chargement vidéo Expo');
                        setVideoLoaded(false);
                        setVideoError(false);
                      }}
                    />
                  )}

                  {/* Overlay de contrôles personnalisés si nécessaire */}
                  {!videoLoaded && !videoError && !isVideoRetrying && (
                    <View style={styles.videoPlaceholder}>
                      <ActivityIndicator size="large" color="#FF6B35" />
                      <Text style={styles.videoPlaceholderText}>Chargement de la vidéo...</Text>
                    </View>
                  )}

                  {isVideoRetrying && (
                    <View style={styles.videoPlaceholder}>
                      <ActivityIndicator size="large" color="#FF6B35" />
                      <Text style={styles.videoPlaceholderText}>
                        Nouvelle tentative... ({videoRetryCount}/3)
                      </Text>
                    </View>
                  )}

                  {videoError && (
                    <View style={styles.videoErrorContainer}>
                      <Text style={styles.videoErrorText}>❌</Text>
                      <Text style={styles.videoErrorMessage}>
                        Erreur lors du chargement de la vidéo{videoRetryCount > 0 ? ` (tentative ${videoRetryCount}/3)` : ''}
                      </Text>
                      <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={handleRetryVideo}
                        disabled={isVideoRetrying}
                      >
                        <Text style={styles.retryButtonText}>
                          {isVideoRetrying ? 'Retry...' : 'Réessayer'}
                        </Text>
                      </TouchableOpacity>
                      {videoRetryCount >= 3 && (
                        <TouchableOpacity 
                          style={[styles.retryButton, { backgroundColor: '#666666' }]}
                          onPress={() => {
                            // Copier l'URL dans le presse-papiers pour debug
                            if (Platform.OS === 'web' && navigator.clipboard) {
                              navigator.clipboard.writeText(generatedVideo.url);
                              Alert.alert('URL copiée', 'L\'URL de la vidéo a été copiée dans le presse-papiers pour diagnostic.');
                            }
                          }}
                        >
                          <Text style={styles.retryButtonText}>Copier URL</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
            
            {/* Actions seulement quand la vidéo est générée */}
            {generatedVideo && !isGenerating && (
              <>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
                    <Download size={20} color="#FF6B35" />
                    <Text style={styles.actionButtonText}>
                      {Platform.OS === 'web' ? 'Télécharger' : 'Sauvegarder'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                    <Share size={20} color="#FF6B35" />
                    <Text style={styles.actionButtonText}>Partager</Text>
                  </TouchableOpacity>
                </View>

                {/* Informations sur la vidéo générée */}
                <View style={styles.videoInfo}>
                  <Text style={styles.videoInfoTitle}>Détails de génération</Text>
                  <Text style={styles.videoInfoText}>
                    <Text style={styles.videoInfoLabel}>Modèle: </Text>
                    {generatedVideo.model}
                  </Text>
                  <Text style={styles.videoInfoText}>
                    <Text style={styles.videoInfoLabel}>Durée: </Text>
                    {generatedVideo.duration} secondes
                  </Text>
                  <Text style={styles.videoInfoText}>
                    <Text style={styles.videoInfoLabel}>Résolution: </Text>
                    {selectedVideoFormat.width}x{selectedVideoFormat.height} {selectedQuality.id === 'ultra' ? '(HD)' : '(SD)'}
                  </Text>
                  <Text style={styles.videoInfoText}>
                    <Text style={styles.videoInfoLabel}>Qualité: </Text>
                    {selectedQuality.name} ({generatedVideo.model})
                  </Text>
                  {generatedVideo.referenceImage && (
                    <Text style={styles.videoInfoText}>
                      <Text style={styles.videoInfoLabel}>Image de référence: </Text>
                      Utilisée
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
    position: 'relative',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
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
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B35',
    gap: 6,
  },
  randomButtonText: {
    color: '#FF6B35',
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
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B35',
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
    color: '#FF6B35',
    fontWeight: '600',
  },
  qualityDescription: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'center',
  },
  forceUltraNote: {
    fontSize: 12,
    color: '#B8860B',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  disabledQualityButton: {
    opacity: 0.4,
    backgroundColor: '#F0F0F0',
  },
  disabledQualityButtonText: {
    color: '#CCCCCC',
  },
  disabledQualityDescription: {
    color: '#CCCCCC',
  },
  videoFormatsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  videoFormatButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  selectedVideoFormatButton: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B35',
  },
  videoFormatEmoji: {
    fontSize: 24,
  },
  videoFormatButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  selectedVideoFormatButtonText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  videoFormatDimensions: {
    fontSize: 11,
    color: '#999999',
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
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
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
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    gap: 8,
  },
  importButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  importButtonSubtext: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  generateButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 30,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
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
  videoContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
    color: '#FF6B35',
    fontWeight: '500',
  },
  loadingProgressInFrame: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
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
  videoPlaceholderText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  videoErrorContainer: {
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
  videoErrorText: {
    fontSize: 32,
  },
  videoErrorMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF6B35',
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
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
  },
  videoInfo: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  videoInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  videoInfoText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  videoInfoLabel: {
    fontWeight: '600',
    color: '#000000',
  },
  noteContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  noteText: {
    color: '#1976D2',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  warningNote: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontWeight: '400',
  },
});