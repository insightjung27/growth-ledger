// 클라이언트 전용 상태 저장소(localStorage). v2 — 두 기둥 데이터모델.
// v1 자산(deals·moneyTests·weeklyReviews·capabilities·백업/무음소실/손상방어) 승계 + 신규 엔티티.
import { useSyncExternalStore } from "react";
import { weekMonday, isoDate } from "./format.js";

const KEY = "growth-ledger:v1";
const PRE_KEY = "growth-ledger:pre-restore"; // 파괴적 연산(import/reset) 직전 1슬롯 스냅샷
const listeners = new Set();

export function uid() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const DEFAULT_STAGES = [
  { id: "lead", name: "리드", prob: 0.1 },
  { id: "meeting", name: "미팅", prob: 0.25 },
  { id: "proposal", name: "제안", prob: 0.45 },
  { id: "quote", name: "견적", prob: 0.6 },
  { id: "nego", name: "협상", prob: 0.75 },
  { id: "won", name: "수주", prob: 1 },
  { id: "lost", name: "실패", prob: 0 },
];
export const DELEGATE_TYPES = [
  { id: "person", label: "사람", kind: "people" },
  { id: "outsource", label: "외주", kind: "people" },
  { id: "ai", label: "AI", kind: "ax" },
  { id: "auto", label: "자동화", kind: "ax" },
];
export function delegateKind(typeId) { return DELEGATE_TYPES.find((t) => t.id === typeId)?.kind || "people"; }

/* ===== 북극성 '사람 위임 완결' 단일 정의(SSOT) =====
   '재작업 없이 상대가 실권을 받아 끝까지 소유' = met + solved_by_them + 무재작업 + 실권이양.
   Home·Weekly·Growth·Handoffs·HandoffDetail이 모두 이 함수만 쓴다. */
export function isRealPowerHandoff(h) {
  const lvl = Number(h.delegationLevel) || 0;
  const auth = (h.authority || "").trim();
  return lvl >= 3 || (auth && auth !== "해당없음");
}
export function isCompletedHandoff(h) {
  const r = (h && h.result) || {};
  return delegateKind(h && h.delegateType) === "people"
    && h && h.status === "done" && r.met === "met"
    && r.autonomy === "solved_by_them" && !r.rework
    && isRealPowerHandoff(h);
}

/* ===== 주 범위·귀속 (주간 롤업·요약 공용) ===== */
export function weekRange(weekOf) {
  const start = new Date(weekOf + "T00:00:00");
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return { startKey: weekOf, endKey: isoDate(end) };
}
export function inWeek(iso, range) {
  if (!iso) return false;
  const key = String(iso).slice(0, 10);
  return key >= range.startKey && key < range.endKey;
}
// 주간 위임 롤업: 수기 입력 대신 handoffs 원장에서 자동 집계(이중입력 제거).
export function handoffRollupOfWeek(weekOf, handoffs) {
  const r = weekRange(weekOf);
  const list = handoffs || [];
  const peopleCompleted = list.filter((h) => isCompletedHandoff(h) && inWeek(h.completedAt, r));
  const peopleHandedOffList = list.filter((h) => delegateKind(h.delegateType) === "people" && inWeek(h.createdAt, r));
  const axList = list.filter((h) => delegateKind(h.delegateType) === "ax" && inWeek(h.createdAt, r));
  const undatedDone = list.filter((h) => isCompletedHandoff(h) && !h.completedAt).length;
  return { peopleDone: peopleCompleted.length, peopleHandedOff: peopleHandedOffList.length, ax: axList.length, peopleCompleted, peopleHandedOffList, axList, undatedDone };
}

export const DECISION_TYPES = [
  { id: "money", label: "돈", desc: "수익·비용·투자 판단 → 머니테스트" },
  { id: "strategy", label: "전략", desc: "방향·베팅·우선순위" },
  { id: "resource", label: "리소스", desc: "인력·시간·예산 배분" },
  { id: "product", label: "제품", desc: "기능·범위·설계 판단" },
  { id: "people", label: "사람", desc: "채용·역할·조직 판단" },
  { id: "other", label: "기타", desc: "" },
];
export const DELEGATION_LEVELS = [
  { level: 1, name: "L1 조사·보고", desc: "조사해서 보고" },
  { level: 2, name: "L2 대안 제시", desc: "대안까지 만들어 보고" },
  { level: 3, name: "L3 추천·승인", desc: "추천안 제시하고 승인받아 실행" },
  { level: 4, name: "L4 결정·보고", desc: "스스로 결정하고 결과 보고" },
  { level: 5, name: "L5 영역 책임", desc: "영역 전체를 책임" },
];

function fresh() {
  const now = new Date().toISOString();
  return {
    version: 3,
    deals: [],
    moneyTests: [],
    weeklyReviews: [],
    decisions: [],
    teamMembers: [],
    handoffs: [],
    oneOnOnes: [],
    quarterlyGoals: [],
    // v3 — IT·비즈니스 정렬 백본 (기업목표→타당성→프로젝트→실행)
    companyGoals: [],
    feasibilityCases: [],
    projects: [],
    tasks: [],
    tickets: [],
    stakeholders: [],
    predictions: [],
    proposals: [],
    competencyEvidence: [],
    meta: { createdAt: now, lastOpenedAt: now, lastBackupAt: null, theme: "auto", tasksMigrated: false },
  };
}
const ARRAYS = ["deals", "moneyTests", "weeklyReviews", "decisions", "teamMembers", "handoffs", "oneOnOnes", "quarterlyGoals", "companyGoals", "feasibilityCases", "projects", "tasks", "tickets", "stakeholders", "predictions", "proposals", "competencyEvidence"];

function sanitize(obj) {
  const base = fresh();
  const s = { ...base, ...(obj && typeof obj === "object" ? obj : {}) };
  for (const k of ARRAYS) if (!Array.isArray(s[k])) s[k] = base[k];
  if (!s.meta || typeof s.meta !== "object") s.meta = base.meta;
  // 레코드 딥 백필 — 손상/구버전 백업 import 시 중첩 객체 누락으로 인한 크래시 방지
  s.decisions = s.decisions.map((x) => ({
    criteria: [], options: [], nextActions: [], framesUsed: [], ...x,
    premortem: { failureModes: [], killCriteria: "", ...(x && x.premortem) },
    decision: { chosenOptionId: null, rationale: "", ...(x && x.decision) },
    prediction: { expected: "", target: "", confidence: 60, ...(x && x.prediction) },
    review: { actualValue: "", hit: "", lesson: "", witness: "", evidenceRef: "", ...(x && x.review) },
  }));
  s.deals = s.deals.map((x) => ({
    ...x,
    customerQuestions: { ...(x && x.customerQuestions) },
    journey: { ...(x && x.journey) },
  }));
  s.handoffs = s.handoffs.map((x) => ({
    checkpoints: [], ...x,
    result: { met: "", rework: false, reworkCount: 0, autonomy: "", reviewNote: "", valueRealized: "", ...(x && x.result) },
  }));
  s.teamMembers = s.teamMembers.map((x) => ({ strengths: [], growthAreas: [], levelHistory: [], projects: [], operations: [], ...x, performance: { tier: "", axes: {}, evidence: "", plan: "", updatedAt: null, ...(x && x.performance) } }));
  s.oneOnOnes = s.oneOnOnes.map((x) => ({ actionItems: [], carriedOver: [], ...x }));
  s.quarterlyGoals = s.quarterlyGoals.map((x) => ({ changeLog: [], ...x }));
  // ===== v3 딥백필 — 중첩배열/객체 결측 방어(구버전 v2 백업·손상 import) =====
  s.companyGoals = s.companyGoals.map((x) => ({
    title: "", kind: "objective", source: "internal", cycle: "", status: "active", confidence: "amber", parentId: null, memo: "", ...x,
    keyResults: Array.isArray(x && x.keyResults) ? x.keyResults.map((k) => ({ id: uid(), name: "", unit: "", startValue: 0, targetValue: 0, currentValue: 0, confidence: "amber", ...k })) : [],
  }));
  s.feasibilityCases = s.feasibilityCases.map((x) => ({
    title: "", problem: "", expectedOutcome: "", intakeContent: "", analysis: null, linkedGoalId: null, linkedKrId: null, linkedDealId: null, moneyTestId: null,
    confidence: 0.8, timeCritical: false, moscow: "should", contribution: "med", status: "draft", decisionId: null, projectId: null, ...x,
    intakeLinks: Array.isArray(x && x.intakeLinks) ? x.intakeLinks : [],
    scores: { goalAlign: null, value: null, strategicFit: null, feasibility: null, risk: null, cost: null, ...(x && x.scores) },
    gates: { compliance: true, reversibility: "reversible", budgetFit: true, ...(x && x.gates) },
  }));
  s.projects = s.projects.map((x) => ({
    title: "", goalId: null, krId: null, caseId: null, proposalId: null, dealId: null, status: "proposed", selfExec: false, contribution: "med", startedAt: null, closedAt: null, ...x,
    stakeholderIds: Array.isArray(x && x.stakeholderIds) ? x.stakeholderIds : [],
    handoffIds: Array.isArray(x && x.handoffIds) ? x.handoffIds : [],
    taskIds: Array.isArray(x && x.taskIds) ? x.taskIds : [],
    milestones: Array.isArray(x && x.milestones) ? x.milestones.map((m) => ({ id: uid(), name: "", targetDate: "", done: false, ...m })) : [],
    finance: { mode: "earn", budget: 0, revenue: 0, currency: "KRW", ...(x && x.finance), costLines: Array.isArray(x && x.finance && x.finance.costLines) ? x.finance.costLines.map((l) => ({ id: uid(), category: "labor", label: "", planned: 0, actual: 0, ...l })) : [] },
  }));
  s.tasks = s.tasks.map((x) => ({ title: "", projectId: null, status: "todo", priority: "med", due: "", inbox: false, note: "", ...x }));
  s.tickets = (Array.isArray(s.tickets) ? s.tickets : []).map((x) => ({
    title: "", description: "", projectId: null, assigneeKind: "self", assigneeId: null, assigneeName: "", status: "todo", priority: "med", due: "", isDelegation: false, ...x,
    delegation: { level: 2, outcome: "", metric: "", boundary: "", authority: "", checkpoints: [], result: { met: "", autonomy: "", rework: false, note: "" }, ...(x && x.delegation) },
  }));
  // 레거시 tasks → 통합 tickets 1회 이관(assignee=self)
  if (!s.meta.tasksMigrated && Array.isArray(s.tasks) && s.tasks.length) {
    const conv = s.tasks.map((t) => ({
      id: uid(), title: t.title || "", description: t.note || "", projectId: t.projectId || null,
      assigneeKind: "self", assigneeId: null, assigneeName: "", status: t.status === "done" ? "done" : t.status === "doing" ? "doing" : "todo",
      priority: t.priority || "med", due: t.due || "", isDelegation: false,
      delegation: { level: 2, outcome: "", metric: "", boundary: "", authority: "", checkpoints: [], result: { met: "", autonomy: "", rework: false, note: "" } },
      createdAt: t.createdAt || new Date().toISOString(), updatedAt: t.updatedAt || new Date().toISOString(),
    }));
    s.tickets = [...conv, ...s.tickets];
    s.tasks = [];
    s.meta.tasksMigrated = true;
  }
  s.stakeholders = s.stakeholders.map((x) => ({ name: "", role: "other", org: "", contact: "", power: 3, interest: 3, stance: "unclear", notes: "", ...x, projectIds: Array.isArray(x && x.projectIds) ? x.projectIds : [] }));
  s.predictions = s.predictions.map((x) => ({ question: "", probability: 0.6, resolveBy: "", resolution: null, resolvedAt: null, linkedItemId: null, ...x, tags: Array.isArray(x && x.tags) ? x.tags : [] }));
  s.proposals = s.proposals.map((x) => ({ title: "", caseId: null, linkedGoalId: null, recommendation: "", theAsk: "", decisionBy: "", status: "draft", ...x, stakeholderIds: Array.isArray(x && x.stakeholderIds) ? x.stakeholderIds : [], sections: Array.isArray(x && x.sections) ? x.sections : [], proofPoints: Array.isArray(x && x.proofPoints) ? x.proofPoints : [], risks: Array.isArray(x && x.risks) ? x.risks : [] }));
  s.competencyEvidence = s.competencyEvidence.map((x) => ({ competencyId: "", date: "", whatIDid: "", impact: "", sourceItemId: null, ...x }));
  if (!s.meta.theme) s.meta.theme = "auto";
  return s;
}

/* persist 실패 감지 */
let persistError = false;
const errListeners = new Set();
function setPersistError(v) { if (persistError !== v) { persistError = v; errListeners.forEach((l) => l()); } }
export function usePersistError() {
  return useSyncExternalStore((cb) => { errListeners.add(cb); return () => errListeners.delete(cb); }, () => persistError, () => persistError);
}

let state = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (!raw) return fresh(); return sanitize(JSON.parse(raw)); } catch (e) { return fresh(); }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); setPersistError(false); return true; } catch (e) { setPersistError(true); return false; } }
// 클라우드 동기화 훅(cloud.js가 등록). 로컬 변경 시 호출 → 디바운스 업로드.
let onLocalChange = null;
export function registerSync(cb) { onLocalChange = cb; }
function emit() { persist(); listeners.forEach((l) => l()); if (onLocalChange) { try { onLocalChange(); } catch (e) {} } }
// 클라우드에서 받은 상태를 적용(로컬 미러 + 리렌더, 단 클라우드로 되쏘지 않음 = 에코 방지)
export function applyCloudState(next) { state = sanitize(next && typeof next === "object" ? next : {}); persist(); listeners.forEach((l) => l()); }
export function recordCount(s) { return ARRAYS.reduce((n, k) => n + (s && Array.isArray(s[k]) ? s[k].length : 0), 0); }
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function useStore(selector = (s) => s) { return useSyncExternalStore(subscribe, () => selector(state), () => selector(state)); }
export function setState(updater) { state = typeof updater === "function" ? updater(state) : { ...state, ...updater }; emit(); }
export function getState() { return state; }

/* 제네릭 컬렉션 CRUD */
function coll(key, defaults) {
  return {
    add(partial) { const now = new Date().toISOString(); const rec = { id: uid(), createdAt: now, updatedAt: now, ...(defaults ? defaults() : {}), ...partial }; setState((s) => ({ ...s, [key]: [rec, ...(s[key] || [])] })); return rec.id; },
    update(id, patch) { setState((s) => ({ ...s, [key]: (s[key] || []).map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)) })); },
    remove(id) { setState((s) => ({ ...s, [key]: (s[key] || []).filter((x) => x.id !== id) })); },
    get(id) { return (state[key] || []).find((x) => x.id === id) || null; },
  };
}

/* ===== 딜 ===== */
export function addDeal(partial) {
  const now = new Date().toISOString();
  const deal = { id: uid(), name: "", amount: 0, stageId: "lead", nextWhat: "", nextWho: "본인", nextWhen: "", lastContact: now, priceReaction: "", lostReason: "", memo: "", outcome: "", moneyTestId: null, decisionId: null,
    customerQuestions: { current: "", problem: "", impact: "", importance: "", pastSolutions: "", failReason: "", budget: "", decisionMaker: "", timeline: "", successCriteria: "" },
    journey: { requirements: "", proposal: "", quote: "", nego: "", contract: "" },
    createdAt: now, updatedAt: now, ...partial };
  setState((s) => ({ ...s, deals: [deal, ...s.deals] }));
  return deal.id;
}
export function updateDeal(id, patch) { setState((s) => ({ ...s, deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)) })); }
export function removeDeal(id) { setState((s) => ({ ...s, deals: s.deals.filter((d) => d.id !== id), feasibilityCases: s.feasibilityCases.map((c) => (c.linkedDealId === id ? { ...c, linkedDealId: null } : c)), projects: s.projects.map((p) => (p.dealId === id ? { ...p, dealId: null } : p)) })); }
export function getDeal(id) { return state.deals.find((d) => d.id === id) || null; }

/* ===== 머니테스트 ===== */
export function addMoneyTest(mt) { const now = new Date().toISOString(); const rec = { id: uid(), createdAt: now, updatedAt: now, actualOutcome: "", actualPayback: null, decisionId: null, dealId: null, ...mt }; setState((s) => ({ ...s, moneyTests: [rec, ...s.moneyTests] })); return rec.id; }
export function updateMoneyTest(id, patch) { setState((s) => ({ ...s, moneyTests: s.moneyTests.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)) })); }
export function removeMoneyTest(id) { setState((s) => ({ ...s, moneyTests: s.moneyTests.filter((m) => m.id !== id), deals: s.deals.map((d) => (d.moneyTestId === id ? { ...d, moneyTestId: null } : d)), decisions: s.decisions.map((x) => (x.moneyTestId === id ? { ...x, moneyTestId: null } : x)), feasibilityCases: s.feasibilityCases.map((c) => (c.moneyTestId === id ? { ...c, moneyTestId: null } : c)) })); }
export function getMoneyTest(id) { return state.moneyTests.find((m) => m.id === id) || null; }

/* ===== 판단(Decision) 원장 [기둥①] ===== */
const _dec = coll("decisions", () => ({
  title: "", type: "strategy", question: "", criteria: [], criteriaLockedAt: null, options: [], reversibility: "reversible",
  deadline: "", status: "draft", framesUsed: [], premortem: { failureModes: [], killCriteria: "" },
  decision: { chosenOptionId: null, rationale: "" }, decidedAt: null,
  prediction: { expected: "", target: "", confidence: 60 }, predictionLockedAt: null,
  reviewDate: "", review: { actualValue: "", hit: "", lesson: "", witness: "", evidenceRef: "" }, reviewedAt: null,
  nextActions: [], moneyTestId: null,
}));
export const addDecision = _dec.add, updateDecision = _dec.update, getDecision = _dec.get;
export function removeDecision(id) {
  setState((s) => ({ ...s, decisions: s.decisions.filter((x) => x.id !== id), deals: s.deals.map((d) => (d.decisionId === id ? { ...d, decisionId: null } : d)), moneyTests: s.moneyTests.map((m) => (m.decisionId === id ? { ...m, decisionId: null } : m)), feasibilityCases: s.feasibilityCases.map((c) => (c.decisionId === id ? { ...c, decisionId: null } : c)) }));
}

/* ===== 분기 목표 [기둥② 항목6·R3] ===== */
const _qg = coll("quarterlyGoals", () => ({ quarter: "", title: "", successMetric: "", targetValue: "", currentValue: "", ownerMemberId: null, status: "진행중", changeLog: [], memo: "" }));
export const addGoal = _qg.add, updateGoal = _qg.update, removeGoal = _qg.remove, getGoal = _qg.get;
export function logGoalChange(id, change) { // R3 변경 이력
  setState((s) => ({ ...s, quarterlyGoals: s.quarterlyGoals.map((g) => (g.id === id ? { ...g, changeLog: [...(g.changeLog || []), { at: new Date().toISOString(), ...change }], updatedAt: new Date().toISOString() } : g)) }));
}

/* ===== 팀원 [기둥② R2] ===== */
const _tm = coll("teamMembers", () => ({ name: "", area: "", strengths: [], growthAreas: [], levelCurrent: 2, levelTarget: 3, levelHistory: [], projects: [], operations: [], active: true, memo: "", performance: { tier: "", axes: {}, evidence: "", plan: "", updatedAt: null } }));
export const addTeamMember = _tm.add, removeTeamMember = _tm.remove, getTeamMember = _tm.get;
export function updateTeamMember(id, patch) { _tm.update(id, patch); }
export function setMemberLevel(id, level, evidence) { // 위임수준 변경 — 근거참조 필수
  setState((s) => ({ ...s, teamMembers: s.teamMembers.map((m) => (m.id === id ? { ...m, levelCurrent: level, levelHistory: [...(m.levelHistory || []), { level, at: new Date().toISOString(), note: evidence || "" }], updatedAt: new Date().toISOString() } : m)) }));
}

/* ===== 위임과제(Handoff) [기둥② 항목7] ===== */
const _ho = coll("handoffs", () => ({
  title: "", originWho: "본인", assigneeId: null, delegateType: "person", delegationLevel: 2,
  outcome: "", metric: "", boundary: "", authority: "", deadline: "", status: "assigned", progressPct: 0,
  checkpoints: [{ milestonePct: 20, lens: "direction", reached: false, reviewed: false, reviewedAt: null, verdict: "", note: "" }, { milestonePct: 50, lens: "logic", reached: false, reviewed: false, reviewedAt: null, verdict: "", note: "" }, { milestonePct: 80, lens: "quality", reached: false, reviewed: false, reviewedAt: null, verdict: "", note: "" }],
  blockedReason: "", result: { met: "", rework: false, reworkCount: 0, autonomy: "", reviewNote: "", valueRealized: "" },
  linkedDecisionId: null, linkedDealId: null, memo: "", completedAt: null,
}));
export const addHandoff = _ho.add, updateHandoff = _ho.update, removeHandoff = _ho.remove, getHandoff = _ho.get;

/* ===== 격주 1:1 [기둥② 항목5] ===== */
const _oo = coll("oneOnOnes", () => ({ memberId: null, date: "", memberAgenda: "", recent: "", blockers: "", helpNeeded: "", growthCareer: "", actionItems: [], carriedOver: [], nextCarry: "" }));
export const addOneOnOne = _oo.add, updateOneOnOne = _oo.update, removeOneOnOne = _oo.remove, getOneOnOne = _oo.get;

/* ===== 주간 자기리뷰 [항목8] ===== */
export function currentWeekKey() { return weekMonday(new Date()); }
export function getWeekly(weekOf) { return state.weeklyReviews.find((w) => w.weekOf === weekOf) || null; }
export function upsertWeekly(weekOf, patch) {
  setState((s) => {
    const exists = s.weeklyReviews.find((w) => w.weekOf === weekOf);
    if (exists) return { ...s, weeklyReviews: s.weeklyReviews.map((w) => (w.weekOf === weekOf ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)) };
    const rec = { id: uid(), weekOf, solvedSelf: [], delegated: [], nextDelegation: "", pillarSnapshot: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...patch };
    return { ...s, weeklyReviews: [rec, ...s.weeklyReviews] };
  });
}

/* ========================= v3 — IT·비즈니스 정렬 백본 ========================= */

/* ----- [M1] 기업·고객사 목표 + KeyResults (얇은 SSOT·진척은 파생) ----- */
export const GOAL_KINDS = [{ id: "pillar", label: "전략기둥" }, { id: "objective", label: "목표" }];
export const GOAL_SOURCES = [{ id: "client", label: "고객사" }, { id: "exec", label: "임원/경영" }, { id: "internal", label: "내부" }];
const _cg = coll("companyGoals", () => ({ title: "", kind: "objective", source: "internal", cycle: "", status: "active", confidence: "amber", parentId: null, keyResults: [], memo: "" }));
export const addCompanyGoal = _cg.add, updateCompanyGoal = _cg.update, getCompanyGoal = _cg.get;
export function removeCompanyGoal(id) {
  setState((s) => {
    const g = s.companyGoals.find((x) => x.id === id);
    const krIds = new Set((g?.keyResults || []).map((k) => k.id));
    return {
      ...s,
      companyGoals: s.companyGoals.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: null } : x)),
      feasibilityCases: s.feasibilityCases.map((c) => ({ ...c, linkedGoalId: c.linkedGoalId === id ? null : c.linkedGoalId, linkedKrId: krIds.has(c.linkedKrId) ? null : c.linkedKrId })),
      projects: s.projects.map((p) => ({ ...p, goalId: p.goalId === id ? null : p.goalId, krId: krIds.has(p.krId) ? null : p.krId })),
    };
  });
}
export function addKeyResult(goalId, kr) { setState((s) => ({ ...s, companyGoals: s.companyGoals.map((g) => (g.id === goalId ? { ...g, keyResults: [...(g.keyResults || []), { id: uid(), name: "", unit: "", startValue: 0, targetValue: 0, currentValue: 0, confidence: "amber", ...kr }], updatedAt: new Date().toISOString() } : g)) })); }
export function updateKeyResult(goalId, krId, patch) { setState((s) => ({ ...s, companyGoals: s.companyGoals.map((g) => (g.id === goalId ? { ...g, keyResults: (g.keyResults || []).map((k) => (k.id === krId ? { ...k, ...patch } : k)), updatedAt: new Date().toISOString() } : g)) })); }
export function removeKeyResult(goalId, krId) {
  setState((s) => ({
    ...s,
    companyGoals: s.companyGoals.map((g) => (g.id === goalId ? { ...g, keyResults: (g.keyResults || []).filter((k) => k.id !== krId), updatedAt: new Date().toISOString() } : g)),
    feasibilityCases: s.feasibilityCases.map((c) => (c.linkedKrId === krId ? { ...c, linkedKrId: null } : c)),
    projects: s.projects.map((p) => (p.krId === krId ? { ...p, krId: null } : p)),
  }));
}

/* ----- [M2] 타당성 케이스 (6기준 가중 + 하드게이트, 점수는 파생·미저장) ----- */
const _fc = coll("feasibilityCases", () => ({ title: "", problem: "", expectedOutcome: "", intakeContent: "", intakeLinks: [], analysis: null, linkedGoalId: null, linkedKrId: null, linkedDealId: null, moneyTestId: null, scores: { goalAlign: null, value: null, strategicFit: null, feasibility: null, risk: null, cost: null }, confidence: 0.8, timeCritical: false, moscow: "should", contribution: "med", gates: { compliance: true, reversibility: "reversible", budgetFit: true }, status: "draft", decisionId: null, projectId: null }));
export const addFeasibilityCase = _fc.add, updateFeasibilityCase = _fc.update, getFeasibilityCase = _fc.get;
export function removeFeasibilityCase(id) {
  setState((s) => ({ ...s, feasibilityCases: s.feasibilityCases.filter((x) => x.id !== id), projects: s.projects.map((p) => (p.caseId === id ? { ...p, caseId: null } : p)), proposals: s.proposals.map((p) => (p.caseId === id ? { ...p, caseId: null } : p)) }));
}

/* ----- [M4] 프로젝트 1급 + 라이프사이클 ----- */
export const PROJECT_STATUSES = [
  { id: "proposed", label: "발의", prob: 0.1 },
  { id: "verified", label: "검증", prob: 0.3 },
  { id: "approved", label: "승인", prob: 0.6 },
  { id: "executing", label: "실행", prob: 0.85 },
  { id: "closed", label: "종료", prob: 1 },
  { id: "held", label: "보류", prob: 0 },
  { id: "killed", label: "중단", prob: 0 },
];
const _pj = coll("projects", () => ({ title: "", goalId: null, krId: null, caseId: null, proposalId: null, dealId: null, status: "proposed", stakeholderIds: [], handoffIds: [], taskIds: [], milestones: [], selfExec: false, contribution: "med", startedAt: null, closedAt: null, finance: { mode: "earn", budget: 0, revenue: 0, currency: "KRW", costLines: [] } }));
export const addProject = _pj.add, updateProject = _pj.update, getProject = _pj.get;
export function removeProject(id) {
  setState((s) => ({
    ...s,
    projects: s.projects.filter((x) => x.id !== id),
    tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null, inbox: true } : t)),
    tickets: s.tickets.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
    stakeholders: s.stakeholders.map((k) => ({ ...k, projectIds: (k.projectIds || []).filter((pid) => pid !== id) })),
    feasibilityCases: s.feasibilityCases.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)),
  }));
}
// 타당성 Go → 프로젝트 승격(1:1 수동)
export function promoteCaseToProject(caseId) {
  const c = state.feasibilityCases.find((x) => x.id === caseId);
  if (!c) return null;
  if (c.projectId && state.projects.find((p) => p.id === c.projectId)) return c.projectId;
  const pid = addProject({ title: c.title || "무제 프로젝트", goalId: c.linkedGoalId, krId: c.linkedKrId, caseId: c.id, dealId: c.linkedDealId, status: "approved", contribution: c.contribution, startedAt: new Date().toISOString() });
  updateFeasibilityCase(caseId, { projectId: pid, status: "executing" });
  return pid;
}
export function addMilestone(projectId, m) { setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === projectId ? { ...p, milestones: [...(p.milestones || []), { id: uid(), name: "", targetDate: "", done: false, ...m }], updatedAt: new Date().toISOString() } : p)) })); }
export function updateMilestone(projectId, mid, patch) { setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === projectId ? { ...p, milestones: (p.milestones || []).map((m) => (m.id === mid ? { ...m, ...patch } : m)), updatedAt: new Date().toISOString() } : p)) })); }
export function removeMilestone(projectId, mid) { setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === projectId ? { ...p, milestones: (p.milestones || []).filter((m) => m.id !== mid), updatedAt: new Date().toISOString() } : p)) })); }

/* ----- 프로젝트 재무(수익성·원가·예산) ----- */
export function updateFinance(projectId, patch) { setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === projectId ? { ...p, finance: { ...(p.finance || {}), ...patch }, updatedAt: new Date().toISOString() } : p)) })); }
export function addCostLine(projectId, line) { setState((s) => ({ ...s, projects: s.projects.map((p) => { if (p.id !== projectId) return p; const f = p.finance || { costLines: [] }; return { ...p, finance: { ...f, costLines: [...(f.costLines || []), { id: uid(), category: "labor", label: "", planned: 0, actual: 0, ...line }] }, updatedAt: new Date().toISOString() }; }) })); }
export function updateCostLine(projectId, lineId, patch) { setState((s) => ({ ...s, projects: s.projects.map((p) => { if (p.id !== projectId) return p; const f = p.finance || { costLines: [] }; return { ...p, finance: { ...f, costLines: (f.costLines || []).map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }, updatedAt: new Date().toISOString() }; }) })); }
export function removeCostLine(projectId, lineId) { setState((s) => ({ ...s, projects: s.projects.map((p) => { if (p.id !== projectId) return p; const f = p.finance || { costLines: [] }; return { ...p, finance: { ...f, costLines: (f.costLines || []).filter((l) => l.id !== lineId) }, updatedAt: new Date().toISOString() }; }) })); }

/* ----- [M5] 1인 실행 태스크 (handoffs와 분리·북극성 롤업 제외) ----- */
const _tk = coll("tasks", () => ({ title: "", projectId: null, status: "todo", priority: "med", due: "", inbox: false, note: "" }));
export const addTask = _tk.add, updateTask = _tk.update, removeTask = _tk.remove, getTask = _tk.get;

/* ----- 통합 티켓 (담당자 지정 + 위임심화 옵션) — tasks·handoffs 통합 작업단위 ----- */
export const TICKET_STATUSES = [
  { id: "todo", l: "할 일", light: "gray" },
  { id: "doing", l: "진행", light: "amber" },
  { id: "review", l: "검토", light: "amber" },
  { id: "done", l: "완료", light: "green" },
  { id: "blocked", l: "막힘", light: "red" },
];
export const ASSIGNEE_KINDS = [
  { id: "self", l: "나(직접)" },
  { id: "member", l: "팀원" },
  { id: "stakeholder", l: "이해관계자" },
  { id: "external", l: "외부" },
];
const _tc = coll("tickets", () => ({ title: "", description: "", projectId: null, assigneeKind: "self", assigneeId: null, assigneeName: "", status: "todo", priority: "med", due: "", isDelegation: false, delegation: { level: 2, outcome: "", metric: "", boundary: "", authority: "", checkpoints: [], result: { met: "", autonomy: "", rework: false, note: "" } } }));
export const addTicket = _tc.add, updateTicket = _tc.update, removeTicket = _tc.remove, getTicket = _tc.get;

/* ----- [M9] 이해관계자 (발의자·임원·고객사 담당 — teamMembers와 분리) ----- */
export const STAKEHOLDER_ROLES = [
  { id: "proposer", label: "발의자" },
  { id: "execSponsor", label: "임원/스폰서" },
  { id: "clientContact", label: "고객사 담당" },
  { id: "pm", label: "PM" },
  { id: "other", label: "기타" },
];
export const STANCES = [
  { id: "supportive", label: "우호", color: "green" },
  { id: "neutral", label: "중립", color: "gray" },
  { id: "opposed", label: "반대", color: "red" },
  { id: "unclear", label: "불명", color: "amber" },
];
const _sh = coll("stakeholders", () => ({ name: "", role: "other", org: "", contact: "", power: 3, interest: 3, stance: "unclear", projectIds: [], notes: "" }));
export const addStakeholder = _sh.add, updateStakeholder = _sh.update, getStakeholder = _sh.get;
export function removeStakeholder(id) {
  setState((s) => ({ ...s, stakeholders: s.stakeholders.filter((x) => x.id !== id), projects: s.projects.map((p) => ({ ...p, stakeholderIds: (p.stakeholderIds || []).filter((sid) => sid !== id) })), proposals: s.proposals.map((p) => ({ ...p, stakeholderIds: (p.stakeholderIds || []).filter((sid) => sid !== id) })) }));
}

/* ----- [M8] 예측 로그 (판정 전 immutable — 후견편향 차단) ----- */
const _pr = coll("predictions", () => ({ question: "", probability: 0.6, resolveBy: "", resolution: null, resolvedAt: null, tags: [], linkedItemId: null }));
export const addPrediction = _pr.add, getPrediction = _pr.get, removePrediction = _pr.remove;
export function updatePrediction(id, patch) {
  setState((s) => ({ ...s, predictions: s.predictions.map((p) => {
    if (p.id !== id) return p;
    if (p.resolution) { const { question, probability, resolveBy, ...rest } = patch; return { ...p, ...rest, updatedAt: new Date().toISOString() }; } // 판정 후 핵심필드 잠금
    return { ...p, ...patch, updatedAt: new Date().toISOString() };
  }) }));
}
export function resolvePrediction(id, resolution) { setState((s) => ({ ...s, predictions: s.predictions.map((p) => (p.id === id ? { ...p, resolution, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : p)) })); }

/* ----- 제안서 (Phase 2·스켈레톤 — 데이터생존 위해 배열만 선반영) ----- */
const _pp = coll("proposals", () => ({ title: "", caseId: null, linkedGoalId: null, stakeholderIds: [], sections: [], recommendation: "", proofPoints: [], risks: [], theAsk: "", decisionBy: "", status: "draft" }));
export const addProposal = _pp.add, updateProposal = _pp.update, removeProposal = _pp.remove, getProposal = _pp.get;

/* ===== 백업 ===== */
export function exportJSON() { return JSON.stringify(state, null, 2); }
export function markBackup() { setState((s) => ({ ...s, meta: { ...s.meta, lastBackupAt: new Date().toISOString() } })); }
export function counts() { return { deals: state.deals.length, moneyTests: state.moneyTests.length, decisions: state.decisions.length, teamMembers: state.teamMembers.length }; }
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("JSON 객체가 아닙니다.");
  for (const k of ["deals", "moneyTests", "weeklyReviews"]) {
    if (!(k in parsed)) throw new Error(`성장원장 백업 형식이 아닙니다(${k} 없음).`);
    if (!Array.isArray(parsed[k])) throw new Error(`백업이 손상됐습니다(${k}가 목록이 아님).`);
  }
  try { localStorage.setItem(PRE_KEY, JSON.stringify(state)); } catch (e) {} // 덮어쓰기 직전 스냅샷
  state = sanitize(parsed); emit();
}
export function resetAll() {
  try { localStorage.setItem(PRE_KEY, JSON.stringify(state)); } catch (e) {} // 초기화 직전 스냅샷
  state = fresh(); emit();
}
/* 파괴적 연산 되돌리기(1슬롯) */
export function hasRestorePoint() { try { return !!localStorage.getItem(PRE_KEY); } catch (e) { return false; } }
export function restorePrevious() {
  try {
    const raw = localStorage.getItem(PRE_KEY);
    if (!raw) return false;
    state = sanitize(JSON.parse(raw)); emit();
    try { localStorage.removeItem(PRE_KEY); } catch (e2) {}
    return true;
  } catch (e) { return false; }
}
export function clearRestorePoint() { try { localStorage.removeItem(PRE_KEY); } catch (e) {} }
