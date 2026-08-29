import { useStore, setCapability, CAPABILITIES, delegateKind } from "../lib/store.js";
import { pct } from "../lib/format.js";
import { compute } from "../lib/money.js";
import { CAREER_NORTHSTAR } from "../lib/guidance.js";

const LEVELS = [1, 2, 3, 4, 5];
const SAMPLE_MIN = 3; // 허영지표·거짓정밀 방지: 표본 미만이면 숫자 대신 '계측 불가'

// 북극성 계상 = 실권 이양(위임수준 L3+ 또는 authority 명시)만. L1/권한없음 제외.
function isRealPower(h) {
  const lvl = Number(h.delegationLevel) || 0;
  const auth = (h.authority || "").trim();
  return lvl >= 3 || (auth && auth !== "해당없음");
}
function isPeopleDone(h) {
  return delegateKind(h.delegateType) === "people" && h.status === "done";
}
function isCompletedHandoff(h) {
  const res = h.result || {};
  return isPeopleDone(h) && res.met === "met" && res.autonomy === "solved_by_them" && !res.rework && isRealPower(h);
}

// M1 변화율: 시간순 0/1 시퀀스의 최근 N건 vs 직전 N건 적중/완결율 델타(%p).
// 두 창(합 2N건)이 모두 채워질 때만 추세 산출, 아니면 null.
function rateWindows(seq, N) {
  if (seq.length < 2 * N) return null;
  const recent = seq.slice(-N);
  const prior = seq.slice(-2 * N, -N);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / N;
  const deltaPp = Math.round((mean(recent) - mean(prior)) * 100);
  const dir = deltaPp > 0 ? "상승" : deltaPp < 0 ? "하락" : "보합";
  const sign = deltaPp > 0 ? "+" : "";
  return { deltaPp, dir, label: `최근 ${N}건 추세 ${sign}${deltaPp}%p (${dir})` };
}

// 결과지표 하나 — 값 또는 '계측 불가'
function Metric({ label, ready, value, unit, sub, reason, good }) {
  return (
    <div className="kv">
      <div className="k">{label}</div>
      {ready ? (
        <>
          <div className="v" style={{ color: good ? "var(--green)" : "var(--ink)" }}>{value}{unit ? <small className="muted"> {unit}</small> : null}</div>
          {sub ? <div className="tiny muted" style={{ marginTop: 2 }}>{sub}</div> : null}
        </>
      ) : (
        <>
          <div className="v" style={{ color: "var(--muted-2)", fontSize: 15 }}>계측 불가</div>
          <div className="tiny muted" style={{ marginTop: 2 }}>{reason}</div>
        </>
      )}
    </div>
  );
}

export default function Growth() {
  const caps = useStore((s) => s.capabilities);
  const decisions = useStore((s) => s.decisions);
  const handoffs = useStore((s) => s.handoffs);
  const moneyTests = useStore((s) => s.moneyTests);
  const members = useStore((s) => s.teamMembers);

  const capOf = (id) => caps.find((c) => c.id === id) || { score: 3, target: 3 };

  // ── 결과지표(실시간 계산·표본 게이트) ──────────────────────
  // 1) 판단 적중률: 대조 완료 건 중 hit 비율
  const reviewed = decisions.filter((d) => d.reviewedAt && (d.review?.hit === "hit" || d.review?.hit === "miss"));
  const hits = reviewed.filter((d) => d.review?.hit === "hit").length;
  const hitReady = reviewed.length >= SAMPLE_MIN;
  // M1 변화율(판단): reviewedAt 시간순 hit(1)/miss(0) 시퀀스의 창 델타
  const hitSeq = [...reviewed]
    .sort((a, b) => new Date(a.reviewedAt) - new Date(b.reviewedAt))
    .map((d) => (d.review?.hit === "hit" ? 1 : 0));
  const hitTrend = rateWindows(hitSeq, SAMPLE_MIN);
  // M3 외부 앵커: witness 또는 evidenceRef가 채워진 대조 수
  const anchored = reviewed.filter((d) => (d.review?.witness || "").trim() || (d.review?.evidenceRef || "").trim());
  const anchorX = anchored.length;
  const anchorRatio = reviewed.length ? anchorX / reviewed.length : 0;
  const hitGood = hitReady && hits / reviewed.length >= 0.6 && anchorRatio >= 0.5; // 외부앵커 절반 이상일 때만 green 승격
  // M2 캘리브레이션 방향(대조 5건 이상): 평균 동결신뢰도 − 실제 적중률(%p)
  const calibReady = reviewed.length >= 5;
  let calib = null;
  if (calibReady) {
    const avgConf = reviewed.reduce((a, d) => a + (Number(d.prediction?.confidence) || 0), 0) / reviewed.length;
    const hitRatePct = (hits / reviewed.length) * 100;
    const gap = Math.round(avgConf - hitRatePct);
    if (gap > 5) calib = { tone: "amber", text: `과신 +${gap}%p (동결신뢰도 평균 > 실제 적중률)` };
    else if (gap < -5) calib = { tone: "gray", text: `과소 ${gap}%p (동결신뢰도 < 실제 적중률)` };
    else calib = { tone: "green", text: "정합 (±5%p 이내)" };
  }

  // 2) 사람 위임 완결: 실권 이양 + met + 그들이 해결 + 무재작업
  const peopleDoneAll = handoffs.filter(isPeopleDone);
  const completed = handoffs.filter(isCompletedHandoff);
  const handoffReady = peopleDoneAll.length >= 1; // 완료 이력이 하나라도 있어야 계측
  // M1 변화율(사람위임): completedAt 시간순 완결(1)/미완결(0) 시퀀스의 창 델타
  const doneSeq = [...peopleDoneAll]
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
    .map((h) => (isCompletedHandoff(h) ? 1 : 0));
  const handoffTrend = rateWindows(doneSeq, SAMPLE_MIN);

  // 3) 머니테스트 payback 정확도: 실측 대비 예측이 ±25% 이내
  //    payback은 save(내부효율화) 모드에만 존재하고, earn(SI·SaaS)엔 없음.
  //    또한 아직 actualPayback(실측) 입력 경로가 앱에 없어 계측 불가 → '준비중'으로 안전 표기(오도·크래시 방지).
  const measuredMt = moneyTests.filter((m) => {
    const t = m.inputs && m.inputs.projectType ? m.inputs.projectType : "internal";
    const isSave = ["internal"].includes(t);
    return isSave && m.actualPayback != null && isFinite(Number(m.actualPayback));
  });
  let paybackHits = 0;
  measuredMt.forEach((m) => {
    try {
      const pred = compute(m.inputs || {}).payback;
      const act = Number(m.actualPayback);
      if (isFinite(pred) && pred > 0 && isFinite(act)) {
        if (Math.abs(act - pred) / pred <= 0.25) paybackHits += 1;
      }
    } catch (e) { /* 손상 입력은 표본에서 제외하지 않되 부정확으로 간주 */ }
  });
  // 실측 입력 경로가 아직 없으므로(=표본이 구조적으로 0), 그럴듯한 숫자 대신 '준비중'을 유지한다.
  const paybackReady = measuredMt.length >= SAMPLE_MIN;

  // M4 단계 정직: 팀원이 0명이면 1인 단계 — 사람 지표를 '계측 불가'가 아니라 정직하게 표기하고 접힘 처리
  const solo = members.length === 0;
  const soloNote = "현재 1인 단계 — 사람 리더십은 첫 팀 리포트가 생기면 측정됩니다. 지금 유효한 축: 판단·실행 레버리지";

  // 4) 위임수준 평균: 활성 팀원 기준
  const active = members.filter((m) => m.active !== false);
  const levelReady = active.length >= 1;
  const avgCur = levelReady ? active.reduce((a, m) => a + (Number(m.levelCurrent) || 0), 0) / active.length : 0;
  const avgTgt = levelReady ? active.reduce((a, m) => a + (Number(m.levelTarget) || 0), 0) / active.length : 0;

  return (
    <div>
      <div className="page-head">
        <h1>성장 · 역량과 결과</h1>
        <p className="sub">자가진단 점수는 출발점일 뿐입니다. 이 화면의 주인공은 아래 <b>결과지표</b> — 활동을 얼마나 했는지가 아니라, 판단이 맞았고 넘긴 일이 완결됐는지입니다.</p>
      </div>

      {/* 커리어 북극성(R4) */}
      <div className="section">
        <div className="notice info">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{CAREER_NORTHSTAR.title}</div>
          <div style={{ marginBottom: 8 }}>{CAREER_NORTHSTAR.line}</div>
          <div className="gap-wrap" style={{ marginBottom: 8 }}>
            {CAREER_NORTHSTAR.ladder.map((s, i) => (
              <span key={s} className="chip">{i + 1}. {s}</span>
            ))}
          </div>
          <div className="stack" style={{ gap: 4 }}>
            {CAREER_NORTHSTAR.evalSentences.map((s, i) => (
              <div key={i} className="small">{i === CAREER_NORTHSTAR.evalSentences.length - 1 ? "→ " : ""}{s}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 결과지표 — 전면 배치 */}
      <div className="section">
        <div className="section-title">결과지표 — 실시간 계측(표본 {SAMPLE_MIN}건 미만이면 '계측 불가')</div>
        <div className="panel panel-pad">
          {/* 레버리지 축(판단·실행) — 1인 단계에서도 유효 */}
          <div className="kv-grid">
            <Metric
              label="판단 적중률 · 기둥①"
              ready={hitReady}
              value={hitReady ? pct(hits / reviewed.length) : ""}
              sub={hitReady ? (
                <>
                  <div>대조 완료 {reviewed.length}건 중 적중 {hits}건</div>
                  <div>외부 근거 있는 대조 {anchorX}/{reviewed.length} — 나머지는 자기신고(미확정)</div>
                  <div>{hitTrend ? hitTrend.label : "추세 계측 불가(대조 6건 필요) · 위 값은 생애누적"}</div>
                  {calibReady && calib ? (
                    <div style={{ marginTop: 4 }}><span className={"badge " + calib.tone}>{calib.text}</span></div>
                  ) : null}
                </>
              ) : ""}
              reason={`대조 완료 ${reviewed.length}건 / 최소 ${SAMPLE_MIN}건 필요`}
              good={hitGood}
            />
            <Metric
              label="머니테스트 payback 정확도 · 기둥①"
              ready={paybackReady}
              value={paybackReady ? pct(paybackHits / measuredMt.length) : ""}
              sub={paybackReady ? `실측 ${measuredMt.length}건 중 예측 ±25% 이내 ${paybackHits}건` : ""}
              reason={measuredMt.length === 0 ? "계측 불가(준비중) — 실측 payback 입력 경로 미구현" : `실측 완료 ${measuredMt.length}건 / 최소 ${SAMPLE_MIN}건 필요`}
              good={paybackReady && paybackHits / measuredMt.length >= 0.6}
            />
          </div>

          {/* 사람 리더십 축(기둥②) — 1인 단계면 접힘·정직 표기 */}
          {solo ? (
            <details className="panel panel-pad" style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                사람 리더십 지표 · 기둥② <span className="badge gray" style={{ marginLeft: 6 }}>1인 단계</span>
                <div className="tiny muted" style={{ marginTop: 4, fontWeight: 400 }}>{soloNote}</div>
              </summary>
              <div className="kv-grid" style={{ marginTop: 12 }}>
                <Metric
                  label="사람 위임 완결 · 기둥②(북극성)"
                  ready={handoffReady}
                  value={completed.length}
                  unit="건"
                  sub={handoffReady ? (
                    <>
                      <div>완료 위임 {peopleDoneAll.length}건 중 실권이양·무재작업 완결 (L1·권한없음 제외)</div>
                      <div>{handoffTrend ? handoffTrend.label : "추세 계측 불가(완결 6건 필요) · 위 값은 생애누적"}</div>
                    </>
                  ) : ""}
                  reason={soloNote}
                  good={handoffReady && completed.length > 0}
                />
                <Metric
                  label="위임수준 평균 · 기둥②"
                  ready={levelReady}
                  value={levelReady ? `L${(Math.round(avgCur * 10) / 10).toFixed(1)}` : ""}
                  sub={levelReady ? `목표 평균 L${(Math.round(avgTgt * 10) / 10).toFixed(1)} · 활성 팀원 ${active.length}명` : ""}
                  reason={soloNote}
                  good={levelReady && avgCur >= avgTgt && avgTgt > 0}
                />
              </div>
            </details>
          ) : (
            <div className="kv-grid" style={{ marginTop: 12 }}>
              <Metric
                label="사람 위임 완결 · 기둥②(북극성)"
                ready={handoffReady}
                value={completed.length}
                unit="건"
                sub={handoffReady ? (
                  <>
                    <div>완료 위임 {peopleDoneAll.length}건 중 실권이양·무재작업 완결 (L1·권한없음 제외)</div>
                    <div>{handoffTrend ? handoffTrend.label : "추세 계측 불가(완결 6건 필요) · 위 값은 생애누적"}</div>
                  </>
                ) : ""}
                reason="완료된 사람 위임과제가 아직 없음"
                good={handoffReady && completed.length > 0}
              />
              <Metric
                label="위임수준 평균 · 기둥②"
                ready={levelReady}
                value={levelReady ? `L${(Math.round(avgCur * 10) / 10).toFixed(1)}` : ""}
                sub={levelReady ? `목표 평균 L${(Math.round(avgTgt * 10) / 10).toFixed(1)} · 활성 팀원 ${active.length}명` : ""}
                reason="활성 팀원이 없음"
                good={levelReady && avgCur >= avgTgt && avgTgt > 0}
              />
            </div>
          )}

          <div className="tiny muted" style={{ marginTop: 12 }}>
            허영지표 차단: 기록 건수·streak 같은 활동량은 여기 넣지 않습니다. 표본이 쌓이기 전엔 그럴듯한 숫자 대신 '계측 불가'를 유지합니다.
          </div>
        </div>
      </div>

      {/* 역량 5축 현재/목표 */}
      <div className="section">
        <div className="section-title">역량 5축 — 현재 / 분기 목표</div>
        <div className="notice info" style={{ marginBottom: 12 }}>
          서비스기획·제품이 강점이라면 흔한 갭은 <b>사업·영업(Business)</b>과 <b>위임·조직(People)</b>입니다. 딜·머니테스트가 Business를, 위임과제·1:1·주간리뷰가 People을 겨냥합니다.
        </div>
        <div className="stack">
          {CAPABILITIES.map((c) => {
            const gap = c.id === "business" || c.id === "people";
            const { score, target } = capOf(c.id);
            const behind = target > score;
            return (
              <div key={c.id} className="panel panel-pad">
                <div className="between" style={{ marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{c.name} <span className="muted small">· {c.ko}</span> {gap ? <span className="badge amber" style={{ marginLeft: 4 }}>보완 갭</span> : null}</div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{c.note}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 18, whiteSpace: "nowrap" }}>
                    {score}<span className="muted small">/5</span>
                    {behind ? <span className="badge gray" style={{ marginLeft: 6 }}>목표 {target}</span> : <span className="badge green" style={{ marginLeft: 6 }}>목표 도달</span>}
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>현재 수준</label>
                  <div className="seg" style={{ width: "100%" }}>
                    {LEVELS.map((l) => (
                      <button key={l} className={score === l ? "on" : ""} style={{ flex: 1 }} onClick={() => setCapability(c.id, { score: l })}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>분기 목표</label>
                  <div className="seg" style={{ width: "100%" }}>
                    {LEVELS.map((l) => (
                      <button key={l} className={target === l ? "on" : ""} style={{ flex: 1 }} onClick={() => setCapability(c.id, { target: l })}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 역량 ↔ 결과 매핑 */}
      <div className="section">
        <div className="section-title">역량은 결과로 증명된다</div>
        <div className="panel panel-pad">
          <div className="stack" style={{ gap: 10 }}>
            <div className="between" style={{ gap: 12 }}>
              <div><b>Business·Sales</b> <span className="muted small">사업·영업</span></div>
              <div className="small muted" style={{ textAlign: "right" }}>→ 딜 수주 · 판단 적중률 · 머니테스트 정확도</div>
            </div>
            <div className="between" style={{ gap: 12 }}>
              <div><b>People</b> <span className="muted small">위임·조직</span></div>
              <div className="small muted" style={{ textAlign: "right" }}>→ 사람 위임 완결 · 위임수준 평균 · 1:1 이행</div>
            </div>
          </div>
          <div className="tiny muted" style={{ marginTop: 12 }}>자가진단 점수를 올리고 싶다면 위 결과지표를 움직이세요. 점수만 올리는 것은 허영입니다.</div>
        </div>
      </div>

      <div className="notice warn section">
        분기 재진단: 이번 분기 목표(위 슬라이더) 대비 결과지표가 얼마나 움직였는지로 재평가하세요. 스냅샷 적재·분기 추이 차트·12주 프로그램 히트맵은 다음 버전(v3)에서 — 지금은 빈 히트맵으로 죄책감을 만들지 않습니다.
      </div>
    </div>
  );
}
