import { useState } from "react";
import { useStore, upsertWeekly, currentWeekKey, DELEGATE_TYPES, delegateKind, uid } from "../lib/store.js";
import { weekLabel } from "../lib/format.js";
import { TrendChart } from "../components/Charts.jsx";

// 북극성 = 사람·조직 위임의 '완결' 건수(재작업 없이 상대가 끝까지 소유). AI·자동화는 별도 지표.
export function statsOf(w) {
  const s = (w.solvedSelf || []).length;
  const del = w.delegated || [];
  const people = del.filter((d) => delegateKind(d.delegateType) === "people");
  const peopleDone = people.filter((d) => d.done).length;
  const ax = del.filter((d) => delegateKind(d.delegateType) === "ax").length;
  return { s, peopleTotal: people.length, peopleDone, ax, smoothed: peopleDone / (s + 1) };
}

export default function Weekly() {
  const reviews = useStore((s) => s.weeklyReviews);
  const weekKey = currentWeekKey();
  const cur = reviews.find((w) => w.weekOf === weekKey) || { weekOf: weekKey, solvedSelf: [], delegated: [], nextDelegation: "" };

  const [solved, setSolved] = useState("");
  const [delText, setDelText] = useState("");
  const [delType, setDelType] = useState("person");

  function addSolved() {
    if (!solved.trim()) return;
    upsertWeekly(weekKey, { solvedSelf: [...(cur.solvedSelf || []), solved.trim()] });
    setSolved("");
  }
  function rmSolved(i) { upsertWeekly(weekKey, { solvedSelf: cur.solvedSelf.filter((_, x) => x !== i) }); }
  function addDelegated() {
    if (!delText.trim()) return;
    upsertWeekly(weekKey, { delegated: [...(cur.delegated || []), { id: uid(), text: delText.trim(), delegateType: delType, done: false }] });
    setDelText("");
  }
  function rmDelegated(i) { upsertWeekly(weekKey, { delegated: cur.delegated.filter((_, x) => x !== i) }); }
  function toggleDone(i) { upsertWeekly(weekKey, { delegated: cur.delegated.map((d, x) => (x === i ? { ...d, done: !d.done } : d)) }); }

  const st = statsOf(cur);
  const trend = [...reviews].sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1)).map((w) => ({ label: weekLabel(w.weekOf), value: statsOf(w).peopleDone }));
  const typeLabel = (t) => DELEGATE_TYPES.find((x) => x.id === t)?.label || t;

  return (
    <div>
      <div className="page-head">
        <h1>주간 자기리뷰</h1>
        <p className="sub">금요일 5분. 사람·조직에게 넘긴 일이 재작업 없이 '완결'되는 건수가 늘수록 리더에 가까워집니다.</p>
      </div>

      <div className="stat-row section">
        <div className="stat"><div className="k">북극성 — 사람 위임 완결</div><div className="v" style={{ color: "var(--green)" }}>{st.peopleDone}<small>건</small></div><div className="d">넘긴 {st.peopleTotal}건 중 완결 · 이번 주 {weekLabel(weekKey)}</div></div>
        <div className="stat"><div className="k">직접 푼 문제</div><div className="v">{st.s}<small>건</small></div><div className="d">내가 처리</div></div>
        <div className="stat"><div className="k">AX 레버리지</div><div className="v">{st.ax}<small>건</small></div><div className="d">AI·자동화(별도 지표)</div></div>
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
        <div className="section-title">남에게 넘긴 일 — 완결됐는지 체크</div>
        <div className="panel panel-pad">
          <div className="field" style={{ marginBottom: 10 }}>
            <input className="input" value={delText} placeholder="누구/무엇에게 넘겼나" onChange={(e) => setDelText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDelegated()} />
          </div>
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="tagset">
              {DELEGATE_TYPES.map((t) => (<button key={t.id} className={delType === t.id ? "on" : ""} onClick={() => setDelType(t.id)}>{t.label}</button>))}
            </div>
            <button className="btn btn-sm btn-primary" onClick={addDelegated}>추가</button>
          </div>
          {(cur.delegated || []).length === 0 ? <div className="muted small">아직 없습니다. 사람·조직 위임은 '완결'까지 체크해야 북극성에 잡힙니다. AI·외주(자동화)는 AX 레버리지로 따로 집계됩니다.</div> : (
            <div className="stack">
              {cur.delegated.map((it, i) => (
                <div key={it.id || i} className="li">
                  {delegateKind(it.delegateType) === "people" ? (
                    <button className={"chip"} style={{ cursor: "pointer", background: it.done ? "var(--green-bg)" : "var(--paper-3)", color: it.done ? "var(--green)" : "var(--muted)" }} onClick={() => toggleDone(i)} aria-pressed={it.done}>
                      {it.done ? "완결 ✓" : "완결 체크"}
                    </button>
                  ) : (<span className="chip">AX</span>)}
                  <div className="li-main"><div className="li-title">{it.text}</div></div>
                  <span className="chip">{typeLabel(it.delegateType)}</span>
                  <button className="x" onClick={() => rmDelegated(i)} aria-label="삭제">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">다음 주 위임 계획</div>
        <div className="panel panel-pad">
          <textarea className="textarea" value={cur.nextDelegation || ""} placeholder="다음 주에 내가 직접 하지 않고 넘길 일 하나" onChange={(e) => upsertWeekly(weekKey, { nextDelegation: e.target.value })} />
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
