import { won } from "../lib/format.js";

// 월별 누적현금흐름 — 0선 교차(회수 시점) 시각화
export function CashflowChart({ points }) {
  if (!points || points.length < 2) return null;
  const W = 320, H = 150, padL = 8, padR = 8, padT = 12, padB = 18;
  const xs = points.map((p) => p.month);
  const ys = points.map((p) => p.cum);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const spanY = maxY - minY || 1;
  const maxX = Math.max(...xs) || 1;
  const px = (m) => padL + (m / maxX) * (W - padL - padR);
  const py = (v) => padT + (1 - (v - minY) / spanY) * (H - padT - padB);
  const zeroY = py(0);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.month).toFixed(1)},${py(p.cum).toFixed(1)}`).join(" ");
  const area = `${line} L${px(maxX).toFixed(1)},${zeroY.toFixed(1)} L${px(0).toFixed(1)},${zeroY.toFixed(1)} Z`;

  // 0선 교차 지점(회수)
  let cross = null;
  for (let i = 1; i < points.length; i++) {
    if (points[i - 1].cum < 0 && points[i].cum >= 0) {
      const t = (0 - points[i - 1].cum) / (points[i].cum - points[i - 1].cum);
      cross = points[i - 1].month + t;
      break;
    }
  }

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="월별 누적현금흐름">
      <path className="area" d={area} />
      <line className="zero" x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} />
      <path className="linepath" d={line} />
      {cross != null && (
        <>
          <line x1={px(cross)} y1={padT} x2={px(cross)} y2={H - padB} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={px(cross)} cy={zeroY} r="3.5" fill="var(--green)" />
        </>
      )}
      <text className="lbl" x={padL} y={H - 5}>0개월</text>
      <text className="lbl" x={W - padR} y={H - 5} textAnchor="end">{maxX}개월</text>
    </svg>
  );
}

// 북극성 추세(0~비율) 라인
export function TrendChart({ series }) {
  if (!series || series.length === 0) return <div className="muted small">데이터가 쌓이면 추세가 표시됩니다.</div>;
  const W = 320, H = 120, padL = 8, padR = 8, padT = 12, padB = 18;
  const vals = series.map((s) => s.value);
  const maxV = Math.max(...vals, 1);
  const px = (i) => padL + (series.length === 1 ? 0.5 : i / (series.length - 1)) * (W - padL - padR);
  const py = (v) => padT + (1 - v / maxV) * (H - padT - padB);
  const line = series.map((s, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(s.value).toFixed(1)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="북극성 비율 추세">
      <line className="axis" x1={padL} y1={py(0)} x2={W - padR} y2={py(0)} />
      <path className="linepath" d={line} />
      {series.map((s, i) => (
        <circle key={i} className="pt" cx={px(i)} cy={py(s.value)} r="3" />
      ))}
      {series.length > 0 && <text className="lbl" x={padL} y={H - 5}>{series[0].label}</text>}
      {series.length > 1 && <text className="lbl" x={W - padR} y={H - 5} textAnchor="end">{series[series.length - 1].label}</text>}
    </svg>
  );
}
