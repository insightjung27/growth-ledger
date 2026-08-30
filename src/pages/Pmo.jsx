import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store.js";
import { won, isoDate } from "../lib/format.js";
import { computePmo, buildPmoReportMarkdown, DEC_STATUS } from "../lib/pmo.js";
import Modal from "../components/Modal.jsx";
import HowTo from "../components/HowTo.jsx";

function statusClass(s) {
  return s === "달성" ? "green" : s === "미달" ? "red" : s === "보류" ? "amber" : "gray";
}
const SEV_CLS = { high: "red", med: "amber" };

function RiskRow({ r }) {
  return (
    <Link to={r.to} className="li" style={{ textDecoration: "none" }}>
      <span className={"dot " + (SEV_CLS[r.sev] || "gray")} style={{ marginTop: 7, flex: "0 0 auto" }} />
      <div className="li-main"><div className="li-title">{r.kind} — "{r.title}"</div>{r.sub ? <div className="li-sub">{r.sub}</div> : null}</div>
      <span className="btn btn-sm" style={{ flex: "0 0 auto" }}>열기</span>
    </Link>
  );
}

function ReportModal({ text, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    try {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    } catch (e) {
      const ta = document.getElementById("pmo-report-text"); if (ta) { ta.select(); document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    }
  }
  function download() {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `PMO상태보고서-${isoDate(new Date())}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <Modal
      title="PMO 상태 보고서"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>닫기</button><button className="btn" onClick={download}>다운로드(.md)</button><button className="btn btn-primary" onClick={copy}>{copied ? "복사됨 ✓" : "복사"}</button></>}
    >
      <div className="tiny muted" style={{ marginBottom: 8 }}>현재 시점 데이터를 자동 조립했습니다. 복사해 메일·문서에 붙이거나 파일로 내려받으세요.</div>
      <textarea id="pmo-report-text" className="textarea" readOnly value={text} style={{ minHeight: 340, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.6 }} onFocus={(e) => e.target.select()} />
    </Modal>
  );
}

export default function Pmo() {
  const state = useStore();
  const [report, setReport] = useState(null);
  const now = new Date();
  const p = computePmo(state, now);

  function genReport() { setReport(buildPmoReportMarkdown(state, now)); }

  return (
    <div>
      <div className="page-head">
        <div className="between" style={{ alignItems: "flex-end" }}>
          <div style={{ minWidth: 0 }}>
            <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: "0.04em" }}>PMO 현황</div>
            <h1>과제·목표·판단 한눈에</h1>
            <p className="sub">여러 과제·목표·판단·딜을 프로젝트 관리 관점에서 자동 집계합니다. 입력 화면이 아니라 기존 데이터의 <b>렌즈</b>입니다 — 여기서는 기록하지 않고, 각 항목은 원래 화면으로 연결됩니다.</p>
          </div>
          <button className="btn btn-primary" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }} onClick={genReport}>보고서 생성</button>
        </div>
      </div>

      <HowTo screen="pmo" />

      {/* 요약 스탯 */}
      <div className="stat-row section">
        <div className="stat"><div className="k">리스크</div><div className="v" style={{ color: p.riskHigh > 0 ? "var(--red)" : p.risks.length > 0 ? "var(--amber)" : "var(--green)" }}>{p.risks.length}<small>건</small></div><div className="d">긴급(빨강) {p.riskHigh} · 막힘·기한초과·미대조 등</div></div>
        <div className="stat"><div className="k">진행 중 과제</div><div className="v">{p.portfolio.hoOpen}<small>건</small></div><div className="d">완결 {p.portfolio.hoDone} · 막힘 {p.portfolio.hoBlocked}</div></div>
        <div className="stat"><div className="k">대조 적중률</div><div className="v">{p.decisions.hitText}</div><div className="d">{p.decisions.hitReady ? `대조 ${p.decisions.reviewedN}건 중 적중 ${p.decisions.hits}` : `표본 ${p.decisions.reviewedN}/${p.decisions.REVIEW_SAMPLE}`}</div></div>
      </div>

      {/* 리스크 레지스터 */}
      <div className="section">
        <div className="section-title">리스크 · 지금 봐야 할 것</div>
        <div className="panel panel-pad">
          {p.risks.length === 0 ? (
            <div className="muted small">지금 리스크 신호가 없습니다. 막힘·기한초과·미대조·방치가 생기면 여기 최상단에 뜹니다.</div>
          ) : (
            <div className="stack">
              {p.risks.slice(0, 12).map((r, i) => <RiskRow key={i} r={r} />)}
              {p.risks.length > 12 ? <div className="tiny muted">외 {p.risks.length - 12}건 — 각 화면에서 이어서 처리하세요.</div> : null}
            </div>
          )}
        </div>
      </div>

      {/* 포트폴리오 + 분기목표 */}
      <div className="section row2">
        <div>
          <div className="section-title">위임과제 포트폴리오</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              <div className="kv"><div className="k">진행 중</div><div className="v">{p.portfolio.hoOpen}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">막힘</div><div className="v" style={{ color: p.portfolio.hoBlocked > 0 ? "var(--red)" : "var(--ink)" }}>{p.portfolio.hoBlocked}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">완결(북극성)</div><div className="v" style={{ color: p.portfolio.hoDone > 0 ? "var(--green)" : "var(--ink)" }}>{p.portfolio.hoDone}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">전체</div><div className="v">{p.portfolio.hoTotal}<small className="muted"> 건</small></div></div>
            </div>
            <div style={{ marginTop: 12 }}><Link to="/handoffs" className="btn btn-sm btn-block">위임과제 열기</Link></div>
          </div>
        </div>
        <div>
          <div className="section-title">분기목표 진척</div>
          <div className="panel panel-pad">
            {p.goals.length === 0 ? (
              <div className="muted small">등록된 분기목표가 없습니다. <Link to="/team" style={{ color: "var(--accent)", fontWeight: 700 }}>팀</Link>에서 이번 분기 결과 3개를 정하세요.</div>
            ) : (
              <div className="stack">
                {p.goals.map(({ g, p: pr }) => (
                  <div key={g.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <div className="between"><div className="li-title" style={{ minWidth: 0 }}>{g.title || "(무제)"}</div><span className={"badge " + statusClass(g.status)}>{g.status}</span></div>
                    <div className="gap-wrap" style={{ marginTop: 4 }}>
                      <span className="tiny muted mono">{g.currentValue || "-"} / {g.targetValue || "-"}</span>
                      {pr != null ? <span className="badge gray mono">{Math.round(pr * 100)}%</span> : null}
                    </div>
                    {pr != null && (
                      <div style={{ marginTop: 5, height: 5, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden" }}>
                        <div style={{ width: `${pr * 100}%`, height: "100%", background: "var(--accent)" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 의사결정 + 딜 */}
      <div className="section row2">
        <div>
          <div className="section-title">의사결정 파이프라인</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              {DEC_STATUS.map(([k, lab]) => (
                <div className="kv" key={k}><div className="k">{lab}</div><div className="v">{p.decisions.dc[k]}<small className="muted"> 건</small></div></div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}><Link to="/decisions" className="btn btn-sm btn-block">판단 원장 열기</Link></div>
          </div>
        </div>
        <div>
          <div className="section-title">딜 파이프라인</div>
          <div className="panel panel-pad">
            <div className="between" style={{ alignItems: "flex-end" }}>
              <div><div className="k tiny muted">가중 파이프라인</div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{won(p.dealsAgg.weighted)}</div></div>
              <div className="tiny muted">열린 딜 {p.dealsAgg.openDeals}건</div>
            </div>
            <div style={{ marginTop: 12 }}><Link to="/deals" className="btn btn-sm btn-block">딜 열기</Link></div>
          </div>
        </div>
      </div>

      {/* 리소스 */}
      <div className="section">
        <div className="section-title">리소스 · 팀원별 부하</div>
        <div className="panel panel-pad">
          {p.activeMembers.length === 0 ? (
            <div className="muted small">1인 단계 — 팀원을 추가하면 팀원별 과제 부하·위임수준·1:1 경과가 여기 집계됩니다.</div>
          ) : (
            <div className="stack">
              {p.resources.map(({ m, active, since }) => (
                <Link key={m.id} to={"/team/" + m.id} className="li" style={{ textDecoration: "none" }}>
                  <div className="li-main">
                    <div className="li-title">{m.name || "이름없음"} <span className="muted small">· {m.area || "영역 미지정"}</span></div>
                    <div className="li-sub">활성 과제 {active}건 · 위임수준 L{m.levelCurrent || "-"}→L{m.levelTarget || "-"} · 최근 1:1 {since == null ? "기록 없음" : since + "일 전"}</div>
                  </div>
                  <span className={"badge " + (active >= 4 ? "amber" : "gray")} style={{ flex: "0 0 auto" }}>{active}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="footer" style={{ padding: "8px 0 0" }}>읽기 전용 · 기록은 각 화면에서. 이 화면은 PMO 관점의 자동 집계 렌즈입니다.</div>

      {report != null && <ReportModal text={report} onClose={() => setReport(null)} />}
    </div>
  );
}
