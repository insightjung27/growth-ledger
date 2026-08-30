import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, addDecision, DECISION_TYPES } from "../lib/store.js";
import { isoDate, daysBetween } from "../lib/format.js";
import { DECISION_FRAMES } from "../lib/guidance.js";
import Modal from "../components/Modal.jsx";
import HowTo from "../components/HowTo.jsx";

const OVERDUE_LIMIT = 3; // 미대조 3건 초과면 신규 생성 전 대조를 권고(차단 아님)

// 상태 우선순위 — 낮을수록 위. 대조도래>실행대기>실행중>작성·검증>완료
function statusRank(d, today) {
  if (isOverdue(d, today)) return 0;
  if (d.status === "decided") return 1;
  if (d.status === "executing") return 2;
  if (d.status === "draft" || d.status === "verifying") return 3;
  if (d.status === "reviewed") return 5;
  return 4;
}

const typeLabel = (t) => DECISION_TYPES.find((x) => x.id === t)?.label || t;

function isOverdue(d, today) {
  return d.status === "executing" && d.reviewDate && d.reviewDate <= today;
}

function statusMeta(d, today) {
  if (d.status === "reviewed") {
    const hit = d.review?.hit;
    return { label: hit === "hit" ? "적중 ✓" : hit === "miss" ? "빗나감" : "대조 완료", cls: hit === "hit" ? "green" : hit === "miss" ? "red" : "gray" };
  }
  if (d.status === "executing") {
    if (isOverdue(d, today)) return { label: "대조 기한 도래", cls: "red" };
    return { label: "실행 중", cls: "green" };
  }
  if (d.status === "decided") return { label: "실행 대기", cls: "amber" };
  if (d.status === "verifying") return { label: "검증 중", cls: "amber" };
  return { label: "작성 중", cls: "gray" };
}

function nextLine(d, today) {
  if (d.status === "reviewed") return d.review?.lesson ? "복기: " + d.review.lesson : "대조 완료 · 예측 vs 실제 확인";
  if (d.status === "executing") {
    if (isOverdue(d, today)) return "지금 대조하세요 — 예측이 맞았는지 확인";
    const na = (d.nextActions || []).find((a) => !a.done);
    return na ? "다음 행동: " + na.what : "대조 예정 " + (d.reviewDate || "-");
  }
  if (d.status === "decided") return (d.nextActions || []).length ? "실행 시작 대기" : "다음 행동을 정하세요";
  if (d.status === "verifying") return "옵션 평가 → 결정이 남았습니다";
  return "질문·기준·옵션을 작성하세요";
}

function ddayChip(iso, today, status) {
  if (!iso) return null;
  // 미결정(작성 중·검증 중)일 때만 마감 칩 표시 — 결정 끝난 판단엔 마감 초과 칩을 띄우지 않음
  if (status !== "draft" && status !== "verifying") return null;
  const passed = daysBetween(iso, new Date(today)); // today 문자열 기준, 양수 = 지남
  if (passed == null) return null;
  const remain = -passed;
  if (remain < 0) return { text: `마감 +${-remain}일`, cls: "badge red" };
  if (remain === 0) return { text: "마감 D-DAY", cls: "badge amber" };
  if (remain <= 3) return { text: `D-${remain}`, cls: "badge amber" };
  return { text: `D-${remain}`, cls: "badge gray" };
}

function DecisionCard({ d, today, onOpen }) {
  const sm = statusMeta(d, today);
  const dd = ddayChip(d.deadline, today, d.status);
  const irrev = d.reversibility === "irreversible";
  return (
    <button
      className="li"
      style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid var(--line-2)", cursor: "pointer", padding: "13px 2px" }}
      onClick={onOpen}
      aria-label={`판단 ${d.title || "무제"} 열기`}
    >
      <div className="li-main">
        <div className="gap-wrap" style={{ marginBottom: 5 }}>
          <span className="badge gray">{typeLabel(d.type)}</span>
          <span className={"badge " + sm.cls}>{sm.label}</span>
          <span className="tiny muted" title={irrev ? "되돌릴 수 없는 문(one-way door)" : "되돌릴 수 있는 판단"}>{irrev ? "🚪 되돌릴 수 없음" : "🔄 되돌릴 수 있음"}</span>
          {dd ? <span className={dd.cls}>{dd.text}</span> : null}
        </div>
        <div className="li-title">{d.title || "(제목 없음)"}</div>
        <div className="li-sub">{nextLine(d, today)}</div>
      </div>
      <span className="tiny muted" style={{ alignSelf: "center" }}>›</span>
    </button>
  );
}

export default function Decisions() {
  const decisions = useStore((s) => s.decisions);
  const nav = useNavigate();
  const today = isoDate(new Date());

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", type: "strategy" });
  const [fType, setFType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [hideReviewed, setHideReviewed] = useState(true);

  const overdue = useMemo(() => decisions.filter((d) => isOverdue(d, today)), [decisions, today]);
  const verifyingCount = decisions.filter((d) => d.status === "draft" || d.status === "verifying").length;
  const waitingCount = decisions.filter((d) => d.status === "decided").length;
  const reviewedList = decisions.filter((d) => d.status === "reviewed" && (d.review?.hit === "hit" || d.review?.hit === "miss"));
  const hitCount = reviewedList.filter((d) => d.review?.hit === "hit").length;
  const enoughSample = reviewedList.length >= 5;

  const softBlocked = overdue.length > OVERDUE_LIMIT;

  const rest = useMemo(() => {
    let list = decisions.filter((d) => !isOverdue(d, today));
    if (fType !== "all") list = list.filter((d) => d.type === fType);
    if (fStatus !== "all") list = list.filter((d) => d.status === fStatus);
    if (hideReviewed) list = list.filter((d) => d.status !== "reviewed");
    // 1차: 상태 우선순위(대조도래>실행대기>실행중>작성·검증>완료), 2차: 마감(없는 건 뒤로)
    return [...list].sort((a, b) => {
      const ra = statusRank(a, today);
      const rb = statusRank(b, today);
      if (ra !== rb) return ra - rb;
      const da = a.deadline || "9999-99-99";
      const db = b.deadline || "9999-99-99";
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }, [decisions, today, fType, fStatus, hideReviewed]);

  function resetFilters() { setFType("all"); setFStatus("all"); setHideReviewed(false); }

  function create() {
    if (!draft.title.trim()) return;
    const id = addDecision({ title: draft.title.trim(), type: draft.type });
    setAdding(false);
    setDraft({ title: "", type: "strategy" });
    nav("/decisions/" + id);
  }

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>판단 원장</h1>
          <p className="sub">비즈니스 판단 1건 = 1레코드. 기준을 먼저 정하고 → 결정하고 → 예측을 동결하고 → 기한에 대조합니다. 대조가 판단력의 증거입니다. 돈 판단이면 머니테스트로, 그 외엔 기대값·프리모템으로 검증합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ 신규 판단</button>
      </div>

      <HowTo screen="decisions" />

      <div className="stat-row section">
        <div className="stat"><div className="k">작성·검증 중</div><div className="v">{verifyingCount}<small>건</small></div><div className="d">아직 결정 전</div></div>
        <div className="stat"><div className="k">실행 대기</div><div className="v" style={{ color: waitingCount ? "var(--amber)" : "inherit" }}>{waitingCount}<small>건</small></div><div className="d">결정됨 · 실행 미시작</div></div>
        <div className="stat"><div className="k">대조 기한 도래</div><div className="v" style={{ color: overdue.length ? "var(--red)" : "inherit" }}>{overdue.length}<small>건</small></div><div className="d">{enoughSample ? `적중률 ${Math.round((hitCount / reviewedList.length) * 100)}% (n=${reviewedList.length})` : "적중률 계측 불가(대조 5건 미만)"}</div></div>
      </div>

      {softBlocked ? (
        <div className="section">
          <div className="notice warn">
            <b>미대조 판단이 {overdue.length}건입니다.</b> 대조 루프가 닫히지 않으면 판단력 주장은 무너집니다. 먼저 밀린 대조 {overdue.length}건을 권합니다 — 아래 <b>대조 기한 도래</b>의 판단부터 대조하세요.
          </div>
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <div className="section">
          <div className="section-title" style={{ color: "var(--red)" }}>⏰ 대조 기한 도래 — 최우선 (스누즈 불가)</div>
          <div className="panel panel-pad" style={{ borderColor: "color-mix(in srgb, var(--red) 35%, var(--line))" }}>
            {overdue.map((d) => (
              <DecisionCard key={d.id} d={d} today={today} onOpen={() => nav("/decisions/" + d.id)} />
            ))}
          </div>
        </div>
      ) : null}

      {decisions.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">⚖️</div>
          <h3>아직 기록한 판단이 없습니다</h3>
          <p>"이 SI 진행할까", "이 기능 뺄까", "이 사람을 뽑을까" — 되돌아보게 될 비즈니스 판단 하나를 올려보세요. 나중에 예측과 실제를 대조하면 판단력이 숫자로 쌓입니다.</p>
          <div className="notice info" style={{ textAlign: "left", maxWidth: 420, margin: "0 auto 16px" }}>
            <b>먼저 기준을 정합니다.</b> {DECISION_FRAMES.criteria} — 결정한 뒤에 합리화하지 않도록, 옵션을 보기 전에 "무엇이 충족되면 Yes/No"를 동결합니다.
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>첫 판단 기록</button>
        </div>
      ) : (
        <div className="section">
          <div className="between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>판단 목록</div>
            <div className="gap-wrap">
              <select className="select" style={{ width: "auto", height: 34 }} value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="all">유형 전체</option>
                {DECISION_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
              <select className="select" style={{ width: "auto", height: 34 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="all">상태 전체</option>
                <option value="draft">작성 중</option>
                <option value="verifying">검증 중</option>
                <option value="decided">실행 대기</option>
                <option value="executing">실행 중</option>
                <option value="reviewed">대조 완료</option>
              </select>
              <button type="button" className={"btn btn-sm" + (hideReviewed ? " on" : "")} onClick={() => setHideReviewed((v) => !v)} title="대조 완료 판단을 목록에서 숨깁니다">{hideReviewed ? "✓ 완료 숨기기" : "완료 숨기기"}</button>
            </div>
          </div>
          {rest.length === 0 ? (
            <div className="panel panel-pad muted small between" style={{ gap: 10, flexWrap: "wrap" }}>
              <span>조건에 맞는 판단이 없습니다. 필터를 바꿔보세요.</span>
              <button className="btn btn-sm" onClick={resetFilters}>필터 초기화</button>
            </div>
          ) : (
            <div className="panel panel-pad">
              {rest.map((d) => (
                <DecisionCard key={d.id} d={d} today={today} onOpen={() => nav("/decisions/" + d.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {adding ? (
        <Modal
          title="신규 판단"
          onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>취소</button><button className="btn btn-primary" onClick={create} disabled={!draft.title.trim()}>만들고 열기</button></>}
        >
          <div className="notice info" style={{ marginBottom: 14 }}>지금은 <b>제목과 유형</b>만 정합니다(draft). 질문·기준·옵션·되돌림·예측은 상세에서 단계적으로 채웁니다.</div>
          <div className="field">
            <label>판단명 (한 줄)</label>
            <input className="input" autoFocus value={draft.title} placeholder="예: A병원 접수 SI를 수주할 것인가" onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && create()} />
          </div>
          <div className="field">
            <label>유형</label>
            <div className="tagset">
              {DECISION_TYPES.map((t) => (
                <button key={t.id} type="button" className={draft.type === t.id ? "on" : ""} onClick={() => setDraft({ ...draft, type: t.id })}>{t.label}</button>
              ))}
            </div>
            <div className="hint">{DECISION_TYPES.find((t) => t.id === draft.type)?.desc || ""}</div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
