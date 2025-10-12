import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { authService } from '@/services/auth';

export function useAuthRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      const isAuthenticated = await authService.isAuthenticated();
      const inAuthGroup = segments[0] === 'auth';

      console.log('🔍 Auth check:', {
        isAuthenticated,
        inAuthGroup,
        segments: segments.join('/')
      });

      if (!isAuthenticated && !inAuthGroup) {
        // Pas connecté et pas sur la page de connexion -> rediriger vers login
        console.log('➡️ Redirection vers login');
        router.replace('/auth/login');
      } else if (isAuthenticated && inAuthGroup) {
        // Connecté mais sur la page de connexion -> rediriger vers l'app
        console.log('➡️ Redirection vers app');
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('❌ Erreur auth redirect:', error);
      // En cas d'erreur, rediriger vers login par sécurité
      router.replace('/auth/login');
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading };
}