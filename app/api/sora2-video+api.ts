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

    const dimensionMap: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 1024, height: 1024 }
    };

    const dimensions = dimensionMap[aspectRatio] || { width: 1280, height: 720 };

    console.log('📡 [SORA2] Création via CometAPI avec JSON...');

    const payload = {
      model: 'sora-2',
      prompt: prompt,
      seconds: duration,
      width: dimensions.width,
      height: dimensions.height,
      aspect_ratio: aspectRatio
    };

    console.log('📝 [SORA2] Payload:', payload);

    const createResponse = await fetch('https://api.cometapi.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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

    const createText = await createResponse.text();
    console.log('📝 [SORA2] Response brute:', createText);
    const createData = JSON.parse(createText);
    console.log('📊 [SORA2] Response parsed:', JSON.stringify(createData, null, 2));

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
  const maxAttempts = 180;

  console.log(`🔗 [SORA2] Début polling: /v1/videos/${videoId}`);

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Polling ${attempts}/${maxAttempts}`);

    try {
      const statusRes = await fetch(`https://api.cometapi.com/v1/videos/${videoId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!statusRes.ok) {
        console.warn(`⚠️ [SORA2] Status ${statusRes.status}, continue...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const statusJson = await statusRes.json();
      console.log(`📊 [SORA2] Status: ${statusJson.status}`);

      let videoUrl: string | null = null;

      if (statusJson.status === 'completed' && statusJson.assets?.[0]?.url) {
        videoUrl = statusJson.assets[0].url;
      }
      else if (statusJson.video_url) {
        videoUrl = statusJson.video_url;
      }
      else if (statusJson.url) {
        videoUrl = statusJson.url;
      }
      else if (statusJson.output?.url) {
        videoUrl = statusJson.output.url;
      }
      else if (statusJson.result?.url) {
        videoUrl = statusJson.result.url;
      }

      if (videoUrl && videoUrl.startsWith('http')) {
        console.log("✅ [SORA2] Vidéo trouvée:", videoUrl);
        return videoUrl;
      }

      if (statusJson.status === 'failed' || statusJson.error) {
        throw new Error(statusJson.error || 'Génération échouée');
      }

      console.log("⏳ [SORA2] En cours...");

    } catch (pollError) {
      console.error('⚠️ [SORA2] Erreur polling:', pollError);
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error('Timeout après 15 minutes');
}
