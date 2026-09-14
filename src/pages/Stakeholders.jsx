import { useState } from "react";
import { useStore, addStakeholder, updateStakeholder, removeStakeholder, STAKEHOLDER_ROLES, STANCES } from "../lib/store.js";
import Modal from "../components/Modal.jsx";

const ROLE_LABEL = Object.fromEntries(STAKEHOLDER_ROLES.map((r) => [r.id, r.label]));
const STANCE = Object.fromEntries(STANCES.map((s) => [s.id, s]));
const ROLE_ORDER = ["proposer", "execSponsor", "clientContact", "pm", "other"];

export default function Stakeholders() {
  const stakeholders = useStore((s) => s.stakeholders);
  const projects = useStore((s) => s.projects);
  const [modal, setModal] = useState(null);

  function openNew() { setModal({ name: "", role: "execSponsor", org: "", contact: "", power: 3, interest: 3, stance: "unclear", notes: "" }); }
  function save() {
    if (!modal.name.trim()) return;
    const { id, ...rest } = modal;
    if (id) updateStakeholder(id, rest); else addStakeholder(rest);
    setModal(null);
  }
  function del(s) { if (confirm(`이해관계자 "${s.name || "무명"}"을 삭제할까요? 프로젝트 연결만 해제됩니다.`)) removeStakeholder(s.id); }

  const sorted = stakeholders.slice().sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (b.power || 0) - (a.power || 0));

  return (
    <div>
      <div className="page-head between">
        <div>
          <h1>이해관계자</h1>
          <p className="sub">발의자·임원·고객사 담당·PM. 설득해야 할 사람을 데이터로. (수행 팀원은 <span className="muted">팀</span>에서)</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 이해관계자</button>
      </div>

      {stakeholders.length === 0 ? (
        <div className="panel empty">
          <div className="em-ic">👥</div>
          <h3>이해관계자가 없습니다</h3>
          <p>이 프로젝트를 발의한 사람, 승인권을 가진 임원, 고객사 담당자를 등록하세요. 권력·관심·태도를 알면 설득 전략이 서립니다.</p>
          <button className="btn btn-primary" onClick={openNew}>첫 이해관계자</button>
        </div>
      ) : (
        <div className="stack">
          {sorted.map((s) => {
            const st = STANCE[s.stance] || STANCE.unclear;
            const pc = projects.filter((p) => (p.stakeholderIds || []).includes(s.id)).length;
            return (
              <div key={s.id} className="li-card static">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="gap-wrap" style={{ marginBottom: 3 }}>
                    <span className={"badge " + st.color}>{st.label}</span>
                    <b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "(무명)"}</b>
                    <span className="tiny muted">{ROLE_LABEL[s.role]}{s.org ? " · " + s.org : ""}</span>
                  </div>
                  <div className="tiny muted">권력 {s.power}/5 · 관심 {s.interest}/5{pc ? ` · 프로젝트 ${pc}` : ""}{s.contact ? " · " + s.contact : ""}</div>
                  {s.notes ? <div className="tiny muted" style={{ marginTop: 3, whiteSpace: "pre-wrap" }}>{s.notes}</div> : null}
                </div>
                <span className="gap-wrap" style={{ flex: "0 0 auto" }}>
                  <button className="btn btn-sm" onClick={() => setModal({ id: s.id, name: s.name, role: s.role, org: s.org, contact: s.contact, power: s.power, interest: s.interest, stance: s.stance, notes: s.notes })}>편집</button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(s)}>삭제</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? "이해관계자 편집" : "이해관계자 추가"} onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>취소</button><button className="btn btn-primary" onClick={save} disabled={!modal.name.trim()}>{modal.id ? "저장" : "추가"}</button></>}>
          <div className="row2">
            <div className="field"><label>이름 <span style={{ color: "var(--red)" }}>*</span></label><input className="input" autoFocus value={modal.name} placeholder="예: 김이사(CTO)" onChange={(e) => setModal({ ...modal, name: e.target.value })} /></div>
            <div className="field"><label>역할</label><select className="select" value={modal.role} onChange={(e) => setModal({ ...modal, role: e.target.value })}>{STAKEHOLDER_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label>소속 <span className="tiny muted">(선택)</span></label><input className="input" value={modal.org} placeholder="고객사·부서" onChange={(e) => setModal({ ...modal, org: e.target.value })} /></div>
            <div className="field"><label>연락 <span className="tiny muted">(선택)</span></label><input className="input" value={modal.contact} placeholder="이메일·내선" onChange={(e) => setModal({ ...modal, contact: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>권력(결정 영향력)</label><div className="seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={modal.power === n ? "on" : ""} onClick={() => setModal({ ...modal, power: n })}>{n}</button>)}</div></div>
            <div className="field"><label>관심도</label><div className="seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={modal.interest === n ? "on" : ""} onClick={() => setModal({ ...modal, interest: n })}>{n}</button>)}</div></div>
          </div>
          <div className="field"><label>태도</label><div className="seg">{STANCES.map((s) => <button key={s.id} className={modal.stance === s.id ? "on" : ""} onClick={() => setModal({ ...modal, stance: s.id })}>{s.label}</button>)}</div></div>
          <div className="field"><label>메모 <span className="tiny muted">(선택)</span></label><textarea className="textarea" value={modal.notes} placeholder="관심사·설득 포인트·주의점" onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></div>
        </Modal>
      )}
    </div>
  );
}
