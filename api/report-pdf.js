import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { JFD_LOGO_PNG } from "./jfd-logo-data.js";


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
 const logo=await pdf.embedPng(Buffer.from(JFD_LOGO_PNG,"base64"));
 const logoDims=logo.scaleToFit(58,50);
 const drawHeader=title=>{
   page.drawRectangle({x:0,y:H-70,width:W,height:70,color:WHITE});
   page.drawImage(logo,{x:m,y:H-61+((50-logoDims.height)/2),width:logoDims.width,height:logoDims.height});
   page.drawText("JASPER FIRE DEPARTMENT",{x:m+72,y:H-27,font:F.bold,size:15,color:NAVY});
   page.drawText("10 18th Street East · Jasper, Alabama 35501 · 205-221-8509",{x:m+72,y:H-41,font:F.reg,size:7.5,color:SLATE});
   page.drawText(title,{x:m+72,y:H-56,font:F.bold,size:10,color:RED});
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
 
 const callType=String(fd.rCall||fd.rCallType||incident.type||"").trim();
 const primaryType=String(fd.rPrimaryIncidentType||fd.primary_incident_type||fd.rIncidentType||"").toUpperCase();
 const isMva=/\\bMVA\\b|MOTOR[_ ]VEHICLE|COLLISION|CRASH/.test((callType+" "+primaryType).toUpperCase());
 const isFireLike=!isMva && /FIRE|STRUCTURE|ALARM|SMOKE|EXPLOS|WILDFIRE/.test((callType+" "+primaryType).toUpperCase());
 const hasVal=v=>v!==undefined&&v!==null&&String(v).trim()!==""&&String(v).trim()!=="—";
 const firstVal=(...vs)=>vs.find(hasVal);
 const nonEmptyObject=o=>o&&typeof o==="object"&&!Array.isArray(o)&&Object.values(o).some(hasVal);
 const vehicleList=Array.isArray(fd.vehicles)?fd.vehicles:[];
 const legacyVehicle=[fd.rVehicle1,fd.rYear1,fd.rMake1,fd.rModel1].filter(hasVal).join(" ");
 const hasVehicles=vehicleList.length>0||!!legacyVehicle;
 const hasNarrative=hasVal(fd.rNarrative)||hasVal(incident.narrative);
 const hasOwner=hasVal(fd.rOwnerName)||hasVal(fd.owner_name)||hasVal(fd.rOwnerPhone)||hasVal(fd.owner_phone)||hasVal(fd.rOwnerAddress)||hasVal(fd.owner_address);
 const hasOccupant=hasVal(fd.rOccupantName)||hasVal(fd.rOccName)||hasVal(fd.occupant_name)||hasVal(fd.rOccPhone)||hasVal(fd.occupant_phone)||hasVal(fd.rOccupantAddress)||hasVal(fd.occupant_address);
 const aids=[...(Array.isArray(fd.aid_records)?fd.aid_records:[]),...(Array.isArray(fd.nonfd_aid_records)?fd.nonfd_aid_records:[])];
 const hasAid=aids.length>0;
 const hasFireConditions=isFireLike && [
   fd.rFireLoc,fd.fire_location,fd.rCondition,fd.condition,fd.rSmokePresence,fd.rSmoke,fd.rSmokeWorking,fd.rSmokeAlarmWorking,
   fd.rFireAlarm,fd.rOtherAlarm,fd.rSuppression,fd.rCookingSuppression,fd.rWater,fd.water_supply,fd.rInvestigation,fd.investigation
 ].some(hasVal);
 const hasActions=[
   fd.rActionTaken,fd.action_taken,fd.rNoActionTaken,fd.no_action_taken,fd.rActionsTaken,fd.actions_taken
 ].some(hasVal);
 const hasFindings=[fd.rCause,fd.cause,fd.rDamageType,fd.damage_type,fd.rDamageEstimate,fd.damage_estimate,fd.rFloor,fd.floor_of_origin,fd.rRoom,fd.room_type].some(hasVal);
 const hasExposure=[fd.exposures,fd.casualties,fd.hazards,fd.rHazmat].some(hasVal);
 const hasInsurance=[fd.rInsuranceCompany,fd.rOwnerInsurance,fd.rOccInsurance,fd.insurance_company,fd.rInsurancePhone,fd.insurance_phone,fd.rInsurancePolicy,fd.insurance_policy,fd.rDamageType,fd.damage_type,fd.rDamageEstimate,fd.damage_estimate].some(hasVal);

 currentTitle=isMva?"MOTOR VEHICLE ACCIDENT REPORT":"FIRE INCIDENT REPORT";newPage(currentTitle);
 section("Incident Summary");
 twoCol(["Incident / CAD Number",firstVal(incident.cad,fd.rCad)],["Incident Date",dateText(firstVal(fd.rDate,incident.dispatch_time,incident.incident_date))]);
 field("Incident Location",firstVal(fd.rLocation,incident.location));
 twoCol(["Call Type",callType],["Location Type",firstVal(fd.rLocationType,incident.location_type)]);
 const primaryDisplay=pretty(firstVal(fd.rPrimaryIncidentType,fd.primary_incident_type,fd.rIncidentType));
 if(hasVal(fd.rPrimaryIncidentType)||hasVal(fd.primary_incident_type)||hasVal(fd.rIncidentType))field("Primary Incident Type",primaryDisplay);
 if(hasVal(fd.rShift)||hasVal(fd.shift)||hasVal(incident.shift))twoCol(["Shift",firstVal(fd.rShift,fd.shift,incident.shift)],["Property Use / Occupancy",firstVal(fd.rPrimaryUse,fd.rOccupancy)]);
 else if(hasVal(fd.rPrimaryUse)||hasVal(fd.rOccupancy))field("Property Use / Occupancy",firstVal(fd.rPrimaryUse,fd.rOccupancy));

 if(hasOwner||hasOccupant){
   section("Owner / Occupant Information");
   if(hasOwner){
     twoCol(["Owner Name",firstVal(fd.rOwnerName,fd.owner_name)],["Owner Phone",firstVal(fd.rOwnerPhone,fd.owner_phone)]);
     if(hasVal(fd.rOwnerAddress)||hasVal(fd.owner_address))field("Owner Address",firstVal(fd.rOwnerAddress,fd.owner_address));
   }
   if(hasOccupant){
     twoCol(["Occupant Name",firstVal(fd.rOccupantName,fd.rOccName,fd.occupant_name)],["Occupant Phone",firstVal(fd.rOccPhone,fd.occupant_phone)]);
     if(hasVal(fd.rOccupantAddress)||hasVal(fd.occupant_address))field("Occupant Address",firstVal(fd.rOccupantAddress,fd.occupant_address));
   }
 }

 currentTitle=isMva?"MOTOR VEHICLE ACCIDENT REPORT":"FIRE INCIDENT REPORT";newPage(currentTitle);
 section("Department Technical Record");
 const dispatchTimes=[["Dispatch",fd.rDispatch],["En Route",fd.rEnRoute],["On Scene",fd.rOnScene],["Cancelled",fd.rCancelled],["In Service",fd.rInService]];
 const activeTimes=dispatchTimes.filter(x=>hasVal(x[1]));
 if(activeTimes.length){
   for(let i=0;i<activeTimes.length;i+=2)twoCol(activeTimes[i],activeTimes[i+1]||["",""]);
 }else if(units.length) field("Incident Times","See responding apparatus times below");
 else field("Incident Times","No incident times recorded");
 responseTable(units);
 if(hasVal(fd.additional_personnel))field("Additional Personnel",fd.additional_personnel);
 if(hasAid)field("Mutual Aid / Other Agencies",aids);

 if(hasVehicles){
   section(isMva?"Vehicles Involved":"Vehicles / Property Involved");
   if(vehicleList.length){
     vehicleList.forEach((v,i)=>{
       field("Vehicle "+(i+1),[v.year,v.make,v.model,v.vehicle,v.description].filter(hasVal).join(" "));
       const owner=firstVal(v.owner,v.owner_name),insurance=firstVal(v.insurance,v.insurance_company);
       if(hasVal(owner)||hasVal(insurance))twoCol(["Owner",owner],["Insurance",insurance]);
       const vin=firstVal(v.vin,v.license,v.license_vin,v.license_plate);
       if(hasVal(vin))field("License / VIN",vin);
     });
   }else field("Vehicle Involved",legacyVehicle);
 }

 if(hasFireConditions){
   section("Fire / Alarm Conditions");
   twoCol(["Fire Location",firstVal(fd.rFireLoc,fd.fire_location)],["Arrival Condition",firstVal(fd.rCondition,fd.condition)]);
   twoCol(["Smoke Presence",firstVal(fd.rSmokePresence,fd.rSmoke)],["Smoke Alarm Working",firstVal(fd.rSmokeWorking,fd.rSmokeAlarmWorking)]);
   twoCol(["Fire Alarm",fd.rFireAlarm],["Other Alarm",fd.rOtherAlarm]);
   twoCol(["Suppression System",fd.rSuppression],["Cooking Suppression",fd.rCookingSuppression]);
   twoCol(["Water Supply",firstVal(fd.rWater,fd.water_supply)],["Fire Investigation",firstVal(fd.rInvestigation,fd.investigation)]);
 }

 if(hasActions||hasFindings){
   section("Incident Actions / Findings");
   if(hasVal(fd.rActionTaken)||hasVal(fd.action_taken)||hasVal(fd.rNoActionTaken)||hasVal(fd.no_action_taken))twoCol(["Action Taken",firstVal(fd.rActionTaken,fd.action_taken)],["No Action Taken",firstVal(fd.rNoActionTaken,fd.no_action_taken)]);
   if(hasVal(fd.rActionsTaken)||hasVal(fd.actions_taken))field("Actions / Tactics",Array.isArray(fd.actions_taken)?fd.actions_taken:fd.rActionsTaken);
   if(hasFindings){
     if(hasVal(fd.rCause)||hasVal(fd.cause)||hasVal(fd.rDamageType)||hasVal(fd.damage_type))twoCol(["Cause",firstVal(fd.rCause,fd.cause)],["Damage Type",firstVal(fd.rDamageType,fd.damage_type)]);
     if(hasVal(fd.rDamageEstimate)||hasVal(fd.damage_estimate)||hasVal(fd.rFloor)||hasVal(fd.floor_of_origin)||hasVal(fd.rRoom)||hasVal(fd.room_type))twoCol(["Damage Estimate",firstVal(fd.rDamageEstimate,fd.damage_estimate)],["Floor / Area",[firstVal(fd.rFloor,fd.floor_of_origin),firstVal(fd.rRoom,fd.room_type)].filter(hasVal).join(" / ")]);
   }
 }

 if(hasExposure){
   section("Exposures / Casualties / Hazards");
   if(hasVal(fd.exposures))field("Exposures",fd.exposures);
   if(hasVal(fd.casualties))field("Casualties / Rescues",fd.casualties);
   if(hasVal(fd.hazards)||hasVal(fd.rHazmat))field("Hazards / HAZMAT",firstVal(fd.hazards,fd.rHazmat));
 }

 if(hasInsurance){
   section("Insurance / Loss");
   if(hasVal(fd.rInsuranceCompany)||hasVal(fd.rOwnerInsurance)||hasVal(fd.rOccInsurance)||hasVal(fd.insurance_company))twoCol(["Insurance Company",firstVal(fd.rInsuranceCompany,fd.rOwnerInsurance,fd.rOccInsurance,fd.insurance_company)],["Insurance Phone",firstVal(fd.rInsurancePhone,fd.insurance_phone)]);
   if(hasVal(fd.rInsurancePolicy)||hasVal(fd.insurance_policy)||hasVal(fd.rDamageType)||hasVal(fd.damage_type))twoCol(["Policy Number",firstVal(fd.rInsurancePolicy,fd.insurance_policy)],["Loss / Damage Type",firstVal(fd.rDamageType,fd.damage_type)]);
   if(hasVal(fd.rDamageEstimate)||hasVal(fd.damage_estimate))field("Estimated Damage",firstVal(fd.rDamageEstimate,fd.damage_estimate));
 }

 if(hasNarrative){
   section("Narrative");
   fullText("Incident Narrative",firstVal(fd.rNarrative,incident.narrative));
 }

 if(hasVal(fd.rCompletedBy)||hasVal(fd.completedBy)||hasVal(fd.report_completed_by)){
   section("Report Completion");
   field("Person Completing Report",firstVal(fd.rCompletedBy,fd.completedBy,fd.report_completed_by));
 }

 const hasPcrRecords=pcr.length>0 && patients.length>0;
 if(hasPcrRecords){
   for(let i=0;i<patients.length;i++){
     const p=patients[i]||{};
     const isRefusal=!!(p.refusedCare||p.refusedTransport||p.minorRefusal||p.refusal||p.refusalType);
     const refusalType=p.refusalType||[p.refusedCare?"Refused Care":"",p.refusedTransport?"Refused Transport":"",p.minorRefusal?"Minor Refusal":""].filter(Boolean).join(", ")||"Patient Refusal";
     currentTitle="PATIENT CARE REPORT";newPage(currentTitle);
     section("Patient Care / Disposition Summary");
     twoCol(["Incident / CAD",firstVal(incident.cad,fd.rCad)],["Incident Date",dateText(firstVal(fd.rDate,incident.dispatch_time))]);
     field("Incident Location",firstVal(fd.rLocation,incident.location));
     twoCol(["Response Unit",firstVal(p.vehicle,p.assignedVehicle,p.unit,fd.responding_unit)],["Disposition",firstVal(p.transportDisposition,p.transport,p.disposition)]);
     if(hasVal(p.transportAgency)||hasVal(p.transportUnit)||hasVal(p.vehicle)||hasVal(p.destination))twoCol(["Transport Agency / Unit",firstVal(p.transportAgency,p.transportUnit,p.vehicle)],["Destination",p.destination]);
     if(hasVal(p.chief)||hasVal(p.complaint))field("Chief Complaint / Reason for Response",firstVal(p.chief,p.complaint));

     if(isRefusal){
       section("Patient Refusal / Release");
       field("Refusal Type",refusalType);
       if(hasVal(p.recommendedCare)||hasVal(p.refusalRecommendations)||hasVal(p.refusedServices))field("Recommended Care / Transport",firstVal(p.recommendedCare,p.refusalRecommendations,p.refusedServices));
       if(hasVal(p.risksExplained)||hasVal(p.risksAcknowledged)||hasVal(p.refusalExplanation))fullText("Risks / Consequences Explained",firstVal(p.risksExplained,p.risksAcknowledged,p.refusalExplanation));
       if(hasVal(p.refusalSigner)||hasVal(p.patientSigner)||hasVal(p.guardianName)||hasVal(p.name))twoCol(["Refusing Party",firstVal(p.refusalSigner,p.patientSigner,p.guardianName,p.name)],["Relationship",firstVal(p.guardianRelationship,p.signerRelationship,"Patient")]);
       if(hasVal(p.refusalDateTime)||hasVal(p.refusalDate)||hasVal(p.signedAt)||hasVal(p.witnessName)||hasVal(p.refusalWitness))twoCol(["Refusal Date / Time",firstVal(p.refusalDateTime,p.refusalDate,p.signedAt)],["Witness",firstVal(p.witnessName,p.refusalWitness)]);
       if(p.signatureRefused||p.patientRefusedSignature)field("If Patient Declined to Sign","Patient/representative declined to sign.");
       ensure(112);
       page.drawText("Patient / Guardian Signature",{x:m+7,y:y-12,font:F.bold,size:7.5,color:SLATE});
       if(String(p.signature||"").startsWith("data:image/png")){
         try{const bytes=Buffer.from(String(p.signature).split(",")[1],"base64"),img=await pdf.embedPng(bytes);page.drawImage(img,{x:m+7,y:y-91,width:250,height:70});}catch{}
       }else page.drawText(p.signatureName||p.refusalSigner||"Electronic signature recorded",{x:m+7,y:y-50,font:F.reg,size:9,color:NAVY});
       page.drawRectangle({x:m+7,y:y-92,width:250,height:70,borderWidth:.5,borderColor:MID});
       page.drawText("Signature",{x:m+265,y:y-12,font:F.bold,size:7.5,color:SLATE});
       page.drawText("Date / Time",{x:m+390,y:y-12,font:F.bold,size:7.5,color:SLATE});
       page.drawLine({start:{x:m+265,y:y-58},end:{x:m+380,y:y-58},thickness:.5,color:MID});
       page.drawLine({start:{x:m+390,y:y-58},end:{x:m+usable-7,y:y-58},thickness:.5,color:MID});
       y-=105;
     }else if(hasVal(p.dispositionNarrative)||hasVal(p.transferNarrative)||hasVal(p.patientSignatureName)||hasVal(p.signatureName)||hasVal(p.provider)){
       section("Disposition / Transfer");
       if(hasVal(p.dispositionNarrative)||hasVal(p.transferNarrative))field("Disposition Narrative",firstVal(p.dispositionNarrative,p.transferNarrative));
       if(hasVal(p.patientSignatureName)||hasVal(p.signatureName)||hasVal(p.provider))twoCol(["Patient / Representative Signature",firstVal(p.patientSignatureName,p.signatureName)],["Provider",p.provider]);
     }
     section("Report Identification");
     twoCol(["Patient Record","Patient "+(i+1)+" of "+patients.length],["Completed By",firstVal(p.completedBy,p.reportCompletedBy,p.provider,"JFD RMS user")]);

     currentTitle="PATIENT CARE REPORT — PROTECTED CLINICAL RECORD";newPage(currentTitle);
     section("Patient Identification");
     twoCol(["Patient",p.name],["Date of Birth",dateText(p.dob)]);
     twoCol(["Age",p.age],["Sex",p.sex]);
     if(hasVal(p.address))field("Patient Address",p.address);
     if(hasVal(p.phone)||hasVal(incident.cad)||hasVal(fd.rCad))twoCol(["Patient Phone",p.phone],["Incident / CAD",firstVal(incident.cad,fd.rCad)]);
     section("Assessment / Presentation");
     if(hasVal(p.chief)||hasVal(p.complaint))field("Chief Complaint / Reason for Response",firstVal(p.chief,p.complaint));
     if(hasVal(p.injury)||hasVal(p.complaint))field("Injury / Medical Complaint",firstVal(p.injury,p.complaint));
     if(hasVal(p.presentation)||hasVal(p.narrative))fullText("Presentation / Brief Narrative",firstVal(p.presentation,p.narrative));
     section("Clinical Assessment");
     if(p.careProvided===true||p.careProvided===false||hasVal(p.evaluation))field("Patient Care Provided",p.careProvided===true?"Evaluated and cared for":p.careProvided===false?"Evaluated, no care required":p.evaluation);
     const vitals=p.vitals||{};
     if(Object.keys(vitals).length){section("Vital Signs");for(const [k,v] of Object.entries(vitals))if(hasVal(v))field(prettyKey(k),v);}
     if(hasVal(p.medicalHistory)||hasVal(p.history))field("Medical History",firstVal(p.medicalHistory,p.history));
     if(hasVal(p.medications)||hasVal(p.meds))field("Medications",firstVal(p.medications,p.meds));
     if(hasVal(p.allergies))field("Allergies",p.allergies);
     const care=Array.isArray(p.methodsOfCare)?p.methodsOfCare:Array.isArray(p.careMethods)?p.careMethods:Array.isArray(p.methods)?p.methods:[];
     if(care.length||hasVal(p.oxygen)||hasVal(p.oxygenMethod)||hasVal(p.medicationsAdministered)||hasVal(p.medicationsGiven)||hasVal(p.interventions)||hasVal(p.procedures)||hasVal(p.patientResponse)||hasVal(p.responseToTreatment)){
       section("Treatment / Interventions");
       if(care.length)field("BLS Methods of Care",care);
       if(hasVal(p.oxygen)||hasVal(p.oxygenMethod))field("Oxygen",firstVal(p.oxygen,p.oxygenMethod));
       if(hasVal(p.medicationsAdministered)||hasVal(p.medicationsGiven))field("Medications Administered",firstVal(p.medicationsAdministered,p.medicationsGiven));
       if(hasVal(p.interventions)||hasVal(p.procedures))field("Procedures / Interventions",firstVal(p.interventions,p.procedures));
       if(hasVal(p.patientResponse)||hasVal(p.responseToTreatment))field("Patient Response",firstVal(p.patientResponse,p.responseToTreatment));
     }
     if(hasVal(p.transportDisposition)||hasVal(p.transport)||hasVal(p.disposition)||hasVal(p.transportAgency)||hasVal(p.transportUnit)||hasVal(p.destination)||hasVal(p.dispositionNarrative)||hasVal(p.transferNarrative)){
       section("Disposition / Transfer Details");
       if(hasVal(p.transportDisposition)||hasVal(p.transport)||hasVal(p.disposition))field("Disposition",firstVal(p.transportDisposition,p.transport,p.disposition));
       if(hasVal(p.transportAgency)||hasVal(p.transportUnit)||hasVal(p.vehicle)||hasVal(p.destination))twoCol(["Transporting Agency / Unit",firstVal(p.transportAgency,p.transportUnit,p.vehicle)],["Destination",p.destination]);
       if(hasVal(p.dispositionNarrative)||hasVal(p.transferNarrative))field("Disposition Narrative",firstVal(p.dispositionNarrative,p.transferNarrative));
       if(hasVal(p.vehicleInfo)||hasVal(p.vehicleInsurance)||hasVal(p.insurance)||hasVal(p.equipmentUsed)||hasVal(p.equipmentReplaced)||hasVal(p.equipment))twoCol(["Vehicle / Insurance",firstVal(p.vehicleInfo,p.vehicleInsurance,p.insurance)],["Equipment Used / Replaced",firstVal(p.equipmentUsed,p.equipmentReplaced,p.equipment)]);
     }
     if(hasVal(p.narrative)||hasVal(p.comments)||hasVal(p.completedBy)||hasVal(p.reportCompletedBy)||hasVal(p.provider)||hasVal(p.crew)){
       section("Clinical Narrative / Completion");
       if(hasVal(p.narrative)||hasVal(p.comments))fullText("Narrative",firstVal(p.narrative,p.comments));
       if(hasVal(p.completedBy)||hasVal(p.reportCompletedBy)||hasVal(p.provider))field("Person Completing Report",firstVal(p.completedBy,p.reportCompletedBy,p.provider));
       if(hasVal(p.provider)||hasVal(p.crew))field("Provider / Crew",firstVal(p.provider,p.crew));
     }
     page.drawText("Patient "+(i+1)+" of "+patients.length,{x:W-m-65,y:23,font:F.bold,size:7,color:SLATE});
   }
 }

 const investigationRows=fire.flatMap(r=>{
   const d=r?.data||{};
   return [
     ["Investigation Required",d.rInvestigation],["Investigation Type",d.rInvestigationType],["Cause",d.rCause||d.cause],
     ["Origin Floor",d.rFloor||d.floor_of_origin],["Origin Room / Area",d.rRoom||d.room_type],["Arrival Condition",d.rCondition||d.condition],
     ["Damage Type",d.rDamageType||d.damage_type],["Damage Estimate",d.rDamageEstimate||d.damage_estimate],["Fire Location",d.rFireLoc||d.fire_location],
     ["Water Supply",d.rWater||d.water_supply],["Smoke Alarm Presence",d.rSmokePresence||d.smoke_alarm_presence],["Smoke Alarm Working",d.rSmokeWorking||d.smoke_alarm_working],
     ["Fire Alarm",d.rFireAlarm||d.fire_alarm],["Other Alarm",d.rOtherAlarm||d.other_alarm],["Suppression System",d.rSuppression||d.suppression_system],
     ["Cooking Fire Suppression",d.rCookingSuppression||d.cooking_suppression]
   ];
 }).filter(x=>hasVal(x[1]));
 const nerisObjects=fire.flatMap(r=>{const d=r?.data||{};const n=d.neris_investigation||d.nerisInvestigation||d.investigation_details||d.neris?.investigation;return n&&typeof n==="object"?Object.entries(n).filter(([,v])=>hasVal(v)).map(([k,v])=>[prettyKey(k),v]):[]});
 if(isFireLike && (investigationRows.length||nerisObjects.length)){
   currentTitle="NERIS INVESTIGATION DETAILS";newPage(currentTitle);
   section("Investigation");
   investigationRows.forEach(x=>field(x[0],x[1]));
   if(nerisObjects.length){section("Additional NERIS Investigation Data");nerisObjects.forEach(x=>field(x[0],x[1]));}
 }
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