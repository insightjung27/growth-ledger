import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { exportJSON, importJSON, markBackup, counts, usePersistError, addFeasibilityCase, addProject, addDeal, addTicket } from "../lib/store.js";
import { isoDate } from "../lib/format.js";

// ===== 1depth 그룹 → 2depth 페이지 =====
const NAV = [
  { key: "home", label: "홈", icon: "home", to: "/", end: true },
  { key: "strategy", label: "전략·타당성", icon: "goal", children: [
    { to: "/goals", label: "기업 목표" },
    { to: "/feasibility", label: "타당성 검증" },
  ] },
  { key: "exec", label: "실행", icon: "project", children: [
    { to: "/projects", label: "프로젝트" },
    { to: "/tickets", label: "티켓" },
    { to: "/handoffs", label: "위임과제" },
  ] },
  { key: "people", label: "사람", icon: "people", children: [
    { to: "/stakeholders", label: "이해관계자" },
    { to: "/team", label: "팀원" },
    { to: "/one-on-ones", label: "1:1" },
  ] },
  { key: "biz", label: "영업·재무", icon: "money", children: [
    { to: "/deals", label: "딜 파이프라인" },
    { to: "/money-test", label: "머니테스트" },
  ] },
  { key: "growth", label: "판단·성장", icon: "growth", children: [
    { to: "/decisions", label: "판단 원장" },
    { to: "/predictions", label: "예측" },
    { to: "/growth", label: "성장" },
    { to: "/weekly", label: "주간 리뷰" },
  ] },
  { key: "ops", label: "현황·설정", icon: "more", children: [
    { to: "/pmo", label: "PMO 현황" },
    { to: "/settings", label: "설정·동기화" },
    { to: "/guide", label: "가이드" },
  ] },
];
// 모바일 하단 탭 = 홈 + 핵심 3그룹 + 전체(나머지 포함 전 그룹 시트)
const MOBILE_TABS = ["home", "strategy", "exec", "people"];

function Icon({ name }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path {...p} d="M4 11.5 12 4l8 7.5" /><path {...p} d="M6 10v9h12v-9" /></>,
    goal: <><circle {...p} cx="12" cy="12" r="8" /><circle {...p} cx="12" cy="12" r="3.4" /></>,
    feas: <><path {...p} d="M12 4v16" /><path {...p} d="M6 8h12" /><circle {...p} cx="6" cy="13" r="2.2" /><circle {...p} cx="18" cy="13" r="2.2" /></>,
    project: <><path {...p} d="M4 7h5l1.8 2H20v9H4z" /></>,
    people: <><circle {...p} cx="12" cy="8" r="3.2" /><path {...p} d="M5 19c0-3 3-5 7-5s7 2 7 5" /></>,
    money: <><circle {...p} cx="12" cy="12" r="8" /><path {...p} d="M9 9l3 3 3-3M12 12v4" /></>,
    growth: <><path {...p} d="M4 16l5-5 3 3 6-7" /><path {...p} d="M18 5h-3M18 5v3" /></>,
    more: <><circle {...p} cx="5" cy="12" r="1.4" /><circle {...p} cx="12" cy="12" r="1.4" /><circle {...p} cx="19" cy="12" r="1.4" /></>,
    plus: <><path {...p} d="M12 5v14M5 12h14" /></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{paths[name]}</svg>;
}

function download(text, name) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

const CAPTURES = [
  { key: "feas", label: "타당성", emoji: "⚖️" },
  { key: "project", label: "프로젝트", emoji: "📁" },
  { key: "ticket", label: "티켓", emoji: "🎫" },
  { key: "deal", label: "딜", emoji: "🤝" },
  { key: "prediction", label: "예측", emoji: "🔮" },
  { key: "stakeholder", label: "이해관계자", emoji: "👤" },
];

export default function Layout() {
  const fileRef = useRef(null);
  const nav = useNavigate();
  const loc = useLocation();
  const persistErr = usePersistError();
  const [sheet, setSheet] = useState(null); // null | groupKey | "all"
  const [openGroup, setOpenGroup] = useState(null); // 데스크톱 드롭다운(클릭 토글)
  const [capOpen, setCapOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    function onPrompt(e) { e.preventDefault(); setInstallEvt(e); }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  // 라우트 이동 시 시트·드롭다운 닫기
  useEffect(() => { setSheet(null); setOpenGroup(null); }, [loc.pathname]);
  // 데스크톱 드롭다운: 바깥 클릭 시 닫기
  useEffect(() => {
    if (!openGroup) return;
    function onDoc(e) { if (!e.target.closest || !e.target.closest(".gnav-group")) setOpenGroup(null); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openGroup]);

  async function doInstall() { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }
  function doExport() { download(exportJSON(), `성장원장-백업-${isoDate()}.json`); markBackup(); }
  function onPickFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const c = counts();
    if ((c.deals || c.moneyTests || c.decisions) && !confirm(`현재 데이터를 불러온 파일로 덮어씁니다. 먼저 현재 데이터를 백업합니다. 계속할까요?`)) { e.target.value = ""; return; }
    if (c.deals || c.moneyTests || c.decisions) download(exportJSON(), `성장원장-교체전백업-${isoDate()}.json`);
    const reader = new FileReader();
    reader.onload = () => { try { importJSON(String(reader.result)); alert("백업을 불러왔습니다."); } catch (err) { alert("불러오기 실패: " + err.message); } };
    reader.readAsText(f); e.target.value = "";
  }
  function capture(key) {
    setCapOpen(false);
    if (key === "feas") { const id = addFeasibilityCase({}); nav("/feasibility/" + id); }
    else if (key === "project") { const id = addProject({}); nav("/projects/" + id); }
    else if (key === "deal") { const id = addDeal({}); nav("/deals/" + id); }
    else if (key === "ticket") { addTicket({}); nav("/tickets"); }
    else if (key === "prediction") { nav("/predictions"); }
    else if (key === "stakeholder") { nav("/stakeholders"); }
  }

  const groups = NAV.filter((g) => g.children);
  const isChildActive = (g) => (g.children || []).some((c) => loc.pathname === c.to || (c.to !== "/" && loc.pathname.startsWith(c.to + "/")));
  const sheetGroup = sheet && sheet !== "all" ? NAV.find((g) => g.key === sheet) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" onClick={() => setSheet(null)}>
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

        {/* 데스크톱 그룹 네비 + 드롭다운 */}
        <nav className="gnav only-desk">
          {NAV.map((g) => g.to ? (
            <NavLink key={g.key} to={g.to} end={g.end} className={({ isActive }) => "gnav-top" + (isActive ? " active" : "")}>{g.label}</NavLink>
          ) : (
            <div key={g.key} className={"gnav-group" + (isChildActive(g) ? " active" : "") + (openGroup === g.key ? " open" : "")}>
              <button className="gnav-top" type="button" aria-expanded={openGroup === g.key} onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)}>{g.label} <span className="caret">▾</span></button>
              <div className="gnav-dd">
                {g.children.map((c) => (
                  <NavLink key={c.to} to={c.to} onClick={() => setOpenGroup(null)} className={({ isActive }) => "gnav-ddi" + (isActive ? " active" : "")}>{c.label}</NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </header>

      {persistErr && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 16px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>
          저장 공간에 데이터를 기록하지 못했습니다. 지금 바로 "내보내기"로 백업하세요.
        </div>
      )}

      <main className="main"><Outlet /></main>

      <footer className="footer">
        성장원장 — 기업 목표에 정렬해 타당성을 검증하고, 제안·실행·사람을 관리합니다. 로그인하면 PC·폰이 동기화됩니다.
      </footer>

      {/* FAB */}
      <button type="button" className="fab only-mob" aria-label="빠른 추가" onClick={() => setCapOpen(true)}><Icon name="plus" /></button>

      {/* 모바일 하단 탭 = 홈 + 핵심 그룹 + 전체 */}
      <nav className="tabbar only-mob" aria-label="주요 메뉴">
        {MOBILE_TABS.map((k) => {
          const g = NAV.find((x) => x.key === k);
          if (g.to) return (
            <NavLink key={g.key} to={g.to} end={g.end} onClick={() => setSheet(null)} className={({ isActive }) => "tabbar-item" + (isActive ? " active" : "")}>
              <Icon name={g.icon} /><span>{g.label}</span>
            </NavLink>
          );
          return (
            <button key={g.key} type="button" className={"tabbar-item as-btn" + (sheet === g.key || isChildActive(g) ? " active" : "")} onClick={() => setSheet(sheet === g.key ? null : g.key)}>
              <Icon name={g.icon} /><span>{g.label}</span>
            </button>
          );
        })}
        <button type="button" className={"tabbar-item as-btn" + (sheet === "all" ? " active" : "")} onClick={() => setSheet(sheet === "all" ? null : "all")}>
          <Icon name="more" /><span>전체</span>
        </button>
      </nav>

      {/* 빠른캡처 시트 */}
      {capOpen && (
        <div className="sheet-overlay" onClick={() => setCapOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" /><div className="sheet-title">빠른 추가</div>
            <div className="cap-grid">{CAPTURES.map((c) => <button key={c.key} className="cap-btn" onClick={() => capture(c.key)}><span className="cap-emoji">{c.emoji}</span>{c.label}</button>)}</div>
          </div>
        </div>
      )}

      {/* 단일 그룹 시트(전략/실행/사람) */}
      {sheetGroup && (
        <div className="sheet-overlay only-mob" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" /><div className="sheet-title">{sheetGroup.label}</div>
            <div className="sheet-grid">
              {sheetGroup.children.map((c) => (
                <NavLink key={c.to} to={c.to} onClick={() => setSheet(null)} className={({ isActive }) => "sheet-link" + (isActive ? " active" : "")}>{c.label}</NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 전체 시트 — 모든 그룹을 섹션으로 */}
      {sheet === "all" && (
        <div className="sheet-overlay only-mob" onClick={() => setSheet(null)}>
          <div className="sheet sheet-tall" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" /><div className="sheet-title">전체 메뉴</div>
            {groups.map((g) => (
              <div key={g.key} className="sheet-group">
                <div className="sheet-section-title">{g.label}</div>
                <div className="sheet-grid">
                  {g.children.map((c) => (
                    <NavLink key={c.to} to={c.to} onClick={() => setSheet(null)} className={({ isActive }) => "sheet-link" + (isActive ? " active" : "")}>{c.label}</NavLink>
                  ))}
                </div>
              </div>
            ))}
            <div className="sheet-sep" />
            <div className="sheet-actions">
              <button className="btn btn-block" onClick={() => { setSheet(null); doExport(); }}>내보내기</button>
              <button className="btn btn-block" onClick={() => { setSheet(null); fileRef.current?.click(); }}>가져오기</button>
            </div>
            {(installEvt || isIOS) && (
              <div className="notice info" style={{ marginTop: 12 }}>
                {installEvt ? <>홈 화면에 앱으로 설치하면 더 빠릅니다. <button className="btn btn-sm btn-primary" style={{ marginLeft: 6 }} onClick={() => { setSheet(null); doInstall(); }}>설치</button></>
                  : <>iOS는 사파리 <b>공유 → 홈 화면에 추가</b>로 설치할 수 있습니다.</>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
