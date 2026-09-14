import { useMemo, useState } from "react";
import { useStore, addTask, updateTask, removeTask } from "../lib/store.js";
import { isoDate, daysBetween } from "../lib/format.js";

const PRIO = [{ id: "high", l: "높음", dot: "red" }, { id: "med", l: "보통", dot: "amber" }, { id: "low", l: "낮음", dot: "gray" }];
const PRIO_DOT = { high: "red", med: "amber", low: "gray" };
const FILTERS = [{ id: "open", l: "미완료" }, { id: "all", l: "전체" }];

export default function Tasks() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const [flt, setFlt] = useState("open");
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState("med");

  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const today = isoDate(new Date());

  const view = useMemo(() => {
    const rank = (t) => (t.status === "done" ? 2 : t.status === "doing" ? 0 : 1);
    return tasks.filter((t) => flt === "all" || t.status !== "done")
      .slice().sort((a, b) => rank(a) - rank(b) || (a.due || "9999").localeCompare(b.due || "9999"));
  }, [tasks, flt]);

  const inbox = view.filter((t) => !t.projectId);
  const linked = view.filter((t) => t.projectId);

  function add() { if (!title.trim()) return; addTask({ title: title.trim(), priority: prio, inbox: true }); setTitle(""); }
  function cycle(t) { const next = t.status === "todo" ? "doing" : t.status === "doing" ? "done" : "todo"; updateTask(t.id, { status: next }); }

  function Row({ t }) {
    const overdue = t.due && t.status !== "done" && daysBetween(t.due, new Date()) > 0;
    return (
      <div className="li" style={{ alignItems: "center" }}>
        <input type="checkbox" checked={t.status === "done"} onChange={() => updateTask(t.id, { status: t.status === "done" ? "todo" : "done" })} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: t.status === "done" ? "line-through" : "none", color: t.status === "done" ? "var(--muted)" : "inherit" }}>
            <span className={"dot " + (PRIO_DOT[t.priority] || "gray")} />
            <input className="ghost-input" value={t.title} onChange={(e) => updateTask(t.id, { title: e.target.value })} />
          </div>
          <div className="tiny muted" style={{ marginTop: 2 }}>
            {t.status === "doing" ? <span className="badge amber" style={{ marginRight: 6 }}>진행중</span> : null}
            {t.projectId ? (projById[t.projectId]?.title || "프로젝트") : "Inbox"}
            {t.due ? <span style={{ color: overdue ? "var(--red)" : "inherit" }}> · 기한 {t.due}{overdue ? " (지남)" : ""}</span> : null}
          </div>
        </div>
        <select className="select" style={{ height: 32, width: 116, fontSize: 13 }} value={t.projectId || ""} onChange={(e) => updateTask(t.id, { projectId: e.target.value || null, inbox: !e.target.value })}>
          <option value="">Inbox</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title || "(무제)"}</option>)}
        </select>
        <button className="x" title="상태 순환" onClick={() => cycle(t)}>⟳</button>
        <button className="x" onClick={() => removeTask(t.id)}>×</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>내 할 일</h1>
        <p className="sub">내가 직접 수행하는 일. 빠르게 잡고(Inbox), 필요하면 프로젝트로 분류하세요.</p>
      </div>

      <div className="panel panel-pad section">
        <div className="gap-wrap">
          <input className="input" style={{ flex: 1, minWidth: 0 }} value={title} placeholder="할 일을 빠르게 입력…" onKeyDown={(e) => e.key === "Enter" && add()} onChange={(e) => setTitle(e.target.value)} />
          <div className="seg" style={{ flex: "0 0 auto" }}>{PRIO.map((p) => <button key={p.id} className={prio === p.id ? "on" : ""} onClick={() => setPrio(p.id)}>{p.l}</button>)}</div>
          <button className="btn btn-primary" style={{ flex: "0 0 auto" }} onClick={add} disabled={!title.trim()}>추가</button>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="section seg" role="tablist">{FILTERS.map((f) => <button key={f.id} className={flt === f.id ? "on" : ""} onClick={() => setFlt(f.id)}>{f.l}</button>)}</div>
      )}

      {tasks.length === 0 ? (
        <div className="panel empty"><div className="em-ic">✅</div><h3>할 일이 없습니다</h3><p>지금 머릿속에 있는 일 하나를 위에 적어보세요. 나중에 프로젝트로 묶을 수 있습니다.</p></div>
      ) : (
        <>
          {inbox.length > 0 && (
            <div className="section">
              <div className="section-title">Inbox (미분류)</div>
              <div className="panel"><div className="panel-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>{inbox.map((t) => <Row key={t.id} t={t} />)}</div></div>
            </div>
          )}
          {linked.length > 0 && (
            <div className="section">
              <div className="section-title">프로젝트 연결</div>
              <div className="panel"><div className="panel-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>{linked.map((t) => <Row key={t.id} t={t} />)}</div></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
