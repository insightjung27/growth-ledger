import { useState } from "react";
import {
  useStore, addCompanyGoal, updateCompanyGoal, removeCompanyGoal,
  addKeyResult, updateKeyResult, removeKeyResult, GOAL_SOURCES,
} from "../lib/store.js";
import { goalProgress, krProgress } from "../lib/feasibility.js";
import Modal from "../components/Modal.jsx";

const SRC_LABEL = Object.fromEntries(GOAL_SOURCES.map((s) => [s.id, s.label]));
const CONF_OPTS = [{ v: "green", l: "높음" }, { v: "amber", l: "보통" }, { v: "red", l: "낮음" }];

function Bar({ pct }) {
  return <div className="pbar"><span style={{ width: (pct == null ? 0 : pct) + "%" }} /></div>;
}

export default function Goals() {
  const goals = useStore((s) => s.companyGoals);
  const cases = useStore((s) => s.feasibilityCases);
  const [goalModal, setGoalModal] = useState(null); // {id?, title, source, cycle, confidence, memo}
  const [krModal, setKrModal] = useState(null); // {goalId, id?, name, unit, startValue, targetValue, currentValue, confidence}

  function openNewGoal() { setGoalModal({ title: "", source: "exec", cycle: "", confidence: "amber", memo: "" }); }
  function saveGoal() {
    if (!goalModal.title.trim()) return;
    const { id, ...rest } = goalModal;
    if (id) updateCompanyGoal(id, rest);
    else addCompanyGoal({ ...rest, kind: "objective" });
    setGoalModal(null);
  }
  function delGoal(g) {
    const linked = cases.filter((c) => c.linkedGoalId === g.id).length;
    if (!confirm(`목표 "${g.title || "무제"}"를 삭제할까요?${linked ? ` 연결된 타당성 ${linked}건의 목표 링크가 해제됩니다(케이스는 유지).` : ""}`)) return;
    removeCompanyGoal(g.id);
  }
  function openNewKr(goalId) { setKrModal({ goalId, name: "", unit: "%", startValue: 0, targetValue: 0, currentValue: 0, confidence: "amber" }); }
  function saveKr() {
    if (!krModal.name.trim()) return;
    const { goalId, id, ...rest } = krModal;
    const num = (v) => (v === "" || v == null ? 0 : Number(v));
    const payload = { ...rest, startValue: num(rest.startValue), targetValue: num(rest.targetValue), currentValue: num(rest.currentValue) };
    if (id) updateKeyResult(goalId, id, payload);
    else addKeyResult(goalId, payload);
    setKrModal(null);
  }

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>기업·고객사 목표</h1>
          <p className="sub">모든 타당성·프로젝트가 정렬될 기준점. 목표는 핵심결과(KR)로 측정합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openNewGoal}>+ 목표</button>
      </div>

      <div className="notice info section">
        여기의 목표(KR)에 <b>타당성 케이스</b>를 연결해야 그 일이 "이 목표에 맞는가"를 채점할 수 있습니다. 진척(%)은 KR의 시작→현재→목표값으로 <b>자동 계산</b>됩니다.
      </div>

      {goals.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">🎯</div>
          <h3>아직 목표가 없습니다</h3>
          <p>회사·고객사·임원이 원하는 결과를 목표로 올리고, 그 아래 측정 가능한 핵심결과(KR)를 답니다. 이후 모든 프로젝트가 여기에 정렬됩니다.</p>
          <button className="btn btn-primary" onClick={openNewGoal}>첫 목표 추가</button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {goals.map((g) => {
            const gp = goalProgress(g);
            const linkedCases = cases.filter((c) => c.linkedGoalId === g.id).length;
            return (
              <div className="panel panel-pad" key={g.id}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="gap-wrap" style={{ marginBottom: 4 }}>
                      <span className={"dot " + g.confidence} title="달성 자신감" />
                      <b style={{ fontSize: 15.5 }}>{g.title || "(무제 목표)"}</b>
                    </div>
                    <div className="tiny muted">{SRC_LABEL[g.source] || "내부"}{g.cycle ? " · " + g.cycle : ""}{linkedCases ? ` · 연결 타당성 ${linkedCases}` : ""}</div>
                  </div>
                  <span className="gap-wrap" style={{ flex: "0 0 auto" }}>
                    <button className="btn btn-sm" onClick={() => setGoalModal({ id: g.id, title: g.title, source: g.source, cycle: g.cycle, confidence: g.confidence, memo: g.memo })}>편집</button>
                    <button className="btn btn-sm btn-danger" onClick={() => delGoal(g)}>삭제</button>
                  </span>
                </div>

                <div className="between" style={{ margin: "12px 0 4px", alignItems: "center" }}>
                  <span className="tiny muted">목표 진척(KR 평균)</span>
                  <b className="mono">{gp.pct == null ? "—" : gp.pct + "%"}</b>
                </div>
                <Bar pct={gp.pct} />

                <div className="stack" style={{ marginTop: 14, gap: 10 }}>
                  {(g.keyResults || []).map((k) => {
                    const kp = krProgress(k);
                    return (
                      <div key={k.id} className="kr-row">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="between" style={{ alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name || "(무제 KR)"}</span>
                            <span className="tiny muted mono" style={{ flex: "0 0 auto" }}>{k.startValue}→{k.targetValue}{k.unit}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                            <Bar pct={kp} />
                            <b className="mono tiny" style={{ flex: "0 0 auto", width: 40, textAlign: "right" }}>{kp == null ? "—" : kp + "%"}</b>
                          </div>
                        </div>
                        <div className="kr-cur">
                          <span className="tiny muted">현재</span>
                          <input className="input" style={{ height: 34, width: 72, textAlign: "right" }} type="number" inputMode="decimal" value={k.currentValue}
                            onWheel={(e) => e.currentTarget.blur()}
                            onChange={(e) => updateKeyResult(g.id, k.id, { currentValue: e.target.value === "" ? 0 : Number(e.target.value) })} />
                          <button className="x" title="KR 편집" onClick={() => setKrModal({ goalId: g.id, id: k.id, name: k.name, unit: k.unit, startValue: k.startValue, targetValue: k.targetValue, currentValue: k.currentValue, confidence: k.confidence })}>✎</button>
                          <button className="x" title="KR 삭제" onClick={() => confirm(`KR "${k.name || "무제"}" 삭제?`) && removeKeyResult(g.id, k.id)}>×</button>
                        </div>
                      </div>
                    );
                  })}
                  <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => openNewKr(g.id)}>+ 핵심결과(KR)</button>
                </div>
                {g.memo ? <div className="tiny muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{g.memo}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      {goalModal && (
        <Modal title={goalModal.id ? "목표 편집" : "목표 추가"} onClose={() => setGoalModal(null)}
          footer={<><button className="btn" onClick={() => setGoalModal(null)}>취소</button><button className="btn btn-primary" onClick={saveGoal} disabled={!goalModal.title.trim()}>{goalModal.id ? "저장" : "추가"}</button></>}>
          <div className="field">
            <label>목표 <span style={{ color: "var(--red)" }}>*</span></label>
            <input className="input" autoFocus value={goalModal.title} placeholder="예: 결제 완료율 개선으로 이탈 감소" onChange={(e) => setGoalModal({ ...goalModal, title: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>출처</label>
              <select className="select" value={goalModal.source} onChange={(e) => setGoalModal({ ...goalModal, source: e.target.value })}>
                {GOAL_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>주기 <span className="tiny muted">(선택)</span></label>
              <input className="input" value={goalModal.cycle} placeholder="예: 2026Q3" onChange={(e) => setGoalModal({ ...goalModal, cycle: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>달성 자신감</label>
            <div className="seg">
              {CONF_OPTS.map((c) => <button key={c.v} className={goalModal.confidence === c.v ? "on" : ""} onClick={() => setGoalModal({ ...goalModal, confidence: c.v })}>{c.l}</button>)}
            </div>
          </div>
          <div className="field">
            <label>메모 <span className="tiny muted">(선택)</span></label>
            <textarea className="textarea" value={goalModal.memo} placeholder="배경·맥락(예: 대표 지시, 고객사 요청 등)" onChange={(e) => setGoalModal({ ...goalModal, memo: e.target.value })} />
          </div>
        </Modal>
      )}

      {krModal && (
        <Modal title={krModal.id ? "KR 편집" : "핵심결과(KR) 추가"} onClose={() => setKrModal(null)}
          footer={<><button className="btn" onClick={() => setKrModal(null)}>취소</button><button className="btn btn-primary" onClick={saveKr} disabled={!krModal.name.trim()}>{krModal.id ? "저장" : "추가"}</button></>}>
          <div className="field">
            <label>핵심결과 이름 <span style={{ color: "var(--red)" }}>*</span></label>
            <input className="input" autoFocus value={krModal.name} placeholder="예: 결제 완료율" onChange={(e) => setKrModal({ ...krModal, name: e.target.value })} />
          </div>
          <div className="row3">
            <div className="field"><label>시작값</label><input className="input" type="number" inputMode="decimal" value={krModal.startValue} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => setKrModal({ ...krModal, startValue: e.target.value })} /></div>
            <div className="field"><label>목표값</label><input className="input" type="number" inputMode="decimal" value={krModal.targetValue} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => setKrModal({ ...krModal, targetValue: e.target.value })} /></div>
            <div className="field"><label>현재값</label><input className="input" type="number" inputMode="decimal" value={krModal.currentValue} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => setKrModal({ ...krModal, currentValue: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>단위</label><input className="input" value={krModal.unit} placeholder="% · 건 · 원 · h" onChange={(e) => setKrModal({ ...krModal, unit: e.target.value })} /></div>
            <div className="field"><label>자신감</label>
              <div className="seg">{CONF_OPTS.map((c) => <button key={c.v} className={krModal.confidence === c.v ? "on" : ""} onClick={() => setKrModal({ ...krModal, confidence: c.v })}>{c.l}</button>)}</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
