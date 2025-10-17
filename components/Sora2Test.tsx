import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { sora2Service } from '@/services/sora2';

export default function Sora2Test() {
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testSora2 = async () => {
    console.log('🚀 [TEST] Début test Sora-2');
    setTesting(true);
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      console.log('📋 [TEST] Configuration:', {
        isConfigured: sora2Service.isConfigured(),
        hasApiKey: !!process.env.EXPO_PUBLIC_COMET_API_KEY
      });

      const videoResult = await sora2Service.generateVideo(
        {
          prompt: 'A beautiful sunset over the ocean with waves crashing',
          duration: 10,
          aspectRatio: '16:9'
        },
        (prog) => {
          console.log(`📊 [TEST] Progress: ${prog}%`);
          setProgress(prog);
        }
      );

      console.log('✅ [TEST] Résultat:', videoResult);
      setResult(videoResult.videoUrl);

    } catch (err) {
      console.error('❌ [TEST] Erreur:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Test Sora-2</Text>

      <TouchableOpacity
        style={[styles.button, testing && styles.buttonDisabled]}
        onPress={testSora2}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Génération en cours...' : 'Tester Sora-2'}
        </Text>
      </TouchableOpacity>

      {testing && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>✅ Succès !</Text>
          <Text style={styles.resultText} numberOfLines={2}>{result}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>❌ Erreur</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.instructions}>
        Vérifiez la console pour voir les logs détaillés
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    margin: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
    padding: 20,
  },
  progressText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  resultContainer: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#D32F2F',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
  },
  instructions: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
