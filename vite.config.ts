import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'vite.svg'],
      manifest: {
        name: 'WhatsAI',
        short_name: 'WhatsAI',
        description: 'AI persona group chat',
        theme_color: '#202C33',
        background_color: '#090E11',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        // Never serve the SPA shell for API calls (LLM streams, Convex, etc.).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Pull in the Web Push handlers (push + notificationclick) without
        // leaving the generateSW strategy.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
