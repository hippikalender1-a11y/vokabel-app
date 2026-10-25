import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Neue Version wird erst nach Klick auf "Aktualisieren" aktiv (UpdateHinweis.jsx)
      registerType: 'prompt',
      includeAssets: ['app-icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Vokabel-Trainer',
        short_name: 'Vokabeln',
        description: 'Vokabeln lernen – funktioniert auch offline',
        lang: 'de',
        theme_color: '#2d6a4f',
        background_color: '#f7f5f0',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  base: '/vokabel-app/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
