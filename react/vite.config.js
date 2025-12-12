import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://nginx:80', 
        changeOrigin: true,
        secure: false,
      },
      '/public': {
        target: 'http://nginx:80',
        changeOrigin: true,
        secure: false,
      },
      // WebSocket untuk chat
      '/socket.io': {
        target: 'http://nodejs:3001',
        ws: true,
      }
    }
  }
})