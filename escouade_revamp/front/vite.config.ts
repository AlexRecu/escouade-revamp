import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy vers l'API backend (évite les soucis CORS en dev).
    // Cible configurable : en Docker, API_PROXY_TARGET=http://backend:5000 ;
    // en dev natif, défaut http://localhost:5000.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.IO : le front se connecte à l'origine Vite → on proxy le
      // WebSocket (ws: true) + le polling HTTP vers le backend.
      '/socket.io': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
