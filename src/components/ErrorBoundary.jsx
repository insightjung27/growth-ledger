import React from "react";
import { exportJSON, resetAll } from "../lib/store.js";
import { isoDate } from "../lib/format.js";

// 렌더 크래시(예: 손상된 데이터)를 잡아 화이트스크린 대신 복구 탈출구를 제공.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  backup() {
    try {
      const blob = new Blob([exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `성장원장-복구백업-${isoDate()}.json`;
      a.click();
    } catch (e) {}
  }
  reset() {
    if (confirm("모든 데이터를 초기화합니다. 먼저 '백업 내보내기'를 했는지 확인하세요. 진행할까요?")) {
      resetAll();
      this.setState({ error: null });
      location.reload();
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <div className="main">
            <div className="panel empty" style={{ marginTop: 40 }}>
              <div className="em-ic">🛟</div>
              <h3>문제가 발생했습니다</h3>
              <p>저장된 데이터가 손상되었을 수 있습니다. 아래에서 먼저 백업을 받은 뒤 초기화하면 앱이 복구됩니다.</p>
              <div className="gap-wrap" style={{ justifyContent: "center" }}>
                <button className="btn" onClick={() => this.backup()}>백업 내보내기</button>
                <button className="btn btn-danger" onClick={() => this.reset()}>데이터 초기화</button>
                <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>다시 시도</button>
              </div>
              <p className="tiny muted" style={{ marginTop: 14 }}>{String(this.state.error?.message || this.state.error).slice(0, 160)}</p>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
