export async function POST(request: Request) {
  console.log('🎬 [SORA2] API Route appelée pour Sora-2 Normal');

  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;

    console.log('🔑 [SORA2] Diagnostic:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      bodyReceived: !!body,
      model: 'sora2-normal',
      duration: body?.duration || 5,
      aspectRatio: body?.aspect_ratio || '16:9',
      prompt: body?.prompt?.substring(0, 50) + '...'
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

    const dimensions = getDimensions(aspectRatio);

    console.log('📡 [SORA2] Création de la tâche via CometAPI...');

    const payload = {
      prompt: prompt,
      model: "sora2-normal",
      duration: duration,
      enhance_prompt: true,
      width: dimensions.width,
      height: dimensions.height,
      aspect_ratio: aspectRatio
    };

    const response = await fetch('https://api.cometapi.com/sora/v1/video/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 [SORA2] Réponse création tâche:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SORA2] Erreur création tâche:', errorText);

      return new Response(
        JSON.stringify({
          error: `Sora-2 task creation error: ${response.status}`,
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
      console.error('❌ [SORA2] Aucun ID de tâche dans la réponse');
      return new Response(
        JSON.stringify({ error: 'Aucun ID de tâche retourné par CometAPI' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ [SORA2] Tâche créée, ID:', taskId);

    console.log('⏳ [SORA2] Début du polling...');

    const videoUrl = await pollSora2Result(taskId, apiKey);

    console.log('✅ [SORA2] Vidéo prête:', videoUrl);
    return new Response(
      JSON.stringify({ videoUrl, taskId }),
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

async function pollSora2Result(taskId: string, apiKey: string): Promise<string> {
  const statusUrl = `https://asyncdata.net/source/${taskId}`;

  let attempts = 0;
  const maxAttempts = 180;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Polling tentative ${attempts}/${maxAttempts}`);

    try {
      const res = await fetch(statusUrl, {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (!res.ok) {
        console.warn(`⚠️ [SORA2] Erreur polling ${res.status}, continue...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const text = await res.text();
      console.log(`📊 [SORA2] Response text length: ${text.length}`);

      const match = text.match(/https?:\/\/[^\s"]+\.mp4/);
      if (match) {
        console.log("🎥 [SORA2] Vidéo prête:", match[0]);
        return match[0];
      }

      console.log("⏳ [SORA2] Vidéo en cours de génération...");

    } catch (pollError) {
      console.warn('⚠️ [SORA2] Erreur polling (continue):', pollError);
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  console.error('❌ [SORA2] Timeout après 15 minutes');
  throw new Error('Timeout: vidéo non générée après 15 minutes');
}

function getDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '16:9':
      return { width: 1920, height: 1080 };
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    default:
      return { width: 1920, height: 1080 };
  }
}
