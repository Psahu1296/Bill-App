import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read version from the root package.json (CI syncs it from the git tag).
// pos-frontend/package.json stays at 0.0.0 and is not the source of truth.
const rootVersion: string = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
).version ?? '0.0.0';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootVersion),
  },
  server: {
    proxy: {
      // SSE endpoint — needs its own entry to avoid response buffering
      '/api/admin/notify/stream': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
        // Disable compression so chunked SSE events are flushed immediately
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept-Encoding', 'identity');
          });
        },
      },
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
