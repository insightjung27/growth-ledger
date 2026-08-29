import { useStore, setCapability, CAPABILITIES } from "../lib/store.js";

const LEVELS = [1, 2, 3, 4, 5];

export default function Growth() {
  const caps = useStore((s) => s.capabilities);
  const scoreOf = (id) => caps.find((c) => c.id === id)?.score ?? 3;

  return (
    <div>
      <div className="page-head">
        <h1>성장 · 역량 자가진단</h1>
        <p className="sub">5개 역량 중 J님의 갭은 사업·영업과 위임·조직. 이 앱의 딜·머니테스트·주간리뷰가 바로 이 두 갭을 겨냥합니다.</p>
      </div>

      <div className="notice info section">
        커리어 확장 경로: 좋은 기획 → 좋은 제품(현재) → 좋은 사업(머니테스트·딜) → 좋은 조직(주간리뷰·위임). 평가 기준도 "내가 만든 결과물"에서 "내가 없어도 팀이 만드는 결과", 나아가 "그 결과가 만든 실제 가치"로 옮겨갑니다.
      </div>

      <div className="section stack">
        {CAPABILITIES.map((c) => {
          const gap = c.id === "business" || c.id === "people";
          const sc = scoreOf(c.id);
          return (
            <div key={c.id} className="panel panel-pad">
              <div className="between" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name} <span className="muted small">· {c.ko}</span> {gap && <span className="badge amber" style={{ marginLeft: 4 }}>보완 갭</span>}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{c.note}</div>
                </div>
                <div className="mono" style={{ fontWeight: 800, fontSize: 18 }}>{sc}<span className="muted small">/5</span></div>
              </div>
              <div className="seg" style={{ width: "100%" }}>
                {LEVELS.map((l) => (
                  <button key={l} className={sc === l ? "on" : ""} style={{ flex: 1 }} onClick={() => setCapability(c.id, l)}>{l}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="notice warn section">
        지금 이번 주 시작할 3가지: (1) 머니테스트로 실제 후보 1건을 종이로라도 계산 → 회의에서 말할 숫자로. (2) 딜 하나를 표에 올려 다음행동을 반드시 확정. (3) 이번 금요일 첫 주간 자기리뷰로 북극성 비율 한 값을 남기기.
      </div>
    </div>
  );
}
