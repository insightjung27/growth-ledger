import { relDate } from "../lib/format.js";

// 자동저장 피드백 — 즉시저장 화면에서 '저장됐나' 불안을 없앤다.
export default function AutoSaved({ at }) {
  return (
    <span className="tiny muted" style={{ display: "inline-flex", alignItems: "center", gap: 5 }} title="변경사항은 자동으로 저장됩니다">
      <span style={{ color: "var(--green)" }}>✓</span> 자동 저장됨{at ? " · " + relDate(at) : ""}
    </span>
  );
}
