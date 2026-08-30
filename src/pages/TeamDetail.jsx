import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useStore, updateTeamMember, removeTeamMember, setMemberLevel, DELEGATION_LEVELS,
} from "../lib/store.js";
import { relDate } from "../lib/format.js";
import { GUIDE_SECTIONS, EVAL_AXES } from "../lib/guidance.js";
import AutoSaved from "../components/AutoSaved.jsx";

const DELEGATE_GUIDE = GUIDE_SECTIONS.find((s) => s.id === "delegate");

// 성과 평가 — 기대값 대비 결과(호감도 아님)
const PERF_TIERS = [
  { id: "high", label: "고성과", cls: "green", desc: "기대 초과 — 더 큰 문제(업무→프로젝트→영역→결정권)로 확대·승급 후보" },
  { id: "meets", label: "기대 충족", cls: "gray", desc: "기대 수준 달성 — 다음 초점을 정한다" },
  { id: "low", label: "저성과", cls: "red", desc: "기대 미달 — 사실+기대수준을 명확히 하고 개선 기한·점검 지점을 정한다" },
];
const AXIS_LEVELS = [["low", "미흡"], ["meets", "충족"], ["high", "탁월"]];
const HO_STATUS = { assigned: "할당", in_progress: "진행중", review: "리뷰", done: "완결", blocked: "막힘" };

function promotionSignal(handoffs) {
  return handoffs.some(
    (h) => h.status === "done" && h.result?.autonomy === "solved_by_them" && h.result?.met === "met" && !h.result?.rework && (h.result?.reworkCount || 0) === 0
  );
}

function ChipEditor({ label, items, onChange, placeholder }) {
  const [txt, setTxt] = useState("");
  const list = items || [];
  function add() {
    const v = txt.trim();
    if (!v) return;
    onChange([...list, v]);
    setTxt("");
  }
  return (
    <div className="field">
      <label>{label}</label>
      <div className="gap-wrap" style={{ marginBottom: 8 }}>
        {list.length === 0 ? <span className="muted small">아직 없습니다.</span> : list.map((it, i) => (
          <span key={i} className="chip">{it}<span className="rm" onClick={() => onChange(list.filter((_, x) => x !== i))} role="button" aria-label="삭제">×</span></span>
        ))}
      </div>
      <div className="between" style={{ gap: 8 }}>
        <input className="input" value={txt} placeholder={placeholder} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-sm" onClick={add}>추가</button>
      </div>
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, empty }) {
  const [txt, setTxt] = useState("");
  const list = items || [];
  function add() {
    const v = txt.trim();
    if (!v) return;
    onChange([...list, v]);
    setTxt("");
  }
  return (
    <div className="panel panel-pad">
      <div className="between" style={{ gap: 8, marginBottom: list.length ? 12 : 0 }}>
        <input className="input" value={txt} placeholder={placeholder} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-sm btn-primary" onClick={add}>추가</button>
      </div>
      {list.length === 0 ? <div className="muted small">{empty}</div> : (
        <div className="stack">
          {list.map((it, i) => (
            <div key={i} className="li"><div className="li-main"><div className="li-title">{it}</div></div><button className="x" aria-label="삭제" onClick={() => onChange(list.filter((_, x) => x !== i))}>×</button></div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const member = useStore((s) => s.teamMembers.find((m) => m.id === id));
  const handoffs = useStore((s) => s.handoffs).filter((h) => h.assigneeId === id);
  const oneOnOnes = useStore((s) => s.oneOnOnes).filter((o) => o.memberId === id).sort((a, b) => ((a.date || a.createdAt) < (b.date || b.createdAt) ? 1 : -1));

  const [newLevel, setNewLevel] = useState(null);
  const [evRef, setEvRef] = useState("");
  const [evNote, setEvNote] = useState("");

  if (!member) {
    return (
      <div className="panel empty">
        <div className="em-ic">🔍</div>
        <h3>팀원을 찾을 수 없습니다</h3>
        <Link className="btn" to="/team">팀 목록으로</Link>
      </div>
    );
  }

  const set = (patch) => updateTeamMember(member.id, patch);
  const perf = member.performance || { tier: "", axes: {}, evidence: "", plan: "" };
  const tierObj = PERF_TIERS.find((t) => t.id === perf.tier);
  const setPerf = (patch) => set({ performance: { ...perf, ...patch, updatedAt: new Date().toISOString() } });
  const setAxis = (k, v) => { const axes = { ...(perf.axes || {}) }; axes[k] = axes[k] === v ? "" : v; setPerf({ axes }); };
  const promo = promotionSignal(handoffs);
  const atTarget = member.levelCurrent === member.levelTarget;
  const targetLow = member.levelTarget < member.levelCurrent;

  function applyLevel() {
    if (newLevel == null) return;
    const evidence = [evRef, evNote.trim()].filter(Boolean).join(" — ");
    if (!evidence) return; // 근거 없는 상향/변경 차단
    setMemberLevel(member.id, Number(newLevel), evidence);
    setNewLevel(null); setEvRef(""); setEvNote("");
  }

  function startOneOnOne() {
    nav("/one-on-ones?memberId=" + member.id + "&new=1");
  }

  const evidenceOptions = [
    ...handoffs.map((h) => ({ v: `위임과제: ${h.title || "(무제)"}`, k: "ho-" + h.id })),
    ...oneOnOnes.map((o) => ({ v: `1:1(${o.date || (o.createdAt || "").slice(0, 10)})`, k: "oo-" + o.id })),
  ];

  return (
    <div>
      <div className="page-head between">
        <div>
          <div className="tiny muted"><Link to="/team">팀·구성원</Link> / 상세</div>
          <h1>{member.name || "(이름 없음)"}</h1>
          <div style={{ marginTop: 4 }}><AutoSaved at={member.updatedAt} /></div>
        </div>
        <div className="gap-wrap">
          {member.active === false ? (
            <button className="btn btn-sm" onClick={() => set({ active: true })}>로스터 복귀</button>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm("이 팀원을 비활성(퇴사·이동) 처리할까요? 로스터에서는 빠지되 기록은 보존됩니다.")) set({ active: false }); }}>비활성(퇴사·이동)</button>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => { if (confirm("이 팀원의 기록을 영구 삭제할까요? 되돌릴 수 없습니다. (퇴사·이동만이면 비활성 처리를 쓰세요)")) { removeTeamMember(member.id); nav("/team"); } }}>기록 영구 삭제</button>
        </div>
      </div>

      {member.active === false && (
        <div className="notice warn section">
          비활성(퇴사·이동) 처리된 팀원입니다. 로스터에는 표시되지 않지만 기록은 보존됩니다. '로스터 복귀'로 되돌릴 수 있습니다.
        </div>
      )}

      {promo && (
        <div className="notice ok section">
          승급 후보 신호: 배정 위임과제를 <b>스스로 완결(재작업 없음·결과 충족)</b>했습니다. 자동 확정이 아니라 다음 1:1에서 확인하고 한 단계 올리세요.
        </div>
      )}

      {/* 프로필 */}
      <div className="section panel panel-pad">
        <div className="row2">
          <div className="field">
            <label>이름</label>
            <input className="input" value={member.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <label>담당 영역</label>
            <input className="input" value={member.area} placeholder="예: 결제 화면 기획" onChange={(e) => set({ area: e.target.value })} />
          </div>
        </div>
        <ChipEditor label="강점" items={member.strengths} placeholder="강점을 적고 Enter" onChange={(v) => set({ strengths: v })} />
        <ChipEditor label="성장영역" items={member.growthAreas} placeholder="성장영역을 적고 Enter" onChange={(v) => set({ growthAreas: v })} />
      </div>

      {/* 성과 평가 */}
      <div className="section">
        <div className="section-title">성과 평가 — 기대값 대비 결과</div>
        <div className="panel panel-pad">
          <div className="notice info" style={{ marginBottom: 12 }}>
            호감도가 아니라 <b>기대값 대비 결과</b>로 봅니다. 4축을 평가하고 종합 등급을 정하세요 — 저성과는 사실+기대수준으로, 고성과는 더 큰 문제로.
          </div>

          <div className="field">
            <label>종합 등급</label>
            <div className="tagset">
              {PERF_TIERS.map((t) => (
                <button key={t.id} className={perf.tier === t.id ? "on" : ""} style={perf.tier === t.id ? { borderColor: `var(--${t.cls === "gray" ? "muted-2" : t.cls})`, color: `var(--${t.cls === "gray" ? "ink" : t.cls})` } : undefined} onClick={() => setPerf({ tier: perf.tier === t.id ? "" : t.id })}>{t.label}</button>
              ))}
            </div>
            <div className="hint">{tierObj ? tierObj.desc : "미평가 — 등급을 선택하세요"}</div>
          </div>

          <div className="field">
            <label>평가 축 <span className="muted small">(4축 + 시니어 성장기여)</span></label>
            <div className="stack" style={{ gap: 10 }}>
              {EVAL_AXES.map((a) => (
                <div key={a.key} className="between" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}><div className="li-title" style={{ fontSize: 13.5 }}>{a.label} <span className="muted small">· {a.desc}</span></div></div>
                  <div className="seg" style={{ flex: "0 0 auto" }}>
                    {AXIS_LEVELS.map(([v, lab]) => (
                      <button key={v} className={(perf.axes || {})[a.key] === v ? "on" : ""} onClick={() => setAxis(a.key, v)}>{lab}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>사실 근거 <span className="muted small">(호감이 아니라 사실·수치·사례)</span></label>
            <textarea className="textarea" value={perf.evidence || ""} placeholder="예: 3개 프로젝트 중 2개 기한 초과, 재작업 2회 / 또는 결제 전환율 개선안을 스스로 완결" onChange={(e) => setPerf({ evidence: e.target.value })} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>{perf.tier === "low" ? "개선 계획 (사실 + 기대수준 + 기한·점검 지점)" : perf.tier === "high" ? "다음 큰 문제 (승급·확대)" : "다음 액션"}</label>
            <textarea className="textarea" value={perf.plan || ""} placeholder={perf.tier === "low" ? "기대수준을 명확히 하고 개선 기한과 중간 점검 지점을 정하세요" : perf.tier === "high" ? "업무 → 프로젝트 → 영역 → 결정권 → 사람. 다음 단계로 무엇을 맡길지" : "다음 분기 초점"} onChange={(e) => setPerf({ plan: e.target.value })} />
            {perf.updatedAt ? <div style={{ marginTop: 6 }}><span className="tiny muted">최근 평가 {relDate(perf.updatedAt)}</span></div> : null}
          </div>
        </div>
      </div>

      {/* 위임수준 */}
      <div className="section">
        <div className="section-title">위임수준 — 현재 → 목표</div>
        <div className="panel panel-pad">
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="gap-wrap">
              <span className="badge gray mono" style={{ fontSize: 14 }}>L{member.levelCurrent}</span>
              <span className="muted">→ 목표</span>
              <span className="badge green mono" style={{ fontSize: 14 }}>L{member.levelTarget}</span>
            </div>
            <div className="field" style={{ margin: 0, minWidth: 160 }}>
              <select className="select" value={member.levelTarget} onChange={(e) => set({ levelTarget: Number(e.target.value) })}>
                {DELEGATION_LEVELS.map((l) => (<option key={l.level} value={l.level}>목표 {l.name}</option>))}
              </select>
            </div>
          </div>

          {atTarget && (
            <div className="notice ok" style={{ marginBottom: 12 }}>
              현재 위임수준이 목표에 도달했습니다. 이 사람에게 <b>더 큰 문제(업무 → 프로젝트 → 영역 → 결정권)</b>를 맡길 때입니다. 목표를 한 단계 올려보세요.
            </div>
          )}
          {targetLow && (
            <div className="notice warn" style={{ marginBottom: 12 }}>
              목표 위임수준이 현재보다 낮습니다. 의도한 것이 아니라면 목표를 다시 확인하세요.
            </div>
          )}

          <div className="stack" style={{ marginBottom: 14 }}>
            {DELEGATION_LEVELS.map((l) => (
              <div key={l.level} className="li" style={{ padding: "8px 0" }}>
                <span className={"badge " + (l.level === member.levelCurrent ? "green" : l.level === member.levelTarget ? "amber" : "gray") + " mono"}>{l.name.split(" ")[0]}</span>
                <div className="li-main"><div className="li-title" style={{ fontWeight: 550 }}>{l.name.replace(/^L\d\s/, "")}</div><div className="li-sub">{l.desc}</div></div>
              </div>
            ))}
          </div>

          <div className="notice info" style={{ marginBottom: 14 }}>{DELEGATE_GUIDE?.body?.[0]}</div>

          {/* 현재 수준 변경 — 근거 필수 */}
          <div className="section-title">현재 위임수준 변경 (근거 필수)</div>
          <div className="row2">
            <div className="field">
              <label>새 현재 수준</label>
              <select className="select" value={newLevel ?? ""} onChange={(e) => setNewLevel(e.target.value === "" ? null : Number(e.target.value))}>
                <option value="">선택…</option>
                {DELEGATION_LEVELS.map((l) => (<option key={l.level} value={l.level}>{l.name}</option>))}
              </select>
            </div>
            <div className="field">
              <label>근거 참조 <span className="muted small">(위임과제·1:1)</span></label>
              <select className="select" value={evRef} onChange={(e) => setEvRef(e.target.value)}>
                <option value="">참조 선택(선택)</option>
                {evidenceOptions.map((o) => (<option key={o.k} value={o.v}>{o.v}</option>))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>근거 메모 <span className="muted small">(근거(참조 또는 메모) 중 하나 필수{evRef ? " · 참조 선택됨" : ""})</span></label>
            <input className="input" value={evNote} placeholder="왜 이 수준으로 조정하나요? (관찰된 사실)" onChange={(e) => setEvNote(e.target.value)} />
            <div className="hint">근거(참조 또는 메모) 없이는 변경할 수 없습니다. 슬라이더로 임의 상향을 막고, 실제 관찰에 근거해 육성 판단을 남기기 위함입니다.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={applyLevel} disabled={newLevel == null || !(evRef || evNote.trim())}>위임수준 변경 기록</button>
        </div>
      </div>

      {/* 변경 이력 */}
      <div className="section">
        <div className="section-title">위임수준 변경 이력</div>
        <div className="panel panel-pad">
          {(member.levelHistory || []).length === 0 ? (
            <div className="muted small">아직 변경 이력이 없습니다. 위에서 근거와 함께 수준을 조정하면 여기에 타임라인으로 남습니다.</div>
          ) : (
            <div className="stack">
              {member.levelHistory.slice().reverse().map((h, i) => (
                <div key={i} className="li">
                  <span className="badge gray mono">L{h.level}</span>
                  <div className="li-main">
                    <div className="li-title" style={{ fontWeight: 550 }}>{h.note || "(근거 없음)"}</div>
                    <div className="li-sub">{(h.at || "").slice(0, 10)} · {relDate(h.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* R2 — 수행 프로젝트 */}
      <div className="section">
        <div className="section-title">수행 프로젝트</div>
        <ListEditor items={member.projects} placeholder="맡고 있는 프로젝트" empty="맡은 프로젝트가 없습니다." onChange={(v) => set({ projects: v })} />
      </div>

      {/* R2 — 운영업무 */}
      <div className="section">
        <div className="section-title">운영업무 (반복·상시)</div>
        <ListEditor items={member.operations} placeholder="상시로 담당하는 운영업무" empty="등록된 운영업무가 없습니다." onChange={(v) => set({ operations: v })} />
      </div>

      {/* 배정된 위임과제 */}
      <div className="section">
        <div className="section-title">배정된 위임과제</div>
        <div className="panel panel-pad">
          {handoffs.length === 0 ? (
            <div className="muted small">이 사람에게 배정된 위임과제가 없습니다. <Link to="/handoffs">위임과제</Link>에서 6요소로 하나 넘겨보세요.</div>
          ) : (
            <div className="stack">
              {handoffs.map((h) => (
                <Link key={h.id} to={`/handoffs/${h.id}`} className="li" style={{ textDecoration: "none" }}>
                  <div className="li-main">
                    <div className="li-title">{h.title || "(무제)"}</div>
                    <div className="li-sub">위임수준 L{h.delegationLevel} · 진척 {h.progressPct || 0}%{h.deadline ? ` · 마감 ${h.deadline}` : ""}</div>
                  </div>
                  <span className={"badge " + (h.status === "done" ? "green" : h.status === "blocked" ? "red" : "gray")}>{HO_STATUS[h.status] || h.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1:1 이력 */}
      <div className="section">
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>1:1 이력</div>
          <button className="btn btn-sm btn-primary" onClick={startOneOnOne}>+ 새 1:1</button>
        </div>
        <div className="notice info" style={{ marginBottom: 12 }}>
          1:1은 진척 확인이 아닙니다. 요즘/막힌 것/도와줄 것/성장·커리어를 팀원 아젠다로 시작하고, 답을 바로 고쳐주지 말고 생각하게 만드는 질문으로 코칭하세요.
        </div>
        <div className="panel panel-pad">
          {oneOnOnes.length === 0 ? (
            <div className="muted small">아직 1:1 기록이 없습니다. 격주로 만나 장애물·성장을 다루면 6개월 뒤가 달라집니다.</div>
          ) : (
            <div className="stack">
              {oneOnOnes.map((o) => {
                const open = (o.actionItems || []).filter((a) => !a.done).length;
                return (
                  <Link key={o.id} to={"/one-on-ones?memberId=" + o.memberId + "&sessionId=" + o.id} className="li" style={{ textDecoration: "none" }}>
                    <div className="li-main">
                      <div className="li-title">{o.date || (o.createdAt || "").slice(0, 10)} · {relDate(o.date || o.createdAt)}</div>
                      <div className="li-sub">{o.memberAgenda ? `아젠다: ${o.memberAgenda}` : "아젠다 미기록"}{open ? ` · 미완 액션 ${open}건` : ""}</div>
                    </div>
                    <span className="btn btn-sm btn-ghost" style={{ pointerEvents: "none" }}>열기 →</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
