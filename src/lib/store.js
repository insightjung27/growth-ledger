// 클라이언트 전용 상태 저장소 — 브라우저 localStorage에만 저장(백엔드 없음).
// useSyncExternalStore로 React와 연결. 데이터 유실 방지: 저장 실패 감지·백업시각 추적·손상 import 차단.
import { useSyncExternalStore } from "react";
import { weekMonday } from "./format.js";

const KEY = "growth-ledger:v1";
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

export const CAPABILITIES = [
  { id: "customer", name: "Customer", ko: "고객 발견", note: "강점 — 문제를 찾는다" },
  { id: "product", name: "Product", ko: "제품·서비스 설계", note: "매우 강점" },
  { id: "execution", name: "Execution", ko: "실행·완결", note: "강점 — 만들어낸다" },
  { id: "business", name: "Business·Sales", ko: "사업·영업", note: "보완 갭 — 돈·제안·협상" },
  { id: "people", name: "People", ko: "위임·조직", note: "보완 갭 — 남에게 넘기기" },
];

// kind: people(사람·조직 위임=북극성) / ax(AI·자동화 레버리지=보조지표) — 한 분모에 섞지 않는다.
export const DELEGATE_TYPES = [
  { id: "person", label: "사람", kind: "people" },
  { id: "outsource", label: "외주", kind: "people" },
  { id: "ai", label: "AI", kind: "ax" },
  { id: "auto", label: "자동화", kind: "ax" },
];
export function delegateKind(typeId) {
  return DELEGATE_TYPES.find((t) => t.id === typeId)?.kind || "people";
}

function fresh() {
  return {
    version: 1,
    deals: [],
    moneyTests: [],
    weeklyReviews: [],
    capabilities: CAPABILITIES.map((c) => ({ id: c.id, score: c.id === "product" ? 5 : c.id === "business" || c.id === "people" ? 2 : 4 })),
    meta: { createdAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString(), lastBackupAt: null },
  };
}

// 배열 필드를 강제 정규화(손상/구버전 방어)
function sanitize(obj) {
  const base = fresh();
  const s = { ...base, ...(obj && typeof obj === "object" ? obj : {}) };
  for (const k of ["deals", "moneyTests", "weeklyReviews", "capabilities"]) {
    if (!Array.isArray(s[k])) s[k] = base[k];
  }
  if (!s.meta || typeof s.meta !== "object") s.meta = base.meta;
  return s;
}

/* ===== persist 실패 감지(무음 소실 방지) ===== */
let persistError = false;
const errListeners = new Set();
function setPersistError(v) { if (persistError !== v) { persistError = v; errListeners.forEach((l) => l()); } }
export function usePersistError() {
  return useSyncExternalStore((cb) => { errListeners.add(cb); return () => errListeners.delete(cb); }, () => persistError, () => persistError);
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return sanitize(JSON.parse(raw));
  } catch (e) {
    return fresh();
  }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); setPersistError(false); return true; }
  catch (e) { setPersistError(true); return false; }
}
function emit() { persist(); listeners.forEach((l) => l()); }
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return state; }

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}
export function setState(updater) {
  state = typeof updater === "function" ? updater(state) : { ...state, ...updater };
  emit();
}

/* ===== 딜 ===== */
export function addDeal(partial) {
  const now = new Date().toISOString();
  const deal = { id: uid(), name: "", amount: 0, stageId: "lead", nextWhat: "", nextWho: "본인", nextWhen: "", lastContact: now, priceReaction: "", lostReason: "", memo: "", moneyTestId: null, outcome: "", createdAt: now, updatedAt: now, ...partial };
  setState((s) => ({ ...s, deals: [deal, ...s.deals] }));
  return deal.id;
}
export function updateDeal(id, patch) {
  setState((s) => ({ ...s, deals: s.deals.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)) }));
}
export function removeDeal(id) { setState((s) => ({ ...s, deals: s.deals.filter((d) => d.id !== id) })); }
export function getDeal(id) { return state.deals.find((d) => d.id === id) || null; }

/* ===== 머니테스트 ===== */
export function addMoneyTest(mt) {
  const now = new Date().toISOString();
  const rec = { id: uid(), createdAt: now, updatedAt: now, actualOutcome: "", actualPayback: null, ...mt };
  setState((s) => ({ ...s, moneyTests: [rec, ...s.moneyTests] }));
  return rec.id;
}
export function updateMoneyTest(id, patch) {
  setState((s) => ({ ...s, moneyTests: s.moneyTests.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)) }));
}
export function removeMoneyTest(id) {
  setState((s) => ({ ...s, moneyTests: s.moneyTests.filter((m) => m.id !== id), deals: s.deals.map((d) => (d.moneyTestId === id ? { ...d, moneyTestId: null } : d)) }));
}
export function getMoneyTest(id) { return state.moneyTests.find((m) => m.id === id) || null; }

/* ===== 주간 자기리뷰 ===== */
export function currentWeekKey() { return weekMonday(new Date()); }
export function getWeekly(weekOf) { return state.weeklyReviews.find((w) => w.weekOf === weekOf) || null; }
export function upsertWeekly(weekOf, patch) {
  setState((s) => {
    const exists = s.weeklyReviews.find((w) => w.weekOf === weekOf);
    if (exists) return { ...s, weeklyReviews: s.weeklyReviews.map((w) => (w.weekOf === weekOf ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)) };
    const rec = { id: uid(), weekOf, solvedSelf: [], delegated: [], nextDelegation: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...patch };
    return { ...s, weeklyReviews: [rec, ...s.weeklyReviews] };
  });
}

/* ===== 역량 자가진단 ===== */
export function setCapability(id, score) {
  setState((s) => ({ ...s, capabilities: s.capabilities.map((c) => (c.id === id ? { ...c, score } : c)) }));
}

/* ===== 백업: 내보내기/가져오기 ===== */
export function exportJSON() { return JSON.stringify(state, null, 2); }
export function markBackup() { setState((s) => ({ ...s, meta: { ...s.meta, lastBackupAt: new Date().toISOString() } })); }
export function counts() {
  return { deals: state.deals.length, moneyTests: state.moneyTests.length, weeklyReviews: state.weeklyReviews.length };
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("JSON 객체가 아닙니다.");
  for (const k of ["deals", "moneyTests", "weeklyReviews"]) {
    if (!(k in parsed)) throw new Error(`성장원장 백업 형식이 아닙니다(${k} 없음).`);
    if (!Array.isArray(parsed[k])) throw new Error(`백업이 손상됐습니다(${k}가 목록이 아님).`);
  }
  state = sanitize(parsed);
  emit();
}
export function resetAll() { state = fresh(); emit(); }
