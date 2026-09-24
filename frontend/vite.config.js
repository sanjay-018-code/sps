import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host:true exposes the dev server on your network so players can join from their phones.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy: { "/api": "http://localhost:8000" } },
});
