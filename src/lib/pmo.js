// PMO 집계(SSOT) + 상태 보고서 빌더. 대시보드(Pmo.jsx)와 보고서가 같은 계산을 공유.
// 정본: 전략목표=companyGoals, 부하=미완 handoff ∪ 미완 ticket(member), 실행리스크=사실기반.
import { isCompletedHandoff } from "./store.js";
import { daysBetween, isoDate, won, pct } from "./format.js";
import { rottingOf, pipelineWeighted } from "./deal.js";
import { goalRollup, executionRisks, pendingApprovals } from "./feasibility.js";
import { portfolioFinance, projectHealth } from "./finance.js";

const STALE_DAYS = 14;
const REVIEW_SAMPLE = 3;

function meaningful(list) { return (list || []).filter((a) => a && String(a.what || "").trim()); }

export const DEC_STATUS = [
  ["draft", "초안"], ["decided", "결정"], ["executing", "실행 중"], ["reviewed", "대조 완료"],
];

export function computePmo(state, now = new Date()) {
  const { decisions = [], deals = [], handoffs = [], oneOnOnes = [], companyGoals = [], teamMembers = [], projects = [], tickets = [] } = state || {};
  const today = isoDate(now);
  const activeMembers = teamMembers.filter((m) => m.active !== false);

  // ===== 리스크 레지스터 — 위임과제·판단·딜 + 실행계층(티켓·마일스톤) =====
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
  for (const r of executionRisks(state, now, STALE_DAYS)) risks.push(r);
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

  // 위임과제 포트폴리오
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

  // [M0] 전략목표(companyGoals) + 롤업
  const goals = companyGoals.map((g) => ({ g, r: goalRollup(g, projects, tickets) }));
  const goalsNoExec = goals.filter(({ r }) => r.hasNoExecution).length;

  // [재무] 포트폴리오 + 프로젝트 헬스
  const fin = portfolioFinance(projects);
  const activeProjects = projects.filter((p) => !["closed", "killed"].includes(p.status));
  let projRed = 0, projAmber = 0;
  const projHealth = activeProjects.map((p) => { const h = projectHealth(p, tickets, now); if (h.light === "red") projRed++; else if (h.light === "amber") projAmber++; return { p, h }; })
    .sort((a, b) => ({ red: 0, amber: 1, green: 2, gray: 3 }[a.h.light] - { red: 0, amber: 1, green: 2, gray: 3 }[b.h.light]));

  // [M1] 리소스 — 미완 handoff ∪ 미완 ticket(member) 합집합
  const resources = activeMembers.map((m) => {
    const myHo = handoffs.filter((h) => h.assigneeId === m.id && h.status !== "done");
    const myTk = tickets.filter((t) => t.assigneeKind === "member" && t.assigneeId === m.id && t.status !== "done");
    const items = [...myHo.map((h) => ({ due: h.deadline, blocked: h.status === "blocked" })), ...myTk.map((t) => ({ due: t.due, blocked: t.status === "blocked" }))];
    const open = items.length;
    const overdue = items.filter((it) => it.due && String(it.due).slice(0, 10) < today).length;
    const blocked = items.filter((it) => it.blocked).length;
    const dates = oneOnOnes.filter((o) => o.memberId === m.id && o.date).map((o) => o.date).sort();
    const last = dates.length ? dates[dates.length - 1] : null;
    const since = last ? daysBetween(last, now) : null;
    return { m, open, overdue, blocked, active: open, since };
  }).sort((a, b) => b.open - a.open);

  const approvals = pendingApprovals(state);

  return {
    now, today, activeMembers,
    risks, riskHigh,
    portfolio: { hoOpen, hoBlocked, hoDone, hoTotal: handoffs.length },
    decisions: { dc, reviewedN: reviewed.length, hits, hitText, hitReady, REVIEW_SAMPLE },
    dealsAgg: { weighted, openDeals },
    goals, goalsNoExec, fin, projHealth, projRed, projAmber, activeProjectN: activeProjects.length,
    resources, approvals,
  };
}

const SEV_LABEL = { high: "긴급", med: "중" };

// 상태 보고서 마크다운(복사·다운로드용). 결정론 조립·정직 계측 유지.
export function buildPmoReportMarkdown(state, now = new Date()) {
  const p = computePmo(state, now);
  const L = [];
  L.push("# 경영 · PMO 상태 보고서");
  L.push("");
  L.push(`발행: ${p.today}`);
  L.push("");

  L.push("## 경영 요약");
  L.push(`- 위험 프로젝트: ${p.projRed}건 (주의 ${p.projAmber} · 활성 ${p.activeProjectN})`);
  L.push(`- 리스크 신호: ${p.risks.length}건 (긴급 ${p.riskHigh})`);
  L.push(`- 가중 파이프라인: ${won(p.dealsAgg.weighted)} (열린 딜 ${p.dealsAgg.openDeals})`);
  L.push(`- 승인 대기: ${p.approvals.length}건`);
  L.push(`- 대조 적중률: ${p.decisions.hitText}${p.decisions.hitReady ? ` (대조 ${p.decisions.reviewedN}건 중 적중 ${p.decisions.hits})` : ` (표본 ${p.decisions.reviewedN}/${p.decisions.REVIEW_SAMPLE})`}`);
  L.push("");

  L.push("## 재무 요약");
  L.push(`- 포트폴리오 예산: ${won(p.fin.budget)} · 소진 ${won(p.fin.spent)}${p.fin.burnPct != null ? ` (${pct(p.fin.burnPct)})` : ""} · 잔여 ${won(p.fin.remaining)}`);
  L.push(`- 수주형 이익(실적): ${won(p.fin.profit)}`);
  if (p.fin.valueCreated) L.push(`- 내부 절감가치(추정): ${won(p.fin.valueCreated)}`);
  L.push(`- 재무위험 프로젝트: ${p.fin.atRisk}건`);
  L.push("");

  L.push("## 전략목표 진척");
  if (p.goals.length === 0) L.push("- 등록된 전략목표 없음 (목표 화면에서 추가)");
  else p.goals.forEach(({ g, r }) => L.push(`- ${g.title || "(무제)"}: 진척 ${r.progress != null ? r.progress + "%" : "—"} · 활성 프로젝트 ${r.activeCount} · 예산 ${won(r.budget)}${r.hasNoExecution ? " · ⚠️ 전략 미집행(프로젝트 0)" : ""}`));
  L.push("");

  L.push("## 프로젝트 포트폴리오 (헬스순)");
  if (p.projHealth.length === 0) L.push("- 활성 프로젝트 없음");
  else p.projHealth.forEach(({ p: pj, h }) => L.push(`- ${h.light === "red" ? "🔴 위험" : h.light === "amber" ? "🟡 주의" : "🟢 양호"} ${pj.title || "(무제)"}${h.reasons.length ? ` (${h.reasons.join(", ")})` : ""}`));
  L.push("");

  L.push("## 리스크 · 이슈 (긴급순)");
  if (p.risks.length === 0) L.push("- 지금 리스크 신호 없음");
  else p.risks.slice(0, 15).forEach((r) => L.push(`- [${SEV_LABEL[r.sev] || "중"}] ${r.kind} — "${r.title}"${r.sub ? ` (${r.sub})` : ""}`));
  L.push("");

  if (p.approvals.length) {
    L.push("## 승인 · 결정 대기");
    p.approvals.forEach((a) => L.push(`- ${a.kind} — "${a.title}"`));
    L.push("");
  }

  L.push("## 리소스 (부하순)");
  if (p.resources.length === 0) L.push("- 1인 단계 (팀원 없음)");
  else p.resources.forEach(({ m, open, overdue, blocked, since }) => L.push(`- ${m.name || "이름없음"}${m.area ? ` · ${m.area}` : ""}: 열린 ${open}${overdue ? ` · 기한초과 ${overdue}` : ""}${blocked ? ` · 막힘 ${blocked}` : ""} · 위임수준 L${m.levelCurrent || "-"}→L${m.levelTarget || "-"} · 최근 1:1 ${since == null ? "기록 없음" : since + "일 전"}`));
  L.push("");
  L.push("---");
  L.push("읽기 전용 자동 집계 · 성장원장 PMO");
  return L.join("\n");
}
