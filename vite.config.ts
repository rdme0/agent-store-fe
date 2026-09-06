import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim() || fileEnv.VITE_API_BASE_URL?.trim()
  if (mode === 'production' && !apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is required for production builds')
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            return id.includes('@xyflow') || id.includes('@dagrejs') ? 'graph-vendor' : undefined
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
