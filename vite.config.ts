import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

/** Trên Vercel để đối chiếu deploy có đúng repo/commit — hiển thị ở footer. */
const appGitSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.GITHUB_SHA?.slice(0, 7) ??
  "local";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    /** Dùng import.meta.env — Vite thay thế ổn định hơn biến global __APP_* */
    "import.meta.env.VITE_APP_GIT_SHA": JSON.stringify(appGitSha),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
