const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
  const userCheck = await fetch(SUPABASE_URL + "/auth/v1/user", {headers:{apikey:SUPABASE_KEY,Authorization:auth}});
  if (!userCheck.ok) return res.status(401).json({error:"Invalid or expired session"});
  const caller = await userCheck.json();
  const body = req.body || {};
  const fn = await fetch(SUPABASE_URL + "/functions/v1/admin-create-user", {
    method:"POST",
    headers:{apikey:SUPABASE_KEY,Authorization:auth,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const raw = await fn.text();
  let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = {error:raw}; }
  return res.status(fn.status).json(data);
}
