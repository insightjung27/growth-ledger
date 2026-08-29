import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useStore, updateHandoff, removeHandoff, DELEGATE_TYPES, delegateKind, DELEGATION_LEVELS,
} from "../lib/store.js";
import { SIX_ELEMENTS, REVIEW_CHECKPOINTS } from "../lib/guidance.js";
import { isoDate, relDate } from "../lib/format.js";
import AutoSaved from "../components/AutoSaved.jsx";

const STATUS_OPTS = [
  ["assigned", "할당"], ["in_progress", "진행중"], ["review", "리뷰 지점"], ["done", "완결"], ["blocked", "막힘"],
];
// 상태 세그먼트: '완결'은 제외한다. 완결 전환은 하단 '완결 처리'(met/autonomy 입력) 단일 경로로만.
const SEG_STATUS_OPTS = STATUS_OPTS.filter(([v]) => v !== "done");
const VERDICT_OPTS = [
  ["", "미점검"], ["on_track", "정상"], ["adjust", "수정"], ["rework", "재작업"], ["blocked", "막힘"],
];
const MET_OPTS = [["met", "충족"], ["partial", "부분"], ["miss", "미달"]];
const AUTONOMY_OPTS = [["solved_by_them", "그들이 해결"], ["needed_help", "개입 필요"], ["took_back", "회수함"]];
const LENS_KO = { direction: "방향", logic: "논리", quality: "품질" };

// 손상 방어: 체크포인트가 없거나 형식이 깨지면 지침 기본값으로 복구
function safeCheckpoints(h) {
  const cps = Array.isArray(h.checkpoints) ? h.checkpoints : [];
  return REVIEW_CHECKPOINTS.map((rc) => {
    const c = cps.find((x) => x && x.milestonePct === rc.pct) || {};
    return { milestonePct: rc.pct, lens: rc.lens, reached: !!c.reached, reviewed: !!c.reviewed, reviewedAt: c.reviewedAt || null, verdict: c.verdict || "", note: c.note || "" };
  });
}

export default function HandoffDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const h = useStore((s) => s.handoffs.find((x) => x.id === id));
  const members = useStore((s) => s.teamMembers);
  const deals = useStore((s) => s.deals);
  const decisions = useStore((s) => s.decisions);

  if (!h) {
    return (
      <div className="panel empty">
        <div className="em-ic">🔍</div>
        <h3>위임과제를 찾을 수 없습니다</h3>
        <Link className="btn" to="/handoffs">위임과제 목록으로</Link>
      </div>
    );
  }

  const set = (patch) => updateHandoff(h.id, patch);
  const cps = safeCheckpoints(h);
  const result = h.result || { met: "", rework: false, reworkCount: 0, autonomy: "", reviewNote: "", valueRealized: "" };
  const kind = delegateKind(h.delegateType);
  const assignee = members.find((m) => m.id === h.assigneeId) || null;
  const activeMembers = members.filter((m) => m.active !== false);

  // 파생
  const reachedPct = h.status === "done" ? 100 : cps.filter((c) => c.reached).reduce((m, c) => Math.max(m, c.milestonePct), 0);
  const reworkCount = cps.filter((c) => c.verdict === "rework").length;
  const authoritative = !!(h.authority && h.authority.trim() && h.authority.trim() !== "해당없음");
  const northStar = kind === "people" && (h.delegationLevel >= 3 || authoritative);
  const authorityMissing = !h.authority || !h.authority.trim();
  const overdue = !!h.deadline && ["assigned", "in_progress", "review"].includes(h.status) && h.deadline < isoDate();
  const promotable = h.status === "done" && result.met === "met" && result.autonomy === "solved_by_them" && !result.rework && reworkCount === 0;

  function updateCheckpoint(pct, patch) {
    const next = cps.map((c) => (c.milestonePct === pct ? { ...c, ...patch } : c));
    set({ checkpoints: next });
  }
  function toggleReached(pct) {
    const c = cps.find((x) => x.milestonePct === pct);
    updateCheckpoint(pct, { reached: !c.reached });
  }
  function toggleReviewed(pct) {
    const c = cps.find((x) => x.milestonePct === pct);
    const nowReviewed = !c.reviewed;
    updateCheckpoint(pct, { reviewed: nowReviewed, reviewedAt: nowReviewed ? new Date().toISOString() : null, reached: nowReviewed ? true : c.reached });
  }
  function setResult(patch) { set({ result: { ...result, ...patch } }); }

  const canComplete = !!result.met && !!result.autonomy;
  function complete() {
    if (!canComplete) return;
    set({ status: "done", completedAt: new Date().toISOString(), result: { ...result, reworkCount } });
  }
  function reopen() { set({ status: "in_progress", completedAt: null }); }

  return (
    <div>
      <div className="page-head between">
        <div style={{ minWidth: 0 }}>
          <div className="tiny muted"><Link to="/handoffs">위임과제</Link> / 상세</div>
          <h1>{h.title || "(제목 없음)"}</h1>
          <div className="gap-wrap" style={{ marginTop: 6 }}>
            <span className={"badge " + (STATUS_OPTS.find(([v]) => v === h.status) ? (h.status === "done" ? "green" : h.status === "blocked" ? "red" : h.status === "assigned" ? "gray" : "amber") : "gray")}>
              {STATUS_OPTS.find(([v]) => v === h.status)?.[1] || h.status}
            </span>
            {kind === "ax" && <span className="chip">AX 보조지표</span>}
            {northStar ? <span className="badge green">북극성 계상 대상</span> : <span className="badge gray">북극성 미계상</span>}
            {overdue && <span className="badge red">마감 지남</span>}
            <AutoSaved at={h.updatedAt} />
          </div>
        </div>
        <button className="btn btn-danger" onClick={() => { if (confirm("이 위임과제를 삭제할까요?")) { removeHandoff(h.id); nav("/handoffs"); } }}>삭제</button>
      </div>

      {/* 북극성 규율 안내 */}
      <div className={"notice section " + (northStar ? "ok" : "info")}>
        {kind === "ax"
          ? "AI·자동화 위임은 AX 레버리지(보조지표)로만 집계됩니다. 북극성(사람 위임 완결)에는 포함되지 않습니다."
          : northStar
            ? "실권을 이양한 위임입니다(L3+ 또는 권한 명시). 재작업 없이 완결되면 북극성으로 계상됩니다."
            : "이 위임은 L1~L2이고 권한 명시가 없어 북극성에 계상되지 않습니다. 실권을 넘겨야(L3+ 또는 권한 명시) 진짜 위임입니다."}
      </div>

      {/* ===== 지시 계약(6요소) ===== */}
      <div className="section">
        <div className="section-title">지시 계약 — 6요소</div>
        <div className="notice info" style={{ marginBottom: 10 }}>
          {SIX_ELEMENTS.map((e) => `${e.label}(${e.desc})`).join(" · ")}
        </div>
        <div className="panel panel-pad">
          <div className="field">
            <label>과제명</label>
            <input className="input" value={h.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>위임 대상</label>
              <div className="tagset">
                {DELEGATE_TYPES.map((t) => (
                  <button key={t.id} className={h.delegateType === t.id ? "on" : ""} onClick={() => set({ delegateType: t.id })}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>담당</label>
              <select className="select" value={h.assigneeId || ""} onChange={(e) => set({ assigneeId: e.target.value || null })}>
                <option value="">미지정</option>
                {activeMembers.map((m) => (<option key={m.id} value={m.id}>{m.name || "(이름 없음)"}</option>))}
              </select>
              {assignee && <div className="hint"><Link to={"/team/" + assignee.id}>{assignee.name} 상세로</Link></div>}
            </div>
          </div>
          <div className="field">
            <label>위임수준</label>
            <select className="select" value={h.delegationLevel} onChange={(e) => set({ delegationLevel: Number(e.target.value) })}>
              {DELEGATION_LEVELS.map((l) => (<option key={l.level} value={l.level}>{l.name} — {l.desc}</option>))}
            </select>
          </div>
          <div className="field">
            <label>결과 (OUTCOME)</label>
            <textarea className="textarea" value={h.outcome} placeholder="무엇이 달라져야 하는가" onChange={(e) => set({ outcome: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>지표 (METRIC)</label>
              <input className="input" value={h.metric} placeholder="성공을 어떻게 측정하는가" onChange={(e) => set({ metric: e.target.value })} />
            </div>
            <div className="field">
              <label>경계 (BOUNDARY)</label>
              <input className="input" value={h.boundary} placeholder="무엇을 건드리면 안 되는가" onChange={(e) => set({ boundary: e.target.value })} />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>권한 (AUTHORITY)</label>
              <input className="input" value={h.authority} placeholder="어디까지 본인이 결정하는가" onChange={(e) => set({ authority: e.target.value })} />
              <div className="gap-wrap" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-sm" onClick={() => set({ authority: "해당없음" })}>해당없음</button>
                {authorityMissing && <span className="tiny" style={{ color: "var(--amber)" }}>공란 불가 — 없으면 '해당없음'으로 명시하세요.</span>}
              </div>
            </div>
            <div className="field">
              <label>마감 (DEADLINE)</label>
              <input className="input" type="date" value={h.deadline || ""} onChange={(e) => set({ deadline: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>상태</label>
            <div className="seg">
              {SEG_STATUS_OPTS.map(([v, label]) => (
                <button key={v} className={h.status === v ? "on" : ""} onClick={() => set({ status: v })}>{label}</button>
              ))}
            </div>
            <div className="hint">완결은 하단 '완결 처리'(결과·자율도 입력)에서만 확정됩니다.</div>
          </div>
          {h.status === "blocked" && (
            <div className="field">
              <label>막힘 사유</label>
              <input className="input" value={h.blockedReason || ""} placeholder="무엇이 막혔고 무엇이 필요한가" onChange={(e) => set({ blockedReason: e.target.value })} />
            </div>
          )}
        </div>
      </div>

      {/* ===== 20/50/80 마일스톤 체크포인트 ===== */}
      <div className="section">
        <div className="section-title">20 / 50 / 80 마일스톤 점검 (작업 진척 도달을 수동 표시 — 시간 역산 아님)</div>
        <div className="notice info" style={{ marginBottom: 10 }}>
          20%에서 방향, 50%에서 논리, 80%에서 품질을 봅니다. 100%에서 처음 보면 되돌리는 비용이 너무 큽니다.
        </div>
        <div className="panel panel-pad stack" style={{ gap: 0 }}>
          {cps.map((c) => {
            const rc = REVIEW_CHECKPOINTS.find((r) => r.pct === c.milestonePct) || {};
            const needNote = c.verdict === "rework" && !c.note.trim();
            return (
              <div key={c.milestonePct} className="li" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div className="between">
                  <div className="li-title">{c.milestonePct}% · {LENS_KO[c.lens] || c.lens} <span className="tiny muted">{rc.tip}</span></div>
                  <div className="gap-wrap">
                    <button className={c.reached ? "chip" : "chip"} style={{ cursor: "pointer", background: c.reached ? "var(--green-bg)" : "var(--paper-3)", color: c.reached ? "var(--green)" : "var(--muted)" }} onClick={() => toggleReached(c.milestonePct)}>
                      {c.reached ? "도달 ✓" : "도달 표시"}
                    </button>
                    <button className="chip" style={{ cursor: "pointer", background: c.reviewed ? "var(--accent-weak)" : "var(--paper-3)", color: c.reviewed ? "var(--accent)" : "var(--muted)" }} onClick={() => toggleReviewed(c.milestonePct)}>
                      {c.reviewed ? "점검함 ✓" : "점검 표시"}
                    </button>
                  </div>
                </div>
                <div className="row2">
                  <div className="field" style={{ margin: 0 }}>
                    <select className="select" value={c.verdict} onChange={(e) => updateCheckpoint(c.milestonePct, { verdict: e.target.value })}>
                      {VERDICT_OPTS.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <input className="input" value={c.note} placeholder={c.verdict === "rework" ? "왜 되돌렸나 (필수)" : "코멘트"} onChange={(e) => updateCheckpoint(c.milestonePct, { note: e.target.value })} />
                  </div>
                </div>
                {c.reached && !c.reviewed && <div className="tiny" style={{ color: "var(--amber)" }}>도달했지만 아직 점검하지 않았습니다.</div>}
                {needNote && <div className="tiny" style={{ color: "var(--amber)" }}>재작업으로 판정했다면 '왜 되돌렸나'를 남겨야 다음에 반복하지 않습니다.</div>}
                {c.reviewed && c.reviewedAt && <div className="tiny muted">점검 {relDate(c.reviewedAt)}</div>}
              </div>
            );
          })}
          {reworkCount > 0 && <div className="notice warn" style={{ marginTop: 12 }}>재작업 판정 <b>{reworkCount}</b>회 누적. 반복된다면 위임수준·지시 명확성을 다시 보세요.</div>}
        </div>
      </div>

      {/* ===== 완결 결과 ===== */}
      <div className="section">
        <div className="section-title">완결 결과</div>
        <div className="panel panel-pad">
          <div className="field">
            <label>결과 (met)</label>
            <div className="seg">
              {MET_OPTS.map(([v, label]) => (<button key={v} className={result.met === v ? "on" : ""} onClick={() => setResult({ met: v })}>{label}</button>))}
            </div>
          </div>
          <div className="field">
            <label>자율도 — 어떻게 끝냈나</label>
            <div className="seg">
              {AUTONOMY_OPTS.map(([v, label]) => (<button key={v} className={result.autonomy === v ? "on" : ""} onClick={() => setResult({ autonomy: v })}>{label}</button>))}
            </div>
            <div className="hint">'회수함'은 결국 내가 다시 가져온 것 — 위임 실패 신호입니다. '그들이 해결'이 반복돼야 승급 후보가 됩니다.</div>
          </div>
          <div className="row2">
            <div className="field">
              <label>재작업 여부 (수동 확정)</label>
              <label className="gap-wrap" style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
                <input type="checkbox" checked={!!result.rework} onChange={(e) => setResult({ rework: e.target.checked })} />
                되돌려 다시 시킨 적 있음
              </label>
              <div className="gap-wrap" style={{ marginTop: 6 }}>
                <span className="chip" title="20/50/80 체크포인트에서 '재작업' 판정된 횟수 — 자동 집계(읽기전용)">체크포인트 재작업 {reworkCount}회</span>
                <span className="tiny muted">자동 집계 · 읽기전용</span>
              </div>
            </div>
            <div className="field">
              <label>실현 가치 (선택)</label>
              <input className="input" value={result.valueRealized} placeholder="예: 이탈 8%→3%, 월 300만원 방어" onChange={(e) => setResult({ valueRealized: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>리뷰 노트</label>
            <textarea className="textarea" value={result.reviewNote} placeholder="무엇이 좋았고 다음엔 무엇을 다르게 넘길지" onChange={(e) => setResult({ reviewNote: e.target.value })} />
          </div>
          <div className="gap-wrap">
            {h.status === "done" ? (
              <>
                <span className="badge green">완결 처리됨{h.completedAt ? ` · ${relDate(h.completedAt)}` : ""}</span>
                <button className="btn btn-sm" onClick={reopen}>완결 취소</button>
              </>
            ) : (
              <div>
                {!canComplete && <div className="tiny" style={{ color: "var(--amber)", marginBottom: 6 }}>결과와 자율도를 선택하면 완결</div>}
                <button className="btn btn-primary" disabled={!canComplete} onClick={complete}>완결 처리</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 승급 후보 배너 ===== */}
      {promotable && assignee && (
        <div className="notice ok section">
          <b>{assignee.name} 승급 후보 신호</b> — 재작업 없이 스스로 결과를 충족했습니다. 자동 확정은 하지 않습니다. 다음 1:1에서 근거를 확인하고 위임수준 상향을 결정하세요.{" "}
          <Link to={"/team/" + assignee.id}>{assignee.name} 상세 →</Link>
        </div>
      )}
      {promotable && !assignee && (
        <div className="notice ok section"><b>승급 후보 신호</b> — 재작업 없이 스스로 충족. 담당 팀원을 지정하면 승급 검토로 연결됩니다.</div>
      )}

      {/* ===== 연결 ===== */}
      <div className="section">
        <div className="section-title">연결</div>
        <div className="panel panel-pad">
          <div className="row2">
            <div className="field" style={{ margin: 0 }}>
              <label>연결된 딜</label>
              <select className="select" value={h.linkedDealId || ""} onChange={(e) => set({ linkedDealId: e.target.value || null })}>
                <option value="">없음</option>
                {deals.map((d) => (<option key={d.id} value={d.id}>{d.name || "(무제 딜)"}</option>))}
              </select>
              {h.linkedDealId && <div className="hint"><Link to={"/deals/" + h.linkedDealId}>딜 열기</Link></div>}
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>연결된 판단</label>
              <select className="select" value={h.linkedDecisionId || ""} onChange={(e) => set({ linkedDecisionId: e.target.value || null })}>
                <option value="">없음</option>
                {decisions.map((d) => (<option key={d.id} value={d.id}>{d.title || "(무제 판단)"}</option>))}
              </select>
              {h.linkedDecisionId && <div className="hint"><Link to={"/decisions/" + h.linkedDecisionId}>판단 열기</Link></div>}
            </div>
          </div>
          <div className="field" style={{ marginTop: 15, marginBottom: 0 }}>
            <label>메모</label>
            <textarea className="textarea" value={h.memo || ""} placeholder="맥락·배경 메모" onChange={(e) => set({ memo: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="tiny muted" style={{ marginTop: 8 }}>생성 {relDate(h.createdAt)} · 갱신 {relDate(h.updatedAt)} · 진척 {reachedPct}%</div>
    </div>
  );
}
