import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/studio': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/queue': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/worker': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/storage': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/chunking': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/upload': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/logs': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/chunks': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/health': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false },
      '/qdrant': { target: 'http://127.0.0.1:5000', changeOrigin: true, secure: false }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
      'react-icons/fa',
      'react-markdown',
      'remark-gfm',
      'remark-math',
      'rehype-katex',
      'rehype-highlight'
    ]
  },
  build: {
    cssMinify: false,
  },
})
