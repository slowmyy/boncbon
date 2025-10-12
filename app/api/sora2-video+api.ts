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

    console.log('📡 [SORA2] Envoi vers CometAPI Chat Completions...');
    console.log('📝 [SORA2] Paramètres:', { prompt: prompt.substring(0, 100), duration, aspectRatio });

    const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sora-2',
        stream: false,
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
      ok: response.ok,
      contentType: response.headers.get('content-type')
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

    const responseText = await response.text();
    console.log('📝 [SORA2] Réponse brute (premiers 1000 chars):', responseText.substring(0, 1000));

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [SORA2] Erreur parsing JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON response from CometAPI' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 [SORA2] Structure réponse:', {
      hasChoices: !!data.choices,
      hasLinks: !!data.links,
      hasId: !!data.id,
      topLevelKeys: Object.keys(data),
      choicesLength: data.choices?.length || 0
    });

    let videoUrl: string | null = null;

    if (data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content;
      console.log('📝 [SORA2] Contenu message (1000 chars):', content.substring(0, 1000));

      const mp4Match = content.match(/https?:\/\/[^\s"\]]+\.mp4/i);
      if (mp4Match) {
        videoUrl = mp4Match[0];
        console.log('✅ [SORA2] URL vidéo trouvée dans content:', videoUrl);

        return new Response(
          JSON.stringify({
            videoUrl,
            taskId: data.id || 'unknown',
            source: 'choices.content'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('⚠️ [SORA2] Pas de .mp4 trouvé dans content');
    }

    if (data.links?.source) {
      console.log('🔗 [SORA2] Polling via links.source:', data.links.source);

      try {
        videoUrl = await pollSora2Result(data.links.source, apiKey);

        console.log('✅ [SORA2] Vidéo prête après polling:', videoUrl);
        return new Response(
          JSON.stringify({
            videoUrl,
            taskId: data.id || 'unknown',
            source: 'polling'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (pollError) {
        console.error('❌ [SORA2] Erreur polling:', pollError);
        return new Response(
          JSON.stringify({
            error: 'Polling failed',
            details: pollError instanceof Error ? pollError.message : 'Unknown error'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log('🔍 [SORA2] Scan récursif de la réponse...');
    videoUrl = findVideoUrlInObject(data);

    if (videoUrl) {
      console.log('✅ [SORA2] URL trouvée via scan récursif:', videoUrl);
      return new Response(
        JSON.stringify({
          videoUrl,
          taskId: data.id || 'unknown',
          source: 'recursive_scan'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.error('❌ [SORA2] AUCUNE URL trouvée après toutes les méthodes');
    console.error('❌ [SORA2] Dump complet de la réponse:', JSON.stringify(data, null, 2));

    return new Response(
      JSON.stringify({
        error: 'Aucune URL de vidéo trouvée',
        debug: {
          hasChoices: !!data.choices,
          hasLinks: !!data.links,
          dataKeys: Object.keys(data),
          fullResponse: data
        }
      }),
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

  console.log(`🔗 [SORA2] Début polling sur: ${statusUrl}`);

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [SORA2] Polling tentative ${attempts}/${maxAttempts}`);

    try {
      const res = await fetch(statusUrl, {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      console.log(`📡 [SORA2] Polling response status: ${res.status}`);

      if (!res.ok) {
        console.warn(`⚠️ [SORA2] Erreur polling ${res.status}, continue...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const text = await res.text();
      console.log(`📊 [SORA2] Response text length: ${text.length}`);
      console.log(`📝 [SORA2] Response preview (500 chars):`, text.substring(0, 500));

      const match = text.match(/https?:\/\/[^\s\]"]+\.mp4/i);
      if (match) {
        console.log("🎥 [SORA2] Vidéo prête:", match[0]);
        return match[0];
      }

      try {
        const jsonData = JSON.parse(text);
        const urlFromJson = findVideoUrlInObject(jsonData);
        if (urlFromJson) {
          console.log("🎥 [SORA2] Vidéo trouvée via JSON parse:", urlFromJson);
          return urlFromJson;
        }
      } catch {
        // Pas de JSON valide, continuer
      }

      console.log("⏳ [SORA2] Vidéo pas encore prête...");

    } catch (pollError) {
      console.error('⚠️ [SORA2] Erreur polling:', pollError);
    }

    await new Promise(r => setTimeout(r, 5000));
  }

  console.error('❌ [SORA2] Timeout après 10 minutes');
  throw new Error('Timeout: vidéo non générée après 10 minutes');
}

function findVideoUrlInObject(obj: any, depth: number = 0, maxDepth: number = 10): string | null {
  if (depth > maxDepth) return null;
  if (!obj || typeof obj !== 'object') return null;

  if (typeof obj === 'string' && obj.match(/https?:\/\/[^\s"]+\.mp4/i)) {
    return obj;
  }

  for (const key in obj) {
    const value = obj[key];

    if (key.toLowerCase().includes('video') ||
        key.toLowerCase().includes('url') ||
        key.toLowerCase().includes('mp4')) {

      if (typeof value === 'string' && value.match(/https?:\/\/[^\s"]+\.mp4/i)) {
        return value;
      }
    }

    if (typeof value === 'object' && value !== null) {
      const found = findVideoUrlInObject(value, depth + 1, maxDepth);
      if (found) return found;
    }
  }

  return null;
}
