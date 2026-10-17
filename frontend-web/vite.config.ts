import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 固定 5180：5173 常被本机其它项目占用（实测被智学云 Vue 项目占用）
    port: 5180,
    strictPort: true,
    // 开发期将 /api 代理到后端，避免前端写死后端地址（真机联调用 VITE_API_BASE_URL 直连）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
})
