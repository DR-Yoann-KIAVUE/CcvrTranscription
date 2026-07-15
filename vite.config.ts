import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @tauri-apps/cli sets TAURI_DEV_HOST when running on a device/emulator.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri attend un port fixe et échoue si indisponible.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Ne pas surveiller le dossier Rust.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Sortie de build consommée par Tauri.
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
