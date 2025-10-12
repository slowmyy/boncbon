/**
 * ✅ PATCH POUR GEMINI 2.5 FLASH IMAGE → Image-to-Image
 * Ce code n'affecte AUCUN autre modèle (Flux Schnell, Juggernaut, etc.).
 * Il ajoute simplement la logique image-to-image via CometAPI.
 */

// Utilitaire pour convertir un fichier/image URI en base64 pur
async function toBase64(uri: string): Promise<{ mime_type: string; data: string }> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();

  // Détection du type mime
  const mime_type = response.headers.get('content-type') || "image/jpeg";

  // Conversion en base64 avec Buffer (Node.js)
  const data = Buffer.from(buffer).toString('base64');

  return { mime_type, data };
}

// Extraction robuste du base64 image depuis la réponse CometAPI
function extractImageBase64(resp: any): string {
  console.log('🔍 [EXTRACT] Début extraction, structure complète:', JSON.stringify(resp, null, 2));
  
  const candidates = resp?.candidates;
  console.log('🔍 [EXTRACT] Candidates trouvés:', candidates?.length || 0);
  
  if (Array.isArray(candidates)) {
    for (const cand of candidates) {
      console.log('🔍 [EXTRACT] Analyse candidate:', {
        hasContent: !!cand?.content,
        contentKeys: Object.keys(cand?.content || {}),
        hasParts: !!cand?.content?.parts,
        partsLength: cand?.content?.parts?.length || 0
      });
      
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          console.log(`🔍 [EXTRACT] Part ${i}:`, {
            keys: Object.keys(part || {}),
            hasInlineData: !!(part?.inline_data || part?.inlineData),
            hasText: !!part?.text,
            textPreview: part?.text?.substring(0, 100)
          });
          
          const inline = part?.inline_data || part?.inlineData;
          if (inline) {
            console.log('🔍 [EXTRACT] Inline data trouvée:', {
              mimeType: inline.mime_type || inline.mimeType,
              hasData: !!inline.data,
              dataLength: inline.data?.length || 0,
              inlineKeys: Object.keys(inline)
            });
            
            if (inline.data && inline.data.length > 100) {
              const mimeType = inline.mime_type || inline.mimeType || "image/png";
              console.log('✅ [EXTRACT] Image extraite avec succès!');
              return `data:${mimeType};base64,${inline.data}`;
            }
          }
          
          // Vérifier si l'image est dans le texte (format markdown)
          if (typeof part?.text === "string" && part.text.includes("data:image/")) {
            console.log('🔍 [EXTRACT] Image trouvée dans le texte markdown');
            // Cas où l'image est encodée dans un markdown `![image](data:image/...)`
            const match = part.text.match(/(data:image\/[^)]+)/);
            if (match) {
              console.log('✅ [EXTRACT] Image markdown extraite!');
              return match[1];
            }
          }
        }
      }
    }
  }
  
  // Scan récursif pour d'autres formats possibles
  console.log('🔍 [EXTRACT] Scan récursif de la réponse...');
  const scanForImage = (obj: any, path: string = ''): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Chercher des patterns d'image
      if (typeof value === 'string') {
        if (value.startsWith('data:image/') && value.length > 100) {
          console.log(`✅ [EXTRACT] Image trouvée à ${currentPath}`);
          return value;
        }
        if (value.startsWith('http') && (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg'))) {
          console.log(`✅ [EXTRACT] URL image trouvée à ${currentPath}`);
          return value;
        }
      }
      
      // Récursion
      if (typeof value === 'object' && value !== null) {
        const found = scanForImage(value, currentPath);
        if (found) return found;
      }
    }
    return null;
  };
  
  const foundImage = scanForImage(resp);
  if (foundImage) {
    return foundImage;
  }
  
  console.error('❌ [EXTRACT] Aucune image trouvée dans la réponse complète');
  throw new Error("❌ Aucune image trouvée dans la réponse CometAPI");
}

// ✅ Handler principal
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, referenceImage } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing prompt" }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const apiKey = process.env.EXPO_PUBLIC_COMET_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing Comet API Key" }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🚀 [GEMINI] Début génération:', {
      hasPrompt: !!prompt,
      hasReferenceImage: !!referenceImage,
      promptLength: prompt?.length || 0,
      referenceImageType: referenceImage ? (
        referenceImage.startsWith('data:') ? 'base64' :
        referenceImage.startsWith('http') ? 'http' : 'other'
      ) : 'none'
    });

    // Construire parts (prompt + image si présente)
    const parts: any[] = [{ text: prompt }];

    if (referenceImage) {
      console.log('🖼️ [GEMINI] Conversion image de référence...');
      const inlineData = await toBase64(referenceImage);
      console.log('✅ [GEMINI] Image convertie:', {
        mimeType: inlineData.mime_type,
        dataLength: inlineData.data.length
      });
      parts.push({ inline_data: inlineData });
    }

    // Payload CometAPI pour Gemini i2i
    const payload = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"]
      }
    };

    console.log('📡 [GEMINI] Envoi vers CometAPI...');
    
    // Créer un AbortController avec timeout de 60 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ [GEMINI] Timeout de 60s atteint');
      controller.abort();
    }, 60000);

    let res;
    try {
      res = await fetch(
        "https://api.cometapi.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('❌ [GEMINI] Requête annulée par timeout');
        return new Response(
          JSON.stringify({ 
            error: "Timeout de génération", 
            details: "La génération a pris trop de temps (60s). Réessayez avec un prompt plus simple." 
          }), 
          { 
            status: 408,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      console.error('❌ [GEMINI] Erreur de connexion:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: "Erreur de connexion", 
          details: "Impossible de contacter l'API CometAPI. Vérifiez votre connexion." 
        }), 
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    clearTimeout(timeoutId);
    
    console.log('📥 [GEMINI] Réponse CometAPI reçue:', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ [GEMINI] Erreur CometAPI:', {
        status: res.status,
        statusText: res.statusText,
        errorText: errorText.substring(0, 500)
      });
      return new Response(
        JSON.stringify({ error: "CometAPI error", details: errorText }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('🔄 [GEMINI] Parsing de la réponse...');
    const data = await res.json();
    console.log('📊 [GEMINI] Données reçues:', {
      topLevelKeys: Object.keys(data || {}),
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length || 0,
      responseSize: JSON.stringify(data).length
    });
    
    console.log('📊 [GEMINI] Données reçues:', {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length || 0,
      topLevelKeys: Object.keys(data || {})
    });
    
    const imageBase64 = extractImageBase64(data);
    console.log('✅ [GEMINI] Image extraite avec succès');

    return new Response(
      JSON.stringify({ imageUrl: imageBase64 }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    console.error('💥 [GEMINI] Erreur générale:', err);
    console.error('💥 [GEMINI] Stack trace:', err.stack);
    return new Response(
      JSON.stringify({ error: err.message || "Server error" }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}