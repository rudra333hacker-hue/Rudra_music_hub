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
        // Avoid caching large/streaming media.
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webmanifest,json,txt,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes("youtube.com") || url.origin.includes("googlevideo.com"),
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
