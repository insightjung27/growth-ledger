// 대조 예정일을 OS 캘린더로 오프로드 — 로컬앱은 푸시가 없으므로 리마인드를 캘린더에 옵트인 등록.
// 알림 '시스템'을 만들지 않는다(스케줄러·상태저장 0). 순수 옵트인 링크/파일만.
import { uid } from "./store.js";

// "YYYY-MM-DD" → "YYYYMMDD"
function ymd(iso) { return String(iso).slice(0, 10).replace(/-/g, ""); }
// 하루 뒤(종일 이벤트의 DTEND는 배타적) "YYYY-MM-DD" → 다음날 "YYYYMMDD"
function nextYmd(iso) {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
function stampUTC() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

// 종일 .ics 파일 다운로드
export function downloadReviewIcs({ title, date }) {
  const summary = "판단 대조: " + (title || "(제목 없음)");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//growth-ledger//review//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + uid() + "@growth-ledger",
    "DTSTAMP:" + stampUTC(),
    "DTSTART;VALUE=DATE:" + ymd(date),
    "DTEND;VALUE=DATE:" + nextYmd(date),
    "SUMMARY:" + summary,
    "DESCRIPTION:예측 vs 실제를 대조하세요. (성장원장 판단 원장)",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "판단대조-" + ymd(date) + ".ics";
  a.click();
  URL.revokeObjectURL(a.href);
}

// 구글 캘린더 새 일정 템플릿 링크
export function gcalUrl({ title, date }) {
  const text = encodeURIComponent("판단 대조: " + (title || "(제목 없음)"));
  const dates = ymd(date) + "/" + nextYmd(date);
  const details = encodeURIComponent("예측 vs 실제를 대조하세요. (성장원장 판단 원장)");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}
