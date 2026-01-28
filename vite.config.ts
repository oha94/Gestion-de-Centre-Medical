import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 1420,
    strictPort: true,
  },

  // Enlever l'alias dompurify et utiliser optimizeDeps
  optimizeDeps: {
    include: ['dompurify'],
    exclude: ['jspdf'] // Exclure jspdf de l'optimisation
  },
})