# 🎬 Configuration Sora-2 via CometAPI

## ✅ Installation Complète

### 1. Service créé
Le fichier `services/sora2.ts` contient le service complet Sora-2.

### 2. Variables d'environnement
Le fichier `.env` contient déjà la clé API :
```
EXPO_PUBLIC_COMET_API_KEY=sk-GB1ZFRaoA4DhBGEsMJhA92qCICdi1bfsnOR7Al2Ty8gtlddr
```

### 3. Composant de test
Un composant de test `components/Sora2Test.tsx` a été ajouté à la page vidéo.

## 🧪 Test Immédiat

### Via le composant de test
1. Allez sur l'onglet "Vidéo"
2. En haut de la page, vous verrez "🧪 Test Sora-2"
3. Cliquez sur "Tester Sora-2"
4. Ouvrez la console pour voir les logs détaillés

### Via le code
```typescript
import { sora2Service } from '@/services/sora2';

const result = await sora2Service.generateVideo(
  {
    prompt: 'A beautiful sunset over the ocean',
    duration: 10,
    aspectRatio: '16:9'
  },
  (progress) => console.log(`${progress}%`)
);

console.log('Vidéo:', result.videoUrl);
```

## 📊 Logs attendus

### ✅ Succès
```
🎬 [SORA2] Début génération: { prompt: 'A beautiful sunset...', duration: 10, aspectRatio: '16:9' }
📡 [SORA2] Envoi requête à CometAPI...
📊 [SORA2] Réponse CometAPI reçue
🔗 [SORA2] Status URL trouvée, polling...
⏳ [SORA2] Début polling (max 10 minutes)
🔄 [SORA2] Polling... 10/120
🔄 [SORA2] Polling... 20/120
...
✅ [SORA2] Vidéo trouvée: https://...mp4
```

### ❌ Erreurs possibles

**Clé API manquante**
```
⚠️ [SORA2] Clé API CometAPI manquante
```
→ Vérifiez que `EXPO_PUBLIC_COMET_API_KEY` est dans `.env`

**Erreur API**
```
❌ [SORA2] Erreur API: {...}
```
→ Vérifiez que votre clé API est valide et a des crédits

**Timeout**
```
Timeout: vidéo non récupérée après 10 minutes
```
→ La génération a pris trop de temps, réessayez

## 🔧 Configuration

### Formats supportés
- **Durée** : `5` ou `10` secondes
- **Aspect Ratio** : `16:9`, `9:16`, `1:1`

### Polling
- **Max tentatives** : 120 (10 minutes)
- **Intervalle** : 5 secondes
- **Logs** : Tous les 10 tentatives

### Validation
- ✅ Vérifie que la clé API existe
- ✅ Vérifie que le prompt n'est pas vide
- ✅ Vérifie que l'URL retournée est valide (HTTP/HTTPS + .mp4)

## 📝 Utilisation dans le générateur vidéo

Pour intégrer Sora-2 dans le générateur vidéo principal :

1. Ajoutez l'option "Max" dans `VIDEO_QUALITY_OPTIONS`
2. Importez `sora2Service`
3. Ajoutez la condition pour appeler Sora-2
4. Gérez le stockage de la vidéo générée

## 🚀 Prochaines étapes

1. **Tester la génération** → Cliquez sur le bouton de test
2. **Vérifier les logs** → Regardez la console
3. **Intégrer dans l'UI** → Ajoutez l'option Sora-2 au générateur
4. **Configurer Supabase** → Pour stocker les vidéos de manière permanente

## ⚠️ Notes importantes

- Le polling peut prendre **2-10 minutes** (c'est normal pour Sora-2)
- La clé API est **exposée côté client** (OK pour test, pas pour production)
- Pour production → Créer une route API serveur qui proxy les requêtes
- Les vidéos générées sont hébergées temporairement par CometAPI
- Pour stockage permanent → Utiliser Supabase Storage
