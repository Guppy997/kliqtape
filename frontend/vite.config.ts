import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': der Nutzer bestaetigt das Update selbst.
      // Sonst wechselt die App mitten in einer Aufnahme die Version.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kliqtape',
        short_name: 'Kliqtape',
        description: 'Zwei Seiten. Eine Kassette.',
        theme_color: '#23201C',
        background_color: '#181615',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Vorlaeufig das SVG als Icon. Fuer echte Installierbarkeit auf Android
        // spaeter zusaetzlich 192er und 512er PNGs hinterlegen.
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Medien nie in den Precache: ein Mixtape kann MB-gross sein und
        // wuerde den Cache-Storage vollaufen lassen.
        navigateFallbackDenylist: [/^\/api/],
        // Wochen-Erinnerung: Push-Empfang und Antippen (public/push-sw.js).
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  build: {
    // three.js (3D-Kassetten in Kassetten-Ansicht und Farbauswahl) ist ein eigenes, nachgeladenes Paket
    // von ~580 KB (~150 KB komprimiert). Die Grenze gilt nur dafuer, die
    // Warnung fuer das Hauptpaket bleibt wie vorher.
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
});
