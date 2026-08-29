import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, addDeal, DEFAULT_STAGES } from "../lib/store.js";
import { won, manToWon } from "../lib/format.js";
import { stageById, rottingOf } from "../lib/deal.js";
import Modal from "../components/Modal.jsx";

export default function Deals() {
  const deals = useStore((s) => s.deals);
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", amountMan: "", stageId: "lead" });

  const active = deals.filter((d) => d.stageId !== "lost");
  const weighted = useMemo(
    () => active.reduce((sum, d) => sum + (Number(d.amount) || 0) * stageById(d.stageId).prob, 0),
    [active]
  );
  const openCount = deals.filter((d) => d.stageId !== "won" && d.stageId !== "lost").length;
  const rottingCount = deals.filter((d) => rottingOf(d)?.level === "red").length;

  function submit() {
    if (!draft.name.trim()) return;
    const id = addDeal({ name: draft.name.trim(), amount: manToWon(draft.amountMan || 0), stageId: draft.stageId });
    setAdding(false);
    setDraft({ name: "", amountMan: "", stageId: "lead" });
    nav("/deals/" + id);
  }

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>딜 파이프라인</h1>
          <p className="sub">감이 아니라 표로. 가중금액 = 예상금액 × 단계 확률.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ 딜 추가</button>
      </div>

      <div className="stat-row section">
        <div className="stat"><div className="k">가중 파이프라인</div><div className="v">{won(weighted)}</div><div className="d">확률 반영 기대 총액</div></div>
        <div className="stat"><div className="k">진행 중 딜</div><div className="v">{openCount}<small>건</small></div><div className="d">수주·실패 제외</div></div>
        <div className="stat"><div className="k">방치 경고</div><div className="v" style={{ color: rottingCount ? "var(--red)" : "inherit" }}>{rottingCount}<small>건</small></div><div className="d">다음행동 없음·장기 미접촉</div></div>
      </div>

      {deals.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">🗂️</div>
          <h3>아직 딜이 없습니다</h3>
          <p>지금 실제로 진행 중이거나 검토 중인 건을 하나 올려보세요. 감으로 굴리던 영업이 표가 됩니다.</p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>첫 딜 추가</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>거래명</th>
                <th className="num">예상금액</th>
                <th>단계</th>
                <th className="num">가중금액</th>
                <th>다음행동</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const st = stageById(d.stageId);
                const rot = rottingOf(d);
                return (
                  <tr key={d.id} onClick={() => nav("/deals/" + d.id)}>
                    <td><b>{d.name || "(무제)"}</b>{d.moneyTestId && <span className="badge gray" style={{ marginLeft: 6 }}>머니테스트</span>}</td>
                    <td className="num mono">{won(d.amount)}</td>
                    <td><span className="badge gray">{st.name} {Math.round(st.prob * 100)}%</span></td>
                    <td className="num mono">{won((Number(d.amount) || 0) * st.prob)}</td>
                    <td>{d.nextWhat ? <span>{d.nextWhat} <span className="tiny muted">/ {d.nextWho}</span></span> : <span className="badge red">없음</span>}</td>
                    <td>{rot ? <span className="gap-wrap"><span className={"dot " + rot.level} /> <span className="tiny muted">{rot.why}</span></span> : <span className="badge gray">{st.name}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <Modal
          title="딜 추가"
          onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>취소</button><button className="btn btn-primary" onClick={submit} disabled={!draft.name.trim()}>추가</button></>}
        >
          <div className="field">
            <label>거래명</label>
            <input className="input" autoFocus value={draft.name} placeholder="예: A병원 접수 시스템" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field">
              <label>예상금액</label>
              <div className="input-group">
                <input className="input" type="number" inputMode="decimal" value={draft.amountMan} onChange={(e) => setDraft({ ...draft, amountMan: e.target.value })} />
                <span className="suffix">만원</span>
              </div>
            </div>
            <div className="field">
              <label>단계</label>
              <select className="select" value={draft.stageId} onChange={(e) => setDraft({ ...draft, stageId: e.target.value })}>
                {DEFAULT_STAGES.filter((s) => s.id !== "lost").map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({Math.round(s.prob * 100)}%)</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
