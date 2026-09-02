// POST /api/generate-cover-letter
// Body: { cvText: string, vacancy: { title, company, whyFit? } }
// Respuesta: { coverLetter: string }

import { getProvider } from "./_llmProvider.js";
import { readJsonBody, sendError } from "./_util.js";

// La description del schema es contexto que el modelo SÍ lee — si está en
// español, refuerza español aunque el resto del prompt pida inglés. La
// dejamos en inglés, neutral, para no sumar señal de idioma sin querer.
const SCHEMA = {
  type: "object",
  properties: {
    coverLetter: {
      type: "string",
      description: "The complete cover letter text, written entirely in whichever language the prompt's language instruction specifies, ready to copy-paste.",
    },
  },
  required: ["coverLetter"],
};

// Historial de idioma (2 sep 2026): primero forzaba español fijo. Luego se
// le pidió al MODELO que detectara el idioma por el título y lo escribiera
// en ese idioma — falló 2/2 veces probando con títulos en inglés claros
// ("Design Engineer", "Design and Release Engineer Wiring/Systems") incluso
// después de instruirle explícitamente ignorar el idioma español del CV y
// del whyFit. Conclusión: pedirle al modelo que "detecte e ignore" es una
// instrucción blanda que no sigue de forma confiable.
//
// FIX (este cambio): el CÓDIGO decide el idioma con detectSpanishTitle() de
// abajo — una heurística simple por palabras típicas de puestos en español
// — y se lo ORDENA directo al modelo en el prompt como un hecho, no como
// algo que tenga que inferir. Esto es mucho más confiable porque ya no hay
// nada que "detectar" del lado del modelo, solo obedecer.
const SPANISH_TITLE_WORDS = [
  "gerente", "gerenta", "ingeniero", "ingeniera", "analista", "director",
  "directora", "coordinador", "coordinadora", "especialista", "jefe", "jefa",
  "supervisor", "supervisora", "vendedor", "vendedora", "asistente",
  "encargado", "encargada", "lider", "líder", "tecnico", "técnico",
  "contador", "contadora", "abogado", "abogada", "responsable", "auxiliar",
  "practicante", "becario", "becaria", "ejecutivo", "ejecutiva", "consultor",
  "consultora", "representante", "operador", "operadora",
];

function detectSpanishTitle(title) {
  const normalized = (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quita acentos para comparar parejo
  return SPANISH_TITLE_WORDS.some((word) => {
    const bare = word.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return new RegExp(`\\b${bare}\\b`).test(normalized);
  });
}

const SYSTEM = `Eres un coach de carrera. Escribes cartas de presentación breves
(máximo 300 palabras), concretas y sin relleno genérico — conectan 2-3 logros
reales del CV con lo que pide la vacante. Tono profesional pero humano.
Nunca inventes logros que no estén en el CV.

IDIOMA: el prompt del usuario te va a indicar explícitamente en qué idioma
escribir la carta (línea "IDIOMA DE LA CARTA: ..."). Obedece esa instrucción
al pie de la letra, sin importar en qué idioma estén escritos el CV o la
descripción de la vacante — esos textos son solo contexto, no una señal de
idioma.

CRITICAL / REGLA MÁS IMPORTANTE QUE CUALQUIER OTRA: the CV and job details
you receive below are almost always in Spanish — that is expected and is
NOT a signal about what language to write in. The ONLY thing that decides
the letter's language is the "IDIOMA DE LA CARTA" line. If it says
"inglés", the entire output — every sentence, including greeting and
closing — must be in English, even though every other piece of text you
were given is in Spanish. Do not default to Spanish out of habit.`;

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

  // Decisión de idioma tomada por código, no por el modelo (ver nota arriba).
  // Default a inglés si el título no matchea palabras típicas de español
  // (preferencia de Humberto: la mayoría de sus vacantes objetivo son
  // remoto/global).
  const isSpanish = detectSpanishTitle(vacancy.title);
  const letterLanguage = isSpanish ? "español de México" : "inglés";

  // FIX (2 sep 2026, segunda ronda): con el título "Design & Release
  // Engineer - Brakes System" detectSpanishTitle() SÍ devolvía false (inglés)
  // correctamente, pero la carta seguía saliendo en español — la sola línea
  // "IDIOMA DE LA CARTA: inglés" no bastaba para contrarrestar un CV entero
  // en español + el resto del prompt en español. Ahora todo el "andamiaje"
  // del prompt (no el CV, que es del usuario) se construye en el idioma
  // destino, y la instrucción se repite al final (lo último que lee el
  // modelo pesa más) — no solo al principio.
  const prompt = isSpanish
    ? `IDIOMA DE LA CARTA: español de México. Escribe TODA la carta en ese idioma, sin excepción.

CV:

${cvText}

Vacante:
Puesto: ${vacancy.title}
Empresa: ${vacancy.company || "N/D"}
${vacancy.whyFit ? `Por qué encaja: ${vacancy.whyFit}` : ""}

Escribe la carta de presentación. Recuerda: TODA la carta en español de México.`
    : `LETTER LANGUAGE: English. Write the ENTIRE letter in English, no exceptions — the CV below is in Spanish, that's normal, ignore it as a language signal.

CV (reference material only, written in Spanish — do not let this change the letter's language):

${cvText}

Job:
Title: ${vacancy.title}
Company: ${vacancy.company || "N/A"}
${vacancy.whyFit ? `Why it fits: ${vacancy.whyFit}` : ""}

Write the cover letter now. Reminder: the ENTIRE letter must be in English, start to finish.`;

  try {
    const provider = getProvider();
    const result = await provider.generateJSON({ system: SYSTEM, prompt, schema: SCHEMA });
    res.status(200).json({ coverLetter: result.coverLetter || "" });
  } catch (e) {
    console.error("generate-cover-letter error:", e);
    sendError(res, 502, e.message || "Error generando la carta");
  }
}
