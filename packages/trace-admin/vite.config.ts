import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'resolve-msw-interceptors',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@mswjs/interceptors/ClientRequest') {
          return '\0empty-msw-client-request'
        }
        return null
      },
      load(id) {
        if (id === '\0empty-msw-client-request') {
          return 'export const ClientRequestInterceptor = class {}; export default {}'
        }
        return null
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    preserveSymlinks: true,
  },
  optimizeDeps: {
    exclude: ['msw'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
