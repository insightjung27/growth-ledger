// 클라우드 동기화(선택적·additive) — 로그아웃이면 localStorage만으로 정상 동작,
// 로그인하면 growth.app_state(owner 단일문서) 양방향 동기화 + 실시간 PC↔폰 반영.
import { createClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { SUPABASE_URL, SUPABASE_ANON } from "./supabaseConfig.js";
import { getState, applyCloudState, registerSync, recordCount } from "./store.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  db: { schema: "growth" },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});

const TABLE = "app_state";

// ===== 동기화 상태(외부 스토어) =====
let sync = { status: "local", email: null, owner: null, lastSyncedAt: null, error: null };
const subs = new Set();
function emitSync(patch) { sync = { ...sync, ...patch }; subs.forEach((f) => f()); }
export function useSync() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => sync, () => sync);
}

let owner = null;
let serverVersion = 0;
let channel = null;
let timer = null;
let pushing = false;
let pendingWhilePush = false;

async function fetchRow() {
  const { data, error } = await supabase.from(TABLE).select("state,version").eq("owner_id", owner).maybeSingle();
  if (error) throw error;
  return data;
}

async function upload(state, version) {
  const { error } = await supabase.from(TABLE).upsert({ owner_id: owner, state, version, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function hydrate() {
  emitSync({ status: "syncing", error: null });
  try {
    const row = await fetchRow();
    const local = getState();
    if (!row) {
      // 클라우드 최초: 현재 로컬(기존 v3 데이터) 업로드
      serverVersion = 1;
      await upload(local, 1);
    } else if (recordCount(row.state) === 0 && recordCount(local) > 0) {
      // 클라우드는 비었는데 로컬에 데이터 있음(새 기기 먼저 로그인 케이스) → 로컬 보존·업로드
      serverVersion = (row.version || 1) + 1;
      await upload(local, serverVersion);
    } else {
      serverVersion = row.version || 1;
      applyCloudState(row.state || {}); // 클라우드 → 로컬(에코 없음)
    }
    subscribeRealtime();
    emitSync({ status: "synced", lastSyncedAt: new Date().toISOString(), error: null });
  } catch (e) { emitSync({ status: "error", error: e.message || String(e) }); }
}

function subscribeRealtime() {
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel("app_state_" + owner)
    .on("postgres_changes", { event: "UPDATE", schema: "growth", table: TABLE, filter: `owner_id=eq.${owner}` }, (payload) => {
      const v = payload.new?.version || 0;
      if (v > serverVersion) { serverVersion = v; applyCloudState(payload.new.state || {}); emitSync({ lastSyncedAt: new Date().toISOString() }); }
    })
    .subscribe();
}

// 로컬 변경 → 디바운스 업로드
function scheduleSync() {
  if (!owner) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(pushCloud, 900);
}
async function pushCloud() {
  if (!owner) return;
  if (pushing) { pendingWhilePush = true; return; }
  pushing = true;
  const nextV = serverVersion + 1;
  emitSync({ status: "syncing" });
  try {
    await upload(getState(), nextV);
    serverVersion = nextV;
    emitSync({ status: "synced", lastSyncedAt: new Date().toISOString(), error: null });
  } catch (e) { emitSync({ status: "error", error: e.message || String(e) }); }
  finally {
    pushing = false;
    if (pendingWhilePush) { pendingWhilePush = false; scheduleSync(); }
  }
}

// ===== 인증 =====
export async function initAuth() {
  registerSync(scheduleSync); // 로컬 변경 시 클라우드 반영(로그인 상태에서만 동작)
  try {
    const { data } = await supabase.auth.getSession();
    await handleSession(data.session);
    supabase.auth.onAuthStateChange((_e, session) => { handleSession(session); });
  } catch (e) { emitSync({ status: "local", error: e.message }); }
}
async function handleSession(session) {
  if (session?.user) {
    owner = session.user.id;
    emitSync({ status: "syncing", email: session.user.email, owner });
    await hydrate();
  } else {
    owner = null;
    if (channel) { supabase.removeChannel(channel); channel = null; }
    emitSync({ status: "local", email: null, owner: null });
  }
}
export async function signIn(email) {
  const redirect = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } });
  return error ? error.message : null;
}
export async function signOut() { await supabase.auth.signOut(); }
export function isCloudConfigured() { return !!(SUPABASE_URL && SUPABASE_ANON); }
