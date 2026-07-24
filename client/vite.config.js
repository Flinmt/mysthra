import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnvDir = resolve(__dirname, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, '')
  const backendPort = env.PORT || '3000'
  const clientPort = Number.parseInt(env.CLIENT_PORT || '5173', 10)
  const backendTarget = `http://localhost:${backendPort}`

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './vitest.setup.js'
    },
    server: {
      port: clientPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true
        },
        '/collaboration': {
          target: backendTarget,
          changeOrigin: true,
          ws: true
        }
      }
    }
  }
})
