// 숫자·통화·날짜 포맷 유틸 (전부 순수함수)

export function won(amount) {
  if (amount == null || isNaN(amount)) return "-";
  const neg = amount < 0;
  let a = Math.abs(Math.round(amount));
  if (a === 0) return "0원";
  if (a < 10000) return `${neg ? "-" : ""}${a.toLocaleString("ko-KR")}원`;
  const eok = Math.floor(a / 1e8);
  const man = Math.floor((a % 1e8) / 1e4);
  let s = "";
  if (eok > 0) {
    s += `${eok.toLocaleString("ko-KR")}억`;
    if (man > 0) s += ` ${man.toLocaleString("ko-KR")}만`;
  } else {
    // 만 단위. 소수 만원까지는 반올림해서 만원 단위로.
    const manFull = a / 1e4;
    s = manFull >= 100 ? `${Math.round(manFull).toLocaleString("ko-KR")}만` : `${(Math.round(manFull * 10) / 10).toLocaleString("ko-KR")}만`;
  }
  return `${neg ? "-" : ""}${s}원`;
}

// 입력용: 만원 단위 값을 원으로, 원을 만원으로
export const manToWon = (man) => (Number(man) || 0) * 10000;
export const wonToMan = (w) => (Number(w) || 0) / 10000;

export function num(n, digits = 0) {
  if (n == null || isNaN(n)) return "-";
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

export function pct(n, digits = 0) {
  if (n == null || isNaN(n)) return "-";
  return `${(Number(n) * 100).toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;
}

export function months(m) {
  if (m == null || !isFinite(m)) return "회수 안 됨";
  if (m <= 0) return "즉시";
  if (m >= 120) return "10년 이상";
  return `${Math.round(m * 10) / 10}개월`;
}

export function daysBetween(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.floor((now - d) / 86400000);
}

// 주(월요일 시작)의 월요일 날짜 키 YYYY-MM-DD
export function weekMonday(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=월
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return isoDate(d);
}

export function isoDate(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekLabel(mondayIso) {
  if (!mondayIso) return "";
  const d = new Date(mondayIso);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const f = (x) => `${x.getMonth() + 1}/${x.getDate()}`;
  return `${f(d)} ~ ${f(end)}`;
}

export function relDate(iso) {
  const dd = daysBetween(iso);
  if (dd == null) return "";
  if (dd === 0) return "오늘";
  if (dd === 1) return "어제";
  if (dd < 7) return `${dd}일 전`;
  if (dd < 30) return `${Math.floor(dd / 7)}주 전`;
  return `${Math.floor(dd / 30)}개월 전`;
}
