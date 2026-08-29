import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// dev 전용 데모 시드(프로덕션 미적용): /?seed 로 채워진 상태 점검
if (import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("seed")) {
  // eslint-disable-next-line
  import("./lib/demoSeed.js").then((m) => {
    try { localStorage.setItem("growth-ledger:v1", JSON.stringify(m.DEMO)); } catch (e) {}
    const u = new URL(location.href); u.searchParams.delete("seed"); location.replace(u.toString());
  });
}

// GitHub Pages(정적 호스팅)에서 SPA 라우팅을 서버 rewrite 없이 처리하기 위해 HashRouter 사용.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
