import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow serving files from project root...
      // Curious to see how this works with building....
      allow: [
        "..",

        // Katex fonts!
        "../../node_modules/katex/dist/",
      ],
    },
  },
  build: {
    rollupOptions: {
      plugins: [
        visualizer({
          filename: resolve(__dirname, "bundle-analyzer-result.html"),
        }),
      ],
    },
  },
});
