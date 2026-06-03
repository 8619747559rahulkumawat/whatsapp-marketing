import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [react(), {
    name: 'silent-proxy-errors',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.on('error', () => {});
        next();
      });
    }
  }],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.on('error', () => {});
          });
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.on('error', () => {});
          });
        }
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
        }
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
        }
      }
    }
  }
});
