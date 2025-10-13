# 🧹 Instructions de nettoyage localStorage

## ⚠️ IMPORTANT - À faire AVANT de tester

Le localStorage contient des données corrompues qui empêchent l'application de fonctionner correctement.

### Étape 1: Ouvrir la console du navigateur

1. Appuyez sur `F12` (ou `Cmd+Option+I` sur Mac)
2. Allez dans l'onglet **Console**

### Étape 2: Exécuter le script de nettoyage

Copiez et collez ce code dans la console, puis appuyez sur `Enter`:

```javascript
localStorage.removeItem('genly_generated_videos');
localStorage.removeItem('genly_generated_images');
console.log('✅ localStorage nettoyé');
location.reload();
```

### Étape 3: La page va se recharger automatiquement

L'application devrait maintenant fonctionner correctement.

---

## 🔍 Ce qui a été corrigé

### Problème 1: Data URLs vidéo
**AVANT**: Tentait de stocker des vidéos entières en data URL (plusieurs MB)
**APRÈS**: Refuse les data URLs vidéo, accepte seulement les URLs HTTP/HTTPS

### Problème 2: Pas de validation
**AVANT**: Acceptait n'importe quelle URL
**APRÈS**: Valide strictement que les vidéos ont des URLs HTTP/HTTPS valides

### Problème 3: Stockage corrompu
**AVANT**: Aucun nettoyage automatique
**APRÈS**: Nettoie automatiquement les vidéos invalides au chargement

### Problème 4: Quota localStorage
**AVANT**: Pas de gestion de la taille
**APRÈS**:
- Vérifie la taille avant de stocker (limite 2MB)
- Réduit automatiquement à 10 vidéos si trop gros
- Nettoie et réessaye si quota dépassé

---

## 🎯 Logs attendus après correction

Lors de la génération d'une vidéo Sora-2, vous devriez voir:

```
💾 [STORAGE] Début sauvegarde: { isVideo: true, urlType: 'http', urlLength: 85 }
🎬 [STORAGE] Type VIDÉO détecté
📊 [STORAGE] Vidéos existantes: 0
💾 [STORAGE] Taille JSON: 1 KB
✅ [STORAGE] Vidéo sauvegardée
```

Dans la galerie:

```
📂 [STORAGE] getAllVideos() appelé
✅ [STORAGE] Vidéos parsées: 1
```

---

## ❌ Si vous voyez ces erreurs

### Erreur: "Impossible de stocker une vidéo en data URL"
**Cause**: Le service essaye de sauvegarder une vidéo avec une data URL au lieu d'une URL HTTP
**Solution**: Vérifier que `sora2.ts` retourne bien une URL HTTP (pas de data URL)

### Erreur: "URL de vidéo invalide - doit être une URL HTTP/HTTPS"
**Cause**: L'URL de la vidéo ne commence pas par http:// ou https://
**Solution**: Vérifier le polling dans `sora2.ts` pour s'assurer qu'il extrait correctement l'URL

### Erreur: "quota localStorage dépassé"
**Cause**: Trop de vidéos stockées
**Solution**: Le système nettoie automatiquement, mais vous pouvez aussi exécuter:
```javascript
localStorage.removeItem('genly_generated_videos');
```
