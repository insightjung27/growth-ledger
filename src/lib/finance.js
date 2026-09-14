// 프로젝트 재무 — 수익성·원가·예산 (전부 순수함수). 계획 vs 실적 · 예산 소진 · 변동차이.
import { PROJECT_STATUSES } from "./store.js";

export const FINANCE_MODES = [
  { id: "earn", label: "수주·매출", desc: "외부 프로젝트: 매출 − 원가 = 이익" },
  { id: "save", label: "내부 절감", desc: "내부 과제: 연 절감가치 대비 투자 회수·ROI" },
];
export const COST_CATEGORIES = [
  { id: "labor", label: "인건비(공수)", hint: "투입 인력 × 기간 × 등급단가 (직접비 최대 항목)" },
  { id: "outsourcing", label: "외주비", hint: "협력사·프리랜서 도급" },
  { id: "infra", label: "인프라·라이선스", hint: "서버·SW·툴·클라우드" },
  { id: "other", label: "기타 직접비", hint: "출장·자료·교육 등" },
  { id: "contingency", label: "예비비(리스크)", hint: "불확실성 대비 버퍼(보통 5~15%)" },
];
const CAT_LABEL = Object.fromEntries(COST_CATEGORIES.map((c) => [c.id, c.label]));
export function catLabel(id) { return CAT_LABEL[id] || "기타"; }

const n = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };

export function computeFinance(f) {
  f = f || {};
  const mode = f.mode || "earn";
  const lines = Array.isArray(f.costLines) ? f.costLines : [];
  const budget = n(f.budget);
  const revenue = n(f.revenue); // earn: 매출 / save: 연 절감·가치
  const plannedCost = lines.reduce((s, l) => s + n(l.planned), 0);
  const actualCost = lines.reduce((s, l) => s + n(l.actual), 0);
  const byCategory = COST_CATEGORIES.map((c) => ({
    id: c.id, label: c.label,
    planned: lines.filter((l) => l.category === c.id).reduce((s, l) => s + n(l.planned), 0),
    actual: lines.filter((l) => l.category === c.id).reduce((s, l) => s + n(l.actual), 0),
  })).filter((c) => c.planned || c.actual);

  // 예산 운영
  const spent = actualCost;
  const remaining = budget - spent;
  const burnPct = budget > 0 ? spent / budget : null;              // 소진율
  const budgetVariance = budget - actualCost;                       // +면 예산 내, −면 초과
  const planCostVariance = plannedCost > 0 ? (actualCost - plannedCost) / plannedCost : null; // 원가 변동차이(%)
  const overBudget = budget > 0 && actualCost > budget;

  // 수익성
  let profitPlanned = null, profitActual = null, margin = null, roi = null, payback = null;
  if (mode === "earn") {
    profitPlanned = revenue - plannedCost;
    profitActual = revenue - actualCost;
    margin = revenue > 0 ? profitActual / revenue : null;          // 실적 이익률
    roi = actualCost > 0 ? profitActual / actualCost : null;
  } else {
    const invest = actualCost || plannedCost;                      // save: 투자 = 원가
    profitActual = revenue - invest;                               // 연 순가치
    roi = invest > 0 ? (revenue - invest) / invest : null;         // 1년 기준 ROI
    payback = revenue > 0 ? invest / (revenue / 12) : null;        // 회수(개월)
  }

  // 신호등(수익성 건전성)
  let light = "gray", note = "";
  if (mode === "earn") {
    if (revenue <= 0) { light = "gray"; note = "매출을 입력하면 수익성 판정"; }
    else if (profitActual <= 0) { light = "red"; note = "이 조건으로는 손해"; }
    else if (margin >= 0.15) { light = "green"; note = "건전한 이익률"; }
    else if (margin >= 0.05) { light = "amber"; note = "이익률 얇음 — Give&Get 협상"; }
    else { light = "red"; note = "이익률 너무 얇음 — 원가·가격 재검토"; }
  } else {
    if (revenue <= 0) { light = "gray"; note = "연 절감가치를 입력하면 판정"; }
    else if (payback != null && payback < 12) { light = "green"; note = "회수 1년 내"; }
    else if (payback != null && payback <= 24) { light = "amber"; note = "회수 1~2년 — 조건부"; }
    else { light = "red"; note = "회수 2년 초과 — 재검토"; }
  }
  if (overBudget) { light = light === "green" ? "amber" : light; note = (note ? note + " · " : "") + "예산 초과"; }

  return { mode, budget, revenue, plannedCost, actualCost, spent, remaining, burnPct, budgetVariance, planCostVariance, overBudget, byCategory, profitPlanned, profitActual, margin, roi, payback, light, note, hasData: !!(budget || revenue || plannedCost || actualCost) };
}

// 포트폴리오 합산(전체·열린 프로젝트 구분)
export function portfolioFinance(projects) {
  const open = (projects || []).filter((p) => !["killed"].includes(p.status));
  let budget = 0, spent = 0, revenue = 0, profit = 0, atRisk = 0;
  for (const p of open) {
    const r = computeFinance(p.finance);
    budget += r.budget; spent += r.spent; revenue += r.revenue;
    if (r.mode === "earn") profit += (r.profitActual || 0);
    if (r.overBudget || r.light === "red") atRisk += 1;
  }
  return { count: open.length, budget, spent, remaining: budget - spent, revenue, profit, atRisk, burnPct: budget > 0 ? spent / budget : null };
}

// "어떻게 하는가" — 수익성·원가·예산 실전 코칭
export const FINANCE_HOWTO = [
  { t: "1) 문제·가치를 돈으로 환산", b: [
    "수주형: 이 프로젝트로 얼마를 버는가(매출).",
    "내부형: 이 일을 안 하면 매년 얼마가 새는가(연 절감가치 = 대상수 × 빈도 × 건당손실).",
    "'4억짜리인가'가 아니라 '얼마가 남는가'로 본다.",
  ] },
  { t: "2) 원가 구조 = 직접비 + 예비비", b: [
    "인건비(공수): 투입 인력 × 기간(개월) × 등급단가. 대개 원가의 최대 항목 — 내 시간도 반드시 비용으로.",
    "외주 · 인프라/라이선스 · 기타 직접비를 빠짐없이.",
    "예비비(리스크): 불확실성만큼 5~15% 버퍼. 안 잡으면 초과는 예정된 미래.",
  ] },
  { t: "3) 예산 운영 = 계획 vs 실적", b: [
    "승인 예산을 세우고, 실제 지출(실적)을 항목별로 계속 채운다.",
    "소진율(burn) = 실적 ÷ 예산. 진척보다 소진이 빠르면 경고.",
    "변동차이(variance) = 예산 − 실적(+면 여유, −면 초과). 원가 변동차이 = (실적−계획)/계획.",
  ] },
  { t: "4) 수익성 판정", b: [
    "수주형: 이익 = 매출 − 원가, 이익률 = 이익 ÷ 매출. 15%+ 건전 · 5~15% 얇음 · 5%↓ 위험.",
    "내부형: ROI = (연가치 − 투자) ÷ 투자, 회수 = 투자 ÷ 월가치. 12개월 내 회수면 초록.",
    "손익분기: 매출 = 원가가 되는 지점. 여기 못 넘으면 규모를 키워도 손해가 커진다.",
  ] },
  { t: "5) 마진이 얇을 땐 Give&Get", b: [
    "가격을 낮출 땐 반드시 무언가를 받는다 — 범위 축소·일정 연장·결제조건·계약기간·추가계약.",
    "원가를 줄이거나(외주·공수) 가격을 올리지 않고 마진만 짜내면 품질·납기가 무너진다.",
  ] },
];
