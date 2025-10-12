export async function POST(request: Request) {
  console.log('🎬 [VEO3] API Route appelée pour Veo 3');
  
  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;

    console.log('🔑 [VEO3] Diagnostic:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      bodyReceived: !!body,
      model: body?.model || 'veo3',
      resolution: '1920x1080 (1080p)',
      prompt: body?.messages?.[0]?.content?.substring(0, 50) + '...'
    });

    if (!apiKey) {
      console.error('❌ [VEO3] Clé API CometAPI manquante');
      return new Response(
        JSON.stringify({ error: 'CometAPI key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // ÉTAPE 1: Créer la tâche Veo3
    console.log('📡 [VEO3] Création de la tâche via CometAPI...');
    
    const prompt = body?.messages?.[0]?.content || body?.prompt || '';
    
    const payload = {
      prompt: prompt,
      model: "veo3",
      enhance_prompt: true,
      width: 1920,
      height: 1080,
      aspect_ratio: "16:9"
    };

    const response = await fetch('https://api.cometapi.com/veo/v1/video/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 [VEO3] Réponse création tâche:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [VEO3] Erreur création tâche:', errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Veo3 task creation error: ${response.status}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    const taskId = data.id;
    
    if (!taskId) {
      console.error('❌ [VEO3] Aucun ID de tâche dans la réponse');
      return new Response(
        JSON.stringify({ error: 'Aucun ID de tâche retourné par CometAPI' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('✅ [VEO3] Tâche créée, ID:', taskId);
    
    // ÉTAPE 2: Polling pour le résultat
    console.log('⏳ [VEO3] Début du polling...');
    
    const videoUrl = await pollVeo3Result(taskId, apiKey);
    
    console.log('✅ [VEO3] Vidéo prête:', videoUrl);
    return new Response(
      JSON.stringify({ videoUrl }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 [VEO3] Erreur dans le proxy:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Veo3 proxy error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Fonction de polling pour Veo3
async function pollVeo3Result(taskId: string, apiKey: string): Promise<string> {
  const statusUrl = `https://asyncdata.net/source/${taskId}`;
  
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (120 * 5s)
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [VEO3] Polling tentative ${attempts}/${maxAttempts}`);
    
    try {
      const res = await fetch(statusUrl, {
        headers: { 
          "Authorization": `Bearer ${apiKey}` 
        }
      });
      
      if (!res.ok) {
        console.warn(`⚠️ [VEO3] Erreur polling ${res.status}, continue...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      
      const text = await res.text();
      console.log(`📊 [VEO3] Response text length: ${text.length}`);
      
      // Chercher l'URL .mp4 dans la réponse
      const match = text.match(/https?:\/\/[^\s"]+\.mp4/);
      if (match) {
        console.log("🎥 [VEO3] Vidéo prête:", match[0]);
        return match[0];
      }
      
      console.log("⏳ [VEO3] Vidéo en cours de génération...");
      
    } catch (pollError) {
      console.warn('⚠️ [VEO3] Erreur polling (continue):', pollError);
    }
    
    // Attendre 5 secondes avant la prochaine tentative
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Timeout après 10 minutes
  console.error('❌ [VEO3] Timeout après 10 minutes');
  throw new Error('Timeout: vidéo non générée après 10 minutes');
}