import { Link } from "react-router-dom";
import { useStore, isCompletedHandoff } from "../lib/store.js";
import { daysBetween, isoDate } from "../lib/format.js";
import { rottingOf, stageById, pipelineWeighted } from "../lib/deal.js";
import { won } from "../lib/format.js";

const STALE_DAYS = 14;
const REVIEW_SAMPLE = 3;

function goalProgress(g) {
  const t = parseFloat(String(g.targetValue ?? "").replace(/[^0-9.\-]/g, ""));
  const c = parseFloat(String(g.currentValue ?? "").replace(/[^0-9.\-]/g, ""));
  if (!isFinite(t) || t === 0 || !isFinite(c)) return null;
  return Math.max(0, Math.min(1, c / t));
}
function statusClass(s) {
  return s === "달성" ? "green" : s === "미달" ? "red" : s === "보류" ? "amber" : "gray";
}
function meaningful(list) { return (list || []).filter((a) => a && String(a.what || "").trim()); }

// 리스크 한 줄
function RiskRow({ to, sev, title, sub }) {
  const cls = sev === "high" ? "red" : sev === "med" ? "amber" : "gray";
  return (
    <Link to={to} className="li" style={{ textDecoration: "none" }}>
      <span className={"dot " + cls} style={{ marginTop: 7, flex: "0 0 auto" }} />
      <div className="li-main"><div className="li-title">{title}</div>{sub ? <div className="li-sub">{sub}</div> : null}</div>
      <span className="btn btn-sm" style={{ flex: "0 0 auto" }}>열기</span>
    </Link>
  );
}

export default function Pmo() {
  const decisions = useStore((s) => s.decisions);
  const deals = useStore((s) => s.deals);
  const handoffs = useStore((s) => s.handoffs);
  const oneOnOnes = useStore((s) => s.oneOnOnes);
  const quarterlyGoals = useStore((s) => s.quarterlyGoals);
  const members = useStore((s) => s.teamMembers);

  const now = new Date();
  const today = isoDate(now);
  const activeMembers = (members || []).filter((m) => m.active !== false);
  const memberName = (id) => (members.find((m) => m.id === id)?.name) || "미지정";

  // ===== 리스크 레지스터 =====
  const risks = [];
  // 위임과제 리스크
  for (const h of handoffs || []) {
    if (h.status === "done") continue;
    const title = h.title || "(무제)";
    if (h.status === "blocked") { risks.push({ to: "/handoffs/" + h.id, sev: "high", title: `과제 막힘 — "${title}"`, sub: h.blockedReason || "원인 해제 필요" }); continue; }
    if (h.deadline && h.deadline < today) { risks.push({ to: "/handoffs/" + h.id, sev: "high", title: `과제 기한 초과 — "${title}"`, sub: `마감 ${h.deadline}` }); continue; }
    const cpDue = (h.checkpoints || []).some((c) => c.reached && !c.reviewed);
    if (cpDue) { risks.push({ to: "/handoffs/" + h.id, sev: "med", title: `체크포인트 미점검 — "${title}"`, sub: "20/50/80 리뷰 필요" }); continue; }
    const stale = daysBetween(h.updatedAt, now);
    if (stale != null && stale > STALE_DAYS) risks.push({ to: "/handoffs/" + h.id, sev: "med", title: `과제 ${stale}일 미갱신 — "${title}"`, sub: "진행 확인" });
  }
  // 판단 리스크
  for (const d of decisions || []) {
    const title = d.title || "(제목 없음)";
    if (d.status === "executing" && d.reviewDate && d.reviewDate <= today) { risks.push({ to: "/decisions/" + d.id, sev: "high", title: `판단 대조 기한 도래 — "${title}"`, sub: "예측 vs 실제 미확인" }); continue; }
    if (d.status === "decided" && meaningful(d.nextActions).length === 0) risks.push({ to: "/decisions/" + d.id, sev: "med", title: `결정만 하고 실행 비었음 — "${title}"`, sub: "다음 행동·오너·기한" });
  }
  // 딜 리스크(방치)
  for (const d of deals || []) {
    if (d.stageId === "won" || d.stageId === "lost") continue;
    const rot = rottingOf(d, now);
    if (rot && rot.level === "red") risks.push({ to: "/deals/" + d.id, sev: "med", title: `딜 방치 — "${d.name || "(무제)"}"`, sub: rot.why || "다음 행동 필요" });
  }
  const sevRank = { high: 0, med: 1, gray: 2 };
  risks.sort((a, b) => (sevRank[a.sev] ?? 3) - (sevRank[b.sev] ?? 3));
  const riskHigh = risks.filter((r) => r.sev === "high").length;

  // ===== 과제 포트폴리오 =====
  const hoOpen = (handoffs || []).filter((h) => h.status !== "done" && h.status !== "blocked").length;
  const hoBlocked = (handoffs || []).filter((h) => h.status === "blocked").length;
  const hoDone = (handoffs || []).filter(isCompletedHandoff).length;

  // ===== 의사결정 파이프라인 =====
  const dc = { draft: 0, decided: 0, executing: 0, reviewed: 0 };
  (decisions || []).forEach((d) => { if (dc[d.status] != null) dc[d.status] += 1; });
  const reviewed = (decisions || []).filter((d) => d.status === "reviewed" && d.review && (d.review.hit === "hit" || d.review.hit === "miss"));
  const hits = reviewed.filter((d) => d.review.hit === "hit").length;
  const hitText = reviewed.length >= REVIEW_SAMPLE ? Math.round((hits / reviewed.length) * 100) + "%" : "계측 불가";

  // ===== 딜 파이프라인 =====
  const weighted = pipelineWeighted(deals || []);
  const openDeals = (deals || []).filter((d) => d.stageId !== "won" && d.stageId !== "lost").length;

  // ===== 리소스 부하 =====
  const load = activeMembers.map((m) => {
    const active = (handoffs || []).filter((h) => h.assigneeId === m.id && h.status !== "done").length;
    const dates = (oneOnOnes || []).filter((o) => o.memberId === m.id && o.date).map((o) => o.date).sort();
    const last = dates.length ? dates[dates.length - 1] : null;
    const since = last ? daysBetween(last, now) : null;
    return { m, active, since };
  }).sort((a, b) => b.active - a.active);

  return (
    <div>
      <div className="page-head">
        <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: "0.04em" }}>PMO 현황</div>
        <h1>과제·목표·판단 한눈에</h1>
        <p className="sub">여러 과제·목표·판단·딜을 프로젝트 관리 관점에서 자동 집계합니다. 입력 화면이 아니라 기존 데이터의 <b>렌즈</b>입니다 — 여기서는 기록하지 않고, 각 항목은 원래 화면으로 연결됩니다.</p>
      </div>

      {/* 요약 스탯 */}
      <div className="stat-row section">
        <div className="stat"><div className="k">리스크</div><div className="v" style={{ color: riskHigh > 0 ? "var(--red)" : risks.length > 0 ? "var(--amber)" : "var(--green)" }}>{risks.length}<small>건</small></div><div className="d">긴급(빨강) {riskHigh} · 막힘·기한초과·미대조 등</div></div>
        <div className="stat"><div className="k">진행 중 과제</div><div className="v">{hoOpen}<small>건</small></div><div className="d">완결 {hoDone} · 막힘 {hoBlocked}</div></div>
        <div className="stat"><div className="k">대조 적중률</div><div className="v">{hitText}</div><div className="d">{reviewed.length >= REVIEW_SAMPLE ? `대조 ${reviewed.length}건 중 적중 ${hits}` : `표본 ${reviewed.length}/${REVIEW_SAMPLE}`}</div></div>
      </div>

      {/* 리스크 레지스터 — 최상단(PMO 핵심) */}
      <div className="section">
        <div className="section-title">리스크 · 지금 봐야 할 것</div>
        <div className="panel panel-pad">
          {risks.length === 0 ? (
            <div className="muted small">지금 리스크 신호가 없습니다. 막힘·기한초과·미대조·방치가 생기면 여기 최상단에 뜹니다.</div>
          ) : (
            <div className="stack">
              {risks.slice(0, 12).map((r, i) => <RiskRow key={i} {...r} />)}
              {risks.length > 12 ? <div className="tiny muted">외 {risks.length - 12}건 — 각 화면에서 이어서 처리하세요.</div> : null}
            </div>
          )}
        </div>
      </div>

      {/* 과제 포트폴리오 + 분기목표 */}
      <div className="section row2">
        <div>
          <div className="section-title">위임과제 포트폴리오</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              <div className="kv"><div className="k">진행 중</div><div className="v">{hoOpen}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">막힘</div><div className="v" style={{ color: hoBlocked > 0 ? "var(--red)" : "var(--ink)" }}>{hoBlocked}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">완결(북극성)</div><div className="v" style={{ color: hoDone > 0 ? "var(--green)" : "var(--ink)" }}>{hoDone}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">전체</div><div className="v">{(handoffs || []).length}<small className="muted"> 건</small></div></div>
            </div>
            <div style={{ marginTop: 12 }}><Link to="/handoffs" className="btn btn-sm btn-block">위임과제 열기</Link></div>
          </div>
        </div>
        <div>
          <div className="section-title">분기목표 진척</div>
          <div className="panel panel-pad">
            {(quarterlyGoals || []).length === 0 ? (
              <div className="muted small">등록된 분기목표가 없습니다. <Link to="/team" style={{ color: "var(--accent)", fontWeight: 700 }}>팀</Link>에서 이번 분기 결과 3개를 정하세요.</div>
            ) : (
              <div className="stack">
                {(quarterlyGoals || []).map((g) => {
                  const p = goalProgress(g);
                  return (
                    <div key={g.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>
                      <div className="between"><div className="li-title" style={{ minWidth: 0 }}>{g.title || "(무제)"}</div><span className={"badge " + statusClass(g.status)}>{g.status}</span></div>
                      <div className="gap-wrap" style={{ marginTop: 4 }}>
                        <span className="tiny muted mono">{g.currentValue || "-"} / {g.targetValue || "-"}</span>
                        {p != null ? <span className="badge gray mono">{Math.round(p * 100)}%</span> : null}
                      </div>
                      {p != null && (
                        <div style={{ marginTop: 5, height: 5, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden" }}>
                          <div style={{ width: `${p * 100}%`, height: "100%", background: "var(--accent)" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 의사결정 파이프라인 + 딜 */}
      <div className="section row2">
        <div>
          <div className="section-title">의사결정 파이프라인</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              <div className="kv"><div className="k">초안</div><div className="v">{dc.draft}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">결정</div><div className="v">{dc.decided}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">실행 중</div><div className="v">{dc.executing}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">대조 완료</div><div className="v">{dc.reviewed}<small className="muted"> 건</small></div></div>
            </div>
            <div style={{ marginTop: 12 }}><Link to="/decisions" className="btn btn-sm btn-block">판단 원장 열기</Link></div>
          </div>
        </div>
        <div>
          <div className="section-title">딜 파이프라인</div>
          <div className="panel panel-pad">
            <div className="between" style={{ alignItems: "flex-end" }}>
              <div><div className="k tiny muted">가중 파이프라인</div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{won(weighted)}</div></div>
              <div className="tiny muted">열린 딜 {openDeals}건</div>
            </div>
            <div style={{ marginTop: 12 }}><Link to="/deals" className="btn btn-sm btn-block">딜 열기</Link></div>
          </div>
        </div>
      </div>

      {/* 리소스 부하 */}
      <div className="section">
        <div className="section-title">리소스 · 팀원별 부하</div>
        <div className="panel panel-pad">
          {activeMembers.length === 0 ? (
            <div className="muted small">1인 단계 — 팀원을 추가하면 팀원별 과제 부하·위임수준·1:1 경과가 여기 집계됩니다.</div>
          ) : (
            <div className="stack">
              {load.map(({ m, active, since }) => (
                <Link key={m.id} to={"/team/" + m.id} className="li" style={{ textDecoration: "none" }}>
                  <div className="li-main">
                    <div className="li-title">{m.name || "이름없음"} <span className="muted small">· {m.area || "영역 미지정"}</span></div>
                    <div className="li-sub">활성 과제 {active}건 · 위임수준 L{m.levelCurrent || "-"}→L{m.levelTarget || "-"} · 최근 1:1 {since == null ? "기록 없음" : since + "일 전"}</div>
                  </div>
                  <span className={"badge " + (active >= 4 ? "amber" : "gray")} style={{ flex: "0 0 auto" }}>{active}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="footer" style={{ padding: "8px 0 0" }}>읽기 전용 · 기록은 각 화면에서. 이 화면은 PMO 관점의 자동 집계 렌즈입니다.</div>
    </div>
  );
}
