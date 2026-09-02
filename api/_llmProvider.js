// Capa de abstracción de proveedor LLM.
//
// Ningún endpoint de /api debe importar un proveedor directamente (gemini.js,
// claude.js, etc.) — todos pasan por getProvider(), que decide cuál usar según
// la variable de entorno LLM_PROVIDER. Cambiar de motor es cambiar esa
// variable, no reescribir la lógica de producto.
//
// Contrato que cada proveedor debe cumplir (ver api/_providers/*.js):
//
//   generateJSON({ system, prompt, schema }) -> Promise<object>
//     Pide una respuesta estructurada que valida contra `schema` (JSON Schema
//     simplificado: type/properties/items/required). Se usa cuando NO hace
//     falta buscar en la web (analizar CV, adaptar CV, generar carta).
//
//   generateWithSearch({ system, prompt }) -> Promise<{ text: string, sources: Array<{url, title}> }>
//     Pide una respuesta que puede apoyarse en búsqueda web real (grounding).
//     Se usa solo para buscar vacantes reales. `text` es la respuesta cruda del
//     modelo (se espera que sea o incluya un JSON — ver searchVacancies.js para
//     el parseo); `sources` son las URLs que el motor haya devuelto como
//     respaldo de la búsqueda, cuando el proveedor las expone.

import { geminiProvider } from "./_providers/gemini.js";
import { claudeProvider } from "./_providers/claude.js";

const PROVIDERS = {
  gemini: geminiProvider,
  claude: claudeProvider,
};

export function getProvider(overrideEnvVar) {
  // overrideEnvVar: nombre opcional de OTRA env var a consultar antes que
  // LLM_PROVIDER (p. ej. "SEARCH_PROVIDER"). Sirve para que UN endpoint use
  // un motor distinto al resto sin cambiar el default global — caso real:
  // el free tier de Gemini tiene cuota de grounding (busqueda) mas fragil
  // que su cuota de generacion normal, asi que search-vacancies.js puede
  // apuntar a Claude mientras analyze-cv/adapt-cv/generate-cover-letter
  // se quedan en Gemini gratis. Si esa env var no esta seteada, cae al
  // comportamiento normal (LLM_PROVIDER, default "gemini").
  const name = (
    (overrideEnvVar && process.env[overrideEnvVar]) ||
    process.env.LLM_PROVIDER ||
    "gemini"
  )
    .trim()
    .toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    const available = Object.keys(PROVIDERS).join(", ");
    throw new Error(
      `LLM_PROVIDER="${name}" no reconocido. Proveedores disponibles: ${available}.`
    );
  }
  return provider;
}
