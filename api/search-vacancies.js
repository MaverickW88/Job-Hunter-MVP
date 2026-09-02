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

  try {
    const provider = getProvider();
    const { text, sources } = await provider.generateWithSearch({ system: SYSTEM, prompt });

    let vacancies;
    try {
      vacancies = extractJSON(text);
    } catch (parseErr) {
      console.error("search-vacancies: no se pudo parsear JSON. Texto crudo:", text);
      return sendError(res, 502, "El modelo no devolvió una lista de vacantes interpretable. Intenta de nuevo.");
    }

    if (!Array.isArray(vacancies)) vacancies = [];
    vacancies = dedupeByUrl(vacancies).slice(0, 10);
    vacancies.sort((a, b) => (b.fitPercent || 0) - (a.fitPercent || 0));

    res.status(200).json({ vacancies, sourcesFound: sources?.length || 0 });
  } catch (e) {
    console.error("search-vacancies error:", e);
    sendError(res, 502, e.message || "Error buscando vacantes");
  }
}
