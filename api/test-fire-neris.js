import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const BASE_URL=String(process.env.NERIS_BASE_URL||"https://api-test.neris.fsri.org/v1").replace(/\/$/,"");
const CLIENT_ID=String(process.env.NERIS_CLIENT_ID||"");
const CLIENT_SECRET=String(process.env.NERIS_CLIENT_SECRET||"");
const DEPARTMENT_ID=String(process.env.NERIS_DEPARTMENT_ID||"");
const BREVO_API_KEY=String(process.env.BREVO_API_KEY||"");
const BREVO_FROM_EMAIL=String(process.env.BREVO_FROM_EMAIL||"");

async function token(){
  const basic=Buffer.from(CLIENT_ID+":"+CLIENT_SECRET).toString("base64");
  const r=await fetch(BASE_URL+"/token",{method:"POST",headers:{"Authorization":"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded","User-Agent":"JasperFireDepartmentRMS/1.0"},body:"grant_type=client_credentials"});
  const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={raw:t}};
  if(!r.ok||!d.access_token)throw new Error("NERIS authentication failed: "+r.status);
  return d.access_token;
}

function payload(){
  const dispatch="2026-09-27T13:38:55Z",enroute="2026-09-27T13:39:20Z",scene="2026-09-27T13:43:10Z",clear="2026-09-27T14:22:00Z";
  const location={country:"US",state:"AL",postal_community:"Jasper",place_type:"RESIDENCE",number:701,street:"5TH ST W"},point={crs:4326,geometry:{type:"Point",coordinates:[-87.283454,33.846481]}};
  return {
    base:{department_neris_id:DEPARTMENT_ID,incident_number:"2026-22426",location,point,outcome_narrative:"TEST ONLY - JFD RMS NERIS test submission. Structure fire test; no real incident reporting. Test record created for integration validation."},
    incident_types:[{type:"FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE"}],
    dispatch:{incident_number:"2026-22426",call_arrival:dispatch,call_answered:enroute,call_create:scene,location,point,unit_responses:[{reported_unit_id:"JA",dispatch:dispatch,enroute_to_scene:enroute,on_scene:scene,unit_clear:clear,unable_to_dispatch:false}]},
    fire_detail:{location_detail:{type:"STRUCTURE",arrival_condition:"SMOKE_FIRE_SHOWING",progression_evident:true,damage_type:"MODERATE_DAMAGE",floor_of_origin:1,room_of_origin_type:"KITCHEN",cause:"OPERATING_EQUIPMENT"},water_supply:"TANK_WATER",investigation_needed:"NO",investigation_types:[]},
    smoke_alarm:{presence:{type_rr_presence:"PRESENT"}},fire_alarm:{presence:{type_rr_presence:"NOT_PRESENT"}},other_alarm:{presence:{type_rr_presence:"NOT_APPLICABLE"}},fire_suppression:{presence:{type_rr_presence:"NOT_PRESENT"}}
  };
}

export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"GET only"});
  try{
    const p=payload(),t=await token();
    const vr=await fetch(BASE_URL+"/incident/"+encodeURIComponent(DEPARTMENT_ID)+"/validate",{method:"POST",headers:{"Authorization":"Bearer "+t,"Content-Type":"application/json","User-Agent":"JasperFireDepartmentRMS/1.0"},body:JSON.stringify(p)});
    const vt=await vr.text();let vd;try{vd=JSON.parse(vt)}catch{vd={raw:vt}};
    if(!vr.ok)return res.status(422).json({ok:false,stage:"validate",status:vr.status,details:vd,payload:p});
    const sr=await fetch(BASE_URL+"/incident/"+encodeURIComponent(DEPARTMENT_ID),{method:"POST",headers:{"Authorization":"Bearer "+t,"Content-Type":"application/json","User-Agent":"JasperFireDepartmentRMS/1.0"},body:JSON.stringify(p)});
    const st=await sr.text();let sd;try{sd=JSON.parse(st)}catch{sd={raw:st}};
    if(!sr.ok)return res.status(502).json({ok:false,stage:"submit",status:sr.status,details:sd,payload:p});
    const reportData={rCad:"2026-22426",rCall:"STRUCTURE FIRE",rDate:"2026-09-27",rShift:"A",rLocation:"701 5TH ST W, JASPER, AL",rLatitude:"33.846481",rLongitude:"-87.283454",rPrimaryIncidentType:"FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE",rLocationType:"RESIDENCE",rFireLoc:"Structure",rCondition:"Smoke and Fire Showing",rDamageType:"Moderate",rCause:"Operating Equipment",rWater:"Tank Water",rInvestigation:"No",rNarrative:"TEST ONLY - JFD RMS NERIS test submission. Structure fire test; no real incident reporting. Test record created for integration validation.",responding_apparatus:[{unit_number:"JA",times:{enroute:"2026-09-27T13:39:20Z",on_scene:"2026-09-27T13:43:10Z",clear:"2026-09-27T14:22:00Z"},crew:[]}]};
    const pdfDoc=await PDFDocument.create(),reg=await pdfDoc.embedFont(StandardFonts.Helvetica),bold=await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page=pdfDoc.addPage([612,792]);let y=748;
    page.drawText("JASPER FIRE DEPARTMENT",{x:42,y,font:bold,size:20,color:rgb(.65,.02,.02)});y-=28;
    page.drawText("FIRE INCIDENT REPORT • NERIS TEST",{x:42,y,font:bold,size:13});y-=24;
    for(const [label,value] of [["CAD / Incident","2026-22426"],["Call Type","STRUCTURE FIRE"],["Location","701 5TH ST W, JASPER, AL"],["Incident Type","FIRE — STRUCTURE FIRE — STRUCTURAL INVOLVEMENT FIRE"],["Date","09/27/2026"],["Arrival Condition","Smoke and Fire Showing"],["Damage","Moderate"],["Cause","Operating Equipment"],["Narrative",reportData.rNarrative]]){page.drawText(label,{x:42,y,font:bold,size:8});y-=11;const words=String(value||"").split(/\\s+/);let line="";for(const word of words){const tt=line?line+" "+word:word;if(reg.widthOfTextAtSize(tt,9)>510&&line){page.drawText(line,{x:42,y,font:reg,size:9});y-=12;line=word}else line=tt}if(line){page.drawText(line,{x:42,y,font:reg,size:9});y-=12}y-=5;}
    page.drawText("NERIS TEST SUBMISSION",{x:42,y,font:bold,size:11});y-=16;page.drawText("Validation and submission were performed against the NERIS test environment.",{x:42,y,font:reg,size:8});
    const pdf=await pdfDoc.save();
    if(BREVO_API_KEY&&BREVO_FROM_EMAIL){
      const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO_API_KEY,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:BREVO_FROM_EMAIL,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD RMS TEST - Fire Report - NERIS 2026-22426",textContent:"JFD RMS test fire report. NERIS validation and test submission succeeded. Attached is the fire report PDF.",attachment:[{content:Buffer.from(pdf).toString("base64"),name:"2026-22426 - JFD Fire Report - NERIS TEST.pdf"}]})});
      const et=await er.text();let ed;try{ed=JSON.parse(et)}catch{ed={raw:et}};
      return res.status(er.ok?200:502).json({ok:er.ok,neris_incident_id:sd?.uid||sd?.neris_id||sd?.incident?.uid||sd?.incident?.neris_id||null,neris_response:sd,email:er.ok?ed:null,email_error:er.ok?null:ed});
    }
    return res.status(200).json({ok:true,neris_incident_id:sd?.uid||sd?.neris_id||sd?.incident?.uid||sd?.incident?.neris_id||null,neris_response:sd,email:"Brevo not configured"});
  }catch(e){console.error("JFD fire NERIS test error",e);return res.status(500).json({ok:false,error:e?.message||"Test failed"});}
}
