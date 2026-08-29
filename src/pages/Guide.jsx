import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CAREER_NORTHSTAR,
  GUIDE_SECTIONS,
  CUSTOMER_QUESTIONS,
  KEY_QUESTIONS,
  SIX_ELEMENTS,
  REVIEW_CHECKPOINTS,
  EVAL_AXES,
  DECISION_FRAMES,
  ONE_ON_ONE,
  LEADER_RHYTHM,
  LEADER_DO,
  LEADER_DELEGATE,
} from "../lib/guidance.js";
import { DELEGATION_LEVELS } from "../lib/store.js";

// 각 원칙 섹션이 앱 어느 기능과 연결되는지
const LINKS = {
  career: [
    { to: "/growth", label: "성장" },
    { to: "/weekly", label: "주간리뷰" },
  ],
  money: [{ to: "/money-test", label: "머니테스트" }],
  customer: [{ to: "/deals", label: "딜" }],
  delegate: [
    { to: "/team", label: "팀" },
    { to: "/handoffs", label: "위임과제" },
  ],
  oneonone: [{ to: "/one-on-ones", label: "1:1" }],
  goals: [
    { to: "/growth", label: "성장" },
    { to: "/team", label: "팀" },
  ],
  weekly: [{ to: "/weekly", label: "주간리뷰" }],
};

// 섹션별로 아래에 붙여 보여줄 구조화 참고블록
function SectionExtra({ id }) {
  if (id === "money") {
    return (
      <ExtraGrid title="판단 프레임">
        {Object.entries(DECISION_FRAMES).map(([k, v]) => (
          <div key={k} className="kv"><div className="v" style={{ fontSize: 13.5, fontWeight: 650, lineHeight: 1.5 }}>{v}</div></div>
        ))}
      </ExtraGrid>
    );
  }
  if (id === "customer") {
    return (
      <>
        <div className="tiny muted" style={{ margin: "14px 0 6px", fontWeight: 700 }}>고객 질문 흐름 10단계</div>
        <div className="gap-wrap">
          {CUSTOMER_QUESTIONS.map((q) => (
            <span key={q.key} className="chip" title={q.q}>{q.step}</span>
          ))}
        </div>
        <div className="notice info" style={{ marginTop: 12 }}>
          <b>핵심 2질문</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {KEY_QUESTIONS.map((q, i) => <li key={i} style={{ marginTop: 2 }}>{q}</li>)}
          </ul>
        </div>
      </>
    );
  }
  if (id === "delegate") {
    return (
      <>
        <div className="tiny muted" style={{ margin: "14px 0 6px", fontWeight: 700 }}>위임수준 L1~L5</div>
        <div className="stack">
          {DELEGATION_LEVELS.map((l) => (
            <div key={l.level} className="li" style={{ padding: "7px 0" }}>
              <span className="chip" style={{ flex: "0 0 auto" }}>L{l.level}</span>
              <div className="li-main"><div className="li-title" style={{ fontSize: 13.5 }}>{l.name.replace(/^L\d+\s*/, "")}</div><div className="li-sub">{l.desc}</div></div>
            </div>
          ))}
        </div>
        <div className="tiny muted" style={{ margin: "16px 0 6px", fontWeight: 700 }}>6요소 지시</div>
        <div className="gap-wrap">
          {SIX_ELEMENTS.map((e) => (
            <span key={e.key} className="chip" title={e.desc}>{e.label} · {e.desc}</span>
          ))}
        </div>
        <div className="tiny muted" style={{ margin: "16px 0 6px", fontWeight: 700 }}>20 / 50 / 80 리뷰</div>
        <div className="row3">
          {REVIEW_CHECKPOINTS.map((c) => (
            <div key={c.pct} className="panel panel-pad" style={{ padding: 12 }}>
              <div className="between"><b style={{ fontSize: 15 }}>{c.pct}%</b><span className="badge gray">{c.label}</span></div>
              <div className="tiny muted" style={{ marginTop: 6 }}>{c.tip}</div>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (id === "oneonone") {
    return (
      <>
        <div className="tiny muted" style={{ margin: "14px 0 6px", fontWeight: 700 }}>1:1 구조 (약 40분)</div>
        <div className="gap-wrap">
          {ONE_ON_ONE.structure.map((s, i) => <span key={i} className="chip">{s}</span>)}
        </div>
        <div className="tiny muted" style={{ margin: "16px 0 6px", fontWeight: 700 }}>리더 질문뱅크</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
          {ONE_ON_ONE.leaderQuestions.map((q, i) => <li key={i} style={{ marginTop: 3 }}>{q}</li>)}
        </ul>
        <div className="tiny muted" style={{ margin: "16px 0 6px", fontWeight: 700 }}>생각시키는 질문</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
          {ONE_ON_ONE.thinkingQuestions.map((q, i) => <li key={i} style={{ marginTop: 3 }}>{q}</li>)}
        </ul>
        <div className="notice warn" style={{ marginTop: 12 }}>{ONE_ON_ONE.note}</div>
      </>
    );
  }
  if (id === "goals") {
    return (
      <>
        <div className="tiny muted" style={{ margin: "14px 0 6px", fontWeight: 700 }}>성과 평가 축</div>
        <div className="stack">
          {EVAL_AXES.map((a) => (
            <div key={a.key} className="li" style={{ padding: "7px 0" }}>
              <span className="chip" style={{ flex: "0 0 auto" }}>{a.label}</span>
              <div className="li-main"><div className="li-title" style={{ fontSize: 13.5 }}>{a.desc}</div></div>
            </div>
          ))}
        </div>
        <div className="row2" style={{ marginTop: 14 }}>
          <div className="notice ok"><b>직접 할 것</b><div style={{ marginTop: 4 }}>{LEADER_DO}</div></div>
          <div className="notice info"><b>넘길 것</b><div style={{ marginTop: 4 }}>{LEADER_DELEGATE}</div></div>
        </div>
      </>
    );
  }
  if (id === "weekly") {
    return (
      <>
        <div className="tiny muted" style={{ margin: "14px 0 6px", fontWeight: 700 }}>리더 운영 리듬</div>
        <div className="gap-wrap">
          {LEADER_RHYTHM.map((r, i) => <span key={i} className="chip">{r}</span>)}
        </div>
      </>
    );
  }
  return null;
}

function ExtraGrid({ title, children }) {
  return (
    <>
      <div className="tiny muted" style={{ margin: "14px 0 6px", fontWeight: 700 }}>{title}</div>
      <div className="kv-grid" style={{ borderRadius: 10, overflow: "hidden" }}>{children}</div>
    </>
  );
}

export default function Guide() {
  // details 열림 상태 추적 — 첫 섹션만 기본 열림
  const [openMap, setOpenMap] = useState(() => (GUIDE_SECTIONS[0] ? { [GUIDE_SECTIONS[0].id]: true } : {}));
  return (
    <div>
      <div className="page-head">
        <h1>코칭 가이드</h1>
        <p className="sub">사업을 이해하는 Product/Business Leader로 가는 원칙 모음. 읽고, 각 원칙을 이 앱의 기능으로 실천합니다.</p>
      </div>

      {/* 섹션 앵커 목차 */}
      <div className="section">
        <div className="gap-wrap">
          <span className="tiny muted" style={{ fontWeight: 700, alignSelf: "center" }}>목차 →</span>
          {GUIDE_SECTIONS.map((sec) => (
            <a key={sec.id} href={"#guide-" + sec.id} className="chip" style={{ textDecoration: "none" }}>{sec.title}</a>
          ))}
        </div>
      </div>

      {/* 커리어 북극성 */}
      <div className="section">
        <div className="panel panel-pad">
          <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: "0.04em" }}>북극성</div>
          <h2 style={{ fontSize: 18, marginTop: 6 }}>{CAREER_NORTHSTAR.title}</h2>
          <p style={{ marginTop: 8, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>{CAREER_NORTHSTAR.line}</p>

          <div className="tiny muted" style={{ margin: "18px 0 8px", fontWeight: 700 }}>성장 사다리</div>
          <div className="steps" style={{ marginBottom: 8 }}>
            {CAREER_NORTHSTAR.ladder.map((_, i) => <div key={i} className="st on" />)}
          </div>
          <div className="gap-wrap">
            {CAREER_NORTHSTAR.ladder.map((s, i) => (
              <span key={i} className="chip">{i + 1}. {s}</span>
            ))}
          </div>

          <div className="tiny muted" style={{ margin: "18px 0 8px", fontWeight: 700 }}>평가 기준 3문장</div>
          <div className="stack">
            {CAREER_NORTHSTAR.evalSentences.map((s, i) => {
              const [head, tail] = s.split(":");
              return (
                <div key={i} className="li" style={{ padding: "8px 0" }}>
                  <span className="badge gray" style={{ flex: "0 0 auto" }}>{i + 1}</span>
                  <div className="li-main">
                    <div className="li-title" style={{ fontSize: 14 }}>{tail ? head + " :" : head}</div>
                    {tail ? <div className="li-sub">{tail.trim()}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="notice info section">
        두 기둥으로 실천합니다. <b>① 판단</b> — 사업 판단을 기록하고 맞는 도구로 검증(<Link to="/decisions" style={{ color: "var(--accent)", fontWeight: 700 }}>판단</Link>·<Link to="/money-test" style={{ color: "var(--accent)", fontWeight: 700 }}>머니테스트</Link>·<Link to="/deals" style={{ color: "var(--accent)", fontWeight: 700 }}>딜</Link>). <b>② 사람</b> — 팀을 키우고 일을 굴린다(<Link to="/team" style={{ color: "var(--accent)", fontWeight: 700 }}>팀</Link>·<Link to="/one-on-ones" style={{ color: "var(--accent)", fontWeight: 700 }}>1:1</Link>·<Link to="/handoffs" style={{ color: "var(--accent)", fontWeight: 700 }}>위임과제</Link>·<Link to="/growth" style={{ color: "var(--accent)", fontWeight: 700 }}>성장</Link>). 아래 원칙을 펼쳐 읽으세요.
      </div>

      {/* 원칙 섹션 — 접기/펼치기 */}
      <div className="section">
        <div className="section-title">원칙 열람</div>
        <div className="stack" style={{ gap: 12 }}>
          {GUIDE_SECTIONS.map((sec, idx) => {
            const links = LINKS[sec.id] || [];
            return (
              <details key={sec.id} id={"guide-" + sec.id} className="panel" open={idx === 0} onToggle={(e) => setOpenMap((m) => ({ ...m, [sec.id]: e.target.open }))} style={{ overflow: "hidden" }}>
                <summary style={{ listStyle: "none", cursor: "pointer", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontWeight: 700 }}>
                  <span style={{ fontSize: 15 }}>{sec.title}</span>
                  <span className="tiny muted" aria-hidden="true">{openMap[sec.id] ? "접기 ▴" : "펼치기 ▾"}</span>
                </summary>
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--line)" }}>
                  <div className="stack" style={{ gap: 10, marginTop: 14 }}>
                    {sec.body.map((p, i) => (
                      <p key={i} style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7 }}>{p}</p>
                    ))}
                  </div>

                  <SectionExtra id={sec.id} />

                  {links.length > 0 ? (
                    <div className="gap-wrap" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
                      <span className="tiny muted" style={{ fontWeight: 700 }}>이 앱에서 실천 →</span>
                      {links.map((l) => (
                        <Link key={l.to} to={l.to} className="btn btn-sm">{l.label}</Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="footer" style={{ padding: "8px 0 0" }}>읽기 전용 · 코칭 원칙을 실천 기능으로 연결합니다.</div>
    </div>
  );
}
