import { DEFAULT_STAGES } from "./store.js";
import { daysBetween } from "./format.js";

export function stageById(id) {
  return DEFAULT_STAGES.find((s) => s.id === id) || DEFAULT_STAGES[0];
}
export function weightedAmount(d) {
  return (Number(d.amount) || 0) * stageById(d.stageId).prob;
}

// 방치 신호(rotting): 다음행동 유무·마감일(nextWhen)·미접촉을 종합. 신규 딜은 즉시 빨강 아님.
export function rottingOf(d, now = new Date()) {
  if (d.stageId === "won" || d.stageId === "lost") return null;
  if (!d.nextWhat) {
    const age = daysBetween(d.createdAt, now);
    if (age != null && age <= 2) return { level: "amber", why: "다음행동 정하기" };
    return { level: "red", why: "다음행동 없음" };
  }
  if (d.nextWhen) {
    const due = daysBetween(d.nextWhen, now); // 양수 = 기한 지남
    if (due != null && due > 3) return { level: "red", why: `기한 ${due}일 초과` };
    if (due != null && due > 0) return { level: "amber", why: "기한 초과 직후" };
    return { level: "green", why: "예정대로" };
  }
  const stale = daysBetween(d.lastContact, now);
  if (stale != null && stale > 21) return { level: "red", why: `${stale}일 방치` };
  if (stale != null && stale > 10) return { level: "amber", why: `${stale}일 경과` };
  return { level: "green", why: "진행 중" };
}

export function pipelineWeighted(deals) {
  return deals.filter((d) => d.stageId !== "lost").reduce((sum, d) => sum + weightedAmount(d), 0);
}
