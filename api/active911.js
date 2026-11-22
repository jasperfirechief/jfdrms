const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "jfdrms-active911", method: "POST required" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Production uses a server-side Vercel environment variable so the
    // Active911 URL does not have to contain the secret.
    // The query-string key remains supported for backwards compatibility.
    const configuredSecret = String(process.env.ACTIVE911_WEBHOOK_KEY || "");
    const querySecret = String(req.query?.key || "");
    const secret = configuredSecret || querySecret;

    if (!secret) {
      return res.status(401).json({ ok: false, error: "Webhook authentication is not configured" });
    }

    let payload = req.body;
    if (typeof payload === "string") payload = JSON.parse(payload);
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Invalid JSON payload" });
    }

    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/ingest_active911_webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_secret: secret, p_payload: payload })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      console.error("Active911 ingestion failed", response.status, data);
      return res.status(502).json({ ok: false, error: "Database ingestion failed" });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Active911 webhook error", err);
    return res.status(500).json({ ok: false, error: "Webhook processing failed" });
  }
};
