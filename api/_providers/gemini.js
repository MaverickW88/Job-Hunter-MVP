// Proveedor Gemini — implementa el contrato de api/_llmProvider.js.
//
// ⚠️ Nota de riesgo (ya está en el decision log del proyecto): la API de
// Gemini está en movimiento (Google introdujo una "Interactions API" en 2026
// como nueva puerta de entrada; este archivo usa el endpoint clásico
// `generateContent`, que Google documenta como "legacy pero totalmente
// soportado"). Antes de confiar en esto en producción, valida los nombres de
// campo exactos contra https://ai.google.dev/api/generate-content con tu
// propia API key — es el primer punto a probar el Día 1 de build.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY. Cópiala en .env.local (ver .env.example) o en las Environment Variables de Vercel."
    );
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return { apiKey, model };
}

// Convierte nuestro JSON Schema simplificado (type en minúsculas, como
// Draft-07 / OpenAPI estándar) al formato que espera Gemini (type en
// MAYÚSCULAS). Así los endpoints de /api describen su schema una sola vez, de
// forma estándar, y cada proveedor lo traduce a su propio dialecto.
function toGeminiSchema(schema) {
  if (schema == null || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      out[key] = value.toUpperCase();
    } else if (key === "properties" && typeof value === "object") {
      out[key] = Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, toGeminiSchema(v)])
      );
    } else if (key === "items") {
      out[key] = toGeminiSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function callGenerateContent({ system, prompt, extraBody = {}, timeoutMs = 45000 }) {
  const { apiKey, model } = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...extraBody,
  };

  try {
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 500) || "sin detalle"}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error("Gemini no devolvió candidatos. Respuesta cruda: " + JSON.stringify(data).slice(0, 300));
    }

    const text = (candidate.content?.parts || [])
      .map((p) => p.text || "")
      .join("\n")
      .trim();

    const sources = (candidate.groundingMetadata?.groundingChunks || [])
      .map((chunk) => chunk.web && { url: chunk.web.uri, title: chunk.web.title })
      .filter(Boolean);

    return { text, sources, raw: data };
  } finally {
    clearTimeout(timer);
  }
}

async function generateJSON({ system, prompt, schema }) {
  const { text } = await callGenerateContent({
    system,
    prompt,
    extraBody: {
      generationConfig: {
        responseMimeType: "application/json",
        ...(schema ? { responseSchema: toGeminiSchema(schema) } : {}),
      },
    },
  });
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Gemini devolvió un JSON inválido: " + text.slice(0, 300));
  }
}

async function generateWithSearch({ system, prompt }) {
  // Nota: al usar la tool de búsqueda, no combinamos responseMimeType/schema
  // (Gemini históricamente no permite mezclar grounding con salida JSON
  // forzada) — le pedimos el JSON por instrucción de texto y lo parseamos
  // nosotros (ver searchVacancies en api/search-vacancies.js).
  const { text, sources } = await callGenerateContent({
    system,
    prompt,
    extraBody: { tools: [{ google_search: {} }] },
  });
  return { text, sources };
}

export const geminiProvider = { generateJSON, generateWithSearch };
