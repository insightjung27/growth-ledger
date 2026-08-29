import { DEFAULT_STAGES } from "./store.js";
import { daysBetween } from "./format.js";

export function stageById(id) {
  return DEFAULT_STAGES.find((s) => s.id === id) || DEFAULT_STAGES[0];
}

export function weightedAmount(d) {
  return (Number(d.amount) || 0) * stageById(d.stageId).prob;
}

// 방치 신호(rotting): 다음행동 없거나 오래 미접촉이면 경고
export function rottingOf(d) {
  if (d.stageId === "won" || d.stageId === "lost") return null;
  const stale = daysBetween(d.lastContact);
  if (!d.nextWhat) return { level: "red", why: "다음행동 없음" };
  if (stale != null && stale > 21) return { level: "red", why: `${stale}일 방치` };
  if (stale != null && stale > 10) return { level: "amber", why: `${stale}일 경과` };
  return { level: "green", why: "진행 중" };
}

export function pipelineWeighted(deals) {
  return deals.filter((d) => d.stageId !== "lost").reduce((sum, d) => sum + weightedAmount(d), 0);
}
