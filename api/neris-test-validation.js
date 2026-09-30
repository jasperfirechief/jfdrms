export default async function handler(req, res) {
  const baseUrl = String(process.env.NERIS_BASE_URL || "https://api-test.neris.fsri.org/v1").replace(/\/$/, "");
  const clientId = String(process.env.NERIS_CLIENT_ID || "");
  const clientSecret = String(process.env.NERIS_CLIENT_SECRET || "");
  const departmentId = String(process.env.NERIS_DEPARTMENT_ID || "");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });
  if (!clientId || !clientSecret || !departmentId) return res.status(500).json({ ok: false, error: "NERIS test configuration missing" });

  const action = new URL(req.url, "http://localhost").searchParams.get("action") || "validate";
  if (!["validate", "submit"].includes(action)) return res.status(400).json({ ok: false, error: "Use action=validate or action=submit" });

  const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const tokenResponse = await fetch(baseUrl + "/token", {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "JasperFireDepartmentRMS/1.0" },
    body: "grant_type=client_credentials"
  });
  const tokenText = await tokenResponse.text();
  let tokenData; try { tokenData = JSON.parse(tokenText); } catch { tokenData = {}; }
  if (!tokenResponse.ok || !tokenData.access_token) return res.status(502).json({ ok: false, stage: "authentication", status: tokenResponse.status });

  const payload = {
    base: {
      department_neris_id: departmentId,
      incident_number: "TEST-20260930-001",
      location: { country: "US", state: "AL", number: 100, street: "Test Street", incorporated_municipality: "Jasper", postal_code: "35501" }
    },
    incident_types: [{ type: "FIRE||STRUCTURE_FIRE||ROOM_AND_CONTENTS_FIRE" }],
    smoke_alarm: { presence: { type_rr_presence: "NOT_PRESENT" } },
    fire_alarm: { presence: { value: "NOT_PRESENT" } },
    other_alarm: { presence: { value: "NOT_PRESENT" } },
    fire_suppression: { presence: { value: "NOT_PRESENT" } },
    dispatch: {
      incident_number: "TEST-20260930-001",
      call_arrival: "2026-09-30T02:00:00Z",
      call_answered: "2026-09-30T02:01:00Z",
      call_create: "2026-09-30T02:07:00Z",
      location: { country: "US", state: "AL", number: 100, street: "Test Street", incorporated_municipality: "Jasper", postal_code: "35501" },
      unit_responses: []
    }
  };

  const headers = { Authorization: "Bearer " + tokenData.access_token, "Content-Type": "application/json", "User-Agent": "JasperFireDepartmentRMS/1.0" };
  const validationResponse = await fetch(baseUrl + "/incident/" + encodeURIComponent(departmentId) + "/validate", {
    method: "POST", headers, body: JSON.stringify(payload)
  });
  const validationText = await validationResponse.text();
  let validationDetails; try { validationDetails = JSON.parse(validationText); } catch { validationDetails = { raw: validationText }; }

  if (!validationResponse.ok) return res.status(200).json({ ok: false, submitted: false, stage: "validation", status: validationResponse.status, details: validationDetails });
  if (action === "validate") return res.status(200).json({ ok: true, validated: true, submitted: false, stage: "validation", status: validationResponse.status, details: validationDetails });

  const submitResponse = await fetch(baseUrl + "/incident/" + encodeURIComponent(departmentId), {
    method: "POST", headers, body: JSON.stringify(payload)
  });
  const submitText = await submitResponse.text();
  let submitDetails; try { submitDetails = JSON.parse(submitText); } catch { submitDetails = { raw: submitText }; }

  return res.status(200).json({
    ok: submitResponse.ok,
    validated: true,
    submitted: submitResponse.ok,
    stage: "submission",
    status: submitResponse.status,
    neris_incident_id: submitDetails?.uid || submitDetails?.neris_id || submitDetails?.incident?.uid || submitDetails?.incident?.neris_id || null,
    details: submitDetails
  });
}