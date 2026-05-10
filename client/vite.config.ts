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
