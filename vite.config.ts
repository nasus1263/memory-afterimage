import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'fs'

export default defineConfig({
  // BASE_URL set by CI to /<repo-name>/ for GitHub Pages; defaults to / in dev
  base: process.env.BASE_URL ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-coi-sw',
      buildStart() {
        copyFileSync(
          './node_modules/coi-serviceworker/coi-serviceworker.js',
          './public/coi-serviceworker.js'
        )
      },
    },
  ],
  server: {
    headers: {
      // Required for SharedArrayBuffer (ffmpeg.wasm)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      // NVIDIA NIM doesn't send CORS headers — proxy through Vite dev server
      '/nvidia-nim': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nvidia-nim/, ''),
      },
      '/nvidia-genai': {
        target: 'https://ai.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nvidia-genai/, ''),
      },
      // Ollama 로컬 LLM 서버(:11434) — CORS 헤더 미제공이라 프록시 경유
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
      // GPT-SoVITS 로컬 보이스 클로닝 서버(api.py, :9880) — CORS 헤더 미제공이라 프록시 경유
      '/gpt-sovits': {
        target: 'http://127.0.0.1:9880',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gpt-sovits/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
