import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supa(path, opts = {}) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...opts,
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_KEY, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) }
  }).then(async r => {
    const raw = await r.text(); let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!r.ok) throw new Error(data?.message || data?.hint || data?.details || String(data || "Supabase request failed"));
    return data;
  });
}
function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);
  return Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
}
function chicagoDate(date=new Date()){const p=localParts(date);return p.year+"-"+p.month+"-"+p.day;}
function chicagoHour(date=new Date()){return Number(localParts(date).hour);}
function previousDate(iso){const d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function zoned7amUtc(isoDate){
  const naive=new Date(isoDate+"T07:00:00Z");
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(naive);
  const v=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)]));
  const asUtc=Date.UTC(v.year,v.month-1,v.day,v.hour,v.minute,v.second);
  const offsetMs=asUtc-naive.getTime();
  const desired=Date.UTC(Number(isoDate.slice(0,4)),Number(isoDate.slice(5,7))-1,Number(isoDate.slice(8,10)),7,0,0);
  return new Date(desired-offsetMs);
}
function fmtDate(iso){if(!iso)return "";return new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",month:"2-digit",day:"2-digit",year:"numeric"}).format(new Date(iso));}
function fmtDateTime(iso){if(!iso)return "";return new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",month:"2-digit",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso));}
function clean(v){return String(v??"").replace(/\s+/g," ").trim();}

async function makePdf(title,sections){
  const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=612,H=792,margin=40,contentW=W-margin*2;let page=pdf.addPage([W,H]),y=H-margin;const red=rgb(.78,.05,.05),gray=rgb(.35,.39,.45);
  function ensure(h=18){if(y-h<margin){page=pdf.addPage([W,H]);y=H-margin;return true}return false}
  function wrap(t,size=9,font=regular){const words=clean(t).split(/\s+/).filter(Boolean),lines=[];let line="";for(const w of words){const test=line?line+" "+w:w;if(font.widthOfTextAtSize(test,size)<=contentW)line=test;else{if(line)lines.push(line);line=w}}if(line)lines.push(line);return lines}
  function heading(t){ensure(30);page.drawText(clean(t),{x:margin,y,size:12,font:bold,color:red});y-=17;page.drawLine({start:{x:margin,y},end:{x:W-margin,y},thickness:1,color:rgb(.85,.87,.9)});y-=10}
  page.drawText("JASPER FIRE DEPARTMENT",{x:margin,y,size:16,font:bold,color:red});y-=22;
  page.drawText(title,{x:margin,y,size:11,font:bold});y-=22;
  for(const section of sections){heading(section.title);for(const row of section.rows){const label=clean(row[0]),value=clean(row[1]);if(!value)continue;const lines=wrap(value,9,regular);ensure(Math.max(16,14*lines.length));page.drawText(label,{x:margin,y,size:8,font:bold,color:gray});page.drawText(lines[0]||"",{x:margin+120,y,size:9,font:regular});y-=14;for(const more of lines.slice(1)){ensure(14);page.drawText(more,{x:margin+120,y,size:9,font:regular});y-=12}}}
  const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText("Jasper Fire Department • "+title+" • Page "+(i+1)+" of "+pages.length,{x:margin,y:18,size:7,font:regular,color:gray}));
  return pdf.save();
}
function reportRows(incident,detail,report){
  const rows=[
    ["Incident Number",incident.cad],["Incident Date",fmtDate(incident.dispatch_time)],["Call Type",report.rCall||detail?.call_type||incident.type],["Station",report.rStation],["Officer in Charge",report.rOfficer],["Shift",report.rShift],
    ["Dispatch Time",report.rDispatch?fmtDateTime(report.rDispatch):fmtDateTime(incident.dispatch_time)],["First Unit En Route",report.rEnroute?fmtDateTime(report.rEnroute):""],["First Unit On Scene",report.rOnscene?fmtDateTime(report.rOnscene):""],["Last Unit Cleared",report.rCleared?fmtDateTime(report.rCleared):fmtDateTime(detail?.clear_time)],
    ["Location",report.rLocation||incident.location],["Location Type",report.rLocationType],["Units Responding",report.rUnits],["Actions Taken",report.rActions||detail?.actions_taken],["Narrative",report.rNarrative||detail?.narrative]
  ];
  if(report.report_type==="pcr_neris_v2") rows.push(
    ["Patient Evaluation",report.pEvaluation],["Patient Status",report.pStatus],["Transported By",report.pTransport],["Patient Name",report.pName],["DOB",report.pDob],["Gender",report.pGender],["Patient Address",report.pAddress],
    ["Medical History",report.pHistory],["Medications",report.pMeds],["Known Allergies",report.pAllergies],["Chief Complaint",report.pChief],["Injury",report.pInjury],["Vitals Log",report.pVitals],
    ["Vehicle",report.pvVehicle],["Make / Model / Year",[report.pvMake,report.pvModel,report.pvYear].filter(Boolean).join(" / ")],["License / VIN",report.pvVin],["Insurance Company",report.pvInsurance],["Policy Number",report.pvPolicy],
    ["Equipment Used / Replaced",report.pEquipment],["Comments",report.pComments]
  ); else rows.push(
    ["Investigation Required",report.rInvestigation],["Fire Location",report.rFireLoc],["Floor of Origin",report.rFloor],["Water Supply",report.rWater],["Condition",report.rCondition],["Damage Type",report.rDamageType],
    ["Room Type",report.rRoom],["Cause",report.rCause||detail?.cause],["Wildfire Acres Burned",report.rAcres],["Alarms / Systems",report.rAlarm],["Exposure Displacement Count",report.rExposureDisplaced],
    ["Exposure Cause",report.rExposureCause],["Exposure Damage Type",report.rExposureDamage],["Exposure Type",report.rExposureType],["Casualty",report.rCasualtyClass],["Casualty DOB",report.rCasualtyDob],["Casualty Gender",report.rCasualtyGender],
    ["Casualty Status",report.rCasualtyStatus],["Rescue Type",report.rRescueType],["Evacuation Count",report.rEvac],["HAZMAT Disposition",report.rHazmat],["Chemicals",report.rChemicals],["Electrical Hazard",report.rElectrical],["Other Hazard",report.rOtherHazard],
    ["Vehicle #1",report.rVehicle1],["Vehicle Make / Model / Year",[report.rMake1,report.rModel1,report.rYear1].filter(Boolean).join(" / ")],["License / VIN",report.rVin1],["Occupant",report.rOccName],["Occupant Phone",report.rOccPhone],
    ["Occupant Insurance",report.rOccInsurance],["Owner",report.rOwnerName],["Owner Phone",report.rOwnerPhone],["Owner Insurance",report.rOwnerInsurance]
  );
  rows.push(["Report Completed By",report.rCompletedBy],["Report Submitted",report.submitted_at?fmtDateTime(report.submitted_at):""]);
  return rows;
}
async function makeIncidentPdf(incident,detail,report){
  const title=report.report_type==="pcr_neris_v2"?"PATIENT CARE REPORT (PCR NERIS v2)":"FIRE INCIDENT REPORT (NERIS v2)";
  const rows=reportRows(incident,detail,report);
  return makePdf(title,[{title:"INCIDENT INFORMATION",rows:rows.slice(0,15)},{title:"REPORT DETAILS",rows:rows.slice(15)}]);
}
async function makeStaffingPdf(shiftStart,shiftEnd,staffing,assignments){
  const rows=[
    ["Reporting Period",fmtDate(shiftStart+"T12:00:00")+" 7:00 AM – "+fmtDate(shiftEnd+"T12:00:00")+" 7:00 AM"],
    ["Staffing Record Date",fmtDate(shiftStart+"T12:00:00")],["Staffing Record ID",staffing?.staffing_id]
  ];
  for(const a of assignments){
    const app=a.apparatus?.[0]||a.apparatus||{},station=a.stations?.[0]||a.stations||{};
    const crew=(a.daily_personnel_assignments||[]).map(x=>{const p=x.personnel?.[0]||x.personnel||{};return (p.first_name||"")+" "+(p.last_name||"")+" ("+x.assignment_role+")"}).join(", ");
    rows.push([String(station.station_name||"Station")+" • "+String(app.unit_number||"Apparatus"),crew||"No crew assigned"]);
  }
  return makePdf("DAILY STAFFING RECORD",[{title:"SHIFT STAFFING",rows}]);
}
async function sendEmail(attachments,shiftStart,shiftEnd,incidentCount,reportCount){
  const key=process.env.SENDGRID_API_KEY,from=process.env.SENDGRID_FROM_EMAIL;
  if(!key||!from)throw new Error("Daily report email is not configured. Add SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in Vercel.");
  const body=["Jasper Fire Department","","Daily Shift Reports","Reporting Period: "+fmtDate(shiftStart+"T12:00:00")+" 7:00 AM – "+fmtDate(shiftEnd+"T12:00:00")+" 7:00 AM","Incidents: "+incidentCount,"Reports: "+reportCount,"","The attached packet contains the final daily staffing record and each submitted incident report as a separate PDF."].join("\n");
  const payload={personalizations:[{to:[{email:"firechief@jaspercity.com"},{email:"fireclerk@jaspercity.com"}]}],from:{email:from,name:"Jasper Fire Department"},subject:"Jasper Fire Department – Daily Shift Reports – "+shiftStart+"–"+shiftEnd,content:[{type:"text/plain",value:body}],attachments};
  const r=await fetch("https://api.sendgrid.com/v3/mail/send",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error("SendGrid delivery failed: "+await r.text());
}
export default async function handler(req,res){
  if(req.method!=="GET"&&req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  if(process.env.CRON_SECRET){const auth=req.headers.authorization||"";if(auth!=="Bearer "+process.env.CRON_SECRET)return res.status(401).json({error:"Unauthorized"})}
  try{
    const now=new Date(),hour=chicagoHour(now);
    if(hour!==9)return res.status(200).json({ok:true,skipped:true,reason:"Outside 9 AM America/Chicago delivery window."});
    if(!SUPABASE_SERVICE_KEY)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel.");
    const shiftEnd=chicagoDate(now),shiftStart=previousDate(shiftEnd),startUtc=zoned7amUtc(shiftStart).toISOString(),endUtc=zoned7amUtc(shiftEnd).toISOString();
    const existing=await supa("daily_report_email_runs?select=run_id,status,sent_at&shift_start=eq."+shiftStart+"&shift_end=eq."+shiftEnd+"&limit=1");
    if(existing?.[0]?.status==="sent")return res.status(200).json({ok:true,already_sent:true,run_id:existing[0].run_id});
    const staffingRows=await supa("daily_staffing?select=*&staffing_date=eq."+shiftStart+"&shift=eq.daily&limit=1"),staffing=staffingRows?.[0]||null;
    let assignments=[];if(staffing)assignments=await supa("daily_app_assignments?select=assignment_id,station_id,apparatus_id,stations(station_name),apparatus(unit_number,apparatus_type),daily_personnel_assignments(assignment_role,personnel(first_name,last_name,role,shift))&staffing_id=eq."+staffing.staffing_id+"&order=station_id,apparatus_id");
    const incidents=await supa("incidents?select=incident_id,cad,type,location,dispatch_time,reports,incident_details(*),incident_units(unit_number_snapshot,station_snapshot,crew_snapshot)&dispatch_time=gte."+encodeURIComponent(startUtc)+"&dispatch_time=lt."+encodeURIComponent(endUtc)+"&order=dispatch_time");
    const attachments=[];
    const staffingPdf=await makeStaffingPdf(shiftStart,shiftEnd,staffing,assignments);
    attachments.push({content:Buffer.from(staffingPdf).toString("base64"),type:"application/pdf",filename:"Jasper-Fire-Daily-Staffing-"+shiftStart+".pdf",disposition:"attachment"});
    let reportCount=0;
    for(const incident of incidents||[]){
      const detail=Array.isArray(incident.incident_details)?incident.incident_details[0]:incident.incident_details,reports=Array.isArray(incident.reports)?incident.reports:[];
      for(const report of reports){
        if(report.status&&report.status!=="submitted")continue;
        const pdf=await makeIncidentPdf(incident,detail,report),suffix=report.report_type==="pcr_neris_v2"?"PCR":"Fire-Incident";
        attachments.push({content:Buffer.from(pdf).toString("base64"),type:"application/pdf",filename:incident.cad+"_"+suffix+"_"+report.report_id+".pdf",disposition:"attachment"});reportCount++;
      }
    }
    if(attachments.length>20)throw new Error("Daily report packet has more than 20 PDF attachments; split delivery is required.");
    let run=(await supa("daily_report_email_runs?select=run_id&shift_start=eq."+shiftStart+"&shift_end=eq."+shiftEnd+"&limit=1"))?.[0];
    const meta={status:"sending",incident_count:(incidents||[]).length,report_count:reportCount,attachment_count:attachments.length,error_message:null};
    if(run)await supa("daily_report_email_runs?run_id=eq."+run.run_id,{method:"PATCH",body:JSON.stringify(meta)});else{await supa("daily_report_email_runs",{method:"POST",body:JSON.stringify({shift_start:shiftStart,shift_end:shiftEnd,...meta})});}
    try{
      await sendEmail(attachments,shiftStart,shiftEnd,(incidents||[]).length,reportCount);
      run=(await supa("daily_report_email_runs?select=run_id&shift_start=eq."+shiftStart+"&shift_end=eq."+shiftEnd+"&limit=1"))?.[0];
      if(run)await supa("daily_report_email_runs?run_id=eq."+run.run_id,{method:"PATCH",body:JSON.stringify({status:"sent",sent_at:new Date().toISOString(),incident_count:(incidents||[]).length,report_count:reportCount,attachment_count:attachments.length})});
    }catch(e){
      run=(await supa("daily_report_email_runs?select=run_id&shift_start=eq."+shiftStart+"&shift_end=eq."+shiftEnd+"&limit=1"))?.[0];
      if(run)await supa("daily_report_email_runs?run_id=eq."+run.run_id,{method:"PATCH",body:JSON.stringify({status:"failed",error_message:e.message})});
      throw e;
    }
    return res.status(200).json({ok:true,shift_start:shiftStart,shift_end:shiftEnd,incidents:(incidents||[]).length,reports:reportCount,attachments:attachments.length});
  }catch(e){console.error("Daily report email error",e);return res.status(500).json({error:e.message||"Daily report email failed."})}
}
