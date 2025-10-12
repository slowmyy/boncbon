export async function POST(request: Request) {
  console.log('🎬 [RUNWARE VIDEO] API Route appelée');
  
  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_RUNWARE_API_KEY;

    console.log('🔑 [RUNWARE VIDEO] Diagnostic:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      bodyReceived: !!body,
      model: body?.model,
      prompt: body?.input?.prompt?.substring(0, 50) + '...',
      duration: body?.input?.duration,
      resolution: body?.input?.resolution,
      hasImageUrl: !!body?.input?.image_url
    });

    if (!apiKey) {
      console.error('❌ [RUNWARE VIDEO] Clé API manquante');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📡 [RUNWARE VIDEO] Envoi vers api.runware.io/v1/video/inference...');

    const response = await fetch('https://api.runware.io/v1/video/inference', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    console.log('📥 [RUNWARE VIDEO] Réponse Runware:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [RUNWARE VIDEO] Erreur Runware:', errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Runware Video API error: ${response.status}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    console.log('✅ [RUNWARE VIDEO] Succès');
    
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 [RUNWARE VIDEO] Erreur dans le proxy:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Runware video proxy error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}