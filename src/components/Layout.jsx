import { NavLink, Outlet } from "react-router-dom";
import { useRef } from "react";
import { exportJSON, importJSON, markBackup, counts, usePersistError } from "../lib/store.js";
import { isoDate } from "../lib/format.js";

const TABS = [
  { to: "/", label: "홈", end: true },
  { to: "/deals", label: "딜 파이프라인" },
  { to: "/money-test", label: "머니테스트" },
  { to: "/weekly", label: "주간 리뷰" },
  { to: "/growth", label: "성장" },
];

function download(text, name) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Layout() {
  const fileRef = useRef(null);
  const persistErr = usePersistError();

  function doExport() {
    download(exportJSON(), `성장원장-백업-${isoDate()}.json`);
    markBackup();
  }
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const c = counts();
    if ((c.deals || c.moneyTests || c.weeklyReviews) && !confirm(`현재 데이터(딜 ${c.deals}·머니테스트 ${c.moneyTests}·주간리뷰 ${c.weeklyReviews}건)를 불러온 파일로 덮어씁니다. 안전을 위해 먼저 현재 데이터를 백업합니다. 계속할까요?`)) {
      e.target.value = "";
      return;
    }
    // 교체 전 자동 사전 백업
    if (c.deals || c.moneyTests || c.weeklyReviews) download(exportJSON(), `성장원장-교체전백업-${isoDate()}.json`);
    const reader = new FileReader();
    reader.onload = () => {
      try { importJSON(String(reader.result)); alert("백업을 불러왔습니다."); }
      catch (err) { alert("불러오기 실패: " + err.message); }
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

      {persistErr && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>
          저장 공간에 데이터를 기록하지 못했습니다(브라우저 저장 한도·시크릿 모드 등). 지금 바로 "내보내기"로 백업하세요.
        </div>
      )}

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        성장원장 — 실무를 기록하면 사업감각과 리더십이 숫자로 남습니다. 데이터는 이 브라우저에만 저장됩니다(정기적으로 내보내기로 백업하세요).
      </footer>
    </div>
  );
}
