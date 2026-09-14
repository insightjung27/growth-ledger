// 콜드스타트 예시 시드 [M11] — 목표→타당성→프로젝트→실행 한 흐름을 채워 빈 화면 데드락 방지.
// 빈 상태에서 '예시로 시작' 버튼에서만 호출. 사용자가 지우고 자기 데이터로 대체 가능.
import { addCompanyGoal, addKeyResult, getState, addFeasibilityCase, updateFeasibilityCase, addStakeholder, addProject, addMilestone, addTicket, addPrediction } from "./store.js";

export function seedExample() {
  const gid = addCompanyGoal({ title: "결제 완료율 개선으로 이탈 감소", kind: "objective", source: "exec", cycle: "2026Q3", confidence: "amber", memo: "예시 · 대표 지시 최우선(지우고 실제 목표로 교체하세요)" });
  addKeyResult(gid, { name: "결제 완료율", unit: "%", startValue: 68, targetValue: 75, currentValue: 71, confidence: "amber" });
  addKeyResult(gid, { name: "정산 오류", unit: "건/월", startValue: 12, targetValue: 0, currentValue: 5, confidence: "green" });
  const goal = getState().companyGoals.find((g) => g.id === gid);
  const krId = goal && goal.keyResults[0] ? goal.keyResults[0].id : null;

  const spid = addStakeholder({ name: "김이사(CTO·예시)", role: "execSponsor", org: "고객사", power: 5, interest: 4, stance: "supportive", notes: "완료율 지표에 민감 — 근거 숫자로 설득" });

  const cid = addFeasibilityCase({
    title: "결제 모듈 리뉴얼", problem: "레거시 결제 수기 운영 → 실패·정산오류 잦음", expectedOutcome: "완료율 +7%p, 정산오류 0",
    linkedGoalId: gid, linkedKrId: krId, confidence: 0.8, moscow: "must", contribution: "high",
    scores: { goalAlign: 5, value: 4, strategicFit: 4, feasibility: 3, risk: 3, cost: 4 },
  });

  const pid = addProject({ title: "결제 모듈 리뉴얼", goalId: gid, krId, caseId: cid, status: "executing", contribution: "high", stakeholderIds: [spid], startedAt: new Date().toISOString() });
  updateFeasibilityCase(cid, { projectId: pid, status: "executing" });
  addMilestone(pid, { name: "요구·범위 확정", done: true });
  addMilestone(pid, { name: "제안·임원 승인", done: false });

  addTicket({ title: "완료율 원인 3가지로 압축", projectId: pid, status: "doing", priority: "high", assigneeKind: "self" });
  addTicket({ title: "결제사 PM 미팅 주선", projectId: pid, status: "todo", priority: "med", assigneeKind: "stakeholder", assigneeId: spid, assigneeName: "김이사(CTO·예시)" });
  addTicket({ title: "경쟁사 결제 UX 스캔", priority: "low", assigneeKind: "self" });

  addPrediction({ question: "범위 축소안으로 진행하면 이익률 15% 이상 확보한다", probability: 0.6, resolveBy: "", tags: ["타당성"], linkedItemId: cid });
}
