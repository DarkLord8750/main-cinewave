import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
  },
  base: '/',
  server: {
    cors: {
      origin: '*',
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Range', 'Cache-Control'],
      exposedHeaders: ['Content-Length', 'Content-Range'],
      credentials: true
    },
    proxy: {
      // Proxy all requests that start with /api to your Cloudflare Worker
      '/api': {
        target: 'https://cinewave.uveshmalik-8860.workers.dev',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Configure proxy to handle CORS
        configure: (proxy) => {
          // Remove cache-control header from the request to avoid CORS issues
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('cache-control');
          });
          // Add CORS headers to the response
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['access-control-allow-origin'] = '*';
            proxyRes.headers['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Range';
          });
        }
      }
    },
    // Handle OPTIONS method for preflight requests
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Cache-Control'
    }
  }
});
