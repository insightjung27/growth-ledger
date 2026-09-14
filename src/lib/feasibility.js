// 타당성 스코어링 엔진 + 정렬/진척/orphan 파생 — 전부 순수함수(파생값 저장 금지).
// ★정직 규율: computedScore는 '주관 1~5 채점 기반 보조 점수'. 하드게이트 서사·근거가 우선.

export const FEAS_AXES = [
  { key: "goalAlign", label: "목표정렬", weight: 25, dir: 1, hint: "연결한 KR을 이 일이 얼마나 직접 전진시키나" },
  { key: "value", label: "가치·ROI", weight: 20, dir: 1, hint: "회수·ROI·이익 — 연결한 머니테스트가 근거" },
  { key: "strategicFit", label: "전략적합", weight: 15, dir: 1, hint: "회사 방향·핵심역량과 맞는가" },
  { key: "feasibility", label: "실행가능성", weight: 15, dir: 1, hint: "우리 역량·자원·기간으로 해낼 수 있나" },
  { key: "risk", label: "리스크", weight: 15, dir: -1, hint: "실패·부작용 위험(클수록 감점)" },
  { key: "cost", label: "비용·노력", weight: 10, dir: -1, hint: "투입 비용·공수(클수록 감점)" },
];

export const SCORE_LABELS = { 1: "매우 낮음", 2: "낮음", 3: "보통", 4: "높음", 5: "매우 높음" };
export const CONFIDENCE_OPTS = [
  { v: 1.0, label: "검증됨", desc: "실측·근거 기반" },
  { v: 0.8, label: "방향성", desc: "합리적 추정" },
  { v: 0.5, label: "추측", desc: "감·가정 수준" },
];
export function confidenceLabel(v) { return (CONFIDENCE_OPTS.find((c) => c.v === v) || CONFIDENCE_OPTS[1]).label; }

const REASONS = { go: "진행 추천", hold: "조건부 — 보완 후 재검토", nogo: "반려", pending: "채점 미완료" };
export const VERDICT_LIGHT = { go: "green", hold: "amber", nogo: "red", pending: "gray" };
export const VERDICT_KO = { go: "Go", hold: "Hold", nogo: "No-Go", pending: "대기" };

// 타당성 판정 — STEP1 하드게이트 → STEP2 총점 → STEP3 밴드
export function scoreCase(c) {
  const scores = (c && c.scores) || {};
  const conf = (c && c.confidence) || 0.8;
  const gates = (c && c.gates) || {};
  // STEP 1 — 하드게이트(가중점수 무시, 순서대로)
  if (!c.linkedKrId) return gate("hold", "goal", "기업목표(KR) 미연결 — 먼저 목표에 연결해야 타당성을 채점할 수 있습니다");
  if (gates.compliance === false) return gate("nogo", "compliance", "규제·컴플라이언스 위반 — 하드게이트");
  if (gates.reversibility === "oneway" && conf <= 0.5) return gate("nogo", "reversibility", "비가역(one-way door) + 추측 수준 확신 — 검증 전 진행 금지");
  if (gates.budgetFit === false) return gate("nogo", "budget", "예산·기한 초과 확정 — 하드게이트");
  // STEP 2 — 총점(미채점 축 있으면 산출 금지)
  const missing = FEAS_AXES.filter((a) => scores[a.key] == null);
  if (missing.length) return { verdict: "pending", label: "채점 미완료", reason: `${missing.map((a) => a.label).join("·")} 미채점`, computed: null, rawScore: null, confidence: conf, scored: false, hardGate: false, missing: missing.map((a) => a.key) };
  let sum = 0;
  for (const a of FEAS_AXES) { const raw = Number(scores[a.key]); const eff = a.dir === 1 ? raw : 6 - raw; sum += eff * a.weight; }
  const rawScore = (sum / 500) * 100; // Σweight=100, 축최대 5 → 최대 500
  const computed = Math.round(rawScore * conf);
  let verdict;
  if (computed >= 75) verdict = "go";
  else if (computed >= 55) verdict = "hold";
  else verdict = "nogo";
  return { verdict, label: VERDICT_KO[verdict], reason: REASONS[verdict], computed, rawScore: Math.round(rawScore), confidence: conf, scored: true, hardGate: false };
}
function gate(verdict, gate, reason) { return { verdict, label: VERDICT_KO[verdict], reason, gate, computed: null, rawScore: null, scored: false, hardGate: true }; }

export function bandFilterMatch(verdict, filter) { return filter === "all" || filter === verdict; }

/* ===== 목표/KR 진척(파생) ===== */
export function krProgress(k) {
  const s = Number(k.startValue), t = Number(k.targetValue), c = Number(k.currentValue);
  if (!isFinite(s) || !isFinite(t) || !isFinite(c)) return null;
  if (t === s) return c >= t ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((c - s) / (t - s)) * 100)));
}
export function goalProgress(goal) {
  const krs = (goal && goal.keyResults) || [];
  const vals = krs.map(krProgress).filter((v) => v != null);
  if (!vals.length) return { pct: null, krCount: krs.length };
  return { pct: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), krCount: krs.length };
}

/* ===== 프로젝트 진척(파생 — ticket+handoff+milestone done 비율) ===== */
export function projectProgress(project, tickets, handoffs) {
  const pts = (tickets || []).filter((t) => t.projectId === project.id);
  const phs = (handoffs || []).filter((h) => (project.handoffIds || []).includes(h.id));
  const ms = project.milestones || [];
  const items = [...pts.map((t) => t.status === "done"), ...phs.map((h) => h.status === "done"), ...ms.map((m) => !!m.done)];
  if (!items.length) return { pct: null, total: 0, done: 0 };
  const done = items.filter(Boolean).length;
  return { pct: Math.round((done / items.length) * 100), total: items.length, done };
}

/* ===== [M3] 정렬·orphan 자동 검출(허영 배지 금지 — 각 건은 재검토 액션으로 연결) ===== */
export function findOrphans(state) {
  const out = [];
  for (const c of state.feasibilityCases || []) {
    if (c.status !== "draft" && !c.linkedKrId) out.push({ type: "case", id: c.id, title: c.title || "(무제 타당성)", why: "목표(KR) 미연결인데 draft를 벗어남", to: "/feasibility/" + c.id });
  }
  for (const p of state.projects || []) {
    if (!["closed", "killed"].includes(p.status) && !p.goalId) out.push({ type: "project", id: p.id, title: p.title || "(무제 프로젝트)", why: "기업목표에 정렬되지 않음", to: "/projects/" + p.id });
  }
  return out;
}

/* ===== [M8] 판정 대기 예측(마감 지남 & 미판정) ===== */
export function pendingPredictions(state, todayIso) {
  return (state.predictions || []).filter((p) => p.resolution == null && p.resolveBy && String(p.resolveBy).slice(0, 10) <= todayIso);
}

/* ===== 예측 캘리브레이션(파생 — 표본게이트는 화면에서) ===== */
export function brierScore(resolved) {
  const done = resolved.filter((p) => p.resolution === "YES" || p.resolution === "NO");
  if (!done.length) return null;
  const sum = done.reduce((acc, p) => { const o = p.resolution === "YES" ? 1 : 0; return acc + Math.pow((p.probability || 0) - o, 2); }, 0);
  return { brier: sum / done.length, n: done.length };
}
