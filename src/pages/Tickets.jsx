import { useMemo, useState } from "react";
import { useStore, addTicket, updateTicket, removeTicket, TICKET_STATUSES, ASSIGNEE_KINDS } from "../lib/store.js";
import { daysBetween } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

const PRIO = [{ id: "high", l: "높음", dot: "red" }, { id: "med", l: "보통", dot: "amber" }, { id: "low", l: "낮음", dot: "gray" }];
const PRIO_DOT = { high: "red", med: "amber", low: "gray" };
const ST = Object.fromEntries(TICKET_STATUSES.map((s) => [s.id, s]));
const DLV = [{ v: 1, l: "L1 조사·보고" }, { v: 2, l: "L2 대안 제시" }, { v: 3, l: "L3 추천·승인" }, { v: 4, l: "L4 결정·보고" }, { v: 5, l: "L5 영역 책임" }];

function assigneeLabel(t, members, stakeholders) {
  if (t.assigneeKind === "self") return "나";
  if (t.assigneeKind === "member") return members.find((m) => m.id === t.assigneeId)?.name || t.assigneeName || "팀원";
  if (t.assigneeKind === "stakeholder") return stakeholders.find((s) => s.id === t.assigneeId)?.name || t.assigneeName || "이해관계자";
  return t.assigneeName || "외부";
}

export default function Tickets() {
  const tickets = useStore((s) => s.tickets);
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.teamMembers);
  const stakeholders = useStore((s) => s.stakeholders);
  const [flt, setFlt] = useState("open");
  const [who, setWho] = useState("all");
  const [title, setTitle] = useState("");
  const [edit, setEdit] = useState(null);

  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const view = useMemo(() => {
    const rank = (t) => (t.status === "done" ? 3 : t.status === "blocked" ? 0 : t.status === "doing" ? 1 : 2);
    return tickets
      .filter((t) => (flt === "all" || t.status !== "done"))
      .filter((t) => who === "all" || (who === "self" ? t.assigneeKind === "self" : t.assigneeKind !== "self"))
      .slice().sort((a, b) => rank(a) - rank(b) || (a.due || "9999").localeCompare(b.due || "9999"));
  }, [tickets, flt, who]);

  function add() { if (!title.trim()) return; addTicket({ title: title.trim() }); setTitle(""); }
  function cycle(t) { const order = ["todo", "doing", "review", "done"]; const i = order.indexOf(t.status); updateTicket(t.id, { status: order[(i + 1) % order.length] }); }

  function Row({ t }) {
    const st = ST[t.status] || ST.todo;
    const overdue = t.due && t.status !== "done" && daysBetween(t.due, new Date()) > 0;
    return (
      <div className="li" style={{ alignItems: "center" }}>
        <button className="status-chip" title="상태 순환" onClick={() => cycle(t)}><span className={"dot " + st.light} />{st.l}</button>
        <button className="ticket-main" onClick={() => setEdit({ ...t })}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? "var(--muted)" : "inherit" }}>
            <span className={"dot " + (PRIO_DOT[t.priority] || "gray")} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{t.title || "(무제)"}</span>
            {t.isDelegation ? <span className="badge gray">위임</span> : null}
          </div>
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {t.assigneeKind === "self" ? "나" : "👤 " + assigneeLabel(t, members, stakeholders)}
            {" · "}{t.projectId ? (projById[t.projectId]?.title || "프로젝트") : "미분류"}
            {t.due ? <span style={{ color: overdue ? "var(--red)" : "inherit" }}> · 기한 {t.due}{overdue ? "(지남)" : ""}</span> : null}
          </div>
        </button>
        <button className="x" onClick={() => removeTicket(t.id)}>×</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>티켓</h1>
        <p className="sub">프로젝트를 세부 작업으로. 나 포함 누구에게나 할당하고, 필요하면 위임을 심화 관리합니다.</p>
      </div>

      <div className="panel panel-pad section">
        <div className="gap-wrap">
          <input className="input" style={{ flex: 1, minWidth: 0 }} value={title} placeholder="티켓을 빠르게 입력…" onKeyDown={(e) => e.key === "Enter" && add()} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary" style={{ flex: "0 0 auto" }} onClick={add} disabled={!title.trim()}>추가</button>
        </div>
      </div>

      {tickets.length > 0 && (
        <div className="section between" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="seg" role="tablist">
            <button className={flt === "open" ? "on" : ""} onClick={() => setFlt("open")}>미완료</button>
            <button className={flt === "all" ? "on" : ""} onClick={() => setFlt("all")}>전체</button>
          </div>
          <div className="seg" role="tablist">
            <button className={who === "all" ? "on" : ""} onClick={() => setWho("all")}>전체</button>
            <button className={who === "self" ? "on" : ""} onClick={() => setWho("self")}>내가</button>
            <button className={who === "others" ? "on" : ""} onClick={() => setWho("others")}>남에게</button>
          </div>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="panel empty"><div className="em-ic">🎫</div><h3>티켓이 없습니다</h3><p>프로젝트를 세부 작업으로 쪼개 담당자에게 할당하세요. 내가 직접 할 일도 티켓으로 관리합니다.</p></div>
      ) : (
        <div className="panel"><div className="panel-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>{view.map((t) => <Row key={t.id} t={t} />)}</div></div>
      )}

      {edit && (
        <TicketModal t={edit} projects={projects} members={members} stakeholders={stakeholders} onClose={() => setEdit(null)} />
      )}
    </div>
  );
}

function TicketModal({ t, projects, members, stakeholders, onClose }) {
  const [d, setD] = useState(t);
  const set = (patch) => setD((v) => ({ ...v, ...patch }));
  const setDlg = (patch) => setD((v) => ({ ...v, delegation: { ...v.delegation, ...patch } }));
  function save() {
    let assigneeName = d.assigneeName;
    if (d.assigneeKind === "member") assigneeName = members.find((m) => m.id === d.assigneeId)?.name || "";
    if (d.assigneeKind === "stakeholder") assigneeName = stakeholders.find((s) => s.id === d.assigneeId)?.name || "";
    updateTicket(t.id, { ...d, assigneeName });
    onClose();
  }
  return (
    <Modal title="티켓" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>취소</button><button className="btn btn-primary" onClick={save}>저장</button></>}>
      <div className="field"><label>제목</label><input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} /></div>
      <div className="row2">
        <div className="field"><label>상태</label>
          <div className="seg">{TICKET_STATUSES.map((s) => <button key={s.id} className={d.status === s.id ? "on" : ""} onClick={() => set({ status: s.id })}>{s.l}</button>)}</div>
        </div>
        <div className="field"><label>우선순위</label>
          <div className="seg">{PRIO.map((p) => <button key={p.id} className={d.priority === p.id ? "on" : ""} onClick={() => set({ priority: p.id })}>{p.l}</button>)}</div>
        </div>
      </div>
      <div className="row2">
        <div className="field"><label>프로젝트</label>
          <select className="select" value={d.projectId || ""} onChange={(e) => set({ projectId: e.target.value || null })}>
            <option value="">미분류</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title || "(무제)"}</option>)}
          </select>
        </div>
        <div className="field"><label>기한</label><input className="input" type="date" value={d.due || ""} onChange={(e) => set({ due: e.target.value })} /></div>
      </div>

      <div className="field">
        <label>담당자</label>
        <div className="seg" style={{ marginBottom: 8 }}>{ASSIGNEE_KINDS.map((k) => <button key={k.id} className={d.assigneeKind === k.id ? "on" : ""} onClick={() => set({ assigneeKind: k.id, assigneeId: null, assigneeName: "" })}>{k.l}</button>)}</div>
        {d.assigneeKind === "member" && <select className="select" value={d.assigneeId || ""} onChange={(e) => set({ assigneeId: e.target.value || null })}><option value="">— 팀원 선택 —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name || "(무명)"}</option>)}</select>}
        {d.assigneeKind === "stakeholder" && <select className="select" value={d.assigneeId || ""} onChange={(e) => set({ assigneeId: e.target.value || null })}><option value="">— 이해관계자 선택 —</option>{stakeholders.map((s) => <option key={s.id} value={s.id}>{s.name || "(무명)"}</option>)}</select>}
        {d.assigneeKind === "external" && <input className="input" value={d.assigneeName} placeholder="외부 담당자 이름" onChange={(e) => set({ assigneeName: e.target.value })} />}
      </div>

      <div className="field"><label>설명 <span className="tiny muted">(선택)</span></label><textarea className="textarea" value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>

      {d.assigneeKind !== "self" && (
        <div className="field">
          <label className="check-row"><input type="checkbox" checked={!!d.isDelegation} onChange={(e) => { const on = e.target.checked; set({ isDelegation: on }); if (on && (!d.delegation.checkpoints || !d.delegation.checkpoints.length)) setDlg({ checkpoints: [{ pct: 20, reviewed: false, note: "" }, { pct: 50, reviewed: false, note: "" }, { pct: 80, reviewed: false, note: "" }] }); }} /> 위임 심화 관리(6요소·20/50/80·완결)</label>
        </div>
      )}
      {d.isDelegation && (
        <div className="panel panel-pad" style={{ background: "var(--paper-2)" }}>
          <div className="field"><label>위임 수준</label><select className="select" value={d.delegation.level} onChange={(e) => setDlg({ level: Number(e.target.value) })}>{DLV.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select></div>
          <div className="field"><label>OUTCOME(무엇이 달라져야)</label><input className="input" value={d.delegation.outcome} onChange={(e) => setDlg({ outcome: e.target.value })} /></div>
          <div className="row2">
            <div className="field"><label>METRIC(측정)</label><input className="input" value={d.delegation.metric} onChange={(e) => setDlg({ metric: e.target.value })} /></div>
            <div className="field"><label>DEADLINE 권한(AUTHORITY)</label><input className="input" value={d.delegation.authority} onChange={(e) => setDlg({ authority: e.target.value })} /></div>
          </div>
          <div className="field"><label>BOUNDARY(건드리면 안 되는 것)</label><input className="input" value={d.delegation.boundary} onChange={(e) => setDlg({ boundary: e.target.value })} /></div>
          <div className="field"><label>20/50/80 점검</label>
            <div className="stack">{(d.delegation.checkpoints || []).map((c, i) => (
              <label key={i} className="check-row"><input type="checkbox" checked={!!c.reviewed} onChange={(e) => { const cps = d.delegation.checkpoints.slice(); cps[i] = { ...cps[i], reviewed: e.target.checked }; setDlg({ checkpoints: cps }); }} /> {c.pct}% 점검 완료</label>
            ))}</div>
          </div>
        </div>
      )}
      <div style={{ marginTop: 12 }}><button className="btn btn-danger" onClick={() => { removeTicket(t.id); onClose(); }}>티켓 삭제</button></div>
    </Modal>
  );
}
