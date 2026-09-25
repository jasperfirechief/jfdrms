import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";

const sections = [
  {name:"FIRE EXTINGUISHERS", items:[
    ["Inspections current, properly tagged","IFC 2024 §906.2"],
    ["Proper number, type, mounting, signage, distance, unobstructed, readiness","IFC 2024 §§906.1, 906.6"],
    ["No obvious damage or tampering","IFC 2024 §906.2"]
  ]},
  {name:"SPRINKLER SYSTEM", items:[
    ["Inspection current/properly tagged","IFC 2024 §903.5"],
    ["FDC in ready condition","IFC 2024 §912.4"],
    ["Acceptance test conducted","IFC 2024 §901.6; NFPA 25"]
  ]},
  {name:"EXITS / EGRESS", items:[
    ["Appropriate number and unobstructed width of exits","IFC 2024 §§1005, 1006"],
    ["Appropriate unobstructed width of exit access","IFC 2024 §1005"],
    ["Appropriate travel distance","IFC 2024 §1017.2"],
    ["Outward swinging/appropriate hardware","IFC 2024 §1010"],
    ["Appropriate signage/lighting","IFC 2024 §§1008, 1013"],
    ["Appropriate exit discharge width, lighting, unobstructed","IFC 2024 §§1008, 1028"],
    ["Acceptance test conducted","IFC 2024 §901.6; applicable system standard"]
  ]},
  {name:"FIRE ALARM SYSTEM", items:[
    ["Inspection current/properly tagged","IFC 2024 §907.8"],
    ["No obvious damage or tampering","IFC 2024 §901.8"],
    ["In ready state","IFC 2024 §907.8"],
    ["Appropriate detectors and alarms (audible and visual)","IFC 2024 §907.5"],
    ["Appropriate emergency lighting","IFC 2024 §1008"],
    ["Call-out test conducted","IFC 2024 §907.8"],
    ["System acceptance test conducted","IFC 2024 §901.6; NFPA 72"]
  ]},
  {name:"CLEARANCES", items:[
    ["Adequate clearance around electrical panels, fire alarm panels, standpipes, sprinkler risers, FDCs","IFC 2024 §§604.3, 912.4"],
    ["Adequate clearance below ceiling/sprinkler heads","IFC 2024 §315.3.1; §903.3"],
    ["Adequate clearance around heat sources","IFC 2024 §315.3.1"],
  ]},
  {name:"COMMERCIAL KITCHEN HOOD SYSTEM", items:[
    ["Inspection current/properly tagged","IFC 2024 §904.14.5"],
    ["No obvious damage or tampering","IFC 2024 §901.8"],
    ["Appropriate nozzles/caps in place","IFC 2024 §904.14; NFPA 17A/96 as applicable"],
    ["No excessive grease build up on equipment, hood, ducts, fan, etc.","IFC 2024 §904.14; NFPA 96"],
    ["Hood system acceptance test conducted","IFC 2024 §904.14; NFPA 96"]
  ]},
  {name:"OTHER", items:[
    ["Appropriately posted address (rear on strip occupancies)","IFC 2024 §505.1"],
    ["Dumpster/combustibles too close to building","IFC 2024 §304.1; §315"],
    ["Appropriately posted occupancy limit signage","IFC 2024 §1004.9"],
    ["No voids in ceiling (holes, tiles, etc.)","IFC 2024 §703.1"],
    ["Proper electrical wiring/covers","IFC 2024 Chapter 6"],
    ["Required test/drill logs or emergency plan available/complete/up-to-date","IFC 2024 §405; applicable occupancy section"],
    ["Required MSDS/SDS available/complete/up-to-date","IFC 2024 Chapter 50; applicable hazardous-material requirements"],
    ["Required documentation available/complete/up-to-date","IFC 2024 §901.6; applicable system/occupancy section"]
  ]},
  {name:"FLAMMABLE LIQUIDS / HAZARDOUS MATERIALS", items:[
    ["Flammable liquids/gas cylinders/hazardous materials stored correctly; proper signage on building where used/stored","IFC 2024 Chapters 50-57"]
  ]}
];

function esc(v){return String(v ?? "").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function wrap(text,font,size,maxWidth){
  const words=String(text||"").split(/\s+/); const lines=[]; let line="";
  for(const w of words){const test=line?line+" "+w:w;if(font.widthOfTextAtSize(test,size)<=maxWidth) line=test;else{if(line)lines.push(line);line=w;}}
  if(line)lines.push(line); return lines.length?lines:[""];
}
function moneyless(v){return v==null?"":String(v)}

async function getCaller(auth){
  const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
  if(!r.ok) throw new Error("Invalid or expired session");
  return await r.json();
}
async function rest(path, auth, opts={}){
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{
    ...opts,
    headers:{apikey:SUPABASE_KEY,Authorization:auth,"Content-Type":"application/json",Prefer:"return=representation",...(opts.headers||{})}
  });
  const raw=await r.text(); let data; try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!r.ok) throw new Error(typeof data==="string"?data:(data?.message||data?.hint||data?.details||"Database request failed"));
  return data;
}
async function makePdf(data){
  const pdf=await PDFDocument.create(); const regular=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=612,H=792, margin=40, contentW=W-margin*2; let page=pdf.addPage([W,H]), y=H-margin;
  const red=rgb(.78,.05,.05), gray=rgb(.35,.39,.45);
  function text(t,x,yy,size=9,font=regular,color=rgb(0,0,0)){page.drawText(String(t||""),{x,y:yy,size,font,color});}
  function ensure(h){if(y-h<margin){page=pdf.addPage([W,H]);y=H-margin;return true}return false}
  function heading(t){ensure(30);text(t,margin,y,13,bold,red);y-=19;page.drawLine({start:{x:margin,y},end:{x:W-margin,y},thickness:1,color:rgb(.85,.87,.9)});y-=12}
  function field(label,value){ensure(22);text(label,margin,y,8,bold,gray);text(value,margin+95,y,9,regular);y-=15}
  text("JASPER FIRE DEPARTMENT",margin,y,16,bold,red); y-=19; text("FIRE INSPECTION REPORT",margin,y,11,bold); y-=24;
  field("Inspector",data.inspector_name); field("Date",data.inspection_date); field("Time",data.inspection_time||""); field("Occupancy Name",data.occupancy_name);
  field("Type",data.occupancy_type||""); field("Address",data.address); field("Contact Name",data.contact_name); field("City/St/Zip",data.city_state_zip);
  field("Contact Phone",data.contact_phone); field("Phone",data.phone); field("Email",data.email);
  field("Inspection Type",data.inspection_type+(data.acceptance_type?" ("+data.acceptance_type+")":""));
  heading("ACCEPTANCE TEST RESULTS");
  text("Overall: "+(data.acceptance_test_result||"N/A"),margin,y,9,bold); y-=15;
  if(data.acceptance_test_notes){text("Notes:",margin,y,8,bold);y-=12;for(const l of wrap(data.acceptance_test_notes,regular,9,contentW)){ensure(12);text(l,margin,y,9);y-=11}}
  for(const s of sections){heading(s.name);for(const [item,ref] of s.items){const result=data.results?.[item]||"N/A";ensure(35);const lines=wrap(item,regular,9,contentW-120);for(let i=0;i<lines.length;i++){text(lines[i],margin,y,9,regular)}const firstY=y;const resultText="["+result.toUpperCase()+"]";text(resultText,W-margin-75,firstY,8,bold,result==="Fail"?red:gray);y-=11*(lines.length);text(ref,margin,y,7,regular,gray);y-=14}}
  heading("REMARKS"); for(const l of wrap(data.remarks||"",regular,9,contentW)){ensure(12);text(l,margin,y,9);y-=11}
  heading("NOTICE"); const notice="NOTE: This report is based upon observations at the time of the survey which may not discover all hazards. IN THE INTEREST OF FIRE SAFETY AND TO COMPLY WITH THE CITY OF JASPER FIRE CODE, ALL VIOLATIONS NOTED ABOVE MUST BE CORRECTED IMMEDIATELY. FAILURE TO COMPLY MAY RESULT IN PENALTIES AS SET FORTH IN THE FIRE CODE.";
  for(const l of wrap(notice,regular,8,contentW)){ensure(11);text(l,margin,y,8);y-=10}
  if(data.reinspection_date){ensure(20);text("REINSPECTION DATE: "+data.reinspection_date,margin,y,9,bold);y-=18}
  heading("RECEIPT OF NOTICE ACKNOWLEDGED");
  text("Building Representative:",margin,y,9,bold);y-=15;
  if(data.representative_signature?.startsWith("data:image/")){try{const b64=data.representative_signature.split(",")[1];const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const img=await pdf.embedPng(bytes);const scale=Math.min(180/img.width,55/img.height);ensure(65);page.drawImage(img,{x:margin,y:y-45,width:img.width*scale,height:img.height*scale});y-=60;}catch{ text("[Signature captured digitally]",margin,y,8,gray);y-=15;}}
  text("Date: "+(data.representative_signature_date||data.inspection_date),margin+320,y+45,9); text("Fire Inspector: "+data.inspector_name,margin+320,y+28,9); text("Date: "+data.inspection_date,margin+320,y+11,9); y-=25;
  const pages=pdf.getPages(); pages.forEach((p,i)=>{p.drawText("Jasper Fire Department • Fire Inspection Report • Page "+(i+1)+" of "+pages.length,{x:margin,y:18,size:7,font:regular,color:gray})});
  return await pdf.save();
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const auth=req.headers.authorization||""; if(!auth.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
  try{
    const caller=await getCaller(auth);
    const profiles=await rest("users?select=user_id,first_name,last_name,email,app_role,active&user_id=eq."+encodeURIComponent(caller.id),auth);
    const profile=profiles?.[0]; if(!profile?.active) throw new Error("Active RMS profile required.");
    let authorized=profile.app_role==="admin";
    if(!authorized && profile.app_role==="officer"){
      const people=await rest("personnel?select=id,auth_user_id&auth_user_id=eq."+encodeURIComponent(caller.id)+"&active=eq.true",auth);
      const pid=people?.[0]?.id;
      if(pid){
        const ds=await rest("daily_staffing?select=staffing_id&staffing_date=eq."+new Date().toISOString().slice(0,10)+"&shift=eq.daily&limit=1",auth);
        if(ds?.[0]){
          const pa=await rest("daily_personnel_assignments?select=personnel_id&staffing_id=eq."+encodeURIComponent(ds[0].staffing_id)+"&personnel_id=eq."+encodeURIComponent(pid)+"&limit=1",auth);
          authorized=!!pa?.length;
        }
      }
    }
    if(!authorized) throw new Error("Only administrators and on-duty officers may submit inspections.");
    let body=await req.body; if(typeof body==="string") body=JSON.parse(body); if(!body||typeof body!=="object") throw new Error("Inspection data is required.");
    const required=["occupancy_name","address","inspection_type"]; for(const k of required)if(!String(body[k]||"").trim())throw new Error(k.replace(/_/g," ")+" is required.");
    const inspectorName=(profile.first_name+" "+profile.last_name).trim();
    body.inspector_user_id=caller.id; body.inspector_name=inspectorName; body.inspection_date=body.inspection_date||new Date().toISOString().slice(0,10); body.inspection_time=body.inspection_time||new Date().toTimeString().slice(0,5);
    const row={apparatus_id:body.apparatus_id||null,inspector_user_id:caller.id,inspection_date:body.inspection_date,inspection_time:body.inspection_time,status:"complete",notes:body.acceptance_test_notes||"",checklist:body.results||{},occupancy_name:body.occupancy_name,inspection_type:body.inspection_type,acceptance_type:body.acceptance_type||null,address:body.address,city_state_zip:body.city_state_zip,contact_name:body.contact_name,contact_phone:body.contact_phone,phone:body.phone,email:body.email,acceptance_test_result:body.acceptance_test_result||"N/A",results:body.results||{},remarks:body.remarks||"",reinspection_date:body.reinspection_date||null,representative_signature:body.representative_signature||null,representative_signature_date:body.representative_signature_date||body.inspection_date};
    const saved=await rest("inspections",auth,{method:"POST",body:JSON.stringify(row)}); const inspection=saved[0];
    const pdfBytes=await makePdf({...body,inspector_name:inspectorName});
    let emailStatus="not_configured";
    const key=process.env.SENDGRID_API_KEY; const from=process.env.SENDGRID_FROM_EMAIL||"noreply@jaspercity.com";
    const recipients=["deputyfirechief@jaspercity.com"]; if(body.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)&&body.email.toLowerCase()!=="deputyfirechief@jaspercity.com")recipients.push(body.email);
    if(key){
      const sg=await fetch("https://api.sendgrid.com/v3/mail/send",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:recipients.map(email=>({email}))}],from:{email:from,name:"Jasper Fire Department"},subject:"Fire Inspection Report - "+body.occupancy_name,content:[{type:"text/plain",value:"Attached is the completed fire inspection report for "+body.occupancy_name+"."}],attachments:[{content:Buffer.from(pdfBytes).toString("base64"),type:"application/pdf",filename:"Jasper-Fire-Inspection-"+inspection.inspection_id+".pdf",disposition:"attachment"}]})});
      if(!sg.ok)throw new Error("Inspection saved, but email delivery failed: "+await sg.text());
      emailStatus="sent"; await rest("inspections?inspection_id=eq."+encodeURIComponent(inspection.inspection_id),auth,{method:"PATCH",body:JSON.stringify({email_status:"sent",emailed_at:new Date().toISOString()})});
    }
    return res.status(200).json({ok:true,inspection_id:inspection.inspection_id,email_status:emailStatus});
  }catch(err){console.error("Inspection submit error",err);return res.status(400).json({error:err?.message||"Unable to submit inspection."})}
}
