import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt" so a new deploy never swaps the app out from under someone
      // mid-edit; <PwaUpdatePrompt /> asks them to reload instead.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Monotask",
        short_name: "Monotask",
        description:
          "A minimal, monochrome productivity system combining tasks, calendar, habits, and analytics",
        start_url: "/app",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#121212",
        background_color: "#121212",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // Custom service worker (src/sw.ts) so it can also handle push events.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        // Classic script output (sw.js), which is what vercel.json's no-cache header targets.
        rollupFormat: "iife",
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // og-image.png is for link previews, not the app itself.
        globIgnores: ["**/og-image.png"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
