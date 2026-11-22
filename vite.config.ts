/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Ruta donde se publica la web. En local es «/»; GitHub Pages la sirve en
 * «/<nombre-del-repositorio>/», y el flujo de publicación la pasa en BASE_PATH.
 */
const base = process.env.BASE_PATH || '/';

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    // App instalable que funciona sin conexión (las recetas ya viven en el dispositivo).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'My Little Recipe Book',
        short_name: 'Recetario',
        description: 'Tu recetario personal: un pequeño libro mágico de cocina.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#583623',
        theme_color: '#583623',
        categories: ['food', 'lifestyle'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo lo de la app (código, fuentes, ilustraciones) queda guardado para usarla sin conexión.
        globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        // La importación con IA habla con el servidor local: nunca se guarda en caché.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // El servidor local de importación (fase 4) atiende las rutas /api.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false, timeout: 15 * 60_000, proxyTimeout: 15 * 60_000 },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', timeout: 15 * 60_000, proxyTimeout: 15 * 60_000 },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
