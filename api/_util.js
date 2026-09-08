// Utilidades compartidas por los endpoints de /api.

export function extractJSON(text) {
  if (typeof text !== "string") return text;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        /* sigue al error de abajo */
      }
    }
    throw new Error("No se pudo interpretar la respuesta del modelo como JSON: " + cleaned.slice(0, 300));
  }
}

export function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.url || item.company + item.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel ya lo parsea
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

// Plataformas de búsqueda por región. MX_PLATFORMS es la única en uso hoy
// (search-vacancies.js solo la importa a ella todavía). Las demás quedan
// listas para cuando decidamos conectar una selección de región/geo — ese
// día, el único cambio necesario es qué constante importa search-vacancies.js.
export const MX_PLATFORMS = ["LinkedIn", "OCC Mundial", "Computrabajo", "Glassdoor", "Jobgether"];
export const ES_PLATFORMS = ["LinkedIn", "InfoJobs", "Indeed", "Tecnoempleo"];
export const BR_PLATFORMS = ["LinkedIn", "Catho", "Indeed"];
export const REMOTE_PLATFORMS = ["LinkedIn", "We Work Remotely", "Remote OK", "Wellfound", "Remotive"];
