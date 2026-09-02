// Proveedor Claude — implementa el mismo contrato que gemini.js.
//
// No es el motor por defecto del MVP (arrancamos con Gemini para evitar
// billing), pero está aquí, funcional, como prueba de que la capa de
// abstracción realmente permite cambiar de proveedor sin tocar los endpoints
// de /api: solo cambia LLM_PROVIDER=claude y agrega ANTHROPIC_API_KEY.
// Basado en el patrón que ya usaba Job.hunter() v2 (callClaude + web_search).

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function getConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Cópiala en .env.local (ver .env.example) o en las Environment Variables de Vercel."
    );
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  // Las API keys nuevas de Anthropic van "vinculadas a tu identidad", no a un
  // workspace fijo — si tu key es de ese tipo, la API exige que le digas en
  // qué workspace operar vía este header, o responde 400 invalid_request_error
  // ("anthropic-workspace-id is required..."). Encuéntralo en Claude Console
  // → Settings → Workspaces → columna ID. Si tu key SÍ está ligada a un solo
  // workspace (keys legacy), este env var puede quedar vacío sin problema.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return { apiKey, model, workspaceId };
}

async function callClaude({ system, messages, tools, maxTokens = 4096, timeoutMs = 45000 }) {
  const { apiKey, model, workspaceId } = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        ...(workspaceId ? { "anthropic-workspace-id": workspaceId } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages,
        ...(tools ? { tools } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Claude API error (${res.status}): ${errText.slice(0, 500) || "sin detalle"}`);
    }
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const sources = (data.content || [])
      .filter((b) => b.type === "text" && Array.isArray(b.citations))
      .flatMap((b) => b.citations)
      .map((c) => c.url && { url: c.url, title: c.title })
      .filter(Boolean);

    return { text, sources, raw: data };
  } finally {
    clearTimeout(timer);
  }
}

function extractJSON(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        /* cae al error de abajo */
      }
    }
    throw new Error("Claude devolvió un JSON inválido: " + text.slice(0, 300));
  }
}

async function generateJSON({ system, prompt }) {
  // FIX (2 sep 2026): esta línea se agregaba SIEMPRE en español, sin
  // importar el idioma que pidiera el endpoint que llama (ej.
  // generate-cover-letter.js) — y quedaba como lo ÚLTIMO que el modelo lee
  // antes de responder (más peso por recencia). Si LLM_PROVIDER=claude,
  // esto podía ganarle a la instrucción de idioma del prompt de arriba. El
  // formato JSON no necesita estar en español para funcionar, así que la
  // pasamos a inglés neutral — cero señal de idioma extra.
  const jsonSystem = `${system}\n\nRespond ONLY with valid JSON, no markdown, no extra text.`;
  const { text } = await callClaude({
    system: jsonSystem,
    messages: [{ role: "user", content: prompt }],
  });
  return extractJSON(text);
}

async function generateWithSearch({ system, prompt }) {
  const { text, sources } = await callClaude({
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
  });
  return { text, sources };
}

export const claudeProvider = { generateJSON, generateWithSearch };
