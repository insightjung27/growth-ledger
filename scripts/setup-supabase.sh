#!/usr/bin/env bash
# 성장원장 Supabase 키 세팅 — J님이 1회 직접 실행(! 접두). API키=J님 소관·정비서 자동실행 금지.
# 동작: Management API로 trkjk 프로젝트의 anon(공개)·service_role(비밀) 키를 가져와
#   · anon + URL → 화면 출력(정비서가 앱 config에 임베드; anon은 공개키라 노출 OK)
#   · service_role → ~/.config/jbs/growth-service-role (chmod 600, 정비서 서버 helper 전용, 비출력)
set -euo pipefail
REF="trkjkgqjpkfqchykblmt"
python3 - "$REF" "$HOME/.supabase-pat" <<'PY'
import json, urllib.request, pathlib, sys
REF, PATF = sys.argv[1], sys.argv[2]
PAT = pathlib.Path(PATF).read_text().strip()
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/api-keys",
                             headers={"Authorization": f"Bearer {PAT}", "User-Agent": "jbs/1.0"})
ks = json.loads(urllib.request.urlopen(req, timeout=30).read())
anon = next(k["api_key"] for k in ks if k["name"] == "anon")
svc  = next(k["api_key"] for k in ks if k["name"] == "service_role")
url  = f"https://{REF}.supabase.co"
cfg = pathlib.Path.home() / ".config/jbs"; cfg.mkdir(parents=True, exist_ok=True)
p = cfg / "growth-service-role"; p.write_text(svc); p.chmod(0o600)
print("=== 성장원장 Supabase (anon=공개키, 임베드용) ===")
print("VITE_SUPABASE_URL=" + url)
print("VITE_SUPABASE_ANON_KEY=" + anon)
print("---")
print("✅ service_role 저장 완료(비출력): ~/.config/jbs/growth-service-role (600)")
PY
