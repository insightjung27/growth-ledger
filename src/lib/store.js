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
    version: 2,
    deals: [],
    moneyTests: [],
    weeklyReviews: [],
    decisions: [],
    teamMembers: [],
    handoffs: [],
    oneOnOnes: [],
    quarterlyGoals: [],
    meta: { createdAt: now, lastOpenedAt: now, lastBackupAt: null },
  };
}
const ARRAYS = ["deals", "moneyTests", "weeklyReviews", "decisions", "teamMembers", "handoffs", "oneOnOnes", "quarterlyGoals"];

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
  s.teamMembers = s.teamMembers.map((x) => ({ strengths: [], growthAreas: [], levelHistory: [], projects: [], operations: [], ...x }));
  s.oneOnOnes = s.oneOnOnes.map((x) => ({ actionItems: [], carriedOver: [], ...x }));
  s.quarterlyGoals = s.quarterlyGoals.map((x) => ({ changeLog: [], ...x }));
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
function emit() { persist(); listeners.forEach((l) => l()); }
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
export function removeDeal(id) { setState((s) => ({ ...s, deals: s.deals.filter((d) => d.id !== id) })); }
export function getDeal(id) { return state.deals.find((d) => d.id === id) || null; }

/* ===== 머니테스트 ===== */
export function addMoneyTest(mt) { const now = new Date().toISOString(); const rec = { id: uid(), createdAt: now, updatedAt: now, actualOutcome: "", actualPayback: null, decisionId: null, dealId: null, ...mt }; setState((s) => ({ ...s, moneyTests: [rec, ...s.moneyTests] })); return rec.id; }
export function updateMoneyTest(id, patch) { setState((s) => ({ ...s, moneyTests: s.moneyTests.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)) })); }
export function removeMoneyTest(id) { setState((s) => ({ ...s, moneyTests: s.moneyTests.filter((m) => m.id !== id), deals: s.deals.map((d) => (d.moneyTestId === id ? { ...d, moneyTestId: null } : d)), decisions: s.decisions.map((x) => (x.moneyTestId === id ? { ...x, moneyTestId: null } : x)) })); }
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
  setState((s) => ({ ...s, decisions: s.decisions.filter((x) => x.id !== id), deals: s.deals.map((d) => (d.decisionId === id ? { ...d, decisionId: null } : d)), moneyTests: s.moneyTests.map((m) => (m.decisionId === id ? { ...m, decisionId: null } : m)) }));
}

/* ===== 분기 목표 [기둥② 항목6·R3] ===== */
const _qg = coll("quarterlyGoals", () => ({ quarter: "", title: "", successMetric: "", targetValue: "", currentValue: "", ownerMemberId: null, status: "진행중", changeLog: [], memo: "" }));
export const addGoal = _qg.add, updateGoal = _qg.update, removeGoal = _qg.remove, getGoal = _qg.get;
export function logGoalChange(id, change) { // R3 변경 이력
  setState((s) => ({ ...s, quarterlyGoals: s.quarterlyGoals.map((g) => (g.id === id ? { ...g, changeLog: [...(g.changeLog || []), { at: new Date().toISOString(), ...change }], updatedAt: new Date().toISOString() } : g)) }));
}

/* ===== 팀원 [기둥② R2] ===== */
const _tm = coll("teamMembers", () => ({ name: "", area: "", strengths: [], growthAreas: [], levelCurrent: 2, levelTarget: 3, levelHistory: [], projects: [], operations: [], active: true, memo: "" }));
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
