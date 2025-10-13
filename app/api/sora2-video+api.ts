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
    const duration = body?.duration || 5;
    const aspectRatio = body?.aspect_ratio || '16:9';

    const requestBody = {
      model: 'sora-2-turbo',
      prompt: prompt,
      aspect_ratio: aspectRatio,
      duration: duration,
      loop: false
    };

    console.log('📡 [SORA2] Requête CometAPI:', requestBody);

    const response = await fetch('https://api.cometapi.com/v1/generations', {
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
    console.log('📊 [SORA2] Réponse création:', data);

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

    const videoUrl = await pollForSora2Video(jobId, apiKey);

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

    const statusRes = await fetch(`https://api.cometapi.com/v1/generations/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!statusRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur récupération statut' }),
        { status: statusRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statusData = await statusRes.json();

    const videoUrl = statusData.output?.video_url ||
                     statusData.output?.url ||
                     statusData.video_url;

    return new Response(
      JSON.stringify({
        success: true,
        status: statusData.status,
        videoUrl: videoUrl || null,
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

async function pollForSora2Video(jobId: string, apiKey: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 120;
  const pollInterval = 5000;

  console.log(`🔗 [SORA2] Polling job: ${jobId}`);

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Tentative ${attempts}/${maxAttempts}`);

    try {
      const statusRes = await fetch(
        `https://api.cometapi.com/v1/generations/${jobId}`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }
      );

      if (!statusRes.ok) {
        console.warn(`⚠️ [SORA2] Status ${statusRes.status}, continue...`);
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const statusData = await statusRes.json();
      console.log(`📊 [SORA2] Status: ${statusData.status}`);

      if (statusData.status === 'succeeded') {
        const videoUrl = statusData.output?.video_url ||
                        statusData.output?.url ||
                        statusData.video_url;

        if (videoUrl) {
          console.log('✅ [SORA2] Vidéo trouvée:', videoUrl);
          return videoUrl;
        } else {
          console.warn('⚠️ [SORA2] Status succeeded mais pas d\'URL, continue...');
        }
      }

      if (statusData.status === 'failed') {
        const errorMsg = statusData.error?.message || 'Génération vidéo échouée';
        console.error('❌ [SORA2] Échec:', errorMsg);
        throw new Error(errorMsg);
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

  throw new Error('Timeout: vidéo non générée après 10 minutes');
}
