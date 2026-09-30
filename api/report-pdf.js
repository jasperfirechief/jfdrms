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
 const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),font={reg,bold},W=612,H=792,m=42;
 let page=pdf.addPage([W,H]),y=H-m;
 page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:bold,size:20,color:rgb(.65,.02,.02)});y-=27;
 page.drawText("PUBLIC INCIDENT SUMMARY",{x:m,y,font:bold,size:14});y-=20;
 y=wrap(page,font,"CAD / Incident: "+text(incident?.cad||incident?.incident_number||"Manual"),m,y,W-2*m,10,13,true);
 y=wrap(page,font,"Type: "+text(reports?.[0]?.data?.rPrimaryIncidentType||incident?.type||"Incident"),m,y,W-2*m,10,13);
 y=wrap(page,font,"Location: "+text(incident?.location||"Location not provided"),m,y,W-2*m,10,13);
 y-=10;
 const pCount=reports.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]).length;
 const transported=reports.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]).filter(p=>String(p.transportDisposition||"").startsWith("Transport")).length;
 const refused=reports.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]).filter(p=>p.refusedTransport||p.minorRefusal||p.transportDisposition==="Patient Refused Transport").length;
 for(const [label,val] of [["Patients",pCount||"None"],["Transported",transported],["Refused Transport",refused],["Report Date",fmtDate(incident?.dispatch_time)]])y=line(page,font,label,val,y,m);
 y-=8;page.drawText("PUBLIC SUMMARY",{x:m,y,font:bold,size:11});y-=16;
 const narrative=reports.map(r=>r?.data?.rNarrative).filter(Boolean).join("\n\n")||reports.flatMap(r=>r?.data?.patients||[]).map(p=>p.narrative).filter(Boolean).join("\n\n")||"Jasper Fire Department responded and documented the incident.";
 y=wrap(page,font,narrative,m,y,W-2*m,9,12);
 y-=10;page.drawText("Patient names, medical details, signatures, and other restricted departmental information are contained on subsequent pages.",{x:m,y,font:reg,size:7,color:rgb(.4,.4,.4)});
 for(const rep of reports){
   const data=rep?.data||{};
   page=pdf.addPage([W,H]);y=header(page,font,title(rep?.report_type),incident,m);
   if(String(rep?.report_type||"").startsWith("pcr_")){
     const patients=Array.isArray(data.patients)?data.patients:[];
     const units=Array.isArray(data.responding_apparatus)?data.responding_apparatus:[];
     ({page,y}=section(page,font,"INCIDENT / RESPONSE",y,m));
     y=line(page,font,"Primary Incident Type",data.rPrimaryIncidentType,y,m);
     y=line(page,font,"Shift",data.rShift,y,m);
     y=line(page,font,"Call Arrival",fmtTime(data.rCallArrival),y,m);
     y=line(page,font,"Call Answered",fmtTime(data.rCallAnswered),y,m);
     y=line(page,font,"Call Create",fmtTime(data.rCallCreate),y,m);
     y-=4;
     ({page,y}=section(page,font,"RESPONDING APPARATUS",y,m));
     for(const u of units){y=wrap(page,font,(u.unit_number||"Unit")+" · "+(u.crew||[]).join(", "),m,y,W-2*m,8,11,true);}
     for(let pi=0;pi<patients.length;pi++){
       const p=patients[pi]||{};
       if(pi>0){page=pdf.addPage([W,H]);y=header(page,font,"PATIENT CARE REPORT · PATIENT "+(pi+1),incident,m)}else{y-=5;page.drawText("PATIENT "+(pi+1),{x:m,y,font:bold,size:14});y-=20}
       ({page,y}=section(page,font,"PATIENT INFORMATION",y,m));
       y=line(page,font,"Name",p.name,y,m);y=line(page,font,"DOB",fmtDate(p.dob),y,m);y=line(page,font,"Sex",p.gender,y,m);y=line(page,font,"Address",p.address,y,m);y=line(page,font,"Chief Complaint",p.chief,y,m);y=line(page,font,"Injury",p.injury,y,m);
       ({page,y}=section(page,font,"CARE",y,m));
       y=line(page,font,"Care Provided",p.careProvided==="yes"?"Yes":"No",y,m);
       if(Array.isArray(p.careMethods)&&p.careMethods.length)y=wrap(page,font,"BLS Methods: "+p.careMethods.join(", "),m,y,W-2*m,8,11);
       if(p.narrative)y=wrap(page,font,"Care Notes: "+p.narrative,m,y,W-2*m,8,11);
       if(Array.isArray(p.vitals)&&p.vitals.length){
         ({page,y}=section(page,font,"VITALS",y,m));
         for(const v of p.vitals)y=wrap(page,font,["Time "+v.time,"O₂ Sat "+v.o2,"Pulse "+v.pulse,"Resp "+v.resp,"BP "+v.bp,"Pupils "+v.pupils].filter(x=>x.split(" ").slice(1).join(" ")).join(" · "),m,y,W-2*m,8,11);
       }
       ({page,y}=section(page,font,"DISPOSITION / TRANSPORT",y,m));
       y=line(page,font,"Disposition",p.transportDisposition,y,m);
       y=line(page,font,"Vehicle / Unit",p.transportVehicle,y,m);
       y=line(page,font,"Transporting Agency",p.transportAgency,y,m);
       y=line(page,font,"Destination",p.destination,y,m);
       y=line(page,font,"Vehicle",([p.vehicleYear,p.vehicleMake,p.vehicleModel].filter(Boolean).join(" ")),y,m);
       y=line(page,font,"License / VIN",p.vehicleVin,y,m);
       y=line(page,font,"Insurance",p.insurance,y,m);
       y=line(page,font,"Policy",p.policy,y,m);
       if(p.dispositionNote)y=wrap(page,font,"Disposition Notes: "+p.dispositionNote,m,y,W-2*m,8,11);
       if(p.refusedCare||p.refusedTransport||p.minorRefusal){
         ({page,y}=section(page,font,"REFUSAL DOCUMENTATION",y,m));
         y=wrap(page,font,"Patient/Guardian was advised of the risks of refusing medical evaluation, treatment, and/or transport. The patient/guardian indicated understanding and declined the documented care or transport.",m,y,W-2*m,8,11);
         y=line(page,font,"Refusal Type",[(p.refusedCare?"Refused evaluation/care":""),(p.refusedTransport?"Refused transport":""),(p.minorRefusal?"Parent/Guardian refusal":"")].filter(Boolean).join("; "),y,m);
         y=line(page,font,"Patient / Guardian",p.refusalSigner,y,m);y=line(page,font,"Refusal Date/Time",fmtTime(p.refusalTime),y,m);
         if(Array.isArray(p.minorPatients)&&p.minorPatients.length){y=wrap(page,font,"Minor Patients: "+p.minorPatients.map(x=>x.name+" ("+fmtDate(x.dob)+")").join("; "),m,y,W-2*m,8,11)}
         if(p.signature){y-=3;page.drawText("Patient / Guardian Signature",{x:m,y,font:bold,size:8});y-=8;try{const img=await pdf.embedPng(Buffer.from(String(p.signature).split(",")[1],"base64"));page.drawImage(img,{x:m,y:y-65,width:240,height:60});page.drawRectangle({x:m,y:y-65,width:240,height:60,borderWidth:.5,borderColor:rgb(.6,.6,.6)});y-=78}catch{}}
         y=line(page,font,"Provider Signature","JFD RMS user / electronic record",y,m);
       }
     }
   }else{
     ({page,y}=section(page,font,"INCIDENT DETAILS",y,m));
     for(const [label,key] of [["Primary Incident Type","rPrimaryIncidentType"],["Call Type","rCall"],["Shift","rShift"],["Location Type","rLocationType"],["Primary Use","rPrimaryUse"],["Location In Use","rLocationInUse"],["Used As Intended","rUsedAsIntended"],["People Present","rPeoplePresent"],["Narrative","rNarrative"]])y=wrap(page,font,label+": "+text(data[key]),m,y,W-2*m,8,11,true);
     const units=Array.isArray(data.responding_apparatus)?data.responding_apparatus:[];
     if(units.length){({page,y}=section(page,font,"RESPONDING APPARATUS",y,m));for(const u of units)y=wrap(page,font,(u.unit_number||"Unit")+" · En Route "+text(u.times?.enroute)+" · On Scene "+text(u.times?.on_scene)+" · Clear "+text(u.times?.clear),m,y,W-2*m,8,11);}
   }
 }
 return pdf.save();
}
function title(t){return String(t||"").startsWith("pcr_")?"PATIENT CARE REPORT":String(t||"").startsWith("fire_")?"FIRE INCIDENT REPORT":"INCIDENT REPORT"}
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
