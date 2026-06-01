import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const DEV_API_PORT = process.env.DEV_API_PORT || '4001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/costikm/',
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${DEV_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
