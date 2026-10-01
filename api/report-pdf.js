import { PDFDocument, StandardFonts, rgb } from "pdf-lib";


const SUPABASE_URL="https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
async function requireAdmin(req){
 const auth=req.headers.authorization||"";if(!auth.startsWith("Bearer "))throw new Error("Authentication required.");
 const ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!ur.ok)throw new Error("Invalid or expired session.");
 const u=await ur.json();const pr=await fetch(SUPABASE_URL+"/rest/v1/users?select=app_role,active&user_id=eq."+encodeURIComponent(u.id),{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!pr.ok)throw new Error("Unable to verify RMS permissions.");
 const rows=await pr.json();if(rows?.[0]?.active!==true||rows?.[0]?.app_role!=="admin")throw new Error("Administrator access required for PDF reports.");return u;
}

const t=v=>String(v??"").replace(/\s+/g," ").trim();
const val=v=>t(v)||"—";
const JFD_TIME_ZONE="America/Chicago";
const centralWallIso=v=>{const s=String(v??"").trim();if(!s)return "";if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s;const m=s.match(/^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/);if(!m)return "";const target=Date.UTC(Number(m[1].slice(0,4)),Number(m[1].slice(5,7))-1,Number(m[1].slice(8,10)),Number(m[2]),Number(m[3]),Number(m[4]||0));const parts=d=>{const x=new Intl.DateTimeFormat("en-US",{timeZone:JFD_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(d));const o={};x.forEach(p=>{if(p.type!=="literal")o[p.type]=p.value});return o};let guess=target;for(let i=0;i<3;i++){const p=parts(guess),shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);guess+=target-shown}return new Date(guess).toISOString()};
const centralDateParts=v=>{if(!v)return null;const s=String(v).trim();const wall=s.match(/^(\\d{4}-\\d{2}-\\d{2})(?:T\\d{2}:\\d{2}(?::\\d{2})?)?$/);if(wall){const p=wall[1].split("-");return {year:p[0],month:p[1],day:p[2]}}const d=new Date(s);if(Number.isNaN(d.getTime()))return null;const parts=new Intl.DateTimeFormat("en-US",{timeZone:JFD_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),o={};parts.forEach(p=>{if(p.type!=="literal")o[p.type]=p.value});return o};
const centralTimeParts=v=>{if(!v)return null;const s=String(v).trim();const wall=s.match(/^\\d{4}-\\d{2}-\\d{2}T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/);if(wall)return {hour:wall[1],minute:wall[2]};const d=new Date(s);if(Number.isNaN(d.getTime()))return null;const parts=new Intl.DateTimeFormat("en-US",{timeZone:JFD_TIME_ZONE,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d),o={};parts.forEach(p=>{if(p.type!=="literal")o[p.type]=p.value});return o};
const date=v=>{const p=centralDateParts(v);return p?p.month+"/"+p.day+"/"+p.year:String(v??"")};
const time=v=>{const p=centralTimeParts(v);return p?p.hour+":"+p.minute:String(v??"")};

export async function makePdf(incident={},reports=[]){
 const pdf=await PDFDocument.create();
 const reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const F={reg,bold},W=612,H=792,m=42,usable=W-2*m;
 let page,y;
 const newPage=()=>{page=pdf.addPage([W,H]);y=H-m};
 const need=n=>{if(y<58+n)newPage()};
 const wrap=(s,size=8,lh=11,b=false)=>{const font=b?F.bold:F.reg,words=String(s??"").split(/\s+/),w=usable;let line="";for(const word of words){const next=line?line+" "+word:word;if(font.widthOfTextAtSize(next,size)>w&&line){page.drawText(line,{x:m,y,font,size,color:rgb(.1,.15,.2)});y-=lh;line=word}else line=next}if(line){page.drawText(line,{x:m,y,font,size,color:rgb(.1,.15,.2)});y-=lh}};
 const heading=s=>{need(34);page.drawText(s,{x:m,y,font:F.bold,size:11,color:rgb(.12,.18,.25)});y-=16};
 const line=(label,v)=>{need(20);page.drawText(String(label),{x:m,y,font:F.bold,size:8,color:rgb(.12,.18,.25)});wrap(val(v),8,10,false)};
 const kv=(label,v)=>line(label,v);
 const top=(title,subtitle="")=>{newPage();page.drawRectangle({x:m,y:y-57,width:usable,height:57,borderWidth:1,borderColor:rgb(.78,.82,.87),color:rgb(1,1,1)});page.drawCircle({x:m+31,y:y-28,size:23,borderWidth:2,borderColor:rgb(.65,.02,.02),color:rgb(1,1,1)});page.drawText("JFD",{x:m+19,y:y-32,font:F.bold,size:8,color:rgb(.65,.02,.02)});page.drawText("JASPER FIRE DEPARTMENT",{x:m+66,y:y-20,font:F.bold,size:15,color:rgb(.12,.16,.22)});page.drawText("10 18th Street East · Jasper, Alabama 35501 · 205-221-8509",{x:m+66,y:y-34,font:F.reg,size:7.5,color:rgb(.3,.35,.4)});page.drawText(title,{x:m+66,y:y-49,font:F.bold,size:10,color:rgb(.65,.02,.02)});y-=69;if(subtitle)wrap(subtitle,8,11);y-=3;};
 const fire=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("fire_"));
 const pcr=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("pcr_"));
 const fd=fire[0]?.data||{};
 const patients=pcr.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]);

 // PAGE 1: actual report-facing/basic information, not technical NERIS detail.
 top("FIRE INCIDENT REPORT","Front page of the JFD paper Fire Incident Report.");
 heading("INCIDENT INFORMATION");
 kv("CAD / Incident Number",incident.cad||fd.rCad);
 kv("Incident Date",date(fd.rDate||incident.dispatch_time));
 kv("Call Type",fd.rCall||fd.rCallType||incident.type);
 kv("Primary Incident Type",fd.rPrimaryIncidentType||incident.type);
 kv("Secondary Incident Type",fd.rSecondaryIncidentType);
 kv("Incident Location",fd.rLocation||incident.location);
 kv("Location Type",fd.rLocationType);
 kv("Shift",fd.rShift);
 heading("PERSON / PROPERTY");
 kv("Person Involved",fd.rPerson||fd.person_involved);
 kv("Owner Name",fd.rOwnerName||fd.owner_name);
 kv("Owner Address",fd.rOwnerAddress||fd.owner_address);
 kv("Owner Phone",fd.rOwnerPhone||fd.owner_phone);
 kv("Occupant Name",fd.rOccupantName||fd.rOccName||fd.occupant_name);
 kv("Occupant Address",fd.rOccupantAddress||fd.occupant_address);
 kv("Occupant Phone",fd.rOccupantPhone||fd.rOccPhone||fd.occupant_phone);
 kv("Property Use / Occupancy",fd.rPrimaryUse||fd.rOccupancy);
 kv("Location In Use",fd.rLocationInUse);
 kv("Used As Intended",fd.rUsedAsIntended);
 heading("INSURANCE / LOSS");
 kv("Insurance Company",fd.rInsuranceCompany||fd.rOwnerInsurance||fd.rOccInsurance||fd.insurance_company);
 kv("Insurance Phone",fd.rInsurancePhone||fd.insurance_phone);
 kv("Policy Number",fd.rInsurancePolicy||fd.insurance_policy);
 kv("Damage Type",fd.rDamageType||fd.damage_type);
 kv("Estimated Damage",fd.rDamageEstimate||fd.damage_estimate);
 const vehicles=Array.isArray(fd.vehicles)?fd.vehicles:[];
 if(vehicles.length){heading("VEHICLE / PROPERTY INVOLVED");vehicles.forEach((v,i)=>{kv("Vehicle #"+(i+1),[v.year,v.make,v.model,v.vehicle,v.description].filter(Boolean).join(" "));kv("Owner",v.owner);kv("Insurance",v.insurance);kv("License / VIN",v.vin||v.license||v.license_vin)})}
 else {heading("VEHICLE / PROPERTY INVOLVED");kv("Vehicle #1",fd.rVehicle1);kv("Year",fd.rYear1);kv("Make",fd.rMake1);kv("Model",fd.rModel1);kv("License / VIN",fd.rVin1)}
 heading("INCIDENT ACTION / RESPONSE");
 kv("Action Taken",fd.rActionTaken||fd.action_taken);
 kv("No Action Taken",fd.rNoActionTaken||fd.no_action_taken);
 kv("Actions / Tactics",Array.isArray(fd.actions_taken)?fd.actions_taken.join(", "):fd.rActionsTaken);
 kv("Water Supply",fd.rWater||fd.water_supply);
 kv("Investigation",fd.rInvestigation||fd.investigation);
 kv("Fire Location",fd.rFireLoc||fd.fire_location);
 kv("Floor / Room", [fd.rFloor||fd.floor_of_origin,fd.rRoom||fd.room_type].filter(Boolean).join(" / "));
 kv("Condition",fd.rCondition||fd.condition);
 kv("Cause",fd.rCause||fd.cause);
 kv("Alarms / Suppression", [fd.rFireAlarm,fd.rOtherAlarm,fd.rSuppression,fd.rCookingSuppression].filter(Boolean).join(" / "));
 kv("Exposures",Array.isArray(fd.exposures)?fd.exposures.map(x=>typeof x==="object"?JSON.stringify(x):x).join("; "):fd.exposures);
 kv("Casualties / Rescues",Array.isArray(fd.casualties)?fd.casualties.map(x=>typeof x==="object"?JSON.stringify(x):x).join("; "):fd.casualties);
 kv("Hazards / HAZMAT",Array.isArray(fd.hazards)?fd.hazards.map(x=>typeof x==="object"?JSON.stringify(x):x).join("; "):fd.hazards||fd.rHazmat);
 heading("NARRATIVE");
 wrap(fd.rNarrative||incident.narrative||"No narrative entered.",9,13);
 kv("Person Completing Report",fd.rCompletedBy||fd.completedBy||fd.report_completed_by);
 page.drawText("JFD RMS • Fire Incident Report • Page 1",{x:m,y:38,font:F.reg,size:7,color:rgb(.4,.4,.4)});

 // Technical fire record.
 for(const [idx,r] of fire.entries()){
   const d=r?.data||{};
   top("TECHNICAL INCIDENT RECORD","Department operational detail. Public/property information remains on Page 1.");
   heading("INCIDENT / LOCATION");
   ["rCad","rDate","rShift","rCall","rCallType","rPrimaryIncidentType","rSecondaryIncidentType","rLocation","rLatitude","rLongitude","rLocationType","rPrimaryUse","rSecondaryUse","rLocationInUse","rUsedAsIntended","rVacancy","rPeoplePresent"].forEach(k=>kv(k.replace(/^r/,"").replace(/([A-Z])/g," $1"),d[k]||(k==="rCad"?incident.cad:k==="rLocation"?incident.location:"")));
   heading("DISPATCH / RESPONSE");
   kv("Dispatch Incident Number",d.rDispatchIncidentNumber);
   kv("Call Arrival",d.rCallArrival);kv("Call Answered",d.rCallAnswered);kv("Call Create",d.rCallCreate);kv("Dispatch Time",d.rDispatch);
   const units=Array.isArray(d.responding_apparatus)?d.responding_apparatus:[];
   if(units.length)units.forEach(u=>{const z=u.times||{};kv("Apparatus",u.unit_number||u.unit);kv("Crew",Array.isArray(u.crew)?u.crew.map(x=>typeof x==="object"?x.name:x).join(", "):u.crew);kv("En Route",z.enroute);kv("On Scene",z.on_scene);kv("Cancelled",z.cancelled);kv("In Service",z.in_service||z.clear)});
   else kv("Responding Apparatus","None recorded");
   kv("Additional Personnel",Array.isArray(d.additional_personnel)?d.additional_personnel.join(", "):d.additional_personnel);
   heading("FIRE / INCIDENT CONDITIONS");
   ["rFireLoc","rCondition","rWater","rDamageType","rDamageEstimate","rFloor","rRoom","rCause","rAcres","rSmokePresence","rSmokeWorking","rFireAlarm","rOtherAlarm","rSuppression","rCookingSuppression"].forEach(k=>kv(k.replace(/^r/,"").replace(/([A-Z])/g," $1"),d[k]));
   heading("ACTIONS / TACTICS");
   kv("Action Taken",d.rActionTaken||d.action_taken);kv("No Action Taken",d.rNoActionTaken||d.no_action_taken);
   kv("Actions / Tactics",Array.isArray(d.actions_taken)?d.actions_taken.join(", "):d.rActionsTaken);
   heading("EXPOSURES / CASUALTIES / HAZARDS");
   for(const [label,key] of [["Exposure","exposures"],["Casualty / Rescue","casualties"],["Hazard","hazards"]]){const arr=Array.isArray(d[key])?d[key]:[];if(arr.length)arr.forEach(x=>wrap(label+": "+JSON.stringify(x),8,11,true));else kv(label+"s","None recorded")}
   heading("MUTUAL AID / OTHER AGENCIES");
   const aids=[...(Array.isArray(d.aid_records)?d.aid_records:[]),...(Array.isArray(d.nonfd_aid_records)?d.nonfd_aid_records:[])];
   if(aids.length)aids.forEach(x=>wrap(JSON.stringify(x),8,11));else kv("Aid","None recorded");
   heading("HAZMAT / SPECIAL HAZARDS");
   ["rEvac","rHazEvacuated","rHazmat","rHazDisposition","rChemicals","rChemicalName","rChemicalClass","rChemicalRelease","rElectrical","rOtherHazard"].forEach(k=>kv(k.replace(/^r/,"").replace(/([A-Z])/g," $1"),d[k]));
   heading("NARRATIVE / COMPLETION");wrap(d.rNarrative||"No narrative entered.",9,13);kv("Report Completed By",d.rCompletedBy);
 }

 // Every patient gets a separate page group. No other patient's information is placed on that group.
 for(let i=0;i<patients.length;i++){
   const p=patients[i]||{};
   top("PATIENT CARE REPORT","Patient "+(i+1)+" • Front page of the JFD paper Patient Care Report. This page group contains information for this patient only.");
   heading("PATIENT INFORMATION");
   kv("Patient Name",p.name);kv("Date of Birth",date(p.dob));kv("Age",p.age);kv("Sex",p.sex);kv("Patient Address",p.address);kv("Patient Phone",p.phone);
   kv("Incident / CAD",incident.cad||fd.rCad);kv("Incident Date",date(fd.rDate||incident.dispatch_time));kv("Incident Time",time(fd.rDateTime||fd.rDispatch||incident.dispatch_time));kv("Incident Location",fd.rLocation||incident.location);
   kv("Responding Unit",p.vehicle||p.assignedVehicle||p.unit||fd.responding_unit);
   heading("CHIEF COMPLAINT / PRESENTATION");
   kv("Chief Complaint / Reason for Response",p.chief);kv("Injury / Medical Complaint",p.injury||p.complaint);kv("Presentation / Brief Narrative",p.presentation||p.narrative);
   heading("ASSESSMENT / CARE");
   kv("Patient Care Provided",p.careProvided===true?"Yes":p.careProvided===false?"No":p.evaluation);
   const vitals=p.vitals||{};
   if(Object.keys(vitals).length)for(const [k,v] of Object.entries(vitals))if(v!==undefined&&v!==null&&v!=="")kv(k.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()),v);
   const care=Array.isArray(p.methodsOfCare)?p.methodsOfCare:Array.isArray(p.careMethods)?p.careMethods:Array.isArray(p.methods)?p.methods:[];
   if(care.length)kv("BLS Methods of Care",care.join(", "));
   kv("Oxygen",p.oxygen||p.oxygenMethod);
   kv("Medical History",p.medicalHistory||p.history);
   kv("Medications",p.medications||p.meds);
   kv("Allergies",p.allergies);
   heading("DISPOSITION");
   kv("Disposition",p.transportDisposition||p.transport||p.disposition);
   kv("Transporting Agency / Unit",p.transportAgency||p.transportUnit||p.vehicle);
   kv("Destination",p.destination);
   kv("Disposition Narrative",p.dispositionNarrative);
   kv("Vehicle / Insurance",p.vehicleInfo||p.vehicleInsurance||p.insurance);
   kv("Equipment Used / Replaced",p.equipmentUsed||p.equipmentReplaced||p.equipment);
   if(p.refusedCare||p.refusedTransport||p.minorRefusal){
     heading("REFUSAL / SIGNATURES");
     kv("Refusal Type",[p.refusedCare?"Refused Care":"",p.refusedTransport?"Refused Transport":"",""].filter(Boolean).join(", ")||"Minor refusal");
     kv("Patient / Guardian Name",p.refusalSigner);
     kv("Guardian Relationship",p.guardianRelationship);
     kv("Risks Explained / Acknowledged",p.risksExplained||p.risksAcknowledged);
     kv("Refusal Date / Time",p.refusalDateTime||p.refusalDate||p.signedAt);
     kv("Provider",p.provider||"JFD RMS user / electronic record");
     kv("Witness",p.witnessName);
     kv("Witness Signature",p.witnessSignatureText||p.witnessSignature);
     kv("Minor Patients",Array.isArray(p.minorPatients)?p.minorPatients.map(x=>x.name+" (DOB "+x.dob+")").join(", "):"");
     const sigs=[["Patient / Guardian Signature",p.signature],["Witness Signature",p.witnessSignature]];
     for(const [label,dataUrl] of sigs){if(!String(dataUrl||"").startsWith("data:image/png"))continue;try{const bytes=Buffer.from(String(dataUrl).split(",")[1],"base64");const img=await pdf.embedPng(bytes);need(105);page.drawText(label,{x:m,y,font:F.bold,size:8});y-=12;page.drawImage(img,{x:m,y:y-70,width:250,height:70});page.drawRectangle({x:m,y:y-70,width:250,height:70,borderWidth:.5,borderColor:rgb(.6,.6,.6)});y-=82}catch{}}
   }
   heading("NARRATIVE");
   wrap(p.narrative||p.comments||"No narrative entered.",9,13);
   kv("Person Completing Report",p.completedBy||p.reportCompletedBy||p.provider||"JFD RMS user / electronic record");
   page.drawText("JFD RMS • Patient Care Report • Patient "+(i+1),{x:m,y:38,font:F.reg,size:7,color:rgb(.4,.4,.4)});
 }
 if(!patients.length){top("PATIENT CARE REPORT","No patient records were attached to this incident.");kv("Patient Records","None recorded");}

 // NERIS investigation is always the final section.
 top("NERIS INVESTIGATION DETAILS","Final technical section. This section is kept separate from the public/basic front-page information.");
 for(const r of fire){
   const d=r?.data||{};
   heading("INVESTIGATION");
   [["Investigation Required",d.rInvestigation],["Investigation Type",d.rInvestigationType],["Cause",d.rCause||d.cause],["Origin Floor",d.rFloor||d.floor_of_origin],["Origin Room / Area",d.rRoom||d.room_type],["Arrival Condition",d.rCondition||d.condition],["Damage Type",d.rDamageType||d.damage_type],["Damage Estimate",d.rDamageEstimate||d.damage_estimate],["Fire Location",d.rFireLoc||d.fire_location],["Water Supply",d.rWater||d.water_supply],["Smoke Alarm Presence",d.rSmokePresence||d.smoke_alarm_presence],["Smoke Alarm Working",d.rSmokeWorking||d.smoke_alarm_working],["Fire Alarm",d.rFireAlarm||d.fire_alarm],["Other Alarm",d.rOtherAlarm||d.other_alarm],["Suppression System",d.rSuppression||d.suppression_system],["Cooking Fire Suppression",d.rCookingSuppression||d.cooking_suppression]].forEach(([k,v])=>kv(k,v));
   const n=d.neris_investigation||d.nerisInvestigation||d.investigation_details||d.neris?.investigation;
   if(n&&typeof n==="object"){heading("NERIS INVESTIGATION RECORD");for(const [k,v] of Object.entries(n)){if(v===undefined||v===null||v==="")continue;wrap(k.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase())+": "+(typeof v==="object"?JSON.stringify(v):v),8,11,true)}}
 }
 if(!fire.length)kv("NERIS Investigation","No Fire Incident Report investigation data attached.");
 page.drawText("JFD RMS • NERIS Investigation Details • Final Section",{x:m,y:38,font:F.reg,size:7,color:rgb(.4,.4,.4)});
 return pdf.save();
}

async function makeArchivePdf(kind,data){
 const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,m=42,usable=W-2*m;let page,y;const F={reg,bold};const newPage=()=>{page=pdf.addPage([W,H]);y=H-m};const wrap=(s,size=9,lh=13,b=false)=>{const font=b?F.bold:F.reg;let line="";for(const word of String(s??"").split(/\s+/)){const n=line?line+" "+word:word;if(font.widthOfTextAtSize(n,size)>usable&&line){page.drawText(line,{x:m,y,font,size});y-=lh;line=word}else line=n}if(line){page.drawText(line,{x:m,y,font,size});y-=lh}};const top=title=>{newPage();page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:F.bold,size:16,color:rgb(.12,.16,.22)});y-=20;page.drawText(title,{x:m,y,font:F.bold,size:11,color:rgb(.65,.02,.02)});y-=24};const section=title=>{if(y<80)newPage();page.drawText(title,{x:m,y,font:F.bold,size:11});y-=17};const kv=(k,v)=>{if(y<55)newPage();page.drawText(k+":",{x:m,y,font:F.bold,size:8});wrap(v||"—",8,10);};
 top(kind==="staffing"?"DAILY STAFFING REPORT":kind==="check"?"APPARATUS CHECK REPORT":kind==="inspection"?"FIRE INSPECTION REPORT":"INCIDENT REPORT");
 const x=data||{};for(const [k,v] of Object.entries(x)){if(v===null||v===undefined||v==="")continue;if(Array.isArray(v)||typeof v==="object"){section(k.replace(/[_-]/g," ").toUpperCase());wrap(JSON.stringify(v,null,2),7,9)}else kv(k.replace(/[_-]/g," "),v)}
 if(kind==="incident"&&x.reports){for(const r of x.reports||[]){section(r.report_type||"Report");for(const [k,v] of Object.entries(r.data||{})){if(v===null||v===undefined||v==="")continue;if(Array.isArray(v)||typeof v==="object")wrap(k+": "+JSON.stringify(v),7,9);else kv(k,v)}}}
 page.drawText("JFD RMS • Administrative Report Archive",{x:m,y:30,font:F.reg,size:7,color:rgb(.4,.4,.4)});return pdf.save();
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
  if(body.archiveType){
    const pdf=await makeArchivePdf(body.archiveType,body.archiveData||{});
    if(body.action==="email"){
      const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
      if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
      const b64=Buffer.from(pdf).toString("base64"),name="JFD "+String(body.archiveType||"report")+" report.pdf";
      const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD "+String(body.archiveType||"Report")+" Report",textContent:"Attached is a Jasper Fire Department report generated by JFD RMS.",attachment:[{content:b64,name}]})});
      if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed."});return res.status(200).json({ok:true});
    }
    res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",'attachment; filename="JFD Administrative Report.pdf"');return res.status(200).send(Buffer.from(pdf));
  }
  const pdf=await makePdf(body.incident||{},Array.isArray(body.reports)?body.reports:[]);
  if(body.action==="email"){
    const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
    const to=Array.isArray(body.to)?body.to.filter(Boolean):body.to?[body.to]:["firechief@jaspercity.com"];
    if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
    const b64=Buffer.from(pdf).toString("base64");
    const subject="Jasper Fire Department Incident Report"+(body.incident?.cad?" - "+body.incident.cad:"");
    const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:to.map(email=>({email})),subject,textContent:"Attached is the Jasper Fire Department incident report generated by JFD RMS.",attachment:[{content:b64,name:(body.incident?.cad||"incident")+" - JFD Report.pdf"}]})});
    const et=await er.text();let ed;try{ed=JSON.parse(et)}catch{ed={raw:et}};
    if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed.",details:ed});
    return res.status(200).json({ok:true,email_id:ed?.messageId||null});
  }
  res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",'inline; filename="JFD Incident Report.pdf"');
  return res.status(200).send(Buffer.from(pdf));
 }
 catch(e){console.error("JFD report PDF error",e);return res.status(500).json({ok:false,error:e?.message||"Report generation failed"})}
}