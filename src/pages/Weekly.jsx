import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useStore, upsertWeekly, currentWeekKey,
  DELEGATE_TYPES, handoffRollupOfWeek, isCompletedHandoff, weekRange, inWeek,
} from "../lib/store.js";
import { weekLabel, isoDate, relDate, weekMonday } from "../lib/format.js";
import { TrendChart } from "../components/Charts.jsx";
import AutoSaved from "../components/AutoSaved.jsx";

// 월요일 키를 달력 기준 ±deltaDays 이동(기록 유무와 무관).
function shiftWeek(weekOf, deltaDays) {
  const d = new Date(weekOf + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return isoDate(d);
}

// 두 기둥 이번주 활동 자동요약(회계 마감 원리). 저장 시 이 값을 동결한다.
export function computePillarSnapshot(weekOf, { decisions, deals, handoffs, oneOnOnes }) {
  const r = weekRange(weekOf);
  const decisionsLogged = (decisions || []).filter((d) => inWeek(d.createdAt, r)).length;
  const decisionsExecuted = (decisions || []).filter((d) => inWeek(d.decidedAt, r)).length;
  const predictionsChecked = (decisions || []).filter((d) => inWeek(d.reviewedAt, r)).length;
  const dealsAdvanced = (deals || []).filter((d) => inWeek(d.updatedAt, r)).length;
  let handoffsChecked = 0;
  (handoffs || []).forEach((h) => {
    (h.checkpoints || []).forEach((c) => { if (c.reviewed && inWeek(c.reviewedAt, r)) handoffsChecked += 1; });
  });
  const oneOnOnesHeld = (oneOnOnes || []).filter((o) => inWeek(o.date, r)).length;
  return { decisionsLogged, decisionsExecuted, predictionsChecked, dealsAdvanced, handoffsChecked, oneOnOnesHeld };
}

const SNAP_LABELS = [
  { key: "decisionsLogged", label: "판단 기록", pillar: "①" },
  { key: "decisionsExecuted", label: "판단 실행", pillar: "①" },
  { key: "predictionsChecked", label: "예측 대조", pillar: "①" },
  { key: "dealsAdvanced", label: "딜 진전", pillar: "①" },
  { key: "handoffsChecked", label: "위임 점검", pillar: "②" },
  { key: "oneOnOnesHeld", label: "1:1 개최", pillar: "②" },
];

const HO_STATUS = { assigned: { label: "진행", cls: "gray" }, blocked: { label: "막힘", cls: "amber" }, done: { label: "완료", cls: "green" } };
const typeLabel = (t) => DELEGATE_TYPES.find((x) => x.id === t)?.label || t;

export default function Weekly() {
  const reviews = useStore((s) => s.weeklyReviews);
  const decisions = useStore((s) => s.decisions);
  const deals = useStore((s) => s.deals);
  const handoffs = useStore((s) => s.handoffs);
  const oneOnOnes = useStore((s) => s.oneOnOnes);
  const members = useStore((s) => s.teamMembers);

  const [viewWeek, setViewWeek] = useState(currentWeekKey());
  const weekKey = viewWeek;
  const isThisWeek = weekKey === currentWeekKey();
  const cur = reviews.find((w) => w.weekOf === weekKey) || { weekOf: weekKey, solvedSelf: [], delegated: [], nextDelegation: "", pillarSnapshot: null };

  const [solved, setSolved] = useState("");

  // 실시간 자동요약(동결 전 미리보기) vs 동결본
  const liveSnap = computePillarSnapshot(weekKey, { decisions, deals, handoffs, oneOnOnes });
  const frozen = cur.pillarSnapshot || null;
  const shownSnap = frozen || liveSnap;
  const snapTotal = SNAP_LABELS.reduce((a, x) => a + (shownSnap[x.key] || 0), 0);

  // ★위임 = 수기 입력이 아니라 위임과제(handoffs) 원장에서 자동 롤업(이중입력 제거)
  const rollup = handoffRollupOfWeek(weekKey, handoffs);
  const memberName = (id) => (members.find((m) => m.id === id)?.name) || "";

  function addSolved() {
    if (!solved.trim()) return;
    upsertWeekly(weekKey, { solvedSelf: [...(cur.solvedSelf || []), solved.trim()] });
    setSolved("");
  }
  function rmSolved(i) { if (!confirm("이 항목을 삭제할까요? 되돌릴 수 없습니다.")) return; upsertWeekly(weekKey, { solvedSelf: (cur.solvedSelf || []).filter((_, x) => x !== i) }); }

  function freezeSnapshot() {
    upsertWeekly(weekKey, { pillarSnapshot: { ...liveSnap, frozenAt: new Date().toISOString() } });
  }
  function unfreeze() { upsertWeekly(weekKey, { pillarSnapshot: null }); }

  // 사람 위임 완결 추세 — 완결된 handoffs를 completedAt의 '완결주'로 그룹핑(weeklyReview 유무와 독립)
  const byWeek = {};
  (handoffs || []).filter(isCompletedHandoff).forEach((h) => {
    if (!h.completedAt) return;
    const wk = weekMonday(new Date(String(h.completedAt).slice(0, 10) + "T00:00:00"));
    byWeek[wk] = (byWeek[wk] || 0) + 1;
  });
  const trend = Object.keys(byWeek).sort().map((wk) => ({ label: weekLabel(wk), value: byWeek[wk] }));

  const prevWeek = shiftWeek(weekKey, -7);
  const nextWeek = shiftWeek(weekKey, 7);

  function HandoffRow({ h, badge }) {
    return (
      <Link to={"/handoffs/" + h.id} className="li" style={{ textDecoration: "none" }}>
        {badge}
        <div className="li-main"><div className="li-title">{h.title || "(무제)"}</div>{memberName(h.assigneeId) ? <div className="li-sub">{memberName(h.assigneeId)}</div> : null}</div>
        <span className="chip">{typeLabel(h.delegateType)}</span>
      </Link>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div className="between">
          <div style={{ minWidth: 0 }}>
            <h1>주간 자기리뷰</h1>
            <p className="sub">금요일 5분. 사람·조직에게 넘긴 일이 재작업 없이 '완결'되는 건수가 늘수록 리더에 가까워집니다. 이 화면이 앱의 단일 정본 리듬입니다.</p>
          </div>
        </div>
      </div>

      {/* 주 이동 — 달력 ±7일 기준 */}
      <div className="section">
        <div className="between panel panel-pad" style={{ padding: "12px 16px" }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setViewWeek(prevWeek)}>← 지난 주</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>{weekLabel(weekKey)}</div>
            <div className="tiny muted">{isThisWeek ? "이번 주" : "과거 주 조회 · 수정 가능"}{frozen ? " · 요약 동결됨" : ""}</div>
            {isThisWeek ? null : (
              <button onClick={() => setViewWeek(currentWeekKey())} className="tiny" style={{ marginTop: 4, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", textDecoration: "underline", padding: 0 }}>이번 주로</button>
            )}
          </div>
          <button className="btn btn-sm btn-ghost" disabled={isThisWeek} onClick={() => setViewWeek(nextWeek)}>다음 주 →</button>
        </div>
      </div>

      <div className="notice info section">
        코칭 원칙 — 매주 금요일: "내가 직접 해결한 문제"보다 "다른 사람이 해결하게 만든 문제"가 몇 개인지 봅니다. 사람·조직 위임의 완결이 북극성이고, AI·자동화(AX)는 레버리지로 <b>따로</b> 셉니다. 실전 훈련(12주): 매주 고객미팅1·문제인터뷰1·제안서1·P&amp;L1·협상복기1 — 책 10권보다 실전 10번.
      </div>

      {/* 두 기둥 자동요약(pillarSnapshot) */}
      <div className="section">
        <div className="section-title">두 기둥 이번주 자동요약 {frozen ? "· 동결본" : "· 실시간(저장 시 동결)"}</div>
        <div className="panel panel-pad">
          {snapTotal === 0 ? (
            <div className="notice warn" style={{ marginBottom: 12 }}>이번 주 두 기둥 활동이 아직 0건입니다. 판단을 기록·대조하거나 딜을 진전시키거나 1:1을 열면 여기에 자동 집계됩니다. (회고는 활동이 아니라 <b>결과</b>를 봅니다)</div>
          ) : null}
          <div className="kv-grid">
            {SNAP_LABELS.map((x) => {
              const v = shownSnap[x.key] || 0;
              return (
                <div className="kv" key={x.key}>
                  <div className="k">기둥{x.pillar} · {x.label}</div>
                  <div className="v" style={{ color: v > 0 ? "var(--ink)" : "var(--muted-2)" }}>{v}<small className="muted"> 건</small></div>
                </div>
              );
            })}
          </div>
          <div className="between" style={{ marginTop: 14, flexWrap: "wrap", gap: 10 }}>
            <div className="tiny muted">
              {frozen
                ? `마감 시점(${relDate(frozen.frozenAt)}) 값으로 고정했습니다. 필요하면 아래에서 해제해 다시 마감할 수 있습니다.`
                : "저장(동결) 전까지는 실시간 값입니다. 주를 마감하면 그 시점 값으로 고정됩니다."}
            </div>
            {frozen ? (
              <button className="btn btn-sm btn-ghost" onClick={unfreeze}>동결 해제</button>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={freezeSnapshot}>요약 숫자 동결</button>
            )}
          </div>
        </div>
      </div>

      {/* 3스탯: 결과신호 전면 — 위임완결은 handoffs 자동집계(검증된 북극성) */}
      <div className="stat-row section">
        <div className="stat"><div className="k">사람 위임 완결 · 북극성</div><div className="v" style={{ color: rollup.peopleDone > 0 ? "var(--green)" : "var(--ink)" }}>{rollup.peopleDone}<small>건</small></div><div className="d">이번 주 완결 · 실권이양(L3+/권한명시)·무재작업만 · 위임과제 자동집계</div></div>
        <div className="stat"><div className="k">직접 푼 문제</div><div className="v">{(cur.solvedSelf || []).length}<small>건</small></div><div className="d">내가 처리</div></div>
        <div className="stat"><div className="k">AX 레버리지</div><div className="v">{rollup.ax}<small>건</small></div><div className="d">AI·자동화(별도 분모)</div></div>
      </div>

      {/* 내가 직접 푼 문제 — 수기(다른 원장 없음) */}
      <div className="section">
        <div className="section-title">내가 직접 푼 문제</div>
        <div className="panel panel-pad">
          <div className="between" style={{ gap: 8, marginBottom: 12 }}>
            <input className="input" value={solved} placeholder="이번 주 내가 직접 처리한 일" onChange={(e) => setSolved(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSolved()} />
            <button className="btn btn-primary btn-sm" onClick={addSolved}>추가</button>
          </div>
          {(cur.solvedSelf || []).length === 0 ? <div className="muted small">아직 없습니다.</div> : (
            <div className="stack">
              {cur.solvedSelf.map((t, i) => (
                <div key={i} className="li"><div className="li-main"><div className="li-title">{t}</div></div><button className="x" onClick={() => rmSolved(i)} aria-label="삭제">×</button></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 남이 해결하게 만든 일 — 위임과제 자동 집계(이중입력 제거) */}
      <div className="section">
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>남이 해결하게 만든 일 — 위임과제 자동 집계</div>
          <Link to="/handoffs" className="btn btn-sm">위임과제 열기</Link>
        </div>
        <div className="panel panel-pad">
          {(handoffs || []).length === 0 ? (
            <div className="empty" style={{ padding: "24px 12px" }}>
              <div className="em-ic">🤝</div>
              <h3>아직 위임과제가 없습니다</h3>
              <p>넘긴 일은 위임과제 원장에서 6요소·20/50/80으로 관리하세요. 이 주간 회고는 그걸 자동으로 집계만 합니다(이중입력 없음).</p>
              <Link to="/handoffs" className="btn btn-primary">위임과제로 이동</Link>
            </div>
          ) : (
            <>
              <div className="section-title" style={{ marginTop: 0 }}>이번 주 완결 · 북극성</div>
              {rollup.peopleCompleted.length === 0 ? (
                <div className="muted small">이번 주 완결된 사람 위임이 없습니다.</div>
              ) : (
                <div className="stack">
                  {rollup.peopleCompleted.map((h) => (
                    <HandoffRow key={h.id} h={h} badge={<span className="chip" style={{ background: "var(--green-bg)", color: "var(--green)", flex: "0 0 auto" }}>완결 ✓</span>} />
                  ))}
                </div>
              )}

              <div className="section-title" style={{ marginTop: 16 }}>이번 주 넘긴 일</div>
              {rollup.peopleHandedOffList.length === 0 ? (
                <div className="muted small">이번 주 새로 넘긴 일이 없습니다.</div>
              ) : (
                <div className="stack">
                  {rollup.peopleHandedOffList.map((h) => {
                    const st = HO_STATUS[h.status] || HO_STATUS.assigned;
                    return <HandoffRow key={h.id} h={h} badge={<span className={"badge " + st.cls} style={{ flex: "0 0 auto" }}>{st.label}</span>} />;
                  })}
                </div>
              )}

              {rollup.axList.length > 0 && (
                <details style={{ marginTop: 16 }}>
                  <summary className="tiny muted" style={{ cursor: "pointer", fontWeight: 700 }}>AX 레버리지 {rollup.ax}건 (AI·자동화 · 별도 분모)</summary>
                  <div className="stack" style={{ marginTop: 8 }}>
                    {rollup.axList.map((h) => (
                      <HandoffRow key={h.id} h={h} badge={<span className="chip" style={{ flex: "0 0 auto" }}>AX</span>} />
                    ))}
                  </div>
                </details>
              )}

              {rollup.undatedDone > 0 && (
                <div className="notice warn" style={{ marginTop: 12 }}>완결일 미기록 {rollup.undatedDone}건은 주간 집계에서 제외됩니다. 위임과제에서 완결 처리하면 반영됩니다.</div>
              )}

              <div className="tiny muted" style={{ marginTop: 12 }}>여기서는 입력하지 않습니다 — 넘길 일은 <Link to="/handoffs" style={{ color: "var(--accent)", fontWeight: 700 }}>위임과제</Link>에서 추가·관리하고, 주간 회고는 자동 집계만 합니다(이중입력 제거).</div>
            </>
          )}

          {(cur.delegated || []).length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary className="tiny muted" style={{ cursor: "pointer" }}>이전 수기 기록 {cur.delegated.length}건 (더 이상 집계에 반영되지 않음)</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                {cur.delegated.map((it, i) => (
                  <div key={it.id || i} className="li"><div className="li-main"><div className="li-title">{it.text}</div><div className="li-sub">{typeLabel(it.delegateType)}{it.done ? " · 완결(수기)" : ""}</div></div></div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">다음 주 위임 계획</div>
        <div className="panel panel-pad">
          <textarea className="textarea" value={cur.nextDelegation || ""} placeholder="다음 주에 내가 직접 하지 않고 넘길 일 하나" onChange={(e) => upsertWeekly(weekKey, { nextDelegation: e.target.value })} />
          <div style={{ marginTop: 6 }}><AutoSaved at={cur.updatedAt} /></div>
          <div className="tiny muted" style={{ marginTop: 8 }}>에이스는 붙잡지 말고 더 큰 문제로: 업무 → 프로젝트 → 영역 → 결정권 → 사람.</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">사람 위임 완결 추세</div>
        <div className="panel panel-pad">
          <TrendChart series={trend} />
          <div className="tiny muted" style={{ marginTop: 8 }}>완결된 위임과제를 완결 주 기준으로 집계합니다. "내가 없어도 굴러가는" 리더로의 전환 측정점 — AI·자동화(AX)는 별도로 봅니다.</div>
        </div>
      </div>
    </div>
  );
}
