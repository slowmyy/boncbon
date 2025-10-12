export async function POST(request: Request) {
  console.log('🎬 [SORA2] API Route appelée pour Sora-2');

  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;

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

    const durationMap: Record<number, string> = {
      5: '4',
      10: '8'
    };
    const seconds = durationMap[duration] || '8';

    console.log('📡 [SORA2] Création via CometAPI avec payload corrigé');

    const payload = {
      model: 'sora-2',
      prompt: prompt,
      size: size,
      seconds: seconds
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

    console.log('📥 [SORA2] Réponse création:', {
      status: createResponse.status,
      ok: createResponse.ok
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ [SORA2] Erreur création:', errorText);

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
    console.log('📊 [SORA2] Données création:', createData);

    const videoId = createData.id;

    if (!videoId) {
      console.error('❌ [SORA2] Aucun ID dans la réponse');
      return new Response(
        JSON.stringify({ error: 'Aucun ID de tâche retourné' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SORA2] Tâche créée, ID:', videoId);
    console.log('⏳ [SORA2] Début du polling...');

    await pollUntilComplete(videoId, apiKey);

    const videoUrl = `/api/sora2-content?videoId=${videoId}`;

    console.log('✅ [SORA2] Vidéo prête, URL de contenu:', videoUrl);
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
    console.error('💥 [SORA2] Erreur:', error);

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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const videoId = url.searchParams.get('videoId');

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId parameter required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const statusRes = await fetch(`https://api.cometapi.com/v1/videos/${videoId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!statusRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch video status' }),
        {
          status: statusRes.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const status = await statusRes.json();

    let contentUrl = null;
    if (status.status === 'completed') {
      contentUrl = `/api/sora2-content?videoId=${videoId}`;
    }

    return new Response(
      JSON.stringify({
        ...status,
        contentUrl
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking video status:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function pollUntilComplete(videoId: string, apiKey: string): Promise<void> {
  const maxAttempts = 240;
  const pollInterval = 5000;
  let attempts = 0;

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
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const statusJson = await statusRes.json();
      console.log(`📊 [SORA2] Status: ${statusJson.status}, Progress: ${statusJson.progress || 0}%`);

      if (statusJson.status === 'completed') {
        console.log("✅ [SORA2] Vidéo complétée!");
        return;
      }

      if (statusJson.status === 'failed') {
        const errorMsg = statusJson.error?.message || statusJson.error || 'Génération échouée';
        console.error('❌ [SORA2] Erreur:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log("⏳ [SORA2] En cours...");

    } catch (pollError) {
      if (pollError instanceof Error && pollError.message.includes('Génération échouée')) {
        throw pollError;
      }
      console.error('⚠️ [SORA2] Erreur polling:', pollError);
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error('Timeout après 20 minutes');
}
