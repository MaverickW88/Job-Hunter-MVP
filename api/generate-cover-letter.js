// POST /api/generate-cover-letter
// Body: { cvText: string, vacancy: { title, company, whyFit? } }
// Respuesta: { coverLetter: string }

import { getProvider } from "./_llmProvider.js";
import { readJsonBody, sendError } from "./_util.js";

const SCHEMA = {
  type: "object",
  properties: {
    coverLetter: {
      type: "string",
      description: "Carta de presentación completa, en el idioma de la vacante (ver reglas en el prompt del sistema), lista para copiar/pegar",
    },
  },
  required: ["coverLetter"],
};

// Nota de idioma (ajustado 2 sep 2026 a petición de Humberto, fallback a
// inglés confirmado ese mismo día): antes esto forzaba "en español de
// México" sin importar el idioma real de la vacante. No guardamos el texto
// completo de la descripción original (solo title/company/whyFit), así que
// usamos el título del puesto como señal del idioma — es la más confiable
// que tenemos hoy. Si el título es ambiguo, cae a inglés por default.
//
// BUG encontrado el mismo día (probando con la vacante "Design Engineer" de
// Valeo vía OCC Mundial): el prompt de abajo también manda vacancy.whyFit,
// que search-vacancies.js SIEMPRE genera en español sin importar el idioma
// real de la vacante — el modelo veía título en inglés + un párrafo en
// español y se quedaba con la señal más fuerte (el párrafo), ignorando la
// instrucción de basarse solo en el título. Se agregó la aclaración
// explícita de abajo para forzar que ignore el idioma del resto del prompt.
const SYSTEM = `Eres un coach de carrera. Escribes cartas de presentación breves
(máximo 300 palabras), concretas y sin relleno genérico — conectan 2-3 logros
reales del CV con lo que pide la vacante. Tono profesional pero humano.
Nunca inventes logros que no estén en el CV.

IDIOMA: detecta el idioma de la vacante a partir ÚNICAMENTE del título del
puesto que te den (ej. "Lead Technical Program Manager" → inglés; "Gerente
de Operaciones" → español) y escribe la carta completa en ese idioma. Si el
título es ambiguo, bilingüe, o no da una señal clara, escribe la carta en
inglés por default (preferencia de Humberto: la mayoría de sus vacantes
objetivo son remoto/global). IMPORTANTE: el resto de este prompt (el CV del
candidato y la frase de "por qué encaja") casi siempre van a estar en
español sin importar el idioma real de la vacante — IGNORA por completo el
idioma en que están escritos esos textos para tu decisión de idioma. Tu
única señal es el título de la vacante.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendError(res, 405, "Usa POST");

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(res, 400, "Body inválido: " + e.message);
  }

  const cvText = (body.cvText || "").trim();
  const vacancy = body.vacancy || {};
  if (!cvText) return sendError(res, 400, "Falta cvText");
  if (!vacancy.title) return sendError(res, 400, "Falta vacancy.title");

  const prompt = `CV:\n\n${cvText}\n\nVacante:\nPuesto: ${vacancy.title}\nEmpresa: ${vacancy.company || "N/D"}\n${vacancy.whyFit ? `Por qué encaja: ${vacancy.whyFit}` : ""}\n\nEscribe la carta de presentación.`;

  try {
    const provider = getProvider();
    const result = await provider.generateJSON({ system: SYSTEM, prompt, schema: SCHEMA });
    res.status(200).json({ coverLetter: result.coverLetter || "" });
  } catch (e) {
    console.error("generate-cover-letter error:", e);
    sendError(res, 502, e.message || "Error generando la carta");
  }
}
