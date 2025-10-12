import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserCredential {
  user?: string;
  email?: string;
  fullName?: {
    givenName?: string;
    familyName?: string;
  };
  identityToken?: string;
  authorizationCode?: string;
  isGuest: boolean;
  createdAt: number;
}

class AuthService {
  private readonly STORAGE_KEY = 'userCredential';

  // Vérifier si l'utilisateur est connecté
  async isAuthenticated(): Promise<boolean> {
    try {
      const credential = await AsyncStorage.getItem(this.STORAGE_KEY);
      return !!credential;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  }

  // Récupérer les informations utilisateur
  async getUserCredential(): Promise<UserCredential | null> {
    try {
      const credential = await AsyncStorage.getItem(this.STORAGE_KEY);
      return credential ? JSON.parse(credential) : null;
    } catch (error) {
      console.error('Error getting user credential:', error);
      return null;
    }
  }

  // Déconnexion
  async signOut(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('✅ Déconnexion réussie');
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Impossible de se déconnecter');
    }
  }

  // Vérifier si l'utilisateur est invité
  async isGuest(): Promise<boolean> {
    try {
      const credential = await this.getUserCredential();
      return credential?.isGuest || false;
    } catch (error) {
      console.error('Error checking guest status:', error);
      return false;
    }
  }

  // Obtenir le nom d'affichage
  async getDisplayName(): Promise<string> {
    try {
      const credential = await this.getUserCredential();
      
      if (!credential) return 'Utilisateur';
      
      if (credential.isGuest) {
        return 'Invité';
      }
      
      if (credential.fullName?.givenName) {
        return credential.fullName.givenName;
      }
      
      if (credential.email) {
        return credential.email.split('@')[0];
      }
      
      return 'Utilisateur';
    } catch (error) {
      console.error('Error getting display name:', error);
      return 'Utilisateur';
    }
  }

  // Obtenir l'email
  async getEmail(): Promise<string | null> {
    try {
      const credential = await this.getUserCredential();
      return credential?.email || null;
    } catch (error) {
      console.error('Error getting email:', error);
      return null;
    }
  }
}

export const authService = new AuthService();