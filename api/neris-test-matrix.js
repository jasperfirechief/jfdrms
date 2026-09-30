export default async function handler(req,res){
  const baseUrl=String(process.env.NERIS_BASE_URL||"https://api-test.neris.fsri.org/v1").replace(/\/$/,"");
  const clientId=String(process.env.NERIS_CLIENT_ID||""), secret=String(process.env.NERIS_CLIENT_SECRET||""), dept=String(process.env.NERIS_DEPARTMENT_ID||"");
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"GET only"});
  if(!clientId||!secret||!dept)return res.status(500).json({ok:false,error:"NERIS test configuration missing"});

  const allTypes=["FIRE||OUTSIDE_FIRE||CONSTRUCTION_WASTE","FIRE||OUTSIDE_FIRE||OTHER_OUTSIDE_FIRE","FIRE||OUTSIDE_FIRE||OUTSIDE_TANK_FIRE","FIRE||OUTSIDE_FIRE||TRASH_RUBBISH_FIRE","FIRE||OUTSIDE_FIRE||VEGETATION_GRASS_FIRE","FIRE||OUTSIDE_FIRE||WILDFIRE_WILDLAND","FIRE||OUTSIDE_FIRE||WILDFIRE_URBAN_INTERFACE","FIRE||OUTSIDE_FIRE||UTILITY_INFRASTRUCTURE_FIRE","FIRE||OUTSIDE_FIRE||DUMPSTER_OUTDOOR_CONTAINER_FIRE","FIRE||SPECIAL_FIRE||ESS_FIRE","FIRE||SPECIAL_FIRE||EXPLOSION","FIRE||SPECIAL_FIRE||INFRASTRUCTURE_FIRE","FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE","FIRE||STRUCTURE_FIRE||ROOM_AND_CONTENTS_FIRE","FIRE||STRUCTURE_FIRE||CONFINED_COOKING_APPLIANCE_FIRE","FIRE||STRUCTURE_FIRE||CHIMNEY_FIRE","FIRE||TRANSPORTATION_FIRE||AIRCRAFT_FIRE","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_COMMERCIAL","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_RV","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_FOOD_TRUCK","FIRE||TRANSPORTATION_FIRE||BOAT_PERSONAL_WATERCRAFT_BARGE_FIRE","FIRE||TRANSPORTATION_FIRE||POWERED_MOBILITY_DEVICE_FIRE","FIRE||TRANSPORTATION_FIRE||TRAIN_RAIL_FIRE","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_AGRICULTURAL","HAZSIT||HAZARD_NONCHEM||BOMB_THREAT_RESPONSE_SUSPICIOUS_PACKAGE","HAZSIT||HAZARD_NONCHEM||ELEC_POWER_LINE_DOWN_ARCHING_MALFUNC","HAZSIT||HAZARD_NONCHEM||ELEC_POWER_LINE_DOWN_ARCING_MALFUNC","HAZSIT||HAZARD_NONCHEM||ELEC_HAZARD_SHORT_CIRCUIT","HAZSIT||HAZARD_NONCHEM||MOTOR_VEHICLE_COLLISION","HAZSIT||HAZARDOUS_MATERIALS||FUEL_SPILL_ODOR","HAZSIT||HAZARDOUS_MATERIALS||GAS_LEAK_ODOR","HAZSIT||HAZARDOUS_MATERIALS||CARBON_MONOXIDE_RELEASE","HAZSIT||HAZARDOUS_MATERIALS||BIOLOGICAL_RELEASE_INCIDENT","HAZSIT||HAZARDOUS_MATERIALS||RADIOACTIVE_RELEASE_INCIDENT","HAZSIT||HAZARDOUS_MATERIALS||HAZMAT_RELEASE_TRANSPORT","HAZSIT||HAZARDOUS_MATERIALS||HAZMAT_RELEASE_FACILITY","HAZSIT||OVERPRESSURE||RUPTURE_WITHOUT_FIRE","HAZSIT||OVERPRESSURE||NO_RUPTURE","HAZSIT||INVESTIGATION||ODOR","HAZSIT||INVESTIGATION||SMOKE_INVESTIGATION","MEDICAL||ILLNESS","MEDICAL||ILLNESS||ABDOMINAL_PAIN","MEDICAL||ILLNESS||ALLERGIC_REACTION_STINGS","MEDICAL||ILLNESS||BACK_PAIN_NON_TRAUMA","MEDICAL||ILLNESS||BREATHING_PROBLEMS","MEDICAL||ILLNESS||CARDIAC_ARREST","MEDICAL||ILLNESS||CHEST_PAIN_NON_TRAUMA","MEDICAL||ILLNESS||CONVULSIONS_SEIZURES","MEDICAL||ILLNESS||DIABETIC_PROBLEMS","MEDICAL||ILLNESS||HEADACHE","MEDICAL||ILLNESS||HEART_PROBLEMS","MEDICAL||ILLNESS||OVERDOSE","MEDICAL||ILLNESS||PANDEMIC_EPIDEMIC_OUTBREAK","MEDICAL||ILLNESS||PREGNANCY_CHILDBIRTH","MEDICAL||ILLNESS||PSYCHOLOGICAL_BEHAVIOR_ISSUES","MEDICAL||ILLNESS||SICK_CASE","MEDICAL||ILLNESS||STROKE_CVA","MEDICAL||ILLNESS||UNCONSCIOUS_VICTIM","MEDICAL||ILLNESS||WELL_PERSON_CHECK","MEDICAL||ILLNESS||ALTERED_MENTAL_STATUS","MEDICAL||ILLNESS||NAUSEA_VOMITING","MEDICAL||ILLNESS||UNKNOWN_PROBLEM","MEDICAL||ILLNESS||NO_APPROPRIATE_CHOICE","MEDICAL||INJURY","MEDICAL||INJURY||ANIMAL_BITES","MEDICAL||INJURY||ASSAULT","MEDICAL||INJURY||BURNS_EXPLOSION","MEDICAL||INJURY||CARBON_MONOXIDE_OTHER_INHALATION_INJURY","MEDICAL||INJURY||CHOKING","MEDICAL||INJURY||DROWNING_DIVING_SCUBA_ACCIDENT","MEDICAL||INJURY||ELECTROCUTION","MEDICAL||INJURY||EYE_TRAUMA","MEDICAL||INJURY||FALL","MEDICAL||INJURY||HEAT_COLD_EXPOSURE","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION","MEDICAL||INJURY||INDUSTRIAL_INACCESSIBLE_ENTRAPMENT","MEDICAL||INJURY||POISONING","MEDICAL||INJURY||GUNSHOT_WOUND","MEDICAL||INJURY||HEMORRHAGE_LACERATION","MEDICAL||INJURY||STAB_PENETRATING_TRAUMA","MEDICAL||INJURY||OTHER_TRAUMATIC_INJURY","MEDICAL||INJURY||HUMAN_POWERED_VEHICLE_COLLISION","MEDICAL||INJURY||MICRO_MOBILITY_VEHICLE_COLLISION","MEDICAL||OTHER||HEALTHCARE_PROFESSIONAL_ADMISSION","MEDICAL||OTHER||MEDICAL_ALARM","MEDICAL||OTHER||STANDBY_REQUEST","MEDICAL||OTHER||TRANSFER_INTERFACILITY","MEDICAL||OTHER||AIRMEDICAL_TRANSPORT","MEDICAL||OTHER||INTERCEPT_OTHER_UNIT","MEDICAL||OTHER||COMMUNITY_PUBLIC_HEALTH","PUBSERV||CITIZEN_ASSIST||LOST_PERSON","PUBSERV||CITIZEN_ASSIST||PERSON_IN_DISTRESS","PUBSERV||CITIZEN_ASSIST||CITIZEN_ASSIST_SERVICE_CALL","PUBSERV||CITIZEN_ASSIST||LIFT_ASSIST","PUBSERV||CITIZEN_ASSIST||LEAK_FLOOD","PUBSERV||CITIZEN_ASSIST||OBSTRUCTION_DEBRIS","PUBSERV||ALARMS_NONMED||FIRE_ALARM","PUBSERV||ALARMS_NONMED||GAS_ALARM","PUBSERV||ALARMS_NONMED||CO_ALARM","PUBSERV||ALARMS_NONMED||OTHER_ALARM","PUBSERV||DISASTER_WEATHER||DAMAGE_ASSESSMENT","PUBSERV||DISASTER_WEATHER||WEATHER_RESPONSE","PUBSERV||OTHER||MOVE_UP","PUBSERV||OTHER||STANDBY","PUBSERV||OTHER||DAMAGED_HYDRANT","RESCUE||OUTSIDE||BACKCOUNTRY_RESCUE","RESCUE||OUTSIDE||CONFINED_SPACE_RESCUE","RESCUE||OUTSIDE||TRENCH","RESCUE||OUTSIDE||EXTRICATION_ENTRAPPED","RESCUE||OUTSIDE||HIGH_ANGLE_RESCUE","RESCUE||OUTSIDE||LOW_ANGLE_RESCUE","RESCUE||OUTSIDE||STEEP_ANGLE_RESCUE","RESCUE||OUTSIDE||LIMITED_NO_ACCESS","RESCUE||STRUCTURE||BUILDING_STRUCTURE_COLLAPSE","RESCUE||STRUCTURE||CONFINED_SPACE_RESCUE","RESCUE||STRUCTURE||ELEVATOR_ESCALATOR_RESCUE","RESCUE||STRUCTURE||EXTRICATION_ENTRAPPED","RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED","RESCUE||TRANSPORTATION||AVIATION_EMERGENCY","RESCUE||TRANSPORTATION||TRAIN_RAIL_COLLISION_DERAILMENT","RESCUE||TRANSPORTATION||AVIATION_COLLISION_CRASH","RESCUE||TRANSPORTATION||AVIATION_STANDBY","RESCUE||WATER||ICE_RESCUE","RESCUE||WATER||PERSON_IN_WATER_FLOOD","RESCUE||WATER||PERSON_IN_WATER_STANDING","RESCUE||WATER||PERSON_IN_WATER_TIDAL_SURF","RESCUE||WATER||PERSON_IN_WATER_SWIFTWATER","RESCUE||WATER||WATERCRAFT_IN_DISTRESS","NOEMERG||FALSE_ALARM||INTENTIONAL_FALSE_ALARM","NOEMERG||FALSE_ALARM||MALFUNCTIONING_ALARM","NOEMERG||FALSE_ALARM||ACCIDENTAL_ALARM","NOEMERG||FALSE_ALARM||OTHER_FALSE_CALL","NOEMERG||FALSE_ALARM||BOMB_SCARE","NOEMERG||GOOD_INTENT||NO_INCIDENT_FOUND_LOCATION_ERROR","NOEMERG||GOOD_INTENT||CONTROLLED_BURNING_AUTHORIZED","NOEMERG||GOOD_INTENT||SMOKE_FROM_NONHOSTILE_SOURCE","NOEMERG||GOOD_INTENT||INVESTIGATE_HAZARDOUS_RELEASE","NOEMERG||CANCELLED","LAWENFORCE"];
  const callTypes=["EMS","Fire","Fire Alarm","Hazard","MVA","Public Service","Rescue","Special Duty","Custom"];
  const combos=[
["FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION"],
["FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE","RESCUE||STRUCTURE||BUILDING_STRUCTURE_COLLAPSE"],
["FIRE||STRUCTURE_FIRE||CONFINED_COOKING_APPLIANCE_FIRE","MEDICAL||ILLNESS||BREATHING_PROBLEMS"],
["FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION"],
["FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER","RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED"],
["HAZSIT||HAZARDOUS_MATERIALS||GAS_LEAK_ODOR","MEDICAL||INJURY||CARBON_MONOXIDE_OTHER_INHALATION_INJURY"],
["HAZSIT||HAZARDOUS_MATERIALS||FUEL_SPILL_ODOR","FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER"],
["HAZSIT||HAZARD_NONCHEM||MOTOR_VEHICLE_COLLISION","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION"],
["RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION"],
["RESCUE||WATER||PERSON_IN_WATER_SWIFTWATER","MEDICAL||INJURY||DROWNING_DIVING_SCUBA_ACCIDENT"],
["PUBSERV||ALARMS_NONMED||FIRE_ALARM","FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE"],
["PUBSERV||ALARMS_NONMED||FIRE_ALARM","NOEMERG||FALSE_ALARM||ACCIDENTAL_ALARM"],
["FIRE||STRUCTURE_FIRE||STRUCTURAL_INVOLVEMENT_FIRE","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION","RESCUE||STRUCTURE||BUILDING_STRUCTURE_COLLAPSE"],
["FIRE||TRANSPORTATION_FIRE||VEHICLE_FIRE_PASSENGER","MEDICAL||INJURY||MOTOR_VEHICLE_COLLISION","RESCUE||TRANSPORTATION||MOTOR_VEHICLE_EXTRICATION_ENTRAPPED"],
["HAZSIT||HAZARDOUS_MATERIALS||GAS_LEAK_ODOR","MEDICAL||INJURY||CARBON_MONOXIDE_OTHER_INHALATION_INJURY","RESCUE||OUTSIDE||EXTRICATION_ENTRAPPED"],
["PUBSERV||ALARMS_NONMED||FIRE_ALARM","FIRE||STRUCTURE_FIRE||CONFINED_COOKING_APPLIANCE_FIRE","MEDICAL||ILLNESS||BREATHING_PROBLEMS"]
];
  const url=new URL(req.url,"http://localhost");
  const offset=Math.max(0,Number(url.searchParams.get("offset")||0));
  const limit=Math.min(20,Math.max(1,Number(url.searchParams.get("limit")||20)));
  const selected=allTypes.slice(offset,offset+limit);
  const auth=Buffer.from(clientId+":"+secret).toString("base64");
  const tr=await fetch(baseUrl+"/token",{method:"POST",headers:{Authorization:"Basic "+auth,"Content-Type":"application/x-www-form-urlencoded","User-Agent":"JasperFireDepartmentRMS/1.0"},body:"grant_type=client_credentials"});
  const td=await tr.json().catch(()=>({}));
  if(!tr.ok||!td.access_token)return res.status(502).json({ok:false,stage:"authentication",status:tr.status});

  const headers={Authorization:"Bearer "+td.access_token,"Content-Type":"application/json","User-Agent":"JasperFireDepartmentRMS/1.0"};
  const testLocation={country:"US",state:"AL",number:100,street:"Test Street",incorporated_municipality:"Jasper",postal_code:"35501"};
  const iso=n=>new Date(Date.now()-n*60000).toISOString();
  if(url.searchParams.get("mode")==="combos"){
    const results=[];
    for(const combo of combos){
      const incidentNumber="TEST-COMBO-"+Date.now()+"-"+results.length;
      const groups=combo.map(x=>x.split("||")[0]);
      const payload={base:{department_neris_id:dept,incident_number:incidentNumber,testLocation,outcome_narrative:"JFD NERIS combination validation"},incident_types:combo.map(type=>({type})),dispatch:{incident_number:incidentNumber,call_arrival:iso(3),call_answered:iso(2),call_create:iso(1),testLocation,unit_responses:[{reported_unit_id:"JFD-TEST",dispatch:iso(1),enroute_to_scene:iso(1),on_scene:iso(2),unit_clear:iso(0),unable_to_dispatch:false}]}};
      if(groups.includes("FIRE")) payload.fire_detail={location_detail:{type:"STRUCTURE",arrival_condition:"SMOKE_FIRE_SHOWING",progression_evident:true,damage_type:"MODERATE_DAMAGE",floor_of_origin:1,room_of_origin_type:"KITCHEN",cause:"OPERATING_EQUIPMENT"},water_supply:"TANK_WATER",investigation_needed:"NO",investigation_types:[]};
      if(groups.includes("FIRE")){const np={type_rr_presence:"NOT_PRESENT"};payload.smoke_alarm={presence:np};payload.fire_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};payload.other_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};payload.fire_suppression={presence:{type_rr_presence:"NOT_PRESENT"}};if(combo.some(x=>x.includes("CONFINED_COOKING_APPLIANCE_FIRE")))payload.cooking_fire_suppression={presence:{type_rr_presence:"NOT_PRESENT"}};}
      if(groups.includes("HAZSIT")) payload.hazsit_detail={disposition:"COMPLETED_FIRE_SERVICE_ONLY",evacuated:0};
      if(groups.includes("MEDICAL")) payload.medical_details=[{patient_care_report_id:incidentNumber+"-P1",patient_care_evaluation:"PATIENT_EVALUATED_NO_CARE_REQUIRED",patient_status:"UNCHANGED",transport_disposition:"NO_TRANSPORT"}];
      const vr=await fetch(baseUrl+"/incident/"+encodeURIComponent(dept)+"/validate",{method:"POST",headers,body:JSON.stringify(payload)});
      const raw=await vr.text();let details;try{details=raw?JSON.parse(raw):null}catch{details={raw}};
      results.push({combo,status:vr.status,valid:vr.ok,details});
    }
    return res.status(200).json({ok:true,mode:"combos",tested:results.length,valid:results.filter(x=>x.valid).length,invalid:results.filter(x=>!x.valid).length,results});
  }
  const results=[];
  for(const type of selected){
    const group=type.split("||")[0];
    const isStructure=type.includes("||STRUCTURE_FIRE||");
    const isCooking=/CONFINED_COOKING_APPLIANCE_FIRE/.test(type);
    const isFire=group==="FIRE";
    const isHaz=group==="HAZSIT";
    const isMedical=group==="MEDICAL";
    const incidentNumber="TEST-EXHAUSTIVE-"+offset+"-"+results.length+"-"+Date.now();
    const payload={
      base:{department_neris_id:dept,incident_number:incidentNumber,testLocation,outcome_narrative:"JFD NERIS test validation"},
      incident_types:[{type}],
      dispatch:{
        incident_number:incidentNumber,
        call_arrival:iso(3),
        call_answered:iso(2),
        call_create:iso(1),
        testLocation,
        unit_responses:[{reported_unit_id:"JFD-TEST",dispatch:iso(1),enroute_to_scene:iso(1),on_scene:iso(2),unit_clear:iso(0),unable_to_dispatch:false}]
      }
    };
    if(isFire){
      payload.fire_detail=isStructure?{
        location_detail:{type:"STRUCTURE",arrival_condition:"SMOKE_FIRE_SHOWING",progression_evident:true,damage_type:"MODERATE_DAMAGE",floor_of_origin:1,room_of_origin_type:"KITCHEN",cause:"OPERATING_EQUIPMENT"},
        water_supply:"TANK_WATER",investigation_needed:"NO",investigation_types:[]
      }:{
        location_detail:{type:"OUTSIDE",cause:"NATURAL"},
        water_supply:"TANK_WATER",investigation_needed:"NO",investigation_types:[]
      };
    }
    if(isStructure){
      const np={type_rr_presence:"NOT_PRESENT"};
      payload.smoke_alarm={presence:np};
      payload.fire_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};
      payload.other_alarm={presence:{type_rr_presence:"NOT_PRESENT"}};
      payload.fire_suppression={presence:{type_rr_presence:"NOT_PRESENT"}};
      if(isCooking)payload.cooking_fire_suppression={presence:{type_rr_presence:"NOT_PRESENT"}};
    }
    if(isHaz){
      payload.hazsit_detail={disposition:"COMPLETED_FIRE_SERVICE_ONLY",evacuated:0};
    }
    if(isMedical){
      payload.medical_details=[{
        patient_care_report_id:incidentNumber+"-P1",
        patient_care_evaluation:"PATIENT_EVALUATED_NO_CARE_REQUIRED",
        patient_status:"UNCHANGED",
        transport_disposition:"NO_TRANSPORT"
      }];
    }
    const vr=await fetch(baseUrl+"/incident/"+encodeURIComponent(dept)+"/validate",{method:"POST",headers,body:JSON.stringify(payload)});
    const raw=await vr.text(); let details; try{details=raw?JSON.parse(raw):null}catch{details={raw}};
    results.push({type,status:vr.status,valid:vr.ok,details});
  }
  return res.status(200).json({
    ok:true,total_types:allTypes.length,offset,limit,tested:results.length,
    local_call_types:callTypes,
    call_type_note:"Local JFD call type is not sent to NERIS; each call type uses the same NERIS validation path.",
    results
  });
}
