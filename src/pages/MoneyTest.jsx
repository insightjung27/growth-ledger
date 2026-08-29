import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { compute, defaultInputs, typeOf, PROJECT_TYPES, verdictText, needsWatermark } from "../lib/money.js";
import { addMoneyTest, updateMoneyTest, removeMoneyTest, getMoneyTest, getDeal, updateDeal } from "../lib/store.js";
import { won, pct, num, months as fmtMonths, manToWon, wonToMan } from "../lib/format.js";
import { CashflowChart } from "../components/Charts.jsx";

/* 작은 입력 컴포넌트들 */
function Row({ label, why, children, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {why && <div className="why">왜: {why}</div>}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
function Num({ value, onChange, suffix, placeholder, step = "any", min }) {
  return (
    <div className="input-group">
      <input className="input" type="number" inputMode="decimal" step={step} min={min}
        value={value === "" || value == null ? "" : value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}
function ConfToggle({ k, inp, setMeasured }) {
  const on = !!(inp.measured && inp.measured[k]);
  return (
    <div className="seg" style={{ marginTop: 8 }}>
      <button type="button" className={!on ? "on" : ""} onClick={() => setMeasured(k, false)}>추정</button>
      <button type="button" className={on ? "on" : ""} onClick={() => setMeasured(k, true)}>실측</button>
    </div>
  );
}

export default function MoneyTest() {
  const { id } = useParams();
  const nav = useNavigate();
  const existing = id ? getMoneyTest(id) : null;
  const [inp, setInp] = useState(() => (existing ? { ...defaultInputs(existing.inputs.projectType), ...existing.inputs } : defaultInputs("internal")));
  const [savedId, setSavedId] = useState(id || null);

  const mode = typeOf(inp.projectType).mode;
  const r = useMemo(() => compute(inp), [inp]);
  const v = verdictText(r.verdict);

  const set = (patch) => setInp((s) => ({ ...s, ...patch }));
  const setMeasured = (k, val) => setInp((s) => ({ ...s, measured: { ...s.measured, [k]: val } }));
  const setMoney = (k, man) => set({ [k]: man === "" ? 0 : manToWon(man) });
  const setRate = (k, p) => set({ [k]: p === "" ? (k === "adoptionRate" ? null : 0) : Math.max(0, Math.min(100, Number(p))) / 100 });

  function changeType(pt) {
    setInp((s) => ({ ...defaultInputs(pt), name: s.name }));
  }
  function save() {
    if (savedId) {
      updateMoneyTest(savedId, { inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType });
    } else {
      const nid = addMoneyTest({ inputs: inp, name: inp.name, verdict: r.verdict.light, projectType: inp.projectType });
      setSavedId(nid);
    }
    alert("머니테스트를 저장했습니다.");
  }
  function del() {
    if (savedId && confirm("이 머니테스트를 삭제할까요?")) {
      removeMoneyTest(savedId);
      nav("/money-test");
    }
  }

  function copySales() {
    if (r.sales) navigator.clipboard?.writeText(r.sales).then(() => alert("근거문장을 복사했습니다."));
  }

  return (
    <div>
      <div className="page-head">
        <h1>사업성 머니테스트</h1>
        <p className="sub">쉬운 질문 몇 개로 "이거 돈 될까"를 신호등으로 판정합니다. 모르는 값은 '추정'으로 두고, 결과는 정직하게 노랑에서 멈춥니다.</p>
      </div>

      <div className="section">
        <Row label="이 건 이름" hint="예: 정산 대사 자동화 / A병원 접수 SI">
          <input className="input" value={inp.name} placeholder="무엇을 검토하나요?" onChange={(e) => set({ name: e.target.value })} />
        </Row>
        <Row label="유형" why="유형에 따라 판정 기준이 달라집니다(절감형은 회수기간, 매출형은 이익률).">
          <div className="seg">
            {PROJECT_TYPES.map((t) => (
              <button key={t.id} type="button" className={inp.projectType === t.id ? "on" : ""} onClick={() => changeType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="hint">{typeOf(inp.projectType).desc}</div>
        </Row>
      </div>

      {mode === "save" ? (
        <>
          <div className="section">
            <div className="step-label">STEP 1 · 이게 연 얼마짜리 문제인가</div>
            <div className="panel panel-pad">
              <div className="row2">
                <Row label="대상 수" hint="이 일을 겪는 사람/건수">
                  <Num value={inp.targetCount} onChange={(x) => set({ targetCount: x })} suffix="명·건" min="0" />
                </Row>
                <Row label="연 발생 빈도" hint="1대상당 1년에 몇 번(예: 매일=약 250회)">
                  <Num value={inp.freqPerYear} onChange={(x) => set({ freqPerYear: x })} suffix="회/년" min="0" />
                  <ConfToggle k="freqPerYear" inp={inp} setMeasured={setMeasured} />
                </Row>
              </div>
              <div className="row2">
                <Row label="건당 소요 시간" hint="한 번에 걸리는 시간">
                  <Num value={inp.minutesPerEvent} onChange={(x) => set({ minutesPerEvent: x })} suffix="분" min="0" />
                </Row>
                <Row label="부담원가 시급" why="간접비(4대보험 등)를 이미 포함한 시급 — 여기에 부대비를 또 얹지 않습니다.">
                  <Num value={inp.loadedHourlyWage} onChange={(x) => set({ loadedHourlyWage: x })} suffix="원/시간" min="0" />
                  <ConfToggle k="loadedHourlyWage" inp={inp} setMeasured={setMeasured} />
                </Row>
              </div>
              <div className="row2">
                <Row label="건당 부대비용" hint="민원 처리 등 건마다 드는 추가비(없으면 0)">
                  <Num value={wonToMan(inp.complaintPerEvent)} onChange={(x) => setMoney("complaintPerEvent", x)} suffix="만원/건" min="0" />
                </Row>
                <Row label="기간총액 손실" why="이탈·기회손실처럼 이미 '연 총액'인 손실. 빈도로 다시 곱하지 않습니다.">
                  <Num value={wonToMan(inp.periodTotalLoss)} onChange={(x) => setMoney("periodTotalLoss", x)} suffix="만원/년" min="0" />
                </Row>
              </div>
              <div className="notice info">연 문제비용 = <b>{won(r.annualProblemCost)}</b> <span className="tiny">(재발생 {won(r.recurringAnnual)} + 기간총액 {won(r.periodTotal)})</span></div>
            </div>
          </div>

          <div className="section">
            <div className="step-label">STEP 2 · 해결하면 얼마나 좋아지나</div>
            <div className="panel panel-pad">
              <div className="row2">
                <Row label="절감률" why="자동화로 이 손해가 몇 % 줄어드는지.">
                  <Num value={inp.reductionRate == null ? "" : Math.round(inp.reductionRate * 100)} onChange={(x) => setRate("reductionRate", x)} suffix="%" min="0" />
                  <ConfToggle k="reductionRate" inp={inp} setMeasured={setMeasured} />
                </Row>
                <Row label="채택률" why="실제로 얼마나 잘 쓰일지 — 결과를 가장 크게 좌우합니다. 몰라도 됩니다.">
                  <Num value={inp.adoptionRate == null ? "" : Math.round(inp.adoptionRate * 100)} onChange={(x) => setRate("adoptionRate", x)} suffix="%" min="0" placeholder="비워두면 '모르겠어요'" />
                  <div className="gap-wrap" style={{ marginTop: 8 }}>
                    <span className={"dunno" + (inp.adoptionRate == null ? "" : " off")} onClick={() => set({ adoptionRate: null })}>모르겠어요</span>
                    {inp.adoptionRate != null && <ConfToggle k="adoptionRate" inp={inp} setMeasured={setMeasured} />}
                  </div>
                </Row>
              </div>
              <div className="row2">
                <Row label="첫해 램프업" hint="도입 첫해엔 효과가 덜 남(예: 60%)">
                  <Num value={inp.rampupFactor == null ? "" : Math.round(inp.rampupFactor * 100)} onChange={(x) => setRate("rampupFactor", x)} suffix="%" min="0" />
                </Row>
                <Row label="연 유지·운영비" hint="도입 후 매년 드는 유지비(없으면 0)">
                  <Num value={wonToMan(inp.annualMaintenanceOpex)} onChange={(x) => setMoney("annualMaintenanceOpex", x)} suffix="만원/년" min="0" />
                </Row>
              </div>
              <div className="notice info">연 순절감 = <b>{won(r.netSaving)}</b> <span className="tiny">(정상년 순효익 {won(r.steadyNet)} · 첫해 {won(r.firstYearNet)})</span></div>
            </div>
          </div>

          <div className="section">
            <div className="step-label">STEP 3 · 투자와 회수</div>
            <div className="panel panel-pad">
              <div className="row2">
                <Row label="구축비" hint="외주·라이선스 등 만드는 데 드는 돈">
                  <Num value={wonToMan(inp.buildCost)} onChange={(x) => setMoney("buildCost", x)} suffix="만원" min="0" />
                  <ConfToggle k="buildCost" inp={inp} setMeasured={setMeasured} />
                </Row>
                <Row label="내 시간·내부공수" why="'이미 있으니 공짜'라는 착각을 막기 위해 반드시 넣습니다.">
                  <Num value={wonToMan(inp.internalCost)} onChange={(x) => setMoney("internalCost", x)} suffix="만원" min="0" />
                </Row>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="section">
          <div className="step-label">P&L · 이 건이 얼마 남기나</div>
          <div className="panel panel-pad">
            <Row label="수주 예상액(매출)">
              <Num value={wonToMan(inp.revenue)} onChange={(x) => setMoney("revenue", x)} suffix="만원" min="0" />
              <ConfToggle k="revenue" inp={inp} setMeasured={setMeasured} />
            </Row>
            <div className="row2">
              <Row label="외주비"><Num value={wonToMan(inp.outsourcing)} onChange={(x) => setMoney("outsourcing", x)} suffix="만원" min="0" /><ConfToggle k="outsourcing" inp={inp} setMeasured={setMeasured} /></Row>
              <Row label="내부공수(내 시간)" why="여기도 필수 — 내 시간은 공짜가 아닙니다."><Num value={wonToMan(inp.internalCost)} onChange={(x) => setMoney("internalCost", x)} suffix="만원" min="0" /><ConfToggle k="internalCost" inp={inp} setMeasured={setMeasured} /></Row>
            </div>
            <div className="row2">
              <Row label="인프라·라이선스"><Num value={wonToMan(inp.infraLicense)} onChange={(x) => setMoney("infraLicense", x)} suffix="만원" min="0" /></Row>
              <Row label="리스크 충당" hint="추가비용 가능성 대비"><Num value={wonToMan(inp.riskReserve)} onChange={(x) => setMoney("riskReserve", x)} suffix="만원" min="0" /></Row>
            </div>
            <Row label="성공확률" hint="가중 기대값 계산용">
              <Num value={Math.round((inp.prob || 0) * 100)} onChange={(x) => setRate("prob", x)} suffix="%" min="0" />
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

      {/* ===== 결과 카드 ===== */}
      <div className="section">
        <div className="section-title">판정</div>
        <div className="verdict">
          <div className="verdict-top">
            <div className={"light " + v.light}>
              <span className="beam" />
              {v.emoji} {v.ko}{v.capped ? " (추정 상한)" : ""}
            </div>
            <div className="verdict-line">{r.oneLiner}</div>
            {needsWatermark(r) && <div className="notice warn">입력이 전부 추정입니다. 대외 제출 전 최소 한 개는 실측으로 확인하세요(현재: 내부 검토용).</div>}
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
              <div className="kv"><div className="k">이익률 · 가중기대</div><div className="v">{r.margin == null ? "-" : pct(r.margin)} · {won(r.weighted)}</div></div>
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

      <div className="gap-wrap" style={{ position: "sticky", bottom: 12, background: "var(--paper-2)", padding: "10px 0", zIndex: 5 }}>
        <button className="btn btn-primary" onClick={save}>{savedId ? "저장" : "머니테스트 저장"}</button>
        <button className="btn" onClick={() => nav("/money-test")}>새로 만들기</button>
        {savedId && <button className="btn btn-danger" onClick={del}>삭제</button>}
      </div>
    </div>
  );
}
