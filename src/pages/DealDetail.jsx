import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useStore, updateDeal, removeDeal, DEFAULT_STAGES,
  addMoneyTest, getMoneyTest, addDecision,
} from "../lib/store.js";
import { defaultInputs } from "../lib/money.js";
import { manToWon, wonToMan } from "../lib/format.js";
import { rottingOf } from "../lib/deal.js";
import { CUSTOMER_QUESTIONS, KEY_QUESTIONS, DEAL_JOURNEY, GIVE_AND_GET, NEXT_STEP_TIP } from "../lib/guidance.js";
import AutoSaved from "../components/AutoSaved.jsx";

// 단계(stageId) → 딜 여정(journey key) 매핑: 현재 단계에 해당하는 여정 칸을 강조
const STAGE_TO_JOURNEY = { lead: "requirements", meeting: "requirements", proposal: "proposal", quote: "quote", nego: "nego", won: "contract", lost: null };
// 핵심 2질문(Pain·Decision)에 대응하는 고객질문 키
const CORE_QUESTION_KEYS = ["impact", "decisionMaker"];
const DEC_STATUS_KO = { draft: "작성 중", verifying: "검증 중", decided: "결정됨", executing: "실행 중", reviewed: "대조 완료" };
const DEC_STATUS_BADGE = { draft: "gray", verifying: "amber", decided: "amber", executing: "green", reviewed: "green" };

export default function DealDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const deal = useStore((s) => s.deals.find((d) => d.id === id));
  const decisions = useStore((s) => s.decisions);

  if (!deal) {
    return (
      <div className="panel empty">
        <div className="em-ic">🔍</div>
        <h3>딜을 찾을 수 없습니다</h3>
        <p>이미 삭제되었거나 잘못된 주소입니다.</p>
        <Link className="btn" to="/deals">딜 목록으로</Link>
      </div>
    );
  }

  const set = (patch) => updateDeal(deal.id, patch);
  const cq = deal.customerQuestions || {};
  const jn = deal.journey || {};
  const setCQ = (key, val) => set({ customerQuestions: { ...cq, [key]: val } });
  const setJN = (key, val) => set({ journey: { ...jn, [key]: val } });

  const mt = deal.moneyTestId ? getMoneyTest(deal.moneyTestId) : null;
  const linkedDecision = deal.decisionId ? (decisions || []).find((x) => x.id === deal.decisionId) : null;

  const rot = rottingOf(deal);
  const isClosed = deal.stageId === "won" || deal.stageId === "lost";
  const stageIdx = DEFAULT_STAGES.findIndex((s) => s.id === deal.stageId);
  const proposalIdx = DEFAULT_STAGES.findIndex((s) => s.id === "proposal");
  const needsPnl = stageIdx >= proposalIdx && deal.stageId !== "lost" && !deal.moneyTestId;
  const currentJourneyKey = STAGE_TO_JOURNEY[deal.stageId] || null;
  const answered = CUSTOMER_QUESTIONS.filter((q) => String(cq[q.key] || "").trim()).length;
  const journeyDone = DEAL_JOURNEY.filter((s) => String(jn[s.key] || "").trim()).length;

  function createMoneyTest() {
    const base = defaultInputs("si");
    const nid = addMoneyTest({ name: deal.name, projectType: "si", inputs: { ...base, name: deal.name, revenue: deal.amount || 0 }, dealId: deal.id });
    updateDeal(deal.id, { moneyTestId: nid });
    nav("/money-test/" + nid);
  }

  function createDecision() {
    const nid = addDecision({ title: deal.name || "딜 판단", type: "strategy", question: `이 딜(${deal.name || "무제"})을 진행할지, 어떤 조건으로 갈지 판단한다.` });
    updateDeal(deal.id, { decisionId: nid });
    nav("/decisions/" + nid);
  }

  return (
    <div>
      <div className="page-head between">
        <div>
          <div className="tiny muted"><Link to="/deals">딜 파이프라인</Link> / 상세</div>
          <h1>{deal.name || "(무제)"}</h1>
          <div className="gap-wrap" style={{ marginTop: 6 }}>
            <span className="badge gray">{DEFAULT_STAGES.find((s) => s.id === deal.stageId)?.name || "리드"}</span>
            {rot ? <span className={"badge " + rot.level}><span className={"dot " + rot.level} />{rot.why}</span> : null}
            {deal.stageId === "won" ? <span className="badge green">수주</span> : null}
            {deal.stageId === "lost" ? <span className="badge red">실패</span> : null}
            {!isClosed ? <button className="btn btn-sm btn-ghost" onClick={() => set({ lastContact: new Date().toISOString() })}>오늘 접촉함</button> : null}
          </div>
          <div style={{ marginTop: 8 }}><AutoSaved at={deal.updatedAt} /></div>
        </div>
        <button className="btn btn-danger" onClick={() => { if (confirm("이 딜을 삭제할까요?")) { removeDeal(deal.id); nav("/deals"); } }}>삭제</button>
      </div>

      {isClosed ? (
        <div className="section">
          <div className={"notice " + (deal.stageId === "won" ? "ok" : "warn")}>
            {deal.stageId === "won" ? "수주 완료된 딜입니다. 아래 복기를 채워 다음 딜에 남기세요." : "종료(실패)된 딜입니다. 미결정·실패 사유를 복기로 남기면 다음에 달라집니다."}
          </div>
        </div>
      ) : null}

      {/* 딜 기본 */}
      <div className="section panel panel-pad">
        <div className="field">
          <label>거래명</label>
          <input className="input" value={deal.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: OO몰 결제 리뉴얼" />
        </div>
        <div className="row2">
          <div className="field">
            <label>예상금액</label>
            <div className="input-group">
              <input className="input" type="number" inputMode="decimal" value={wonToMan(deal.amount) || ""} onChange={(e) => set({ amount: manToWon(e.target.value || 0) })} />
              <span className="suffix">만원</span>
            </div>
          </div>
          <div className="field">
            <label>단계</label>
            <select className="select" value={deal.stageId} onChange={(e) => set({ stageId: e.target.value })}>
              {DEFAULT_STAGES.map((s) => (<option key={s.id} value={s.id}>{s.name} ({Math.round(s.prob * 100)}%)</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* 고객 미팅 질문 세트 — 기본 접기 */}
      <details className="section">
        <summary style={{ cursor: "pointer", marginBottom: 10 }}>
          <span className="section-title" style={{ margin: 0, display: "inline" }}>고객 미팅 질문 세트</span>
          <span className={"badge " + (answered >= 8 ? "green" : answered >= 4 ? "amber" : "gray")} style={{ marginLeft: 8 }}>{answered}/10 작성</span>
        </summary>
        <div className="panel panel-pad">
          <div className="notice info" style={{ marginBottom: 14 }}>
            <b>설명이 아니라 질문.</b> 이 두 가지를 반드시 확인하세요.
            <div className="stack" style={{ marginTop: 8 }}>
              {KEY_QUESTIONS.map((q, i) => (<div key={i} className="small">· {q}</div>))}
            </div>
          </div>
          {CUSTOMER_QUESTIONS.map((q) => {
            const core = CORE_QUESTION_KEYS.includes(q.key);
            return (
              <div className="field" key={q.key}>
                <label>
                  {q.step}
                  {core ? <span className="chip" style={{ marginLeft: 8, color: "var(--accent)", background: "var(--accent-weak)" }}>핵심</span> : null}
                </label>
                <input className="input" value={cq[q.key] || ""} placeholder={q.q} onChange={(e) => setCQ(q.key, e.target.value)} />
              </div>
            );
          })}
        </div>
      </details>

      {/* 딜 여정 산출물 — 기본 접기(현재 단계 칸은 펼침 유도) */}
      <details className="section">
        <summary style={{ cursor: "pointer", marginBottom: 10 }}>
          <span className="section-title" style={{ margin: 0, display: "inline" }}>딜 여정 산출물</span>
          <span className="badge gray" style={{ marginLeft: 8 }}>{journeyDone}/{DEAL_JOURNEY.length} 작성</span>
          {currentJourneyKey && !String(jn[currentJourneyKey] || "").trim() ? <span className="badge amber" style={{ marginLeft: 6 }}>펼쳐서 현재 단계 입력</span> : null}
        </summary>
        <div className="panel panel-pad">
          <div className="notice info" style={{ marginBottom: 14 }}>
            단계마다 <b>산출물과 확인 포인트</b>를 남기세요. 지금 단계는 <b>{DEFAULT_STAGES.find((s) => s.id === deal.stageId)?.name || "리드"}</b>입니다.
          </div>
          {DEAL_JOURNEY.map((step) => {
            const isCurrent = step.key === currentJourneyKey;
            return (
              <div className="field" key={step.key}>
                <label>
                  {step.label}
                  {isCurrent ? <span className="badge amber" style={{ marginLeft: 8 }}>현재 단계</span> : null}
                </label>
                <textarea
                  className="textarea"
                  style={isCurrent ? { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-weak)" } : undefined}
                  value={jn[step.key] || ""}
                  placeholder={step.check}
                  onChange={(e) => setJN(step.key, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </details>

      {/* 다음 단계 */}
      <div className="section">
        <div className="section-title">다음 단계 (미팅은 다음 행동이 정해져야 끝난다)</div>
        <div className="panel panel-pad">
          <div className="notice info" style={{ marginBottom: 14 }}>{NEXT_STEP_TIP}</div>
          <div className="field">
            <label>무엇을</label>
            <input className="input" value={deal.nextWhat} placeholder="예: 범위 재정리해 견적 송부" onChange={(e) => set({ nextWhat: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>누가</label>
              <input className="input" value={deal.nextWho} onChange={(e) => set({ nextWho: e.target.value })} />
            </div>
            <div className="field">
              <label>언제까지</label>
              <input className="input" type="date" value={deal.nextWhen || ""} onChange={(e) => set({ nextWhen: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>마지막 접촉일</label>
            <input className="input" type="date" value={(deal.lastContact || "").slice(0, 10)} onChange={(e) => set({ lastContact: e.target.value ? new Date(e.target.value).toISOString() : deal.lastContact })} />
            <div className="hint">비워두면 방치일수 계산이 안 됩니다. 접촉할 때마다 갱신하세요.</div>
          </div>
        </div>
      </div>

      {/* 사업성 검토 — 머니테스트 연결 */}
      <div className="section">
        <div className="section-title">사업성 검토 (P&amp;L · 머니테스트)</div>
        <div className="panel panel-pad">
          {needsPnl ? (
            <div className="notice warn" style={{ marginBottom: 14 }}>제안 단계 이상인데 P&amp;L(머니테스트)이 없습니다. '4억짜리인가'가 아니라 '얼마 남길 건인가'를 먼저 확인하세요.</div>
          ) : null}
          {mt ? (
            <div className="between">
              <div>
                <b>{mt.name || "머니테스트"}</b>{" "}
                <span className={"badge " + (mt.verdict || "gray")}>{mt.verdict === "green" ? "진행" : mt.verdict === "amber" ? "조건부" : mt.verdict === "red" ? "중단" : "판정 전"}</span>
              </div>
              <div className="gap-wrap">
                <Link className="btn btn-sm" to={"/money-test/" + mt.id}>열기</Link>
                <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm("이 딜과 머니테스트 연결을 끊을까요? (머니테스트는 삭제되지 않습니다)")) set({ moneyTestId: null }); }}>연결 해제</button>
              </div>
            </div>
          ) : (
            <div className="between">
              <div className="small muted">이 딜이 돈이 되는지 머니테스트로 검토하세요(수주 예상액이 자동으로 채워집니다).</div>
              <button className="btn btn-sm btn-primary" onClick={createMoneyTest}>머니테스트 만들기</button>
            </div>
          )}
        </div>
      </div>

      {/* 판단 연결 */}
      <div className="section">
        <div className="section-title">판단 연결 (이 딜의 진행 판단을 판단원장에 기록)</div>
        <div className="panel panel-pad">
          {linkedDecision ? (
            <div className="between">
              <div>
                <b>{linkedDecision.title || "판단"}</b>{" "}
                <span className={"badge " + (DEC_STATUS_BADGE[linkedDecision.status] || "gray")}>{DEC_STATUS_KO[linkedDecision.status] || "작성 중"}</span>
              </div>
              <div className="gap-wrap">
                <Link className="btn btn-sm" to={"/decisions/" + linkedDecision.id}>열기</Link>
                <button className="btn btn-sm btn-ghost" onClick={() => set({ decisionId: null })}>연결 해제</button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="small muted">진행/중단·조건 판단을 판단원장에 기록하면 예측→대조까지 남습니다.</div>
              <div className="gap-wrap">
                {(decisions || []).length > 0 ? (
                  <select className="select" style={{ maxWidth: 320 }} value="" onChange={(e) => { if (e.target.value) set({ decisionId: e.target.value }); }}>
                    <option value="">기존 판단에 연결…</option>
                    {(decisions || []).map((d) => (<option key={d.id} value={d.id}>{d.title || "(무제 판단)"}</option>))}
                  </select>
                ) : null}
                <button className="btn btn-sm btn-primary" onClick={createDecision}>판단 만들기</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 협상·복기 */}
      <div className="section">
        <div className="section-title">협상 · 복기</div>
        <div className="panel panel-pad">
          <div className="field">
            <label>가격 반응</label>
            <input className="input" value={deal.priceReaction} placeholder="예: 4억은 비싸다 → 3.5억 요청" onChange={(e) => set({ priceReaction: e.target.value })} />
            {deal.priceReaction ? (
              <div className="why">
                가격을 낮출 땐 반드시 무언가를 받으세요(Give&amp;Get).
                <div className="gap-wrap" style={{ marginTop: 6 }}>
                  {GIVE_AND_GET.map((g) => (<span key={g} className="chip">{g}</span>))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="field">
            <label>미결정 · 실패 사유</label>
            <input className="input" value={deal.lostReason} placeholder="왜 결정이 안 났는가 / 진짜 결정권자는 누구였나" onChange={(e) => set({ lostReason: e.target.value })} />
          </div>
          <div className="field">
            <label>메모</label>
            <textarea className="textarea" value={deal.memo} placeholder="고객이 진짜 원한 것 / 다음엔 무엇을 다르게" onChange={(e) => set({ memo: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}
