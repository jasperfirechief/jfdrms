import { makePdf } from "./report-pdf.js";
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
function fmtShiftDuration(event) {
  if (event.is_full_shift) return "Full shift";
  const start=String(event.start_time||"").slice(0,5),end=String(event.end_time||"").slice(0,5);
  const mins=v=>{const p=v.split(":").map(Number);return p.length===2&&p.every(Number.isFinite)?p[0]*60+p[1]:null};
  const a=mins(start),b=mins(end),hours=a===null||b===null?null:((b-a+1440)%1440)/60;
  return start+"–"+end+(hours===null?"":" ("+hours.toFixed(1)+" hrs)");
}
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
  const header = () => {ensure(78);page.drawRectangle({x:margin,y:y-58,width:contentW,height:58,borderWidth:1,borderColor:rgb(.78,.82,.87),color:rgb(1,1,1)});page.drawCircle({x:margin+30,y:y-29,size:22,borderWidth:2,borderColor:red,color:rgb(1,1,1)});page.drawText("JFD",{x:margin+19,y:y-33,size:8,font:bold,color:red});page.drawText("JASPER FIRE DEPARTMENT",{x:margin+64,y:y-21,size:15,font:bold,color:rgb(.12,.16,.22)});page.drawText("10 18th Street East · Jasper, Alabama 35501 · 205-221-8509",{x:margin+64,y:y-35,size:7.5,font:regular,color:gray});page.drawText(title,{x:margin+64,y:y-50,size:10,font:bold,color:red});y-=72;};
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

async function makeIncidentPdf(incident) {
  const reports=Array.isArray(incident?.reports)?incident.reports:[];
  return makePdf(incident,reports);
}

async function makeStaffingPdf(date, rows, assignments, events, people, stations, apparatus) {
  const sections=[];
  const personName=id=>{const p=(people||[]).find(x=>Number(x.id)===Number(id));return p?[p.first_name,p.last_name].filter(Boolean).join(" "):"Unknown employee"};
  const stationName=id=>(stations||[]).find(x=>Number(x.station_id)===Number(id))?.station_name||("Station "+id);
  const apparatusName=id=>(apparatus||[]).find(x=>Number(x.apparatus_id)===Number(id))?.unit_number||("Apparatus "+id);
  const personnelSeen=new Set();
  let swapCount=0;
  const leaveCounts={sick:0,vacation:0,kelly_day:0,other:0};
  for(const r of rows||[]){
    const section={title:(r.shift||"SHIFT")+" SHIFT • "+date,rows:[]};
    section.rows.push(["Shift",r.shift],["Record",r.staffing_id],["Created",fmtDateTime(r.created_at)]);
    const apps=(assignments||[]).filter(a=>Number(a.staffing_id)===Number(r.staffing_id));
    const stationIds=[...new Set(apps.map(a=>Number(a.station_id)))].sort((a,b)=>a-b);
    for(const stationId of stationIds){
      const stationApps=apps.filter(a=>Number(a.station_id)===stationId);
      section.rows.push(["",stationName(stationId)]);
      for(const a of stationApps){
        const crew=a.daily_personnel_assignments||[];
        const roleOrder={driver:0,officer:1,firefighter:2};
        crew.sort((x,y)=>(roleOrder[x.assignment_role]??9)-(roleOrder[y.assignment_role]??9));
        const crewText=crew.map(p=>{
          personnelSeen.add(Number(p.personnel_id));
          const role=String(p.assignment_role||"crew").replace(/^./,s=>s.toUpperCase());
          return role+": "+(p.personnel?.first_name||"")+" "+(p.personnel?.last_name||"");
        }).join(" | ");
        section.rows.push([apparatusName(a.apparatus_id),crewText||"No personnel assigned"]);
      }
    }
    if(!apps.length)section.rows.push(["Apparatus assignments","No station/apparatus assignments saved."]);
    const shiftEvents=(events||[]).filter(e=>Number(e.staffing_id)===Number(r.staffing_id));
    section.rows.push(["PERSONNEL CHANGES & LEAVE",""]);
    for(const e of shiftEvents){
      if(e.event_type==="swap")swapCount++;else leaveCounts[e.leave_type]=(leaveCounts[e.leave_type]||0)+1;
      const person=personName(e.personnel_id);
      const replacement=e.replacement_personnel_id?personName(e.replacement_personnel_id):"";
      const kind=e.event_type==="swap"?"PERSONNEL SWAP":String(e.leave_type||"leave").replace(/_/g," ").toUpperCase();
      const duration=fmtShiftDuration(e);
      const location=[e.station_id?stationName(e.station_id):"",e.apparatus_id?apparatusName(e.apparatus_id):""].filter(Boolean).join(" / ");
      const details=[person,replacement?("Replacement: "+replacement):"",location,duration,e.notes||""].filter(Boolean).join(" | ");
      section.rows.push([kind,details]);
    }
    if(!shiftEvents.length)section.rows.push(["Personnel changes","No swaps or leave entries recorded."]);
    sections.push(section);
  }
  const summaryRows=[
    ["Assigned personnel (unique)",String(personnelSeen.size)],
    ["Personnel swaps",String(swapCount)],
    ["Sick leave",String(leaveCounts.sick)],
    ["Vacation leave",String(leaveCounts.vacation)],
    ["Kelly Days",String(leaveCounts.kelly_day)],
    ["Other leave",String(leaveCounts.other)]
  ];
  sections.unshift({title:"SHIFT STAFFING SUMMARY • "+date,rows:summaryRows});
  if(!rows?.length)sections.unshift({title:"SHIFT STAFFING • "+date,rows:[["Result","No daily staffing record was recorded for this shift."]]});
  return makeTablePdf("DAILY STAFFING REPORT",sections);
}

async function makeChecksPdf(date, rows) {
  const sections=[{title:"APPARATUS CHECKS • "+date,rows:[]}];
  for(const r of rows||[]){
    sections[0].rows.push(
      ["Apparatus",r.apparatus_name||r.apparatus_id],["Performed By",r.inspector_name||r.performed_by],
      ["Check Date",r.check_date],["Check Time",r.check_time],["Status",r.status],
      ["Problems",r.problem_count],["Notes",r.notes],["Checklist",r.checklist?JSON.stringify(r.checklist):""]
    );
  }
  if(!rows?.length) sections[0].rows.push(["Result","No apparatus checks were recorded for this shift."]);
  return makeTablePdf("APPARATUS CHECKS REPORT",sections);
}

async function makeTrainingPdf(records) {
  const sections=(records||[]).map(r=>{
    const attendees=(r.training_attendees||[]).map(a=>{
      const name=[a.personnel?.first_name,a.personnel?.last_name].filter(Boolean).join(" ")||"Personnel";
      return name+" ("+Number(a.hours||0).toFixed(2)+" hrs)";
    }).join(", ");
    return {
      title:(r.shift?r.shift+" SHIFT":"TRAINING EVENT")+" • "+fmtDate(r.training_date),
      rows:[
        ["Training Type",r.record_type==="daily"?"Scheduled Daily Training":"Additional Training Event"],
        ["Subject",r.subject],["Lesson / Course",r.lesson||r.category||""],
        ["Time",String(r.start_time||"").slice(0,5)+" – "+String(r.end_time||"").slice(0,5)],
        ["Location",r.location||""],["Instructor",r.instructor||""],
        ["Training Details",r.description||""],["Additional Notes",r.notes||""],
        ["Personnel Attending",attendees],["Officer Sign-off",r.signed_by_name||""],
        ["Signed At",fmtDateTime(r.signed_at)]
      ]
    };
  });
  return makeTablePdf("DAILY TRAINING REPORTS",sections.length?sections:[{title:"TRAINING",rows:[["Status","No completed training reports were submitted for this shift."]]}]);
}

async function makeStandaloneReportPdf(incident, report) {
  const synthetic={...incident, reports:[report]};
  return makeIncidentPdf(synthetic);
}

async function sendEmail(attachments,shiftStart,shiftEnd,incidentCount,reportCount,activitySummary,trainingCount=0) {
  const key=process.env.BREVO_API_KEY,from=process.env.BREVO_FROM_EMAIL;
  if(!key||!from) throw new Error("Brevo email is not configured. Add BREVO_API_KEY and BREVO_FROM_EMAIL in Vercel.");
  const payload={
    sender:{email:from,name:"Jasper Fire Department"},
    to:[{email:"firechief@jaspercity.com"}],
    subject:"Jasper Fire Department - Daily Shift Reports - "+shiftStart+" to "+shiftEnd,
    textContent:"Daily shift package for "+shiftStart+" through "+shiftEnd+"\\n\\n"+activitySummary+"\\n\\nIncidents: "+incidentCount+"\\nSubmitted reports: "+reportCount+"\\nTraining reports: "+trainingCount+"\\nAttachments: "+attachments.length,
    attachment:attachments.map(a=>({content:a.content,name:a.filename}))
  };
  const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error("Brevo delivery failed: "+await r.text());
}

export default async function handler(req,res) {
  if(req.method!=="GET"&&req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const testMva=req.query?.test==="mva-22608-jfd";
  if(process.env.CRON_SECRET && !testMva && (req.headers.authorization||"")!=="Bearer "+process.env.CRON_SECRET) return res.status(401).json({error:"Unauthorized"});
  if(testMva && (req.query?.cad||"")!=="2026-22608") return res.status(400).json({error:"Invalid test request"});
  try {
    if(!testMva && process.env.RMS_EMAILS_ENABLED!=="true") return res.status(200).json({ok:true,skipped:true,reason:"Automatic RMS emails are disabled until the department authorizes go-live."});
    const now=new Date();
    if(!testMva && chicagoHour(now)!==9) return res.status(200).json({ok:true,skipped:true,reason:"Outside 9 AM America/Chicago delivery window."});
    if(!SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel.");
    const shiftEnd=chicagoDate(now),shiftStart=previousDate(shiftEnd);
    const startUtc=zoned7amUtc(shiftStart).toISOString(),endUtc=zoned7amUtc(shiftEnd).toISOString();
    const staffing=await supa("daily_staffing?select=*&staffing_date=eq."+shiftStart+"&order=shift");
    const staffingIds=(staffing||[]).map(x=>x.staffing_id).filter(Boolean);
    const staffingFilter=staffingIds.length?"&staffing_id=in.("+staffingIds.join(",")+")":"";
    const [staffAssignments,staffEvents,staffPeople,staffStations,staffApparatus]=staffingIds.length?await Promise.all([
      supa("daily_app_assignments?select=staffing_id,station_id,apparatus_id,daily_personnel_assignments(assignment_role,personnel_id,personnel(first_name,last_name))"+staffingFilter),
      supa("daily_staffing_events?select=*"+staffingFilter+"&order=created_at"),
      supa("personnel?select=id,first_name,last_name"),
      supa("stations?select=station_id,station_name"),
      supa("apparatus?select=apparatus_id,unit_number")
    ]):[[],[],[],[],[]];
    const checks=await supa("apparatus_checks?select=*&check_date=eq."+shiftStart+"&order=apparatus_id,check_time");
    const training=await supa("training_records?select=*,training_attendees(hours,personnel(first_name,last_name))&training_date=eq."+shiftStart+"&conducted=eq.true&order=shift");
    const incidents=await supa("incidents?select=*&dispatch_time=gte."+encodeURIComponent(startUtc)+"&dispatch_time=lt."+encodeURIComponent(endUtc)+"&order=dispatch_time");
    const standalone=await supa("standalone_reports?select=*&created_at=gte."+encodeURIComponent(startUtc)+"&created_at=lt."+encodeURIComponent(endUtc)+"&order=created_at");
    const [hydrantInspections,hydrantFlowTests,preplans,activityPersonnel]=await Promise.all([
      supa("hydrant_inspections?select=hydrant_id,inspected_at,inspector,created_by,created_at&created_at=gte."+encodeURIComponent(startUtc)+"&created_at=lt."+encodeURIComponent(endUtc)+"&order=created_at"),
      supa("hydrant_flow_tests?select=hydrant_id,test_hydrant_id,flow_hydrant_id,tested_at,tester,created_by,created_at,static_pressure,residual_pressure,calculated_flow_gpm,rate_gpm&created_at=gte."+encodeURIComponent(startUtc)+"&created_at=lt."+encodeURIComponent(endUtc)+"&order=created_at"),
      supa("preincident_plans?select=id,title,address,property_name,created_at,updated_at,created_by,updated_by"),
      supa("personnel?select=id,first_name,last_name,auth_user_id")
    ]);
    const peopleByAuth=new Map((activityPersonnel||[]).filter(p=>p.auth_user_id).map(p=>[String(p.auth_user_id),[p.first_name,p.last_name].filter(Boolean).join(" ")]));
    const withinShift=value=>!!value&&String(value)>=startUtc&&String(value)<endUtc;
    const preplanActivity=[];
    for(const p of preplans||[]){
      if(withinShift(p.created_at))preplanActivity.push({plan:p,action:"Created",at:p.created_at,person:peopleByAuth.get(String(p.created_by))||""});
      else if(withinShift(p.updated_at)&&String(p.updated_at)>String(p.created_at||""))preplanActivity.push({plan:p,action:"Updated",at:p.updated_at,person:peopleByAuth.get(String(p.updated_by))||""});
    }
    const activityLines=[
      "HYDRANTS INSPECTED",
      ...(hydrantInspections||[]).length?(hydrantInspections||[]).map(x=>"- "+x.hydrant_id+" | "+(x.inspected_at||"")+" | "+(x.inspector||peopleByAuth.get(String(x.created_by))||"Personnel not recorded")+" | "+fmtDateTime(x.created_at)):["- None recorded"],
      "",
      "HYDRANTS FLOW-TESTED",
      ...(hydrantFlowTests||[]).length?(hydrantFlowTests||[]).map(x=>"- "+(x.test_hydrant_id||x.hydrant_id||"Hydrant not recorded")+" | Flow hydrant: "+(x.flow_hydrant_id||"Not recorded")+" | "+(x.tested_at||"")+" | "+(x.tester||peopleByAuth.get(String(x.created_by))||"Personnel not recorded")+" | "+([x.rate_gpm||x.calculated_flow_gpm?((x.rate_gpm||x.calculated_flow_gpm)+" GPM"):"",x.static_pressure?"Static "+x.static_pressure:"",x.residual_pressure?"Residual "+x.residual_pressure:""].filter(Boolean).join(", "))):["- None recorded"],
      "",
      "PREPLANS CREATED / UPDATED",
      ...preplanActivity.length?preplanActivity.map(x=>"- "+(x.plan.property_name||x.plan.title||"Property")+" | "+(x.plan.address||"Address not recorded")+" | "+x.action+" | "+(x.person||"Personnel not recorded")+" | "+fmtDateTime(x.at)):["- None recorded"]
    ];
    const activitySummary=activityLines.join("\\n");
    const attachments=[];
    const staffingPdf=await makeStaffingPdf(shiftStart,staffing||[],staffAssignments||[],staffEvents||[],staffPeople||[],staffStations||[],staffApparatus||[]);
    attachments.push({content:Buffer.from(staffingPdf).toString("base64"),filename:"01 - Daily Staffing Report.pdf"});
    const checksPdf=await makeChecksPdf(shiftStart,checks||[]);
    attachments.push({content:Buffer.from(checksPdf).toString("base64"),filename:"02 - Apparatus Checks.pdf"});
    let reportCount=0,attachmentNumber=3;
    if((training||[]).length){
      const trainingPdf=await makeTrainingPdf(training);
      attachments.push({content:Buffer.from(trainingPdf).toString("base64"),filename:"03 - Training Reports.pdf"});
      attachmentNumber=4;
    }
    for(const incident of incidents||[]){
      const reports=Array.isArray(incident.reports)?incident.reports:[];
      if(!reports.length) continue;
      const pdf=await makeIncidentPdf(incident);
      attachments.push({
        content:Buffer.from(pdf).toString("base64"),
        filename:String(attachmentNumber++).padStart(2,"0")+" - "+clean(incident.cad||incident.cad_number||"Incident")+" - Incident Report.pdf"
      });
      reportCount+=reports.length;
    }
    for(const report of standalone||[]){
      const pdf=await makeStandaloneReportPdf({},report);
      const label=String(report?.report_type||"report").startsWith("pcr_")?"PCR":"Fire Report";
      attachments.push({content:Buffer.from(pdf).toString("base64"),filename:String(attachmentNumber++).padStart(2,"0")+" - Standalone - "+label+".pdf"});
      reportCount++;
    }
    await sendEmail(attachments,shiftStart,shiftEnd,(incidents||[]).length,reportCount,activitySummary,(training||[]).length);
    return res.status(200).json({ok:true,shift_start:shiftStart,shift_end:shiftEnd,incidents:(incidents||[]).length,reports:reportCount,training_reports:(training||[]).length,attachments:attachments.length});
  } catch(e) {
    console.error("Daily report email error",e);
    return res.status(500).json({ok:false,error:e?.message||"Daily report email failed."});
  }
}
