import { NavLink, Outlet } from "react-router-dom";
import { useRef } from "react";
import { exportJSON, importJSON } from "../lib/store.js";
import { isoDate } from "../lib/format.js";

const TABS = [
  { to: "/", label: "홈", end: true },
  { to: "/deals", label: "딜 파이프라인" },
  { to: "/money-test", label: "머니테스트" },
  { to: "/weekly", label: "주간 리뷰" },
  { to: "/growth", label: "성장" },
];

export default function Layout() {
  const fileRef = useRef(null);

  function doExport() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `성장원장-백업-${isoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJSON(String(reader.result));
        alert("백업을 불러왔습니다.");
      } catch (err) {
        alert("불러오기 실패: " + err.message);
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <path d="M14 44 L28 30 L36 36 L50 20" fill="none" stroke="#6ee7b7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="50" cy="20" r="5" fill="#6ee7b7" />
              </svg>
            </span>
            성장원장 <small>Growth Ledger</small>
          </NavLink>
          <span className="topbar-spacer" />
          <button className="iconbtn" onClick={doExport} title="데이터를 JSON 파일로 백업">내보내기</button>
          <button className="iconbtn" onClick={() => fileRef.current?.click()} title="JSON 백업 불러오기">가져오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        성장원장 — 실무를 기록하면 사업감각과 리더십이 숫자로 남습니다. 데이터는 이 브라우저에만 저장됩니다(정기적으로 내보내기로 백업하세요).
      </footer>
    </div>
  );
}
