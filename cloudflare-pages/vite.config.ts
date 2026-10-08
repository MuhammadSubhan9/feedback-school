import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(root, "..") } },
  publicDir: path.resolve(root, "public"),
  build: { outDir: path.resolve(root, "dist"), emptyOutDir: true },
});
