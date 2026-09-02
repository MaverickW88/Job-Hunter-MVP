# Job.hunter() — MVP

Analiza tu CV, te dice qué tan bien encajas (en %) con roles reales, busca tus
10 vacantes reales en México, y te adapta el CV + genera la carta de
presentación para la que elijas. "Aplicar" siempre enlaza a la vacante en su
plataforma original (LinkedIn, OCC, Computrabajo, Glassdoor, Jobgether) — no
hay integración con ATS de terceros en este MVP.

Este README y el código reflejan las decisiones ya cerradas en el
[Product Brief & Decision Log](../job-hunter-brief.html) del proyecto — no
las repitas aquí, ese documento es la fuente de verdad de producto.

## Qué ya está construido

- ✅ Frontend (React + Vite): sube/pega CV → roles con fit % → top 10 vacantes
  reales con liga → CV adaptado + carta para la vacante elegida.
- ✅ Backend (funciones serverless de Vercel en `/api`), sin base de datos —
  nada del CV se guarda en un servidor.
- ✅ Capa de abstracción de proveedor LLM (`api/_llmProvider.js`) con dos
  proveedores implementados y funcionales: **Gemini** (motor por defecto,
  capa gratuita) y **Claude** (para cuando migres — cambia `LLM_PROVIDER` y
  listo, no hay que tocar los endpoints).
- ✅ Pruebas de humo de la lógica pura y del pipeline completo con una
  respuesta simulada (confirma que el parseo, el orden por fit % y el
  manejo de errores funcionan).

## Qué falta antes de invitar a los primeros usuarios

1. **Conseguir tu API key real de Gemini** en https://aistudio.google.com/apikey
   y ponerla en `.env.local` (ver `.env.example`).
2. **Validar el Día 1 del backlog**: la llamada real a Gemini (`api/_providers/gemini.js`)
   se escribió con el shape documentado en https://ai.google.dev/api/generate-content
   al momento de construir esto (sep 2026), pero la API de Gemini está en
   movimiento activo (Google introdujo una "Interactions API" en 2026). Antes
   de construir encima, corre `npm run dev` + `vercel dev` (o pega tu key y
   prueba `/api/analyze-cv` directo) y confirma que la respuesta real coincide
   con lo que el código espera. Si no, el archivo a ajustar es solo
   `api/_providers/gemini.js` — el resto del código no debería tocarse.
3. **Desplegar a Vercel** (ver abajo).
4. Opcional pero recomendado: correr un par de CVs reales tuyos y de alguien
   más por los 4 endpoints antes del piloto, para calibrar que el fit % y las
   vacantes se sientan razonables.

## Desarrollo local

```bash
npm install

cp .env.example .env.local
# Edita .env.local y pon tu GEMINI_API_KEY

# Opción A (recomendada): usa la CLI de Vercel, que sirve el frontend Y las
# funciones de /api juntos, tal como se comportará en producción.
npm install -g vercel   # una sola vez
vercel dev

# Opción B: dos procesos separados (menos fiel a producción, pero sin instalar
# la CLI de Vercel). `vite.config.js` ya redirige /api al puerto 3000.
npm run dev
# en otra terminal, sirve las funciones de /api con tu propia solución
# (por ejemplo `vercel dev --listen 3000` igual, o un servidor Express propio)
```

## Desplegar a Vercel

1. Sube este proyecto a un repositorio de GitHub (Vercel se conecta a un repo,
   no a una carpeta local).
2. En https://vercel.com, "Add New Project" → importa el repo.
3. En **Environment Variables**, agrega `LLM_PROVIDER=gemini` y
   `GEMINI_API_KEY=tu-key` (y `GEMINI_MODEL` si quieres fijar un modelo
   distinto al default).
4. Deploy. Vercel detecta Vite automáticamente y sirve `/api/*.js` como
   funciones serverless sin configuración adicional.

## Migrar de motor más adelante

Cambia `LLM_PROVIDER=claude` y agrega `ANTHROPIC_API_KEY` — ningún endpoint de
`/api` ni componente de `src/` necesita cambiar. Si en el futuro agregas un
tercer proveedor (Groq, OpenAI, etc.), impleméntalo en
`api/_providers/tu-proveedor.js` cumpliendo el contrato descrito en
`api/_llmProvider.js` y regístralo ahí.

## Estructura

```
api/
  _llmProvider.js       # selector de proveedor por env var
  _providers/
    gemini.js            # proveedor activo por defecto
    claude.js             # proveedor alterno, ya funcional
  _util.js               # helpers compartidos (parseo de JSON, dedupe, etc.)
  analyze-cv.js           # POST — CV -> roles sugeridos con fit %
  search-vacancies.js     # POST — CV + roles -> top 10 vacantes reales
  adapt-cv.js             # POST — CV + vacante -> CV adaptado
  generate-cover-letter.js# POST — CV + vacante -> carta de presentación
src/
  App.jsx                 # orquesta el user journey de 4 pasos
  api.js                  # cliente fetch hacia /api
  components/              # CVInput, RolesFit, VacancyList, VacancyCard, ResultsPanel
  styles.css
```
