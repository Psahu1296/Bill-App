import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to your backend
      '/api': {
        target: 'http://localhost:3000', // your backend URL
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api/, '')
      },
    },
  },
})
