import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const text=v=>String(v??"").replace(/\s+/g," ").trim();
const fmtDate=v=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("en-US")};
const fmtTime=v=>{if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})};
function wrap(page,font,s,x,y,w,size=9,lh=12,bold=false){const f=bold?font.bold:font.reg;const words=String(s||"").split(/\s+/);let line="";for(const word of words){const t=line?line+" "+word:word;if(f.widthOfTextAtSize(t,size)>w&&line){if(y<58)return y;page.drawText(line,{x,y,font:f,size,color:rgb(.1,.15,.2)});y-=lh;line=word}else line=t}if(line){page.drawText(line,{x,y,font:f,size,color:rgb(.1,.15,.2)});y-=lh}return y}
function header(page,font,title,incident,m){let y=792-m;page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:font.bold,size:17,color:rgb(.65,.02,.02)});y-=22;page.drawText(title,{x:m,y,font:font.bold,size:13});y-=17;page.drawText("CAD / Incident: "+text(incident?.cad||incident?.incident_number||"Manual"),{x:m,y,font:font.reg,size:9});y-=13;page.drawText("Location: "+text(incident?.location||"Location not provided"),{x:m,y,font:font.reg,size:9});y-=20;return y}
function section(page,font,title,y,m){page.drawText(title,{x:m,y,font:font.bold,size:11,color:rgb(.12,.18,.25)});y-=15;return {page,y}}
function line(page,font,label,value,y,m){page.drawText(label,{x:m,y,font:font.bold,size:8});page.drawText(text(value)||"—",{x:m+115,y,font:font.reg,size:8});return y-12}
function addSig(pdf,page,font,dataUrl,x,y,w,h){if(!dataUrl||!String(dataUrl).startsWith("data:image/png"))return false;try{const b=Buffer.from(String(dataUrl).split(",")[1],"base64");return pdf.embedPng(b).then(img=>{page.drawImage(img,{x,y,width:w,height:h});page.drawRectangle({x,y,width:w,height:h,borderWidth:.5,borderColor:rgb(.6,.6,.6)});return true})}catch{return false}}
export async function makePdf(incident,reports){
 const pdf=await PDFDocument.create();
 const reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const font={reg,bold},W=612,H=792,m=42,usable=W-2*m;
 let page=pdf.addPage([W,H]),y=H-m;

 const val=v=>text(v)||"—";
 const newPage=()=>{page=pdf.addPage([W,H]);y=H-m;return page};
 const need=space=>{if(y<58+space)newPage();return y};
 const drawLine=(label,value)=>{need(18);page.drawText(String(label),{x:m,y,font:bold,size:8,color:rgb(.12,.18,.25)});y=wrap(page,font,val(value),m+120,y,usable-120,8,11);return y};
 const drawWrap=(label,value)=>{need(28);y=wrap(page,font,String(label)+": "+val(value),m,y,usable,8,11,true);return y};
 const heading=title=>{need(38);page.drawText(title,{x:m,y,font:bold,size:11,color:rgb(.12,.18,.25)});y-=17;return y};
 const reportType=r=>String(r?.report_type||"");
 const fireReports=(reports||[]).filter(r=>reportType(r).startsWith("fire_"));
 const pcrReports=(reports||[]).filter(r=>reportType(r).startsWith("pcr_"));
 const primary=fireReports[0]?.data||reports?.[0]?.data||{};
 const allPatients=pcrReports.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]);

 // PAGE 1: public-facing basics only. This is suitable for an owner/occupant
 // to take to an assistance organization without exposing technical/medical data.
 page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:bold,size:20,color:rgb(.65,.02,.02)});y-=27;
 page.drawText("INCIDENT / PROPERTY INFORMATION",{x:m,y,font:bold,size:14});y-=20;
 y=wrap(page,font,"This page provides the basic incident and property information commonly needed for property-loss assistance or insurance documentation. Technical response and investigation information appears on later pages.",m,y,usable,8,11);
 y-=8;
 heading("INCIDENT BASICS");
 drawLine("CAD / Incident Number",incident?.cad||primary.rCad);
 drawLine("Incident Date",fmtDate(primary.rDate||incident?.dispatch_time));
 drawLine("Call Type",primary.rCallType||primary.rCall||incident?.type);
 drawLine("Primary Incident Type",primary.rPrimaryIncidentType||incident?.type);
 drawLine("Incident Location",primary.rLocation||incident?.location);
 drawLine("Location Type",primary.rLocationType);
 y-=3;
 heading("PERSON / PROPERTY");
 drawLine("Person Involved",primary.rPerson||primary.person_involved);
 drawLine("Owner Name",primary.rOwnerName||primary.owner_name);
 drawLine("Owner Address",primary.rOwnerAddress||primary.owner_address);
 drawLine("Owner Phone",primary.rOwnerPhone||primary.owner_phone);
 drawLine("Occupant Name",primary.rOccupantName||primary.rOccName||primary.occupant_name);
 drawLine("Occupant Address",primary.rOccupantAddress||primary.occupant_address);
 drawLine("Occupant Phone",primary.rOccupantPhone||primary.rOccPhone||primary.occupant_phone);
 drawLine("Property Use / Occupancy",primary.rPrimaryUse||primary.rOccupancy);
 y-=3;
 heading("INSURANCE");
 drawLine("Insurance Company",primary.rInsuranceCompany||primary.insurance_company||primary.rOwnerInsurance||primary.rOccInsurance);
 drawLine("Insurance Phone",primary.rInsurancePhone||primary.insurance_phone);
 drawLine("Policy Number",primary.rInsurancePolicy||primary.insurance_policy);
 y-=3;
 heading("LOSS / DAMAGE");
 drawLine("Damage Type",primary.rDamageType||primary.damage_type);
 drawLine("Estimated Damage",primary.rDamageEstimate||primary.damage_estimate);
 drawLine("Vehicle",primary.rVehicle1);
 drawLine("Year / Make / Model",[primary.rYear1,primary.rMake1,primary.rModel1].filter(Boolean).join(" "));
 drawLine("License / VIN",primary.rVin1);
 y-=4;
 if(primary.rNarrative){heading("BASIC INCIDENT DESCRIPTION");y=wrap(page,font,val(primary.rNarrative),m,y,usable,9,13)}
 page.drawText("Jasper Fire Department RMS • Public Incident Summary",{x:m,y:38,font:reg,size:7,color:rgb(.4,.4,.4)});

 // TECHNICAL DEPARTMENT RECORD
 newPage();
 page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:bold,size:17,color:rgb(.65,.02,.02)});y-=22;
 page.drawText("TECHNICAL INCIDENT REPORT",{x:m,y,font:bold,size:13});y-=17;
 y=wrap(page,font,"CAD / Incident: "+val(incident?.cad||primary.rCad||incident?.incident_number),m,y,usable,9,12,true);
 y=wrap(page,font,"Location: "+val(incident?.location||primary.rLocation),m,y,usable,9,12);
 y-=8;

 const addTechnicalReport=(rep,index)=>{
   const d=rep?.data||{};
   if(index>0){newPage();page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:bold,size:17,color:rgb(.65,.02,.02)});y-=22;page.drawText("FIRE REPORT DETAIL",{x:m,y,font:bold,size:13});y-=17}
   heading("INCIDENT & LOCATION");
   drawLine("CAD / Incident",d.rCad||incident?.cad);
   drawLine("Incident Date",d.rDate||incident?.dispatch_time);
   drawLine("Shift",d.rShift);
   drawLine("Call Type",d.rCallType||d.rCall);
   drawLine("Primary Incident Type",d.rPrimaryIncidentType);
   drawLine("Secondary Incident Type",d.rSecondaryIncidentType);
   drawLine("Location",d.rLocation||incident?.location);
   drawLine("Latitude",d.rLatitude||incident?.latitude);
   drawLine("Longitude",d.rLongitude||incident?.longitude);
   drawLine("Location Type",d.rLocationType);
   drawLine("Primary Use",d.rPrimaryUse||d.rOccupancy);
   drawLine("Secondary Use",d.rSecondaryUse);
   drawLine("Location In Use",d.rLocationInUse);
   drawLine("Used As Intended",d.rUsedAsIntended);
   drawLine("Vacancy",d.rVacancy);
   drawLine("People Present",d.rPeoplePresent);
   y-=3;
   heading("OWNER / OCCUPANT / INSURANCE");
   drawLine("Person Involved",d.rPerson||d.person_involved);
   drawLine("Owner Name",d.rOwnerName||d.owner_name);
   drawLine("Owner Address",d.rOwnerAddress||d.owner_address);
   drawLine("Owner Phone",d.rOwnerPhone||d.owner_phone);
   drawLine("Owner Insurance",d.rOwnerInsurance||d.owner_insurance);
   drawLine("Occupant Name",d.rOccupantName||d.rOccName||d.occupant_name);
   drawLine("Occupant Address",d.rOccupantAddress||d.occupant_address);
   drawLine("Occupant Phone",d.rOccupantPhone||d.rOccPhone||d.occupant_phone);
   drawLine("Occupant Insurance",d.rOccInsurance||d.occupant_insurance);
   drawLine("Insurance Company",d.rInsuranceCompany||d.insurance_company);
   drawLine("Insurance Phone",d.rInsurancePhone||d.insurance_phone);
   drawLine("Policy Number",d.rInsurancePolicy||d.insurance_policy);
   y-=3;
   heading("FIRE / INCIDENT CONDITIONS");
   drawLine("Fire Location",d.rFireLoc);
   drawLine("Arrival Condition",d.rCondition);
   drawLine("Water Supply",d.rWater);
   drawLine("Damage Type",d.rDamageType);
   drawLine("Damage Estimate",d.rDamageEstimate);
   drawLine("Floor of Origin",d.rFloor);
   drawLine("Room / Area",d.rRoom);
   drawLine("Cause",d.rCause);
   drawLine("Wildfire Acres",d.rAcres);
   drawLine("Smoke Alarm",d.rSmokePresence);
   drawLine("Smoke Alarm Working",d.rSmokeWorking);
   drawLine("Fire Alarm",d.rFireAlarm);
   drawLine("Other Alarm",d.rOtherAlarm);
   drawLine("Suppression System",d.rSuppression);
   drawLine("Cooking Suppression",d.rCookingSuppression);
   y-=3;
   heading("ACTIONS TAKEN");
   drawLine("Action Taken",d.rActionTaken||d.action_taken);
   drawLine("No Action Taken",d.rNoActionTaken||d.no_action_taken);
   const acts=Array.isArray(d.actions_taken)?d.actions_taken:(Array.isArray(d.rActionsTaken)?d.rActionsTaken:[]);
   drawLine("Actions / Tactics",acts.join(", "));
   drawLine("No-Action Reason",d.rNoActionReason);
   y-=3;
   heading("RESPONDING APPARATUS / CHRONOLOGY");
   const units=Array.isArray(d.responding_apparatus)?d.responding_apparatus:[];
   if(!units.length)drawLine("Responding Apparatus","None recorded");
   for(const u of units){
     const times=u.times||{};
     drawWrap("Unit",[(u.unit_number||u.unit||""),times.enroute?"En Route "+fmtTime(times.enroute):"",times.on_scene?"On Scene "+fmtTime(times.on_scene):"",times.cancelled?"Cancelled "+fmtTime(times.cancelled):"",times.clear?"Clear "+fmtTime(times.clear):""].filter(Boolean).join(" • "));
     if(Array.isArray(u.crew)&&u.crew.length)drawLine("Crew",u.crew.join(", "));
   }
   drawLine("Additional Personnel",Array.isArray(d.additional_personnel)?d.additional_personnel.join(", "):d.additional_personnel);
   y-=3;
   heading("MUTUAL AID / OTHER AGENCIES");
   const aids=[...(Array.isArray(d.aid_records)?d.aid_records:[]),...(Array.isArray(d.nonfd_aid_records)?d.nonfd_aid_records:[])];
   if(!aids.length)drawLine("Aid","None recorded");
   for(const a of aids)drawWrap("Aid",JSON.stringify(a));
   y-=3;
   heading("EXPOSURES / CASUALTIES / HAZARDS");
   const ex=Array.isArray(d.exposures)?d.exposures:[];const ca=Array.isArray(d.casualties)?d.casualties:[];const hz=Array.isArray(d.hazards)?d.hazards:[];
   if(ex.length)for(const x of ex)drawWrap("Exposure",JSON.stringify(x));
   else drawLine("Exposures","None recorded");
   if(ca.length)for(const x of ca)drawWrap("Casualty / Rescue",JSON.stringify(x));
   else drawLine("Casualties / Rescues","None recorded");
   if(hz.length)for(const x of hz)drawWrap("Hazard",JSON.stringify(x));
   else drawLine("Hazards","None recorded");
   y-=3;
   heading("VEHICLE / PROPERTY");
   const vehicles=Array.isArray(d.vehicles)?d.vehicles:[]; 
   if(vehicles.length)for(const v of vehicles)drawWrap("Vehicle",JSON.stringify(v));
   else{
     drawLine("Vehicle #1",d.rVehicle1);
     drawLine("Year",d.rYear1);
     drawLine("Make",d.rMake1);
     drawLine("Model",d.rModel1);
     drawLine("License / VIN",d.rVin1);
   }
   y-=3;
   heading("HAZMAT / SPECIAL HAZARDS");
   drawLine("Evacuation Count",d.rEvac||d.rHazEvacuated);
   drawLine("HAZMAT Disposition",d.rHazmat||d.rHazDisposition);
   drawLine("Chemicals / Present / Released",d.rChemicals);
   drawLine("Electrical Hazard",d.rElectrical);
   drawLine("Other Hazard",d.rOtherHazard);
   y-=3;
   heading("NARRATIVE / COMPLETION");
   y=wrap(page,font,val(d.rNarrative),m,y,usable,9,13);
   drawLine("Report Completed By",d.rCompletedBy);
 };
 for(let i=0;i<fireReports.length;i++)addTechnicalReport(fireReports[i],i);
 if(!fireReports.length){heading("FIRE REPORT");y=wrap(page,font,"No Fire Incident Report data was attached to this incident.",m,y,usable,9,13)}

 // Last section is deliberately the NERIS investigation detail.
 newPage();
 page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:bold,size:17,color:rgb(.65,.02,.02)});y-=22;
 page.drawText("NERIS INVESTIGATION DETAILS",{x:m,y,font:bold,size:13});y-=17;
 y=wrap(page,font,"This section is the technical investigation information associated with the incident and NERIS submission. It is intentionally kept at the end of the report.",m,y,usable,8,11);
 y-=7;
 for(const rep of fireReports){
   const d=rep?.data||{};
   heading("INVESTIGATION");
   drawLine("Investigation Required",d.rInvestigation||d.investigation);
   drawLine("Investigation Type",d.rInvestigationType||d.investigation_type);
   drawLine("Cause",d.rCause||d.cause);
   drawLine("Origin Floor",d.rFloor||d.floor_of_origin);
   drawLine("Origin Room / Area",d.rRoom||d.room_type);
   drawLine("Arrival Condition",d.rCondition||d.condition);
   drawLine("Damage Type",d.rDamageType||d.damage_type);
   drawLine("Damage Estimate",d.rDamageEstimate||d.damage_estimate);
   drawLine("Fire Location",d.rFireLoc||d.fire_location);
   drawLine("Water Supply",d.rWater||d.water_supply);
   drawLine("Smoke Alarm Presence",d.rSmokePresence||d.smoke_alarm_presence);
   drawLine("Smoke Alarm Working",d.rSmokeWorking||d.smoke_alarm_working);
   drawLine("Fire Alarm",d.rFireAlarm||d.fire_alarm);
   drawLine("Other Alarm",d.rOtherAlarm||d.other_alarm);
   drawLine("Suppression System",d.rSuppression||d.suppression_system);
   drawLine("Cooking Fire Suppression",d.rCookingSuppression||d.cooking_suppression);
   const neris=d.neris_investigation||d.nerisInvestigation||d.investigation_details||d.neris?.investigation;
   if(neris&&typeof neris==="object"){
     heading("NERIS INVESTIGATION RECORD");
     for(const [k,v] of Object.entries(neris)){
       if(v===undefined||v===null||v==="")continue;
       const label=String(k).replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
       drawWrap(label,typeof v==="object"?JSON.stringify(v):v);
     }
   }
 }
 if(!fireReports.length)drawLine("NERIS Investigation","No Fire Report investigation data attached.");
 page.drawText("JFD RMS • NERIS Investigation Details",{x:m,y:38,font:reg,size:7,color:rgb(.4,.4,.4)});

 return pdf.save();
}

export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
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
 }catch(e){console.error("JFD report PDF error",e);return res.status(500).json({ok:false,error:e?.message||"Report generation failed"})}
