export default async function handler(req,res){
  const baseUrl=String(process.env.NERIS_BASE_URL||"https://api-test.neris.fsri.org/v1").replace(/\/$/,"");
  const clientId=String(process.env.NERIS_CLIENT_ID||""), secret=String(process.env.NERIS_CLIENT_SECRET||""), dept=String(process.env.NERIS_DEPARTMENT_ID||"");
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"GET only"});
  if(!clientId||!secret||!dept)return res.status(500).json({ok:false,error:"NERIS test configuration missing"});
  const scenarios=[
    ["structure_fire","FIRE||STRUCTURE_FIRE||ROOM_AND_CONTENTS_FIRE"],
    ["outside_vegetation","FIRE||OUTSIDE_FIRE||VEGETATION_GRASS_FIRE"],
    ["vehicle_fire","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER"],
    ["ess_fire","FIRE||SPECIAL_FIRE||ESS_FIRE"],
    ["medical_breathing","MEDICAL||ILLNESS||BREATHING_PROBLEMS"],
    ["medical_injury_fall","MEDICAL||INJURY||FALL"],
    ["mva","HAZSIT||HAZARD_NONCHEM||MOTOR_VEHICLE_COLLISION"],
    ["hazmat_gas","HAZSIT||HAZARDOUS_MATERIALS||GAS_LEAK_ODOR"],
    ["hazmat_fuel","HAZSIT||HAZARDOUS_MATERIALS||FUEL_SPILL_ODOR"],
    ["rescue_person","RESCUE||OUTSIDE||LOW_ANGLE_RESCUE"],
    ["rescue_vehicle","RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED"],
    ["firefighter_rescue","RESCUE||STRUCTURE||EXTRICATION_ENTRAPPED"],
    ["public_service","PUBSERV||CITIZEN_ASSIST||CITIZEN_ASSIST_SERVICE_CALL"],
    ["cancelled","NOEMERG||CANCELLED"]
  ];
  const requested=new URL(req.url,"http://localhost").searchParams.get("scenario");
  const selected=requested?scenarios.filter(x=>x[0]===requested):scenarios;
  const auth=Buffer.from(clientId+":"+secret).toString("base64");
  const tr=await fetch(baseUrl+"/token",{method:"POST",headers:{Authorization:"Basic "+auth,"Content-Type":"application/x-www-form-urlencoded","User-Agent":"JasperFireDepartmentRMS/1.0"},body:"grant_type=client_credentials"});
  const td=await tr.json().catch(()=>({}));
  if(!tr.ok||!td.access_token)return res.status(502).json({ok:false,stage:"authentication",status:tr.status});
  const headers={Authorization:"Bearer "+td.access_token,"Content-Type":"application/json","User-Agent":"JasperFireDepartmentRMS/1.0"};
  const out=[];
  for(const [name,type] of selected){
    const n="TEST-MATRIX-"+name.toUpperCase()+"-"+Date.now();
    const t3=new Date(Date.now()-60000),t2=new Date(t3.getTime()-60000),t1=new Date(t2.getTime()-60000);
    const location={country:"US",state:"AL",number:100,street:"Test Street",incorporated_municipality:"Jasper",postal_code:"35501"};
    const payload={base:{department_neris_id:dept,incident_number:n,location},incident_types:[{type}],dispatch:{incident_number:n,call_arrival:t1.toISOString(),call_answered:t2.toISOString(),call_create:t3.toISOString(),location,unit_responses:[]}};
    if(name==="structure_fire"){payload.smoke_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};payload.fire_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};payload.other_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};payload.fire_suppression={presence:{type_rr_presence:"NOT_PRESENT"}};}
    const vr=await fetch(baseUrl+"/incident/"+encodeURIComponent(dept)+"/validate",{method:"POST",headers,body:JSON.stringify(payload)});
    const raw=await vr.text();let details;try{details=JSON.parse(raw)}catch{details={raw}};
    out.push({scenario:name,type,status:vr.status,valid:vr.ok,details});
  }
  return res.status(200).json({ok:true,count:out.length,results:out});
}
// Deployment trigger: NERIS matrix live test.
