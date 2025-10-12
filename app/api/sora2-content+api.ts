export async function GET(request: Request) {
  console.log('📥 [SORA2-CONTENT] Endpoint appelé pour télécharger vidéo');

  try {
    const url = new URL(request.url);
    const videoId = url.searchParams.get('videoId');

    if (!videoId) {
      console.error('❌ [SORA2-CONTENT] videoId manquant');
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
      console.error('❌ [SORA2-CONTENT] API key manquante');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📡 [SORA2-CONTENT] Téléchargement de /v1/videos/${videoId}/content`);

    const contentResponse = await fetch(
      `https://api.cometapi.com/v1/videos/${videoId}/content`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    console.log('📥 [SORA2-CONTENT] Réponse CometAPI:', {
      status: contentResponse.status,
      ok: contentResponse.ok,
      contentType: contentResponse.headers.get('content-type')
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      console.error('❌ [SORA2-CONTENT] Erreur téléchargement:', errorText);

      return new Response(
        JSON.stringify({ error: 'Failed to download video content', details: errorText }),
        {
          status: contentResponse.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const videoBuffer = await contentResponse.arrayBuffer();
    console.log(`✅ [SORA2-CONTENT] Vidéo téléchargée, taille: ${videoBuffer.byteLength} bytes`);

    return new Response(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="sora2_${videoId}.mp4"`,
        'Content-Length': videoBuffer.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('💥 [SORA2-CONTENT] Erreur:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
