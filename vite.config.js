import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 클라이언트 전용 SPA. 데이터는 브라우저 localStorage에만 저장(백엔드 없음).
// GitHub Pages 프로젝트 사이트(/growth-ledger/) 하위 경로로 서빙 → base 지정.
export default defineConfig({
  plugins: [react()],
  base: "/growth-ledger/",
});
