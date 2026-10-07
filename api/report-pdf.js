import { PDFDocument, StandardFonts, rgb } from "pdf-lib";


const SUPABASE_URL="https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
async function requireAdmin(req){
 const auth=req.headers.authorization||"";if(!auth.startsWith("Bearer "))throw new Error("Authentication required.");
 const authCtl=new AbortController();const authTimer=setTimeout(()=>authCtl.abort(),10000);let ur;try{ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:authCtl.signal})}finally{clearTimeout(authTimer)}if(!ur.ok)throw new Error("Invalid or expired session.");
 const u=await ur.json();const permCtl=new AbortController();const permTimer=setTimeout(()=>permCtl.abort(),10000);let pr;try{pr=await fetch(SUPABASE_URL+"/rest/v1/users?select=app_role,active&user_id=eq."+encodeURIComponent(u.id),{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:permCtl.signal})}finally{clearTimeout(permTimer)}if(!pr.ok)throw new Error("Unable to verify RMS permissions.");
 const rows=await pr.json();if(rows?.[0]?.active!==true||rows?.[0]?.app_role!=="admin")throw new Error("Administrator access required for PDF reports.");return u;
}
async function requirePdfAccess(req,body){
  const auth=req.headers.authorization||"";
  if(body?.action==="email_all"&&body?.incident?.incident_id){
    if(!auth.startsWith("Bearer "))throw new Error("Authentication required.");
    const userCtl=new AbortController(),userTimer=setTimeout(()=>userCtl.abort(),8000);
    let ur;
    try{ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:userCtl.signal})}
    finally{clearTimeout(userTimer)}
    if(!ur.ok)throw new Error("Invalid or expired session.");
    const user=await ur.json();
    const url=SUPABASE_URL+"/rest/v1/incident_details?select=status,report_by&incident_id=eq."+encodeURIComponent(body.incident.incident_id);
    const qCtl=new AbortController(),qTimer=setTimeout(()=>qCtl.abort(),8000);
    let q;
    try{q=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:auth},signal:qCtl.signal})}
    finally{clearTimeout(qTimer)}
    if(!q.ok)throw new Error("Unable to verify incident completion.");
    const rows=await q.json(),d=rows?.[0];
    if(String(d?.status||"")!=="awaiting_neris"||String(d?.report_by||"")!==String(user.id)){
      throw new Error("This completed incident package is not authorized for the current user.");
    }
    return user;
  }
  return await requireAdmin(req);
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
 const startedAt=Date.now();
 const pdf=await PDFDocument.create();
 const reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,m=40,usable=W-(m*2),bottom=48,headerH=92;
 const F={reg,bold},NAVY=rgb(.08,.14,.22),RED=rgb(.62,.04,.04),SLATE=rgb(.34,.39,.45),LIGHT=rgb(.94,.96,.98),MID=rgb(.78,.82,.87),WHITE=rgb(1,1,1);
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
   const cols=[70,80,92,115,105,102],xs=[m,m+70,m+150,m+242,m+357,m+462],labels=["Unit","Station","Crew","Dispatch","Response","Disposition"];
   ensure(34);page.drawRectangle({x:m,y:y-22,width:usable,height:22,color:NAVY});
   labels.forEach((s,i)=>page.drawText(s,{x:xs[i]+5,y:y-14,font:F.bold,size:6.8,color:WHITE}));y-=22;
   for(const u of units){
     const z=u.times||{},crew=Array.isArray(u.crew)?u.crew.map(x=>{if(typeof x!=="object")return x;const role=String(x.role||"").toLowerCase();const tag=role==="driver"?"Driver":role==="officer"?"Officer":(x.role||"");return (x.name||x.full_name||"")+(tag?" ("+tag+")":"");}).filter(Boolean).join(", "):u.crew;
     const dispatch=z.dispatch&&timeText(z.dispatch);
     const response=[z.enroute&&("En route "+timeText(z.enroute)),z.on_scene&&("On scene "+timeText(z.on_scene))].filter(Boolean).join(" • ");
     const disp=[z.cancelled&&("Cancelled "+timeText(z.cancelled)),(z.in_service||z.clear)&&("In service "+timeText(z.in_service||z.clear))].filter(Boolean).join(" • ");
     const vals=[pretty(u.unit_number||u.unit),pretty(u.station),pretty(crew),dispatch||"—",response||"—",disp||"—"];
     const lines=vals.map((v,i)=>wrapLines(v,F.reg,7.0,cols[i]-10));const rows=Math.max(...lines.map(a=>a.length));const rh=Math.max(18,rows*9+7);ensure(rh+2);
     page.drawRectangle({x:m,y:y-rh,width:usable,height:rh,borderWidth:.35,borderColor:MID});
     lines.forEach((ls,i)=>ls.forEach((ln,j)=>page.drawText(ln,{x:xs[i]+5,y:y-11-j*9,font:F.reg,size:7.0,color:NAVY})));y-=rh;
   }
   y-=5;
 };
 const fire=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("fire_"));
 const pcr=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("pcr_"));
 const fd=fire[0]?.data||{};
 const patients=pcr.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]);
 const unitMap=new Map();
  for(const r of (reports||[])){
    const arr=Array.isArray(r?.data?.responding_apparatus)?r.data.responding_apparatus:[];
    for(const u of arr){
      const key=String(u?.apparatus_id??u?.unit_number??u?.unit_number_snapshot??"");
      if(!key)continue;
      const prev=unitMap.get(key);
      if(!prev){unitMap.set(key,{...u,crew:Array.isArray(u.crew)?u.crew.slice():u.crew});continue;}
      if((!prev.crew||!prev.crew.length)&&Array.isArray(u.crew))prev.crew=u.crew.slice();
      prev.times={...(prev.times||{}),...(u.times||{})};
      if(u.station&&!prev.station)prev.station=u.station;
    }
  }
  const units=[...unitMap.values()];
 
 currentTitle="FIRE INCIDENT REPORT";newPage(currentTitle);
 section("Incident Summary");
 twoCol(["Incident / CAD Number",incident.cad||fd.rCad],["Incident Date",dateText(fd.rDate||incident.dispatch_time)]);
 field("Incident Location",fd.rLocation||incident.location);
 twoCol(["Call Type",fd.rCall||fd.rCallType||incident.type],["Location Type",fd.rLocationType]);
 field("Property Use / Occupancy",fd.rPrimaryUse||fd.rOccupancy);

 section("Owner / Occupant Information");
 twoCol(["Owner Name",fd.rOwnerName||fd.owner_name],["Owner Phone",fd.rOwnerPhone||fd.owner_phone]);
 field("Owner Address",fd.rOwnerAddress||fd.owner_address);
 twoCol(["Occupant Name",fd.rOccupantName||fd.rOccName||fd.occupant_name],["Occupant Phone",fd.rOccPhone||fd.occupant_phone]);
 field("Occupant Address",fd.rOccupantAddress||fd.occupant_address);

 section("Fire Department Report");
 field("Date of Incident",dateText(fd.rDate||incident.dispatch_time));
 field("Type of Response",fd.rCall||fd.rCallType||incident.type);
 field("Department Contact","Jasper Fire Department • 10 18th Street East • Jasper, Alabama 35501 • 205-221-8509");
 fullText("General Incident Description","This page provides the basic incident and property information for the owner or occupant. Detailed operational, apparatus, NERIS, investigative, and other department-use information is provided on subsequent pages.");
 
 currentTitle="FIRE INCIDENT REPORT";newPage(currentTitle);
 section("Department Technical Record");

 const dispatchTimes=[["Dispatch",fd.rDispatch],["En Route",fd.rEnRoute],["On Scene",fd.rOnScene],["Cancelled",fd.rCancelled],["In Service",fd.rInService]];
 const activeTimes=dispatchTimes.filter(x=>x[1]);
 if(activeTimes.length){
   const pairs=[];for(let i=0;i<activeTimes.length;i+=2){pairs.push(activeTimes[i],activeTimes[i+1]||["",""]);twoCol(pairs[0],pairs[1]||["",""]);pairs=[];}
 }else field("Incident Times","No incident times recorded");
 responseTable(units);
 field("Additional Personnel",fd.additional_personnel);
 const aids=[...(Array.isArray(fd.aid_records)?fd.aid_records:[]),...(Array.isArray(fd.nonfd_aid_records)?fd.nonfd_aid_records:[])];
 field("Mutual Aid / Other Agencies",aids.length?aids:"None recorded");
 
 section("Fire / Alarm Conditions");
 twoCol(["Fire Location",fd.rFireLoc||fd.fire_location],["Arrival Condition",fd.rCondition||fd.condition]);
 twoCol(["Smoke Presence",fd.rSmokePresence||fd.rSmoke],["Smoke Alarm Working",fd.rSmokeWorking||fd.rSmokeAlarmWorking]);
 twoCol(["Fire Alarm",fd.rFireAlarm],["Other Alarm",fd.rOtherAlarm]);
 twoCol(["Suppression System",fd.rSuppression],["Cooking Suppression",fd.rCookingSuppression]);
 twoCol(["Water Supply",fd.rWater||fd.water_supply],["Fire Investigation",fd.rInvestigation||fd.investigation]);
 
 section("Incident Actions / Findings");
 twoCol(["Action Taken",fd.rActionTaken||fd.action_taken],["No Action Taken",fd.rNoActionTaken||fd.no_action_taken]);
 field("Actions / Tactics",Array.isArray(fd.actions_taken)?fd.actions_taken:(fd.rActionsTaken||fd.actions_taken));
 twoCol(["Cause",fd.rCause||fd.cause],["Damage Type",fd.rDamageType||fd.damage_type]);
 twoCol(["Damage Estimate",fd.rDamageEstimate||fd.damage_estimate],["Floor / Area",[fd.rFloor||fd.floor_of_origin,fd.rRoom||fd.room_type].filter(Boolean).join(" / ")]);
 
 section("Vehicles / Exposures / Casualties / Hazards");
 const vehicles=Array.isArray(fd.vehicles)?fd.vehicles:[];
 if(vehicles.length){
   vehicles.forEach((v,i)=>{
     field("Vehicle "+(i+1),[v.year,v.make,v.model,v.vehicle,v.description].filter(Boolean).join(" "));
     twoCol(["Owner",v.owner],["Insurance",v.insurance]);
     field("License / VIN",v.vin||v.license||v.license_vin);
   });
 }else{
   const legacyVehicle=[fd.rVehicle1,fd.rYear1,fd.rMake1,fd.rModel1].filter(Boolean).join(" ");
   if(legacyVehicle)field("Vehicle Involved",legacyVehicle);
 }
 field("Exposures",fd.exposures);
 field("Casualties / Rescues",fd.casualties);
 field("Hazards / HAZMAT",fd.hazards||fd.rHazmat);
 
 section("Insurance / Loss");
 twoCol(["Insurance Company",fd.rInsuranceCompany||fd.rOwnerInsurance||fd.rOccInsurance||fd.insurance_company],["Insurance Phone",fd.rInsurancePhone||fd.insurance_phone]);
 twoCol(["Policy Number",fd.rInsurancePolicy||fd.insurance_policy],["Loss / Damage Type",fd.rDamageType||fd.damage_type]);
 field("Estimated Damage",fd.rDamageEstimate||fd.damage_estimate);
 
 section("Narrative");
 fullText("Incident Narrative",fd.rNarrative||incident.narrative||"No narrative entered.");
 
 section("Report Completion");
 field("Person Completing Report",fd.rCompletedBy||fd.completedBy||fd.report_completed_by);
 for(let i=0;i<patients.length;i++){
   const p=patients[i]||{};
   const isRefusal=!!(p.refusedCare||p.refusedTransport||p.minorRefusal||p.refusal||p.refusalType);
   const refusalType=p.refusalType||[p.refusedCare?"Refused Care":"",p.refusedTransport?"Refused Transport":"",p.minorRefusal?"Minor Refusal":""].filter(Boolean).join(", ")||"Patient Refusal";
   currentTitle="PATIENT CARE REPORT";newPage(currentTitle);

   // PAGE 1: concise disposition/signature record. Keep clinical PHI off this page
   // except what is necessary to identify the encounter and execute a refusal.
   section("Patient Care / Disposition Summary");
   twoCol(["Incident / CAD",incident.cad||fd.rCad],["Incident Date",dateText(fd.rDate||incident.dispatch_time)]);
   field("Incident Location",fd.rLocation||incident.location);
   twoCol(["Response Unit",p.vehicle||p.assignedVehicle||p.unit||fd.responding_unit],["Disposition",p.transportDisposition||p.transport||p.disposition]);
   twoCol(["Transport Agency / Unit",p.transportAgency||p.transportUnit||p.vehicle],["Destination",p.destination]);
   field("Chief Complaint / Reason for Response",p.chief||p.complaint||"Not recorded");

   if(isRefusal){
     section("Patient Refusal / Release");
     field("Refusal Type",refusalType);
     field("Recommended Care / Transport",p.recommendedCare||p.refusalRecommendations||p.refusedServices||"See refusal documentation");
     fullText("Risks / Consequences Explained",p.risksExplained||p.risksAcknowledged||p.refusalExplanation||"The patient or authorized representative was advised of the risks and consequences of refusing the recommended care and/or transport.");
     twoCol(["Refusing Party",p.refusalSigner||p.patientSigner||p.guardianName||p.name],["Relationship",p.guardianRelationship||p.signerRelationship||"Patient"]);
     twoCol(["Refusal Date / Time",p.refusalDateTime||p.refusalDate||p.signedAt],["Witness",p.witnessName||p.refusalWitness]);
     field("If Patient Declined to Sign",p.signatureRefused||p.patientRefusedSignature?"Patient/representative declined to sign.":"");
     ensure(112);
     page.drawText("Patient / Guardian Signature",{x:m+7,y:y-12,font:F.bold,size:7.5,color:SLATE});
     if(String(p.signature||"").startsWith("data:image/png")){
       try{
         const bytes=Buffer.from(String(p.signature).split(",")[1],"base64"),img=await pdf.embedPng(bytes);
         page.drawImage(img,{x:m+7,y:y-91,width:250,height:70});
       }catch{}
     }else{
       page.drawText(p.signatureName||p.refusalSigner||"Electronic signature recorded",{x:m+7,y:y-50,font:F.reg,size:9,color:NAVY});
     }
     page.drawRectangle({x:m+7,y:y-92,width:250,height:70,borderWidth:.5,borderColor:MID});
     page.drawText("Signature",{x:m+265,y:y-12,font:F.bold,size:7.5,color:SLATE});
     page.drawText("Date / Time",{x:m+390,y:y-12,font:F.bold,size:7.5,color:SLATE});
     page.drawLine({start:{x:m+265,y:y-58},end:{x:m+380,y:y-58},thickness:.5,color:MID});
     page.drawLine({start:{x:m+390,y:y-58},end:{x:m+usable-7,y:y-58},thickness:.5,color:MID});
     y-=105;
     twoCol(["Witness Signature",p.witnessSignatureName||p.witnessName],["Provider Signature",p.providerSignatureName||p.provider||"JFD EMS Provider"]);
   }else{
     section("Disposition / Transfer");
     field("Disposition Narrative",p.dispositionNarrative||p.transferNarrative||"");
     twoCol(["Patient / Representative Signature",p.patientSignatureName||p.signatureName||""],["Provider",p.provider||"JFD EMS Provider"]);
   }

   section("Report Identification");
   twoCol(["Patient Record", "Patient "+(i+1)+" of "+patients.length],["Completed By",p.completedBy||p.reportCompletedBy||p.provider||"JFD RMS user"]);
   fullText("Protected Clinical Information","Clinical assessment, vital signs, medications, medical history, allergies, interventions, and other protected patient information are contained on subsequent pages of this report.");

   // PAGE 2+: protected clinical record
   currentTitle="PATIENT CARE REPORT — PROTECTED CLINICAL RECORD";newPage(currentTitle);
   section("Patient Identification");
   twoCol(["Patient",p.name],["Date of Birth",dateText(p.dob)]);
   twoCol(["Age",p.age],["Sex",p.sex]);
   field("Patient Address",p.address);
   twoCol(["Patient Phone",p.phone],["Incident / CAD",incident.cad||fd.rCad]);

   section("Assessment / Presentation");
   field("Chief Complaint / Reason for Response",p.chief||p.complaint);
   field("Injury / Medical Complaint",p.injury||p.complaint);
   fullText("Presentation / Brief Narrative",p.presentation||p.narrative||"");

   section("Clinical Assessment");
   field("Patient Care Provided",p.careProvided===true?"Evaluated and cared for":p.careProvided===false?"Evaluated, no care required":p.evaluation);
   const vitals=p.vitals||{};
   if(Object.keys(vitals).length){
     section("Vital Signs");
     for(const [k,v] of Object.entries(vitals))if(v!==undefined&&v!==null&&v!=="")field(prettyKey(k),v);
   }else field("Vital Signs","No vital signs recorded");
   field("Medical History",p.medicalHistory||p.history);
   field("Medications",p.medications||p.meds);
   field("Allergies",p.allergies);

   section("Treatment / Interventions");
   const care=Array.isArray(p.methodsOfCare)?p.methodsOfCare:Array.isArray(p.careMethods)?p.careMethods:Array.isArray(p.methods)?p.methods:[];
   field("BLS Methods of Care",care);
   field("Oxygen",p.oxygen||p.oxygenMethod);
   field("Medications Administered",p.medicationsAdministered||p.medicationsGiven||p.medications||p.meds);
   field("Procedures / Interventions",p.interventions||p.procedures);
   field("Patient Response",p.patientResponse||p.responseToTreatment);

   section("Disposition / Transfer Details");
   field("Disposition",p.transportDisposition||p.transport||p.disposition);
   twoCol(["Transporting Agency / Unit",p.transportAgency||p.transportUnit||p.vehicle],["Destination",p.destination]);
   field("Disposition Narrative",p.dispositionNarrative||p.transferNarrative);
   twoCol(["Vehicle / Insurance",p.vehicleInfo||p.vehicleInsurance||p.insurance],["Equipment Used / Replaced",p.equipmentUsed||p.equipmentReplaced||p.equipment]);

   section("Clinical Narrative / Completion");
   fullText("Narrative",p.narrative||p.comments||"No narrative entered.");
   field("Person Completing Report",p.completedBy||p.reportCompletedBy||p.provider||"JFD RMS user");
   field("Provider / Crew",p.provider||p.crew||"");
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
 const bytes=await pdf.save({objectsPerTick:Infinity});
 console.info("[report-pdf] incident PDF generated",{cad:String(incident?.cad||""),reportCount:Array.isArray(reports)?reports.length:0,pageCount:pdf.getPages().length,bytes:bytes.length,durationMs:Date.now()-startedAt});
 return bytes;
}

async function makeArchivePdf(kind,data){
 const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,m=42,usable=W-2*m;let page,y;const F={reg,bold};const newPage=()=>{page=pdf.addPage([W,H]);y=H-m};const wrap=(s,size=9,lh=13,b=false)=>{const font=b?F.bold:F.reg;let line="";for(const word of String(s??"").split(/\s+/)){const n=line?line+" "+word:word;if(font.widthOfTextAtSize(n,size)>usable&&line){page.drawText(line,{x:m,y,font,size});y-=lh;line=word}else line=n}if(line){page.drawText(line,{x:m,y,font,size});y-=lh}};const top=title=>{newPage();page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:F.bold,size:16,color:rgb(.12,.16,.22)});y-=20;page.drawText(title,{x:m,y,font:F.bold,size:11,color:rgb(.65,.02,.02)});y-=24};const section=title=>{if(y<80)newPage();page.drawText(title,{x:m,y,font:F.bold,size:11});y-=17};const kv=(k,v)=>{if(y<55)newPage();page.drawText(k+":",{x:m,y,font:F.bold,size:8});wrap(v||"—",8,10);};
 top(kind==="staffing"?"DAILY STAFFING REPORT":kind==="check"?"APPARATUS CHECK REPORT":kind==="inspection"?"FIRE INSPECTION REPORT":"INCIDENT REPORT");
 const x=data||{};for(const [k,v] of Object.entries(x)){if(v===null||v===undefined||v==="")continue;if(Array.isArray(v)||typeof v==="object"){section(k.replace(/[_-]/g," ").toUpperCase());wrap(JSON.stringify(v,null,2),7,9)}else kv(k.replace(/[_-]/g," "),v)}
 if(kind==="incident"&&x.reports){for(const r of x.reports||[]){section(r.report_type||"Report");for(const [k,v] of Object.entries(r.data||{})){if(v===null||v===undefined||v==="")continue;if(Array.isArray(v)||typeof v==="object")wrap(k+": "+JSON.stringify(v),7,9);else kv(k,v)}}}
 page.drawText("JFD RMS • Administrative Report Archive",{x:m,y:30,font:F.reg,size:7,color:rgb(.4,.4,.4)});return pdf.save({objectsPerTick:Infinity});
}
function crc32(buf){let table=crc32.table;if(!table){table=crc32.table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}}let crc=0xffffffff;for(const b of buf)crc=table[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function zipStore(entries){const locals=[],central=[];let offset=0;for(const entry of entries){const name=Buffer.from(String(entry.name),"utf8"),data=Buffer.from(entry.data),crc=crc32(data),lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x800,6);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(name.length,26);locals.push(lh,name,data);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x800,8);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(data.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);central.push(ch,name);offset+=lh.length+name.length+data.length;}const body=Buffer.concat(locals),cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(body.length,16);return Buffer.concat([body,cd,end]);}
async function makeIncidentPdfs(incident,reports){const out=[];for(let i=0;i<reports.length;i++){const r=reports[i],pdf=await makePdf(incident,[r]),kind=String(r?.report_type||"").startsWith("pcr_")?"Patient Care Report":"Fire Incident Report";out.push({pdf,name:String(i+1).padStart(2,"0")+"_"+kind.replace(/[^A-Za-z0-9_-]+/g,"_")+".pdf"});}return out;}

export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
  await requirePdfAccess(req,body);
  if(body.archiveType){
    const pdf=await makeArchivePdf(body.archiveType,body.archiveData||{});
    if(body.action==="email"){
      const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
      if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
      const b64=Buffer.from(pdf).toString("base64"),name="JFD "+String(body.archiveType||"report")+" report.pdf";
      const emailCtl=new AbortController();const emailTimer=setTimeout(()=>emailCtl.abort(),30000);let er;try{er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD "+String(body.archiveType||"Report")+" Report",textContent:"Attached is a Jasper Fire Department report generated by JFD RMS.",attachment:[{content:b64,name}]}),signal:emailCtl.signal})}finally{clearTimeout(emailTimer)}
      if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed."});return res.status(200).json({ok:true});
    }
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Length",String(pdf.length));res.setHeader("Content-Disposition",'attachment; filename="JFD Administrative Report.pdf"');return res.status(200).end(Buffer.from(pdf));
  }
  const incident=body.incident||{},reports=Array.isArray(body.reports)?body.reports:[];
  if(body.action==="download_all"){
    if(!reports.length)return res.status(400).json({ok:false,error:"No saved reports are available for this incident."});
    const generated=await makeIncidentPdfs(incident,reports),zip=zipStore(generated.map(x=>({name:x.name,data:x.pdf})));
    const safeCad=String(incident.cad||"incident").replace(/[^A-Za-z0-9_-]+/g,"_");
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");res.setHeader("Content-Type","application/zip");res.setHeader("Content-Length",String(zip.length));res.setHeader("Content-Disposition",'attachment; filename="'+safeCad+' - JFD Incident Reports.zip"');
    return res.status(200).end(zip);
  }
  if(body.action==="email_all"){
    if(!reports.length)return res.status(400).json({ok:false,error:"No saved reports are available for this incident."});
    const generated=await makeIncidentPdfs(incident,reports),key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
    const to=Array.isArray(body.to)?body.to.filter(Boolean):body.to?[body.to]:["firechief@jaspercity.com"];
    if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
    const attachments=generated.map(x=>({content:Buffer.from(x.pdf).toString("base64"),name:x.name}));
    const emailCtl=new AbortController(),emailTimer=setTimeout(()=>emailCtl.abort(),30000);let er;
    try{er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:to.map(email=>({email})),subject:"Jasper Fire Department Incident Reports"+(incident.cad?" - "+incident.cad:""),textContent:"Attached are all Jasper Fire Department report PDFs for this incident. Each report is attached as a separate PDF.",attachment:attachments}),signal:emailCtl.signal})}catch(e){return res.status(502).json({ok:false,error:"Report email request failed.",details:e?.message||String(e)})}finally{clearTimeout(emailTimer)}
    const et=await er.text();let ed;try{ed=JSON.parse(et)}catch{ed={raw:et}};if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed.",details:ed});
    return res.status(200).json({ok:true,email_id:ed?.messageId||null});
  }
  const pdf=await makePdf(incident,reports);
  if(body.action==="email"){
    const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
    const to=Array.isArray(body.to)?body.to.filter(Boolean):body.to?[body.to]:["firechief@jaspercity.com"];
    if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
    const b64=Buffer.from(pdf).toString("base64"),subject="Jasper Fire Department Incident Report"+(incident.cad?" - "+incident.cad:"");
    const emailCtl=new AbortController(),emailTimer=setTimeout(()=>emailCtl.abort(),30000);let er;
    try{er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:to.map(email=>({email})),subject,textContent:"Attached is the Jasper Fire Department incident report generated by JFD RMS.",attachment:[{content:b64,name:(incident.cad||"incident")+" - JFD Report.pdf"}]}),signal:emailCtl.signal})}
    catch(e){return res.status(502).json({ok:false,error:"Report email request failed.",details:e?.message||String(e)})}
    finally{clearTimeout(emailTimer)}
    const et=await er.text();let ed;try{ed=JSON.parse(et)}catch{ed={raw:et}};if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed.",details:ed});
    return res.status(200).json({ok:true,email_id:ed?.messageId||null});
  }
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Length",String(pdf.length));res.setHeader("Content-Disposition",'attachment; filename="JFD Incident Report.pdf"');
  return res.status(200).end(Buffer.from(pdf));
 }
 catch(e){console.error("JFD report PDF error",e);return res.status(500).json({ok:false,error:e?.message||"Report generation failed"})}
}