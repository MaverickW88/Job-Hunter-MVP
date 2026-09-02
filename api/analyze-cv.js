// POST /api/analyze-cv
// Body: { cvText: string }
// Respuesta: { roles: [{ role, fitPercent, rationale }] }
//
// Esta es la función núcleo del MVP (Fase 2 del brief de producto): analizar
// el CV y sugerir roles con un % de fit — es lo primero que ve un usuario
// nuevo y define la métrica de activación.

import { getProvider } from "./_llmProvider.js";
import { readJsonBody, sendError } from "./_util.js";

const SCHEMA = {
  type: "object",
  properties: {
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", description: "Título de rol sugerido, ej. 'Product Manager AI'" },
          fitPercent: { type: "integer", description: "0 a 100" },
          rationale: { type: "string", description: "1-2 frases: por qué este fit, en base al CV" },
        },
        required: ["role", "fitPercent", "rationale"],
      },
    },
  },
  required: ["roles"],
};

const SYSTEM = `Eres un reclutador senior especializado en el mercado laboral de México.
Analizas un CV y sugieres los roles a los que el candidato tiene mejor fit hoy,
con honestidad: no infles el % de fit para quedar bien. Basa el % solo en lo
que el CV realmente muestra (experiencia, habilidades, logros), no en
aspiraciones del candidato.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendError(res, 405, "Usa POST");

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(res, 400, "Body inválido: " + e.message);
  }

  const cvText = (body.cvText || "").trim();
  if (!cvText) return sendError(res, 400, "Falta cvText");
  if (cvText.length > 20000) return sendError(res, 400, "cvText demasiado largo (máx ~20,000 caracteres)");

  const prompt = `CV del candidato:\n\n${cvText}\n\nSugiere entre 3 y 6 roles con mejor fit, con su % y una razón breve. Ordénalos de mayor a menor fit.`;

  try {
    const provider = getProvider();
    const result = await provider.generateJSON({ system: SYSTEM, prompt, schema: SCHEMA });
    const roles = Array.isArray(result.roles) ? result.roles : [];
    roles.sort((a, b) => (b.fitPercent || 0) - (a.fitPercent || 0));
    res.status(200).json({ roles });
  } catch (e) {
    console.error("analyze-cv error:", e);
    sendError(res, 502, e.message || "Error analizando el CV");
  }
}
