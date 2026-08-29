import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore, updateDecision, removeDecision, DECISION_TYPES, uid, addMoneyTest, getMoneyTest } from "../lib/store.js";
import { defaultInputs } from "../lib/money.js";
import { isoDate } from "../lib/format.js";
import { DECISION_FRAMES } from "../lib/guidance.js";

const typeLabel = (t) => DECISION_TYPES.find((x) => x.id === t)?.label || t;

// 유형별 추천 프레임(제안 칩) — DECISION_FRAMES 키로 매핑
const FRAME_SUGGEST = {
  money: ["moneytest", "opportunity"],
  strategy: ["ev", "premortem"],
  resource: ["opportunity", "ev"],
  product: ["criteria", "premortem"],
  people: ["premortem", "opportunity"],
  other: ["criteria"],
};
const FRAME_LABEL = { moneytest: "머니테스트", ev: "기대값(EV)", criteria: "기준 체크", premortem: "프리모템", opportunity: "기회비용", reversibility: "되돌림" };
const FRAME_DESC = (k) => (k === "moneytest" ? DECISION_FRAMES.money : DECISION_FRAMES[k] || "");

const STEPS = [["draft", "작성"], ["verifying", "검증"], ["decided", "결정"], ["executing", "실행"], ["reviewed", "대조"]];

function Stepper({ status }) {
  const cur = STEPS.findIndex((s) => s[0] === status);
  return (
    <div className="gap-wrap" style={{ margin: "6px 0 2px" }}>
      {STEPS.map(([key, label], i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <span key={key} className="gap-wrap" style={{ gap: 6 }}>
            <span
              className="badge"
              style={{
                background: active ? "var(--accent-weak)" : done ? "var(--green-bg)" : "var(--paper-3)",
                color: active ? "var(--accent)" : done ? "var(--green)" : "var(--muted)",
                fontWeight: active ? 800 : 700,
              }}
            >
              {done ? "✓ " : `${i + 1}. `}{label}
            </span>
            {i < STEPS.length - 1 ? <span className="tiny muted">→</span> : null}
          </span>
        );
      })}
    </div>
  );
}

export default function DecisionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const dec = useStore((s) => s.decisions.find((d) => d.id === id));
  const deals = useStore((s) => s.deals);
  const handoffs = useStore((s) => s.handoffs);

  const [critText, setCritText] = useState("");
  const [optDraft, setOptDraft] = useState({ label: "", note: "" });
  const [fmDraft, setFmDraft] = useState({ cause: "", mitigation: "" });
  const [naDraft, setNaDraft] = useState({ what: "", owner: "본인", due: "", linkType: "", linkId: "" });

  if (!dec) {
    return (
      <div className="panel empty">
        <div className="em-ic">🔍</div>
        <h3>판단을 찾을 수 없습니다</h3>
        <Link className="btn" to="/decisions">판단 원장으로</Link>
      </div>
    );
  }

  const today = isoDate(new Date());
  const set = (patch) => updateDecision(dec.id, patch);
  const setPred = (patch) => set({ prediction: { ...dec.prediction, ...patch } });
  const setReview = (patch) => set({ review: { ...dec.review, ...patch } });
  const setPremortem = (patch) => set({ premortem: { ...dec.premortem, ...patch } });

  const criteriaLocked = !!dec.criteriaLockedAt;
  const predictionLocked = !!dec.predictionLockedAt;
  const decided = !!dec.decidedAt;
  const isIrreversible = dec.reversibility === "irreversible";
  const premortemOk = (dec.premortem?.failureModes || []).length > 0 && (dec.premortem?.killCriteria || "").trim();
  const options = dec.options || [];
  const reviewDue = dec.reviewDate && dec.reviewDate <= today && dec.status !== "reviewed";
  const mt = dec.moneyTestId ? getMoneyTest(dec.moneyTestId) : null;

  const canDecide =
    criteriaLocked &&
    !!dec.decision.chosenOptionId &&
    (dec.decision.rationale || "").trim() &&
    (dec.prediction.expected || "").trim() &&
    (dec.prediction.target || "").trim() &&
    (!isIrreversible || premortemOk);

  // ── 기준(criteria)
  function addCriterion() {
    if (!critText.trim() || criteriaLocked) return;
    set({ criteria: [...(dec.criteria || []), { id: uid(), text: critText.trim(), met: "", evidence: "" }] });
    setCritText("");
  }
  function setCritMet(cid, met) { set({ criteria: dec.criteria.map((c) => (c.id === cid ? { ...c, met } : c)) }); }
  function setCritEvidence(cid, evidence) { set({ criteria: dec.criteria.map((c) => (c.id === cid ? { ...c, evidence } : c)) }); }
  function rmCriterion(cid) { if (criteriaLocked) return; set({ criteria: dec.criteria.filter((c) => c.id !== cid) }); }
  function lockCriteria() {
    if (!(dec.criteria || []).length) return;
    const patch = { criteriaLockedAt: new Date().toISOString() };
    if (dec.status === "draft") patch.status = "verifying";
    set(patch);
  }

  // ── 옵션(options)
  function addOption() {
    if (!optDraft.label.trim()) return;
    set({ options: [...options, { id: uid(), label: optDraft.label.trim(), note: optDraft.note.trim() }] });
    setOptDraft({ label: "", note: "" });
  }
  function rmOption(oid) {
    if (decided) return;
    const patch = { options: options.filter((o) => o.id !== oid) };
    if (dec.decision.chosenOptionId === oid) patch.decision = { ...dec.decision, chosenOptionId: null };
    set(patch);
  }

  // ── 프레임
  function toggleFrame(f) {
    const cur = dec.framesUsed || [];
    set({ framesUsed: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] });
  }
  function createMoneyTest() {
    const base = defaultInputs("internal");
    const nid = addMoneyTest({ name: dec.title, inputs: { ...base, name: dec.title }, decisionId: dec.id });
    set({ moneyTestId: nid, framesUsed: [...new Set([...(dec.framesUsed || []), "moneytest"])] });
    nav("/money-test/" + nid);
  }

  // ── 프리모템
  function addFailureMode() {
    if (!fmDraft.cause.trim()) return;
    setPremortem({ failureModes: [...(dec.premortem?.failureModes || []), { id: uid(), cause: fmDraft.cause.trim(), mitigation: fmDraft.mitigation.trim() }] });
    setFmDraft({ cause: "", mitigation: "" });
  }
  function rmFailureMode(fid) { setPremortem({ failureModes: (dec.premortem?.failureModes || []).filter((f) => f.id !== fid) }); }

  // ── 결정 / 예측 동결
  function confirmDecision() {
    if (!canDecide) return;
    const now = new Date().toISOString();
    const patch = { decidedAt: now, predictionLockedAt: now, status: "decided" };
    if (!dec.reviewDate) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      patch.reviewDate = isoDate(d);
    }
    set(patch);
  }
  function startExecution() { set({ status: "executing" }); }

  // ── 실행(nextActions)
  function addNextAction() {
    if (!naDraft.what.trim()) return;
    set({ nextActions: [...(dec.nextActions || []), { id: uid(), what: naDraft.what.trim(), owner: naDraft.owner.trim() || "본인", due: naDraft.due, linkType: naDraft.linkType, linkId: naDraft.linkId, done: false }] });
    setNaDraft({ what: "", owner: "본인", due: "", linkType: "", linkId: "" });
  }
  function toggleNA(aid) { set({ nextActions: dec.nextActions.map((a) => (a.id === aid ? { ...a, done: !a.done } : a)) }); }
  function rmNA(aid) { set({ nextActions: dec.nextActions.filter((a) => a.id !== aid) }); }

  // ── 대조 완료
  function completeReview() {
    if (!(dec.review.actualValue || "").trim() || !dec.review.hit) return;
    set({ reviewedAt: new Date().toISOString(), status: "reviewed" });
  }

  const suggested = FRAME_SUGGEST[dec.type] || [];
  const chosen = options.find((o) => o.id === dec.decision.chosenOptionId);

  return (
    <div>
      <div className="page-head between">
        <div>
          <div className="tiny muted"><Link to="/decisions">판단 원장</Link> / 상세</div>
          <h1>{dec.title || "(제목 없음)"}</h1>
          <Stepper status={dec.status} />
        </div>
        <button className="btn btn-danger" onClick={() => { if (confirm("이 판단을 삭제할까요?")) { removeDecision(dec.id); nav("/decisions"); } }}>삭제</button>
      </div>

      {/* ===== (1) 작성 ===== */}
      <div className="section">
        <div className="section-title">1. 작성 — 무엇을 판단하나</div>
        <div className="panel panel-pad">
          <div className="field">
            <label>판단명</label>
            <input className="input" value={dec.title} placeholder="예: A병원 접수 SI를 수주할 것인가" onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>유형</label>
              <select className="select" value={dec.type} onChange={(e) => set({ type: e.target.value })}>
                {DECISION_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
              <div className="hint">{DECISION_TYPES.find((t) => t.id === dec.type)?.desc || ""}</div>
            </div>
            <div className="field">
              <label>마감(판단 시한)</label>
              <input className="input" type="date" value={dec.deadline || ""} onChange={(e) => set({ deadline: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>핵심 질문 (한 문장)</label>
            <input className="input" value={dec.question} placeholder="이 판단으로 답하려는 질문 하나" onChange={(e) => set({ question: e.target.value })} />
          </div>

          {/* 기준(criteria) */}
          <div className="field" style={{ marginBottom: 8 }}>
            <label>판단 기준 (무엇이 충족되면 Yes/No)</label>
            <div className="notice info" style={{ marginBottom: 10 }}>{DECISION_FRAMES.criteria}. <b>옵션을 평가하기 전에</b> 기준을 동결해, 결정한 뒤 합리화하는 것을 막습니다.</div>
            {!criteriaLocked ? (
              <div className="between" style={{ gap: 8, marginBottom: 10 }}>
                <input className="input" value={critText} placeholder="예: 프로젝트에 3천만원 이상 남는다" onChange={(e) => setCritText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCriterion()} />
                <button className="btn btn-primary btn-sm" onClick={addCriterion}>추가</button>
              </div>
            ) : null}
            {(dec.criteria || []).length === 0 ? (
              <div className="muted small">아직 기준이 없습니다. 최소 1개를 정하고 동결하세요.</div>
            ) : (
              <div className="stack">
                {dec.criteria.map((c) => (
                  <div key={c.id} className="li" style={{ alignItems: "flex-start" }}>
                    <div className="li-main">
                      <div className="li-title">{c.text}</div>
                      {criteriaLocked ? (
                        <div className="gap-wrap" style={{ marginTop: 6 }}>
                          <div className="seg">
                            <button type="button" className={c.met === "yes" ? "on" : ""} onClick={() => setCritMet(c.id, "yes")}>충족</button>
                            <button type="button" className={c.met === "no" ? "on" : ""} onClick={() => setCritMet(c.id, "no")}>미충족</button>
                          </div>
                          <input className="input" style={{ flex: 1, minWidth: 160 }} value={c.evidence || ""} placeholder="근거(선택)" onChange={(e) => setCritEvidence(c.id, e.target.value)} />
                        </div>
                      ) : null}
                    </div>
                    {!criteriaLocked ? <button className="x" onClick={() => rmCriterion(c.id)} aria-label="삭제">×</button> : null}
                  </div>
                ))}
              </div>
            )}
            {!criteriaLocked ? (
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={lockCriteria} disabled={!(dec.criteria || []).length}>🔒 옵션 평가 시작 (기준 동결)</button>
            ) : (
              <div className="notice ok" style={{ marginTop: 12 }}>기준 동결됨 · {new Date(dec.criteriaLockedAt).toLocaleString("ko-KR")} — 이제 기준은 수정할 수 없습니다.</div>
            )}
          </div>

          {/* 옵션 */}
          <div className="field" style={{ marginBottom: 8 }}>
            <label>옵션 (검토할 선택지)</label>
            {!decided ? (
              <div className="row2" style={{ marginBottom: 10 }}>
                <input className="input" value={optDraft.label} placeholder="옵션 이름 (예: 수주한다)" onChange={(e) => setOptDraft({ ...optDraft, label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addOption()} />
                <div className="between" style={{ gap: 8 }}>
                  <input className="input" value={optDraft.note} placeholder="메모(선택)" onChange={(e) => setOptDraft({ ...optDraft, note: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addOption()} />
                  <button className="btn btn-primary btn-sm" onClick={addOption}>추가</button>
                </div>
              </div>
            ) : null}
            {options.length === 0 ? (
              <div className="muted small">옵션이 없습니다. 최소 2개(예: 한다 / 안 한다)를 넣으면 비교가 쉽습니다.</div>
            ) : (
              <div className="stack">
                {options.map((o) => (
                  <div key={o.id} className="li">
                    <div className="li-main"><div className="li-title">{o.label}{dec.decision.chosenOptionId === o.id ? <span className="badge green" style={{ marginLeft: 6 }}>선택됨</span> : null}</div>{o.note ? <div className="li-sub">{o.note}</div> : null}</div>
                    {!decided ? <button className="x" onClick={() => rmOption(o.id)} aria-label="삭제">×</button> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 되돌림 */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>되돌릴 수 있나</label>
            <div className="seg">
              <button type="button" className={dec.reversibility === "reversible" ? "on" : ""} disabled={decided} onClick={() => set({ reversibility: "reversible" })}>🔄 되돌릴 수 있음</button>
              <button type="button" className={dec.reversibility === "irreversible" ? "on" : ""} disabled={decided} onClick={() => set({ reversibility: "irreversible" })}>🚪 되돌릴 수 없음</button>
            </div>
            <div className="hint">{DECISION_FRAMES.reversibility}</div>
          </div>
        </div>
      </div>

      {/* ===== (2) 검증 ===== */}
      <div className="section">
        <div className="section-title">2. 검증 — 어떤 프레임으로 볼까</div>
        <div className="panel panel-pad">
          <div className="notice info" style={{ marginBottom: 12 }}>이 유형에 <b>추천하는 프레임</b>입니다. 적용한 프레임을 눌러 표시하세요. (기대값·기회비용 전용 에디터는 v3 — 지금은 메모로)</div>
          <div className="tagset" style={{ marginBottom: 12 }}>
            {suggested.map((f) => (
              <button key={f} type="button" className={(dec.framesUsed || []).includes(f) ? "on" : ""} onClick={() => toggleFrame(f)} title={FRAME_DESC(f)}>
                {(dec.framesUsed || []).includes(f) ? "✓ " : ""}{FRAME_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="stack" style={{ marginBottom: 12 }}>
            {suggested.map((f) => (
              <div key={f} className="small muted"><b style={{ color: "var(--ink-2)" }}>{FRAME_LABEL[f]}</b> — {FRAME_DESC(f)}</div>
            ))}
          </div>

          {/* 머니테스트(돈 프레임) */}
          {(dec.type === "money" || (dec.framesUsed || []).includes("moneytest") || mt) ? (
            <div className="panel panel-pad" style={{ background: "var(--paper-2)", marginBottom: 12 }}>
              <div className="between">
                {mt ? (
                  <>
                    <div><b>{mt.name || "머니테스트"}</b> <span className={"badge " + (mt.verdict || "gray")}>{mt.verdict === "green" ? "진행" : mt.verdict === "amber" ? "조건부" : mt.verdict === "red" ? "중단" : "판정 전"}</span></div>
                    <Link className="btn btn-sm" to={"/money-test/" + mt.id}>열기</Link>
                  </>
                ) : (
                  <>
                    <div className="small muted">{DECISION_FRAMES.money}</div>
                    <button className="btn btn-sm btn-primary" onClick={createMoneyTest}>머니테스트로 검증</button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* 프리모템 */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>프리모템 — 이게 실패한다면 왜일까 {isIrreversible ? <span className="badge red" style={{ marginLeft: 4 }}>되돌릴 수 없음 → 필수</span> : <span className="tiny muted">(선택)</span>}</label>
            <div className="hint" style={{ marginBottom: 10 }}>{DECISION_FRAMES.premortem}</div>
            <div className="row2" style={{ marginBottom: 8 }}>
              <input className="input" value={fmDraft.cause} placeholder="실패 원인 (예: 유지보수 인력 이탈)" onChange={(e) => setFmDraft({ ...fmDraft, cause: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addFailureMode()} />
              <div className="between" style={{ gap: 8 }}>
                <input className="input" value={fmDraft.mitigation} placeholder="완화책(선택)" onChange={(e) => setFmDraft({ ...fmDraft, mitigation: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addFailureMode()} />
                <button className="btn btn-primary btn-sm" onClick={addFailureMode}>추가</button>
              </div>
            </div>
            {(dec.premortem?.failureModes || []).length === 0 ? (
              <div className="muted small">아직 실패 시나리오가 없습니다.</div>
            ) : (
              <div className="stack">
                {dec.premortem.failureModes.map((f) => (
                  <div key={f.id} className="li">
                    <div className="li-main"><div className="li-title">{f.cause}</div>{f.mitigation ? <div className="li-sub">완화: {f.mitigation}</div> : null}</div>
                    <button className="x" onClick={() => rmFailureMode(f.id)} aria-label="삭제">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>킬 크라이테리아 (어떤 조건이면 중단/철회하나) {isIrreversible ? <span className="tiny" style={{ color: "var(--red)" }}>필수</span> : null}</label>
              <input className="input" value={dec.premortem?.killCriteria || ""} placeholder="예: 3개월 내 채택률 40% 미만이면 중단" onChange={(e) => setPremortem({ killCriteria: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== (3) 결정 ===== */}
      <div className="section">
        <div className="section-title">3. 결정 — 선택과 근거, 예측 동결</div>
        <div className="panel panel-pad">
          {!criteriaLocked ? (
            <div className="notice warn">먼저 <b>기준을 동결</b>해야 결정할 수 있습니다 (위 1번 작성 단계).</div>
          ) : options.length === 0 ? (
            <div className="notice warn">비교할 <b>옵션</b>을 먼저 추가하세요.</div>
          ) : (
            <>
              <div className="field">
                <label>선택한 옵션</label>
                <div className="tagset">
                  {options.map((o) => (
                    <button key={o.id} type="button" className={dec.decision.chosenOptionId === o.id ? "on" : ""} disabled={decided} onClick={() => set({ decision: { ...dec.decision, chosenOptionId: o.id } })}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>결정 근거</label>
                <textarea className="textarea" value={dec.decision.rationale} disabled={decided} placeholder="왜 이 옵션인가 — 기준 충족 여부와 함께" onChange={(e) => set({ decision: { ...dec.decision, rationale: e.target.value } })} />
              </div>

              {/* 예측 블록 */}
              <div className="field" style={{ marginBottom: 8 }}>
                <label>예측 (결정 시 동결 — 이후 수정 불가)</label>
                <div className="notice info" style={{ marginBottom: 10 }}>대조가 되려면 예측이 <b>측정 가능</b>해야 합니다. "잘 될 것"이 아니라 "무엇이 얼마가 되면 성공"인지 임계값을 적으세요.</div>
                <div className="field">
                  <label className="small muted">기대 결과 (측정 가능한 서술)</label>
                  <input className="input" value={dec.prediction.expected} disabled={predictionLocked} placeholder="예: 6개월 내 월 운영비 절감이 발생한다" onChange={(e) => setPred({ expected: e.target.value })} />
                </div>
                <div className="field">
                  <label className="small muted">측정 임계값 (target · 수치/기준)</label>
                  <input className="input" value={dec.prediction.target} disabled={predictionLocked} placeholder="예: 월 300만원 이상 절감 / 채택률 60% 이상" onChange={(e) => setPred({ target: e.target.value })} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="small muted">신뢰도 — {dec.prediction.confidence}%</label>
                  <input type="range" min="0" max="100" step="5" style={{ width: "100%" }} value={dec.prediction.confidence} disabled={predictionLocked} onChange={(e) => setPred({ confidence: Number(e.target.value) })} />
                </div>
              </div>

              <div className="field">
                <label>대조 예정일 (짧게 — 주/격주 권장)</label>
                <input className="input" type="date" value={dec.reviewDate || ""} disabled={decided} onChange={(e) => set({ reviewDate: e.target.value })} />
              </div>

              {isIrreversible && !premortemOk ? (
                <div className="notice warn" style={{ marginBottom: 12 }}>🚪 <b>되돌릴 수 없는 판단</b>입니다. 프리모템(실패 시나리오 1개 이상 + 킬 크라이테리아)을 채워야 결정할 수 있습니다.</div>
              ) : null}

              {!decided ? (
                <button className="btn btn-primary btn-block" onClick={confirmDecision} disabled={!canDecide}>결정 확정 · 예측 동결</button>
              ) : (
                <div className="notice ok">
                  결정 확정됨 · {new Date(dec.decidedAt).toLocaleString("ko-KR")}<br />
                  선택: <b>{chosen?.label || "-"}</b> · 예측 신뢰도 {dec.prediction.confidence}% (동결)
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== (4) 실행 ===== */}
      {decided ? (
        <div className="section">
          <div className="section-title">4. 실행 — 다음 행동 연결</div>
          <div className="panel panel-pad">
            <div className="notice info" style={{ marginBottom: 12 }}>판단은 <b>실행으로 연결</b>돼야 완결됩니다. 딜·위임과제로 넘기면 트레이스가 남습니다(끊겨도 판단 자체는 완결).</div>
            <div className="field">
              <input className="input" value={naDraft.what} placeholder="다음 행동 (예: 계약서 초안 검토 요청)" onChange={(e) => setNaDraft({ ...naDraft, what: e.target.value })} />
            </div>
            <div className="row3" style={{ marginBottom: 10 }}>
              <input className="input" value={naDraft.owner} placeholder="담당" onChange={(e) => setNaDraft({ ...naDraft, owner: e.target.value })} />
              <input className="input" type="date" value={naDraft.due} onChange={(e) => setNaDraft({ ...naDraft, due: e.target.value })} />
              <select className="select" value={naDraft.linkType} onChange={(e) => setNaDraft({ ...naDraft, linkType: e.target.value, linkId: "" })}>
                <option value="">연결 없음</option>
                <option value="deal">딜에 연결</option>
                <option value="handoff">위임과제에 연결</option>
              </select>
            </div>
            {naDraft.linkType === "deal" ? (
              <div className="field">
                <select className="select" value={naDraft.linkId} onChange={(e) => setNaDraft({ ...naDraft, linkId: e.target.value })}>
                  <option value="">딜 선택</option>
                  {deals.map((d) => (<option key={d.id} value={d.id}>{d.name || "(무제)"}</option>))}
                </select>
              </div>
            ) : null}
            {naDraft.linkType === "handoff" ? (
              <div className="field">
                <select className="select" value={naDraft.linkId} onChange={(e) => setNaDraft({ ...naDraft, linkId: e.target.value })}>
                  <option value="">위임과제 선택</option>
                  {handoffs.map((h) => (<option key={h.id} value={h.id}>{h.title || "(무제)"}</option>))}
                </select>
              </div>
            ) : null}
            <button className="btn btn-primary btn-sm" onClick={addNextAction} disabled={!naDraft.what.trim()}>행동 추가</button>

            {(dec.nextActions || []).length === 0 ? (
              <div className="muted small" style={{ marginTop: 12 }}>아직 다음 행동이 없습니다. <span className="badge amber">실행 대기</span> — 최소 하나를 넣고 실행을 시작하세요.</div>
            ) : (
              <div className="stack" style={{ marginTop: 12 }}>
                {dec.nextActions.map((a) => {
                  const linked = a.linkType === "deal" ? deals.find((d) => d.id === a.linkId) : a.linkType === "handoff" ? handoffs.find((h) => h.id === a.linkId) : null;
                  return (
                    <div key={a.id} className="li">
                      <button className="chip" style={{ cursor: "pointer", background: a.done ? "var(--green-bg)" : "var(--paper-3)", color: a.done ? "var(--green)" : "var(--muted)" }} onClick={() => toggleNA(a.id)} aria-pressed={a.done}>{a.done ? "완료 ✓" : "완료 체크"}</button>
                      <div className="li-main">
                        <div className="li-title" style={{ textDecoration: a.done ? "line-through" : "none" }}>{a.what}</div>
                        <div className="li-sub">
                          {a.owner || "본인"}{a.due ? ` · ${a.due}` : ""}
                          {linked ? <> · <Link to={(a.linkType === "deal" ? "/deals/" : "/handoffs/") + a.linkId}>{a.linkType === "deal" ? "딜" : "위임과제"}: {linked.name || linked.title || "열기"}</Link></> : a.linkType && a.linkId ? " · (연결 끊김)" : null}
                        </div>
                      </div>
                      <button className="x" onClick={() => rmNA(a.id)} aria-label="삭제">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            {dec.status === "decided" ? (
              <button className="btn btn-block" style={{ marginTop: 14 }} onClick={startExecution} disabled={!(dec.nextActions || []).length}>실행 시작</button>
            ) : (
              <div className="notice ok" style={{ marginTop: 14 }}>실행 중 · 대조 예정일 <b>{dec.reviewDate || "-"}</b></div>
            )}
          </div>
        </div>
      ) : null}

      {/* ===== (5) 대조 ===== */}
      {dec.status === "executing" || dec.status === "reviewed" ? (
        <div className="section">
          <div className="section-title">5. 대조 — 예측 vs 실제</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ marginBottom: 14, borderRadius: 10, overflow: "hidden" }}>
              <div className="kv"><div className="k">예측한 기대 결과</div><div className="v" style={{ fontSize: 15 }}>{dec.prediction.expected || "-"}</div></div>
              <div className="kv"><div className="k">측정 임계값(target)</div><div className="v" style={{ fontSize: 15 }}>{dec.prediction.target || "-"}</div></div>
            </div>

            {dec.status === "reviewed" ? (
              <>
                <div className="notice ok" style={{ marginBottom: 12 }}>
                  대조 완료 · {new Date(dec.reviewedAt).toLocaleString("ko-KR")} · 예측 신뢰도 {dec.prediction.confidence}% → 결과 <b>{dec.review.hit === "hit" ? "적중 ✓" : "빗나감"}</b>
                </div>
                <div className="field"><label>실제 값</label><div className="panel panel-pad" style={{ background: "var(--paper-2)" }}>{dec.review.actualValue}</div></div>
                {dec.review.lesson ? <div className="field" style={{ marginBottom: 0 }}><label>복기 / 배운 것</label><div className="panel panel-pad" style={{ background: "var(--paper-2)" }}>{dec.review.lesson}</div></div> : null}
              </>
            ) : (
              <>
                {reviewDue ? (
                  <div className="notice warn" style={{ marginBottom: 12 }}>⏰ 대조 기한이 도래했습니다({dec.reviewDate}). target 대비 실제를 기록하고 적중/빗나감을 판정하세요.</div>
                ) : (
                  <div className="notice info" style={{ marginBottom: 12 }}>대조 예정일은 <b>{dec.reviewDate || "-"}</b>입니다. 그 전에도 기록할 수 있습니다.</div>
                )}
                <div className="field">
                  <label>실제 값 (target 대비)</label>
                  <textarea className="textarea" value={dec.review.actualValue} placeholder="예: 실제 절감 월 180만원 (목표 300만원 미달)" onChange={(e) => setReview({ actualValue: e.target.value })} />
                </div>
                <div className="field">
                  <label>판정 (임계값 대비)</label>
                  <div className="seg">
                    <button type="button" className={dec.review.hit === "hit" ? "on" : ""} onClick={() => setReview({ hit: "hit" })}>적중 (target 충족)</button>
                    <button type="button" className={dec.review.hit === "miss" ? "on" : ""} onClick={() => setReview({ hit: "miss" })}>빗나감 (미달)</button>
                  </div>
                </div>
                <div className="field">
                  <label>복기 / 배운 것</label>
                  <textarea className="textarea" value={dec.review.lesson} placeholder="다음 판단에서 무엇을 다르게 할까 — 신뢰도는 적절했나" onChange={(e) => setReview({ lesson: e.target.value })} />
                </div>
                <button className="btn btn-primary btn-block" onClick={completeReview} disabled={!(dec.review.actualValue || "").trim() || !dec.review.hit}>대조 완료</button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
