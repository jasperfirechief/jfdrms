import { makePdf } from "./report-pdf.js";
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
  const incident={cad:"2026-22608",type:"MOTOR VEHICLE ACCIDENT",location:"3600 BRAKEFIELD DAIRY RD, JASPER, AL",dispatch_time:"2026-09-29T18:14:07Z"};
  const reports=[
    {report_type:"fire_neris_v2",status:"ready_for_neris",data:{
      rPrimaryIncidentType:"MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION",rCall:"MVA",rShift:"A",rLocationType:"STREET",rNarrative:"JFD responded to a reported motor vehicle collision involving a passenger vehicle and a tree. Two occupants were located and evaluated. One patient had a minor right forearm abrasion and reported diabetes. The second patient denied injury. No extrication was required. Both patients remained on scene after evaluation.",
      responding_apparatus:[{unit_number:"JAEN2",times:{enroute:"2026-09-29T13:14:30",on_scene:"2026-09-29T13:18:12",clear:"2026-09-29T13:42:00"}},{unit_number:"JAEN3",times:{enroute:"2026-09-29T13:14:32",on_scene:"2026-09-29T13:18:25",clear:"2026-09-29T13:41:30"}},{unit_number:"JAF1",times:{enroute:"2026-09-29T13:14:35",on_scene:"2026-09-29T13:18:40",clear:"2026-09-29T13:40:55"}}],
      rLocationInUse:"Yes",rUsedAsIntended:"Yes",rPeoplePresent:"Yes",rPrimaryUse:"ROADWAY_ACCESS||STREET",rActionTaken:"true"
    }},
    {report_type:"pcr_neris_v2",status:"ready_for_neris",data:{
      rPrimaryIncidentType:"MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION",rShift:"A",rCallArrival:"2026-09-29T13:14:07",rCallAnswered:"2026-09-29T13:14:30",rCallCreate:"2026-09-29T13:15:08",
      rNarrative:"Two patients evaluated after a motor vehicle collision. Patient 1 had a minor right forearm abrasion and a history of diabetes. Patient 2 denied injury. Both remained alert and oriented and no ambulance transport was requested.",
      patients:[
        {name:"Evan Mitchell",dob:"1988-04-17",gender:"Male",address:"214 Oak Ridge Drive, Jasper, AL 35501",chief:"Minor arm abrasion after motor vehicle collision",injury:"Right forearm abrasion",careProvided:"yes",careMethods:["Assessment","Wound cleansing","Bandage"],narrative:"Ambulatory at scene. Minor right forearm abrasion cleaned and covered. No other obvious injury identified.",vitals:[{time:"2026-09-29T13:22:00",o2:"98",pulse:"88",resp:"16",bp:"132/84",pupils:"PERRL"}],transportDisposition:"Treated / No Transport",transportVehicle:"",transportAgency:"",destination:"",vehicleYear:"2021",vehicleMake:"Ford",vehicleModel:"F-150",vehicleVin:"TESTVIN2026MVA001",insurance:"Test Mutual",policy:"TEST-POLICY-001",history:"Diabetes mellitus",meds:"Metformin",allergies:"No known drug allergies reported",equipment:"Gloves; gauze; bandage"},
        {name:"Samantha Brooks",dob:"1992-11-03",gender:"Female",address:"88 Pine Street, Jasper, AL 35501",chief:"Evaluation after motor vehicle collision; no injury complaint",injury:"None reported",careProvided:"no",careMethods:[],narrative:"Patient ambulatory at scene, alert and oriented, and denied injury or pain. Assessment completed with no treatment required.",vitals:[{time:"2026-09-29T13:24:00",o2:"99",pulse:"82",resp:"15",bp:"126/78",pupils:"PERRL"}],transportDisposition:"Treated / No Transport",transportVehicle:"",transportAgency:"",destination:"",history:"No significant medical history reported",meds:"None reported",allergies:"No known drug allergies reported",equipment:"None"}
      ],
      responding_apparatus:[{unit_number:"JAEN2",times:{enroute:"2026-09-29T13:14:30",on_scene:"2026-09-29T13:18:12",clear:"2026-09-29T13:42:00"}},{unit_number:"JAEN3",times:{enroute:"2026-09-29T13:14:32",on_scene:"2026-09-29T13:18:25",clear:"2026-09-29T13:41:30"}},{unit_number:"JAF1",times:{enroute:"2026-09-29T13:14:35",on_scene:"2026-09-29T13:18:40",clear:"2026-09-29T13:40:55"}}]
    }}
  ];
  try{
    const pdf=await makePdf(incident,reports);
    const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
    if(!key||!from)return res.status(503).json({ok:false,error:"Brevo email is not configured in Vercel."});
    const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD RMS TEST - MVA 2026-22608",textContent:"TEST ONLY: Combined MVA incident report with two fictional patients.",attachment:[{content:Buffer.from(pdf).toString("base64"),name:"2026-22608 - JFD RMS MVA TEST.pdf"}]})});
    const t=await er.text();res.status(er.status).send(t);
  }catch(e){res.status(500).json({ok:false,error:e.message})}
}