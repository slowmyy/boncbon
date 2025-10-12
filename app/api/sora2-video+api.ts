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

    console.log('📡 [SORA2] Envoi vers CometAPI Chat Completions...');

    const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sora-2',
        stream: true,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    console.log('📥 [SORA2] Réponse reçue:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SORA2] Erreur:', errorText);

      return new Response(
        JSON.stringify({
          error: `Sora-2 error: ${response.status}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    console.log('📊 [SORA2] Données reçues:', {
      hasChoices: !!data.choices,
      hasLinks: !!data.links,
      id: data.id
    });

    let videoUrl: string | null = null;

    if (data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      console.log('📝 [SORA2] Contenu message:', content.substring(0, 100));

      const mp4Match = content.match(/https?:\/\/[^\s"]+\.mp4/);
      if (mp4Match) {
        videoUrl = mp4Match[0];
        console.log('✅ [SORA2] URL vidéo trouvée directement:', videoUrl);

        return new Response(
          JSON.stringify({ videoUrl, taskId: data.id || 'unknown' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (data.links?.source) {
      console.log('🔗 [SORA2] Polling via links.source:', data.links.source);
      videoUrl = await pollSora2Result(data.links.source, apiKey);

      console.log('✅ [SORA2] Vidéo prête:', videoUrl);
      return new Response(
        JSON.stringify({ videoUrl, taskId: data.id || 'unknown' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.error('❌ [SORA2] Aucune URL trouvée dans la réponse');
    return new Response(
      JSON.stringify({ error: 'Aucune URL de vidéo trouvée' }),
      {
        status: 500,
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

async function pollSora2Result(statusUrl: string, apiKey: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 120;

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

      const match = text.match(/https?:\/\/[^\s\]"]+\.mp4/i);
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

  console.error('❌ [SORA2] Timeout après 10 minutes');
  throw new Error('Timeout: vidéo non générée après 10 minutes');
}
