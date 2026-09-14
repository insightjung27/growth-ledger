import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, addFeasibilityCase } from "../lib/store.js";
import { scoreCase, VERDICT_LIGHT, VERDICT_KO, findOrphans } from "../lib/feasibility.js";
import Modal from "../components/Modal.jsx";

const FILTERS = [{ id: "all", l: "전체" }, { id: "go", l: "Go" }, { id: "hold", l: "Hold" }, { id: "nogo", l: "No-Go" }, { id: "pending", l: "대기" }];

export default function Feasibility() {
  const cases = useStore((s) => s.feasibilityCases);
  const goals = useStore((s) => s.companyGoals);
  const state = useStore();
  const nav = useNavigate();
  const [flt, setFlt] = useState("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", problem: "", linkedGoalId: "", linkedKrId: "" });

  const goalById = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g])), [goals]);
  const orphans = useMemo(() => findOrphans(state).filter((o) => o.type === "case"), [state]);

  const rows = useMemo(() => cases.map((c) => ({ c, v: scoreCase(c) })), [cases]);
  const view = useMemo(() => {
    const order = { go: 0, hold: 1, pending: 2, nogo: 3 };
    return rows.filter((r) => flt === "all" || r.v.verdict === flt).slice().sort((a, b) => (order[a.v.verdict] - order[b.v.verdict]) || ((b.v.computed || 0) - (a.v.computed || 0)));
  }, [rows, flt]);

  const krOptions = draft.linkedGoalId ? (goalById[draft.linkedGoalId]?.keyResults || []) : [];

  function submit() {
    if (!draft.title.trim()) return;
    const id = addFeasibilityCase({ title: draft.title.trim(), problem: draft.problem.trim(), linkedGoalId: draft.linkedGoalId || null, linkedKrId: draft.linkedKrId || null });
    setAdding(false);
    setDraft({ title: "", problem: "", linkedGoalId: "", linkedKrId: "" });
    nav("/feasibility/" + id);
  }

  const goCount = rows.filter((r) => r.v.verdict === "go").length;

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>타당성 검증</h1>
          <p className="sub">목표에 맞는가 · 남는가 · 해낼 수 있나. 하드게이트 먼저, 점수는 보조.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ 타당성</button>
      </div>

      {orphans.length > 0 && (
        <div className="notice warn section between" style={{ alignItems: "center" }}>
          <span><b>목표 미연결 타당성 {orphans.length}건</b> — 목표(KR)에 연결하지 않으면 채점·정렬이 성립하지 않습니다.</span>
          <button className="btn btn-sm btn-primary" style={{ flex: "0 0 auto" }} onClick={() => setFlt("all")} title="아래 목록에서 회색 배지를 확인하세요">확인</button>
        </div>
      )}

      {cases.length > 0 && (
        <div className="stat-row section">
          <div className="stat"><div className="k">검토 케이스</div><div className="v">{cases.length}<small>건</small></div><div className="d">타당성 스코어카드</div></div>
          <div className="stat"><div className="k">Go 판정</div><div className="v" style={{ color: goCount ? "var(--green)" : "inherit" }}>{goCount}<small>건</small></div><div className="d">진행 추천 · 프로젝트 승격 가능</div></div>
          <div className="stat"><div className="k">목표 미연결</div><div className="v" style={{ color: orphans.length ? "var(--amber)" : "inherit" }}>{orphans.length}<small>건</small></div><div className="d">채점 불가 상태</div></div>
        </div>
      )}

      {cases.length > 0 && (
        <div className="section seg" role="tablist">
          {FILTERS.map((f) => <button key={f.id} className={flt === f.id ? "on" : ""} onClick={() => setFlt(f.id)}>{f.l}</button>)}
        </div>
      )}

      {cases.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">⚖️</div>
          <h3>타당성 케이스가 없습니다</h3>
          <p>발의된 프로젝트/업무 하나를 올려 "이게 목표에 맞고, 남고, 해낼 만한가"를 6기준으로 검증하세요. 결과는 제안·설득의 근거가 됩니다.</p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>첫 타당성 검증</button>
        </div>
      ) : (
        <div className="stack">
          {view.map(({ c, v }) => {
            const g = c.linkedGoalId ? goalById[c.linkedGoalId] : null;
            return (
              <button key={c.id} className="li-card" onClick={() => nav("/feasibility/" + c.id)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="gap-wrap" style={{ marginBottom: 3 }}>
                    <span className={"badge " + VERDICT_LIGHT[v.verdict]}>{v.hardGate ? "게이트" : VERDICT_KO[v.verdict]}{v.scored ? ` · ${v.computed}` : ""}</span>
                    {c.timeCritical ? <span className="badge amber">시급</span> : null}
                    <b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || "(무제)"}</b>
                  </div>
                  <div className="tiny muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {g ? `목표: ${g.title}` : "목표 미연결"}{v.hardGate && v.gate !== "goal" ? " · " + v.reason : ""}
                  </div>
                </div>
                <span className="chev">›</span>
              </button>
            );
          })}
        </div>
      )}

      {adding && (
        <Modal title="타당성 케이스 추가" onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>취소</button><button className="btn btn-primary" onClick={submit} disabled={!draft.title.trim()}>추가</button></>}>
          <div className="field">
            <label>제목 <span style={{ color: "var(--red)" }}>*</span></label>
            <input className="input" autoFocus value={draft.title} placeholder="예: 결제 모듈 리뉴얼" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <label>문제·배경 <span className="tiny muted">(선택)</span></label>
            <textarea className="textarea" value={draft.problem} placeholder="지금 무엇이 문제인가" onChange={(e) => setDraft({ ...draft, problem: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>연결 목표</label>
              <select className="select" value={draft.linkedGoalId} onChange={(e) => setDraft({ ...draft, linkedGoalId: e.target.value, linkedKrId: "" })}>
                <option value="">— 나중에 —</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title || "(무제)"}</option>)}
              </select>
            </div>
            <div className="field">
              <label>연결 KR</label>
              <select className="select" value={draft.linkedKrId} disabled={!draft.linkedGoalId} onChange={(e) => setDraft({ ...draft, linkedKrId: e.target.value })}>
                <option value="">— 선택 —</option>
                {krOptions.map((k) => <option key={k.id} value={k.id}>{k.name || "(무제 KR)"}</option>)}
              </select>
            </div>
          </div>
          <div className="hint">목표·KR은 나중에 상세에서 연결해도 됩니다. 단, 채점(Go/Hold/No-Go)은 KR 연결 후 가능합니다.</div>
        </Modal>
      )}
    </div>
  );
}
