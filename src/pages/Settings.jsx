import { useRef, useState } from "react";
import { useSync, signIn, signOut } from "../lib/cloud.js";
import { exportJSON, importJSON, markBackup, counts } from "../lib/store.js";
import { isoDate, relDate } from "../lib/format.js";

const STATUS = {
  local: { label: "로컬 전용", color: "gray", desc: "이 브라우저에만 저장됩니다. 로그인하면 클라우드 동기화가 켜집니다." },
  syncing: { label: "동기화 중…", color: "amber", desc: "클라우드와 맞추는 중입니다." },
  synced: { label: "동기화됨", color: "green", desc: "실시간으로 PC·폰 간 자동 반영됩니다." },
  error: { label: "동기화 오류", color: "red", desc: "네트워크·로그인을 확인하세요. 로컬 데이터는 안전합니다." },
};

function download(text, name) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

export default function Settings() {
  const sync = useSync();
  const [email, setEmail] = useState("insight.jung27@gmail.com");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const st = STATUS[sync.status] || STATUS.local;

  async function login() {
    if (!email.trim()) return;
    setBusy(true); setErr("");
    const e = await signIn(email);
    setBusy(false);
    if (e) setErr(e); else setSent(true);
  }
  function doExport() { download(exportJSON(), `역량플러스업-백업-${isoDate()}.json`); markBackup(); }
  function onPickFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const c = counts();
    if ((c.deals || c.moneyTests || c.decisions) && !confirm("현재 데이터를 불러온 파일로 덮어씁니다. 먼저 현재 데이터를 백업합니다. 계속할까요?")) { e.target.value = ""; return; }
    if (c.deals || c.moneyTests || c.decisions) download(exportJSON(), `역량플러스업-교체전백업-${isoDate()}.json`);
    const reader = new FileReader();
    reader.onload = () => { try { importJSON(String(reader.result)); alert("불러왔습니다."); } catch (err2) { alert("불러오기 실패: " + err2.message); } };
    reader.readAsText(f); e.target.value = "";
  }

  return (
    <div>
      <div className="page-head">
        <h1>설정 · 동기화</h1>
        <p className="sub">클라우드 동기화로 PC와 폰에서 같은 데이터를 씁니다. 정비서가 분석 결과를 여기에 기록합니다.</p>
      </div>

      <div className="section">
        <div className="section-title">클라우드 동기화</div>
        <div className="panel panel-pad">
          <div className="between" style={{ alignItems: "center", marginBottom: 12 }}>
            <span className="gap-wrap"><span className={"dot " + st.color} /> <b>{st.label}</b></span>
            {sync.email ? <span className="tiny muted">{sync.email}</span> : null}
          </div>
          <div className="tiny muted" style={{ marginBottom: 14 }}>{st.desc}{sync.status === "synced" && sync.lastSyncedAt ? ` · 최근 동기화 ${relDate(sync.lastSyncedAt)}` : ""}{sync.status === "error" && sync.error ? ` (${sync.error})` : ""}</div>

          {sync.owner ? (
            <button className="btn" onClick={signOut}>로그아웃</button>
          ) : sent ? (
            <div className="notice ok">📧 <b>{email}</b> 으로 로그인 링크를 보냈습니다. 메일의 링크를 이 기기에서 열면 동기화가 켜집니다.
              <div style={{ marginTop: 8 }}><button className="btn btn-sm" onClick={() => setSent(false)}>다시 보내기</button></div>
            </div>
          ) : (
            <div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>로그인 이메일 (매직링크)</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              {err ? <div className="notice warn" style={{ marginBottom: 10 }}>{err}</div> : null}
              <button className="btn btn-primary" onClick={login} disabled={busy || !email.trim()}>{busy ? "전송 중…" : "로그인 링크 받기"}</button>
              <div className="hint" style={{ marginTop: 8 }}>비밀번호 없이 메일 링크로 로그인합니다. 로그인 전에도 앱은 로컬로 정상 동작합니다.</div>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">파일 백업 (오프라인)</div>
        <div className="panel panel-pad gap-wrap">
          <button className="btn" onClick={doExport}>JSON 내보내기</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>JSON 가져오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
          <div className="hint" style={{ flexBasis: "100%" }}>클라우드 동기화와 별개로, 언제든 파일로 내려받아 보관할 수 있습니다.</div>
        </div>
      </div>
    </div>
  );
}
