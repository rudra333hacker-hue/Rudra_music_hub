import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    command === "build" ? cloudflare({ viteEnvironment: { name: "ssr" } }) : undefined,
    viteReact(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"],
      manifest: {
        name: "Rudra Music Hub",
        short_name: "Rudra Music Hub",
        description: "AI-powered music discovery + player.",
        theme_color: "#0b0b0f",
        background_color: "#0b0b0f",
        display: "standalone",
        icons: [
          { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Cache the app shell for offline access
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webmanifest,json,txt,woff2}"],
        // Navigate to the cached app shell when offline (prevents "offline" error page)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          // Don't intercept API/server function calls
          /^\/_server/,
          /^\/api\//,
        ],
        runtimeCaching: [
          {
            // Cache YouTube thumbnails for offline display
            urlPattern: ({ url }) => url.hostname === "i.ytimg.com",
            handler: "CacheFirst",
            options: {
              cacheName: "yt-thumbnails",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache Piped/Invidious audio streams for offline playback
            urlPattern: ({ url }) =>
              url.hostname.includes("googlevideo.com") ||
              url.hostname.includes("pipedproxy") ||
              url.pathname.includes("/videoplayback"),
            handler: "CacheFirst",
            options: {
              cacheName: "audio-streams",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: { statuses: [0, 200, 206] },
              rangeRequests: true,
            },
          },
          {
            // Cache Piped/Invidious API responses with StaleWhileRevalidate
            // so stream URLs can be resolved even when temporarily offline
            urlPattern: ({ url }) =>
              url.hostname.includes("pipedapi") ||
              url.hostname.includes("piped") ||
              url.hostname.includes("invidious") ||
              url.pathname.includes("/streams/") ||
              url.pathname.includes("/api/v1/videos/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "stream-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache Google Fonts
            urlPattern: ({ url }) =>
              url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Don't cache YouTube iframe API or video embeds
            urlPattern: ({ url }) =>
              url.hostname === "www.youtube.com" || url.hostname === "youtube.com",
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 8080,
    host: "::"
  },
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core"
    ]
  }
}));
