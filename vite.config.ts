import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ZIP to Markdown Converter',
        short_name: 'ZIP to MD',
        description:
          'Convert files inside ZIP archives into Markdown locally in your browser.',
        theme_color: '#f7f4ef',
        background_color: '#f7f4ef',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // jspdf is ~800KB and only needed when the user clicks Download PDF,
        // so keep it out of the install-time precache and cache it on first use
        globIgnores: ['**/pdf.worker-*.js'],
        runtimeCaching: [
          {
            urlPattern: /pdf\.worker-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-worker',
              expiration: { maxEntries: 2 },
            },
          },
        ],
      },
    }),
  ],
})
