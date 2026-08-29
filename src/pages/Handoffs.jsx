import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  useStore, addHandoff, DELEGATE_TYPES, delegateKind, DELEGATION_LEVELS,
} from "../lib/store.js";
import { SIX_ELEMENTS, REVIEW_CHECKPOINTS } from "../lib/guidance.js";
import { isoDate, daysBetween, relDate } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

// ===== 상태 표기 =====
const STATUS = {
  assigned: { label: "할당", badge: "gray" },
  in_progress: { label: "진행중", badge: "amber" },
  review: { label: "리뷰 지점", badge: "amber" },
  done: { label: "완결", badge: "green" },
  blocked: { label: "막힘", badge: "red" },
};
const OPEN_STATES = ["assigned", "in_progress", "review"];

// 넘긴 일 하나의 파생 상태(지연·점검필요·마일스톤 진척)
function summarize(h) {
  const cps = Array.isArray(h.checkpoints) ? h.checkpoints : [];
  const reachedPct = h.status === "done" ? 100 : cps.filter((c) => c.reached).reduce((m, c) => Math.max(m, c.milestonePct || 0), 0);
  const needsReview = cps.some((c) => c.reached && !c.reviewed) && h.status !== "done";
  const today = isoDate();
  const dLeft = h.deadline ? -1 * daysBetween(new Date(h.deadline + "T00:00:00").toISOString()) : null; // +면 남음, -면 지남
  const open = OPEN_STATES.includes(h.status);
  const overdue = !!h.deadline && open && h.deadline < today;
  const dueSoon = !!h.deadline && open && !overdue && dLeft != null && dLeft <= 2;
  const stale = open && daysBetween(h.updatedAt) != null && daysBetween(h.updatedAt) > 14;
  const kind = delegateKind(h.delegateType);
  // 북극성 계상 = 실권 이양(L3+ 또는 authority 명시, '해당없음'/공란 제외) + 사람 위임
  const authoritative = !!(h.authority && h.authority.trim() && h.authority.trim() !== "해당없음");
  const northStar = kind === "people" && (h.delegationLevel >= 3 || authoritative);
  return { reachedPct, needsReview, dLeft, overdue, dueSoon, stale, open, kind, northStar };
}

const EMPTY_FORM = () => ({
  title: "", delegateType: "person", assigneeId: "", delegationLevel: 2,
  outcome: "", metric: "", boundary: "", authority: "", deadline: "",
});

export default function Handoffs() {
  const nav = useNavigate();
  const handoffs = useStore((s) => s.handoffs);
  const members = useStore((s) => s.teamMembers);
  const memberName = (id) => members.find((m) => m.id === id)?.name || (id ? "(삭제된 팀원)" : "미지정");

  const [statusFilter, setStatusFilter] = useState("all"); // all|open|done|blocked
  const [kindFilter, setKindFilter] = useState("all"); // all|people|ax
  const [wizard, setWizard] = useState(false);

  const rows = handoffs.map((h) => ({ h, s: summarize(h) }));
  const filtered = rows.filter(({ h, s }) => {
    if (statusFilter === "open" && !s.open) return false;
    if (statusFilter === "done" && h.status !== "done") return false;
    if (statusFilter === "blocked" && h.status !== "blocked") return false;
    if (kindFilter !== "all" && s.kind !== kindFilter) return false;
    return true;
  });

  // 상단 요약
  const openN = rows.filter((r) => r.s.open).length;
  const reviewN = rows.filter((r) => r.s.needsReview).length;
  const overdueN = rows.filter((r) => r.s.overdue).length;
  const blockedN = rows.filter((r) => r.h.status === "blocked").length;
  const peopleDone = rows.filter((r) => r.s.kind === "people" && r.h.status === "done").length;
  const axN = rows.filter((r) => r.s.kind === "people" ? false : true).length;

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>위임과제</h1>
          <p className="sub">본인이 하던 일을 팀원에게 넘긴 기록. 넘긴 일이 재작업 없이 <b>완결</b>되는 건수가 북극성입니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setWizard(true)}>위임 넘기기</button>
      </div>

      {/* 6요소 지침 — 왜 이걸 하나 */}
      <div className="notice info section">
        <b>6요소로 넘겨야 다시 안 봅니다.</b> {SIX_ELEMENTS.map((e) => e.label).join(" · ")} —{" "}
        {SIX_ELEMENTS.map((e) => `${e.label}(${e.desc})`).join(", ")}. 결과·지표·경계·권한·마감이 빠지면 "다시 설명"이 반복됩니다.
      </div>

      {handoffs.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">📤</div>
          <h3>아직 넘긴 일이 없습니다</h3>
          <p>리더의 일은 직접 처리가 아니라 "다른 사람이 해결하게 만드는 것"입니다. 지금 직접 하고 있는 일 하나를 6요소로 넘겨보세요.</p>
          <button className="btn btn-primary" onClick={() => setWizard(true)}>위임 넘기기</button>
        </div>
      ) : (
        <>
          {/* 요약 */}
          <div className="stat-row section">
            <div className="stat"><div className="k">진행 중</div><div className="v">{openN}<small>건</small></div><div className="d">할당·진행·리뷰</div></div>
            <div className="stat"><div className="k">사람 위임 완결 (북극성)</div><div className="v" style={{ color: "var(--green)" }}>{peopleDone}<small>건</small></div><div className="d">재작업 없이 완결</div></div>
            <div className="stat"><div className="k">점검 필요</div><div className="v" style={{ color: reviewN ? "var(--amber)" : undefined }}>{reviewN}<small>건</small></div><div className="d">마일스톤 도달·미점검</div></div>
          </div>

          <div className="gap-wrap section" style={{ justifyContent: "space-between" }}>
            <div className="seg">
              {[["all", "전체"], ["open", "진행 중"], ["done", "완결"], ["blocked", "막힘"]].map(([id, label]) => (
                <button key={id} className={statusFilter === id ? "on" : ""} onClick={() => setStatusFilter(id)}>{label}</button>
              ))}
            </div>
            <div className="tagset">
              {[["all", "전체"], ["people", "사람"], ["ax", "AI·자동화"]].map(([id, label]) => (
                <button key={id} className={kindFilter === id ? "on" : ""} onClick={() => setKindFilter(id)}>{label}</button>
              ))}
            </div>
          </div>

          {(overdueN > 0 || blockedN > 0) && (
            <div className="notice warn section">
              {overdueN > 0 && <span>마감 지남 <b>{overdueN}</b>건 </span>}
              {blockedN > 0 && <span>· 막힘 <b>{blockedN}</b>건 </span>}
              — 100%에서 처음 보면 비용이 큽니다. 20/50/80 지점에서 점검하세요.
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="panel panel-pad muted small">조건에 맞는 위임과제가 없습니다.</div>
          ) : (
            <div className="stack">
              {filtered.map(({ h, s }) => (
                <button key={h.id} className="panel panel-pad li" style={{ borderBottom: "1px solid var(--line)", textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => nav("/handoffs/" + h.id)}>
                  <div className="li-main">
                    <div className="between" style={{ alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="li-title">{h.title || "(제목 없음)"}</div>
                        <div className="li-sub">
                          {memberName(h.assigneeId)} · {DELEGATE_TYPES.find((t) => t.id === h.delegateType)?.label || h.delegateType}
                          {" · "}{(DELEGATION_LEVELS.find((l) => l.level === h.delegationLevel) || {}).name || "L?"}
                        </div>
                      </div>
                      <div className="gap-wrap" style={{ justifyContent: "flex-end" }}>
                        <span className={"badge " + (STATUS[h.status]?.badge || "gray")}>{STATUS[h.status]?.label || h.status}</span>
                      </div>
                    </div>

                    {/* 20/50/80 마일스톤 눈금 진척바 */}
                    <MilestoneBar handoff={h} reachedPct={s.reachedPct} />

                    <div className="gap-wrap" style={{ marginTop: 8 }}>
                      {s.needsReview && <span className="badge amber">점검 필요</span>}
                      {s.overdue && <span className="badge red">마감 지남</span>}
                      {s.dueSoon && <span className="badge amber">마감 임박{s.dLeft != null ? ` D-${s.dLeft}` : ""}</span>}
                      {s.stale && <span className="badge gray">방치 14일+</span>}
                      {s.kind === "ax" && <span className="chip">AX 보조</span>}
                      {s.northStar && h.status === "done" && <span className="badge green">북극성 계상</span>}
                      {h.deadline && !s.overdue && !s.dueSoon && <span className="tiny muted">마감 {h.deadline}</span>}
                      <span className="tiny muted">갱신 {relDate(h.updatedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="tiny muted section" style={{ marginTop: 14 }}>
            사람·조직 위임(L3+ 또는 권한 명시)만 북극성으로 계상됩니다. AI·자동화({axN}건 분모 별도)는 AX 레버리지 보조지표입니다.
          </div>
        </>
      )}

      {wizard && <HandoffWizard members={members} onClose={() => setWizard(false)} onDone={(id) => { setWizard(false); nav("/handoffs/" + id); }} />}
    </div>
  );
}

// 20/50/80 마일스톤 눈금 진척바
function MilestoneBar({ handoff, reachedPct }) {
  const cps = Array.isArray(handoff.checkpoints) ? handoff.checkpoints : [];
  const byPct = (p) => cps.find((c) => c.milestonePct === p) || {};
  const marks = REVIEW_CHECKPOINTS.map((rc) => {
    const c = byPct(rc.pct);
    const state = c.reached ? (c.reviewed ? "reviewed" : "reached") : "todo";
    return { ...rc, state };
  });
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 6, background: "var(--paper-3)", borderRadius: 999 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, reachedPct)}%`, background: "var(--accent)", borderRadius: 999 }} />
        {[20, 50, 80].map((p) => (
          <span key={p} style={{ position: "absolute", left: `${p}%`, top: -2, width: 2, height: 10, background: "var(--muted-2)", transform: "translateX(-1px)" }} />
        ))}
      </div>
      <div className="gap-wrap" style={{ marginTop: 6 }}>
        {marks.map((m) => (
          <span key={m.pct} className="tiny" style={{ color: m.state === "reviewed" ? "var(--green)" : m.state === "reached" ? "var(--amber)" : "var(--muted-2)", fontWeight: 600 }}>
            {m.pct}% {m.label}{m.state === "reviewed" ? " ✓" : m.state === "reached" ? " ●" : ""}
          </span>
        ))}
        <span className="tiny" style={{ color: reachedPct >= 100 ? "var(--green)" : "var(--muted-2)", fontWeight: 600 }}>100% {reachedPct >= 100 ? "완결 ✓" : "완결"}</span>
      </div>
    </div>
  );
}

// ===== 6요소 위임 마법사 =====
const STEP_LABELS = ["누구에게·무엇을", "결과·지표", "경계·권한·마감"];

function HandoffWizard({ members, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(EMPTY_FORM);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  const kind = delegateKind(f.delegateType);
  const needAssignee = kind === "people";
  const activeMembers = members.filter((m) => m.active !== false);

  const canNext0 = f.title.trim() && (!needAssignee || f.assigneeId);
  const canNext1 = f.outcome.trim() && f.metric.trim();
  const canSave = canNext0 && canNext1 && f.deadline && f.authority.trim();

  function save() {
    if (!canSave) return;
    const id = addHandoff({
      title: f.title.trim(),
      assigneeId: needAssignee ? f.assigneeId : (f.assigneeId || null),
      delegateType: f.delegateType,
      delegationLevel: Number(f.delegationLevel) || 2,
      outcome: f.outcome.trim(),
      metric: f.metric.trim(),
      boundary: f.boundary.trim(),
      authority: f.authority.trim(),
      deadline: f.deadline,
      status: "assigned",
    });
    onDone(id);
  }

  const footer = (
    <>
      <button className="btn" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}>{step === 0 ? "취소" : "이전"}</button>
      {step < 2 ? (
        <button className="btn btn-primary" disabled={step === 0 ? !canNext0 : !canNext1} onClick={() => setStep((s) => s + 1)}>다음</button>
      ) : (
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>위임 시작</button>
      )}
    </>
  );

  return (
    <Modal title="위임 넘기기 — 6요소 지시" onClose={onClose} footer={footer}>
      <div className="steps">
        {STEP_LABELS.map((_, i) => (<div key={i} className={"st" + (i <= step ? " on" : "")} />))}
      </div>
      <div className="step-label">STEP {step + 1} / 3 · {STEP_LABELS[step]}</div>

      {step === 0 && (
        <div>
          <div className="field">
            <label>과제명</label>
            <input className="input" value={f.title} placeholder="예: 결제 실패 리커버리 화면 설계" onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="field">
            <label>위임 대상</label>
            <div className="tagset">
              {DELEGATE_TYPES.map((t) => (
                <button key={t.id} className={f.delegateType === t.id ? "on" : ""} onClick={() => set({ delegateType: t.id })}>{t.label}</button>
              ))}
            </div>
            {kind === "ax" && <div className="hint">AI·자동화는 AX 레버리지(보조지표)로 집계됩니다 — 북극성 분자에는 포함되지 않습니다.</div>}
          </div>
          {needAssignee && (
            activeMembers.length === 0 ? (
              <div className="notice warn">위임할 팀원이 없습니다. 먼저 <Link to="/team">팀·구성원</Link>에서 팀원을 추가하거나, 대상에서 AI·자동화를 선택하세요.</div>
            ) : (
              <div className="field">
                <label>담당 팀원</label>
                <select className="select" value={f.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })}>
                  <option value="">선택하세요</option>
                  {activeMembers.map((m) => (<option key={m.id} value={m.id}>{m.name || "(이름 없음)"}{m.area ? ` · ${m.area}` : ""}</option>))}
                </select>
              </div>
            )
          )}
          <div className="field">
            <label>위임수준</label>
            <select className="select" value={f.delegationLevel} onChange={(e) => set({ delegationLevel: Number(e.target.value) })}>
              {DELEGATION_LEVELS.map((l) => (<option key={l.level} value={l.level}>{l.name} — {l.desc}</option>))}
            </select>
            <div className="hint">신입에게 L4=방임, 시니어에게 L1=마이크로매니징. 각 팀원을 한 단계 위로 올리는 게 육성입니다.</div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="notice info" style={{ marginBottom: 14 }}>
            <b>OUTCOME</b>: 무엇이 달라져야 하는가 · <b>METRIC</b>: 성공을 어떻게 측정하는가. "결제 화면 개선해줘"가 아니라 목표와 측정을 정의하세요.
          </div>
          <div className="field">
            <label>결과 (OUTCOME) *</label>
            <textarea className="textarea" value={f.outcome} placeholder="예: 결제 실패 시 이탈 없이 재시도·대안결제로 복구되는 흐름" onChange={(e) => set({ outcome: e.target.value })} />
          </div>
          <div className="field">
            <label>지표 (METRIC) *</label>
            <input className="input" value={f.metric} placeholder="예: 결제 실패 후 성공 전환율 40% 이상" onChange={(e) => set({ metric: e.target.value })} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="field">
            <label>경계 (BOUNDARY)</label>
            <input className="input" value={f.boundary} placeholder="예: 결제 모듈 API·약관 문구는 건드리지 않음" onChange={(e) => set({ boundary: e.target.value })} />
            <div className="hint">무엇을 건드리면 안 되는가. 없으면 비워도 됩니다.</div>
          </div>
          <div className="field">
            <label>권한 (AUTHORITY) *</label>
            <input className="input" value={f.authority} placeholder="예: 카피·레이아웃은 본인 결정, 결제사 추가는 승인 필요" onChange={(e) => set({ authority: e.target.value })} />
            <div className="gap-wrap" style={{ marginTop: 6 }}>
              <button type="button" className="btn btn-sm" onClick={() => set({ authority: "해당없음" })}>해당없음으로 명시</button>
              <span className="tiny muted">어디까지 본인이 결정하는가. 공란은 허용되지 않습니다 — 없으면 '해당없음'으로 명시하세요.</span>
            </div>
          </div>
          <div className="field">
            <label>마감 (DEADLINE) *</label>
            <input className="input" type="date" value={f.deadline} onChange={(e) => set({ deadline: e.target.value })} />
          </div>
          {!canSave && <div className="tiny" style={{ color: "var(--amber)" }}>결과·지표·권한·마감{needAssignee ? "·담당" : ""}은 필수입니다.</div>}
        </div>
      )}
    </Modal>
  );
}
