import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const backendPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Pre-bundle client deps upfront to avoid per-request discovery on cold start.
  optimizeDeps: {
    include: [
      'react',
      'react-dom/client',
      'react/jsx-runtime',
      'react-router-dom',
      'zustand',
      'react-markdown',
      'remark-gfm',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
    ],
  },
  // appType 'spa' (default) provides history API fallback for React Router.
  // Proxy rules are matched first, so /api, /events and /ws bypass the fallback.
  appType: 'spa',
  server: {
    // Pre-transform critical files before the first browser request.
    warmup: {
      clientFiles: [
        './src/client/main.tsx',
        './src/client/App.tsx',
        './src/client/components/layout/AppLayout.tsx',
      ],
    },
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/events': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      // WebSocket proxy — required for the /chat page agent connections.
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
