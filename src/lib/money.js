// 사업성 머니테스트 계산 엔진 — 전부 순수함수.
// 원칙(실행안 2부): 재발생/기간총액 트랙 분리, 감액 체인은 절감률·채택률 각 1회,
// 회수는 단순 나눗셈이 아니라 월별 누적현금흐름 0선 교차, 거짓정밀 방지(추정 의존 시 초록 차단).
import { won, pct, months as fmtMonths } from "./format.js";

export const PROJECT_TYPES = [
  { id: "internal", label: "내부효율화", mode: "save", desc: "반복업무 자동화·개선(우리 비용 절감)" },
  { id: "si", label: "SI·수주", mode: "earn", desc: "외부 프로젝트 수주(매출-원가=이익)" },
  { id: "saas", label: "구독·SaaS", mode: "earn", desc: "구독 상품(매출-원가=이익)" },
];

export function typeOf(id) {
  return PROJECT_TYPES.find((t) => t.id === id) || PROJECT_TYPES[0];
}

// 기본값(‘추정’ 라벨). 사용자가 실측으로 확정하기 전까지는 전부 추정으로 취급.
export function defaultInputs(projectType = "internal") {
  const mode = typeOf(projectType).mode;
  if (mode === "save") {
    return {
      projectType,
      name: "",
      // step1 문제 돈 크기
      targetCount: 1,
      freqPerYear: 250,
      minutesPerEvent: 30,
      loadedHourlyWage: 35000, // 부담원가 시급(간접비 포함) — 이중가산 금지
      complaintPerEvent: 0,
      periodTotalLoss: 0, // 이탈·기회손실 연총액(빈도로 재곱 금지)
      // step2 해결 임팩트
      reductionRate: 0.6,
      adoptionRate: null, // ★기본값 비움: 결과를 가장 크게 좌우 → 직접 고르거나 모르겠어요
      rampupFactor: 0.6,
      annualMaintenanceOpex: 0,
      // step3 투자
      buildCost: 0,
      internalCost: 0, // 내 시간·내부공수(필수: '공짜' 착각 방지)
      hardBlock: false,
      // 신뢰도: 사용자가 실측 확정한 필드 집합 / 모르겠어요 필드 집합
      measured: {},
      unknown: {},
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

const LOAD_BEARING = {
  save: ["adoptionRate", "reductionRate", "loadedHourlyWage", "freqPerYear", "buildCost"],
  earn: ["revenue", "outsourcing", "internalCost"],
};

function n(v, d = 0) {
  const x = Number(v);
  return isFinite(x) ? x : d;
}

// 월별 누적현금흐름 0선 교차로 회수개월 계산(1년차 램프업 반영)
function paybackMonths(totalInvestment, firstYearNet, steadyNet, cap = 120) {
  if (totalInvestment <= 0) return 0;
  if (firstYearNet <= 0 && steadyNet <= 0) return Infinity;
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
  const measured = keys.filter((k) => inputs.measured && inputs.measured[k] && !(inputs.unknown && inputs.unknown[k]));
  const unknown = keys.filter((k) => inputs.unknown && inputs.unknown[k]);
  let level = "low";
  if (measured.length >= Math.ceil(keys.length / 2)) level = "high";
  else if (measured.length >= 1) level = "mid";
  return { level, measuredKeys: measured, unknownKeys: unknown, hasMeasured: measured.length > 0 };
}

function computeSave(inp) {
  const targetCount = n(inp.targetCount);
  const freqPerYear = n(inp.freqPerYear);
  const minutesPerEvent = n(inp.minutesPerEvent);
  const wage = n(inp.loadedHourlyWage);
  const complaint = n(inp.complaintPerEvent);
  const periodTotal = n(inp.periodTotalLoss);

  const perEventLoss = (minutesPerEvent / 60) * wage + complaint;
  const recurringAnnual = targetCount * freqPerYear * perEventLoss;
  const annualProblemCost = recurringAnnual + periodTotal;

  const reduction = clamp01(n(inp.reductionRate, 0));
  const adoption = inp.adoptionRate == null ? null : clamp01(n(inp.adoptionRate));
  const rampup = clamp01(n(inp.rampupFactor, 1));
  const opex = n(inp.annualMaintenanceOpex);
  const totalInvestment = n(inp.buildCost) + n(inp.internalCost);

  function forAdoption(a) {
    const netSaving = annualProblemCost * reduction * a;
    const steady = netSaving - opex;
    const first = netSaving * rampup - opex;
    const pm = paybackMonths(totalInvestment, first, steady);
    return { adoption: a, netSaving, steady, first, payback: pm };
  }

  const baseA = adoption == null ? 0.6 : adoption;
  const base = forAdoption(baseA);
  // 민감도: 핵심 드라이버(채택률) 하나만 흔든다(이중 헤어컷 금지).
  const cons = forAdoption(clamp01(baseA * (adoption == null ? 0.55 : 0.7)));
  const aggr = forAdoption(clamp01(baseA * 1.2));

  const roi1y = totalInvestment > 0 ? (base.first - totalInvestment) / totalInvestment : null;
  const roi2y = totalInvestment > 0 ? (base.first + base.steady - totalInvestment) / totalInvestment : null;

  const conf = confidenceOf({ ...inp, adoptionRate: adoption }, "save");
  const adoptionUnknown = adoption == null || (inp.unknown && inp.unknown.adoptionRate);

  return {
    mode: "save",
    annualProblemCost,
    recurringAnnual,
    periodTotal,
    perEventLoss,
    reduction,
    adoption: baseA,
    adoptionUnknown,
    rampup,
    opex,
    totalInvestment,
    netSaving: base.netSaving,
    steadyNet: base.steady,
    firstYearNet: base.first,
    payback: base.payback,
    roi1y,
    roi2y,
    cases: { conservative: cons, base, aggressive: aggr },
    cashflow: cashflowSeries(totalInvestment, base.first, base.steady, 24),
    confidence: conf,
    valid: annualProblemCost > 0 && adoption != null && reduction > 0,
  };
}

function computeEarn(inp) {
  const revenue = n(inp.revenue);
  const outsourcing = n(inp.outsourcing);
  const internal = n(inp.internalCost);
  const infra = n(inp.infraLicense);
  const risk = n(inp.riskReserve);
  const prob = clamp01(n(inp.prob, 0));
  const profit = revenue - outsourcing - internal - infra - risk;
  const margin = revenue > 0 ? profit / revenue : null;
  const weighted = revenue * prob;
  const conf = confidenceOf(inp, "earn");
  return {
    mode: "earn",
    revenue,
    cost: outsourcing + internal + infra + risk,
    profit,
    margin,
    prob,
    weighted,
    confidence: conf,
    valid: revenue > 0,
  };
}

export function compute(inputs) {
  const mode = typeOf(inputs.projectType).mode;
  const r = mode === "save" ? computeSave(inputs) : computeEarn(inputs);
  const verdict = decideVerdict(inputs, r);
  return { ...r, verdict, oneLiner: oneLiner(inputs, r, verdict), sales: salesSentence(inputs, r, verdict) };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// 신호등 판정. 하드게이트 → 추정 의존 시 초록 차단 → 회수/마진 임계.
function decideVerdict(inputs, r) {
  if (inputs.hardBlock) {
    return { light: "red", capped: false, reason: "규제·전략 불일치 하드게이트", improve: "" };
  }
  if (!r.valid) {
    return {
      light: "gray",
      capped: false,
      reason: r.mode === "save" ? "채택률·절감률 등 핵심 입력이 비어 판정 불가" : "수주액이 비어 판정 불가",
      improve: r.mode === "save" ? "채택률을 고르거나 '모르겠어요'로 진행하세요." : "수주 예상액을 입력하세요.",
    };
  }
  let light;
  let reason;
  let improve = "";
  if (r.mode === "save") {
    const p = r.payback;
    if (r.firstYearNet <= 0 && r.steadyNet <= 0) {
      light = "red";
      reason = "연 순효익이 0 이하 — 지금 구조로는 남지 않음";
    } else if (!isFinite(p)) {
      light = "red";
      reason = "투자 회수 불가(유지운영비·내 시간 재검토 필요)";
    } else if (p < 12) {
      light = "green";
      reason = `회수 약 ${fmtMonths(p)}`;
    } else if (p <= 24) {
      light = "amber";
      reason = `회수 약 ${fmtMonths(p)} — 조건부`;
      improve = "채택률을 실측으로 올리면 회수가 당겨집니다.";
    } else {
      light = "red";
      reason = `회수 ${fmtMonths(p)} — 너무 김`;
      improve = "유지운영비·내 시간·구축비를 줄이거나 절감폭을 키워야 합니다.";
    }
  } else {
    if (r.profit <= 0) {
      light = "red";
      reason = "남는 돈이 0 이하 — 이 조건으로는 손해";
    } else if (r.margin >= 0.15) {
      light = "green";
      reason = `프로젝트 이익 ${won(r.profit)} (이익률 ${pct(r.margin)})`;
    } else if (r.margin >= 0.05) {
      light = "amber";
      reason = `이익률 ${pct(r.margin)} — 얇음`;
      improve = "가격을 낮출 땐 범위·일정·유지보수로 반드시 무언가를 받으세요(Give&Get).";
    } else {
      light = "red";
      reason = `이익률 ${pct(r.margin)} — 너무 얇음`;
      improve = "원가(외주·내부공수)를 줄이거나 수주가를 올려야 합니다.";
    }
  }
  // 거짓정밀 방지: 초록인데 실측 입력이 하나도 없으면 노랑으로 강등.
  let capped = false;
  if (light === "green" && r.confidence.level === "low") {
    light = "amber";
    capped = true;
    improve = improve || "핵심 입력이 전부 추정입니다. 하나라도 실측으로 확인하면 초록으로 확정됩니다.";
  }
  return { light, capped, reason, improve };
}

const LIGHT_KO = { green: "진행", amber: "조건부", red: "중단", gray: "판정 불가" };
const LIGHT_EMOJI = { green: "🟢", amber: "🟡", red: "🔴", gray: "⚪" };

export function verdictText(v) {
  return { ...v, ko: LIGHT_KO[v.light], emoji: LIGHT_EMOJI[v.light] };
}

function confSuffix(r) {
  if (r.confidence.level === "low") return " (입력 다수가 추정 — 검증 필요)";
  if (r.confidence.level === "mid") return " (일부 실측)";
  return "";
}

function oneLiner(inputs, r, v) {
  const name = inputs.name || "이 건";
  const emoji = LIGHT_EMOJI[v.light];
  const ko = LIGHT_KO[v.light];
  if (v.light === "gray") return `${emoji} ${ko} — ${v.reason}`;
  let core;
  if (r.mode === "save") {
    core = `${name}은 지금 기준 ${v.reason}`;
    if (v.improve) core += `. ${v.improve}`;
  } else {
    core = `${name}은 ${v.reason}`;
    if (v.improve) core += `. ${v.improve}`;
  }
  return `${emoji} ${ko} — ${core}${confSuffix(r)}`;
}

function rangeText(r) {
  if (r.mode !== "save") return "";
  const lo = Math.max(0, r.cases.conservative.netSaving);
  const hi = r.cases.aggressive.netSaving;
  return `범위 ${won(lo)}~${won(hi)}`;
}

// 영업(내부 검토)용 근거문장 — 신뢰도 라벨·범위를 문장에 강제로 박는다.
function salesSentence(inputs, r, v) {
  const name = inputs.name || "이 건";
  const label = r.confidence.level === "high" ? "실측 기반" : r.confidence.level === "mid" ? "일부 실측" : "추정";
  if (r.mode === "save") {
    if (!r.valid) return "";
    const monthlyLoss = r.annualProblemCost / 12;
    return (
      `${name}은 연 약 ${won(r.annualProblemCost)}(${label}) 규모의 문제입니다. ` +
      `해결 시 채택률 ${pct(r.adoption)}·절감률 ${pct(r.reduction)} 가정에서 연 약 ${won(r.netSaving)} 절감(${label}, ${rangeText(r)}), ` +
      `투자 ${won(r.totalInvestment)} → ${v.light === "red" && !isFinite(r.payback) ? "회수 불가" : "약 " + fmtMonths(r.payback) + " 회수"}. ` +
      `지금 방치하면 매달 약 ${won(monthlyLoss)}(${label})씩 손실이 쌓입니다. 신뢰도=${label}${r.confidence.level === "low" ? ", 검증 필요" : ""}.`
    );
  }
  if (!r.valid) return "";
  return (
    `${name}은 수주 ${won(r.revenue)}에서 원가 ${won(r.cost)}를 빼면 ${won(r.profit)}이 남습니다(이익률 ${pct(r.margin)}, ${label}). ` +
    `성공확률 ${pct(r.prob)} 반영 시 가중 기대 ${won(r.weighted)}. ` +
    `핵심 질문은 '${won(r.revenue)}짜리인가'가 아니라 '${won(r.profit)} 남길 건인가'입니다. 신뢰도=${label}.`
  );
}

// 워터마크: 로드베어링 숫자가 전부 추정이면 '내부 검토용'
export function needsWatermark(r) {
  return r && r.confidence && r.confidence.level === "low";
}
