export default async function handler(req, res) {
  const baseUrl = String(process.env.NERIS_BASE_URL || "https://api-test.neris.fsri.org/v1").replace(/\/$/, "");
  const clientId = String(process.env.NERIS_CLIENT_ID || "");
  const clientSecret = String(process.env.NERIS_CLIENT_SECRET || "");
  const departmentId = String(process.env.NERIS_DEPARTMENT_ID || "");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });
  if (!clientId || !clientSecret || !departmentId) return res.status(500).json({ ok: false, error: "NERIS test configuration missing" });

  const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const tokenResponse = await fetch(baseUrl + "/token", {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "JasperFireDepartmentRMS/1.0" },
    body: "grant_type=client_credentials"
  });
  const tokenText = await tokenResponse.text();
  let tokenData; try { tokenData = JSON.parse(tokenText); } catch { tokenData = {}; }
  if (!tokenResponse.ok || !tokenData.access_token) return res.status(502).json({ ok: false, stage: "authentication", status: tokenResponse.status });

  const t = "2026-09-30T02:00:00Z";
  const payload = {
    base: {
      department_neris_id: departmentId,
      incident_number: "TEST-20260930-001",
      location: {}
    },
    incident_types: [{ type: "FIRE||STRUCTURE_FIRE||ROOM_AND_CONTENTS_FIRE" }],
    dispatch: {
      incident_number: "TEST-20260930-001",
      call_answered: t,
      call_create: t,
      call_arrival: "2026-09-30T02:07:00Z",
      location: {},
      unit_responses: []
    }
  };

  const validationResponse = await fetch(baseUrl + "/incident/" + encodeURIComponent(departmentId) + "/validate", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokenData.access_token, "Content-Type": "application/json", "User-Agent": "JasperFireDepartmentRMS/1.0" },
    body: JSON.stringify(payload)
  });
  const validationText = await validationResponse.text();
  let details; try { details = JSON.parse(validationText); } catch { details = { raw: validationText }; }
  return res.status(200).json({ ok: validationResponse.ok, submitted: false, stage: "validation", status: validationResponse.status, details });
}