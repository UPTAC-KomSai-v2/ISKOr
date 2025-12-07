import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,                // <-- important
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.1.7:3001',   // <-- use LAN IP
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://192.168.1.7:3001',     // <-- same here
        ws: true,
      },
    },
  },
});
