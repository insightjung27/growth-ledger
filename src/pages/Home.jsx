import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, currentWeekKey, exportJSON, markBackup, hasRestorePoint, restorePrevious, clearRestorePoint } from "../lib/store.js";
import { pipelineWeighted, rottingOf, stageById } from "../lib/deal.js";
import { compute } from "../lib/money.js";
import { won, daysBetween, weekLabel, isoDate } from "../lib/format.js";
import { CAREER_NORTHSTAR, LEADER_RHYTHM } from "../lib/guidance.js";

// 대조(리뷰) 표본 임계 — 이 미만이면 결과신호를 '계측 불가'로 표기(허영지표 차단).
const REVIEW_SAMPLE = 3;
// 미대조 판단 하드 배너·소프트블록 임계(초과 시 발동).
const OVERDUE_LIMIT = 3;
// 위임과제 방치 기준(일).
const STALE_DAYS = 14;
// 격주 1:1 도래 기준(일) — 12일 이상 경과 또는 이력 없음이면 이번 주 개최 대상.
const ONE_ON_ONE_DUE_DAYS = 12;

const PRI = {
  1: { badge: "red", label: "지금" },
  2: { badge: "amber", label: "오늘" },
  3: { badge: "gray", label: "준비" },
};
const PILLAR_LABEL = { "1": "판단", "2": "사람" };

// 판단 프레임 등에 쓰는 균형 선택: 우선순위 유지하며 두 기둥을 번갈아.
function pickTop(items, n, balance) {
  const pool = [...items].sort((a, b) => a.priority - b.priority);
  const chosen = [];
  let last = null;
  while (chosen.length < n && pool.length) {
    const minP = pool[0].priority;
    const atMin = pool.filter((x) => x.priority === minP);
    let pick = atMin[0];
    if (balance && last) pick = atMin.find((x) => x.pillar !== last) || atMin[0];
    chosen.push(pick);
    pool.splice(pool.indexOf(pick), 1);
    last = pick.pillar;
  }
  return chosen;
}

function allEmpty(v) {
  return Object.values(v || {}).every((x) => !(x != null && String(x).trim()));
}
function meaningfulActions(list) {
  return (list || []).filter((a) => a && String(a.what || "").trim());
}

export default function Home() {
  const state = useStore();
  const nav = useNavigate();
  const [restorable, setRestorable] = useState(() => hasRestorePoint());
  function doBackup() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `성장원장-백업-${isoDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    markBackup();
  }
  function doRestore() { if (restorePrevious()) { setRestorable(false); alert("직전 상태로 되돌렸습니다."); } }
  function dismissRestore() { clearRestorePoint(); setRestorable(false); }
  const { deals, moneyTests, decisions, teamMembers, handoffs, oneOnOnes, quarterlyGoals, weeklyReviews, meta } = state;

  const now = new Date();
  // 하루 단위 재계산 트리거 — now(new Date())는 매 렌더 새 참조라 deps로 못 씀. ISO 날짜 문자열로 고정.
  const todayIso = isoDate(now);
  const isFriday = now.getDay() === 5;
  const weekKey = currentWeekKey();
  const activeMembers = useMemo(() => (teamMembers || []).filter((m) => m.active !== false), [teamMembers]);
  const hasTeam = activeMembers.length >= 1;

  // 이번 주 자기리뷰 작성 여부
  const weeklyDone = (weeklyReviews || []).some(
    (w) => w.weekOf === weekKey && ((w.solvedSelf || []).length || (w.delegated || []).length)
  );

  // ===== 신호(오늘 할 일) 자동도출 =====
  const { signals, overdueReviews } = useMemo(() => {
    const p1 = [], p2 = [], p3 = [];

    // --- 기둥① 판단 원장 ---
    const overdue = [];
    for (const d of decisions || []) {
      const title = d.title || "(제목 없음)";
      // P1: 대조 기한 도래(executing & reviewDate<=오늘) — 스누즈 불가 sticky
      if (d.status === "executing" && d.reviewDate && daysBetween(d.reviewDate, now) >= 0) {
        overdue.push(d);
        p1.push({ id: d.id, priority: 1, pillar: "1", sticky: true, text: `판단 "${title}" 대조 기한 도래 — 예측 vs 실제 확인`, to: "/decisions/" + d.id, cta: "대조하기" });
        continue;
      }
      // P2: 미실행 판단(status=decided & nextActions 없음/기한 경과)
      if (d.status === "decided") {
        const acts = meaningfulActions(d.nextActions);
        const overdueAct = acts.some((a) => !a.done && a.due && daysBetween(a.due, now) > 0);
        if (acts.length === 0) p2.push({ id: d.id, priority: 2, pillar: "1", text: `판단 "${title}" 결정만 하고 실행이 비었습니다 — 다음 행동·오너·기한`, to: "/decisions/" + d.id, cta: "실행 잡기" });
        else if (overdueAct) p2.push({ id: d.id, priority: 2, pillar: "1", text: `판단 "${title}" 다음 행동 기한이 지났습니다`, to: "/decisions/" + d.id, cta: "실행 점검" });
      }
    }

    // --- 기둥① 딜 ---
    for (const d of deals || []) {
      const name = d.name || "(무제)";
      const st = stageById(d.stageId);
      const isClosed = d.stageId === "won" || d.stageId === "lost";
      const rot = rottingOf(d, now);
      const dd = d.nextWhen ? daysBetween(d.nextWhen, now) : null;
      const dueSoon = dd != null && dd <= 0 && dd >= -2; // 향후 2일 내 마감
      // P2: 방치(red) 또는 마감 임박
      if (rot && rot.level === "red") p2.push({ id: d.id, priority: 2, pillar: "1", text: `딜 "${name}" ${rot.why} — 다음 행동 필요`, to: "/deals/" + d.id, cta: "딜 열기" });
      else if (dueSoon && !isClosed) p2.push({ id: d.id, priority: 2, pillar: "1", text: `딜 "${name}" 다음 행동 마감 임박(${d.nextWhen})`, to: "/deals/" + d.id, cta: "준비" });
      // P3: P&L(머니테스트) 미작성 — 제안 단계 이상
      if (!isClosed && st.prob >= 0.45 && !d.moneyTestId) p3.push({ id: d.id, priority: 3, pillar: "1", text: `딜 "${name}" P&L 미작성(${st.name}) — 남는 돈 확인`, to: "/deals/" + d.id, cta: "P&L 작성" });
      // P3: 준비 필요한 미팅 — 임박 & 고객질문 비어 있음
      if (!isClosed && dueSoon && allEmpty(d.customerQuestions)) p3.push({ id: d.id, priority: 3, pillar: "1", text: `미팅 준비 필요 — 딜 "${name}" 고객 질문 세트가 비어 있음`, to: "/deals/" + d.id, cta: "질문 준비" });
    }

    // --- 기둥① 머니테스트: 미대조(예측 회수 시점 경과 & 실측 없음) ---
    for (const m of moneyTests || []) {
      if (m.actualPayback != null) continue;
      let pm = null;
      let mode = null;
      try { const c = compute(m.inputs || {}); pm = c.payback; mode = c.mode; } catch (e) { pm = null; mode = null; }
      // earn 모드는 payback이 없어 '회수 대조' 신호가 성립하지 않음 — save 모드만 대조 대상.
      if (mode !== "save") continue;
      if (pm == null || !isFinite(pm) || pm <= 0) continue;
      const created = m.createdAt ? new Date(m.createdAt).getTime() : now.getTime();
      const dueAt = created + pm * 30.44 * 86400000;
      if (now.getTime() >= dueAt) {
        const nm = m.name || (m.inputs && m.inputs.name) || "(무제)";
        p3.push({ id: m.id, priority: 3, pillar: "1", text: `머니테스트 "${nm}" 예측 회수 시점 경과 — 실제 결과와 대조`, to: "/money-test/" + m.id, cta: "대조" });
      }
    }

    // --- 기둥② 사람·위임 (팀원 ≥ 1일 때만) ---
    if (activeMembers.length >= 1) {
      // P1: 이번 주 예정 1:1 미개최
      const dueMembers = activeMembers.filter((m) => {
        const dates = (oneOnOnes || []).filter((o) => o.memberId === m.id && o.date).map((o) => o.date).sort();
        const last = dates.length ? dates[dates.length - 1] : null;
        return !last || daysBetween(last, now) >= ONE_ON_ONE_DUE_DAYS;
      });
      if (dueMembers.length) {
        const names = dueMembers.map((m) => m.name || "이름없음").join(", ");
        p1.push({ id: "oo-due", priority: 1, pillar: "2", text: `이번 주 1:1 예정 미개최 — ${names}`, to: "/one-on-ones", cta: "1:1 열기" });
      }
      // P2: 위임과제 — 체크포인트 도달 미점검 / 막힘 / 방치
      for (const h of handoffs || []) {
        if (h.status === "done") continue;
        const title = h.title || "(무제)";
        const cpDue = (h.checkpoints || []).some((c) => c.reached && !c.reviewed);
        if (cpDue) { p2.push({ id: h.id, priority: 2, pillar: "2", text: `위임과제 "${title}" 체크포인트 도달 — 20/50/80 점검 필요`, to: "/handoffs/" + h.id, cta: "점검" }); continue; }
        if (h.status === "blocked") { p2.push({ id: h.id, priority: 2, pillar: "2", text: `위임과제 "${title}" 막힘 — 원인 해제 필요`, to: "/handoffs/" + h.id, cta: "열기" }); continue; }
        const stale = daysBetween(h.updatedAt, now);
        if (stale != null && stale > STALE_DAYS) p2.push({ id: h.id, priority: 2, pillar: "2", text: `위임과제 "${title}" ${stale}일 미갱신 — 진행 확인`, to: "/handoffs/" + h.id, cta: "열기" });
      }
      // P3: 분기목표 점검 도래(진행중 & 오래 미갱신)
      for (const g of quarterlyGoals || []) {
        if (g.status !== "진행중") continue;
        const stale = daysBetween(g.updatedAt, now);
        if (stale != null && stale > STALE_DAYS) p3.push({ id: g.id, priority: 3, pillar: "2", text: `분기목표 "${g.title || "(무제)"}" 점검 도래 — 현재값 갱신`, to: "/team", cta: "점검" });
      }
    }

    // 금요일이면 미작성 자기리뷰를 P1로 승격(주간이 정본 리듬)
    if (isFriday && !weeklyDone) p1.unshift({ id: "weekly-friday", priority: 1, pillar: "cross", sticky: true, text: "금요일 — 이번 주 자기리뷰가 비었습니다(직접 푼 일 vs 남이 해결하게 만든 일)", to: "/weekly", cta: "주간 리뷰" });

    // 엔티티당 1신호(가장 급한 우선순위)로 dedupe
    const seen = new Set();
    const merged = [];
    for (const s of [...p1, ...p2, ...p3]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
    return { signals: merged, overdueReviews: overdue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, moneyTests, decisions, handoffs, oneOnOnes, quarterlyGoals, activeMembers, weeklyDone, isFriday, todayIso]);

  const today = useMemo(() => pickTop(signals, 3, hasTeam), [signals, hasTeam]);
  const todayIds = new Set(today.map((t) => t.id));
  const rest = signals.filter((s) => !todayIds.has(s.id));
  const restP1 = rest.filter((s) => s.pillar === "1");
  const restP2 = rest.filter((s) => s.pillar === "2");
  const restCross = rest.filter((s) => s.pillar === "cross");

  // ===== 지표 타일 =====
  const weighted = useMemo(() => pipelineWeighted(deals || []), [deals]);
  const openDecisions = (decisions || []).filter((d) => d.status && d.status !== "reviewed").length;
  const reviewed = (decisions || []).filter((d) => d.status === "reviewed" && d.review && d.review.hit);
  const hits = reviewed.filter((d) => d.review.hit === "hit").length;
  const hitRateText = reviewed.length >= REVIEW_SAMPLE ? Math.round((hits / reviewed.length) * 100) + "%" : "계측 불가";
  const hitRateSub = reviewed.length >= REVIEW_SAMPLE ? `대조 ${reviewed.length}건 중 적중 ${hits}` : `표본 ${reviewed.length}/${REVIEW_SAMPLE} — 대조 더 쌓기`;
  // 캘리브레이션(과신 점검): 고확신인데 빗나감이면 과신 — 훈련해야 할 진짜 판단력 신호. 표본 미달이면 미표시(허영지표 차단).
  const highConf = reviewed.filter((d) => (d.prediction?.confidence || 0) >= 70);
  const highHit = highConf.filter((d) => d.review.hit === "hit").length;
  const calibText = highConf.length >= REVIEW_SAMPLE ? `고확신(70%+) ${highConf.length}건 중 적중 ${highHit} — 과신 점검` : "";
  // 사람위임 완결(북극성 분자): met & 그들이 해결 & 실권이양(L3+ 또는 authority 명시)
  const peopleDone = (handoffs || []).filter((h) => {
    const r = h.result || {};
    const realDelegation = (h.delegationLevel || 0) >= 3 || (h.authority && h.authority !== "해당없음" && String(h.authority).trim());
    return h.status === "done" && r.met === "met" && r.autonomy === "solved_by_them" && realDelegation;
  }).length;

  // ===== 배너/상태 =====
  const totalRecords = (deals || []).length + (moneyTests || []).length + (decisions || []).length + (teamMembers || []).length + (handoffs || []).length + (oneOnOnes || []).length + (weeklyReviews || []).length;
  const isEmpty = totalRecords === 0;
  const daysSinceBackup = meta && meta.lastBackupAt ? daysBetween(meta.lastBackupAt, now) : null;
  const showBackup = totalRecords > 0 && (daysSinceBackup == null || daysSinceBackup >= 7);
  const overdueCount = overdueReviews.length;
  const hardOverdue = overdueCount > OVERDUE_LIMIT;

  function Row({ item }) {
    const p = PRI[item.priority] || PRI[3];
    return (
      <button className="li" style={{ textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid var(--line-2)", cursor: "pointer", width: "100%" }} onClick={() => nav(item.to)}>
        <span className={"dot " + p.badge} style={{ marginTop: 7 }} />
        <div className="li-main">
          <div className="li-title" style={{ fontWeight: 600 }}>{item.text}</div>
          <div className="li-sub">{PILLAR_LABEL[item.pillar] || "리듬"} · {p.label}</div>
        </div>
        <span className="btn btn-sm">{item.cta}</span>
      </button>
    );
  }

  function Column({ title, items }) {
    return (
      <div>
        <div className="section-title">{title}</div>
        <div className="panel panel-pad">
          {items.length === 0 ? (
            <div className="muted small">이월된 항목이 없습니다.</div>
          ) : (
            <div className="stack">{items.map((it) => <Row key={it.id} item={it} />)}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div className="between" style={{ alignItems: "flex-end" }}>
          <div>
            <h1>오늘</h1>
            <p className="sub">두 기둥 — 판단을 검증·실행하고, 사람에게 맡긴 일을 점검합니다. 여는 데 30초.</p>
          </div>
          <div className="tiny muted" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{isoDate(now)}{isFriday ? " · 금요일" : ""}<br />이번 주 {weekLabel(weekKey)}</div>
        </div>
      </div>

      {restorable && (
        <div className="notice info section between" style={{ alignItems: "center" }}>
          <span>방금 <b>덮어쓰기 또는 초기화</b>를 되돌릴 수 있습니다. 잘못 불러왔다면 직전 상태로 복구하세요.</span>
          <span className="gap-wrap" style={{ flex: "0 0 auto" }}>
            <button className="btn btn-sm btn-primary" onClick={doRestore}>되돌리기</button>
            <button className="btn btn-sm btn-ghost" onClick={dismissRestore}>닫기</button>
          </span>
        </div>
      )}

      {hardOverdue && (
        <div className="notice warn section">
          <b>미대조 판단 {overdueCount}건</b> — 대조 기한이 지난 판단이 {OVERDUE_LIMIT}건을 넘었습니다. 대조 루프가 닫히지 않으면 판단력 주장이 무너집니다. 신규 판단보다 먼저 밀린 대조부터 권합니다 — <b>판단 원장</b>에서 예측 vs 실제를 대조하세요.
          <div style={{ marginTop: 8 }}><button className="btn btn-sm btn-primary" onClick={() => nav("/decisions")}>판단 원장 열기</button></div>
        </div>
      )}

      {showBackup && (
        <div className="notice warn section between" style={{ alignItems: "center" }}>
          <span>{daysSinceBackup == null ? "아직 백업한 적이 없습니다. 데이터는 이 브라우저에만 있습니다." : `마지막 백업 ${daysSinceBackup}일 전.`} 지금 백업하세요. · iOS Safari는 오래 안 열면 저장 데이터를 지울 수 있어 정기 백업이 필요합니다.</span>
          <button className="btn btn-sm btn-primary" style={{ flex: "0 0 auto" }} onClick={doBackup}>지금 내보내기</button>
        </div>
      )}

      {isEmpty && (
        <div className="panel empty section">
          <div className="em-ic">🌱</div>
          <h3>성장원장을 시작해 보세요</h3>
          <p>가장 좋은 첫 걸음은 둘 중 하나입니다: 머릿속의 "이거 돈 될까"를 <b>머니테스트</b>로 돌려보거나, 지금 고민 중인 사업 판단 하나를 <b>판단 원장</b>에 기록하는 것.</p>
          <div className="gap-wrap" style={{ justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => nav("/money-test")}>머니테스트 하기</button>
            <button className="btn" onClick={() => nav("/decisions")}>판단 기록하기</button>
          </div>
        </div>
      )}

      {/* ===== 지표 타일 — 결과신호 우선 ===== */}
      {!isEmpty && (
        <div className="stat-row section">
          <div className="stat"><div className="k">대조 적중률</div><div className="v">{hitRateText}</div><div className="d">{hitRateSub}{calibText ? <><br />{calibText}</> : null}</div></div>
          {hasTeam ? (
            <div className="stat"><div className="k">사람 위임 완결</div><div className="v" style={{ color: "var(--green)" }}>{peopleDone}<small>건</small></div><div className="d">실권이양(L3+/권한 명시)만 · 북극성</div></div>
          ) : (
            <div className="stat"><div className="k">사람 위임 완결</div><div className="v" style={{ color: "var(--muted-2)" }}>—</div><div className="d">팀원 추가하면 열림</div></div>
          )}
          <div className="stat"><div className="k">가중 파이프라인</div><div className="v">{won(weighted)}</div><div className="d">열린 딜 {(deals || []).filter((d) => d.stageId !== "lost" && d.stageId !== "won").length}건</div></div>
        </div>
      )}

      {/* ===== 오늘 할 일 큐 ===== */}
      {!isEmpty && (
        <div className="section">
          <div className="section-title">오늘 할 일 {today.length > 0 ? `(최대 3)` : ""}</div>
          {today.length === 0 ? (
            <div className="panel panel-pad between" style={{ alignItems: "center" }}>
              <div className="li-title" style={{ minWidth: 0 }}>오늘 급한 건 없어요. 이번 주 리듬을 점검하세요 — 자기리뷰·1:1·대조.</div>
              <button className="btn btn-sm btn-primary" onClick={() => nav("/weekly")}>주간 리듬</button>
            </div>
          ) : (
            <div className="stack">
              {today.map((it) => {
                const p = PRI[it.priority] || PRI[3];
                return (
                  <div key={it.id} className="panel panel-pad between" style={{ alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span className={"badge " + p.badge} style={{ flex: "0 0 auto" }}>{p.label}{it.sticky ? " · 고정" : ""}</span>
                      <div>
                        <div className="li-title">{it.text}</div>
                        <div className="li-sub">{PILLAR_LABEL[it.pillar] || "리듬"}</div>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-primary" style={{ flex: "0 0 auto" }} onClick={() => nav(it.to)}>{it.cta}</button>
                  </div>
                );
              })}
              {rest.length > 0 && <div className="tiny muted">이월 {rest.length}건 — 아래 기둥별 목록에서 이어서 처리하세요.</div>}
            </div>
          )}
        </div>
      )}

      {/* ===== 기둥 컬럼(이월) ===== */}
      {!isEmpty && (restP1.length + restP2.length + restCross.length > 0) && (
        hasTeam ? (
          <div className="section row2">
            <Column title="기둥① 판단 — 이월" items={[...restP1, ...restCross]} />
            <Column title="기둥② 사람 — 이월" items={restP2} />
          </div>
        ) : (
          <div className="section">
            <Column title="기둥① 판단 — 이월" items={[...restP1, ...restCross]} />
          </div>
        )
      )}

      {/* ===== 빠른 이동 ===== */}
      {!isEmpty && (
        <div className="section quick-grid">
          <button className="quick" onClick={() => nav("/decisions")}><span className="q-ic">⚖️</span> 판단 기록 <span className="q-sub">기둥① 원장</span></button>
          <button className="quick" onClick={() => nav("/money-test")}><span className="q-ic">💰</span> 머니테스트 <span className="q-sub">돈 프레임</span></button>
          <button className="quick" onClick={() => nav("/weekly")}><span className="q-ic">🧭</span> 주간 리뷰 <span className="q-sub">북극성</span></button>
        </div>
      )}

      {/* ===== R4 코칭 지침 — 기본 닫힘 ===== */}
      <div className="section">
        <details className="panel">
          <summary style={{ cursor: "pointer", padding: "14px 16px", fontWeight: 700 }}>운영 원칙 보기</summary>
          <div style={{ padding: "0 16px 16px" }}>
            <div className="notice info">
              <b>리더 운영 리듬</b> — {LEADER_RHYTHM.join(" · ")}. 홈은 <b>일</b> 단위 급한 일을 뽑고, <b>주(금요 자기리뷰)</b>가 정본 리듬입니다. 대조 기한 도래는 판단 원장 전체의 가치를 여는 최우선 신호라 스누즈되지 않습니다.
            </div>
            <div className="notice info" style={{ marginTop: 12 }}>
              <b>북극성 — {CAREER_NORTHSTAR.title}</b><br />
              {CAREER_NORTHSTAR.line}. 홈 상단 결과신호는 "기록 몇 건"이 아니라 <b>대조 적중</b>·<b>사람 위임 완결</b>입니다 — 내가 없어도 팀이 결과를 만드는지를 봅니다. 표본이 부족하면 숫자 대신 "계측 불가"로 정직하게 멈춥니다.
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
