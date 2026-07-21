import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En Docker, el backend se llama "backend" (nombre del servicio en docker-compose)
// En local, sigue siendo 127.0.0.1
const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000'

const proxyTarget = { target: BACKEND, changeOrigin: true }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Vendor en su propio chunk: un cambio de página no invalida el cache del
        // navegador para React/Router/Query, que es lo más pesado y lo que menos cambia.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('@tanstack')) return 'vendor-query'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api':      proxyTarget,
      '/equipos':  proxyTarget,
      '/productos': proxyTarget,
      '/uploads':  proxyTarget,
      '/login':    proxyTarget,
      '/usuarios': proxyTarget,
      '/roles':    proxyTarget,
      '/refresh':  proxyTarget,
      '/logout':   proxyTarget,
    },
  },
})
