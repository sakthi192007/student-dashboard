import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For `npm run dev`: forwards /api calls to the Spring Boot app.
// Change the target if your backend runs on another port (e.g. 8082):
//   VITE_API_TARGET=http://localhost:8082 npm run dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_TARGET || "http://localhost:8081",
    },
  },
});
