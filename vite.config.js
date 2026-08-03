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
    // NODE 22 FIX (2026-08-03): sirf `environment: "jsdom"` kaafi NAHI hai.
    // Node 22 ka apna experimental `localStorage` global jsdom wale ko
    // globalThis par baithne nahi deta, aur woh khud `--localstorage-file`
    // ke bina undefined rehta hai. quota.test.js ke saare 8 tests isi wajah
    // se `beforeEach` mein mar rahe the — chup-chaap, Node upgrade ke baad
    // se. Yeh setup file usse theek karti hai.
    setupFiles: ["./vitest.setup.js"],
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
