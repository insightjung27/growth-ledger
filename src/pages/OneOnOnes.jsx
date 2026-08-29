import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore, addOneOnOne, updateOneOnOne, removeOneOnOne, uid } from "../lib/store.js";
import { isoDate, relDate } from "../lib/format.js";
import { ONE_ON_ONE } from "../lib/guidance.js";
import Modal from "../components/Modal.jsx";

// 아젠다 4구간(코칭 지침 structure에 매핑) — 팀원이 가져온 주제(memberAgenda)를 맨 위로.
const AGENDA_FIELDS = [
  { key: "recent", label: "요즘 어떤가", tip: "최근 한 달 잘한 일 / 힘들었던 일", ph: "요즘 어떻게 지내는지 — 좋았던 것·힘들었던 것" },
  { key: "blockers", label: "업무에서 막히는 것", tip: "무엇이 진행을 막고 있나", ph: "지금 진행을 막는 걸림돌" },
  { key: "helpNeeded", label: "내가 도와줄 것", tip: "내가 무엇을 바꾸면 더 잘 일할 수 있나", ph: "리더인 내가 치워줘야 할 것 / 개입 여부" },
  { key: "growthCareer", label: "성장·피드백·커리어", tip: "생각시키는 질문으로 (답을 바로 주지 말 것)", ph: "성장 방향·피드백·커리어. 질문 뱅크에서 골라 던져보세요" },
];

function incompleteCount(s) {
  const a = (s.actionItems || []).filter((x) => !x.done).length;
  const c = (s.carriedOver || []).filter((x) => !x.done).length;
  return a + c;
}
function maxCarry(s) {
  return (s.carriedOver || []).reduce((m, x) => (!x.done ? Math.max(m, x.carryCount || 1) : m), 0);
}

export default function OneOnOnes() {
  const sessions = useStore((s) => s.oneOnOnes);
  const members = useStore((s) => s.teamMembers);
  const [params, setParams] = useSearchParams();
  const memberFilter = params.get("memberId");

  const [selId, setSelId] = useState(() => params.get("sessionId") || null);
  const [showNew, setShowNew] = useState(false);
  const [newMember, setNewMember] = useState(memberFilter || "");
  const [newDate, setNewDate] = useState(isoDate());
  const [focusField, setFocusField] = useState("growthCareer");

  // 진입 시 new=1이면 생성 모달 자동 오픈 + memberId 프리셀렉트(직전 미완 액션은 모달·createSession에서 buildCarry로 프리필)
  useEffect(() => {
    if (params.get("new") === "1") {
      setNewMember(memberFilter || (members[0]?.id || ""));
      setNewDate(isoDate());
      setShowNew(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberName = (mid) => members.find((m) => m.id === mid)?.name || "(삭제된 팀원)";

  // 필터 + 날짜 내림차순 정렬
  const visible = useMemo(() => {
    let list = sessions;
    if (memberFilter) list = list.filter((s) => s.memberId === memberFilter);
    return [...list].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [sessions, memberFilter]);

  // 선택 세션 결정(로컬 state가 유효하면 그것, 아니면 목록 최상단)
  const sel = useMemo(() => {
    const byId = sessions.find((s) => s.id === selId);
    if (byId && (!memberFilter || byId.memberId === memberFilter)) return byId;
    return visible[0] || null;
  }, [sessions, selId, visible, memberFilter]);

  const set = (patch) => sel && updateOneOnOne(sel.id, patch);

  // 직전 최신 회차의 미완 액션을 이월로 프리필
  function buildCarry(mid, date) {
    const prev = sessions
      .filter((s) => s.memberId === mid && (!date || (s.date || "") <= date))
      .sort((a, b) => ((b.date || "") < (a.date || "") ? -1 : 1))[0];
    if (!prev) return [];
    const carry = [];
    for (const a of prev.actionItems || []) {
      if (!a.done) carry.push({ id: uid(), text: a.text, owner: a.owner || "member", due: a.due || "", done: false, carryCount: 1 });
    }
    for (const c of prev.carriedOver || []) {
      if (!c.done) carry.push({ id: uid(), text: c.text, owner: c.owner || "member", due: c.due || "", done: false, carryCount: (c.carryCount || 1) + 1 });
    }
    return carry;
  }

  function createSession() {
    if (!newMember) return;
    const carriedOver = buildCarry(newMember, newDate);
    const nid = addOneOnOne({ memberId: newMember, date: newDate || isoDate(), carriedOver });
    setSelId(nid);
    setShowNew(false);
    setNewDate(isoDate());
  }

  /* ── 액션아이템 ── */
  function addAction() {
    if (!sel) return;
    set({ actionItems: [...(sel.actionItems || []), { id: uid(), text: "", owner: "member", due: "", done: false }] });
  }
  function updAction(id, patch) {
    set({ actionItems: (sel.actionItems || []).map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }
  function rmAction(id) {
    set({ actionItems: (sel.actionItems || []).filter((a) => a.id !== id) });
  }
  function toggleCarry(id) {
    set({ carriedOver: (sel.carriedOver || []).map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  }
  function promoteCarry(c) {
    // 이월 항목을 이번 회차의 정식 액션으로 승격(계속 굴러가는 것을 다시 붙잡기)
    set({
      actionItems: [...(sel.actionItems || []), { id: uid(), text: c.text, owner: c.owner || "member", due: c.due || "", done: false }],
      carriedOver: (sel.carriedOver || []).map((x) => (x.id === c.id ? { ...x, done: true } : x)),
    });
  }

  // 생각시키는 질문 클릭 → 현재 포커스된 아젠다 칸에 삽입(답 제공형 금지, 질문만)
  function insertQuestion(q) {
    if (!sel) return;
    const cur = sel[focusField] || "";
    const next = cur ? cur.replace(/\s*$/, "") + "\n- " + q : "- " + q;
    set({ [focusField]: next });
  }

  const noMembers = members.length === 0;

  // 코칭 신호 — 팀원 오너 비율(자기채점 아님, 계측만)
  const signal = useMemo(() => {
    if (!sel) return null;
    const acts = sel.actionItems || [];
    if (acts.length === 0) return null;
    const mem = acts.filter((a) => a.owner === "member").length;
    return { mem, total: acts.length, ratio: Math.round((mem / acts.length) * 100) };
  }, [sel]);

  const carryOverload = sel ? maxCarry(sel) >= 3 : false;

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>격주 1:1</h1>
          <p className="sub">팀원과의 격주 1:1 회차 기록. 진척 확인만 하면 실패입니다 — 생각하게 만드는 대화가 6개월 뒤 팀원을 키웁니다.</p>
        </div>
        <button className="btn btn-primary" disabled={noMembers} onClick={() => { setNewMember(memberFilter || (members[0]?.id || "")); setNewDate(isoDate()); setShowNew(true); }}>새 1:1</button>
      </div>

      {noMembers && (
        <div className="section">
          <div className="notice warn">먼저 팀원을 추가하세요. 1:1은 팀원별로 기록합니다. <Link to="/team">팀·구성원으로 이동</Link></div>
        </div>
      )}

      {memberFilter && !noMembers && (
        <div className="section between">
          <div className="small muted"><b>{memberName(memberFilter)}</b> 님의 1:1만 보는 중</div>
          <button className="btn btn-sm btn-ghost" onClick={() => setParams({})}>전체 보기</button>
        </div>
      )}

      {/* 지침 — 1:1 구조 4구간 + note */}
      <div className="section">
        <div className="notice info">
          <b>1:1 30~40분 구조:</b> {ONE_ON_ONE.structure.join(" · ")}
          <div style={{ marginTop: 6 }}>{ONE_ON_ONE.note}</div>
        </div>
      </div>

      <div className="section" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "start" }}>
        {/* 좌: 회차 목록 + 편집 */}
        <div className="stack" style={{ minWidth: 0, flex: "1.7 1 420px" }}>
          <div className="panel panel-pad">
            <div className="section-title" style={{ marginTop: 0 }}>회차 목록</div>
            {visible.length === 0 ? (
              <div className="empty" style={{ padding: "20px 8px" }}>
                <div className="em-ic">🗒️</div>
                <h3>아직 1:1 기록이 없습니다</h3>
                <div className="muted small">{noMembers ? "팀원을 먼저 추가하세요." : "‘새 1:1’로 첫 회차를 시작하세요."}</div>
              </div>
            ) : (
              <div className="stack">
                {visible.map((s) => {
                  const inc = incompleteCount(s);
                  const over = maxCarry(s) >= 3;
                  const active = sel && sel.id === s.id;
                  return (
                    <div key={s.id} className="li" style={active ? { outline: "2px solid var(--accent)", outlineOffset: 2, borderRadius: 10 } : undefined}>
                      <button className="li-main" style={{ textAlign: "left", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }} onClick={() => setSelId(s.id)}>
                        <div className="li-title">{memberName(s.memberId)}</div>
                        <div className="li-sub">{s.date || "날짜 미정"} · {relDate(s.date || s.createdAt)}</div>
                      </button>
                      {over && <span className="badge red">이월 과다</span>}
                      {inc > 0 ? <span className="badge amber">미완 {inc}</span> : <span className="badge green">정리됨</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {sel && (
            <div className="panel panel-pad">
              <div className="between" style={{ marginBottom: 4 }}>
                <div>
                  <div className="section-title" style={{ marginTop: 0, marginBottom: 2 }}>{memberName(sel.memberId)} · 1:1</div>
                  <input className="input" type="date" style={{ maxWidth: 180 }} value={sel.date || ""} onChange={(e) => set({ date: e.target.value })} />
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => { if (confirm("이 1:1 회차를 삭제할까요?")) { removeOneOnOne(sel.id); setSelId(null); } }}>삭제</button>
              </div>

              {carryOverload && (
                <div className="notice warn" style={{ marginBottom: 12 }}>이월이 3회차 이상 반복된 항목이 있습니다. ‘자율’이라는 방임일 수 있어요 — 함께 원인을 정의하거나(막힘/우선순위/역량) 과제를 재설계하세요.</div>
              )}

              {/* 팀원이 가져온 주제 — 맨 위 */}
              <div className="field">
                <label>팀원이 가져온 주제 <span className="muted small">(팀원 주도)</span></label>
                <textarea className="textarea" value={sel.memberAgenda || ""} placeholder="이 시간을 팀원이 먼저 채우게 — 팀원이 오늘 이야기하고 싶은 것" onChange={(e) => set({ memberAgenda: e.target.value })} />
                <div className="hint">1:1은 리더의 보고 시간이 아니라 팀원의 시간입니다. 팀원 아젠다부터 시작하세요.</div>
              </div>

              {/* 이월 액션 */}
              {(sel.carriedOver || []).length > 0 && (
                <div className="field">
                  <label>지난 회차 이월 <span className="muted small">(자동 프리필 · 완료 체크)</span></label>
                  <div className="stack">
                    {sel.carriedOver.map((c) => (
                      <div key={c.id} className="li">
                        <button className="chip" style={{ cursor: "pointer", background: c.done ? "var(--green-bg)" : "var(--paper-3)", color: c.done ? "var(--green)" : "var(--muted)" }} onClick={() => toggleCarry(c.id)} aria-pressed={c.done}>{c.done ? "완료 ✓" : "완료 체크"}</button>
                        <div className="li-main" style={{ minWidth: 0 }}>
                          <div className="li-title" style={c.done ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{c.text || "(내용 없음)"}</div>
                          <div className="li-sub">{c.owner === "self" ? "내 몫" : "팀원 몫"}{c.due ? ` · ${c.due}` : ""}{(c.carryCount || 1) >= 2 ? ` · ${c.carryCount}회차째 이월` : ""}</div>
                        </div>
                        {(c.carryCount || 1) >= 2 && <span className={"badge " + ((c.carryCount || 1) >= 3 ? "red" : "amber")}>×{c.carryCount}</span>}
                        {!c.done && <button className="btn btn-sm btn-ghost" onClick={() => promoteCarry(c)}>이번 액션으로</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 아젠다 4구간 */}
              {AGENDA_FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label} <span className="muted small">— {f.tip}</span></label>
                  <textarea className="textarea" value={sel[f.key] || ""} placeholder={f.ph} onFocus={() => setFocusField(f.key)} onChange={(e) => set({ [f.key]: e.target.value })} />
                </div>
              ))}

              {/* 액션아이템 */}
              <div className="field">
                <div className="between">
                  <label style={{ marginBottom: 0 }}>액션 아이템</label>
                  <button className="btn btn-sm btn-primary" onClick={addAction}>+ 추가</button>
                </div>
                {signal && (
                  <div className="hint" style={{ marginTop: 6 }}>코칭 신호(계측) — 팀원 오너 비율 <b>{signal.ratio}%</b> ({signal.mem}/{signal.total}). 내 몫만 늘면 내가 대신 해주는 것, 팀원 몫이 많을수록 위임·성장입니다.</div>
                )}
                <div className="stack" style={{ marginTop: 8 }}>
                  {(sel.actionItems || []).length === 0 ? (
                    <div className="muted small">아직 없습니다. 대화 끝에 ‘누가·무엇을·언제까지’를 남기세요.</div>
                  ) : (
                    sel.actionItems.map((a) => (
                      <div key={a.id} className="li" style={{ flexWrap: "wrap", gap: 8 }}>
                        <input type="checkbox" checked={!!a.done} onChange={(e) => updAction(a.id, { done: e.target.checked })} aria-label="완료" style={{ width: 18, height: 18 }} />
                        <input className="input" style={{ flex: "1 1 180px", minWidth: 0 }} value={a.text} placeholder="무엇을" onChange={(e) => updAction(a.id, { text: e.target.value })} />
                        <div className="seg">
                          <button className={a.owner === "self" ? "on" : ""} onClick={() => updAction(a.id, { owner: "self" })}>내 몫</button>
                          <button className={a.owner === "member" ? "on" : ""} onClick={() => updAction(a.id, { owner: "member" })}>팀원 몫</button>
                        </div>
                        <input className="input" type="date" style={{ maxWidth: 150 }} value={a.due || ""} onChange={(e) => updAction(a.id, { due: e.target.value })} />
                        <button className="x" onClick={() => rmAction(a.id)} aria-label="삭제">×</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 다음 회차 이월 메모 */}
              <div className="field">
                <label>다음 회차로 넘길 것 <span className="muted small">(다음 1:1에서 이어갈 화두)</span></label>
                <textarea className="textarea" value={sel.nextCarry || ""} placeholder="다음 번에 반드시 확인·이어갈 것" onChange={(e) => set({ nextCarry: e.target.value })} />
                <div className="hint">미완 액션은 다음 회차를 만들 때 자동으로 이월 프리필됩니다.</div>
              </div>
            </div>
          )}
        </div>

        {/* 우: 질문 뱅크 사이드패널 */}
        <div className="panel panel-pad" style={{ position: "sticky", top: 12, flex: "1 1 300px", minWidth: 0 }}>
          <div className="section-title" style={{ marginTop: 0 }}>질문 뱅크</div>
          <div className="notice info" style={{ marginBottom: 12 }}>답을 바로 고쳐주지 마세요. 생각하게 만드는 질문으로. {sel ? <>클릭하면 <b>‘{AGENDA_FIELDS.find((f) => f.key === focusField)?.label}’</b> 칸에 삽입됩니다.</> : "회차를 선택하면 클릭으로 삽입할 수 있습니다."}</div>

          <div className="small muted" style={{ marginBottom: 6, fontWeight: 650 }}>생각시키는 질문</div>
          <div className="stack" style={{ marginBottom: 14 }}>
            {ONE_ON_ONE.thinkingQuestions.map((q, i) => (
              <button key={i} className="li" style={{ textAlign: "left", cursor: sel ? "pointer" : "default", width: "100%", border: "none", background: "var(--paper-3)" }} disabled={!sel} onClick={() => insertQuestion(q)}>
                <div className="li-main"><div className="li-title" style={{ fontWeight: 500 }}>{q}</div></div>
                {sel && <span className="chip">삽입</span>}
              </button>
            ))}
          </div>

          <div className="small muted" style={{ marginBottom: 6, fontWeight: 650 }}>리더에게 던지는 질문(자기 점검)</div>
          <div className="stack">
            {ONE_ON_ONE.leaderQuestions.map((q, i) => (
              <button key={i} className="li" style={{ textAlign: "left", cursor: sel ? "pointer" : "default", width: "100%", border: "none", background: "var(--paper-3)" }} disabled={!sel} onClick={() => insertQuestion(q)}>
                <div className="li-main"><div className="li-title" style={{ fontWeight: 500 }}>{q}</div></div>
                {sel && <span className="chip">삽입</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showNew && (
        <Modal
          title="새 1:1 회차"
          onClose={() => setShowNew(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>취소</button>
            <button className="btn btn-primary" disabled={!newMember} onClick={createSession}>만들기</button>
          </>}
        >
          <div className="field">
            <label>팀원</label>
            <select className="select" value={newMember} onChange={(e) => setNewMember(e.target.value)}>
              <option value="">— 선택 —</option>
              {members.map((m) => (<option key={m.id} value={m.id}>{m.name || "(이름 없음)"}{m.area ? ` · ${m.area}` : ""}</option>))}
            </select>
          </div>
          <div className="field">
            <label>날짜</label>
            <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          {newMember && buildCarry(newMember, newDate).length > 0 && (
            <div className="notice info">직전 회차의 미완 액션 <b>{buildCarry(newMember, newDate).length}건</b>이 이월로 자동 프리필됩니다.</div>
          )}
        </Modal>
      )}
    </div>
  );
}
