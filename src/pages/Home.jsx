import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore, currentWeekKey } from "../lib/store.js";
import { pipelineWeighted, rottingOf, stageById } from "../lib/deal.js";
import { compute } from "../lib/money.js";
import { won, weekLabel, weekMonday, relDate, daysBetween } from "../lib/format.js";

function weeklyStreak(reviews) {
  const keys = new Set(reviews.filter((w) => (w.solvedSelf || []).length || (w.delegated || []).length).map((w) => w.weekOf));
  let streak = 0;
  const cur = new Date(currentWeekKey());
  for (let i = 0; i < 104; i++) {
    if (keys.has(weekMonday(cur))) { streak++; cur.setDate(cur.getDate() - 7); } else break;
  }
  return streak;
}

export default function Home() {
  const state = useStore();
  const nav = useNavigate();
  const { deals, moneyTests, weeklyReviews, meta } = state;

  const weighted = useMemo(() => pipelineWeighted(deals), [deals]);
  const rotting = deals.map((d) => ({ d, rot: rottingOf(d) })).filter((x) => x.rot?.level === "red");
  const streak = weeklyStreak(weeklyReviews);
  const weekKey = currentWeekKey();
  const thisWeekDone = weeklyReviews.some((w) => w.weekOf === weekKey && ((w.solvedSelf || []).length || (w.delegated || []).length));
  const greenTests = useMemo(() => moneyTests.filter((m) => { try { return compute(m.inputs || {}).verdict.light === "green"; } catch (e) { return false; } }).length, [moneyTests]);

  const empty = deals.length === 0 && moneyTests.length === 0 && weeklyReviews.length === 0;
  const daysSinceBackup = meta?.lastBackupAt ? daysBetween(meta.lastBackupAt) : null;
  const hasData = deals.length + moneyTests.length + weeklyReviews.length > 0;
  const showBackup = hasData && (daysSinceBackup == null || daysSinceBackup >= 7);

  // 오늘 할 일 1개 — 가장 급한 것 하나만
  let today = null;
  if (rotting.length) today = { text: `가장 급한 딜 "${rotting[0].d.name || "무제"}"의 다음 행동을 정하세요`, to: "/deals/" + rotting[0].d.id, cta: "딜 열기" };
  else if (!thisWeekDone && !empty) today = { text: `이번 주 자기리뷰가 비어 있습니다 — 직접 푼 일/넘긴 일 기록`, to: "/weekly", cta: "주간 리뷰" };
  else if (empty) today = { text: `머릿속의 "이거 돈 될까" 하나를 머니테스트로 돌려보세요`, to: "/money-test", cta: "머니테스트" };
  else today = { text: `접촉한 딜의 '마지막 접촉일'을 갱신하거나, 새 기회를 머니테스트로 검토하세요`, to: "/deals", cta: "딜 보기" };

  return (
    <div>
      <div className="page-head">
        <h1>오늘</h1>
        <p className="sub">여는 데 30초. 실무를 기록하면 사업감각과 리더십이 숫자로 남습니다.</p>
      </div>

      {showBackup && (
        <div className="notice warn section between" style={{ alignItems: "center" }}>
          <span>{daysSinceBackup == null ? "아직 백업한 적이 없습니다. 데이터는 이 브라우저에만 있습니다." : `마지막 백업 ${daysSinceBackup}일 전.`} 상단 "내보내기"로 지금 백업하세요.</span>
        </div>
      )}

      <div className="section">
        <div className="section-title">오늘 할 일 하나</div>
        <div className="panel panel-pad between" style={{ alignItems: "center" }}>
          <div className="li-title" style={{ minWidth: 0 }}>{today.text}</div>
          <button className="btn btn-sm btn-primary" onClick={() => nav(today.to)}>{today.cta}</button>
        </div>
      </div>

      <div className="section quick-grid">
        <button className="quick" onClick={() => nav("/money-test")}><span className="q-ic">💰</span> 돈 되는지 검토 <span className="q-sub">머니테스트</span></button>
        <button className="quick" onClick={() => nav("/deals")}><span className="q-ic">🗂️</span> 딜 기록 <span className="q-sub">파이프라인</span></button>
        <button className="quick" onClick={() => nav("/weekly")}><span className="q-ic">🧭</span> 주간 리뷰 <span className="q-sub">북극성</span></button>
      </div>

      <div className="stat-row section">
        <div className="stat"><div className="k">가중 파이프라인</div><div className="v">{won(weighted)}</div><div className="d">딜 {deals.length}건</div></div>
        <div className="stat"><div className="k">머니테스트</div><div className="v">{moneyTests.length}<small>건</small></div><div className="d">진행 판정 {greenTests}건</div></div>
        <div className="stat"><div className="k">주간리뷰 연속</div><div className="v">{streak}<small>주</small></div><div className="d">{thisWeekDone ? "이번 주 완료" : "이번 주 미작성"}</div></div>
      </div>

      {empty && (
        <div className="panel empty section">
          <div className="em-ic">🌱</div>
          <h3>성장원장을 시작해 보세요</h3>
          <p>가장 좋은 첫 걸음은 지금 머릿속에 있는 "이거 하면 돈이 될까" 하나를 머니테스트로 돌려보는 것입니다. 재무를 몰라도 됩니다.</p>
          <button className="btn btn-primary" onClick={() => nav("/money-test")}>머니테스트 해보기</button>
        </div>
      )}

      {rotting.length > 0 && (
        <div className="section">
          <div className="section-title">방치 경고 — 다음 행동이 필요한 딜</div>
          <div className="panel panel-pad">
            <div className="stack">
              {rotting.map(({ d, rot }) => (
                <button key={d.id} className="li" style={{ textAlign: "left", background: "transparent", border: "none", cursor: "pointer", width: "100%" }} onClick={() => nav("/deals/" + d.id)}>
                  <span className="dot red" style={{ marginTop: 6 }} />
                  <div className="li-main">
                    <div className="li-title">{d.name || "(무제)"} <span className="tiny muted">· {stageById(d.stageId).name} · {won(d.amount)}</span></div>
                    <div className="li-sub">{rot.why}{d.lastContact ? ` · 마지막 접촉 ${relDate(d.lastContact)}` : ""}</div>
                  </div>
                  <span className="btn btn-sm">열기</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <div className="notice info">이 앱의 첫 목표는 8주 뒤 "행동"으로 성공을 정의합니다: 딜 3건이 표에 살아 있고, 머니테스트 3장을 돌렸고, 주간리뷰가 4주 연속 채워지는 것.</div>
      </div>
    </div>
  );
}
