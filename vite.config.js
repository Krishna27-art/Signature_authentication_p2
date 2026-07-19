import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Change cache directory so the stale mobilenet vite cache is bypassed entirely
  cacheDir: '.vite-new-cache',
  optimizeDeps: {
    force: true,
    exclude: ['@tensorflow-models/mobilenet'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
})
