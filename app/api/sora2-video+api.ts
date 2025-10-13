export async function POST(request: Request) {
  console.log('🎬 [SORA2] API Route appelée');

  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;

    if (!apiKey) {
      console.error('❌ [SORA2] Clé API manquante');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CometAPI key not configured'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prompt = body?.prompt || '';
    const duration = body?.duration || 10;
    const aspectRatio = body?.aspect_ratio || '16:9';

    if (!prompt || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Prompt cannot be empty'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = {
      model: 'sora-2',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}. Duration: ${duration}s. Aspect ratio: ${aspectRatio}`
            }
          ]
        }
      ],
      max_tokens: 300
    };

    console.log('📡 [SORA2] Requête CometAPI Chat Completions:', requestBody);

    const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 [SORA2] Réponse:', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SORA2] Erreur création:', errorText);

      return new Response(
        JSON.stringify({
          success: false,
          error: `CometAPI error ${response.status}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    console.log('📊 [SORA2] Réponse création:', data);

    const statusUrl = data.links?.source;

    if (!statusUrl) {
      console.error('❌ [SORA2] Pas de lien de status dans la réponse');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No status link in response',
          details: JSON.stringify(data)
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [SORA2] Status URL:', statusUrl);
    console.log('⏳ [SORA2] Début polling...');

    const videoUrl = await pollForSora2Video(statusUrl, apiKey);

    console.log('✅ [SORA2] Vidéo prête:', videoUrl);
    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        taskId: data.id || 'sora2-' + Date.now(),
        status: 'completed'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 [SORA2] Erreur:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function pollForSora2Video(statusUrl: string, apiKey: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 120;
  const pollInterval = 5000;

  console.log(`🔗 [SORA2] Polling status URL: ${statusUrl}`);

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Tentative ${attempts}/${maxAttempts}`);

    try {
      const statusRes = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json, text/plain, */*'
        }
      });

      if (!statusRes.ok) {
        console.warn(`⚠️ [SORA2] Status ${statusRes.status}, retry...`);
        await new Promise(r => setTimeout(r, pollInterval));
        continue;
      }

      const contentType = statusRes.headers.get('content-type');
      console.log(`📋 [SORA2] Content-Type: ${contentType}`);

      if (contentType?.includes('application/json')) {
        const jsonData = await statusRes.json();
        console.log('📊 [SORA2] JSON Response:', JSON.stringify(jsonData, null, 2));

        const videoUrl =
          jsonData.output?.video_url ||
          jsonData.output?.url ||
          jsonData.video_url ||
          jsonData.url ||
          jsonData.result?.video_url ||
          jsonData.data?.video_url;

        if (videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
          console.log('✅ [SORA2] URL vidéo trouvée (JSON):', videoUrl);
          return videoUrl;
        }

        const status = jsonData.status || jsonData.state;
        console.log(`📊 [SORA2] Status: ${status}`);

        if (status === 'failed' || status === 'error') {
          throw new Error(`Génération échouée: ${jsonData.error || 'Unknown error'}`);
        }

        if (status !== 'completed' && status !== 'succeeded') {
          console.log('⏳ [SORA2] En cours...');
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }
      }

      const text = await statusRes.text();
      console.log(`📊 [SORA2] Text response length: ${text.length}`);
      console.log(`📝 [SORA2] Text preview: ${text.substring(0, 500)}`);

      const patterns = [
        /High-quality video generated[\s\S]*?(https?:\/\/[^\s\]"<]+\.mp4)/i,
        /https?:\/\/[^\s\]"<]+\.mp4/i,
        /(?:href|src)=["']?(https?:\/\/[^\s"'<>]+\.mp4)/i,
        /```[\s\S]*?(https?:\/\/[^\s`]+\.mp4)/i,
        /(?:video_url|videoUrl)["']?\s*:\s*["']?(https?:\/\/[^\s"']+\.mp4)/i
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const videoUrl = match[1] || match[0];
          const cleanUrl = videoUrl.replace(/[,;)\]}>]+$/, '').trim();

          if (cleanUrl.startsWith('http') && cleanUrl.includes('.mp4')) {
            console.log('✅ [SORA2] URL vidéo trouvée (text):', cleanUrl);
            return cleanUrl;
          }
        }
      }

      console.log('⏳ [SORA2] Vidéo pas encore prête (aucune URL trouvée)...');

    } catch (pollError) {
      console.error('⚠️ [SORA2] Erreur polling:', pollError);

      if (pollError instanceof Error &&
          (pollError.message.includes('échouée') ||
           pollError.message.includes('failed'))) {
        throw pollError;
      }
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  throw new Error('Timeout: vidéo non récupérée après 10 minutes');
}

export async function GET(request: Request) {
  return new Response(
    JSON.stringify({
      error: 'Use POST method for video generation'
    }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
