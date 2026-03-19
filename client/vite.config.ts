import path from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/producer': {
        target: proxyTarget,
        changeOrigin: true
      },
      '/consumer': {
        target: proxyTarget,
        changeOrigin: true
      },
      '/api': {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
})
