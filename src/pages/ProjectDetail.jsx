import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useStore, updateProject, removeProject, PROJECT_STATUSES,
  addMilestone, updateMilestone, removeMilestone,
  addTicket, updateTicket, removeTicket, updateStakeholder,
} from "../lib/store.js";
import { projectProgress } from "../lib/feasibility.js";

const CONTRIB = [{ id: "high", l: "높음" }, { id: "med", l: "보통" }, { id: "low", l: "낮음" }];
const PRIO_DOT = { high: "red", med: "amber", low: "gray" };

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const p = useStore((s) => s.projects.find((x) => x.id === id));
  const goals = useStore((s) => s.companyGoals);
  const cases = useStore((s) => s.feasibilityCases);
  const deals = useStore((s) => s.deals);
  const stakeholders = useStore((s) => s.stakeholders);
  const members = useStore((s) => s.teamMembers);
  const tickets = useStore((s) => s.tickets);
  const handoffs = useStore((s) => s.handoffs);
  const [newMs, setNewMs] = useState("");
  const [newTicket, setNewTicket] = useState("");

  const goal = p ? goals.find((g) => g.id === p.goalId) : null;
  const kase = p ? cases.find((c) => c.id === p.caseId) : null;
  const pr = p ? projectProgress(p, tickets, handoffs) : null;
  const myTickets = useMemo(() => (p ? tickets.filter((t) => t.projectId === id) : []), [tickets, id, p]);

  if (!p) return <div className="panel empty"><div className="em-ic">🔍</div><h3>프로젝트를 찾을 수 없습니다</h3><Link className="btn" to="/projects">프로젝트 목록</Link></div>;

  const set = (patch) => updateProject(id, patch);
  const krOptions = goal ? goal.keyResults || [] : [];
  const linkedShIds = p.stakeholderIds || [];
  const unlinkedSh = stakeholders.filter((s) => !linkedShIds.includes(s.id));
  function assigneeName(t) {
    if (t.assigneeKind === "self") return "나";
    if (t.assigneeKind === "member") return members.find((m) => m.id === t.assigneeId)?.name || t.assigneeName || "팀원";
    if (t.assigneeKind === "stakeholder") return stakeholders.find((s) => s.id === t.assigneeId)?.name || t.assigneeName || "이해관계자";
    return t.assigneeName || "외부";
  }

  function linkStakeholder(sid) {
    if (!sid) return;
    set({ stakeholderIds: [...linkedShIds, sid] });
    const sh = stakeholders.find((s) => s.id === sid);
    if (sh) updateStakeholder(sid, { projectIds: [...(sh.projectIds || []), id].filter((v, i, a) => a.indexOf(v) === i) });
  }
  function unlinkStakeholder(sid) {
    set({ stakeholderIds: linkedShIds.filter((x) => x !== sid) });
    const sh = stakeholders.find((s) => s.id === sid);
    if (sh) updateStakeholder(sid, { projectIds: (sh.projectIds || []).filter((x) => x !== id) });
  }
  function addProjTicket() { if (!newTicket.trim()) return; addTicket({ title: newTicket.trim(), projectId: id }); setNewTicket(""); }
  function addMs() { if (!newMs.trim()) return; addMilestone(id, { name: newMs.trim() }); setNewMs(""); }
  function del() { if (confirm("이 프로젝트를 삭제할까요? 하위 티켓은 미분류로, 위임과제/이해관계자는 유지됩니다.")) { removeProject(id); nav("/projects"); } }

  return (
    <div>
      <div className="crumb"><Link to="/projects">프로젝트</Link> <span className="muted">/</span> {p.title || "무제"}</div>
      <div className="field" style={{ marginTop: 6 }}><input className="input title-input" value={p.title} placeholder="프로젝트명" onChange={(e) => set({ title: e.target.value })} /></div>

      <div className="panel panel-pad section">
        <div className="section-title" style={{ marginBottom: 8 }}>라이프사이클</div>
        <div className="seg" style={{ marginBottom: 12 }}>
          {PROJECT_STATUSES.map((s) => <button key={s.id} className={p.status === s.id ? "on" : ""} onClick={() => set({ status: s.id, ...(s.id === "executing" && !p.startedAt ? { startedAt: new Date().toISOString() } : {}), ...(["closed", "killed"].includes(s.id) && !p.closedAt ? { closedAt: new Date().toISOString() } : {}) })}>{s.label}</button>)}
        </div>
        <div className="between" style={{ alignItems: "center" }}>
          <span className="tiny muted">진척(티켓·위임·마일스톤 완료율)</span>
          <b className="mono">{pr.pct == null ? "—" : pr.pct + "%"}{pr.total ? ` · ${pr.done}/${pr.total}` : ""}</b>
        </div>
        <div className="pbar" style={{ marginTop: 6 }}><span style={{ width: (pr.pct || 0) + "%" }} /></div>
        <label className="check-row" style={{ marginTop: 12 }}><input type="checkbox" checked={!!p.selfExec} onChange={(e) => set({ selfExec: e.target.checked })} /> 내가 직접 수행하는 프로젝트</label>
      </div>

      <div className="section">
        <div className="section-title">정렬 · 연결</div>
        <div className="panel panel-pad stack" style={{ gap: 14 }}>
          <div className="row2">
            <div className="field" style={{ margin: 0 }}><label>기업목표</label>
              <select className="select" value={p.goalId || ""} onChange={(e) => set({ goalId: e.target.value || null, krId: null })}>
                <option value="">— 미정렬 —</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title || "(무제)"}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}><label>핵심결과(KR)</label>
              <select className="select" value={p.krId || ""} disabled={!p.goalId} onChange={(e) => set({ krId: e.target.value || null })}>
                <option value="">— 선택 —</option>{krOptions.map((k) => <option key={k.id} value={k.id}>{k.name || "(무제)"}</option>)}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="field" style={{ margin: 0 }}><label>기여도</label><div className="seg">{CONTRIB.map((m) => <button key={m.id} className={p.contribution === m.id ? "on" : ""} onClick={() => set({ contribution: m.id })}>{m.l}</button>)}</div></div>
            <div className="field" style={{ margin: 0 }}><label>연결 딜 <span className="tiny muted">(선택)</span></label>
              <select className="select" value={p.dealId || ""} onChange={(e) => set({ dealId: e.target.value || null })}>
                <option value="">— 미연결 —</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.name || "(무제)"}</option>)}
              </select>
            </div>
          </div>
          {kase && <div className="tiny muted">타당성 출처: <Link to={"/feasibility/" + kase.id}>{kase.title || "케이스"}</Link></div>}
        </div>
      </div>

      <div className="section">
        <div className="section-title">이해관계자 (발의자·임원·수행)</div>
        <div className="panel panel-pad">
          {linkedShIds.length ? (
            <div className="pill-list" style={{ marginBottom: 10 }}>
              {linkedShIds.map((sid) => { const sh = stakeholders.find((s) => s.id === sid); if (!sh) return null; return <span key={sid} className="chip">{sh.name || "(무명)"}<span className="rm" onClick={() => unlinkStakeholder(sid)}>×</span></span>; })}
            </div>
          ) : <div className="muted small" style={{ marginBottom: 10 }}>연결된 이해관계자가 없습니다.</div>}
          <div className="gap-wrap">
            <select className="select" style={{ maxWidth: 240 }} value="" onChange={(e) => linkStakeholder(e.target.value)}>
              <option value="">+ 이해관계자 연결</option>
              {unlinkedSh.map((s) => <option key={s.id} value={s.id}>{s.name || "(무명)"}</option>)}
            </select>
            <Link className="btn btn-sm" to="/stakeholders">이해관계자 관리</Link>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">마일스톤</div>
        <div className="panel panel-pad">
          {(p.milestones || []).length === 0 && <div className="muted small" style={{ marginBottom: 10 }}>마일스톤이 없습니다.</div>}
          <div className="stack">
            {(p.milestones || []).map((m) => (
              <div key={m.id} className="li" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={!!m.done} onChange={(e) => updateMilestone(id, m.id, { done: e.target.checked })} />
                <input className="input" style={{ height: 34, flex: 1, minWidth: 0 }} value={m.name} onChange={(e) => updateMilestone(id, m.id, { name: e.target.value })} />
                <input className="input" style={{ height: 34, width: 140 }} type="date" value={m.targetDate || ""} onChange={(e) => updateMilestone(id, m.id, { targetDate: e.target.value })} />
                <button className="x" onClick={() => removeMilestone(id, m.id)}>×</button>
              </div>
            ))}
          </div>
          <div className="gap-wrap" style={{ marginTop: 10 }}>
            <input className="input" style={{ flex: 1, minWidth: 0 }} value={newMs} placeholder="새 마일스톤" onKeyDown={(e) => e.key === "Enter" && addMs()} onChange={(e) => setNewMs(e.target.value)} />
            <button className="btn btn-sm btn-primary" onClick={addMs} disabled={!newMs.trim()}>추가</button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>티켓 (세부 작업)</div>
          <Link className="btn btn-sm" to="/tickets">전체 티켓</Link>
        </div>
        <div className="panel panel-pad">
          {myTickets.length === 0 && <div className="muted small" style={{ marginBottom: 10 }}>이 프로젝트의 티켓이 없습니다.</div>}
          <div className="stack">
            {myTickets.map((t) => (
              <div key={t.id} className="li" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={t.status === "done"} onChange={() => updateTicket(t.id, { status: t.status === "done" ? "todo" : "done" })} />
                <span style={{ flex: 1, minWidth: 0, textDecoration: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? "var(--muted)" : "inherit" }}>
                  <span className={"dot " + (PRIO_DOT[t.priority] || "gray")} style={{ marginRight: 6 }} />{t.title}
                  <span className="tiny muted"> · {assigneeName(t)}{t.isDelegation ? " · 위임" : ""}</span>
                </span>
                <button className="x" onClick={() => removeTicket(t.id)}>×</button>
              </div>
            ))}
          </div>
          <div className="gap-wrap" style={{ marginTop: 10 }}>
            <input className="input" style={{ flex: 1, minWidth: 0 }} value={newTicket} placeholder="새 티켓(기본: 나 담당)" onKeyDown={(e) => e.key === "Enter" && addProjTicket()} onChange={(e) => setNewTicket(e.target.value)} />
            <button className="btn btn-sm btn-primary" onClick={addProjTicket} disabled={!newTicket.trim()}>추가</button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>담당자 지정·위임 심화는 티켓을 <Link to="/tickets">전체 티켓</Link>에서 열어 설정하세요.</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">위임과제 (레거시 · 위임 훈련 원장)</div>
        <div className="panel panel-pad">
          {(p.handoffIds || []).length ? (
            <div className="stack" style={{ marginBottom: 10 }}>
              {handoffs.filter((h) => (p.handoffIds || []).includes(h.id)).map((h) => (
                <div key={h.id} className="li" style={{ alignItems: "center" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{h.title || "(무제)"} <span className="tiny muted">· {h.status}</span></span>
                  <Link className="btn btn-sm" to={"/handoffs/" + h.id}>열기</Link>
                  <button className="x" onClick={() => set({ handoffIds: (p.handoffIds || []).filter((x) => x !== h.id) })}>×</button>
                </div>
              ))}
            </div>
          ) : <div className="muted small" style={{ marginBottom: 10 }}>연결된 위임과제가 없습니다.</div>}
          <div className="gap-wrap">
            <select className="select" style={{ maxWidth: 260 }} value="" onChange={(e) => e.target.value && set({ handoffIds: [...(p.handoffIds || []), e.target.value] })}>
              <option value="">+ 위임과제 연결</option>
              {handoffs.filter((h) => !(p.handoffIds || []).includes(h.id)).map((h) => <option key={h.id} value={h.id}>{h.title || "(무제)"}</option>)}
            </select>
            <Link className="btn btn-sm" to="/handoffs">위임과제 관리</Link>
          </div>
        </div>
      </div>

      <div className="section"><button className="btn btn-danger" onClick={del}>이 프로젝트 삭제</button></div>
    </div>
  );
}
