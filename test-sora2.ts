// Script de test simple pour Sora-2
// Exécutez ce script pour tester l'API CometAPI directement

const API_KEY = process.env.EXPO_PUBLIC_COMET_API_KEY || 'sk-GB1ZFRaoA4DhBGEsMJhA92qCICdi1bfsnOR7Al2Ty8gtlddr';

async function testSora2() {
  console.log('🎬 TEST SORA-2 - Début');
  console.log('📋 Clé API:', API_KEY.substring(0, 10) + '...');

  try {
    const requestBody = {
      model: 'sora-2',
      messages: [
        {
          role: 'user',
          content: 'A beautiful sunset over the ocean with waves. Duration: 10s. Aspect ratio: 16:9'
        }
      ],
      stream: false,
      max_tokens: 500
    };

    console.log('📡 Envoi requête à CometAPI...');

    const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Réponse:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur:', errorText);
      return;
    }

    const data = await response.json();
    console.log('📊 Data:', JSON.stringify(data, null, 2));

    const statusUrl = data.links?.source || data.source;
    if (statusUrl) {
      console.log('🔗 Status URL:', statusUrl);
      console.log('✅ Configuration OK - Polling nécessaire pour récupérer la vidéo');
    } else {
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        console.log('📝 Content:', content);
        const mp4Match = content.match(/https?:\/\/[^\s"]+\.mp4/);
        if (mp4Match) {
          console.log('✅ URL Vidéo:', mp4Match[0]);
        }
      }
    }

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

testSora2();
