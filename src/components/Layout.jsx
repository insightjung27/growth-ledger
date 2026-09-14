import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { exportJSON, importJSON, markBackup, counts, usePersistError, addFeasibilityCase, addProject, addDeal, addTask } from "../lib/store.js";
import { isoDate } from "../lib/format.js";

// 모바일 하단 탭 = 새 백본 흐름: 홈·목표·타당성·프로젝트 + 더보기
const PRIMARY = [
  { to: "/", label: "홈", end: true, icon: "home" },
  { to: "/goals", label: "목표", icon: "goal" },
  { to: "/feasibility", label: "타당성", icon: "feas" },
  { to: "/projects", label: "프로젝트", icon: "project" },
];
const MORE = [
  { to: "/tasks", label: "내 할일" },
  { to: "/stakeholders", label: "이해관계자" },
  { to: "/predictions", label: "예측" },
  { to: "/deals", label: "딜" },
  { to: "/decisions", label: "판단" },
  { to: "/team", label: "팀" },
  { to: "/handoffs", label: "위임과제" },
  { to: "/one-on-ones", label: "1:1" },
  { to: "/money-test", label: "머니테스트" },
  { to: "/weekly", label: "주간리뷰" },
  { to: "/growth", label: "성장" },
  { to: "/pmo", label: "PMO" },
  { to: "/guide", label: "가이드" },
];
// 데스크톱 상단 탭 = 전체
const ALL = [
  { to: "/", label: "홈", end: true },
  { to: "/goals", label: "목표" },
  { to: "/feasibility", label: "타당성" },
  { to: "/projects", label: "프로젝트" },
  { to: "/tasks", label: "내 할일" },
  { to: "/stakeholders", label: "이해관계자" },
  { to: "/deals", label: "딜" },
  { to: "/decisions", label: "판단" },
  { to: "/money-test", label: "머니테스트" },
  { to: "/team", label: "팀" },
  { to: "/handoffs", label: "위임과제" },
  { to: "/one-on-ones", label: "1:1" },
  { to: "/weekly", label: "주간" },
  { to: "/predictions", label: "예측" },
  { to: "/growth", label: "성장" },
  { to: "/pmo", label: "PMO" },
  { to: "/guide", label: "가이드" },
];

function Icon({ name }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path {...p} d="M4 11.5 12 4l8 7.5" /><path {...p} d="M6 10v9h12v-9" /></>,
    goal: <><circle {...p} cx="12" cy="12" r="8" /><circle {...p} cx="12" cy="12" r="3.4" /></>,
    feas: <><path {...p} d="M12 4v16" /><path {...p} d="M6 8h12" /><circle {...p} cx="6" cy="13" r="2.2" /><circle {...p} cx="18" cy="13" r="2.2" /></>,
    project: <><path {...p} d="M4 7h5l1.8 2H20v9H4z" /></>,
    more: <><circle {...p} cx="5" cy="12" r="1.4" /><circle {...p} cx="12" cy="12" r="1.4" /><circle {...p} cx="19" cy="12" r="1.4" /></>,
    plus: <><path {...p} d="M12 5v14M5 12h14" /></>,
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

// 빠른캡처 — 미연결 draft 허용(캡처 마찰 0)
const CAPTURES = [
  { key: "feas", label: "타당성", emoji: "⚖️" },
  { key: "project", label: "프로젝트", emoji: "📁" },
  { key: "task", label: "할 일", emoji: "✅" },
  { key: "deal", label: "딜", emoji: "🤝" },
  { key: "prediction", label: "예측", emoji: "🔮" },
  { key: "stakeholder", label: "이해관계자", emoji: "👤" },
];

export default function Layout() {
  const fileRef = useRef(null);
  const nav = useNavigate();
  const persistErr = usePersistError();
  const [moreOpen, setMoreOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    function onPrompt(e) { e.preventDefault(); setInstallEvt(e); }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function doInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }

  function doExport() { download(exportJSON(), `성장원장-백업-${isoDate()}.json`); markBackup(); }
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const c = counts();
    if ((c.deals || c.moneyTests || c.weeklyReviews) && !confirm(`현재 데이터를 불러온 파일로 덮어씁니다. 안전을 위해 먼저 현재 데이터를 백업합니다. 계속할까요?`)) { e.target.value = ""; return; }
    if (c.deals || c.moneyTests || c.weeklyReviews) download(exportJSON(), `성장원장-교체전백업-${isoDate()}.json`);
    const reader = new FileReader();
    reader.onload = () => { try { importJSON(String(reader.result)); alert("백업을 불러왔습니다."); } catch (err) { alert("불러오기 실패: " + err.message); } };
    reader.readAsText(f);
    e.target.value = "";
  }

  function capture(key) {
    setCapOpen(false);
    if (key === "feas") { const id = addFeasibilityCase({}); nav("/feasibility/" + id); }
    else if (key === "project") { const id = addProject({}); nav("/projects/" + id); }
    else if (key === "deal") { const id = addDeal({}); nav("/deals/" + id); }
    else if (key === "task") { addTask({ inbox: true }); nav("/tasks"); }
    else if (key === "prediction") { nav("/predictions"); }
    else if (key === "stakeholder") { nav("/stakeholders"); }
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
          {installEvt && <button className="iconbtn only-desk" onClick={doInstall} title="앱으로 설치">설치</button>}
          <button className="iconbtn only-desk" onClick={doExport} title="데이터를 JSON 파일로 백업">내보내기</button>
          <button className="iconbtn only-desk" onClick={() => fileRef.current?.click()} title="JSON 백업 불러오기">가져오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
        </div>
        <nav className="nav only-desk">
          {ALL.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>{t.label}</NavLink>
          ))}
        </nav>
      </header>

      {persistErr && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>
          저장 공간에 데이터를 기록하지 못했습니다. 지금 바로 "내보내기"로 백업하세요.
        </div>
      )}

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        성장원장 — 기업 목표에 정렬해 타당성을 검증하고, 제안·실행·사람을 관리합니다. 데이터는 이 브라우저에만 저장됩니다(정기적으로 내보내기로 백업하세요).
      </footer>

      {/* ===== 빠른캡처 FAB (모바일) ===== */}
      <button type="button" className="fab only-mob" aria-label="빠른 추가" onClick={() => setCapOpen(true)}><Icon name="plus" /></button>

      {/* ===== 모바일 하단 탭바 ===== */}
      <nav className="tabbar only-mob" aria-label="주요 메뉴">
        {PRIMARY.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} onClick={() => setMoreOpen(false)} className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
            <Icon name={t.icon} /><span>{t.label}</span>
          </NavLink>
        ))}
        <button type="button" className={"tabbar-item as-btn" + (moreOpen ? " active" : "")} aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          <Icon name="more" /><span>더보기</span>
        </button>
      </nav>

      {/* ===== 빠른캡처 시트 ===== */}
      {capOpen && (
        <div className="sheet-overlay" onClick={() => setCapOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">빠른 추가</div>
            <div className="cap-grid">
              {CAPTURES.map((c) => (
                <button key={c.key} className="cap-btn" onClick={() => capture(c.key)}>
                  <span className="cap-emoji">{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== '더보기' 시트 ===== */}
      {moreOpen && (
        <div className="sheet-overlay only-mob" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">더보기</div>
            <div className="sheet-grid">
              {MORE.map((t) => (
                <NavLink key={t.to} to={t.to} onClick={() => setMoreOpen(false)} className={({ isActive }) => "sheet-link" + (isActive ? " active" : "")}>{t.label}</NavLink>
              ))}
            </div>
            {(installEvt || isIOS) && (
              <div className="notice info" style={{ marginTop: 14 }}>
                {installEvt ? <>홈 화면에 앱으로 설치하면 더 빠릅니다. <button className="btn btn-sm btn-primary" style={{ marginLeft: 6 }} onClick={() => { setMoreOpen(false); doInstall(); }}>설치</button></>
                  : <>iOS는 사파리 <b>공유 → 홈 화면에 추가</b>로 앱처럼 설치할 수 있습니다.</>}
              </div>
            )}
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
