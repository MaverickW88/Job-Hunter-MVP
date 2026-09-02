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

export function getProvider() {
  const name = (process.env.LLM_PROVIDER || "gemini").trim().toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    const available = Object.keys(PROVIDERS).join(", ");
    throw new Error(
      `LLM_PROVIDER="${name}" no reconocido. Proveedores disponibles: ${available}.`
    );
  }
  return provider;
}
