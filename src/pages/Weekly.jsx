import { useState } from "react";
import {
  useStore, upsertWeekly, currentWeekKey,
  DELEGATE_TYPES, delegateKind, uid,
} from "../lib/store.js";
import { weekLabel, isoDate, relDate } from "../lib/format.js";
import { TrendChart } from "../components/Charts.jsx";
import AutoSaved from "../components/AutoSaved.jsx";

// 북극성 = 사람·조직 위임의 '완결' 건수(재작업 없이 상대가 끝까지 소유). AI·자동화는 별도 지표.
export function statsOf(w) {
  const s = (w.solvedSelf || []).length;
  const del = w.delegated || [];
  const people = del.filter((d) => delegateKind(d.delegateType) === "people");
  const peopleDone = people.filter((d) => d.done).length;
  const ax = del.filter((d) => delegateKind(d.delegateType) === "ax").length;
  return { s, peopleTotal: people.length, peopleDone, ax, smoothed: peopleDone / (s + 1) };
}

// weekOf(월요일 키) 기준 한 주 범위 [start, end). 날짜/타임스탬프 모두 앞 10자리 문자열로 비교.
function weekRange(weekOf) {
  const start = new Date(weekOf + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startKey: weekOf, endKey: isoDate(end) };
}
function inWeek(iso, range) {
  if (!iso) return false;
  const key = String(iso).slice(0, 10);
  return key >= range.startKey && key < range.endKey;
}
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

export default function Weekly() {
  const reviews = useStore((s) => s.weeklyReviews);
  const decisions = useStore((s) => s.decisions);
  const deals = useStore((s) => s.deals);
  const handoffs = useStore((s) => s.handoffs);
  const oneOnOnes = useStore((s) => s.oneOnOnes);
  const hasTeam = useStore((s) => s.teamMembers.length > 0);

  const [viewWeek, setViewWeek] = useState(currentWeekKey());
  const weekKey = viewWeek;
  const isThisWeek = weekKey === currentWeekKey();
  const cur = reviews.find((w) => w.weekOf === weekKey) || { weekOf: weekKey, solvedSelf: [], delegated: [], nextDelegation: "", pillarSnapshot: null };

  const [solved, setSolved] = useState("");
  const [delText, setDelText] = useState("");
  const [delType, setDelType] = useState("person");

  // 실시간 자동요약(동결 전 미리보기) vs 동결본
  const liveSnap = computePillarSnapshot(weekKey, { decisions, deals, handoffs, oneOnOnes });
  const frozen = cur.pillarSnapshot || null;
  const shownSnap = frozen || liveSnap;
  const snapTotal = SNAP_LABELS.reduce((a, x) => a + (shownSnap[x.key] || 0), 0);

  function addSolved() {
    if (!solved.trim()) return;
    upsertWeekly(weekKey, { solvedSelf: [...(cur.solvedSelf || []), solved.trim()] });
    setSolved("");
  }
  function rmSolved(i) { if (!confirm("이 항목을 삭제할까요? 되돌릴 수 없습니다.")) return; upsertWeekly(weekKey, { solvedSelf: (cur.solvedSelf || []).filter((_, x) => x !== i) }); }
  function addDelegated() {
    if (!delText.trim()) return;
    upsertWeekly(weekKey, { delegated: [...(cur.delegated || []), { id: uid(), text: delText.trim(), delegateType: delType, done: false, handoffId: null }] });
    setDelText("");
  }
  function rmDelegated(i) { if (!confirm("이 위임 항목을 삭제할까요? 되돌릴 수 없습니다.")) return; upsertWeekly(weekKey, { delegated: (cur.delegated || []).filter((_, x) => x !== i) }); }
  function toggleDone(i) { upsertWeekly(weekKey, { delegated: (cur.delegated || []).map((d, x) => (x === i ? { ...d, done: !d.done } : d)) }); }

  function freezeSnapshot() {
    // 이번 주 마감 — 자동요약을 동결(회계 마감). 재마감 허용(값 갱신).
    upsertWeekly(weekKey, { pillarSnapshot: { ...liveSnap, frozenAt: new Date().toISOString() } });
  }
  function unfreeze() { upsertWeekly(weekKey, { pillarSnapshot: null }); }

  const st = statsOf(cur);
  const trend = [...reviews]
    .filter((w) => (w.solvedSelf || []).length || (w.delegated || []).length)
    .sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1))
    .map((w) => ({ label: weekLabel(w.weekOf), value: statsOf(w).peopleDone }));
  const typeLabel = (t) => DELEGATE_TYPES.find((x) => x.id === t)?.label || t;

  // 주 이동 — 달력 기준 ±7일(월요일). 기록 유무와 무관, 빈 주면 그 주를 새로 연다.
  const prevWeek = shiftWeek(weekKey, -7);
  const nextWeek = shiftWeek(weekKey, 7);

  // 위임 목록: 미완결 위 · 완결 아래(원래 순서 유지, 원본 인덱스 보존)
  const delegatedSorted = (cur.delegated || [])
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (a.it.done === b.it.done ? 0 : a.it.done ? 1 : -1));

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

      {/* 3스탯: 결과신호 전면 */}
      <div className="stat-row section">
        <div className="stat"><div className="k">사람 위임 완결 · 회고 표시</div><div className="v" style={{ color: "var(--ink-2)" }}>{st.peopleDone}<small>건</small></div><div className="d">이 주 체크 기준(비검증) · 정식 북극성은 홈에서 실권이양(L3+/권한명시) 게이트로 계산</div></div>
        <div className="stat"><div className="k">직접 푼 문제</div><div className="v">{st.s}<small>건</small></div><div className="d">내가 처리</div></div>
        <div className="stat"><div className="k">AX 레버리지</div><div className="v">{st.ax}<small>건</small></div><div className="d">AI·자동화(별도 분모)</div></div>
      </div>

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

      <div className="section">
        <div className="section-title">남이 해결하게 만든 일 — 완결됐는지 체크</div>
        <div className="panel panel-pad">
          <div className="field" style={{ marginBottom: 10 }}>
            <input className="input" value={delText} placeholder="누구/무엇에게 넘겼나" onChange={(e) => setDelText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDelegated()} />
          </div>
          <div className="between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="tagset">
              {DELEGATE_TYPES.map((t) => (<button key={t.id} className={delType === t.id ? "on" : ""} onClick={() => setDelType(t.id)}>{t.label}</button>))}
            </div>
            <button className="btn btn-sm btn-primary" onClick={addDelegated}>추가</button>
          </div>
          {(cur.delegated || []).length === 0 ? <div className="muted small">아직 없습니다. 사람·조직 위임(사람·외주)은 '완결'까지 체크해야 북극성에 잡힙니다. AI·자동화는 AX 레버리지로 따로 집계됩니다.</div> : (
            <div className="stack">
              {delegatedSorted.map(({ it, i }) => (
                <div key={it.id || i} className="li">
                  {delegateKind(it.delegateType) === "people" ? (
                    <button className={"chip"} style={{ cursor: "pointer", background: it.done ? "var(--green-bg)" : "var(--paper-3)", color: it.done ? "var(--green)" : "var(--muted)" }} onClick={() => toggleDone(i)} aria-pressed={it.done}>
                      {it.done ? "완결 ✓" : "완결로 표시"}
                    </button>
                  ) : (<span className="chip">AX</span>)}
                  <div className="li-main"><div className="li-title">{it.text}</div>{it.handoffId ? <div className="li-sub">위임과제 연결됨</div> : null}</div>
                  <span className="chip">{typeLabel(it.delegateType)}</span>
                  <button className="x" onClick={() => rmDelegated(i)} aria-label="삭제">×</button>
                </div>
              ))}
            </div>
          )}
          {hasTeam ? <div className="tiny muted" style={{ marginTop: 10 }}>정식 위임과제로 관리 중이라면 위임과제 화면에서 6요소·20/50/80 점검으로 다루세요. 여기 회고는 이중입력을 피해 요약만.</div> : null}
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
          <div className="tiny muted" style={{ marginTop: 8 }}>"내가 없어도 굴러가는" 리더로의 전환 측정점입니다. AI·자동화 사용(AX)은 별도로 봅니다.</div>
        </div>
      </div>
    </div>
  );
}
