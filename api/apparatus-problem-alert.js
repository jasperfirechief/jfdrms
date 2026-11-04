const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path, opts = {}) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {})
    }
  });
  const raw = await r.text();
  let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!r.ok) throw new Error(data?.message || data?.hint || String(data || "Supabase request failed"));
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (process.env.RMS_EMAILS_ENABLED !== "true") {
      return res.status(200).json({ ok: true, skipped: true, reason: "Automatic RMS emails are disabled until go-live approval." });
    }
    if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) throw new Error("Supabase email service is not configured.");
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Authentication required." });
    const auth = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!auth.ok) return res.status(401).json({ error: "Invalid session." });
    const user = await auth.json();
    const checkId = Number(req.body?.check_id);
    if (!Number.isSafeInteger(checkId) || checkId < 1) return res.status(400).json({ error: "A valid apparatus check ID is required." });
    const rows = await supa("apparatus_checks?select=check_id,apparatus_id,performed_by,check_date,check_time,status,checklist,notes,problem_count,email_status,emailed_at&check_id=eq." + checkId + "&performed_by=eq." + encodeURIComponent(user.id));
    const check = rows?.[0];
    if (!check) return res.status(404).json({ error: "Apparatus check not found for this user." });
    if (check.email_status === "sent" || check.emailed_at) return res.status(200).json({ ok: true, already_sent: true });
    const answers = Array.isArray(check.checklist) ? check.checklist : [];
    const needsAttention = answers.filter(x => String(x.status || "").toLowerCase() === "attention");
    const flaggedText = [check.notes, ...needsAttention.flatMap(x => [x.item_text, x.label, x.notes])]
      .filter(Boolean).join(" ");
    const outOfService = /out\s*of\s*service|oos\b|unsafe\s*to\s*operate/i.test(flaggedText);
    if (!needsAttention.length && !outOfService) {
      await supa("apparatus_checks?check_id=eq." + checkId, {
        method: "PATCH", body: JSON.stringify({ email_status: "not_required" })
      });
      return res.status(200).json({ ok: true, skipped: true, reason: "No unresolved apparatus problem was reported." });
    }
    const apparatusRows = await supa("apparatus?select=unit_number,apparatus_type&apparatus_id=eq." + check.apparatus_id);
    const apparatus = apparatusRows?.[0] || {};
    const people = await supa("personnel?select=first_name,last_name&auth_user_id=eq." + encodeURIComponent(user.id));
    const inspector = people?.[0] ? [people[0].first_name, people[0].last_name].filter(Boolean).join(" ") : user.email || "Department member";
    const issueLines = needsAttention.map(x => "- " + (x.item_text || x.label || "Checklist item") + (x.notes ? ": " + x.notes : ""));
    if (outOfService) issueLines.unshift("- APPARATUS REPORTED OUT OF SERVICE / UNSAFE TO OPERATE");
    if (check.notes) issueLines.push("- General notes: " + check.notes);
    const key = process.env.BREVO_API_KEY, from = process.env.BREVO_FROM_EMAIL;
    if (!key || !from) throw new Error("Brevo email is not configured.");
    const payload = {
      sender: { email: from, name: "Jasper Fire Department RMS" },
      to: [{ email: "firechief@jaspercity.com" }, { email: "deputyfirechief@jaspercity.com" }],
      subject: "APPARATUS PROBLEM - " + (apparatus.unit_number || ("Unit " + check.apparatus_id)),
      textContent: [
        "An apparatus check reported an unresolved problem.",
        "",
        "Apparatus: " + (apparatus.unit_number || check.apparatus_id),
        "Type: " + (apparatus.apparatus_type || "Not recorded"),
        "Date/time: " + check.check_date + " " + (check.check_time || ""),
        "Reported by: " + inspector,
        "Status: " + check.status,
        "Problems: " + (check.problem_count ?? needsAttention.length),
        "",
        "PROBLEM DETAILS",
        ...issueLines,
        "",
        "Please review and coordinate any required repairs or out-of-service action."
      ].join("\n")
    };
    const sent = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    if (!sent.ok) throw new Error("Brevo delivery failed: " + await sent.text());
    await supa("apparatus_checks?check_id=eq." + checkId, {
      method: "PATCH", body: JSON.stringify({ email_status: "sent", emailed_at: new Date().toISOString() })
    });
    return res.status(200).json({ ok: true, notified: ["firechief@jaspercity.com", "deputyfirechief@jaspercity.com"] });
  } catch (error) {
    console.error("Apparatus problem notification failed:", error);
    return res.status(500).json({ error: error?.message || "Apparatus notification failed." });
  }
}