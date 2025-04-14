import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from project root...
      // Curious to see how this works with building....
      allow: [".."],
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
});
