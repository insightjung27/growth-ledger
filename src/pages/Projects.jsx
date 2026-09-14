import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, addProject, PROJECT_STATUSES } from "../lib/store.js";
import { projectProgress, findOrphans } from "../lib/feasibility.js";
import { portfolioFinance } from "../lib/finance.js";
import { won, pct } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

const STATUS_LIGHT = { proposed: "gray", verified: "gray", approved: "amber", executing: "green", closed: "gray", held: "amber", killed: "red" };
const FILTERS = [{ id: "active", l: "진행" }, { id: "all", l: "전체" }, { id: "closed", l: "종료" }];

export default function Projects() {
  const projects = useStore((s) => s.projects);
  const goals = useStore((s) => s.companyGoals);
  const tickets = useStore((s) => s.tickets);
  const handoffs = useStore((s) => s.handoffs);
  const state = useStore();
  const nav = useNavigate();
  const [flt, setFlt] = useState("active");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", goalId: "", selfExec: false });

  const goalById = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g])), [goals]);
  const statusById = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.id, s]));
  const orphans = useMemo(() => findOrphans(state).filter((o) => o.type === "project"), [state]);
  const pf = useMemo(() => portfolioFinance(projects), [projects]);

  const view = useMemo(() => {
    const rank = (p) => PROJECT_STATUSES.findIndex((s) => s.id === p.status);
    return projects.filter((p) => {
      if (flt === "active") return !["closed", "killed"].includes(p.status);
      if (flt === "closed") return ["closed", "killed"].includes(p.status);
      return true;
    }).slice().sort((a, b) => rank(a) - rank(b));
  }, [projects, flt]);

  function submit() {
    if (!draft.title.trim()) return;
    const pid = addProject({ title: draft.title.trim(), goalId: draft.goalId || null, selfExec: draft.selfExec, status: draft.selfExec ? "executing" : "proposed", startedAt: draft.selfExec ? new Date().toISOString() : null });
    setAdding(false); setDraft({ title: "", goalId: "", selfExec: false });
    nav("/projects/" + pid);
  }

  const activeCount = projects.filter((p) => p.status === "executing").length;

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>프로젝트</h1>
          <p className="sub">발의→검증→승인→실행→종료. 목표·타당성·수행을 한 줄로 꿰는 관리 단위.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ 프로젝트</button>
      </div>

      {orphans.length > 0 && (
        <div className="notice warn section">
          <b>목표 미정렬 프로젝트 {orphans.length}건</b> — 각 프로젝트 상세에서 기업목표에 연결하세요.
        </div>
      )}

      {projects.length > 0 && (
        <div className="stat-row section">
          <div className="stat"><div className="k">전체 프로젝트</div><div className="v">{projects.length}<small>건</small></div><div className="d">라이프사이클 관리</div></div>
          <div className="stat"><div className="k">실행 중</div><div className="v" style={{ color: activeCount ? "var(--green)" : "inherit" }}>{activeCount}<small>건</small></div><div className="d">executing 상태</div></div>
          <div className="stat"><div className="k">목표 미정렬</div><div className="v" style={{ color: orphans.length ? "var(--amber)" : "inherit" }}>{orphans.length}<small>건</small></div><div className="d">정렬 재검토 필요</div></div>
        </div>
      )}

      {(pf.budget > 0 || pf.revenue > 0) && (
        <div className="stat-row section">
          <div className="stat"><div className="k">총예산 / 소진</div><div className="v" style={{ fontSize: 18 }}>{won(pf.spent)}<small> / {won(pf.budget)}</small></div><div className="d">소진율 {pf.burnPct != null ? pct(pf.burnPct) : "—"} · 잔여 {won(pf.remaining)}</div></div>
          <div className="stat"><div className="k">포트폴리오 이익</div><div className="v" style={{ color: pf.profit < 0 ? "var(--red)" : "var(--green)" }}>{won(pf.profit)}</div><div className="d">수주형 프로젝트 실적 합</div></div>
          <div className="stat"><div className="k">재무 위험</div><div className="v" style={{ color: pf.atRisk ? "var(--red)" : "inherit" }}>{pf.atRisk}<small>건</small></div><div className="d">예산초과·손익 위험</div></div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="section seg" role="tablist">{FILTERS.map((f) => <button key={f.id} className={flt === f.id ? "on" : ""} onClick={() => setFlt(f.id)}>{f.l}</button>)}</div>
      )}

      {projects.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">📁</div>
          <h3>프로젝트가 없습니다</h3>
          <p>타당성이 Go면 "프로젝트로 승격"하거나, 여기서 바로 만드세요. 직접 수행하는 일도 프로젝트로 관리할 수 있습니다.</p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>첫 프로젝트</button>
        </div>
      ) : (
        <div className="stack">
          {view.map((p) => {
            const g = p.goalId ? goalById[p.goalId] : null;
            const pr = projectProgress(p, tickets, handoffs);
            return (
              <button key={p.id} className="li-card" onClick={() => nav("/projects/" + p.id)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="gap-wrap" style={{ marginBottom: 3 }}>
                    <span className={"badge " + STATUS_LIGHT[p.status]}>{statusById[p.status]?.label}</span>
                    {p.selfExec ? <span className="badge gray">직접수행</span> : null}
                    <b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || "(무제)"}</b>
                  </div>
                  <div className="tiny muted">{g ? `목표: ${g.title}` : "목표 미정렬"} · 진척 {pr.pct == null ? "—" : pr.pct + "%"}{pr.total ? ` (${pr.done}/${pr.total})` : ""}</div>
                </div>
                <span className="chev">›</span>
              </button>
            );
          })}
        </div>
      )}

      {adding && (
        <Modal title="프로젝트 추가" onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>취소</button><button className="btn btn-primary" onClick={submit} disabled={!draft.title.trim()}>추가</button></>}>
          <div className="field"><label>프로젝트명 <span style={{ color: "var(--red)" }}>*</span></label><input className="input" autoFocus value={draft.title} placeholder="예: 결제 모듈 리뉴얼" onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="field"><label>연결 목표 <span className="tiny muted">(선택)</span></label>
            <select className="select" value={draft.goalId} onChange={(e) => setDraft({ ...draft, goalId: e.target.value })}>
              <option value="">— 나중에 —</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title || "(무제)"}</option>)}
            </select>
          </div>
          <label className="check-row"><input type="checkbox" checked={draft.selfExec} onChange={(e) => setDraft({ ...draft, selfExec: e.target.checked })} /> 내가 직접 수행하는 프로젝트</label>
        </Modal>
      )}
    </div>
  );
}
