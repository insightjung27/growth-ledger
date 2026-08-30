import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { compute, defaultInputs, typeOf, PROJECT_TYPES, verdictText, needsWatermark, SI_GRADES, SI_ROLE_PRESETS, gradeRate, makeRole, roleCost } from "../lib/money.js";
import { addMoneyTest, updateMoneyTest, removeMoneyTest, getMoneyTest, addDecision, getDeal, getDecision } from "../lib/store.js";
import { won, pct, months as fmtMonths, manToWon, wonToMan } from "../lib/format.js";
import { CashflowChart } from "../components/Charts.jsx";
import AutoSaved from "../components/AutoSaved.jsx";

const DRAFT_KEY = "growth-ledger:mt-draft";

/* 소수점·자릿수 보존 숫자 입력 */
function Num({ value, onChange, suffix, placeholder, min, inputMode = "decimal" }) {
  // 외부에서 들어온 0(기본·프리필)은 빈칸으로 표시하고 계산은 0을 유지한다. 사용자가 직접 "0"을 치면 그대로 보인다.
  const [txt, setTxt] = useState(value == null || value === "" || Number(value) === 0 ? "" : String(value));
  useEffect(() => {
    const a = txt === "" ? null : Number(txt);
    const b = value === "" || value == null ? null : Number(value);
    if (a === b) return;
    setTxt(b == null || b === 0 ? "" : String(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  function handle(e) {
    const v = e.target.value;
    setTxt(v);
    if (v === "") return onChange("");
    const num = Number(v);
    if (!Number.isNaN(num)) onChange(num);
  }
  return (
    <div className="input-group">
      <input className="input" type="number" inputMode={inputMode} min={min} value={txt} placeholder={placeholder || "0"}
        onFocus={(e) => e.target.select()} onWheel={(e) => e.currentTarget.blur()} onChange={handle} />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

function Row({ label, why, hint, children, echo }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {echo != null && echo !== "" && Number(echo) !== 0 && <div className="hint mono">= {won(echo)}</div>}
      {why && <div className="why">왜: {why}</div>}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

// 추정/실측 토글 — '실측'은 근거(출처) 입력이 있어야만 신뢰도로 인정
function Confidence({ k, inp, setMeasured }) {
  const m = inp.measured && inp.measured[k];
  const isMeasured = !!m; // 객체 존재 = 실측 모드 선택
  const src = (m && m.source) || "";
  return (
    <div style={{ marginTop: 8 }}>
      <div className="seg">
        <button type="button" className={!isMeasured ? "on" : ""} onClick={() => setMeasured(k, null)}>추정</button>
        <button type="button" className={isMeasured ? "on" : ""} onClick={() => setMeasured(k, { source: src })}>실측</button>
      </div>
      {isMeasured && (
        <input className="input" style={{ marginTop: 6 }} value={src} placeholder="근거 한 줄(예: 3개월 로그 평균 / 담당자 확인)" onChange={(e) => setMeasured(k, { source: e.target.value })} />
      )}
      {isMeasured && !src.trim() && <div className="tiny" style={{ color: "var(--amber)", marginTop: 4 }}>근거를 적어야 '실측'으로 인정됩니다(비면 추정으로 취급).</div>}
    </div>
  );
}

const SAVE_STEPS = ["문제 돈크기", "해결 임팩트", "투자"];
const REQ = <span style={{ color: "var(--red)" }} title="판정 필수">*</span>;
const OPT = <span className="tiny muted" style={{ fontWeight: 400 }}> (선택)</span>;
const EG = <span className="badge gray" style={{ marginTop: 6 }}>예시값 — 실제 값으로 바꾸세요</span>;

export default function MoneyTest() {
  const { id } = useParams();
  const nav = useNavigate();
  const existing = id ? getMoneyTest(id) : null;

  const [inp, setInp] = useState(() => {
    if (existing) return { ...defaultInputs(existing.inputs?.projectType || "internal"), ...(existing.inputs || {}) };
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) { const p = JSON.parse(d); if (p && p.projectType) return { ...defaultInputs(p.projectType), ...p }; }
    } catch (e) {}
    return defaultInputs("internal");
  });
  const [savedId, setSavedId] = useState(existing ? existing.id : null);
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(0);
  const [justSaved, setJustSaved] = useState(false);
  // 값이 시드된 기본값과 같으면 '예시값' 배지 노출(사용자가 바꾸면 사라짐)
  const eg = (k, dv) => (inp[k] === dv ? EG : null);

  const mode = typeOf(inp.projectType).mode;
  const r = useMemo(() => compute(inp), [inp]);
  const v = verdictText(r.verdict);

  // 드래프트 자동저장(신규 미저장분 유실 방지) + 저장본은 디바운스 자동저장(무음)
  useEffect(() => {
    if (!savedId) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(inp)); } catch (e) {} return; }
    if (!dirty) return;
    const t = setTimeout(() => { updateMoneyTest(savedId, { inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType }); setDirty(false); }, 800);
    return () => clearTimeout(t);
  }, [inp, savedId, dirty, r.verdict.light]);
  // 새로고침·닫기 시 미저장 경고
  useEffect(() => {
    function onBU(e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } }
    window.addEventListener("beforeunload", onBU);
    return () => window.removeEventListener("beforeunload", onBU);
  }, [dirty]);

  const set = (patch) => { setInp((s) => ({ ...s, ...patch })); setDirty(true); setJustSaved(false); };
  const setMeasured = (k, val) => setInp((s) => ({ ...s, measured: { ...s.measured, [k]: val || undefined } }));
  const setMoney = (k, man) => set({ [k]: man === "" ? 0 : manToWon(man) });
  const setRate = (k, p) => set({ [k]: p === "" ? (k === "adoptionRate" ? null : 0) : Math.max(0, Math.min(100, Number(p))) / 100 });
  const addRole = () => set({ roles: [...(inp.roles || []), makeRole()] });
  const updateRole = (i, patch) => set({ roles: (inp.roles || []).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  const removeRole = (i) => set({ roles: (inp.roles || []).filter((_, idx) => idx !== i) });

  function changeType(pt) { if (dirty && !confirm('유형을 바꾸면 지금까지 입력이 초기화됩니다. 계속할까요?')) return; setInp((s) => ({ ...defaultInputs(pt), name: s.name })); setDirty(true); setStep(0); }
  function save() {
    if (savedId) updateMoneyTest(savedId, { inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType });
    else { const nid = addMoneyTest({ inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType }); setSavedId(nid); try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
    setDirty(false);
    setJustSaved(true);
  }
  function newTest() {
    if (dirty && !confirm("저장하지 않은 입력이 있습니다. 새로 시작할까요?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    setInp(defaultInputs("internal")); setSavedId(null); setDirty(false); setStep(0); nav("/money-test");
  }
  function del() { if (savedId && confirm("이 머니테스트를 삭제할까요?")) { removeMoneyTest(savedId); try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} nav("/money-test"); } }
  // 머니테스트 → 판단으로 승격: '돈 되나' 계산을 '할까/말까 + 나중에 대조'하는 판단으로 올린다.
  function toDecision() {
    let mid = savedId;
    if (!mid) { mid = addMoneyTest({ inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType }); setSavedId(mid); setDirty(false); try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
    else { updateMoneyTest(mid, { inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType }); setDirty(false); }
    const rec = getMoneyTest(mid);
    if (rec && rec.decisionId) { nav("/decisions/" + rec.decisionId); return; }
    const did = addDecision({ title: inp.name || "돈 판단", type: "money", question: `${inp.name || "이 건"} — 진행할지, 어떤 조건으로 갈지 판단한다.`, moneyTestId: mid, framesUsed: ["moneytest"] });
    updateMoneyTest(mid, { decisionId: did });
    nav("/decisions/" + did);
  }
  const linkedDecId = savedId ? (getMoneyTest(savedId)?.decisionId || null) : null;
  function copySales() { if (r.sales) navigator.clipboard?.writeText(r.sales).then(() => alert("근거문장을 복사했습니다.")); }

  return (
    <div>
      <div className="page-head">
        <h1>사업성 머니테스트</h1>
        <p className="sub">쉬운 질문 몇 개로 "이거 돈 될까"를 신호등으로 판정합니다. 모르는 값은 '추정'으로 두고, 결과는 정직하게 노랑에서 멈춥니다.</p>
      </div>
      {existing && (existing.dealId || existing.decisionId) && (
        <div className="section" style={{ marginTop: -6 }}>
          {existing.dealId && <Link to={"/deals/" + existing.dealId} className="tiny">← {getDeal(existing.dealId)?.name || "딜"}(으)로</Link>}
          {existing.decisionId && <Link to={"/decisions/" + existing.decisionId} className="tiny" style={{ marginLeft: existing.dealId ? 12 : 0 }}>← {getDecision(existing.decisionId)?.title || "판단"}(으)로</Link>}
        </div>
      )}
      {savedId && <div className="section" style={{ marginTop: -6 }}><AutoSaved at={getMoneyTest(savedId)?.updatedAt} /></div>}
      <div className="notice info section">
        머니테스트는 <b>'이거 돈 되나'</b>만 계산하는 도구입니다. <b>'할까/말까'</b>를 결정으로 남기고 나중에 <b>실제와 대조</b>하려면 아래 <b>판단으로 만들기</b>를 누르세요. (판단 = 결정·근거·예측을 남기고 맞았는지 대조하는 원장 / 머니테스트 = 그 원장의 '돈 검증' 도구)
      </div>

      <div className="section">
        <Row label="이 건 이름" hint="예: 정산 대사 자동화 / A병원 접수 SI">
          <input className="input" value={inp.name} placeholder="무엇을 검토하나요?" onChange={(e) => set({ name: e.target.value })} />
        </Row>
        <Row label="유형" why="유형에 따라 판정 기준이 달라집니다(절감형은 회수기간, 매출형은 이익률).">
          <div className="seg">
            {PROJECT_TYPES.map((t) => (
              <button key={t.id} type="button" className={inp.projectType === t.id ? "on" : ""} onClick={() => changeType(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="hint">{typeOf(inp.projectType).desc}</div>
        </Row>
      </div>

      {mode === "save" ? (
        <div className="section">
          <div className="steps">
            {SAVE_STEPS.map((label, i) => (<button key={i} type="button" className={"st" + (i <= step ? " on" : "")} style={{ border: "none", padding: 0, cursor: "pointer" }} aria-label={`STEP ${i + 1} ${label}`} onClick={() => setStep(i)} />))}
          </div>
          <div className="step-label">STEP {step + 1} / 3 · {SAVE_STEPS[step]}</div>

          {step === 0 && (
            <div className="panel panel-pad">
              <div className="row2">
                <Row label={<>대상 수 {REQ}</>} hint="이 일을 겪는 사람/건수">
                  <Num value={inp.targetCount} onChange={(x) => set({ targetCount: x })} suffix="명·건" min="0" inputMode="numeric" />
                  {eg("targetCount", 1)}
                </Row>
                <Row label={<>연 발생 빈도 {REQ}</>} hint="1대상당 1년에 몇 번(매일≈250, 매주≈52, 매월=12)">
                  <Num value={inp.freqPerYear} onChange={(x) => set({ freqPerYear: x })} suffix="회/년" min="0" inputMode="numeric" />
                  {eg("freqPerYear", 250)}
                  <Confidence k="freqPerYear" inp={inp} setMeasured={setMeasured} />
                </Row>
              </div>
              <div className="row2">
                <Row label={<>건당 소요 시간 {REQ}</>} hint="한 번에 걸리는 시간">
                  <Num value={inp.minutesPerEvent} onChange={(x) => set({ minutesPerEvent: x })} suffix="분" min="0" inputMode="numeric" />
                  {eg("minutesPerEvent", 30)}
                </Row>
                <Row label={<>부담원가 시급 {REQ}</>} why="간접비(4대보험 등) 포함 시급 — 여기에 부대비를 또 얹지 않습니다." echo={inp.loadedHourlyWage}>
                  <Num value={inp.loadedHourlyWage} onChange={(x) => set({ loadedHourlyWage: x })} suffix="원/시간" min="0" inputMode="numeric" />
                  {eg("loadedHourlyWage", 35000)}
                  <Confidence k="loadedHourlyWage" inp={inp} setMeasured={setMeasured} />
                </Row>
              </div>
              <div className="row2">
                <Row label={<>건당 부대비용 {OPT}</>} hint="민원 처리 등 건마다 드는 추가비(없으면 0)" echo={inp.complaintPerEvent}>
                  <Num value={wonToMan(inp.complaintPerEvent)} onChange={(x) => setMoney("complaintPerEvent", x)} suffix="만원/건" min="0" />
                </Row>
                <Row label={<>기간총액 손실 {OPT}</>} why="이탈·기회손실처럼 이미 '연 총액'인 손실. 빈도로 다시 곱하지 않습니다." echo={inp.periodTotalLoss}>
                  <Num value={wonToMan(inp.periodTotalLoss)} onChange={(x) => setMoney("periodTotalLoss", x)} suffix="만원/년" min="0" />
                </Row>
              </div>
              <div className="notice info">연 문제비용 = <b>{won(r.annualProblemCost)}</b> <span className="tiny">(재발생 {won(r.recurringAnnual)} + 기간총액 {won(r.periodTotal)})</span></div>
            </div>
          )}

          {step === 1 && (
            <div className="panel panel-pad">
              <div className="row2">
                <Row label={<>절감률 {REQ}</>} why="자동화로 이 손해가 몇 % 줄어드는지.">
                  <Num value={inp.reductionRate == null ? "" : Math.round(inp.reductionRate * 100)} onChange={(x) => setRate("reductionRate", x)} suffix="%" min="0" inputMode="numeric" />
                  {inp.reductionRate === 0.6 && EG}
                  <Confidence k="reductionRate" inp={inp} setMeasured={setMeasured} />
                </Row>
                <Row label={<>채택률 {OPT}</>} why="실제로 얼마나 잘 쓰일지 — 결과를 가장 크게 좌우합니다. 비우면 '모름'으로 보고 60%를 가정합니다(판정은 노랑 상한).">
                  <Num value={inp.adoptionRate == null ? "" : Math.round(inp.adoptionRate * 100)} onChange={(x) => setRate("adoptionRate", x)} suffix="%" min="0" inputMode="numeric" placeholder="비우면 모름 = 60% 가정" />
                  {inp.adoptionRate != null && <Confidence k="adoptionRate" inp={inp} setMeasured={setMeasured} />}
                </Row>
              </div>
              <div className="row2">
                <Row label={<>첫해 효과(램프업) {OPT}</>} hint="도입 첫해엔 효과가 덜 남(기본 60%)">
                  <Num value={inp.rampupFactor == null ? "" : Math.round(inp.rampupFactor * 100)} onChange={(x) => setRate("rampupFactor", x)} suffix="%" min="0" inputMode="numeric" />
                </Row>
                <Row label={<>연 유지·운영비 {OPT}</>} hint="도입 후 매년 드는 유지비(없으면 0)" echo={inp.annualMaintenanceOpex}>
                  <Num value={wonToMan(inp.annualMaintenanceOpex)} onChange={(x) => setMoney("annualMaintenanceOpex", x)} suffix="만원/년" min="0" />
                </Row>
              </div>
              <div className="notice info">연 순절감 ≈ <b>{won(r.netSaving)}</b> {r.adoptionUnknown && <span className="tiny">(채택률 60% 가정)</span>} <span className="tiny">· 보수~공격 {won(Math.max(0, r.cases.conservative.netSaving))}~{won(r.cases.aggressive.netSaving)}</span></div>
            </div>
          )}

          {step === 2 && (
            <div className="panel panel-pad">
              <div className="row2">
                <Row label="구축비" hint="외주·라이선스 등 만드는 데 드는 돈" echo={inp.buildCost}>
                  <Num value={wonToMan(inp.buildCost)} onChange={(x) => setMoney("buildCost", x)} suffix="만원" min="0" />
                  <Confidence k="buildCost" inp={inp} setMeasured={setMeasured} />
                </Row>
                <Row label={<>내 시간·내부공수 {REQ}</>} why="'이미 있으니 공짜'라는 착각을 막기 위해 반드시 넣습니다." echo={inp.internalCost}>
                  <Num value={wonToMan(inp.internalCost)} onChange={(x) => setMoney("internalCost", x)} suffix="만원" min="0" />
                  <div className="tiny" style={{ color: "var(--amber)", marginTop: 4 }}>0이면 초록 확정 안 됨</div>
                </Row>
              </div>
              <div className="gap-wrap" style={{ marginTop: 14 }}>
                <button className="btn btn-primary" onClick={() => { save(); document.querySelector(".verdict")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>저장하고 판정 보기</button>
              </div>
            </div>
          )}

          <div className="gap-wrap" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>이전</button>
            <button className="btn btn-primary" onClick={() => setStep((s) => Math.min(2, s + 1))} disabled={step === 2}>다음</button>
            <span className="tiny muted">모든 STEP 값은 아래 판정에 실시간 반영됩니다.</span>
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="step-label">P&L · 이 건이 얼마 남기나</div>
          <div className="panel panel-pad">
            <Row label={<>수주 예상액(매출) {REQ}</>} echo={inp.revenue}>
              <Num value={wonToMan(inp.revenue)} onChange={(x) => setMoney("revenue", x)} suffix="만원" min="0" />
              <Confidence k="revenue" inp={inp} setMeasured={setMeasured} />
            </Row>
            {inp.projectType === "si" ? (
              <div className="field" style={{ paddingBottom: 72 }}>
                <label>투입 공수 — 역할·등급별 단가 × 인원 × 개월</label>
                <div className="hint">SW 노임단가처럼 등급별 월단가로 원가를 잡습니다. 월단가 기본값은 예시 — 실제 연도 노임단가로 수정하세요.</div>
                <div style={{ marginTop: 6 }}>{EG}</div>
                <div className="table-wrap si-roles" style={{ marginTop: 8 }}>
                  <table className="grid" style={{ minWidth: 560 }}>
                    <thead><tr><th>역할</th><th>등급</th><th className="num">인원</th><th className="num">개월</th><th className="num">월단가(만)</th><th className="num">소계</th><th>구분</th><th></th></tr></thead>
                    <tbody>
                      {(inp.roles || []).map((rl, i) => (
                        <tr key={rl.id}>
                          <td data-label="역할">
                            <select className="select" style={{ minWidth: 104, height: 34 }} value={SI_ROLE_PRESETS.includes(rl.role) ? rl.role : "기타"} onChange={(e) => updateRole(i, { role: e.target.value === "기타" ? "" : e.target.value })}>
                              {SI_ROLE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                              <option value="기타">기타(직접입력)</option>
                            </select>
                            {!SI_ROLE_PRESETS.includes(rl.role) && <input className="input" style={{ marginTop: 4, height: 30, minWidth: 104 }} value={rl.role} placeholder="역할명 입력" onChange={(e) => updateRole(i, { role: e.target.value })} />}
                          </td>
                          <td data-label="등급"><select className="select" style={{ height: 34, width: 76 }} value={rl.grade} onChange={(e) => { const g = e.target.value; const patch = { grade: g }; if (rl.monthlyRate === gradeRate(rl.grade)) patch.monthlyRate = gradeRate(g); updateRole(i, patch); }}>{SI_GRADES.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}</select></td>
                          <td className="num" data-label="인원"><input className="input" type="number" min="0" inputMode="numeric" style={{ width: 56, height: 34, textAlign: "right" }} value={rl.count} onChange={(e) => updateRole(i, { count: Number(e.target.value) || 0 })} /></td>
                          <td className="num" data-label="개월"><input className="input" type="number" min="0" inputMode="numeric" style={{ width: 60, height: 34, textAlign: "right" }} value={rl.months} onChange={(e) => updateRole(i, { months: Number(e.target.value) || 0 })} /></td>
                          <td className="num" data-label="월단가(만)"><input className="input" type="number" min="0" inputMode="numeric" style={{ width: 74, height: 34, textAlign: "right" }} value={Math.round(wonToMan(rl.monthlyRate))} onChange={(e) => updateRole(i, { monthlyRate: manToWon(Number(e.target.value) || 0) })} /></td>
                          <td className="num mono" data-label="소계">{won(roleCost(rl))}</td>
                          <td data-label="구분"><button type="button" className="btn btn-sm" onClick={() => updateRole(i, { internal: !rl.internal })}>{rl.internal ? "내부" : "외주"}</button></td>
                          <td data-label=""><button type="button" className="x" onClick={() => removeRole(i)} aria-label="삭제">×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="between" style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-sm" onClick={addRole}>+ 역할 추가</button>
                  <span className="small">총 공수 원가 <b>{won(r.laborCost)}</b> <span className="tiny muted">(외주 {won(r.outsourcing)} · 내부 {won(r.internalCost)})</span></span>
                </div>
              </div>
            ) : (
              <div className="row2">
                <Row label={<>외주비 {OPT}</>} echo={inp.outsourcing}><Num value={wonToMan(inp.outsourcing)} onChange={(x) => setMoney("outsourcing", x)} suffix="만원" min="0" /><Confidence k="outsourcing" inp={inp} setMeasured={setMeasured} /></Row>
                <Row label={<>내부공수(내 시간) {REQ}</>} why="여기도 필수 — 내 시간은 공짜가 아닙니다." echo={inp.internalCost}><Num value={wonToMan(inp.internalCost)} onChange={(x) => setMoney("internalCost", x)} suffix="만원" min="0" /><div className="tiny" style={{ color: "var(--amber)", marginTop: 4 }}>0이면 초록 확정 안 됨</div><Confidence k="internalCost" inp={inp} setMeasured={setMeasured} /></Row>
              </div>
            )}
            <div className="row2">
              <Row label={<>인프라·라이선스 {OPT}</>} echo={inp.infraLicense}><Num value={wonToMan(inp.infraLicense)} onChange={(x) => setMoney("infraLicense", x)} suffix="만원" min="0" /></Row>
              <Row label={<>리스크 충당 {OPT}</>} hint="추가비용 가능성 대비" echo={inp.riskReserve}><Num value={wonToMan(inp.riskReserve)} onChange={(x) => setMoney("riskReserve", x)} suffix="만원" min="0" /></Row>
            </div>
            <Row label={<>성공확률 {OPT}</>} hint="가중 기대이익 계산용">
              <Num value={Math.round((inp.prob || 0) * 100)} onChange={(x) => setRate("prob", x)} suffix="%" min="0" inputMode="numeric" />
            </Row>
          </div>
        </div>
      )}

      <div className="section">
        <label className="gap-wrap" style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
          <input type="checkbox" checked={!!inp.hardBlock} onChange={(e) => set({ hardBlock: e.target.checked })} />
          규제·법·전략에 어긋난다(있으면 즉시 중단)
        </label>
      </div>

      {justSaved && (
        <div className="notice info section between" style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, var(--line))", alignItems: "center" }}>
          <span>저장했습니다. 이제 <b>할까/말까</b>를 남기고 나중에 실제와 대조하려면 —</span>
          <button className="btn btn-primary" onClick={toDecision} style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{linkedDecId ? "연결된 판단 열기 →" : "판단으로 만들기 →"}</button>
        </div>
      )}
      {/* ===== 결과 카드 ===== */}
      <div className="section">
        <div className="section-title">판정</div>
        <div className="verdict">
          <div className="verdict-top">
            <div className={"light " + v.light}><span className="beam" />{v.emoji} {v.ko}{v.capped ? " (추정 상한)" : ""}</div>
            <div className="verdict-line">{r.oneLiner}</div>
            {needsWatermark(r) && <div className="notice warn">입력이 전부 추정입니다(내부 검토용). 대외 제출 전 채택률·절감률·수주액 중 하나는 근거 있는 '실측'으로 확인하세요.</div>}
          </div>

          {mode === "save" && r.valid && (
            <>
              <div className="kv-grid">
                <div className="kv"><div className="k">연 문제비용</div><div className="v">{won(r.annualProblemCost)}</div></div>
                <div className="kv"><div className="k">연 순절감</div><div className="v">{won(r.netSaving)}</div></div>
                <div className="kv"><div className="k">회수기간</div><div className="v">{isFinite(r.payback) ? fmtMonths(r.payback) : "회수 안 됨"}</div></div>
                <div className="kv"><div className="k">2년 ROI</div><div className="v">{r.roi2y == null ? "-" : pct(r.roi2y)}</div></div>
              </div>
              <div className="panel-pad">
                <div className="section-title">월별 누적현금흐름 (0선을 넘는 달 = 회수)</div>
                <CashflowChart points={r.cashflow} />
              </div>
              <div className="cases">
                <div className="case"><div className="cl">보수</div><div className="cv">{fmtMonths(r.cases.conservative.payback)}</div></div>
                <div className="case"><div className="cl">기본</div><div className="cv">{fmtMonths(r.cases.base.payback)}</div></div>
                <div className="case"><div className="cl">공격</div><div className="cv">{fmtMonths(r.cases.aggressive.payback)}</div></div>
              </div>
              <div className="tiny muted" style={{ margin: "0 16px 12px" }}>이 범위는 '실측된 불확실성'이 아니라 채택률 가정을 흔든 폭입니다.</div>
            </>
          )}

          {mode === "earn" && r.valid && (
            <div className="kv-grid">
              <div className="kv"><div className="k">수주(매출)</div><div className="v">{won(r.revenue)}</div></div>
              <div className="kv"><div className="k">총원가</div><div className="v">{won(r.cost)}</div></div>
              <div className="kv"><div className="k">프로젝트에 남는 돈</div><div className="v">{won(r.profit)}</div></div>
              <div className="kv"><div className="k">가중 기대이익</div><div className="v">{won(r.weightedProfit)}<small> · 매출 {won(r.weightedRevenue)}</small></div></div>
            </div>
          )}

          {r.sales && (
            <div className="sales-box">
              <div className="lb"><span>영업·내부검토용 근거문장</span><button className="btn btn-sm" onClick={copySales}>복사</button></div>
              <p>{r.sales}</p>
            </div>
          )}
        </div>
      </div>

      <div className="gap-wrap page-actions">
        <button className="btn btn-primary" onClick={save}>{savedId ? "저장" : "머니테스트 저장"}{dirty && !savedId ? "" : ""}</button>
        <button className="btn" onClick={toDecision} style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 45%, var(--line))", fontWeight: 700 }}>{linkedDecId ? "연결된 판단 열기 →" : "판단으로 만들기 →"}</button>
        <button className="btn" onClick={newTest}>새로 만들기</button>
        {savedId && <button className="btn btn-danger" onClick={del}>삭제</button>}
        {dirty && <span className="tiny" style={{ color: "var(--amber)", alignSelf: "center" }}>저장 안 됨</span>}
      </div>
    </div>
  );
}
