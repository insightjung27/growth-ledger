import { NavLink, Outlet } from "react-router-dom";
import { useRef, useState } from "react";
import { exportJSON, importJSON, markBackup, counts, usePersistError } from "../lib/store.js";
import { isoDate } from "../lib/format.js";

// 하단 탭(모바일) 우선순위 = 앱 핵심 루프: 홈·딜(영업)·머니테스트(히어로)·주간(정본 리듬).
// 나머지는 '더보기' 시트로. 데스크톱은 상단에 전부 노출.
const PRIMARY = [
  { to: "/", label: "홈", end: true, icon: "home" },
  { to: "/deals", label: "딜", icon: "deal" },
  { to: "/money-test", label: "머니테스트", icon: "money" },
  { to: "/weekly", label: "주간", icon: "weekly" },
];
const MORE = [
  { to: "/decisions", label: "판단" },
  { to: "/team", label: "팀" },
  { to: "/handoffs", label: "위임과제" },
  { to: "/one-on-ones", label: "1:1" },
  { to: "/growth", label: "성장" },
  { to: "/guide", label: "가이드" },
];
// 데스크톱 상단 탭 = 전체(기존 순서 유지)
const ALL = [
  { to: "/", label: "홈", end: true },
  { to: "/decisions", label: "판단" },
  { to: "/deals", label: "딜" },
  { to: "/money-test", label: "머니테스트" },
  { to: "/team", label: "팀" },
  { to: "/handoffs", label: "위임과제" },
  { to: "/one-on-ones", label: "1:1" },
  { to: "/weekly", label: "주간리뷰" },
  { to: "/growth", label: "성장" },
  { to: "/guide", label: "가이드" },
];

function Icon({ name }) {
  const p = {
    fill: "none", stroke: "currentColor", strokeWidth: 1.9,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  const paths = {
    home: <><path {...p} d="M4 11.5 12 4l8 7.5" /><path {...p} d="M6 10v9h12v-9" /></>,
    deal: <><path {...p} d="M4 6h16v12H4z" /><path {...p} d="M4 10h16" /><path {...p} d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" /></>,
    money: <><circle {...p} cx="12" cy="12" r="8" /><path {...p} d="M9 9l3 3 3-3M12 12v4" /></>,
    weekly: <><rect {...p} x="4" y="5" width="16" height="15" rx="2" /><path {...p} d="M4 9h16M8 3v4M16 3v4" /><path {...p} d="M8.5 14l2 2 3.5-4" /></>,
    more: <><circle {...p} cx="5" cy="12" r="1.4" /><circle {...p} cx="12" cy="12" r="1.4" /><circle {...p} cx="19" cy="12" r="1.4" /></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{paths[name]}</svg>;
}

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
  const [moreOpen, setMoreOpen] = useState(false);

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
          <NavLink to="/" className="brand" onClick={() => setMoreOpen(false)}>
            <span className="brand-mark">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <path d="M14 44 L28 30 L36 36 L50 20" fill="none" stroke="#6ee7b7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="50" cy="20" r="5" fill="#6ee7b7" />
              </svg>
            </span>
            <span className="brand-name">성장원장</span> <small>Growth Ledger</small>
          </NavLink>
          <span className="topbar-spacer" />
          {/* 데스크톱 전용 — 모바일에선 '더보기' 시트로 이동 */}
          <button className="iconbtn only-desk" onClick={doExport} title="데이터를 JSON 파일로 백업">내보내기</button>
          <button className="iconbtn only-desk" onClick={() => fileRef.current?.click()} title="JSON 백업 불러오기">가져오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
        </div>
        {/* 상단 탭 — 데스크톱 전용 */}
        <nav className="nav only-desk">
          {ALL.map((t) => (
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

      {/* ===== 모바일 하단 탭바 ===== */}
      <nav className="tabbar only-mob" aria-label="주요 메뉴">
        {PRIMARY.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} onClick={() => setMoreOpen(false)}
            className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button type="button" className={"tabbar-item as-btn" + (moreOpen ? " active" : "")}
          aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          <Icon name="more" />
          <span>더보기</span>
        </button>
      </nav>

      {/* ===== '더보기' 시트 (모바일) ===== */}
      {moreOpen && (
        <div className="sheet-overlay only-mob" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">더보기</div>
            <div className="sheet-grid">
              {MORE.map((t) => (
                <NavLink key={t.to} to={t.to} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => "sheet-link" + (isActive ? " active" : "")}>
                  {t.label}
                </NavLink>
              ))}
            </div>
            <div className="sheet-sep" />
            <div className="sheet-actions">
              <button className="btn btn-block" onClick={() => { setMoreOpen(false); doExport(); }}>내보내기</button>
              <button className="btn btn-block" onClick={() => { setMoreOpen(false); fileRef.current?.click(); }}>가져오기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
