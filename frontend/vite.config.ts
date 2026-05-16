import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/review/',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3450',
        changeOrigin: true,
      },
    },
  },
})
