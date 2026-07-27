import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { port: 3000, open: true },
  // Vitest smoke tests (audit 2026-07-25, QA item) — jsdom taaki localStorage
  // available ho (quota.test.js). `npm run test` se chalao. Sirf pure-logic
  // files test hote hain (tier/quota/bookHints/panchang) — poore App.jsx
  // component ko render/test nahi karte, isliye yeh fast aur stable hai.
  test: {
    environment: "jsdom",
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
