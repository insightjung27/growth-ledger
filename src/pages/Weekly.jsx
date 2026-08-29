import { useState } from "react";
import { useStore, upsertWeekly, currentWeekKey, DELEGATE_TYPES, uid } from "../lib/store.js";
import { weekLabel, weekMonday } from "../lib/format.js";
import { TrendChart } from "../components/Charts.jsx";

function ratioOf(w) {
  const s = (w.solvedSelf || []).length;
  const d = (w.delegated || []).length;
  return { s, d, ratio: s === 0 ? (d > 0 ? d : 0) : d / s };
}

export default function Weekly() {
  const reviews = useStore((s) => s.weeklyReviews);
  const weekKey = currentWeekKey();
  const cur = reviews.find((w) => w.weekOf === weekKey) || { weekOf: weekKey, solvedSelf: [], delegated: [], nextDelegation: "" };

  const [solved, setSolved] = useState("");
  const [delText, setDelText] = useState("");
  const [delType, setDelType] = useState("ai");

  function addSolved() {
    if (!solved.trim()) return;
    upsertWeekly(weekKey, { solvedSelf: [...(cur.solvedSelf || []), solved.trim()] });
    setSolved("");
  }
  function rmSolved(i) {
    upsertWeekly(weekKey, { solvedSelf: cur.solvedSelf.filter((_, x) => x !== i) });
  }
  function addDelegated() {
    if (!delText.trim()) return;
    upsertWeekly(weekKey, { delegated: [...(cur.delegated || []), { id: uid(), text: delText.trim(), delegateType: delType }] });
    setDelText("");
  }
  function rmDelegated(i) {
    upsertWeekly(weekKey, { delegated: cur.delegated.filter((_, x) => x !== i) });
  }

  const { s, d, ratio } = ratioOf(cur);
  const trend = [...reviews]
    .sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1))
    .map((w) => ({ label: weekLabel(w.weekOf), value: Math.round(ratioOf(w).ratio * 100) / 100 }));
  const typeLabel = (t) => DELEGATE_TYPES.find((x) => x.id === t)?.label || t;

  return (
    <div>
      <div className="page-head">
        <h1>주간 자기리뷰</h1>
        <p className="sub">금요일 5분. 내가 직접 푼 문제보다 남이 풀게 만든 문제가 많아지는 것이 리더 전환의 신호입니다.</p>
      </div>

      <div className="stat-row section">
        <div className="stat"><div className="k">이번 주 ({weekLabel(weekKey)})</div><div className="v">{Math.round(ratio * 100) / 100}</div><div className="d">북극성 비율 = 남이 푼 / 내가 푼</div></div>
        <div className="stat"><div className="k">직접 푼 문제</div><div className="v">{s}<small>건</small></div></div>
        <div className="stat"><div className="k">남이 풀게 만든</div><div className="v" style={{ color: "var(--green)" }}>{d}<small>건</small></div><div className="d">사람·AI·외주·자동화 포함</div></div>
      </div>

      <div className="section">
        <div className="section-title">내가 직접 푼 문제</div>
        <div className="panel panel-pad">
          <div className="input-group" style={{ marginBottom: 12 }}>
            <input className="input" value={solved} placeholder="이번 주 내가 직접 처리한 일" onChange={(e) => setSolved(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSolved()} />
            <button className="suffix" style={{ cursor: "pointer" }} onClick={addSolved}>추가</button>
          </div>
          {(cur.solvedSelf || []).length === 0 ? <div className="muted small">아직 없습니다.</div> : (
            <div className="stack">
              {cur.solvedSelf.map((t, i) => (
                <div key={i} className="li"><div className="li-main"><div className="li-title">{t}</div></div><button className="x" onClick={() => rmSolved(i)}>×</button></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">남에게 넘긴 일 (사람·AI·외주·자동화)</div>
        <div className="panel panel-pad">
          <div className="field" style={{ marginBottom: 10 }}>
            <input className="input" value={delText} placeholder="누구/무엇에게 넘겼나" onChange={(e) => setDelText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDelegated()} />
          </div>
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="tagset">
              {DELEGATE_TYPES.map((t) => (
                <button key={t.id} className={delType === t.id ? "on" : ""} onClick={() => setDelType(t.id)}>{t.label}</button>
              ))}
            </div>
            <button className="btn btn-sm btn-primary" onClick={addDelegated}>추가</button>
          </div>
          {(cur.delegated || []).length === 0 ? <div className="muted small">아직 없습니다. AI·외주에 넘긴 일도 여기 셉니다.</div> : (
            <div className="stack">
              {cur.delegated.map((it, i) => (
                <div key={it.id || i} className="li">
                  <div className="li-main"><div className="li-title">{it.text}</div></div>
                  <span className="chip">{typeLabel(it.delegateType)}</span>
                  <button className="x" onClick={() => rmDelegated(i)}>×</button>
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
        <div className="section-title">북극성 비율 추세</div>
        <div className="panel panel-pad">
          <TrendChart series={trend} />
          <div className="tiny muted" style={{ marginTop: 8 }}>이 비율의 우상향이 "내가 없어도 굴러가는" 리더로의 전환 측정점입니다.</div>
        </div>
      </div>
    </div>
  );
}
