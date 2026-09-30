import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
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
  if (!r.ok) throw new Error(data?.message || data?.hint || data?.details || String(data || "Supabase request failed"));
  return data;
}

function chicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}
function chicagoDate(date = new Date()) {
  const p = chicagoParts(date); return p.year + "-" + p.month + "-" + p.day;
}
function chicagoHour(date = new Date()) { return Number(chicagoParts(date).hour); }
function previousDate(iso) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
}
function zoned7amUtc(isoDate) {
  const naive = new Date(isoDate + "T07:00:00Z");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(naive);
  const v = Object.fromEntries(parts.filter(x => x.type !== "literal").map(x => [x.type, Number(x.value)]));
  const offsetMs = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - naive.getTime();
  return new Date(Date.UTC(Number(isoDate.slice(0,4)), Number(isoDate.slice(5,7))-1, Number(isoDate.slice(8,10)), 7) - offsetMs);
}
function clean(v) { return String(v ?? "").replace(/\\s+/g, " ").trim(); }
function fmtDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",month:"2-digit",day:"2-digit",year:"numeric"}).format(new Date(iso));
}
function fmtDateTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",month:"2-digit",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso));
}

async function makeTablePdf(title, sections) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=612,H=792,margin=40,contentW=W-margin*2;
  const red=rgb(.78,.05,.05),gray=rgb(.35,.39,.45);
  let page=pdf.addPage([W,H]),y=H-margin;
  const ensure = (h=16) => { if(y-h<margin){page=pdf.addPage([W,H]);y=H-margin;return true;} return false; };
  const wrap = (value,size=9,font=regular) => {
    const words=clean(value).split(/\\s+/).filter(Boolean),lines=[];let line="";
    for(const w of words){const t=line?line+" "+w:w;if(font.widthOfTextAtSize(t,size)>contentW-125){if(line)lines.push(line);line=w;}else line=t;}
    if(line)lines.push(line);return lines;
  };
  const header = () => {ensure(40);page.drawText("JASPER FIRE DEPARTMENT",{x:margin,y,size:16,font:bold,color:red});y-=22;page.drawText(title,{x:margin,y,size:11,font:bold});y-=20;};
  header();
  for(const section of sections){
    ensure(28);page.drawText(clean(section.title),{x:margin,y,size:12,font:bold,color:red});y-=16;
    for(const row of section.rows||[]){
      const label=clean(row[0]),value=clean(row[1]);if(!value)continue;
      const lines=wrap(value);
      ensure(Math.max(16,14*lines.length));
      page.drawText(label,{x:margin,y,size:8,font:bold,color:gray});
      page.drawText(lines[0]||"",{x:margin+125,y,size:9,font:regular});y-=14;
      for(const more of lines.slice(1)){ensure(14);page.drawText(more,{x:margin+125,y,size:9,font:regular});y-=12;}
    }
  }
  const pages=pdf.getPages();
  pages.forEach((p,i)=>p.drawText("Jasper Fire Department • "+title+" • Page "+(i+1)+" of "+pages.length,{x:margin,y:18,size:7,font:regular,color:gray}));
  return pdf.save();
}

function incidentSections(incident) {
  const reports=Array.isArray(incident.reports)?incident.reports:[];
  const detail=Array.isArray(incident.incident_details)?incident.incident_details[0]:incident.incident_details||{};
  const rows=[
    ["CAD / Incident",incident.cad||incident.cad_number||incident.incident_number],
    ["Date",fmtDate(incident.dispatch_time||incident.incident_date)],
    ["Type",reports[0]?.data?.rPrimaryIncidentType||incident.type||incident.incident_type],
    ["Location",incident.location||incident.address||incident.location_address],
    ["Narrative",reports.map(r=>r?.data?.rNarrative).filter(Boolean).join("\n\n")||detail.narrative||incident.narrative||"No narrative entered."],
    ["NERIS Status",reports.map(r=>r?.status).filter(Boolean).join(", ")]
  ];
  return [{title:"GENERAL INCIDENT REPORT",rows}];
}

async function makeReportPdf(incident, report) {
  const data=report?.data||{};
  const kind=String(report?.report_type||"").startsWith("pcr_")?"PATIENT CARE REPORT":"FIRE INCIDENT REPORT";
  const sections=[{
    title:"REPORT SUMMARY",
    rows:[
      ["CAD / Incident",incident?.cad||data.rCad||data.cad||data.incident_number],
      ["Date",fmtDate(incident?.dispatch_time||data.rDate||data.date)],
      ["Time",incident?.dispatch_time?fmtDateTime(incident.dispatch_time).split(", ").slice(1).join(", "):data.rTime],
      ["Type",data.rPrimaryIncidentType||incident?.type||data.rCallType],
      ["Location",incident?.location||data.rLocation||data.location],
      ["Report Status",report?.status||"Draft"]
    ]
  }];
  if(kind==="PATIENT CARE REPORT"){
    const patients=Array.isArray(data.patients)?data.patients:[];
    if(!patients.length) sections.push({title:"PATIENT CARE",rows:[["Patient","No patient information entered."]]});
    for(let n=0;n<patients.length;n++){
      const p=patients[n]||{};
      const name=[p.firstName,p.lastName].filter(Boolean).join(" ")||p.name||"Patient "+(n+1);
      sections.push({title:"PATIENT "+(n+1)+" • "+name,rows:[
        ["Patient",name],["DOB",p.dob],["Age",p.age],["Sex",p.sex],["Address",p.address],
        ["Chief Complaint",p.chiefComplaint||p.complaint],["Care Provided",p.careProvided],
        ["Initial Vitals",p.vitals?.[0]?JSON.stringify(p.vitals[0]):""],
        ["Additional Vitals",Array.isArray(p.vitals)&&p.vitals.length>1?p.vitals.slice(1).map(v=>JSON.stringify(v)).join(" | "):""],
        ["BLS Care",Array.isArray(p.careMethods)?p.careMethods.join(", "):p.careMethods],
        ["Treatment Notes",p.careNotes||p.treatmentNotes],
        ["Disposition",p.disposition],["Transport Unit",p.transportUnit||p.transportVehicle],
        ["Transport Agency",p.transportAgency],["Destination",p.destination],
        ["Refusal",p.refusal?JSON.stringify(p.refusal):""]
      ]});
    }
  } else {
    sections.push({title:"INCIDENT DETAILS",rows:[
      ["Call Type",data.rCallType||incident?.type],["Narrative",data.rNarrative||data.narrative||incident?.narrative],
      ["Actions / Outcome",data.rActionsTaken||data.actionsTaken||data.outcome],
      ["Property / Responsible Party",data.propertyOwner||data.responsibleParty],
      ["Injuries / Damage",data.injuries||data.propertyDamage],
      ["Responding Apparatus",Array.isArray(data.responding_apparatus)?data.responding_apparatus.map(x=>JSON.stringify(x)).join(" | "):""]
    ]});
  }
  sections.push({title:"DEPARTMENTAL / NERIS INCIDENT DATA",rows:Object.entries(data).filter(([k,v])=>v!==null&&v!==undefined&&v!==""&&!["patients","responding_apparatus"].includes(k)).map(([k,v])=>[k,String(typeof v==="object"?JSON.stringify(v):v)])});
  return makeTablePdf(kind+" • "+clean(incident?.cad||data.rCad||data.cad||"Report"),sections);
}

async function makeStaffingPdf(date, rows) {
  const sections=[{title:"SHIFT STAFFING • "+date,rows:[]}];
  for(const r of rows||[]) sections[0].rows.push(
    ["Station",r.station],["Apparatus",r.apparatus],["Personnel",r.user_id],["Driver",r.is_driver?"Yes":"No"],["Officer",r.is_officer?"Yes":"No"]
  );
  return makeTablePdf("DAILY STAFFING REPORT",sections);
}

async function makeChecksPdf(date, rows) {
  const sections=[{title:"APPARATUS CHECKS • "+date,rows:[]}];
  for(const r of rows||[]){
    sections[0].rows.push(
      ["Apparatus",r.apparatus_name],["Station",r.station],["Inspector",r.inspector_name],
      ["Status",r.overall_status],["Mileage",r.mileage],["Engine Hours",r.engine_hours],
      ["Defects",r.defect_notes],["Checklist",r.checklist_data?JSON.stringify(r.checklist_data):""]
    );
  }
  if(!rows?.length) sections[0].rows.push(["Result","No apparatus checks were recorded for this shift."]);
  return makeTablePdf("APPARATUS CHECKS REPORT",sections);
}

async function sendEmail(attachments,shiftStart,shiftEnd,incidentCount,reportCount) {
  const key=process.env.BREVO_API_KEY,from=process.env.BREVO_FROM_EMAIL;
  if(!key||!from) throw new Error("Brevo email is not configured. Add BREVO_API_KEY and BREVO_FROM_EMAIL in Vercel.");
  const payload={
    sender:{email:from,name:"Jasper Fire Department"},
    to:[{email:"firechief@jaspercity.com"},{email:"fireclerk@jaspercity.com"}],
    subject:"Jasper Fire Department - Daily Shift Reports - "+shiftStart+" to "+shiftEnd,
    textContent:"Daily shift package for "+shiftStart+" through "+shiftEnd+"\\n\\nIncidents: "+incidentCount+"\\nSubmitted reports: "+reportCount+"\\nAttachments: "+attachments.length,
    attachment:attachments.map(a=>({content:a.content,name:a.filename}))
  };
  const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error("Brevo delivery failed: "+await r.text());
}

export default async function handler(req,res) {
  if(req.method!=="GET"&&req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  if(process.env.CRON_SECRET && (req.headers.authorization||"")!=="Bearer "+process.env.CRON_SECRET) return res.status(401).json({error:"Unauthorized"});
  try {
    const now=new Date();
    if(chicagoHour(now)!==8) return res.status(200).json({ok:true,skipped:true,reason:"Outside 8 AM America/Chicago delivery window."});
    if(!SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel.");
    const shiftEnd=chicagoDate(now),shiftStart=previousDate(shiftEnd);
    const startUtc=zoned7amUtc(shiftStart).toISOString(),endUtc=zoned7amUtc(shiftEnd).toISOString();
    const staffing=await supa("daily_staffing?select=*&staffing_date=eq."+shiftStart+"&order=shift");
    const checks=await supa("apparatus_checks?select=*&check_date=eq."+shiftStart+"&order=apparatus_id,check_time");
    const incidents=await supa("incidents?select=*&dispatch_time=gte."+encodeURIComponent(startUtc)+"&dispatch_time=lt."+encodeURIComponent(endUtc)+"&order=dispatch_time");
    const standalone=await supa("standalone_reports?select=*&created_at=gte."+encodeURIComponent(startUtc)+"&created_at=lt."+encodeURIComponent(endUtc)+"&order=created_at");
    const attachments=[];
    const staffingPdf=await makeStaffingPdf(shiftStart,staffing||[]);
    attachments.push({content:Buffer.from(staffingPdf).toString("base64"),filename:"01 - Daily Staffing Report.pdf"});
    const checksPdf=await makeChecksPdf(shiftStart,checks||[]);
    attachments.push({content:Buffer.from(checksPdf).toString("base64"),filename:"02 - Apparatus Checks.pdf"});
    let reportCount=0,attachmentNumber=3;
    for(const incident of incidents||[]){
      for(let idx=0;idx<(Array.isArray(incident.reports)?incident.reports.length:0);idx++){
        const report=incident.reports[idx];
        const pdf=await makeReportPdf(incident,report);
        const label=String(report?.report_type||"report").startsWith("pcr_")?"PCR":"Fire Report";
        attachments.push({content:Buffer.from(pdf).toString("base64"),filename:String(attachmentNumber++).padStart(2,"0")+" - "+clean(incident.cad||"Incident")+" - "+label+" "+(idx+1)+".pdf"});
        reportCount++;
      }
    }
    for(const report of standalone||[]){
      const pdf=await makeReportPdf({},report);
      const label=String(report?.report_type||"report").startsWith("pcr_")?"PCR":"Fire Report";
      attachments.push({content:Buffer.from(pdf).toString("base64"),filename:String(attachmentNumber++).padStart(2,"0")+" - Standalone - "+label+".pdf"});
      reportCount++;
    }
    await sendEmail(attachments,shiftStart,shiftEnd,(incidents||[]).length,reportCount);
    return res.status(200).json({ok:true,shift_start:shiftStart,shift_end:shiftEnd,incidents:(incidents||[]).length,reports:reportCount,attachments:attachments.length});
  } catch(e) {
    console.error("Daily report email error",e);
    return res.status(500).json({ok:false,error:e?.message||"Daily report email failed."});
  }
}
