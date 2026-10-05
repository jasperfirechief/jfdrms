import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

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
 const W=612,H=792,m=40,usable=W-(m*2),bottom=48,headerH=92;
 const F={reg,bold},NAVY=rgb(.08,.14,.22),RED=rgb(.62,.04,.04),SLATE=rgb(.34,.39,.45),LIGHT=rgb(.94,.96,.98),MID=rgb(.78,.82,.87),WHITE=rgb(1,1,1);
 const JFD_LOGO_PNG="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";
 const jfdLogoPng=await sharp(Buffer.from(JFD_LOGO_PNG,"base64"))
  .flatten({background:"#ffffff"})
  .png({compressionLevel:6,adaptiveFiltering:false})
  .toBuffer();
 const jfdLogo=await pdf.embedPng(jfdLogoPng);

 let page,y,pageNo=0;
 const pages=[];
 const clean=v=>String(v??"").replace(/\s+/g," ").trim();
 const prettyKey=k=>clean(k).replace(/^r/,"").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
 const pretty=v=>{
   if(v===undefined||v===null||v==="")return "—";
   if(typeof v==="boolean")return v?"Yes":"No";
   if(Array.isArray(v))return v.length?v.map(pretty).filter(x=>x!=="—").join(", ")||"—":"—";
   if(typeof v==="object")return Object.entries(v).filter(([,x])=>x!==undefined&&x!==null&&x!=="").map(([k,x])=>prettyKey(k)+": "+pretty(x)).join(" • ")||"—";
   let s=clean(v).replace(/\|\|/g," / ").replace(/\b[A-Z0-9_]+_[A-Z0-9_]+\b/g,x=>x.replace(/_/g," ")).replace(/_/g," ");
   return s||"—";
 };
 const dateText=v=>{const d=date(v);return d&&d!==String(v??"")?d:pretty(v)};
 const timeText=v=>{const z=time(v);return z&&z!==String(v??"")?z:pretty(v)};
 const wrapLines=(value,font,size,maxWidth)=>{
   const words=String(value??"").split(/\s+/).filter(Boolean);const lines=[];let line="";
   for(const word of words){const next=line?line+" "+word:word;if(font.widthOfTextAtSize(next,size)>maxWidth&&line){lines.push(line);line=word}else line=next}
   if(line)lines.push(line);return lines.length?lines:["—"];
 };
 const drawHeader=title=>{
   page.drawRectangle({x:0,y:H-70,width:W,height:70,color:WHITE});
   // Official Jasper Fire Department logo: cross and City of Jasper seal in the center.
   // Embedded as PNG to avoid JPEG/Vips decoding and preserve the actual department artwork.
   page.drawImage(jfdLogo,{x:m,y:H-64,width:90,height:55});
   page.drawText("JASPER FIRE DEPARTMENT",{x:m+100,y:H-27,font:F.bold,size:15,color:NAVY});
   page.drawText("10 18th Street East · Jasper, Alabama 35501 · 205-221-8509",{x:m+100,y:H-41,font:F.reg,size:7.5,color:SLATE});
   page.drawText(title,{x:m+100,y:H-56,font:F.bold,size:10,color:RED});
   page.drawLine({start:{x:m,y:H-70},end:{x:W-m,y:H-70},thickness:1,color:MID});
 };
 const drawFooter=()=>{
   page.drawLine({start:{x:m,y:35},end:{x:W-m,y:35},thickness:.6,color:MID});
   page.drawText("JFD RMS • Jasper Fire Department",{x:m,y:23,font:F.reg,size:7,color:SLATE});
   page.drawText("Page "+pageNo,{x:W-m-42,y:23,font:F.reg,size:7,color:SLATE});
 };
 const newPage=(title="JFD RMS REPORT")=>{
   page=pdf.addPage([W,H]);pageNo++;pages.push(page);drawHeader(title);y=H-headerH;
 };
 const ensure=n=>{if(y-n<bottom){drawFooter();newPage(currentTitle)}};
 let currentTitle="JFD RMS REPORT";
 const section=title=>{
   ensure(30);
   page.drawRectangle({x:m,y:y-19,width:usable,height:21,color:LIGHT,borderWidth:.5,borderColor:MID});
   page.drawText(String(title).toUpperCase(),{x:m+9,y:y-13,font:F.bold,size:8.5,color:NAVY});
   y-=29;
 };
 const field=(label,value,opts={})=>{
   const text=pretty(value),fs=opts.size||8.2,lh=opts.lh||11,labelW=opts.labelW||154,valueW=usable-labelW-12;
   const lines=wrapLines(text,F.reg,fs,valueW),h=Math.max(19,lines.length*lh+7);
   ensure(h+2);
   page.drawText(String(label),{x:m+7,y:y-12,font:F.bold,size:7.4,color:SLATE});
   lines.forEach((ln,i)=>page.drawText(ln,{x:m+labelW,y:y-12-(i*lh),font:F.reg,size:fs,color:NAVY}));
   page.drawLine({start:{x:m,y:y-h},end:{x:m+usable,y:y-h},thickness:.35,color:rgb(.87,.89,.92)});
   y-=h;
 };
 const fullText=(label,value)=>{
   const text=pretty(value),fs=8.4,lh=12,lines=wrapLines(text,F.reg,fs,usable-14),h=24+lines.length*lh;
   ensure(h+4);
   page.drawText(String(label),{x:m+7,y:y-12,font:F.bold,size:7.5,color:SLATE});
   lines.forEach((ln,i)=>page.drawText(ln,{x:m+7,y:y-27-(i*lh),font:F.reg,size:fs,color:NAVY}));
   page.drawRectangle({x:m,y:y-h+3,width:usable,height:h,borderWidth:.5,borderColor:MID});
   y-=h+5;
 };
 const twoCol=(left,right)=>{
   const labelW=112,gap=12,col=(usable-gap)/2;
   const draw=(x,item)=>{
     const text=pretty(item[1]),lines=wrapLines(text,F.reg,8,col-labelW-10),h=Math.max(20,lines.length*10.5+7);
     return {x,text,lines,h,label:item[0]};
   };
   let a=draw(m,left),b=draw(m+col+gap,right),h=Math.max(a.h,b.h);ensure(h+2);
   page.drawRectangle({x:m,y:y-h,width:col,height:h,borderWidth:.35,borderColor:MID});
   page.drawRectangle({x:m+col+gap,y:y-h,width:col,height:h,borderWidth:.35,borderColor:MID});
   page.drawText(a.label,{x:m+7,y:y-12,font:F.bold,size:7.2,color:SLATE});a.lines.forEach((ln,i)=>page.drawText(ln,{x:m+labelW,y:y-12-i*10.5,font:F.reg,size:8,color:NAVY}));
   page.drawText(b.label,{x:m+col+gap+7,y:y-12,font:F.bold,size:7.2,color:SLATE});b.lines.forEach((ln,i)=>page.drawText(ln,{x:m+col+gap+labelW,y:y-12-i*10.5,font:F.reg,size:8,color:NAVY}));
   y-=h+4;
 };
 const responseTable=units=>{
   if(!units.length){field("Responding Apparatus","None recorded");return}
   const cols=[70,92,106,106,106],xs=[m,m+70,m+162,m+268,m+374],labels=["Unit","Station","Crew","Response","Disposition"];
   ensure(34);page.drawRectangle({x:m,y:y-22,width:usable,height:22,color:NAVY});
   labels.forEach((s,i)=>page.drawText(s,{x:xs[i]+5,y:y-14,font:F.bold,size:7,color:WHITE}));y-=22;
   for(const u of units){
     const z=u.times||{},crew=Array.isArray(u.crew)?u.crew.map(x=>typeof x==="object"?x.name||x.full_name||"":x).filter(Boolean).join(", "):u.crew;
     const response=[z.enroute&&"En route "+timeText(z.enroute),z.on_scene&&"On scene "+timeText(z.on_scene)].filter(Boolean).join(" • ");
     const disp=[z.cancelled&&"Cancelled "+timeText(z.cancelled),z.in_service&&"In service "+timeText(z.in_service)||z.clear&&"In service "+timeText(z.clear)].filter(Boolean).join(" • ");
     const vals=[pretty(u.unit_number||u.unit),pretty(u.station),pretty(crew),response||"—",disp||"—"];
     const lines=vals.map((v,i)=>wrapLines(v,F.reg,7.2,cols[i]-10));const rows=Math.max(...lines.map(a=>a.length));const rh=Math.max(18,rows*9+7);ensure(rh+2);
     page.drawRectangle({x:m,y:y-rh,width:usable,height:rh,borderWidth:.35,borderColor:MID});
     lines.forEach((ls,i)=>ls.forEach((ln,j)=>page.drawText(ln,{x:xs[i]+5,y:y-11-j*9,font:F.reg,size:7.2,color:NAVY})));y-=rh;
   }
   y-=5;
 };
 const fire=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("fire_"));
 const pcr=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("pcr_"));
 const fd=fire[0]?.data||{};
 const patients=pcr.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]);
 const units=Array.isArray(fd.responding_apparatus)?fd.responding_apparatus:[];
 
 currentTitle="FIRE INCIDENT REPORT";newPage(currentTitle);
 section("Incident Information");
 twoCol(["CAD / Incident Number",incident.cad||fd.rCad],["Incident Date",dateText(fd.rDate||incident.dispatch_time)]);
 twoCol(["Call Type",fd.rCall||fd.rCallType||incident.type],["Shift",fd.rShift]);
 field("Primary Incident Type",fd.rPrimaryIncidentType||incident.type);
 field("Secondary Incident Type",fd.rSecondaryIncidentType);
 field("Incident Location",fd.rLocation||incident.location);
 twoCol(["Location Type",fd.rLocationType],["Location In Use",fd.rLocationInUse]);
 twoCol(["Used As Intended",fd.rUsedAsIntended],["Property Use / Occupancy",fd.rPrimaryUse||fd.rOccupancy]);
 section("Person / Property");
 twoCol(["Person Involved",fd.rPerson||fd.person_involved],["Owner Name",fd.rOwnerName||fd.owner_name]);
 field("Owner Address",fd.rOwnerAddress||fd.owner_address);
 twoCol(["Owner Phone",fd.rOwnerPhone||fd.owner_phone],["Occupant Name",fd.rOccupantName||fd.rOccName||fd.occupant_name]);
 field("Occupant Address",fd.rOccupantAddress||fd.occupant_address);
 twoCol(["Occupant Phone",fd.rOccPhone||fd.occupant_phone],["Property Use / Occupancy",fd.rPrimaryUse||fd.rOccupancy]);
 section("Insurance / Loss");
 twoCol(["Insurance Company",fd.rInsuranceCompany||fd.rOwnerInsurance||fd.rOccInsurance||fd.insurance_company],["Insurance Phone",fd.rInsurancePhone||fd.insurance_phone]);
 twoCol(["Policy Number",fd.rInsurancePolicy||fd.insurance_policy],["Damage Type",fd.rDamageType||fd.damage_type]);
 field("Estimated Damage",fd.rDamageEstimate||fd.damage_estimate);
 section("Vehicle / Property Involved");
 const vehicles=Array.isArray(fd.vehicles)?fd.vehicles:[];
 if(vehicles.length)vehicles.forEach((v,i)=>{field("Vehicle #"+(i+1),[v.year,v.make,v.model,v.vehicle,v.description].filter(Boolean).join(" "));twoCol(["Owner",v.owner],["Insurance",v.insurance]);field("License / VIN",v.vin||v.license||v.license_vin)});
 else {twoCol(["Vehicle #1",fd.rVehicle1],["Year",fd.rYear1]);twoCol(["Make",fd.rMake1],["Model",fd.rModel1]);field("License / VIN",fd.rVin1);}
 section("Incident Actions / Response");
 field("Action Taken",fd.rActionTaken||fd.action_taken);
 field("No Action Taken",fd.rNoActionTaken||fd.no_action_taken);
 field("Actions / Tactics",Array.isArray(fd.actions_taken)?fd.actions_taken:fd.rActionsTaken);
 twoCol(["Water Supply",fd.rWater||fd.water_supply],["Investigation",fd.rInvestigation||fd.investigation]);
 twoCol(["Fire Location",fd.rFireLoc||fd.fire_location],["Condition",fd.rCondition||fd.condition]);
 twoCol(["Floor / Room",[fd.rFloor||fd.floor_of_origin,fd.rRoom||fd.room_type].filter(Boolean).join(" / ")],["Cause",fd.rCause||fd.cause]);
 twoCol(["Alarms / Suppression",[fd.rFireAlarm,fd.rOtherAlarm,fd.rSuppression,fd.rCookingSuppression].filter(Boolean).join(" / ")],["Casualties / Rescues",fd.casualties]);
 field("Exposures",fd.exposures);
 field("Hazards / HAZMAT",fd.hazards||fd.rHazmat);
 section("Narrative / Completion");
 fullText("Narrative",fd.rNarrative||incident.narrative||"No narrative entered.");
 field("Person Completing Report",fd.rCompletedBy||fd.completedBy||fd.report_completed_by);
 
 currentTitle="TECHNICAL INCIDENT RECORD";newPage(currentTitle);
 section("Incident / Location");
 [["CAD / Incident Number",fd.rCad||incident.cad],["Incident Date",dateText(fd.rDate||incident.dispatch_time)],["Shift",fd.rShift],["Call Type",fd.rCall||fd.rCallType||incident.type],["Primary Incident Type",fd.rPrimaryIncidentType||incident.type],["Secondary Incident Type",fd.rSecondaryIncidentType],["Location",fd.rLocation||incident.location],["Latitude",fd.rLatitude],["Longitude",fd.rLongitude],["Location Type",fd.rLocationType],["Primary Use",fd.rPrimaryUse],["Secondary Use",fd.rSecondaryUse],["Location In Use",fd.rLocationInUse],["Used As Intended",fd.rUsedAsIntended],["Vacancy",fd.rVacancy],["People Present",fd.rPeoplePresent]].forEach(x=>field(x[0],x[1]));
 section("Dispatch / Response");
 [["Dispatch Incident Number",fd.rDispatchIncidentNumber],["Call Arrival",fd.rCallArrival&&dateText(fd.rCallArrival)+" "+timeText(fd.rCallArrival)],["Call Answered",fd.rCallAnswered&&dateText(fd.rCallAnswered)+" "+timeText(fd.rCallAnswered)],["Call Create",fd.rCallCreate&&dateText(fd.rCallCreate)+" "+timeText(fd.rCallCreate)],["Dispatch Time",fd.rDispatch&&dateText(fd.rDispatch)+" "+timeText(fd.rDispatch)]].forEach(x=>field(x[0],x[1]));
 responseTable(units);
 field("Additional Personnel",fd.additional_personnel);
 section("Fire / Incident Conditions");
 [["Fire Location",fd.rFireLoc],["Condition",fd.rCondition],["Water Supply",fd.rWater],["Damage Type",fd.rDamageType],["Damage Estimate",fd.rDamageEstimate],["Floor",fd.rFloor],["Room",fd.rRoom],["Cause",fd.rCause],["Acres",fd.rAcres],["Smoke Presence",fd.rSmokePresence],["Smoke Alarm Working",fd.rSmokeWorking],["Fire Alarm",fd.rFireAlarm],["Other Alarm",fd.rOtherAlarm],["Suppression",fd.rSuppression],["Cooking Suppression",fd.rCookingSuppression]].forEach(x=>field(x[0],x[1]));
 section("Actions / Tactics");
 field("Action Taken",fd.rActionTaken||fd.action_taken);field("No Action Taken",fd.rNoActionTaken||fd.no_action_taken);field("Actions / Tactics",fd.actions_taken||fd.rActionsTaken);
 section("Exposures / Casualties / Hazards");
 field("Exposures",fd.exposures);field("Casualties / Rescues",fd.casualties);field("Hazards",fd.hazards);
 section("Mutual Aid / Other Agencies");
 const aids=[...(Array.isArray(fd.aid_records)?fd.aid_records:[]),...(Array.isArray(fd.nonfd_aid_records)?fd.nonfd_aid_records:[])];
 field("Mutual Aid",aids.length?aids:"None recorded");
 section("Hazmat / Special Hazards");
 [["Evacuation",fd.rEvac],["Hazard Evacuated",fd.rHazEvacuated],["Hazmat",fd.rHazmat],["Hazmat Disposition",fd.rHazDisposition],["Chemicals",fd.rChemicals],["Chemical Name",fd.rChemicalName],["Chemical Class",fd.rChemicalClass],["Chemical Release",fd.rChemicalRelease],["Electrical Hazard",fd.rElectrical],["Other Hazard",fd.rOtherHazard]].forEach(x=>field(x[0],x[1]));
 section("Narrative / Completion");fullText("Narrative",fd.rNarrative||incident.narrative||"No narrative entered.");field("Report Completed By",fd.rCompletedBy||fd.rCompletedBy);
 
 for(let i=0;i<patients.length;i++){
   const p=patients[i]||{};currentTitle="PATIENT CARE REPORT";newPage(currentTitle);
   section("Patient Information");
   twoCol(["Patient",p.name],["Date of Birth",dateText(p.dob)]);
   twoCol(["Age",p.age],["Sex",p.sex]);field("Patient Address",p.address);twoCol(["Patient Phone",p.phone],["Incident / CAD",incident.cad||fd.rCad]);
   twoCol(["Incident Date",dateText(fd.rDate||incident.dispatch_time)],["Incident Time",timeText(fd.rDateTime||fd.rDispatch||incident.dispatch_time)]);
   field("Incident Location",fd.rLocation||incident.location);field("Responding Unit",p.vehicle||p.assignedVehicle||p.unit||fd.responding_unit);
   section("Chief Complaint / Presentation");
   field("Chief Complaint / Reason for Response",p.chief);field("Injury / Medical Complaint",p.injury||p.complaint);fullText("Presentation / Brief Narrative",p.presentation||p.narrative||"");
   section("Assessment / Care");
   field("Patient Care Provided",p.careProvided===true?"Evaluated and cared for":p.careProvided===false?"Evaluated, no care required":p.evaluation);
   const vitals=p.vitals||{};for(const [k,v] of Object.entries(vitals))if(v!==undefined&&v!==null&&v!=="")field(prettyKey(k),v);
   const care=Array.isArray(p.methodsOfCare)?p.methodsOfCare:Array.isArray(p.careMethods)?p.careMethods:Array.isArray(p.methods)?p.methods:[];
   field("BLS Methods of Care",care);field("Oxygen",p.oxygen||p.oxygenMethod);field("Medical History",p.medicalHistory||p.history);field("Medications",p.medications||p.meds);field("Allergies",p.allergies);
   section("Disposition");
   field("Disposition",p.transportDisposition||p.transport||p.disposition);twoCol(["Transporting Agency / Unit",p.transportAgency||p.transportUnit||p.vehicle],["Destination",p.destination]);
   field("Disposition Narrative",p.dispositionNarrative);twoCol(["Vehicle / Insurance",p.vehicleInfo||p.vehicleInsurance||p.insurance],["Equipment Used / Replaced",p.equipmentUsed||p.equipmentReplaced||p.equipment]);
   if(p.refusedCare||p.refusedTransport||p.minorRefusal){
     section("Refusal / Signatures");
     field("Refusal Type",[p.refusedCare?"Refused Care":"",p.refusedTransport?"Refused Transport":"",""].filter(Boolean).join(", ")||"Minor refusal");
     twoCol(["Patient / Guardian",p.refusalSigner],["Guardian Relationship",p.guardianRelationship]);
     field("Risks Explained / Acknowledged",p.risksExplained||p.risksAcknowledged);field("Refusal Date / Time",p.refusalDateTime||p.refusalDate||p.signedAt);
     field("Provider",p.provider||"JFD RMS user / electronic record");
     if(String(p.signature||"").startsWith("data:image/png"))try{const bytes=Buffer.from(String(p.signature).split(",")[1],"base64"),img=await pdf.embedPng(bytes);ensure(105);page.drawText("Patient / Guardian Signature",{x:m+7,y:y-12,font:F.bold,size:7.5,color:SLATE});page.drawImage(img,{x:m+7,y:y-87,width:250,height:70});page.drawRectangle({x:m+7,y:y-87,width:250,height:70,borderWidth:.5,borderColor:MID});y-=100}catch{}
   }
   section("Narrative / Completion");fullText("Narrative",p.narrative||p.comments||"No narrative entered.");field("Person Completing Report",p.completedBy||p.reportCompletedBy||p.provider||"JFD RMS user / electronic record");
   page.drawText("Patient "+(i+1)+" of "+patients.length,{x:W-m-65,y:23,font:F.bold,size:7,color:SLATE});
 }
 if(!patients.length){currentTitle="PATIENT CARE REPORT";newPage(currentTitle);section("Patient Information");field("Patient Records","None recorded");}
 
 currentTitle="NERIS INVESTIGATION DETAILS";newPage(currentTitle);
 section("Investigation");
 for(const r of fire){
   const d=r?.data||{};
   [["Investigation Required",d.rInvestigation],["Investigation Type",d.rInvestigationType],["Cause",d.rCause||d.cause],["Origin Floor",d.rFloor||d.floor_of_origin],["Origin Room / Area",d.rRoom||d.room_type],["Arrival Condition",d.rCondition||d.condition],["Damage Type",d.rDamageType||d.damage_type],["Damage Estimate",d.rDamageEstimate||d.damage_estimate],["Fire Location",d.rFireLoc||d.fire_location],["Water Supply",d.rWater||d.water_supply],["Smoke Alarm Presence",d.rSmokePresence||d.smoke_alarm_presence],["Smoke Alarm Working",d.rSmokeWorking||d.smoke_alarm_working],["Fire Alarm",d.rFireAlarm||d.fire_alarm],["Other Alarm",d.rOtherAlarm||d.other_alarm],["Suppression System",d.rSuppression||d.suppression_system],["Cooking Fire Suppression",d.rCookingSuppression||d.cooking_suppression]].forEach(x=>field(x[0],x[1]));
   const n=d.neris_investigation||d.nerisInvestigation||d.investigation_details||d.neris?.investigation;
   if(n&&typeof n==="object"){section("Additional NERIS Investigation Data");for(const [k,v] of Object.entries(n))if(v!==undefined&&v!==null&&v!=="")field(prettyKey(k),v)}
 }
 if(!fire.length)field("NERIS Investigation","No Fire Incident Report investigation data attached.");
 for(const p of pages){} // pages retained for final footer pass
 pages.forEach((pg,idx)=>{
   // Footer is drawn during page transitions; the final page needs one too.
   if(idx===pages.length-1) { page=pg;drawFooter(); }
 });
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