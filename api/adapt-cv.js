// POST /api/adapt-cv
// Body: { cvText: string, vacancy: { title, company, whyFit? } }
// Respuesta: { adaptedCV: string }

import { getProvider } from "./_llmProvider.js";
import { readJsonBody, sendError } from "./_util.js";

const SCHEMA = {
  type: "object",
  properties: {
    adaptedCV: {
      type: "string",
      description: "CV completo adaptado a la vacante, en texto plano listo para copiar/pegar o exportar",
    },
  },
  required: ["adaptedCV"],
};

const SYSTEM = `Eres un coach de carrera experto en CVs para el mercado mexicano.
Adaptas un CV existente a una vacante específica: reordenas y resaltas la
experiencia más relevante, ajustas el resumen profesional, y usas palabras
clave de la vacante — pero SIN inventar experiencia, logros o habilidades que
no estén en el CV original. Nunca mientas ni exageres.`;

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

  const prompt = `CV original:\n\n${cvText}\n\nVacante objetivo:\nPuesto: ${vacancy.title}\nEmpresa: ${vacancy.company || "N/D"}\n${vacancy.whyFit ? `Por qué encaja: ${vacancy.whyFit}` : ""}\n\nAdapta el CV para esta vacante.`;

  try {
    const provider = getProvider();
    const result = await provider.generateJSON({ system: SYSTEM, prompt, schema: SCHEMA });
    res.status(200).json({ adaptedCV: result.adaptedCV || "" });
  } catch (e) {
    console.error("adapt-cv error:", e);
    sendError(res, 502, e.message || "Error adaptando el CV");
  }
}
