// Supabase 접속 설정 — anon 키는 '공개키'(RLS로 보호). env 있으면 우선, 없으면 임베드값.
// service_role(비밀)은 절대 클라이언트에 두지 않는다(정비서 서버 helper 전용).
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://trkjkgqjpkfqchykblmt.supabase.co";
export const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRya2prZ3FqcGtmcWNoeWtibG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTI5MzgsImV4cCI6MjA5NDY2ODkzOH0.VGSSP_SR7zABLJcRkixV1xNmuxMqNzTxuZCNPo7h85I";
