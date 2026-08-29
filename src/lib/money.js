// 사업성 머니테스트 계산 엔진 — 전부 순수함수.
// 원칙(실행안 2부): 재발생/기간총액 트랙 분리, 감액 체인은 절감률·채택률 각 1회,
// 회수는 단순 나눗셈이 아니라 월별 누적현금흐름 0선 교차, 거짓정밀 방지(추정 의존 시 초록 차단).
import { won, pct, months as fmtMonths } from "./format.js";

export const PROJECT_TYPES = [
  { id: "internal", label: "내부효율화", mode: "save", desc: "반복업무 자동화·개선(우리 비용 절감)" },
  { id: "si", label: "SI·수주", mode: "earn", desc: "외부 프로젝트 수주(매출-원가=이익)" },
  { id: "saas", label: "구독·SaaS", mode: "earn", desc: "구독 상품(일회성 P&L 기준 — 구독경제 지표는 아님)" },
];

export function typeOf(id) {
  return PROJECT_TYPES.find((t) => t.id === id) || PROJECT_TYPES[0];
}

// 기본값(‘추정’ 라벨). 사용자가 실측(근거 포함)으로 확정하기 전까지는 전부 추정으로 취급.
export function defaultInputs(projectType = "internal") {
  const mode = typeOf(projectType).mode;
  if (mode === "save") {
    return {
      projectType,
      name: "",
      targetCount: 1,
      freqPerYear: 250,
      minutesPerEvent: 30,
      loadedHourlyWage: 35000,
      complaintPerEvent: 0,
      periodTotalLoss: 0,
      reductionRate: 0.6,
      adoptionRate: null, // 기본 비움: 결과를 가장 크게 좌우 → 직접 고르거나 모르겠어요(=60% 가정)
      rampupFactor: 0.6,
      annualMaintenanceOpex: 0,
      buildCost: 0,
      internalCost: 0,
      hardBlock: false,
      measured: {}, // { key: { source: "출처 한 줄" } } — 근거 있어야 '실측'으로 인정
      unknown: {}, // { key: true } — 모르겠어요
    };
  }
  return {
    projectType,
    name: "",
    revenue: 0,
    outsourcing: 0,
    internalCost: 0,
    infraLicense: 0,
    riskReserve: 0,
    prob: 0.5,
    hardBlock: false,
    measured: {},
    unknown: {},
  };
}

// 지배 드라이버(초록 확정에 반드시 실측 근거가 필요한 핵심 입력)
const DOMINANT = { save: ["adoptionRate", "reductionRate"], earn: ["revenue"] };
const LOAD_BEARING = {
  save: ["adoptionRate", "reductionRate", "loadedHourlyWage", "freqPerYear", "buildCost"],
  earn: ["revenue", "outsourcing", "internalCost"],
};

function n(v, d = 0) {
  const x = Number(v);
  return isFinite(x) ? x : d;
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// 근거(source)가 있는 실측 키만 인정
function isEvidenced(inputs, k) {
  const m = inputs.measured && inputs.measured[k];
  const un = inputs.unknown && inputs.unknown[k];
  return !!(m && typeof m === "object" && m.source && String(m.source).trim() && !un);
}

// 회수: 월별 누적현금흐름 0선 교차(1년차 램프업 반영)
function paybackMonths(totalInvestment, firstYearNet, steadyNet, cap = 120) {
  if (firstYearNet <= 0 && steadyNet <= 0) return Infinity; // 순효익 없음 → 회수 불가(투자 0이어도)
  if (totalInvestment <= 0) return 0;
  let cum = -totalInvestment;
  for (let m = 1; m <= cap; m++) {
    const monthly = m <= 12 ? firstYearNet / 12 : steadyNet / 12;
    if (monthly <= 0 && cum < 0 && m > 12) return Infinity;
    const prev = cum;
    cum += monthly;
    if (cum >= 0) {
      const frac = monthly !== 0 ? (0 - prev) / monthly : 0;
      return m - 1 + Math.max(0, Math.min(1, frac));
    }
  }
  return Infinity;
}

function cashflowSeries(totalInvestment, firstYearNet, steadyNet, upto = 24) {
  const pts = [{ month: 0, cum: -totalInvestment }];
  let cum = -totalInvestment;
  for (let m = 1; m <= upto; m++) {
    cum += m <= 12 ? firstYearNet / 12 : steadyNet / 12;
    pts.push({ month: m, cum });
  }
  return pts;
}

function confidenceOf(inputs, mode) {
  const keys = LOAD_BEARING[mode] || [];
  const measured = keys.filter((k) => isEvidenced(inputs, k));
  const unknown = keys.filter((k) => inputs.unknown && inputs.unknown[k]);
  const dominant = (DOMINANT[mode] || []).filter((k) => isEvidenced(inputs, k));
  let level = "low";
  if (dominant.length >= 1 && measured.length >= 2) level = "high";
  else if (measured.length >= 1) level = "mid";
  return { level, measuredKeys: measured, unknownKeys: unknown, dominantMeasured: dominant.length >= 1, hasMeasured: measured.length > 0 };
}

function computeSave(inp) {
  const perEventLoss = (n(inp.minutesPerEvent) / 60) * n(inp.loadedHourlyWage) + n(inp.complaintPerEvent);
  const recurringAnnual = n(inp.targetCount) * n(inp.freqPerYear) * perEventLoss;
  const annualProblemCost = recurringAnnual + n(inp.periodTotalLoss);

  const reduction = clamp01(n(inp.reductionRate, 0));
  const adoptionUnknown = inp.adoptionRate == null || (inp.unknown && inp.unknown.adoptionRate);
  const adoption = inp.adoptionRate == null ? 0.6 : clamp01(n(inp.adoptionRate)); // 모르겠어요 → 60% 가정
  const rampup = clamp01(n(inp.rampupFactor, 1));
  const opex = n(inp.annualMaintenanceOpex);
  const totalInvestment = n(inp.buildCost) + n(inp.internalCost);

  const forA = (a) => {
    const netSaving = annualProblemCost * reduction * a;
    const steady = netSaving - opex;
    const first = netSaving * rampup - opex;
    return { adoption: a, netSaving, steady, first, payback: paybackMonths(totalInvestment, first, steady) };
  };
  const base = forA(adoption);
  const cons = forA(clamp01(adoption * (adoptionUnknown ? 0.55 : 0.7)));
  const aggr = forA(clamp01(adoption * 1.2));

  const roi1y = totalInvestment > 0 ? (base.first - totalInvestment) / totalInvestment : null;
  const roi2y = totalInvestment > 0 ? (base.first + base.steady - totalInvestment) / totalInvestment : null;

  return {
    mode: "save",
    annualProblemCost, recurringAnnual, periodTotal: n(inp.periodTotalLoss), perEventLoss,
    reduction, adoption, adoptionUnknown, rampup, opex, totalInvestment,
    netSaving: base.netSaving, steadyNet: base.steady, firstYearNet: base.first, payback: base.payback,
    roi1y, roi2y,
    cases: { conservative: cons, base, aggressive: aggr },
    cashflow: cashflowSeries(totalInvestment, base.first, base.steady, 24),
    confidence: confidenceOf(inp, "save"),
    zeroInvestment: totalInvestment <= 0,
    valid: annualProblemCost > 0 && reduction > 0,
  };
}

function computeEarn(inp) {
  const revenue = n(inp.revenue);
  const cost = n(inp.outsourcing) + n(inp.internalCost) + n(inp.infraLicense) + n(inp.riskReserve);
  const profit = revenue - cost;
  const margin = revenue > 0 ? profit / revenue : null;
  const prob = clamp01(n(inp.prob, 0));
  return {
    mode: "earn",
    revenue, cost, profit, margin, prob,
    weightedProfit: profit * prob,
    weightedRevenue: revenue * prob,
    confidence: confidenceOf(inp, "earn"),
    valid: revenue > 0,
  };
}

export function compute(inputs) {
  const mode = typeOf(inputs.projectType).mode;
  const r = mode === "save" ? computeSave(inputs) : computeEarn(inputs);
  const verdict = decideVerdict(inputs, r);
  return { ...r, verdict, oneLiner: oneLiner(inputs, r, verdict), sales: salesSentence(inputs, r, verdict) };
}

function decideVerdict(inputs, r) {
  if (inputs.hardBlock) return { light: "red", capped: false, reason: "규제·전략 불일치 하드게이트", improve: "" };
  if (!r.valid) {
    return {
      light: "gray", capped: false,
      reason: r.mode === "save" ? "문제비용·절감률이 비어 판정 불가" : "수주액이 비어 판정 불가",
      improve: r.mode === "save" ? "대상수·빈도·시간과 절감률을 채우세요(채택률은 몰라도 됩니다)." : "수주 예상액을 입력하세요.",
    };
  }
  let light, reason, improve = "";
  if (r.mode === "save") {
    const p = r.payback;
    if (r.firstYearNet <= 0 && r.steadyNet <= 0) { light = "red"; reason = "연 순효익이 0 이하 — 지금 구조로는 남지 않음"; }
    else if (!isFinite(p)) { light = "red"; reason = "투자 회수 불가(유지운영비·내 시간 재검토 필요)"; }
    else if (p < 12) { light = "green"; reason = `회수 약 ${fmtMonths(p)}`; }
    else if (p <= 24) { light = "amber"; reason = `회수 약 ${fmtMonths(p)} — 조건부`; improve = "채택률을 실측으로 올리면 회수가 당겨집니다."; }
    else { light = "red"; reason = `회수 ${fmtMonths(p)} — 너무 김`; improve = "유지운영비·내 시간·구축비를 줄이거나 절감폭을 키워야 합니다."; }
  } else {
    if (r.profit <= 0) { light = "red"; reason = "남는 돈이 0 이하 — 이 조건으로는 손해"; }
    else if (r.margin >= 0.15) { light = "green"; reason = `프로젝트 이익 ${won(r.profit)} (이익률 ${pct(r.margin)})`; }
    else if (r.margin >= 0.05) { light = "amber"; reason = `이익률 ${pct(r.margin)} — 얇음`; improve = "가격을 낮출 땐 범위·일정·유지보수로 반드시 무언가를 받으세요(Give&Get)."; }
    else { light = "red"; reason = `이익률 ${pct(r.margin)} — 너무 얇음`; improve = "원가(외주·내부공수)를 줄이거나 수주가를 올려야 합니다."; }
  }
  // 거짓정밀·자기기만 방지: 초록은 아래 조건을 모두 만족해야 확정. 하나라도 어기면 노랑으로 강등(capped).
  let capped = false;
  const capReasons = [];
  if (light === "green") {
    if (r.confidence.level === "low" || !r.confidence.dominantMeasured) { capped = true; capReasons.push("핵심 입력이 추정(근거 없는 실측 포함)"); }
    if (r.mode === "save" && r.adoptionUnknown) { capped = true; capReasons.push("채택률 미정(60% 가정)"); }
    if (r.mode === "save" && r.zeroInvestment) { capped = true; capReasons.push("투자(내 시간 포함)가 0"); }
    if (r.mode === "save" && n(inputs.internalCost) === 0 && n(inputs.buildCost) > 0) { capped = true; capReasons.push("내 시간(내부공수)이 0 — '공짜' 가정"); }
    if (capped) { light = "amber"; improve = improve || `초록 확정 조건 미충족: ${capReasons.join(", ")}. 근거를 채우면 초록으로 확정됩니다.`; }
  }
  return { light, capped, reason, improve, capReasons };
}

const LIGHT_KO = { green: "진행", amber: "조건부", red: "중단", gray: "판정 불가" };
const LIGHT_EMOJI = { green: "🟢", amber: "🟡", red: "🔴", gray: "⚪" };
export function verdictText(v) { return { ...v, ko: LIGHT_KO[v.light], emoji: LIGHT_EMOJI[v.light] }; }

function confSuffix(r) {
  if (r.confidence.level === "low") return " (입력 다수가 추정 — 검증 필요)";
  if (r.confidence.level === "mid") return " (일부 실측)";
  return "";
}
function oneLiner(inputs, r, v) {
  const name = inputs.name || "이 건";
  if (v.light === "gray") return `${LIGHT_EMOJI[v.light]} ${LIGHT_KO[v.light]} — ${v.reason}`;
  let core = r.mode === "save" ? `${name}은 지금 기준 ${v.reason}` : `${name}은 ${v.reason}`;
  if (v.improve) core += `. ${v.improve}`;
  return `${LIGHT_EMOJI[v.light]} ${LIGHT_KO[v.light]}${v.capped ? "(추정 상한)" : ""} — ${core}${confSuffix(r)}`;
}
function rangeText(r) {
  if (r.mode !== "save") return "";
  return `채택률 가정을 흔든 폭 ${won(Math.max(0, r.cases.conservative.netSaving))}~${won(r.cases.aggressive.netSaving)}`;
}
function salesSentence(inputs, r, v) {
  const name = inputs.name || "이 건";
  const label = r.confidence.level === "high" ? "실측 기반" : r.confidence.level === "mid" ? "일부 실측" : "추정";
  if (r.mode === "save") {
    if (!r.valid) return "";
    const monthlyLoss = r.annualProblemCost / 12;
    const adoptTxt = r.adoptionUnknown ? "채택률 미정(60% 가정)" : `채택률 ${pct(r.adoption)}`;
    return (
      `${name}은 연 약 ${won(r.annualProblemCost)}(${label}) 규모의 문제입니다. ` +
      `해결 시 ${adoptTxt}·절감률 ${pct(r.reduction)} 가정에서 연 약 ${won(r.netSaving)} 절감(${label}), ${rangeText(r)}. ` +
      `투자 ${won(r.totalInvestment)} → ${!isFinite(r.payback) ? "회수 불가" : "약 " + fmtMonths(r.payback) + " 회수"}. ` +
      `방치하면 매달 약 ${won(monthlyLoss)}(${label})씩 손실이 쌓입니다. 신뢰도=${label}${r.confidence.level === "low" ? ", 검증 필요" : ""}.`
    );
  }
  if (!r.valid) return "";
  return (
    `${name}은 수주 ${won(r.revenue)}에서 원가 ${won(r.cost)}를 빼면 ${won(r.profit)}이 남습니다(이익률 ${pct(r.margin)}, ${label}). ` +
    `성공확률 ${pct(r.prob)} 반영 시 가중 기대이익 ${won(r.weightedProfit)}. ` +
    `핵심 질문은 '${won(r.revenue)}짜리인가'가 아니라 '${won(r.profit)} 남길 건인가'입니다. 신뢰도=${label}.`
  );
}

export function needsWatermark(r) {
  return r && r.confidence && r.confidence.level === "low";
}
