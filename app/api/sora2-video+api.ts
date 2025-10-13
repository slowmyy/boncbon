export async function POST(request: Request) {
  console.log('🎬 [SORA2] API Route appelée');

  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;

    if (!apiKey) {
      console.error('❌ [SORA2] Clé API manquante');
      return new Response(
        JSON.stringify({ error: 'CometAPI key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = body?.prompt || '';
    const duration = body?.duration || 10;
    const aspectRatio = body?.aspect_ratio || '16:9';

    const resolutionMap: Record<string, string> = {
      '16:9': '1280x720',
      '9:16': '720x1280',
      '1:1': '1024x1024'
    };

    const resolution = resolutionMap[aspectRatio] || '1280x720';

    const requestBody = {
      model: 'sora-2',
      prompt: prompt,
      duration: duration,
      resolution: resolution,
      style: body?.style || 'realistic'
    };

    console.log('📡 [SORA2] Envoi requête:', requestBody);

    const response = await fetch('https://api.cometapi.com/v1/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 [SORA2] Réponse:', {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SORA2] Erreur création:', errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erreur ${response.status}`,
          details: errorText
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('📊 [SORA2] Données reçues:', data);

    if (!data.id) {
      console.error('❌ [SORA2] Pas d\'ID dans la réponse');
      return new Response(
        JSON.stringify({ success: false, error: 'Pas d\'ID retourné' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const jobId = data.id;
    console.log('✅ [SORA2] Job créé:', jobId);
    console.log('⏳ [SORA2] Début polling...');

    const videoUrl = await pollForVideo(jobId, apiKey);

    console.log('✅ [SORA2] Vidéo prête:', videoUrl);
    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        taskId: jobId,
        status: 'completed'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [SORA2] Erreur:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key non configurée' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statusRes = await fetch(`https://api.cometapi.com/v1/videos/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!statusRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur récupération statut' }),
        { status: statusRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statusData = await statusRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        status: statusData.status,
        videoUrl: statusData.outputs?.[0] || null,
        progress: statusData.progress || 0
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [SORA2] Erreur GET:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function pollForVideo(jobId: string, apiKey: string): Promise<string> {
  const maxAttempts = 60;
  const pollInterval = 5000;
  let attempts = 0;

  console.log(`🔗 [SORA2] Polling job: ${jobId}`);

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Tentative ${attempts}/${maxAttempts}`);

    try {
      const statusRes = await fetch(`https://api.cometapi.com/v1/videos/${jobId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!statusRes.ok) {
        console.warn(`⚠️ [SORA2] Status ${statusRes.status}, continue...`);
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const statusData = await statusRes.json();
      console.log(`📊 [SORA2] Status: ${statusData.status}, Progress: ${statusData.progress || 0}%`);

      if (statusData.status === 'completed' && statusData.outputs?.[0]) {
        const videoUrl = statusData.outputs[0];
        console.log('✅ [SORA2] Vidéo trouvée:', videoUrl);
        return videoUrl;
      }

      if (statusData.status === 'failed') {
        throw new Error('Génération vidéo échouée');
      }

      console.log('⏳ [SORA2] En cours...');

    } catch (pollError) {
      if (pollError instanceof Error && pollError.message.includes('échouée')) {
        throw pollError;
      }
      console.error('⚠️ [SORA2] Erreur polling:', pollError);
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error('Timeout: vidéo non générée après 5 minutes');
}
