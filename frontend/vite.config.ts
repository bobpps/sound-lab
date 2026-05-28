import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = Number(env.BACKEND_PORT ?? 3000)
  const frontendPort = Number(env.FRONTEND_PORT ?? 5173)

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          rewrite: (path) => path.replace(/^\/api/, ''),
          ws: true,
        },
      },
    },
  }
})
