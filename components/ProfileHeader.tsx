import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { User } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProfileHeaderProps {
  onPress?: () => void;
}

export default function ProfileHeader({ onPress }: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/profile');
    }
  };

  return (
    <View style={[
      styles.container, 
      { 
        top: insets.top + 10,
      }
    ]}>
      <TouchableOpacity 
        style={styles.profileButton} 
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <User size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    zIndex: 9999,
    elevation: 9999,
    // Propriétés spécifiques par plateforme sans translateZ
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      // Utiliser transform3d au lieu de translateZ
      WebkitTransform: 'translate3d(0, 0, 0)',
      transform: 'translate3d(0, 0, 0)',
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      WebkitPerspective: '1000px',
      perspective: '1000px',
    }),
    // Pour mobile, utiliser des propriétés compatibles
    ...(Platform.OS !== 'web' && {
      // Pas de translateZ sur mobile
    }),
  },
  profileButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    // Propriétés spécifiques par plateforme
    ...(Platform.OS === 'web' && {
      WebkitTransform: 'translate3d(0, 0, 0)',
      transform: 'translate3d(0, 0, 0)',
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      pointerEvents: 'auto',
      isolation: 'isolate',
    }),
  },
});