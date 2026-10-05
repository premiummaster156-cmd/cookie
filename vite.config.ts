import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "cookie-brand-asset",
      closeBundle() {
        const source = resolve(process.cwd(), "cookie-ai-icon.png");
        const target = resolve(process.cwd(), "dist", "cookie-ai-icon.png");
        if (existsSync(source)) copyFileSync(source, target);
      }
    }
  ]
});