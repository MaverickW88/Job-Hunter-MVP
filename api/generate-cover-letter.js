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
      description: "Carta de presentación completa, en español, lista para copiar/pegar",
    },
  },
  required: ["coverLetter"],
};

const SYSTEM = `Eres un coach de carrera. Escribes cartas de presentación breves
(máximo 300 palabras), concretas y sin relleno genérico — conectan 2-3 logros
reales del CV con lo que pide la vacante. Tono profesional pero humano, en
español de México. Nunca inventes logros que no estén en el CV.`;

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
