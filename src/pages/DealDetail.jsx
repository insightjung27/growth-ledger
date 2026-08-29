import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore, updateDeal, removeDeal, DEFAULT_STAGES, addMoneyTest, getMoneyTest } from "../lib/store.js";
import { defaultInputs } from "../lib/money.js";
import { won, manToWon, wonToMan, isoDate } from "../lib/format.js";

export default function DealDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const deal = useStore((s) => s.deals.find((d) => d.id === id));

  if (!deal) {
    return (
      <div className="panel empty">
        <div className="em-ic">🔍</div>
        <h3>딜을 찾을 수 없습니다</h3>
        <Link className="btn" to="/deals">딜 목록으로</Link>
      </div>
    );
  }
  const mt = deal.moneyTestId ? getMoneyTest(deal.moneyTestId) : null;
  const set = (patch) => updateDeal(deal.id, patch);

  function createMoneyTest() {
    const base = defaultInputs("si");
    const nid = addMoneyTest({ name: deal.name, projectType: "si", inputs: { ...base, name: deal.name, revenue: deal.amount || 0 } });
    updateDeal(deal.id, { moneyTestId: nid });
    nav("/money-test/" + nid);
  }

  return (
    <div>
      <div className="page-head between">
        <div>
          <div className="tiny muted"><Link to="/deals">딜 파이프라인</Link> / 상세</div>
          <h1>{deal.name || "(무제)"}</h1>
        </div>
        <button className="btn btn-danger" onClick={() => { if (confirm("이 딜을 삭제할까요?")) { removeDeal(deal.id); nav("/deals"); } }}>삭제</button>
      </div>

      <div className="section panel panel-pad">
        <div className="field">
          <label>거래명</label>
          <input className="input" value={deal.name} onChange={(e) => set({ name: e.target.value })} />
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

      <div className="section">
        <div className="section-title">다음 단계 (미팅은 다음 행동이 정해져야 끝난다)</div>
        <div className="panel panel-pad">
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

      <div className="section">
        <div className="section-title">사업성 검토</div>
        <div className="panel panel-pad">
          {mt ? (
            <div className="between">
              <div><b>{mt.name || "머니테스트"}</b> <span className={"badge " + (mt.verdict || "gray")}>{mt.verdict === "green" ? "진행" : mt.verdict === "amber" ? "조건부" : mt.verdict === "red" ? "중단" : "판정 전"}</span></div>
              <Link className="btn btn-sm" to={"/money-test/" + mt.id}>열기</Link>
            </div>
          ) : (
            <div className="between">
              <div className="small muted">이 딜이 돈이 되는지 머니테스트로 검토하세요(수주액이 채워집니다).</div>
              <button className="btn btn-sm btn-primary" onClick={createMoneyTest}>머니테스트 만들기</button>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">협상·복기</div>
        <div className="panel panel-pad">
          <div className="field">
            <label>가격 반응</label>
            <input className="input" value={deal.priceReaction} placeholder="예: 4억은 비싸다 → 3.5억 요청" onChange={(e) => set({ priceReaction: e.target.value })} />
            {deal.priceReaction && <div className="why">가격을 낮출 땐 범위·일정·유지보수·계약기간 중 하나를 반드시 받으세요(Give&amp;Get).</div>}
          </div>
          <div className="field">
            <label>미결정·실패 사유</label>
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
