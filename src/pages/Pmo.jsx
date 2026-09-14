import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store.js";
import { won, pct, isoDate } from "../lib/format.js";
import { computePmo, buildPmoReportMarkdown, DEC_STATUS } from "../lib/pmo.js";
import Modal from "../components/Modal.jsx";
import HowTo from "../components/HowTo.jsx";

const SEV_CLS = { high: "red", med: "amber" };
const HEALTH_CLS = { red: "red", amber: "amber", green: "green", gray: "gray" };

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
    try { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }
    catch (e) { const ta = document.getElementById("pmo-report-text"); if (ta) { ta.select(); document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } }
  }
  function download() {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `경영PMO보고서-${isoDate(new Date())}.md`; a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <Modal title="경영 · PMO 상태 보고서" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>닫기</button><button className="btn" onClick={download}>다운로드(.md)</button><button className="btn btn-primary" onClick={copy}>{copied ? "복사됨 ✓" : "복사"}</button></>}>
      <div className="tiny muted" style={{ marginBottom: 8 }}>현재 시점 데이터를 자동 조립했습니다(재무·전략목표·프로젝트 헬스 포함). 복사해 대표 보고·문서에 붙이세요.</div>
      <textarea id="pmo-report-text" className="textarea" readOnly value={text} style={{ minHeight: 340, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.6 }} onFocus={(e) => e.target.select()} />
    </Modal>
  );
}

export default function Pmo() {
  const state = useStore();
  const [report, setReport] = useState(null);
  const now = new Date();
  const p = computePmo(state, now);

  return (
    <div>
      <div className="page-head">
        <div className="between" style={{ alignItems: "flex-end" }}>
          <div style={{ minWidth: 0 }}>
            <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: "0.04em" }}>경영 · PMO 현황</div>
            <h1>돈 · 방향 · 리스크 한눈에</h1>
            <p className="sub">전략목표·프로젝트·티켓·팀부하·재무를 자동 집계하는 <b>렌즈</b>입니다. 각 항목은 원래 화면으로 연결됩니다.</p>
          </div>
          <button className="btn btn-primary" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }} onClick={() => setReport(buildPmoReportMarkdown(state, now))}>보고서 생성</button>
        </div>
      </div>

      <HowTo screen="pmo" />

      {/* 경영요약 밴드 */}
      <div className="stat-row section">
        <div className="stat"><div className="k">위험 프로젝트</div><div className="v" style={{ color: p.projRed ? "var(--red)" : p.projAmber ? "var(--amber)" : "var(--green)" }}>{p.projRed}<small>건</small></div><div className="d">주의 {p.projAmber} · 활성 {p.activeProjectN}</div></div>
        <div className="stat"><div className="k">포트폴리오 이익</div><div className="v" style={{ color: p.fin.profit < 0 ? "var(--red)" : "var(--green)", fontSize: 19 }}>{won(p.fin.profit)}</div><div className="d">가중 파이프라인 {won(p.dealsAgg.weighted)}</div></div>
        <div className="stat"><div className="k">승인 대기</div><div className="v" style={{ color: p.approvals.length ? "var(--amber)" : "inherit" }}>{p.approvals.length}<small>건</small></div><div className="d">리스크 {p.risks.length}(긴급 {p.riskHigh})</div></div>
      </div>

      {/* 리스크 레지스터 */}
      <div className="section">
        <div className="section-title">리스크 · 지금 봐야 할 것</div>
        <div className="panel panel-pad">
          {p.risks.length === 0 ? (
            <div className="muted small">지금 리스크 신호가 없습니다. 기한초과 티켓·막힘·지연 마일스톤·미대조가 생기면 여기 최상단에 뜹니다.</div>
          ) : (
            <div className="stack">
              {p.risks.slice(0, 12).map((r, i) => <RiskRow key={i} r={r} />)}
              {p.risks.length > 12 ? <div className="tiny muted">외 {p.risks.length - 12}건</div> : null}
            </div>
          )}
        </div>
      </div>

      {/* 재무 + 전략목표 */}
      <div className="section row2">
        <div>
          <div className="section-title">재무 요약</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              <div className="kv"><div className="k">예산 / 소진</div><div className="v" style={{ fontSize: 15 }}>{won(p.fin.spent)}<small className="muted"> / {won(p.fin.budget)}</small></div></div>
              <div className="kv"><div className="k">잔여</div><div className="v" style={{ fontSize: 15 }}>{won(p.fin.remaining)}</div></div>
              <div className="kv"><div className="k">수주 이익(실적)</div><div className="v" style={{ fontSize: 15, color: p.fin.profit < 0 ? "var(--red)" : "var(--green)" }}>{won(p.fin.profit)}</div></div>
              <div className="kv"><div className="k">절감가치(추정)</div><div className="v" style={{ fontSize: 15 }}>{p.fin.valueCreated ? won(p.fin.valueCreated) : "—"}</div></div>
            </div>
            <div className="tiny muted" style={{ marginTop: 8 }}>소진율 {p.fin.burnPct != null ? pct(p.fin.burnPct) : "—"} · 재무위험 {p.fin.atRisk}건 · <Link to="/projects" style={{ color: "var(--accent)" }}>프로젝트</Link></div>
          </div>
        </div>
        <div>
          <div className="section-title">전략목표 진척 {p.goalsNoExec ? <span className="badge red" style={{ marginLeft: 6 }}>미집행 {p.goalsNoExec}</span> : null}</div>
          <div className="panel panel-pad">
            {p.goals.length === 0 ? (
              <div className="muted small">등록된 전략목표가 없습니다. <Link to="/goals" style={{ color: "var(--accent)", fontWeight: 700 }}>목표</Link>에서 기업·고객사 목표를 추가하세요.</div>
            ) : (
              <div className="stack">
                {p.goals.map(({ g, r }) => (
                  <div key={g.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <div className="between"><div className="li-title" style={{ minWidth: 0 }}>{g.title || "(무제)"}</div>{r.hasNoExecution ? <span className="badge red">전략 미집행</span> : <span className="badge gray mono">{r.progress != null ? r.progress + "%" : "—"}</span>}</div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>활성 프로젝트 {r.activeCount} · 예산 {won(r.budget)} · 팀부하 {r.teamLoad}명 · 열린 티켓 {r.openTickets}</div>
                    {r.progress != null && (<div style={{ marginTop: 5, height: 5, borderRadius: 999, background: "var(--paper-3)", overflow: "hidden" }}><div style={{ width: `${r.progress}%`, height: "100%", background: "var(--accent)" }} /></div>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 프로젝트 포트폴리오 헬스 */}
      {p.projHealth.length > 0 && (
        <div className="section">
          <div className="section-title">프로젝트 포트폴리오 (헬스순)</div>
          <div className="panel panel-pad">
            <div className="stack">
              {p.projHealth.map(({ p: pj, h }) => (
                <Link key={pj.id} to={"/projects/" + pj.id} className="li" style={{ textDecoration: "none", alignItems: "center" }}>
                  <span className={"dot " + (HEALTH_CLS[h.light] || "gray")} style={{ flex: "0 0 auto" }} />
                  <div className="li-main"><div className="li-title">{pj.title || "(무제)"}</div>{h.reasons.length ? <div className="li-sub">{h.reasons.join(" · ")}</div> : null}</div>
                  <span className="tiny muted" style={{ flex: "0 0 auto" }}>{pj.status}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 승인 대기 */}
      {p.approvals.length > 0 && (
        <div className="section">
          <div className="section-title">승인 · 결정 대기</div>
          <div className="panel panel-pad"><div className="stack">
            {p.approvals.slice(0, 10).map((a, i) => (
              <Link key={i} to={a.to} className="li" style={{ textDecoration: "none", alignItems: "center" }}>
                <div className="li-main"><div className="li-title">{a.title}</div><div className="li-sub">{a.kind}</div></div>
                <span className="btn btn-sm" style={{ flex: "0 0 auto" }}>열기</span>
              </Link>
            ))}
          </div></div>
        </div>
      )}

      {/* 의사결정 + 딜 */}
      <div className="section row2">
        <div>
          <div className="section-title">의사결정 파이프라인</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              {DEC_STATUS.map(([k, lab]) => (<div className="kv" key={k}><div className="k">{lab}</div><div className="v">{p.decisions.dc[k]}<small className="muted"> 건</small></div></div>))}
            </div>
            <div style={{ marginTop: 12 }}><Link to="/decisions" className="btn btn-sm btn-block">판단 원장 열기</Link></div>
          </div>
        </div>
        <div>
          <div className="section-title">위임과제 포트폴리오</div>
          <div className="panel panel-pad">
            <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>
              <div className="kv"><div className="k">진행 중</div><div className="v">{p.portfolio.hoOpen}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">막힘</div><div className="v" style={{ color: p.portfolio.hoBlocked > 0 ? "var(--red)" : "var(--ink)" }}>{p.portfolio.hoBlocked}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">완결(북극성)</div><div className="v" style={{ color: p.portfolio.hoDone > 0 ? "var(--green)" : "var(--ink)" }}>{p.portfolio.hoDone}<small className="muted"> 건</small></div></div>
              <div className="kv"><div className="k">대조 적중률</div><div className="v" style={{ fontSize: 16 }}>{p.decisions.hitText}</div></div>
            </div>
            <div style={{ marginTop: 12 }}><Link to="/handoffs" className="btn btn-sm btn-block">위임과제 열기</Link></div>
          </div>
        </div>
      </div>

      {/* 리소스 — 부하 합집합 */}
      <div className="section">
        <div className="section-title">리소스 · 팀원별 부하 (티켓 + 위임과제)</div>
        <div className="panel panel-pad">
          {p.activeMembers.length === 0 ? (
            <div className="muted small">1인 단계 — 팀원을 추가하면 팀원별 부하(담당 티켓·위임과제)·위임수준·1:1 경과가 여기 집계됩니다.</div>
          ) : (
            <div className="stack">
              {p.resources.map(({ m, open, overdue, blocked, since }) => (
                <Link key={m.id} to={"/team/" + m.id} className="li" style={{ textDecoration: "none", alignItems: "center" }}>
                  <div className="li-main">
                    <div className="li-title">{m.name || "이름없음"} <span className="muted small">· {m.area || "영역 미지정"}</span></div>
                    <div className="li-sub">열린 {open}{overdue ? ` · 기한초과 ${overdue}` : ""}{blocked ? ` · 막힘 ${blocked}` : ""} · 위임수준 L{m.levelCurrent || "-"}→L{m.levelTarget || "-"} · 최근 1:1 {since == null ? "기록 없음" : since + "일 전"}</div>
                  </div>
                  <span className={"badge " + (overdue || blocked ? "red" : open >= 4 ? "amber" : "gray")} style={{ flex: "0 0 auto" }}>{open}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="footer" style={{ padding: "8px 0 0" }}>읽기 전용 · 기록은 각 화면에서. 경영·PMO 관점 자동 집계 렌즈.</div>
      {report != null && <ReportModal text={report} onClose={() => setReport(null)} />}
    </div>
  );
}
