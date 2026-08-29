import { useState, useRef, useEffect } from "react";

// 소프트 PIN 게이트 — 공개 URL에 우연히 들어온 사람을 막는 용도(강한 보안 아님).
// 클라이언트 전용이라 코드상 우회 가능. 진짜 보호가 필요하면 서버 인증 필요.
const PIN = "6441";
const KEY = "growth-ledger:unlocked";

export default function PinGate({ children }) {
  const [ok, setOk] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  });
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (!ok) inputRef.current?.focus(); }, [ok]);

  if (ok) return children;

  function submit(e) {
    if (e) e.preventDefault();
    if (val === PIN) {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      setOk(true);
    } else {
      setErr(true);
      setVal("");
      inputRef.current?.focus();
    }
  }
  function onChange(e) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setVal(v);
    setErr(false);
    if (v.length === 4) setTimeout(() => { if (v === PIN) { try { localStorage.setItem(KEY, "1"); } catch (er) {} setOk(true); } else { setErr(true); setVal(""); inputRef.current?.focus(); } }, 120);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--paper-2)" }}>
      <form onSubmit={submit} className="panel panel-pad" style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 6 }}>
          <span className="brand-mark">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M14 44 L28 30 L36 36 L50 20" fill="none" stroke="#6ee7b7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="50" cy="20" r="5" fill="#6ee7b7" />
            </svg>
          </span>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>성장원장</span>
        </div>
        <p className="muted small" style={{ marginBottom: 18 }}>4자리 PIN을 입력하세요</p>
        <input
          ref={inputRef}
          className="input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={val}
          onChange={onChange}
          maxLength={4}
          placeholder="••••"
          aria-label="PIN"
          style={{ textAlign: "center", fontSize: 24, letterSpacing: "0.5em", height: 52, borderColor: err ? "var(--red)" : undefined }}
        />
        {err && <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>PIN이 맞지 않습니다</p>}
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>들어가기</button>
        <p className="tiny muted" style={{ marginTop: 14 }}>이 기기에서는 한 번만 입력하면 기억됩니다.</p>
      </form>
    </div>
  );
}
