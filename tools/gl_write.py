#!/usr/bin/env python3
"""
gl_write.py — 정비서가 성장원장(growth.app_state)에 분석 결과를 기록하는 서버 헬퍼.

용도: J님이 아이디어/파일/링크를 주면 정비서가 분석 → 타당성 케이스·프로젝트·티켓을
      이 도구로 J님의 app_state 문서에 RMW(read-modify-write)로 병합한다. 앱은 실시간 동기화로 즉시 반영.

보안: service_role 키(~/.config/jbs/growth-service-role, 600)를 서버에서만 사용. 앱/깃에 절대 두지 않음.
      RLS를 우회하므로 owner_id는 반드시 J님 것으로 명시.

명령:
  get                      현재 문서 요약(엔티티 건수·version) 출력
  merge --file patch.json  patch의 배열들을 append 병합(신규 id/타임스탬프 자동) 후 version+1 업서트
  resolve-owner --email X  auth.users에서 이메일→owner_id 조회(Management API PAT 필요) 후 ~/.config/jbs/growth-owner 저장

patch.json 형식(예):
  { "feasibilityCases": [ { "title": "...", "problem": "...", "intakeContent": "...",
        "linkedGoalId": null, "scores": {...}, "analysis": {"summary":"...","recommendation":"...","at":"2026-09-14"} } ],
    "projects": [...], "tickets": [...], "companyGoals": [...] }
"""
import argparse, json, os, sys, urllib.request, uuid, pathlib, datetime

REF = "trkjkgqjpkfqchykblmt"
REST = f"https://{REF}.supabase.co/rest/v1"
SVC_FILE = pathlib.Path.home() / ".config/jbs/growth-service-role"
OWNER_FILE = pathlib.Path.home() / ".config/jbs/growth-owner"
PAT_FILE = pathlib.Path.home() / ".supabase-pat"
SCHEMA = "growth"
ARRAY_KEYS = ["deals", "moneyTests", "weeklyReviews", "decisions", "teamMembers", "handoffs",
              "oneOnOnes", "quarterlyGoals", "companyGoals", "feasibilityCases", "projects",
              "tasks", "tickets", "stakeholders", "predictions", "proposals", "competencyEvidence"]

def _svc():
    if not SVC_FILE.exists():
        sys.exit("service_role 키 없음. 먼저 setup-supabase.sh 를 실행하세요.")
    return SVC_FILE.read_text().strip()

def _now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def _req(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"_error": raw[:400]}

def _rest_headers(write=False):
    key = _svc()
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}
    if write:
        h["Content-Type"] = "application/json"
        h["Content-Profile"] = SCHEMA
    else:
        h["Accept-Profile"] = SCHEMA
    return h

def _owner(args):
    if getattr(args, "owner", None):
        return args.owner
    if OWNER_FILE.exists():
        return OWNER_FILE.read_text().strip()
    sys.exit("owner_id 없음. --owner 로 지정하거나 resolve-owner 로 캐시하세요.")

def fetch(owner):
    st, rows = _req("GET", f"{REST}/app_state?owner_id=eq.{owner}&select=state,version", headers=_rest_headers())
    if isinstance(rows, list):
        if rows:
            return rows[0].get("state") or {}, rows[0].get("version") or 1
        return None, 0
    raise SystemExit("REST 오류 http=%s body=%s" % (st, json.dumps(rows, ensure_ascii=False)))

def upsert(owner, state, version):
    body = [{"owner_id": owner, "state": state, "version": version, "updated_at": _now()}]
    h = _rest_headers({"Prefer": "resolution=merge-duplicates,return=minimal"})
    st, _ = _req("POST", f"{REST}/app_state?on_conflict=owner_id", body=body, headers=h)
    return st

def cmd_get(args):
    owner = _owner(args)
    state, version = fetch(owner)
    if state is None:
        print(json.dumps({"exists": False, "hint": "J님이 앱에서 아직 로그인(동기화)하지 않았습니다."}, ensure_ascii=False))
        return
    counts = {k: len(state.get(k, [])) for k in ARRAY_KEYS if state.get(k)}
    print(json.dumps({"exists": True, "version": version, "counts": counts}, ensure_ascii=False, indent=2))

def cmd_merge(args):
    owner = _owner(args)
    patch = json.loads(pathlib.Path(args.file).read_text())
    state, version = fetch(owner)
    if state is None:
        sys.exit("app_state 문서가 없습니다. J님이 앱에서 1회 로그인(동기화)해야 정비서가 기록할 수 있습니다.")
    added = {}
    for k, items in patch.items():
        if k not in ARRAY_KEYS or not isinstance(items, list):
            continue
        cur = state.get(k) or []
        norm = []
        for it in items:
            it = dict(it)
            it.setdefault("id", "id-" + uuid.uuid4().hex[:16])
            it.setdefault("createdAt", _now())
            it["updatedAt"] = _now()
            norm.append(it)
        state[k] = norm + cur   # 최신이 위로
        added[k] = len(norm)
    new_version = version + 1
    status = upsert(owner, state, new_version)
    print(json.dumps({"ok": status in (200, 201, 204), "http": status, "added": added, "version": new_version}, ensure_ascii=False, indent=2))

def _mgmt(path, method="GET", body=None):
    if not PAT_FILE.exists():
        sys.exit("~/.supabase-pat 없음(Management API PAT 필요).")
    pat = PAT_FILE.read_text().strip()
    return _req(method, f"https://api.supabase.com/v1/projects/{REF}{path}", body=body,
                headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json", "User-Agent": "jbs-gl/1.0"})

def cmd_sql(args):
    st, rows = _mgmt("/database/query", "POST", {"query": args.q})
    print(json.dumps({"http": st, "rows": rows}, ensure_ascii=False))

def cmd_pgrst_get(args):
    st, cfg = _mgmt("/postgrest")
    print(json.dumps({"http": st, "db_schema": (cfg.get("db_schema") if isinstance(cfg, dict) else cfg)}, ensure_ascii=False))

def cmd_expose(args):
    # ★라이브 authenticator 역할의 pgrst.db_schemas 에 growth append + reload.
    #   반드시 pg_roles.rolconfig(라이브 authoritative)에서 현재값을 읽는다.
    #   (current_setting은 세션에 role default가 안 실려 null → 그걸로 덮으면 타앱 노출 소실 위험)
    st, rows = _mgmt("/database/query", "POST", {"query": "select rolconfig from pg_roles where rolname='authenticator';"})
    cfg = (rows[0].get("rolconfig") if isinstance(rows, list) and rows else []) or []
    live = ""
    for item in cfg:
        if isinstance(item, str) and item.startswith("pgrst.db_schemas="):
            live = item.split("=", 1)[1]
    schemas = [s.strip() for s in live.split(",") if s.strip()]
    if not schemas:
        sys.exit("라이브 db_schemas를 읽지 못함 — 안전을 위해 중단(수동 확인).")
    before = list(schemas)
    if SCHEMA not in schemas:
        schemas.append(SCHEMA)
    newval = ", ".join(schemas)
    q = ("alter role authenticator set pgrst.db_schemas = '%s';\n"
         "notify pgrst, 'reload config';\nnotify pgrst, 'reload schema';") % newval
    st2, _ = _mgmt("/database/query", "POST", {"query": q})
    print(json.dumps({"before": before, "after": schemas, "applied_http": st2}, ensure_ascii=False))

def cmd_resolve_owner(args):
    if not PAT_FILE.exists():
        sys.exit("~/.supabase-pat 없음(Management API PAT 필요).")
    pat = PAT_FILE.read_text().strip()
    q = {"query": f"select id from auth.users where email = '{args.email}' limit 1;"}
    st, rows = _req("POST", f"https://api.supabase.com/v1/projects/{REF}/database/query",
                    body=q, headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json", "User-Agent": "jbs-gl/1.0"})
    if not rows:
        sys.exit(f"{args.email} 사용자를 찾지 못했습니다(아직 미로그인?).")
    oid = rows[0]["id"]
    OWNER_FILE.write_text(oid)
    print(json.dumps({"ok": True, "owner_id": oid, "cached": str(OWNER_FILE)}, ensure_ascii=False))

def main():
    ap = argparse.ArgumentParser(description="성장원장 서버 기록 헬퍼(service_role)")
    ap.add_argument("--owner", help="owner_id(미지정 시 ~/.config/jbs/growth-owner)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("get").set_defaults(func=cmd_get)
    m = sub.add_parser("merge"); m.add_argument("--file", required=True); m.set_defaults(func=cmd_merge)
    r = sub.add_parser("resolve-owner"); r.add_argument("--email", required=True); r.set_defaults(func=cmd_resolve_owner)
    q = sub.add_parser("sql"); q.add_argument("--q", required=True); q.set_defaults(func=cmd_sql)
    sub.add_parser("pgrst-get").set_defaults(func=cmd_pgrst_get)
    sub.add_parser("expose").set_defaults(func=cmd_expose)
    args = ap.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
