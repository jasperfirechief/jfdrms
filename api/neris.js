const BASE_URL = String(process.env.NERIS_BASE_URL || "").replace(/\/$/,"");
const CLIENT_ID = String(process.env.NERIS_CLIENT_ID || "");
const CLIENT_SECRET = String(process.env.NERIS_CLIENT_SECRET || "");
const DEPARTMENT_ID = String(process.env.NERIS_DEPARTMENT_ID || "");
const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";

async function requireNerisRole(req, allowed = ["admin","clerk"]) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Authentication required.");
  const headers = { apikey: SUPABASE_KEY, Authorization: auth };
  const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", { headers });
  if (!userResponse.ok) throw new Error("Invalid or expired session.");
  const user = await userResponse.json();
  const profileResponse = await fetch(SUPABASE_URL + "/rest/v1/users?select=app_role,active&user_id=eq." + encodeURIComponent(user.id), { headers });
  if (!profileResponse.ok) throw new Error("Unable to verify RMS permissions.");
  const profile = (await profileResponse.json())?.[0];
  if (profile?.active !== true || !allowed.includes(profile.app_role)) throw new Error("Administrator or Clerk access required.");
  return { user, role: profile.app_role, headers };
}

async function getToken() {
  if (!BASE_URL) throw new Error("NERIS API URL is not configured in Vercel.");
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("NERIS integration credentials are not configured in Vercel.");
  const basic = Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64");
  const r = await fetch(BASE_URL + "/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "JasperFireDepartmentRMS/1.0"
    },
    body: "grant_type=client_credentials"
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error("NERIS authentication failed (" + r.status + ").");
  if (!data.access_token) throw new Error("NERIS authentication did not return an access token.");
  return { token: data.access_token, token_type: data.token_type || "Bearer", expires_in: data.expires_in || null };
}

function withDepartmentId(payload) {
  const copy = JSON.parse(JSON.stringify(payload || {}));
  copy.base = copy.base || {};
  if (!copy.base.department_neris_id) copy.base.department_neris_id = DEPARTMENT_ID;
  if (!copy.base.department_neris_id) throw new Error("NERIS department ID is not configured.");
  return copy;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (new URL(req.url, "http://localhost").searchParams.get("action") === "test-auth") {
      try {
        await requireNerisRole(req, ["admin"]);
        const auth = await getToken();
        return res.status(200).json({
          ok: true,
          authenticated: true,
          base_url: BASE_URL,
          token_type: auth.token_type,
          expires_in: auth.expires_in
        });
      } catch (err) {
        return res.status(502).json({
          ok: false,
          authenticated: false,
          base_url: BASE_URL,
          error: err?.message || "NERIS authentication failed"
        });
      }
    }
    return res.status(200).json({
      ok: true,
      service: "jfdrms-neris",
      configured: Boolean(BASE_URL && CLIENT_ID && CLIENT_SECRET && DEPARTMENT_ID),
      base_url: BASE_URL
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (body?.action === "test-auth") {
      await requireNerisRole(req, ["admin"]);
      const auth = await getToken();
      return res.status(200).json({
        ok: true,
        authenticated: true,
        base_url: BASE_URL,
        token_type: auth.token_type,
        expires_in: auth.expires_in
      });
    }

    if (body?.action === "delete") {
      const access = await requireNerisRole(req, ["admin"]);
      const cad = String(body.cad || "").trim();
      const reportId = String(body.report_id || "").trim();
      const nerisIncidentId = String(body.neris_incident_id || "").trim();
      const reason = String(body.reason || "").trim();
      if (!cad || !reportId || !nerisIncidentId || !reason) {
        return res.status(400).json({ ok:false, error:"CAD, report ID, NERIS incident ID, and deletion reason are required." });
      }
      if (reason.length > 1000) {
        return res.status(400).json({ ok:false, error:"Deletion reason must be 1,000 characters or fewer." });
      }

      const incidentResponse = await fetch(
        SUPABASE_URL + "/rest/v1/incidents?select=incident_id,reports&cad=eq." + encodeURIComponent(cad),
        { headers: access.headers }
      );
      if (!incidentResponse.ok) throw new Error("Unable to verify the saved incident report.");
      const incidentRows = await incidentResponse.json();
      const incidentRow = Array.isArray(incidentRows) ? incidentRows[0] : null;
      if (!incidentRow) throw new Error("Incident not found.");
      const matchingReports = (Array.isArray(incidentRow.reports) ? incidentRow.reports : [])
        .filter(report => String(report?.report_id || "") === reportId);
      if (matchingReports.length !== 1) throw new Error("Saved report not found or report identifier is ambiguous.");
      const savedReport = matchingReports[0];
      if (savedReport.status !== "submitted_to_neris") {
        throw new Error("Only a report currently submitted to NERIS can be deleted from NERIS.");
      }
      const savedNerisId = String(savedReport?.neris?.neris_incident_id || "").trim();
      if (!savedNerisId || savedNerisId !== nerisIncidentId) {
        throw new Error("NERIS incident identifier does not match the saved submission.");
      }

      const auth = await getToken();
      const deleted = await fetch(
        BASE_URL + "/incident/" + encodeURIComponent(DEPARTMENT_ID) + "/" + encodeURIComponent(nerisIncidentId),
        {
          method: "DELETE",
          headers: {
            "Authorization": "Bearer " + auth.token,
            "User-Agent": "JasperFireDepartmentRMS/1.0"
          }
        }
      );
      const deletedText = await deleted.text();
      let deletedData;
      try { deletedData = deletedText ? JSON.parse(deletedText) : {}; }
      catch { deletedData = { message: deletedText }; }
      if (!deleted.ok) {
        return res.status(502).json({
          ok:false,
          deleted:false,
          error:"NERIS did not delete the incident.",
          status:deleted.status,
          details:deletedData
        });
      }

      const auditResponse = await fetch(SUPABASE_URL + "/rest/v1/rpc/record_neris_deletion", {
        method: "POST",
        headers: { ...access.headers, "Content-Type":"application/json" },
        body: JSON.stringify({
          p_incident_id: Number(incidentRow.incident_id),
          p_cad: cad,
          p_report_id: reportId,
          p_neris_incident_id: nerisIncidentId,
          p_reason: reason,
          p_response: deletedData
        })
      });
      const auditText = await auditResponse.text();
      let auditData;
      try { auditData = auditText ? JSON.parse(auditText) : {}; }
      catch { auditData = { message:auditText }; }
      if (!auditResponse.ok) {
        return res.status(502).json({
          ok:false,
          deleted:true,
          audit_recorded:false,
          error:"NERIS deleted the incident, but JFDRMS could not save the deletion audit record. Contact an RMS administrator before retrying.",
          audit_details:auditData
        });
      }

      return res.status(200).json({
        ok:true,
        deleted:true,
        audit_recorded:true,
        neris_incident_id:nerisIncidentId,
        result:deletedData,
        audit:auditData
      });
    }

    if (!body || !["validate","submit"].includes(body.action) || !body.payload) {
      return res.status(400).json({ ok:false, error:"A NERIS validation or submission payload is required." });
    }
    const access = await requireNerisRole(req, ["admin","clerk"]);
    if (body.action === "submit") {
      if (!body.cad || !body.report_id || !body.incident_id) throw new Error("Incident and report identifiers are required for NERIS submission.");
      let incidentRow = null;
      if (access.role === "clerk") {
        const verify = await fetch(SUPABASE_URL + "/rest/v1/rpc/clerk_search_incident_reports", { method:"POST", headers:{...access.headers,"Content-Type":"application/json"}, body:"{}" });
        if (!verify.ok) throw new Error("Unable to verify the incident report.");
        incidentRow = (await verify.json() || []).find(x => String(x.cad) === String(body.cad));
      } else {
        const verify = await fetch(SUPABASE_URL + "/rest/v1/incidents?select=cad,reports&cad=eq." + encodeURIComponent(body.cad), { headers:access.headers });
        if (!verify.ok) throw new Error("Unable to verify the incident report.");
        incidentRow = (await verify.json() || [])[0];
      }
      const report = (incidentRow?.reports || []).find(x => String(x?.report_id || "") === String(body.report_id));
      if (!report || report.status !== "ready_for_neris" || String(report.report_type || "").startsWith("pcr_")) throw new Error("Only an incident report awaiting NERIS review can be submitted by this account.");
      const detailsResponse = await fetch(SUPABASE_URL + "/rest/v1/incident_details?select=incident_id&cad=eq." + encodeURIComponent(body.cad), { headers:access.headers });
      if (!detailsResponse.ok) throw new Error("Unable to verify the incident detail record.");
      const detail = (await detailsResponse.json() || [])[0];
      if (!detail || String(detail.incident_id) !== String(body.incident_id)) throw new Error("Incident identifiers do not match.");
    }

    const payload = withDepartmentId(body.payload);
    const auth = await getToken();
    const token = auth.token;

    const validation = await fetch(BASE_URL + "/incident/" + encodeURIComponent(payload.base.department_neris_id) + "/validate", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "JasperFireDepartmentRMS/1.0"
      },
      body: JSON.stringify(payload)
    });
    const validationText = await validation.text();
    let validationData; try { validationData = JSON.parse(validationText); } catch { validationData = { raw: validationText }; }

    if (!validation.ok) {
      return res.status(422).json({
        ok:false,
        error:"NERIS validation rejected the report.",
        status:validation.status,
        details:validationData
      });
    }

    if (body.action === "validate") {
      return res.status(200).json({ok:true,validated:true,details:validationData});
    }

    const submitted = await fetch(BASE_URL + "/incident/" + encodeURIComponent(payload.base.department_neris_id), {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "JasperFireDepartmentRMS/1.0"
      },
      body: JSON.stringify(payload)
    });
    const submittedText = await submitted.text();
    let submittedData; try { submittedData = JSON.parse(submittedText); } catch { submittedData = { raw: submittedText }; }

    if (!submitted.ok) {
      return res.status(502).json({
        ok:false,
        error:"NERIS rejected the report.",
        status:submitted.status,
        details:submittedData
      });
    }

    return res.status(200).json({
      ok:true,
      neris_incident_id:submittedData?.uid || submittedData?.neris_id || submittedData?.incident?.uid || submittedData?.incident?.neris_id || null,
      response:submittedData
    });
  } catch (err) {
    console.error("NERIS submission error", err);
    return res.status(500).json({ ok:false, error:err?.message || "NERIS submission failed" });
  }
}
