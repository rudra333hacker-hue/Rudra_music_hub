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
        icons: [{ src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
      },
      workbox: {
        // Cache only static assets (JS, CSS, images, fonts). NOT json (API responses).
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webmanifest,woff2}"],
        runtimeCaching: [
          {
            // ⚠️ CRITICAL: TanStack Start server functions MUST always hit the network.
            // Serving stale audio stream URLs = broken player. Never cache /_server.
            urlPattern: ({ url }) => url.pathname.startsWith("/_server"),
            handler: "NetworkOnly",
          },
          {
            // Cache SSR page navigations with NetworkFirst (network first, cache fallback)
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "ssr-pages",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache YouTube thumbnails — these are stable and safe to cache long-term
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
            // ⚠️ CRITICAL: Audio stream CDN URLs (googlevideo, pipedproxy) expire in minutes.
            // NEVER cache these — always fetch fresh. Use NetworkOnly.
            urlPattern: ({ url }) =>
              url.hostname.includes("googlevideo.com") ||
              url.hostname.includes("pipedproxy") ||
              url.pathname.includes("/videoplayback"),
            handler: "NetworkOnly",
          },
          {
            // ⚠️ CRITICAL: Piped/Invidious /streams/ and /api/v1/videos/ return
            // short-lived CDN URLs. Do NOT cache — serve stale = broken audio URLs.
            urlPattern: ({ url }) =>
              url.hostname.includes("pipedapi") ||
              url.hostname.includes("piped") ||
              url.hostname.includes("invidious") ||
              url.pathname.includes("/streams/") ||
              url.pathname.includes("/api/v1/videos/"),
            handler: "NetworkOnly",
          },
          {
            // Cache Google Fonts — stable, safe to cache long-term
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
            // Never cache YouTube iframe API or embeds
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
    host: "::",
  },
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
