import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useStore, addTeamMember, addGoal, updateGoal, removeGoal, logGoalChange,
  addCompanyGoal, updateCompanyGoal, removeCompanyGoal, DELEGATION_LEVELS,
} from "../lib/store.js";
import { relDate } from "../lib/format.js";
import { GUIDE_SECTIONS } from "../lib/guidance.js";
import Modal from "../components/Modal.jsx";

const GOALS_GUIDE = GUIDE_SECTIONS.find((s) => s.id === "goals");
const DELEGATE_GUIDE = GUIDE_SECTIONS.find((s) => s.id === "delegate");
const STATUSES = ["진행중", "달성", "미달", "보류"];
const DEF_FIELDS = [
  { key: "title", label: "목표" },
  { key: "successMetric", label: "성공지표" },
  { key: "targetValue", label: "목표값" },
  { key: "status", label: "상태" },
  { key: "companyGoalId", label: "회사목표 연결" },
];

function currentQuarter(d = new Date()) {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}
function statusClass(s) {
  return s === "달성" ? "green" : s === "미달" ? "red" : s === "보류" ? "amber" : "gray";
}
function goalProgress(g) {
  const t = parseFloat(String(g.targetValue ?? "").replace(/[^0-9.\-]/g, ""));
  const c = parseFloat(String(g.currentValue ?? "").replace(/[^0-9.\-]/g, ""));
  if (!isFinite(t) || t === 0 || !isFinite(c)) return null;
  return Math.max(0, Math.min(1, c / t));
}
function parseList(text) {
  return String(text || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}
// 승급 후보 신호: solved_by_them & met & 무재작업 위임과제가 있는가(자동확정 아님·1:1 게이트)
function promotionSignal(member, handoffs) {
  return handoffs.some(
    (h) => h.assigneeId === member.id && h.status === "done" &&
      h.result?.autonomy === "solved_by_them" && h.result?.met === "met" && !h.result?.rework && (h.result?.reworkCount || 0) === 0
  );
}

function LevelGauge({ current, target }) {
  return (
    <div className="gap-wrap" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }} aria-label={`위임수준 현재 L${current}, 목표 L${target}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} title={`L${n}`} style={{
            width: 20, height: 9, borderRadius: 3,
            background: n <= current ? "var(--accent)" : "var(--paper-3)",
            boxShadow: n === target ? "0 0 0 2px var(--green)" : "none",
          }} />
        ))}
      </div>
      <span className="tiny muted mono">L{current} → 목표 L{target}</span>
    </div>
  );
}

export default function Team() {
  const members = useStore((s) => s.teamMembers).filter((m) => m.active !== false);
  const goals = useStore((s) => s.quarterlyGoals);
  const companyGoals = useStore((s) => s.companyGoals);
  const oneOnOnes = useStore((s) => s.oneOnOnes);
  const handoffs = useStore((s) => s.handoffs);

  const quarter = currentQuarter();
  const qGoals = goals.filter((g) => g.quarter === quarter);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", area: "", levelCurrent: 2, levelTarget: 3, strengths: "", growthAreas: "" });
  const [goalModal, setGoalModal] = useState(null); // {mode:'add'|'edit', goal}
  const [cgModal, setCgModal] = useState(null); // {mode, goal}

  function submitMember() {
    if (!draft.name.trim()) return;
    addTeamMember({
      name: draft.name.trim(), area: draft.area.trim(),
      levelCurrent: Number(draft.levelCurrent), levelTarget: Number(draft.levelTarget),
      strengths: parseList(draft.strengths), growthAreas: parseList(draft.growthAreas),
    });
    setDraft({ name: "", area: "", levelCurrent: 2, levelTarget: 3, strengths: "", growthAreas: "" });
    setAdding(false);
  }

  // 위임수준 평균 — 표본(팀원 1명 이상) 없으면 '계측 불가'
  const avgCur = members.length ? members.reduce((a, m) => a + (m.levelCurrent || 0), 0) / members.length : null;
  const avgTgt = members.length ? members.reduce((a, m) => a + (m.levelTarget || 0), 0) / members.length : null;
  const doneGoals = qGoals.filter((g) => g.status === "달성").length;
  const lastOneOnOne = (id) => {
    const dt = (o) => o.date || (o.createdAt || "").slice(0, 10);
    const list = oneOnOnes.filter((o) => o.memberId === id && dt(o)).sort((a, b) => (dt(a) < dt(b) ? 1 : -1));
    return list[0] ? dt(list[0]) : null;
  };

  return (
    <div>
      <div className="page-head between">
        <div>
          <div className="tiny muted">기둥② 사람</div>
          <h1>팀·구성원</h1>
          <p className="sub">'내가 없어도 팀이 좋은 결과를 만들게 했는가'. 위임수준을 한 단계씩 올리는 것이 육성입니다.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ 팀원 추가</button>
      </div>

      {members.length === 0 ? (
        // 진입 온보딩 게이트 — 위임 가능한 사람이 있는가
        <div className="section">
          <div className="panel panel-pad">
            <h3 style={{ fontSize: 17 }}>지금 실제로 위임 가능한 사람이 있나요?</h3>
            <p className="muted small" style={{ margin: "8px 0 16px" }}>
              혼자 다 하는 단계라면 기둥①(판단)에 집중하세요. 넘길 사람이 한 명이라도 생기면, 여기서 각자를 한 단계 위로 올리는 훈련을 시작합니다.
              사람·조직 위임만 북극성에 잡히고 AI·자동화는 별도(AX)로 봅니다.
            </p>
            <div className="section-title" style={{ marginBottom: 8 }}>위임수준 사다리 L1~L5</div>
            <div className="stack" style={{ marginBottom: 16 }}>
              {DELEGATION_LEVELS.map((l) => (
                <div key={l.level} className="li">
                  <span className="badge gray mono">{l.name.split(" ")[0]}</span>
                  <div className="li-main"><div className="li-title">{l.name.replace(/^L\d\s/, "")}</div><div className="li-sub">{l.desc}</div></div>
                </div>
              ))}
            </div>
            <div className="notice info" style={{ marginBottom: 14 }}>
              신입에게 L4는 방임, 시니어에게 L1은 마이크로매니징입니다. 각 팀원을 '지금 수준'에서 '한 단계 위'로 올리는 게 리더의 일입니다.
            </div>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>첫 팀원 추가</button>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-row section">
            <div className="stat"><div className="k">팀원</div><div className="v">{members.length}<small>명</small></div><div className="d">위임 대상(사람만)</div></div>
            <div className="stat">
              <div className="k">위임수준 평균</div>
              {avgCur == null ? (
                <div className="v" style={{ fontSize: 16, color: "var(--muted)" }}>계측 불가</div>
              ) : (
                <div className="v mono">L{avgCur.toFixed(1)}<small> → L{avgTgt.toFixed(1)}</small></div>
              )}
              <div className="d">현재 → 분기 목표</div>
            </div>
            <div className="stat"><div className="k">분기목표 달성</div><div className="v">{doneGoals}<small> / {qGoals.length}</small></div><div className="d">{quarter}</div></div>
          </div>

          <div className="section">
            <div className="section-title">팀원 로스터 — 위임수준 현재 → 목표</div>
            <div className="panel panel-pad">
              <div className="stack">
                {members.map((m) => {
                  const last = lastOneOnOne(m.id);
                  const staleOneOnOne = !last || (Date.now() - new Date(last).getTime()) / 86400000 > 21;
                  const promo = promotionSignal(m, handoffs);
                  const targetLow = m.levelTarget < m.levelCurrent;
                  return (
                    <Link key={m.id} to={`/team/${m.id}`} className="li" style={{ textDecoration: "none" }}>
                      <div className="li-main">
                        <div className="li-title">
                          {m.name || "(이름 없음)"}
                          {m.area ? <span className="muted small" style={{ fontWeight: 500 }}> · {m.area}</span> : null}
                        </div>
                        <div style={{ marginTop: 6 }}><LevelGauge current={m.levelCurrent} target={m.levelTarget} /></div>
                        <div className="gap-wrap" style={{ marginTop: 7 }}>
                          <span className={"badge " + (staleOneOnOne ? "amber" : "gray")}>
                            {last ? `최근 1:1 ${relDate(last)}` : "1:1 기록 없음"}
                          </span>
                          {promo ? <span className="badge green">승급 후보 신호</span> : null}
                          {targetLow ? <span className="badge red">목표 &lt; 현재</span> : null}
                        </div>
                      </div>
                      <span className="btn btn-sm btn-ghost" style={{ pointerEvents: "none" }}>열기 →</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 회사목표 관리 */}
      <div className="section">
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>회사목표 (분기목표 연결용)</div>
          <button className="btn btn-sm" onClick={() => setCgModal({ mode: "add", goal: null })}>+ 회사목표</button>
        </div>
        <div className="notice info" style={{ marginBottom: 12 }}>
          팀 분기목표는 회사목표에서 내려와야 정렬됩니다. 여기서 회사목표를 등록하고, 각 분기목표에 연결하세요.
        </div>
        <div className="panel panel-pad">
          {companyGoals.length === 0 ? (
            <div className="muted small">아직 등록된 회사목표가 없습니다. 상위 방향을 한 줄로 적어두면 팀 목표와의 정렬을 확인할 수 있습니다.</div>
          ) : (
            <div className="stack">
              {companyGoals.map((c) => (
                <div key={c.id} className="li">
                  <div className="li-main">
                    <div className="li-title">{c.title || "(제목 없음)"} {c.quarter ? <span className="muted small" style={{ fontWeight: 500 }}>· {c.quarter}</span> : null}</div>
                    {c.description ? <div className="li-sub">{c.description}</div> : null}
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setCgModal({ mode: "edit", goal: c })}>편집</button>
                  <button className="x" aria-label="삭제" onClick={() => { if (confirm("이 회사목표를 삭제할까요? 연결된 분기목표의 연결이 해제됩니다.")) removeCompanyGoal(c.id); }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 팀 분기목표 3개 섹션 */}
      <div className="section">
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>팀 분기목표 — {quarter}</div>
          <button className="btn btn-sm btn-primary" onClick={() => setGoalModal({ mode: "add", goal: null })}>+ 목표</button>
        </div>

        <div className="notice info" style={{ marginBottom: 12 }}>
          {(GOALS_GUIDE?.body || []).slice(0, 2).map((t, i) => (<div key={i} style={{ marginTop: i ? 4 : 0 }}>· {t}</div>))}
        </div>

        {qGoals.length >= 3 && (
          <div className="notice warn" style={{ marginBottom: 12 }}>
            이번 분기 목표가 {qGoals.length}개입니다. '분기마다 반드시 만드는 결과 3개'가 원칙입니다 — 4개째부터는 정말 중요한지 다시 보세요.
          </div>
        )}

        <div className="panel panel-pad">
          {qGoals.length === 0 ? (
            <div className="empty" style={{ padding: "28px 12px" }}>
              <div className="em-ic">🎯</div>
              <h3>이번 분기 목표가 없습니다</h3>
              <p>모든 업무를 관리하지 말고, 이번 분기에 팀이 '반드시 만들어야 할 결과' 3개만 정하세요.</p>
              <button className="btn btn-primary" onClick={() => setGoalModal({ mode: "add", goal: null })}>첫 분기목표</button>
            </div>
          ) : (
            <div className="stack">
              {qGoals.map((g) => {
                const p = goalProgress(g);
                const cg = g.companyGoalId ? companyGoals.find((c) => c.id === g.companyGoalId) : null;
                const owner = g.ownerMemberId ? members.find((m) => m.id === g.ownerMemberId) : null;
                return (
                  <div key={g.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <div className="between">
                      <div style={{ minWidth: 0 }}>
                        <div className="li-title">{g.title || "(제목 없음)"}</div>
                        {g.successMetric ? <div className="li-sub">지표: {g.successMetric}</div> : null}
                      </div>
                      <div className="gap-wrap">
                        <span className={"badge " + statusClass(g.status)}>{g.status}</span>
                        <button className="btn btn-sm btn-ghost" onClick={() => setGoalModal({ mode: "edit", goal: g })}>편집</button>
                        <button className="x" aria-label="삭제" onClick={() => { if (confirm("이 분기목표를 삭제할까요?")) removeGoal(g.id); }}>×</button>
                      </div>
                    </div>

                    <div className="gap-wrap" style={{ marginTop: 8 }}>
                      <span className="tiny muted">진척</span>
                      <input className="input" style={{ height: 32, width: 110 }} value={g.currentValue || ""}
                        placeholder="현재값" onChange={(e) => updateGoal(g.id, { currentValue: e.target.value })} />
                      <span className="tiny muted mono">/ {g.targetValue || "-"}</span>
                      {p != null ? <span className="badge gray mono">{Math.round(p * 100)}%</span> : null}
                    </div>
                    {p != null && (
                      <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden" }}>
                        <div style={{ width: `${p * 100}%`, height: "100%", background: "var(--accent)" }} />
                      </div>
                    )}

                    <div className="gap-wrap" style={{ marginTop: 8 }}>
                      {cg ? <span className="chip">회사목표: {cg.title}</span> : <span className="tiny muted">회사목표 미연결</span>}
                      {owner ? <span className="chip">담당: {owner.name}</span> : null}
                    </div>

                    {(g.changeLog || []).length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary className="tiny muted" style={{ cursor: "pointer" }}>변경 이력 {g.changeLog.length}건</summary>
                        <div className="stack" style={{ marginTop: 6 }}>
                          {g.changeLog.slice().reverse().map((c, i) => (
                            <div key={i} className="tiny muted">
                              <span className="mono">{(c.at || "").slice(0, 10)}</span> · {DEF_FIELDS.find((f) => f.key === c.field)?.label || c.field}: {"«"}{c.from || "-"}{"»"} → {"«"}{c.to || "-"}{"»"}
                              {c.reason ? ` — ${c.reason}` : ""}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {adding && (
        <Modal
          title="팀원 추가"
          onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>취소</button><button className="btn btn-primary" onClick={submitMember} disabled={!draft.name.trim()}>추가</button></>}
        >
          <div className="field">
            <label>이름</label>
            <input className="input" autoFocus value={draft.name} placeholder="예: 김주니어" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="field">
            <label>담당 영역</label>
            <input className="input" value={draft.area} placeholder="예: 결제 화면 기획" onChange={(e) => setDraft({ ...draft, area: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>현재 위임수준</label>
              <select className="select" value={draft.levelCurrent} onChange={(e) => setDraft({ ...draft, levelCurrent: Number(e.target.value) })}>
                {DELEGATION_LEVELS.map((l) => (<option key={l.level} value={l.level}>{l.name}</option>))}
              </select>
            </div>
            <div className="field">
              <label>목표 위임수준</label>
              <select className="select" value={draft.levelTarget} onChange={(e) => setDraft({ ...draft, levelTarget: Number(e.target.value) })}>
                {DELEGATION_LEVELS.map((l) => (<option key={l.level} value={l.level}>{l.name}</option>))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>강점 <span className="muted small">(쉼표로 구분)</span></label>
            <input className="input" value={draft.strengths} placeholder="예: 꼼꼼함, 문서화" onChange={(e) => setDraft({ ...draft, strengths: e.target.value })} />
          </div>
          <div className="field">
            <label>성장영역 <span className="muted small">(쉼표로 구분)</span></label>
            <input className="input" value={draft.growthAreas} placeholder="예: 의사결정, 발표" onChange={(e) => setDraft({ ...draft, growthAreas: e.target.value })} />
          </div>
          <div className="notice info">{DELEGATE_GUIDE?.body?.[0]}</div>
        </Modal>
      )}

      {goalModal && (
        <GoalModal
          data={goalModal}
          quarter={quarter}
          members={members}
          companyGoals={companyGoals}
          onClose={() => setGoalModal(null)}
        />
      )}

      {cgModal && (
        <CompanyGoalModal data={cgModal} quarter={quarter} onClose={() => setCgModal(null)} />
      )}
    </div>
  );
}

function GoalModal({ data, quarter, members, companyGoals, onClose }) {
  const editing = data.mode === "edit";
  const g = data.goal;
  const [form, setForm] = useState(
    editing
      ? { title: g.title || "", successMetric: g.successMetric || "", targetValue: g.targetValue || "", currentValue: g.currentValue || "", status: g.status || "진행중", companyGoalId: g.companyGoalId || "", ownerMemberId: g.ownerMemberId || "" }
      : { title: "", successMetric: "", targetValue: "", currentValue: "", status: "진행중", companyGoalId: "", ownerMemberId: "" }
  );
  const [reason, setReason] = useState("");

  // 변경된 '정의' 필드 계산 (진척=currentValue 제외)
  const changed = editing
    ? DEF_FIELDS.filter((f) => (g[f.key] || "") !== (form[f.key] || ""))
    : [];
  const needReason = editing && changed.length > 0;

  function save() {
    if (!form.title.trim()) return;
    if (needReason && !reason.trim()) return;
    const patch = {
      title: form.title.trim(), successMetric: form.successMetric.trim(),
      targetValue: form.targetValue.trim(), currentValue: form.currentValue.trim(),
      status: form.status, companyGoalId: form.companyGoalId || null, ownerMemberId: form.ownerMemberId || null,
    };
    if (editing) {
      updateGoal(g.id, patch);
      // R3 — 정의 변경마다 사유와 함께 이력 기록
      changed.forEach((f) => logGoalChange(g.id, { field: f.key, from: labelFor(f.key, g[f.key], companyGoals), to: labelFor(f.key, form[f.key], companyGoals), reason: reason.trim() }));
    } else {
      addGoal({ ...patch, quarter });
    }
    onClose();
  }

  return (
    <Modal
      title={editing ? "분기목표 편집" : "분기목표 추가"}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>취소</button><button className="btn btn-primary" onClick={save} disabled={!form.title.trim() || (needReason && !reason.trim())}>저장</button></>}
    >
      <div className="field">
        <label>목표 <span className="muted small">(이번 분기 반드시 만들 결과)</span></label>
        <input className="input" autoFocus value={form.title} placeholder="예: 결제 전환율 개선안 출시" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="field">
        <label>성공지표</label>
        <input className="input" value={form.successMetric} placeholder="예: 결제 완료율" onChange={(e) => setForm({ ...form, successMetric: e.target.value })} />
      </div>
      <div className="row2">
        <div className="field">
          <label>목표값</label>
          <input className="input" value={form.targetValue} placeholder="예: 85%" onChange={(e) => setForm({ ...form, targetValue: e.target.value })} />
        </div>
        <div className="field">
          <label>현재값 <span className="muted small">(진척)</span></label>
          <input className="input" value={form.currentValue} placeholder="예: 72%" onChange={(e) => setForm({ ...form, currentValue: e.target.value })} />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>상태</label>
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div className="field">
          <label>담당 팀원 <span className="muted small">(선택)</span></label>
          <select className="select" value={form.ownerMemberId} onChange={(e) => setForm({ ...form, ownerMemberId: e.target.value })}>
            <option value="">미지정</option>
            {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>회사목표 연결 <span className="muted small">(정렬)</span></label>
        <select className="select" value={form.companyGoalId} onChange={(e) => setForm({ ...form, companyGoalId: e.target.value })}>
          <option value="">연결 안 함</option>
          {companyGoals.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
        </select>
      </div>

      {needReason && (
        <div className="field">
          <label>변경 사유 <span style={{ color: "var(--red)" }}>*</span> <span className="muted small">({changed.map((f) => f.label).join(", ")} 변경)</span></label>
          <input className="input" value={reason} placeholder="왜 목표를 바꾸나요? (예: 상위 회사목표 조정)" onChange={(e) => setReason(e.target.value)} />
          <div className="hint">목표 정의를 바꾸면 이유가 이력으로 남습니다. 결과에 맞춰 목표를 사후에 고치는 것을 막기 위함입니다.</div>
        </div>
      )}
    </Modal>
  );
}

function labelFor(key, val, companyGoals) {
  if (key === "companyGoalId") return val ? (companyGoals.find((c) => c.id === val)?.title || "(연결)") : "";
  return val || "";
}

function CompanyGoalModal({ data, quarter, onClose }) {
  const editing = data.mode === "edit";
  const c = data.goal;
  const [form, setForm] = useState(
    editing ? { title: c.title || "", quarter: c.quarter || quarter, description: c.description || "" } : { title: "", quarter, description: "" }
  );
  function save() {
    if (!form.title.trim()) return;
    const patch = { title: form.title.trim(), quarter: form.quarter.trim(), description: form.description.trim() };
    if (editing) updateCompanyGoal(c.id, patch);
    else addCompanyGoal(patch);
    onClose();
  }
  return (
    <Modal
      title={editing ? "회사목표 편집" : "회사목표 추가"}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>취소</button><button className="btn btn-primary" onClick={save} disabled={!form.title.trim()}>저장</button></>}
    >
      <div className="field">
        <label>회사목표</label>
        <input className="input" autoFocus value={form.title} placeholder="예: 결제 부문 매출 20% 성장" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="field">
        <label>분기</label>
        <input className="input" value={form.quarter} placeholder="예: 2026-Q3" onChange={(e) => setForm({ ...form, quarter: e.target.value })} />
      </div>
      <div className="field">
        <label>설명 <span className="muted small">(선택)</span></label>
        <textarea className="textarea" value={form.description} placeholder="배경·맥락" onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
    </Modal>
  );
}
