export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = process.env.EXPO_PUBLIC_RUNWARE_API_KEY;
    const apiUrl = process.env.EXPO_PUBLIC_RUNWARE_API_URL || 'https://api.runware.ai/v1';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RUNWARE_API_KEY missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const bodyToSend = Array.isArray(body) ? body : [body];

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*,application/json'
      },
      body: JSON.stringify(bodyToSend)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: 'Runware error', message: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.startsWith('image/')) {
      return new Response(response.body, {
        status: 200,
        headers: { 'Content-Type': contentType }
      });
    } else {
      const data = await response.json();
      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[PROXY ERROR]', error);
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
