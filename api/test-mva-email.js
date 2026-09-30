import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
function clean(v){return String(v??"").replace(/\s+/g," ").trim()}
function wrap(v,max=92){const words=clean(v).split(" ").filter(Boolean),out=[];let line="";for(const w of words){const t=line?line+" "+w:w;if(t.length>max&&line){out.push(line);line=w}else line=t}if(line)out.push(line);return out}
async function makeTestPdf(){
 const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,m=42;let page=pdf.addPage([W,H]),y=H-m;
 const text=(s,size=9,font=reg)=>{for(const line of wrap(s)){if(y<60){page=pdf.addPage([W,H]);y=H-m}page.drawText(line,{x:m,y,size,font});y-=size+4}};
 const heading=s=>{if(y<90){page=pdf.addPage([W,H]);y=H-m}page.drawText(s,{x:m,y,size:12,font:bold,color:rgb(.7,.03,.03)});y-=19};
 const row=(l,v)=>{if(!v)return;text(l+": "+v)};
 page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,size:19,font:bold,color:rgb(.7,.03,.03)});y-=27;
 page.drawText("MOTOR VEHICLE COLLISION • TEST INCIDENT REPORT",{x:m,y,size:13,font:bold});y-=24;
 text("CAD / Incident: 2026-22608");text("Location: 3600 BRAKEFIELD DAIRY RD, JASPER, AL");text("Incident Date: 09/29/2026");text("Call Type: MVA");text("Primary Incident Type: Medical — Injury / Trauma — Motor Vehicle Collision");text("Test Record: FICTIONAL PATIENT DATA FOR RMS REPORT TESTING ONLY");
 heading("INCIDENT / RESPONSE");
 row("Dispatch","09/29/2026 1:14 PM");row("Call Arrival","09/29/2026 1:14:07 PM");row("Call Answered","09/29/2026 1:14:30 PM");row("Call Create","09/29/2026 1:15:08 PM");row("Shift","A");row("Responding Apparatus","JAEN2, JAEN3, JAF1");row("Scene","Passenger vehicle vs. tree. Two occupants evaluated. No extrication required.");
 heading("FIRE INCIDENT REPORT");
 text("JFD responded to a reported motor vehicle collision involving a passenger vehicle and a tree. Two occupants were located and evaluated. One patient had a minor right forearm abrasion and reported diabetes. The second patient denied injury. No extrication was required. Both patients remained on scene after evaluation.");
 heading("PATIENT CARE REPORT • PATIENT 1");
 row("Name","Evan Mitchell");row("DOB","04/17/1988");row("Sex","Male");row("Address","214 Oak Ridge Drive, Jasper, AL 35501");row("Chief Complaint","Minor arm abrasion after motor vehicle collision");row("Injury","Right forearm abrasion");row("Care Provided","Yes");row("BLS Methods","Assessment; Wound cleansing; Bandage");row("Medical History","Diabetes mellitus");row("Medications","Metformin");row("Allergies","No known drug allergies reported");row("Vital Signs","09/29/2026 1:22 PM • SpO2 98% • Pulse 88 • Resp 16 • BP 132/84 • Pupils PERRL");row("Disposition","Treated / No Transport");row("Disposition Notes","Patient declined ambulance transport after evaluation and was advised to obtain further medical evaluation.");row("Care Narrative","Ambulatory at scene. Minor right forearm abrasion cleaned and covered. No other obvious injury identified.");
 heading("PATIENT CARE REPORT • PATIENT 2");
 row("Name","Samantha Brooks");row("DOB","11/03/1992");row("Sex","Female");row("Address","88 Pine Street, Jasper, AL 35501");row("Chief Complaint","Evaluation after motor vehicle collision; no injury complaint");row("Injury","None reported");row("Care Provided","No");row("Medical History","No significant medical history reported");row("Medications","None reported");row("Allergies","No known drug allergies reported");row("Vital Signs","09/29/2026 1:24 PM • SpO2 99% • Pulse 82 • Resp 15 • BP 126/78 • Pupils PERRL");row("Disposition","Treated / No Transport");row("Disposition Notes","Patient evaluated and remained on scene. No transport requested.");row("Care Narrative","Patient ambulatory at scene, alert and oriented, and denied injury or pain. Assessment completed with no treatment required.");
 heading("VEHICLE / SCENE INFORMATION");
 row("Vehicle","2021 Ford F-150");row("Test VIN","TESTVIN2026MVA001");row("Insurance","Test Mutual");row("Owner","Test Vehicle Owner");
 heading("DEPARTMENTAL / NERIS INCIDENT DATA");
 row("Location Type","Street");row("Location In Use","Yes");row("Used As Intended","Yes");row("People Present","Yes");row("Actions Taken","Emergency Medical Care; Command And Control");row("Report Status","Ready for NERIS review");row("RMS Test Note","All patient identities and vehicle details in this test record are fictional.");
 for(const [i,p] of pdf.getPages().entries())p.drawText("Jasper Fire Department • JFD RMS MVA TEST • Page "+(i+1)+" of "+pdf.getPages().length,{x:m,y:18,size:7,font:reg,color:rgb(.4,.4,.4)});
 return pdf.save()
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{
  const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
  if(!key||!from)return res.status(503).json({ok:false,error:"Brevo email is not configured in Vercel."});
  const pdf=await makeTestPdf();
  const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD RMS TEST - MVA 2026-22608",textContent:"TEST ONLY: Combined MVA report with two fictional patients. This is a RMS PDF/email formatting test.",attachment:[{content:Buffer.from(pdf).toString("base64"),name:"2026-22608 - JFD RMS MVA TEST.pdf"}]})});
  const t=await er.text();return res.status(er.status).send(t)
 }catch(e){return res.status(500).json({ok:false,error:e?.message||String(e)})}
}