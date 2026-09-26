const BASE_URL = String(process.env.NERIS_BASE_URL || "https://api.neris.fsri.org/v1").replace(/\/$/,"");
const CLIENT_ID = String(process.env.NERIS_CLIENT_ID || "");
const CLIENT_SECRET = String(process.env.NERIS_CLIENT_SECRET || "");
const DEPARTMENT_ID = String(process.env.NERIS_DEPARTMENT_ID || "");

async function getToken() {
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
  return data.access_token;
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
    return res.status(200).json({
      ok: true,
      service: "jfdrms-neris",
      configured: Boolean(CLIENT_ID && CLIENT_SECRET && DEPARTMENT_ID),
      base_url: BASE_URL
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || body.action !== "submit" || !body.payload) {
      return res.status(400).json({ ok:false, error:"A NERIS submission payload is required." });
    }

    const payload = withDepartmentId(body.payload);
    const token = await getToken();

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
