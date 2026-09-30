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
  const dispatch="2026-09-29T21:16:34Z",enroute="2026-09-29T21:17:20Z",scene="2026-09-29T21:21:10Z",clear="2026-09-29T21:35:00Z";
  return {
    base:{
      department_neris_id:DEPARTMENT_ID,
      incident_number:"2026-22633",
      incident_types:["FIRE||OUTSIDE_FIRE||VEGETATION_GRASS_FIRE"],
      incident_final_type_primary:[true],
      location:{latitude:33.8457183837891,longitude:-87.2968978881836},
      outcome_narrative:"TEST ONLY - JFD RMS NERIS test submission. Brush/grass fire response; fire extinguished with no reported injuries or fatalities."
    },
    dispatch:{
      incident_number:"2026-22633",
      call_arrival:dispatch,
      call_answered:enroute,
      call_create:dispatch,
      location:{latitude:33.8457183837891,longitude:-87.2968978881836},
      unit_responses:[{reported_unit_id:"JA",dispatch:dispatch,enroute_to_scene:enroute,on_scene:scene,unit_clear:clear,unable_to_dispatch:false}]
    },
    fire_detail:{
      location_detail:{
        type:"OUTSIDE",
        arrival_condition:"SMOKE_FIRE_SHOWING",
        damage_type:"NO_DAMAGE",
        cause:"ACT_OF_NATURE"
      }
    }
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
    const report={report_type:"fire_neris_v2",status:"submitted_to_neris",data:{
      rCad:"2026-22633",rCall:"BRUSH-WOODS FIRE",rDate:"2026-09-29",rShift:"A",
      rLocation:"6TH ST W & 18TH AVE SW, JASPER, AL",rLatitude:"33.8457183837891",rLongitude:"-87.2968978881836",
      rPrimaryIncidentType:"FIRE||OUTSIDE_FIRE||VEGETATION_GRASS_FIRE",rLocationType:"OUTDOORS",rFireLoc:"Outside",
      rCondition:"Smoke and Fire Showing",rDamageType:"No Damage",rCause:"Act Of Nature",rWater:"",rInvestigation:"No",
      rNarrative:"TEST ONLY - JFD RMS NERIS test submission. Brush/grass fire response; fire extinguished with no reported injuries or fatalities.",
      responding_apparatus:[{unit_number:"JA",times:{enroute,on_scene:scene,clear},crew:[]}]
    }};
    const pdfDoc=await PDFDocument.create(),reg=await pdfDoc.embedFont(StandardFonts.Helvetica),bold=await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page=pdfDoc.addPage([612,792]);let y=748;
    page.drawText("JASPER FIRE DEPARTMENT",{x:42,y,font:bold,size:20,color:rgb(.65,.02,.02)});y-=28;
    page.drawText("FIRE INCIDENT REPORT • NERIS TEST",{x:42,y,font:bold,size:13});y-=24;
    for(const [label,value] of [["CAD / Incident","2026-22633"],["Call Type","BRUSH-WOODS FIRE"],["Location","6TH ST W & 18TH AVE SW, JASPER, AL"],["Incident Type","FIRE — OUTSIDE FIRE — VEGETATION / GRASS FIRE"],["Date","09/29/2026"],["Arrival Condition","Smoke and Fire Showing"],["Damage","No Damage"],["Cause","Act of Nature"],["Narrative",report.data.rNarrative]]){page.drawText(label,{x:42,y,font:bold,size:8});y-=11;const words=String(value||"").split(/\\s+/);let line="";for(const word of words){const t=line?line+" "+word:word;if(reg.widthOfTextAtSize(t,9)>510&&line){page.drawText(line,{x:42,y,font:reg,size:9});y-=12;line=word}else line=t}if(line){page.drawText(line,{x:42,y,font:reg,size:9});y-=12}y-=5;}
    page.drawText("NERIS TEST SUBMISSION",{x:42,y,font:bold,size:11});y-=16;
    page.drawText("Validation and submission were performed against the NERIS test environment.",{x:42,y,font:reg,size:8});
    const pdf=await pdfDoc.save();
    if(BREVO_API_KEY&&BREVO_FROM_EMAIL){
      const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO_API_KEY,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:BREVO_FROM_EMAIL,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD RMS TEST - Fire Report - NERIS 2026-22633",textContent:"JFD RMS test fire report. NERIS validation and test submission succeeded. Attached is the fire report PDF.",attachment:[{content:Buffer.from(pdf).toString("base64"),name:"2026-22633 - JFD Fire Report - NERIS TEST.pdf"}]})});
      const et=await er.text();let ed;try{ed=JSON.parse(et)}catch{ed={raw:et}};
      return res.status(er.ok?200:502).json({ok:er.ok,neris_incident_id:sd?.uid||sd?.neris_id||sd?.incident?.uid||sd?.incident?.neris_id||null,neris_response:sd,email:er.ok?ed:null,email_error:er.ok?null:ed});
    }
    return res.status(200).json({ok:true,neris_incident_id:sd?.uid||sd?.neris_id||sd?.incident?.uid||sd?.incident?.neris_id||null,neris_response:sd,email:"Brevo not configured"});
  }catch(e){console.error("JFD fire NERIS test error",e);return res.status(500).json({ok:false,error:e?.message||"Test failed"});}
}
