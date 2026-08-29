import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 클라이언트 전용 SPA. 데이터는 브라우저 localStorage에만 저장(백엔드 없음).
// 상대경로(./) — Vercel(루트)·GitHub Pages(/growth-ledger/) 어디서든 동작. HashRouter와 함께 마운트 위치 무관.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
