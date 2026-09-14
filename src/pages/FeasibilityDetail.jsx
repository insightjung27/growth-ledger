import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useStore, updateFeasibilityCase, removeFeasibilityCase, promoteCaseToProject, addDecision,
} from "../lib/store.js";
import { compute } from "../lib/money.js";
import { won, pct } from "../lib/format.js";
import { FEAS_AXES, SCORE_LABELS, CONFIDENCE_OPTS, VERDICT_LIGHT, VERDICT_KO, scoreCase, krProgress } from "../lib/feasibility.js";

const STATUS_OPTS = [
  { id: "draft", l: "초안" }, { id: "verifying", l: "검증중" }, { id: "decided", l: "결정" }, { id: "executing", l: "실행" }, { id: "reviewed", l: "대조완료" },
];
const MOSCOW = [{ id: "must", l: "Must" }, { id: "should", l: "Should" }, { id: "could", l: "Could" }, { id: "wont", l: "Won't" }];
const CONTRIB = [{ id: "high", l: "높음" }, { id: "med", l: "보통" }, { id: "low", l: "낮음" }];

export default function FeasibilityDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const c = useStore((s) => s.feasibilityCases.find((x) => x.id === id));
  const goals = useStore((s) => s.companyGoals);
  const moneyTests = useStore((s) => s.moneyTests);
  const deals = useStore((s) => s.deals);

  const goal = c ? goals.find((g) => g.id === c.linkedGoalId) : null;
  const kr = goal ? (goal.keyResults || []).find((k) => k.id === c.linkedKrId) : null;
  const mt = c && c.moneyTestId ? moneyTests.find((m) => m.id === c.moneyTestId) : null;
  const mtResult = useMemo(() => { try { return mt ? compute(mt.inputs || {}) : null; } catch (e) { return null; } }, [mt]);
  const v = c ? scoreCase(c) : null;

  if (!c) return (
    <div className="panel empty"><div className="em-ic">🔍</div><h3>케이스를 찾을 수 없습니다</h3><Link className="btn" to="/feasibility">타당성 목록</Link></div>
  );

  const set = (patch) => updateFeasibilityCase(id, patch);
  const setScore = (key, val) => set({ scores: { ...c.scores, [key]: val } });
  const setGate = (patch) => set({ gates: { ...c.gates, ...patch } });
  const krOptions = goal ? goal.keyResults || [] : [];

  function exportToDecision() {
    if (c.decisionId) { nav("/decisions/" + c.decisionId); return; }
    const did = addDecision({
      title: c.title || "타당성 판단", type: mt ? "money" : "strategy",
      question: `${c.title || "이 건"}을 진행할지 판단한다. (타당성 검증에서 내보냄)`,
      reversibility: c.gates?.reversibility === "oneway" ? "irreversible" : "reversible",
      moneyTestId: c.moneyTestId || null, status: "draft",
    });
    set({ decisionId: did, status: c.status === "draft" ? "verifying" : c.status });
    nav("/decisions/" + did);
  }
  function promote() {
    const pid = promoteCaseToProject(id);
    if (pid) nav("/projects/" + pid);
  }
  function del() { if (confirm("이 타당성 케이스를 삭제할까요? 연결된 프로젝트/제안의 링크만 해제되고 그 항목은 유지됩니다.")) { removeFeasibilityCase(id); nav("/feasibility"); } }

  return (
    <div>
      <div className="crumb"><Link to="/feasibility">타당성</Link> <span className="muted">/</span> {c.title || "무제"}</div>

      <div className="field" style={{ marginTop: 6 }}>
        <input className="input title-input" value={c.title} placeholder="타당성 제목" onChange={(e) => set({ title: e.target.value })} />
      </div>

      {/* ===== 판정 카드 — 하드게이트 서사 우선, 점수는 보조 ===== */}
      <div className={"panel panel-pad section verdict-card " + VERDICT_LIGHT[v.verdict]}>
        <div className="between" style={{ alignItems: "center" }}>
          <div className="gap-wrap">
            <span className={"light " + VERDICT_LIGHT[v.verdict]}><span className="beam" />{v.hardGate ? "게이트" : VERDICT_KO[v.verdict]}</span>
            {v.scored && <span className="score-chip" title="주관 1~5 채점 기반 보조 점수 · 객관 지표 아님">보조점수 {v.computed}/100</span>}
          </div>
          <span className="badge gray">{STATUS_OPTS.find((s) => s.id === c.status)?.l}</span>
        </div>
        <div className="verdict-reason">{v.reason}</div>

        {/* 근거 우선 노출 */}
        <div className="evi-grid">
          <div className="evi"><div className="k">연결 목표·KR</div><div className="val">{kr ? `${kr.name} ${krProgress(kr) ?? "—"}%` : goal ? "KR 미선택" : <span className="muted">미연결</span>}</div></div>
          <div className="evi"><div className="k">가치 근거(머니테스트)</div><div className="val">{mtResult ? (mtResult.mode === "save" ? (isFinite(mtResult.payback) ? `회수 ${Math.round(mtResult.payback)}개월` : "회수 불가") : `이익 ${won(mtResult.profit)}`) : <span className="muted">미연결</span>}</div></div>
          <div className="evi"><div className="k">확신 수준</div><div className="val">{CONFIDENCE_OPTS.find((o) => o.v === c.confidence)?.label}</div></div>
        </div>
        {v.scored && <div className="tiny muted" style={{ marginTop: 8 }}>※ 보조점수는 주관 1~5 채점 × 확신배수의 참고값입니다. 판정은 <b>하드게이트·근거</b>가 우선입니다.</div>}
        {v.gate === "goal" && <div className="notice warn" style={{ marginTop: 10 }}>아래에서 <b>기업목표(KR)</b>를 연결하면 채점이 열립니다.</div>}

        <div className="gap-wrap" style={{ marginTop: 14 }}>
          {v.verdict === "go" && !c.projectId && <button className="btn btn-sm btn-primary" onClick={promote}>프로젝트로 승격</button>}
          {c.projectId && <button className="btn btn-sm" onClick={() => nav("/projects/" + c.projectId)}>연결 프로젝트 열기</button>}
          <button className="btn btn-sm" onClick={exportToDecision}>{c.decisionId ? "연결 판단 열기" : "판단원장으로 내보내기"}</button>
        </div>
      </div>

      {/* ===== 정렬(목표 연결) ===== */}
      <div className="section">
        <div className="section-title">1. 목표 정렬 <span className="tiny" style={{ color: "var(--red)" }}>채점 전제</span></div>
        <div className="panel panel-pad row2">
          <div className="field" style={{ margin: 0 }}>
            <label>기업·고객사 목표</label>
            <select className="select" value={c.linkedGoalId || ""} onChange={(e) => set({ linkedGoalId: e.target.value || null, linkedKrId: null })}>
              <option value="">— 미연결 —</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title || "(무제)"}</option>)}
            </select>
            {goals.length === 0 && <div className="hint">먼저 <Link to="/goals">목표</Link>를 만드세요.</div>}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>핵심결과(KR)</label>
            <select className="select" value={c.linkedKrId || ""} disabled={!c.linkedGoalId} onChange={(e) => set({ linkedKrId: e.target.value || null })}>
              <option value="">— 선택 —</option>
              {krOptions.map((k) => <option key={k.id} value={k.id}>{k.name || "(무제 KR)"}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ===== 6기준 채점 ===== */}
      <div className="section">
        <div className="section-title">2. 6기준 채점 <span className="tiny muted">(1 매우낮음 ~ 5 매우높음)</span></div>
        <div className="panel panel-pad stack" style={{ gap: 16 }}>
          {FEAS_AXES.map((a) => (
            <div key={a.key}>
              <div className="between" style={{ alignItems: "baseline" }}>
                <label style={{ fontWeight: 650 }}>{a.label} <span className="tiny muted">· 가중 {a.weight}{a.dir < 0 ? " · 높을수록 감점" : ""}</span></label>
                {c.scores[a.key] != null && <span className="tiny muted">{SCORE_LABELS[c.scores[a.key]]}</span>}
              </div>
              <div className="hint" style={{ marginTop: 2, marginBottom: 6 }}>{a.hint}{a.key === "value" && mtResult ? (mtResult.mode === "save" ? ` · 회수 ${isFinite(mtResult.payback) ? Math.round(mtResult.payback) + "개월" : "불가"}` : ` · 이익률 ${pct(mtResult.margin)}`) : ""}</div>
              <div className="seg score-seg">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} className={c.scores[a.key] === n ? "on" : ""} onClick={() => setScore(a.key, c.scores[a.key] === n ? null : n)}>{n}</button>)}
              </div>
            </div>
          ))}
          <div className="field" style={{ margin: 0 }}>
            <label>확신 수준 <span className="tiny muted">(점수에 배수로 반영)</span></label>
            <div className="seg">{CONFIDENCE_OPTS.map((o) => <button key={o.v} className={c.confidence === o.v ? "on" : ""} onClick={() => set({ confidence: o.v })} title={o.desc}>{o.label}</button>)}</div>
          </div>
        </div>
      </div>

      {/* ===== 하드게이트 ===== */}
      <div className="section">
        <div className="section-title">3. 하드게이트 <span className="tiny muted">(하나라도 위반이면 점수 무시)</span></div>
        <div className="panel panel-pad stack" style={{ gap: 12 }}>
          <label className="check-row"><input type="checkbox" checked={c.gates.compliance !== false} onChange={(e) => setGate({ compliance: e.target.checked })} /> 규제·컴플라이언스 문제 없음</label>
          <label className="check-row"><input type="checkbox" checked={c.gates.budgetFit !== false} onChange={(e) => setGate({ budgetFit: e.target.checked })} /> 예산·기한 안에 가능</label>
          <div className="field" style={{ margin: 0 }}>
            <label>되돌릴 수 있나</label>
            <div className="seg">
              <button className={c.gates.reversibility !== "oneway" ? "on" : ""} onClick={() => setGate({ reversibility: "reversible" })}>되돌림 가능</button>
              <button className={c.gates.reversibility === "oneway" ? "on" : ""} onClick={() => setGate({ reversibility: "oneway" })}>비가역(one-way)</button>
            </div>
            {c.gates.reversibility === "oneway" && c.confidence <= 0.5 && <div className="hint" style={{ color: "var(--red)" }}>비가역 + 추측 확신 → 자동 No-Go. 검증으로 확신을 올리세요.</div>}
          </div>
          <label className="check-row"><input type="checkbox" checked={!!c.timeCritical} onChange={(e) => set({ timeCritical: e.target.checked })} /> 시급(우선순위 정렬 시 우대 · 판정엔 미개입)</label>
        </div>
      </div>

      {/* ===== 분류·연결·상태 ===== */}
      <div className="section">
        <div className="section-title">4. 분류 · 연결 · 상태</div>
        <div className="panel panel-pad stack" style={{ gap: 14 }}>
          <div className="row2">
            <div className="field" style={{ margin: 0 }}><label>우선순위(MoSCoW)</label><div className="seg">{MOSCOW.map((m) => <button key={m.id} className={c.moscow === m.id ? "on" : ""} onClick={() => set({ moscow: m.id })}>{m.l}</button>)}</div></div>
            <div className="field" style={{ margin: 0 }}><label>기여도</label><div className="seg">{CONTRIB.map((m) => <button key={m.id} className={c.contribution === m.id ? "on" : ""} onClick={() => set({ contribution: m.id })}>{m.l}</button>)}</div></div>
          </div>
          <div className="row2">
            <div className="field" style={{ margin: 0 }}>
              <label>가치 근거 — 머니테스트</label>
              <select className="select" value={c.moneyTestId || ""} onChange={(e) => set({ moneyTestId: e.target.value || null })}>
                <option value="">— 미연결 —</option>
                {moneyTests.map((m) => <option key={m.id} value={m.id}>{m.name || m.inputs?.name || "(무제)"}</option>)}
              </select>
              <div className="hint"><Link to="/money-test">머니테스트</Link>에서 ROI·회수를 계산해 연결하면 가치 채점 근거가 됩니다.</div>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>연결 딜 <span className="tiny muted">(선택)</span></label>
              <select className="select" value={c.linkedDealId || ""} onChange={(e) => set({ linkedDealId: e.target.value || null })}>
                <option value="">— 미연결 —</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.name || "(무제)"}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>상태</label>
            <div className="seg">{STATUS_OPTS.map((s) => <button key={s.id} className={c.status === s.id ? "on" : ""} onClick={() => set({ status: s.id })}>{s.l}</button>)}</div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>기대 성과</label>
            <textarea className="textarea" value={c.expectedOutcome} placeholder="이걸 하면 무엇이 달라지나(측정 가능하게)" onChange={(e) => set({ expectedOutcome: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>문제·배경</label>
            <textarea className="textarea" value={c.problem} placeholder="지금 무엇이 문제인가" onChange={(e) => set({ problem: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="section"><button className="btn btn-danger" onClick={del}>이 케이스 삭제</button></div>
    </div>
  );
}
