import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import nodePolyfills from "vite-plugin-node-stdlib-browser";

export default defineConfig({
  plugins: [react(), nodePolyfills()],
});
