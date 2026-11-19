const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supa(path, options = {}) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || data?.hint || String(data || "Supabase request failed"));
  return data;
}

function centralParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}
function tomorrowCentral() {
  const p = centralParts();
  const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + 1, 12));
  return d.toISOString().slice(0, 10);
}
function validEmail(value) {
  const email = String(value || "").trim();
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ? email : "";
}
async function sendReminder(email, inspection) {
  const subject = "Jasper Fire Department: Reinspection Tomorrow";
  const date = new Intl.DateTimeFormat("en-US", {timeZone:"America/Chicago",month:"long",day:"numeric",year:"numeric"}).format(new Date(inspection.reinspection_date + "T12:00:00-06:00"));
  const time = inspection.reinspection_time ? (() => { const parts=String(inspection.reinspection_time).slice(0,5).split(":").map(Number); const hour=parts[0]%12||12; return hour+":"+String(parts[1]).padStart(2,"0")+" "+(parts[0]>=12?"PM":"AM"); })() : "Time not recorded";
  const textContent = [
    "This is a reminder of your scheduled fire reinspection tomorrow.",
    "",
    "Occupancy: " + (inspection.occupancy_name || "Not recorded"),
    "Address: " + (inspection.address || "Not recorded"),
    "Reinspection: " + date + " at " + time,
    "",
    "Please review the prior inspection report in JFDRMS before the appointment.",
    "",
    "Jasper Fire Department"
  ].join("\\n");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {"api-key":process.env.BREVO_API_KEY,"Content-Type":"application/json","accept":"application/json"},
    body: JSON.stringify({sender:{email:process.env.BREVO_FROM_EMAIL,name:"Jasper Fire Department"},to:[{email}],subject,textContent})
  });
  if (!response.ok) throw new Error("Brevo delivery failed: " + (await response.text()).slice(0,400));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({error:"Method not allowed"});
  if (!process.env.CRON_SECRET || (req.headers.authorization || "") !== "Bearer " + process.env.CRON_SECRET) {
    return res.status(401).json({error:"Unauthorized"});
  }
  if (!SUPABASE_SERVICE_KEY || !process.env.BREVO_API_KEY || !process.env.BREVO_FROM_EMAIL) {
    return res.status(500).json({error:"Reminder email service is not configured."});
  }
  if (Number(centralParts().hour) !== 9) return res.status(200).json({ok:true,skipped:true,reason:"Outside the 9 AM Central reminder window."});
  try {
    const date = tomorrowCentral();
    const [inspections, personnel] = await Promise.all([
      supa("inspections?select=inspection_id,inspector_user_id,occupancy_name,address,reinspection_date,reinspection_time&reinspection_date=eq." + date + "&reinspection_reminder_sent_at=is.null&inspector_user_id=not.is.null"),
      supa("personnel?select=auth_user_id,email,active&active=eq.true&auth_user_id=not.is.null")
    ]);
    const people = new Map((personnel || []).map(p => [String(p.auth_user_id), validEmail(p.email)]));
    let sent = 0, skipped = 0, failures = [];
    for (const inspection of inspections || []) {
      const email = people.get(String(inspection.inspector_user_id));
      if (!email) { skipped++; continue; }
      try {
        await sendReminder(email, inspection);
        await supa("inspections?inspection_id=eq." + encodeURIComponent(inspection.inspection_id), {
          method:"PATCH",
          body:JSON.stringify({reinspection_reminder_sent_at:new Date().toISOString()})
        });
        sent++;
      } catch (error) {
        failures.push({inspection_id:inspection.inspection_id,error:error.message});
      }
    }
    return res.status(200).json({ok:failures.length===0,date,checked:(inspections||[]).length,sent,skipped,failures});
  } catch (error) {
    console.error("Reinspection reminder error", error);
    return res.status(500).json({error:error.message || "Unable to send reinspection reminders."});
  }
}
