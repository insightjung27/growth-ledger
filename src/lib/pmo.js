// PMO 집계(SSOT) + 상태 보고서 빌더. 대시보드(Pmo.jsx)와 보고서가 같은 계산을 공유.
import { isCompletedHandoff } from "./store.js";
import { daysBetween, isoDate, won } from "./format.js";
import { rottingOf, pipelineWeighted } from "./deal.js";

const STALE_DAYS = 14;
const REVIEW_SAMPLE = 3;

export function goalProgress(g) {
  const t = parseFloat(String(g.targetValue ?? "").replace(/[^0-9.\-]/g, ""));
  const c = parseFloat(String(g.currentValue ?? "").replace(/[^0-9.\-]/g, ""));
  if (!isFinite(t) || t === 0 || !isFinite(c)) return null;
  return Math.max(0, Math.min(1, c / t));
}
function meaningful(list) { return (list || []).filter((a) => a && String(a.what || "").trim()); }

// 상태 문자열
export const DEC_STATUS = [
  ["draft", "초안"], ["decided", "결정"], ["executing", "실행 중"], ["reviewed", "대조 완료"],
];

// state에서 PMO 관점 전체 집계
export function computePmo(state, now = new Date()) {
  const { decisions = [], deals = [], handoffs = [], oneOnOnes = [], quarterlyGoals = [], teamMembers = [] } = state || {};
  const today = isoDate(now);
  const activeMembers = teamMembers.filter((m) => m.active !== false);

  // 리스크 레지스터
  const risks = [];
  for (const h of handoffs) {
    if (h.status === "done") continue;
    const title = h.title || "(무제)";
    if (h.status === "blocked") { risks.push({ to: "/handoffs/" + h.id, sev: "high", kind: "과제 막힘", title, sub: h.blockedReason || "원인 해제 필요" }); continue; }
    if (h.deadline && h.deadline < today) { risks.push({ to: "/handoffs/" + h.id, sev: "high", kind: "과제 기한 초과", title, sub: `마감 ${h.deadline}` }); continue; }
    const cpDue = (h.checkpoints || []).some((c) => c.reached && !c.reviewed);
    if (cpDue) { risks.push({ to: "/handoffs/" + h.id, sev: "med", kind: "체크포인트 미점검", title, sub: "20/50/80 리뷰 필요" }); continue; }
    const stale = daysBetween(h.updatedAt, now);
    if (stale != null && stale > STALE_DAYS) risks.push({ to: "/handoffs/" + h.id, sev: "med", kind: `${stale}일 미갱신`, title, sub: "진행 확인" });
  }
  for (const d of decisions) {
    const title = d.title || "(제목 없음)";
    if (d.status === "executing" && d.reviewDate && d.reviewDate <= today) { risks.push({ to: "/decisions/" + d.id, sev: "high", kind: "판단 대조 기한 도래", title, sub: "예측 vs 실제 미확인" }); continue; }
    if (d.status === "decided" && meaningful(d.nextActions).length === 0) risks.push({ to: "/decisions/" + d.id, sev: "med", kind: "결정만 하고 실행 비었음", title, sub: "다음 행동·오너·기한" });
  }
  for (const d of deals) {
    if (d.stageId === "won" || d.stageId === "lost") continue;
    const rot = rottingOf(d, now);
    if (rot && rot.level === "red") risks.push({ to: "/deals/" + d.id, sev: "med", kind: "딜 방치", title: d.name || "(무제)", sub: rot.why || "다음 행동 필요" });
  }
  const sevRank = { high: 0, med: 1 };
  risks.sort((a, b) => (sevRank[a.sev] ?? 3) - (sevRank[b.sev] ?? 3));
  const riskHigh = risks.filter((r) => r.sev === "high").length;

  // 포트폴리오
  const hoOpen = handoffs.filter((h) => h.status !== "done" && h.status !== "blocked").length;
  const hoBlocked = handoffs.filter((h) => h.status === "blocked").length;
  const hoDone = handoffs.filter(isCompletedHandoff).length;

  // 의사결정
  const dc = { draft: 0, decided: 0, executing: 0, reviewed: 0 };
  decisions.forEach((d) => { if (dc[d.status] != null) dc[d.status] += 1; });
  const reviewed = decisions.filter((d) => d.status === "reviewed" && d.review && (d.review.hit === "hit" || d.review.hit === "miss"));
  const hits = reviewed.filter((d) => d.review.hit === "hit").length;
  const hitReady = reviewed.length >= REVIEW_SAMPLE;
  const hitText = hitReady ? Math.round((hits / reviewed.length) * 100) + "%" : "계측 불가";

  // 딜
  const weighted = pipelineWeighted(deals);
  const openDeals = deals.filter((d) => d.stageId !== "won" && d.stageId !== "lost").length;

  // 목표
  const goals = quarterlyGoals.map((g) => ({ g, p: goalProgress(g) }));

  // 리소스
  const resources = activeMembers.map((m) => {
    const active = handoffs.filter((h) => h.assigneeId === m.id && h.status !== "done").length;
    const dates = oneOnOnes.filter((o) => o.memberId === m.id && o.date).map((o) => o.date).sort();
    const last = dates.length ? dates[dates.length - 1] : null;
    const since = last ? daysBetween(last, now) : null;
    return { m, active, since };
  }).sort((a, b) => b.active - a.active);

  return {
    now, today, activeMembers,
    risks, riskHigh,
    portfolio: { hoOpen, hoBlocked, hoDone, hoTotal: handoffs.length },
    decisions: { dc, reviewedN: reviewed.length, hits, hitText, hitReady, REVIEW_SAMPLE },
    dealsAgg: { weighted, openDeals },
    goals, resources,
  };
}

const SEV_LABEL = { high: "긴급", med: "중" };

// 상태 보고서 마크다운(복사·다운로드용). 결정론 조립·정직 계측 유지.
export function buildPmoReportMarkdown(state, now = new Date()) {
  const p = computePmo(state, now);
  const L = [];
  L.push("# PMO 상태 보고서");
  L.push("");
  L.push(`발행: ${p.today}`);
  L.push("");
  L.push("## 요약");
  L.push(`- 리스크: ${p.risks.length}건 (긴급 ${p.riskHigh})`);
  L.push(`- 진행 중 과제: ${p.portfolio.hoOpen}건 (완결 ${p.portfolio.hoDone} · 막힘 ${p.portfolio.hoBlocked})`);
  L.push(`- 대조 적중률: ${p.decisions.hitText}${p.decisions.hitReady ? ` (대조 ${p.decisions.reviewedN}건 중 적중 ${p.decisions.hits})` : ` (표본 ${p.decisions.reviewedN}/${p.decisions.REVIEW_SAMPLE})`}`);
  L.push(`- 가중 파이프라인: ${won(p.dealsAgg.weighted)} (열린 딜 ${p.dealsAgg.openDeals})`);
  L.push("");

  L.push("## 리스크 · 이슈 (긴급순)");
  if (p.risks.length === 0) L.push("- 지금 리스크 신호 없음");
  else p.risks.forEach((r) => L.push(`- [${SEV_LABEL[r.sev] || "중"}] ${r.kind} — "${r.title}"${r.sub ? ` (${r.sub})` : ""}`));
  L.push("");

  L.push("## 진척");
  L.push("### 분기목표");
  if (p.goals.length === 0) L.push("- 등록된 분기목표 없음");
  else p.goals.forEach(({ g, p: pr }) => L.push(`- ${g.title || "(무제)"}: ${g.currentValue || "-"} / ${g.targetValue || "-"}${pr != null ? ` (${Math.round(pr * 100)}%)` : ""} · ${g.status}`));
  L.push("### 위임과제 포트폴리오");
  L.push(`- 진행 ${p.portfolio.hoOpen} · 막힘 ${p.portfolio.hoBlocked} · 완결(북극성) ${p.portfolio.hoDone} · 전체 ${p.portfolio.hoTotal}`);
  L.push("");

  L.push("## 의사결정");
  L.push(`- ${DEC_STATUS.map(([k, lab]) => `${lab} ${p.decisions.dc[k]}`).join(" · ")}`);
  L.push(`- 대조 적중률: ${p.decisions.hitText}`);
  L.push("");

  L.push("## 다음 액션 (우선순위)");
  const acts = p.risks.slice(0, 5);
  if (acts.length === 0) L.push("- 긴급 액션 없음 — 리듬 점검(주간 리뷰·1:1·대조)");
  else acts.forEach((r, i) => L.push(`${i + 1}. ${r.kind} — "${r.title}"`));
  L.push("");

  L.push("## 리소스");
  if (p.resources.length === 0) L.push("- 1인 단계 (팀원 없음)");
  else p.resources.forEach(({ m, active, since }) => L.push(`- ${m.name || "이름없음"}${m.area ? ` · ${m.area}` : ""}: 활성 과제 ${active} · 위임수준 L${m.levelCurrent || "-"}→L${m.levelTarget || "-"} · 최근 1:1 ${since == null ? "기록 없음" : since + "일 전"}`));
  L.push("");
  L.push("---");
  L.push("읽기 전용 자동 집계 · 성장원장 PMO");
  return L.join("\n");
}
