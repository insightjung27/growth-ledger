import { useMemo, useState } from "react";
import { useStore, addPrediction, resolvePrediction, removePrediction } from "../lib/store.js";
import { pendingPredictions } from "../lib/feasibility.js";
import { isoDate, relDate } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

const PRESETS = [0.5, 0.6, 0.7, 0.8, 0.9];
const TAGS = ["타당성", "제안", "프로젝트", "설득"];
const RES_LABEL = { YES: "적중(YES)", NO: "빗나감(NO)", AMBIGUOUS: "애매" };
const RES_LIGHT = { YES: "green", NO: "red", AMBIGUOUS: "gray" };

export default function Predictions() {
  const preds = useStore((s) => s.predictions);
  const state = useStore();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ question: "", probability: 0.6, resolveBy: "", tags: [] });

  const today = isoDate(new Date());
  const pending = useMemo(() => pendingPredictions(state, today), [state, today]);
  const resolved = preds.filter((p) => p.resolution);
  const openUnresolved = preds.filter((p) => p.resolution == null).sort((a, b) => (a.resolveBy || "9999").localeCompare(b.resolveBy || "9999"));

  function submit() {
    if (!draft.question.trim()) return;
    addPrediction({ question: draft.question.trim(), probability: draft.probability, resolveBy: draft.resolveBy, tags: draft.tags });
    setAdding(false); setDraft({ question: "", probability: 0.6, resolveBy: "", tags: [] });
  }
  function toggleTag(t) { setDraft((d) => ({ ...d, tags: d.tags.includes(t) ? d.tags.filter((x) => x !== t) : [...d.tags, t] })); }

  const hits = resolved.filter((p) => p.resolution === "YES").length;
  const scored = resolved.filter((p) => p.resolution === "YES" || p.resolution === "NO").length;

  function Card({ p }) {
    return (
      <div className="panel panel-pad">
        <div className="between" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="li-title" style={{ overflowWrap: "anywhere" }}>{p.question}</div>
            <div className="tiny muted" style={{ marginTop: 4 }}>확신 {Math.round(p.probability * 100)}%{p.resolveBy ? ` · 판정 예정 ${p.resolveBy}` : ""}{p.tags?.length ? " · " + p.tags.join("·") : ""}</div>
          </div>
          {p.resolution ? <span className={"badge " + RES_LIGHT[p.resolution]}>{RES_LABEL[p.resolution]}</span> : <span className="badge amber">미판정</span>}
        </div>
        {p.resolution == null && (
          <div className="gap-wrap" style={{ marginTop: 12 }}>
            <span className="tiny muted" style={{ alignSelf: "center" }}>결과:</span>
            <button className="btn btn-sm" onClick={() => resolvePrediction(p.id, "YES")}>적중</button>
            <button className="btn btn-sm" onClick={() => resolvePrediction(p.id, "NO")}>빗나감</button>
            <button className="btn btn-sm btn-ghost" onClick={() => resolvePrediction(p.id, "AMBIGUOUS")}>애매</button>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={() => confirm("이 예측을 삭제할까요?") && removePrediction(p.id)}>삭제</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>예측 로그</h1>
          <p className="sub">판단할 때 확신%를 미리 적고, 나중에 대조합니다. 판정 전엔 잠깁니다(후견편향 차단).</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ 예측</button>
      </div>

      <div className="notice info section">
        캘리브레이션 곡선·Brier 점수는 <b>표본이 충분히 쌓인 뒤</b> 성장 대시보드에서 엽니다. 지금은 <b>정직하게</b> 캡처·판정만 합니다.
      </div>

      {resolved.length > 0 && (
        <div className="stat-row section">
          <div className="stat"><div className="k">판정 완료</div><div className="v">{resolved.length}<small>건</small></div><div className="d">누적 대조</div></div>
          <div className="stat"><div className="k">적중률</div><div className="v">{scored >= 5 ? Math.round((hits / scored) * 100) + "%" : "계측 불가"}</div><div className="d">{scored >= 5 ? `YES/NO ${scored}건 중 적중 ${hits}` : `표본 ${scored}/5 — 더 쌓기`}</div></div>
          <div className="stat"><div className="k">판정 대기</div><div className="v" style={{ color: pending.length ? "var(--amber)" : "inherit" }}>{pending.length}<small>건</small></div><div className="d">마감 지남</div></div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="section">
          <div className="section-title">⏰ 판정 대기 (마감 지남)</div>
          <div className="stack">{pending.map((p) => <Card key={p.id} p={p} />)}</div>
        </div>
      )}

      {openUnresolved.filter((p) => !pending.includes(p)).length > 0 && (
        <div className="section">
          <div className="section-title">진행 중 예측</div>
          <div className="stack">{openUnresolved.filter((p) => !pending.includes(p)).map((p) => <Card key={p.id} p={p} />)}</div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="section">
          <div className="section-title">판정 완료</div>
          <div className="stack">{resolved.sort((a, b) => (b.resolvedAt || "").localeCompare(a.resolvedAt || "")).map((p) => (
            <div key={p.id} className="li-card static">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{p.question}</div>
                <div className="tiny muted">확신 {Math.round(p.probability * 100)}% · {relDate(p.resolvedAt)} 판정</div>
              </div>
              <span className={"badge " + RES_LIGHT[p.resolution]}>{RES_LABEL[p.resolution]}</span>
            </div>
          ))}</div>
        </div>
      )}

      {preds.length === 0 && (
        <div className="panel empty">
          <div className="em-ic">🔮</div>
          <h3>예측이 없습니다</h3>
          <p>"이 제안은 통과된다(70%)", "이 프로젝트는 기한 내 끝난다(60%)"처럼 확신%와 함께 적어두세요. 시간이 쌓이면 당신의 판단력이 숫자로 드러납니다.</p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>첫 예측</button>
        </div>
      )}

      {adding && (
        <Modal title="예측 추가" onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>취소</button><button className="btn btn-primary" onClick={submit} disabled={!draft.question.trim()}>추가</button></>}>
          <div className="field"><label>예측 (검증가능한 문장) <span style={{ color: "var(--red)" }}>*</span></label><textarea className="textarea" autoFocus value={draft.question} placeholder="예: 이 제안은 임원 검토를 통과한다" onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></div>
          <div className="field"><label>확신 {Math.round(draft.probability * 100)}%</label><div className="seg">{PRESETS.map((v) => <button key={v} className={draft.probability === v ? "on" : ""} onClick={() => setDraft({ ...draft, probability: v })}>{Math.round(v * 100)}%</button>)}</div></div>
          <div className="field"><label>판정 예정일 <span className="tiny muted">(선택)</span></label><input className="input" type="date" value={draft.resolveBy} onChange={(e) => setDraft({ ...draft, resolveBy: e.target.value })} /></div>
          <div className="field"><label>태그</label><div className="tagset">{TAGS.map((t) => <button key={t} className={draft.tags.includes(t) ? "on" : ""} onClick={() => toggleTag(t)}>{t}</button>)}</div></div>
        </Modal>
      )}
    </div>
  );
}
