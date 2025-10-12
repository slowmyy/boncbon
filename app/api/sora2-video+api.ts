export async function POST(request: Request) {
  console.log('🎬 [SORA2] API Route appelée pour Sora-2');

  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;

    console.log('🔑 [SORA2] Diagnostic:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      bodyReceived: !!body,
      model: 'sora-2',
      prompt: body?.prompt?.substring(0, 50) + '...',
      duration: body?.duration || 5,
      aspectRatio: body?.aspect_ratio || '16:9'
    });

    if (!apiKey) {
      console.error('❌ [SORA2] Clé API CometAPI manquante');
      return new Response(
        JSON.stringify({ error: 'CometAPI key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const prompt = body?.prompt || '';
    const duration = body?.duration || 5;
    const aspectRatio = body?.aspect_ratio || '16:9';

    const sizeMap: Record<string, string> = {
      '16:9': '1280x720',
      '9:16': '720x1280',
      '1:1': '1024x1024'
    };
    const size = sizeMap[aspectRatio] || '1280x720';

    console.log('📡 [SORA2] Création de la tâche via /v1/videos...');
    console.log('📝 [SORA2] Paramètres:', { prompt: prompt.substring(0, 100), duration, size });

    const formdata = new FormData();
    formdata.append('prompt', prompt);
    formdata.append('model', 'sora-2');
    formdata.append('seconds', duration.toString());
    formdata.append('size', size);

    const createResponse = await fetch('https://api.cometapi.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formdata
    });

    console.log('📥 [SORA2] Réponse création tâche:', {
      status: createResponse.status,
      statusText: createResponse.statusText,
      ok: createResponse.ok
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ [SORA2] Erreur création tâche:', errorText);

      return new Response(
        JSON.stringify({
          error: `Sora-2 task creation error: ${createResponse.status}`,
          details: errorText
        }),
        {
          status: createResponse.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const createData = await createResponse.json();
    console.log('📊 [SORA2] Données création tâche:', createData);

    const videoId = createData.id;

    if (!videoId) {
      console.error('❌ [SORA2] Aucun ID de tâche dans la réponse');
      return new Response(
        JSON.stringify({ error: 'Aucun ID de tâche retourné par CometAPI' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SORA2] Tâche créée, ID:', videoId);
    console.log('⏳ [SORA2] Début du polling...');

    const videoUrl = await pollSora2Video(videoId, apiKey);

    console.log('✅ [SORA2] Vidéo prête:', videoUrl);
    return new Response(
      JSON.stringify({
        videoUrl,
        taskId: videoId,
        source: 'sora-2-official-api'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 [SORA2] Erreur dans le proxy:', error);

    return new Response(
      JSON.stringify({
        error: 'Sora-2 proxy error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function pollSora2Video(videoId: string, apiKey: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 120;

  console.log(`🔗 [SORA2] Début polling sur: /v1/videos/${videoId}`);

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Polling tentative ${attempts}/${maxAttempts}`);

    try {
      const statusRes = await fetch(`https://api.cometapi.com/v1/videos/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      console.log(`📡 [SORA2] Polling response status: ${statusRes.status}`);

      if (!statusRes.ok) {
        console.warn(`⚠️ [SORA2] Erreur polling ${statusRes.status}, continue...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const statusJson = await statusRes.json();
      console.log(`📊 [SORA2] Statut: ${statusJson.status}, Progress: ${statusJson.progress || 'N/A'}`);
      console.log(`📝 [SORA2] Données complètes:`, JSON.stringify(statusJson, null, 2));

      if (statusJson.status === 'completed' && statusJson.assets && statusJson.assets.length > 0) {
        const videoUrl = statusJson.assets[0].url;
        console.log("🎥 [SORA2] Vidéo prête:", videoUrl);
        return videoUrl;
      }

      if (statusJson.status === 'failed' || statusJson.error) {
        const errorMsg = statusJson.error || 'Génération vidéo échouée';
        console.error('❌ [SORA2] Erreur:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log("⏳ [SORA2] Vidéo en cours de génération...");

    } catch (pollError) {
      console.error('⚠️ [SORA2] Erreur polling:', pollError);
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  console.error('❌ [SORA2] Timeout après 10 minutes');
  throw new Error('Timeout: vidéo non générée après 10 minutes');
}
