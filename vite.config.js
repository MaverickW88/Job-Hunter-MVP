import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config mínima. Las rutas /api/* las sirve Vercel (o `vercel dev` en local) como
// funciones serverless — no forman parte de este build de frontend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En local con `npm run dev` (sin `vercel dev`), redirige /api al puerto
      // donde estés corriendo las funciones (ver README para las dos opciones).
      "/api": "http://localhost:3000",
    },
  },
});
