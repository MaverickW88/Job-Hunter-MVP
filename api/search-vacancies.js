// POST /api/search-vacancies
// Body: { cvText: string, roles?: string[] }
// Respuesta: { vacancies: [{ title, company, platform, url, fitPercent, whyFit }] }
//
// Es la pieza más frágil del MVP (marcada como riesgo técnico/legal en el
// brief de producto): busca vacantes REALES vía la tool de búsqueda web del
// proveedor (grounding), no scraping directo a las plataformas — para no
// violar sus términos de servicio. No hay garantía de que el modelo siempre
// encuentre 10 vacantes verificables; el código pide hasta 10 y no falla si
// llegan menos.

import { getProvider } from "./_llmProvider.js";
import { readJsonBody, sendError, extractJSON, dedupeByUrl, MX_PLATFORMS } from "./_util.js";

const SYSTEM = `Eres un buscador de empleo experto en el mercado de México. Usa tu
herramienta de búsqueda web para encontrar vacantes REALES y VIGENTES en estas
plataformas: ${MX_PLATFORMS.join(", ")}. Nunca inventes vacantes, empresas o
ligas — si no encuentras suficientes vacantes reales, devuelve las que sí
verificaste, aunque sean menos de 10. Cada liga debe apuntar a la vacante
específica que encontraste, no a la página de inicio de la plataforma.

Responde ÚNICAMENTE con un arreglo JSON (sin markdown, sin texto adicional),
con esta forma exacta:
[
  {
    "title": "string — título del puesto",
    "company": "string — empresa",
    "platform": "string — una de: ${MX_PLATFORMS.join(", ")}",
    "url": "string — liga directa a la vacante",
    "fitPercent": 0,
    "whyFit": "string — 1 frase de por qué encaja con el CV"
  }
]`;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendError(res, 405, "Usa POST");

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(res, 400, "Body inválido: " + e.message);
  }

  const cvText = (body.cvText || "").trim();
  const roles = Array.isArray(body.roles) ? body.roles.filter(Boolean) : [];
  if (!cvText) return sendError(res, 400, "Falta cvText");

  const roleHint = roles.length
    ? `Enfócate en estos roles (ya evaluados como los de mejor fit): ${roles.join(", ")}.`
    : "";

  const prompt = `CV del candidato:\n\n${cvText}\n\n${roleHint}\n\nBusca hasta 10 vacantes reales y vigentes en México que encajen con este perfil. Devuelve el JSON como se te indicó.`;

  // Este endpoint puede usar un motor distinto al resto del MVP (ver
  // SEARCH_PROVIDER en .env.example) — es el único que depende de
  // grounding/búsqueda web, la cuota más frágil del free tier de Gemini.
  const provider = getProvider("SEARCH_PROVIDER");

  // Hace una sola llamada al motor con tool de búsqueda + intenta parsear el
  // arreglo de vacantes. Aislado en su propia función porque ahora el
  // handler la llama hasta 2 veces (ver comentario de retry más abajo).
  async function runSearchAttempt(attemptLabel) {
    const { text, sources } = await provider.generateWithSearch({ system: SYSTEM, prompt });

    // DEBUG TEMPORAL — quitar una vez que confirmemos que el retry basta.
    // Revisa esto en Vercel → tu proyecto → Logs después de reproducir el caso.
    console.log(`search-vacancies DEBUG [${attemptLabel}] sourcesFound:`, sources?.length || 0);
    console.log(`search-vacancies DEBUG [${attemptLabel}] texto crudo (primeros 2000 chars):`, (text || "").slice(0, 2000));

    let vacancies;
    try {
      vacancies = extractJSON(text);
    } catch (parseErr) {
      console.error(`search-vacancies [${attemptLabel}]: no se pudo parsear JSON. Texto crudo:`, text);
      throw new Error("El modelo no devolvió una lista de vacantes interpretable.");
    }

    if (!Array.isArray(vacancies)) {
      console.log(`search-vacancies DEBUG [${attemptLabel}]: lo parseado NO es un arreglo, se descarta. Valor:`, JSON.stringify(vacancies).slice(0, 500));
      vacancies = [];
    }
    vacancies = dedupeByUrl(vacancies).slice(0, 10);
    vacancies.sort((a, b) => (b.fitPercent || 0) - (a.fitPercent || 0));
    return { vacancies, sourcesFound: sources?.length || 0 };
  }

  try {
    let result = await runSearchAttempt("intento 1");

    // RETRY AUTOMÁTICO (agregado 2 sep 2026, evidencia: la misma vacante/CV
    // dio 0 resultados en un intento y encontró 3 reales en el siguiente —
    // el tool de búsqueda no es determinístico, cada llamada puede explorar
    // rutas distintas de la web). Si el primer intento vino vacío, reintenta
    // UNA vez antes de decirle al usuario que no encontramos nada — le cuesta
    // al usuario 0 clics extra y una llamada más al motor solo en el caso de
    // fallo, no siempre.
    if (result.vacancies.length === 0) {
      console.log("search-vacancies DEBUG: intento 1 vino vacío, reintentando automáticamente...");
      result = await runSearchAttempt("intento 2 (retry automático)");
    }

    res.status(200).json(result);
  } catch (e) {
    console.error("search-vacancies error:", e);
    sendError(res, 502, e.message || "Error buscando vacantes");
  }
}
