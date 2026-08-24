import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed to https://yinglanzheng15.github.io/uk-11-plus-practice/
// `base` must match the repository name, with a slash at each end. This is the
// ONLY line to change if the repo is renamed. For a user site hosted at
// https://yinglanzheng15.github.io/ set base to '/'.
const BASE = '/uk-11-plus-practice/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    // Offline support: the app is already fully self-contained (no backend,
    // no login), so once a device has loaded it once online, this precaches
    // the whole build — including the paid question bank, which is normally
    // fetched separately at runtime — so it keeps working with no connection
    // at all, e.g. on a tablet in the car.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: '11+ Practice',
        short_name: '11+ Practice',
        description:
          'Quick daily practice for the UK 11+ entrance exams: Maths, English and Verbal Reasoning.',
        theme_color: '#3457c4',
        background_color: '#f4f6f9',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Default globs cover the JS/CSS/HTML/icons Vite builds; add json so
        // the paid question bank (public/paid.json, copied to dist as-is) is
        // precached too, not just the free half the client ships with.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
      },
    }),
  ],
})
