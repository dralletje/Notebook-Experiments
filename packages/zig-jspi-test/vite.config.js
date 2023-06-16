import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext",
  },
  server: {
    fs: {
      // Allow serving files from project root...
      // Curious to see how this works with building....
      allow: [".."],
    },
  },
});
