// 코칭 지침(R4) — 코칭 원문 23원칙을 구조화. 인라인 힌트 + /guide 콘텐츠 공용.

export const CAREER_NORTHSTAR = {
  title: "커리어 북극성 — Business-oriented Product Leader",
  line: "고객 문제를 사업기회로 바꾸고, 제품과 조직을 움직여 실제 성과를 만드는 사람",
  ladder: ["서비스기획 리더", "Product Leader", "Business/Product Leader", "사업부·플랫폼 조직 책임자"],
  chain: ["고객 발견", "돈 되는 문제", "사업성 판단", "상품·서비스 설계", "조직을 움직여 만든다", "고객에게 제안", "계약·매출", "숫자로 성과 증명", "다른 사람도 이 과정을 하게 만든다"],
  evalSentences: [
    "좋은 기획자: 내가 얼마나 좋은 결과물을 만들었는가",
    "좋은 리더: 내가 없어도 팀이 좋은 결과를 만들게 했는가",
    "사업 리더: 그 팀 결과가 고객·회사에 실제로 얼마의 가치를 만들었는가",
  ],
};

// 항목2 — 고객 미팅 질문 흐름(10단계) + 핵심 2질문
export const CUSTOMER_QUESTIONS = [
  { key: "current", step: "현재", q: "지금 어떻게 하고 있습니까?" },
  { key: "problem", step: "문제", q: "가장 불편한 부분은 무엇입니까?" },
  { key: "impact", step: "영향", q: "그 문제 때문에 실제로 무엇이 손실됩니까?" },
  { key: "importance", step: "중요도", q: "그 문제가 지금 얼마나 중요합니까?" },
  { key: "pastSolutions", step: "기존 해결", q: "지금까지 어떻게 해결하려 했습니까?" },
  { key: "failReason", step: "실패 이유", q: "왜 해결되지 않았습니까?" },
  { key: "budget", step: "예산", q: "해결한다면 어느 정도 투자가 가능합니까?" },
  { key: "decisionMaker", step: "의사결정", q: "누가 최종 결정합니까?" },
  { key: "timeline", step: "일정", q: "언제까지 해결해야 합니까?" },
  { key: "successCriteria", step: "성공 기준", q: "무엇이 달라지면 성공이라고 봅니까?" },
];
export const KEY_QUESTIONS = [
  "그 문제가 해결되지 않으면 어떤 일이 생깁니까? (Pain)",
  "이 프로젝트를 진행할지 말지 최종 판단하는 기준은 무엇입니까? (Decision)",
];

// 항목3 — 딜 여정
export const DEAL_JOURNEY = [
  { key: "requirements", label: "요구파악", check: "고객의 진짜 문제·성공기준을 확인했는가" },
  { key: "proposal", label: "제안", check: "해결 구조와 지불 이유를 설계했는가" },
  { key: "quote", label: "견적", check: "P&L 기준 남는 돈을 확인했는가" },
  { key: "nego", label: "협상", check: "가격 낮출 땐 Give&Get을 받았는가" },
  { key: "contract", label: "계약", check: "다음 행동·마감이 확정됐는가" },
];
export const GIVE_AND_GET = ["Scope 축소", "일정 연장", "결제조건 개선", "계약기간 연장", "추가계약"];
export const NEXT_STEP_TIP = "미팅은 다음 행동이 확정돼야 끝난다. '검토하고 연락 주세요'가 아니라 '화요일까지 범위 재정리해 보내고, 수요일 오후 기술범위 확인'처럼 상대의 의사결정을 한 단계 앞으로.";

// 항목7 — 6요소 지시
export const SIX_ELEMENTS = [
  { key: "why", label: "WHY", desc: "왜 하는가" },
  { key: "outcome", label: "OUTCOME", desc: "무엇이 달라져야 하는가" },
  { key: "metric", label: "METRIC", desc: "성공을 어떻게 측정하는가" },
  { key: "boundary", label: "BOUNDARY", desc: "무엇을 건드리면 안 되는가" },
  { key: "authority", label: "AUTHORITY", desc: "어디까지 본인이 결정하는가" },
  { key: "deadline", label: "DEADLINE", desc: "언제까지인가" },
];
export const REVIEW_CHECKPOINTS = [
  { pct: 20, lens: "direction", label: "방향", tip: "20%에서 방향을 본다" },
  { pct: 50, lens: "logic", label: "논리", tip: "50%에서 논리를 본다" },
  { pct: 80, lens: "quality", label: "품질", tip: "80%에서 품질을 본다. 100%에서 처음 보면 비용이 너무 크다" },
];

// 항목5 — 1:1
export const ONE_ON_ONE = {
  structure: ["요즘 어떤가(10분)", "업무에서 막히는 것(10분)", "내가 도와줄 것(10분)", "성장·피드백·커리어(10분)"],
  leaderQuestions: [
    "내가 무엇을 바꾸면 당신이 일을 더 잘할 수 있습니까?",
    "최근 한 달 가장 잘했다고 생각하는 일은?",
    "가장 힘들었던 일은?",
    "내가 개입했어야 하는데 안 한 것이 있습니까?",
    "반대로 내가 너무 많이 개입한 부분은?",
  ],
  thinkingQuestions: [
    "이 문제를 한 문장으로 정의하면?",
    "이 사용자는 왜 이 행동을 할까요?",
    "이 안의 가장 큰 리스크는?",
    "A안 대신 B안을 택한 근거는?",
    "성과지표는 무엇으로 볼 건가요?",
  ],
  note: "진척만 확인하면 실패. 답을 바로 고쳐주지 말고 생각시키는 질문으로. 그래야 6개월 뒤 팀원이 성장한다.",
};

// 성과 평가 축
export const EVAL_AXES = [
  { key: "result", label: "Result", desc: "결과를 냈는가" },
  { key: "ownership", label: "Ownership", desc: "끝까지 책임졌는가" },
  { key: "quality", label: "Quality", desc: "결과물 수준이 좋은가" },
  { key: "collaboration", label: "Collaboration", desc: "다른 사람과 일을 만들어냈는가" },
  { key: "growth", label: "Growth Impact", desc: "다른 사람까지 성장시키는가(시니어)" },
];

// 판단 프레임(기둥①)
export const DECISION_FRAMES = {
  money: "돈으로 얼마짜리 문제·기회인가 → 머니테스트(회수·ROI·이익)",
  ev: "기대값: 옵션별 (성공확률 × 가치) 비교",
  criteria: "판단 기준: 무엇이 충족되면 Yes/No인가를 먼저 정한다",
  premortem: "프리모템: 이게 실패한다면 왜일까(실패 원인을 미리)",
  opportunity: "기회비용: 이걸 하면 못 하는 것은 무엇인가",
  reversibility: "되돌릴 수 있나: 되돌릴 수 없는 문(one-way door)이면 더 신중히",
};

// 리더 운영 리듬 / 직접 할 것 vs 넘길 것
export const LEADER_RHYTHM = ["월: 팀 우선순위 30분", "주중: 20/50/80 리뷰", "격주: 팀원 1:1", "금: 결과·리스크 확인", "월1: KPI·성과", "분기: 목표 재설정"];
export const LEADER_DO = "방향·우선순위·인력배치·갈등조정·중요 의사결정·상위보고·팀원 성장·결과 책임";
export const LEADER_DELEGATE = "화면 설계·상세 정책 작성·모든 문서 수정·모든 회의 참석·모든 개발 질문 답변";

// /guide 페이지용 섹션(원문 원칙 열람)
export const GUIDE_SECTIONS = [
  { id: "career", title: "커리어 북극성", body: [
    "서비스기획자 → 사업을 이해하는 Product/Business Leader → 매출·사람까지 책임지는 리더.",
    "필요 역량 5영역: Customer·Product·Execution(강점) + Business/Sales·People(보완). 기존 강점 양쪽에 Business와 People을 붙인다.",
    "평가 기준 3문장: (기획자) 좋은 결과물을 만들었나 → (리더) 내가 없어도 팀이 만들게 했나 → (사업 리더) 그 결과가 실제 얼마의 가치를 만들었나.",
  ] },
  { id: "money", title: "① 판단 — 문제를 돈으로 환산 + P&L", body: [
    "문제를 돈으로 환산: 대상수·빈도·건당손실 → 연 문제비용. '구축 8천만, 연 1.2억 절감이면 8개월 회수'처럼 사업가의 언어로.",
    "P&L 한 장: Revenue·COGS·Gross Profit·Internal Cost·Risk·CAC·LTV·Payback. '4억짜리인가'가 아니라 '7천만원 남길 건인가'.",
    "SI 사업성 검토는 이 능력을 연습하기 좋은 실전 — 고객요구·외주비·내부투입·리스크·마진을 한 장에.",
  ] },
  { id: "customer", title: "① 판단 — 고객 질문 & 딜", body: [
    "설명이 아니라 질문. 현재→문제→영향→중요도→기존해결→실패이유→예산→의사결정→일정→성공기준.",
    "핵심 2질문: '해결 안 되면 무슨 일이 생기나(Pain)', '진행 최종 판단 기준은(Decision)'.",
    "다음 단계 잡기: 미팅은 다음 행동이 확정돼야 끝난다. 가격 낮출 땐 Give&Get(범위·일정·유지보수·계약기간·추가계약).",
    "가중 파이프라인: 예상금액 × 성공확률. 기획자는 프로젝트를, 사업 리더는 파이프라인을 본다.",
  ] },
  { id: "delegate", title: "② 사람 — 위임수준 & 6요소 지시", body: [
    "위임수준 L1(조사·보고)~L5(영역 책임). 신입에게 L4=방임, 시니어에게 L1=마이크로매니징. 각 팀원을 한 단계 위로 올리는 게 육성.",
    "6요소 지시: WHY·OUTCOME·METRIC·BOUNDARY·AUTHORITY·DEADLINE. '결제 화면 개선안 만들어줘'가 아니라 목표·측정·경계·권한·마감까지.",
    "20/50/80 리뷰: 20%에서 방향, 50%에서 논리, 80%에서 품질. 100%에서 틀렸다 하면 비용 과대.",
  ] },
  { id: "oneonone", title: "② 사람 — 1:1 & 코칭", body: [
    "1:1은 진척 확인이 아니다: 요즘/막힌것/도와줄것/성장·피드백. 핵심 질문 '내가 뭘 바꾸면 더 잘 일할 수 있나'.",
    "답을 바로 고쳐주지 말 것: 생각시키는 질문으로. 빨라지지만 6개월 뒤 팀원은 그대로.",
    "자율이라는 방임 금지: 중간 점검 지점을 정한다. 에이스는 붙잡지 말고 더 큰 문제(업무→프로젝트→영역→결정권→사람)를.",
  ] },
  { id: "goals", title: "② 사람 — 팀 목표 & 성과", body: [
    "팀의 존재 이유를 선언하고, 분기마다 반드시 만드는 결과 3개만 정한다. 모든 업무 관리 X, 중요한 결과 관리.",
    "성과평가 4축: Result·Ownership·Quality·Collaboration(+시니어 Growth Impact). 호감도가 아니라 기대값 대비 결과.",
    "저성과자: 사실+기대수준으로. 리더가 직접 할 것(방향·우선순위·결정·성장·책임) vs 넘길 것(화면설계·문서수정·모든회의)을 구분.",
  ] },
  { id: "weekly", title: "크로스 — 주간 자기리뷰", body: [
    "매주 금요일: 내가 직접 해결한 문제보다 다른 사람이 해결하게 만든 문제가 몇 개인지(북극성).",
    "실전 훈련(12주): 매주 고객미팅1·문제인터뷰1·제안서1·P&L1·협상복기1. 책 10권보다 실전 10번.",
  ] },
];
