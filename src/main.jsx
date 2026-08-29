import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// GitHub Pages(정적 호스팅)에서 SPA 라우팅을 서버 rewrite 없이 처리하기 위해 HashRouter 사용.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
