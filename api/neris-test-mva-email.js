export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"GET only"});
  const host=req.headers.host;
  if(!host)return res.status(500).json({ok:false,error:"Request host unavailable"});
  const now=Date.now();
  const incidentNumber="TEST-MVA-2PATIENTS-"+now;
  const t3=new Date(now-60000),t2=new Date(now-120000),t1=new Date(now-180000);
  const location={country:"US",state:"AL",number:200,street:"Test Avenue",incorporated_municipality:"Jasper",postal_code:"35501"};
  const payload={
    base:{
      department_neris_id:String(process.env.NERIS_DEPARTMENT_ID||""),
      incident_number:incidentNumber,
      location,
      location_type:"AUTOMOBILE"
    },
    incident_types:[
      {type:"HAZSIT||HAZARD_NONCHEM||MOTOR_VEHICLE_COLLISION"},
      {type:"MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION"}
    ],
    dispatch:{
      incident_number:incidentNumber,
      call_arrival:t1.toISOString(),
      call_answered:t2.toISOString(),
      call_create:t3.toISOString(),
      location,
      unit_responses:[]
    },
    medical_detail:[
      {
        patient_care_report:incidentNumber+"-P1",
        patient_evaluation_care:"PATIENT_EVALUATED_CARE_PROVIDED",
        patient_improved_status:"UNCHANGED",
        medical_disposition:"PATIENT_REFUSED_TRANSPORT"
      },
      {
        patient_care_report:incidentNumber+"-P2",
        patient_evaluation_care:"PATIENT_EVALUATED_CARE_PROVIDED",
        patient_improved_status:"IMPROVED",
        medical_disposition:"OTHER_AGENCY_TRANSPORT"
      }
    ]
  };
  const call=async(path,body)=>{
    const r=await fetch("https://"+host+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{data={raw:txt}};
    return {status:r.status,ok:r.ok,data};
  };
  try{
    const neris=await call("/api/neris",{action:"submit",payload});
    if(!neris.ok||neris.data?.ok===false){console.log("MVA NERIS TEST FAILURE",JSON.stringify(neris));return res.status(200).json({ok:false,stage:"neris_submission",incident_number:incidentNumber,neris});}
    const reportData={
      rCad:incidentNumber,
      rDispatchIncidentNumber:incidentNumber,
      rLocation:"200 Test Avenue, Jasper, AL 35501",
      rPrimaryIncidentType:"HAZSIT||HAZARD_NONCHEM||MOTOR_VEHICLE_COLLISION",
      rSecondaryIncidentType:"MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION",
      rCallArrival:t1.toISOString(),
      rCallAnswered:t2.toISOString(),
      rCallCreate:t3.toISOString(),
      rNarrative:"TEST CALL ONLY. Simulated motor vehicle collision with two patients. Patient 1 was evaluated and refused transport. Patient 2 was evaluated and transported by a private ambulance service. No real patient or emergency information is contained in this test.",
      patients:[
        {
          name:"Test Patient 1",
          chief:"Motor vehicle collision",
          injury:"Minor complaint after collision",
          evaluation:"Evaluated and cared for",
          status:"Unchanged",
          transport:"No Transport",
          transportDisposition:"Patient Refused Transport",
          refusedTransport:true,
          refusalSigner:"Test Patient 1",
          refusalTime:t3.toISOString(),
          signature:"TEST SIGNATURE"
        },
        {
          name:"Test Patient 2",
          chief:"Motor vehicle collision",
          injury:"Minor injury after collision",
          evaluation:"Evaluated and cared for",
          status:"Improved",
          transport:"Other Agency",
          transportDisposition:"Transport by Other Agency",
          narrative:"Transported by private ambulance service."
        }
      ],
      responding_apparatus:[]
    };
    const reportBody={
      action:"email",
      to:["firechief@jaspercity.com"],
      incident:{cad:incidentNumber,incident_number:incidentNumber,type:"MVA / Two Patient Test",location:"200 Test Avenue, Jasper, AL 35501",call_arrival:t1.toISOString(),call_answered:t2.toISOString(),call_create:t3.toISOString()},
      reports:[{report_type:"pcr_neris_v2",status:"submitted_to_neris",data:reportData}]
    };
    const email=await call("/api/report-pdf",reportBody);
    return res.status(200).json({ok:email.ok,incident_number:incidentNumber,neris:neris.data,email});
  }catch(e){
    return res.status(500).json({ok:false,incident_number:incidentNumber,error:e?.message||String(e)});
  }
}
// one-time runner trigger 2
