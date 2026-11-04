(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let roster = [], dailyRecord = null, eventRecordId = null, eventSelected = new Set(), selectedTrainingView = "daily", scheduleCache = [];
  const trainingTypes=["Company Training (Fire)","EMS","Existing Driver Training","Facilities/Drill Training","Hazardous Materials","Inspector CE","Investigator CE","New Driver Training","Officer Training","Preplan","Public Educator CE","Recruit"];
  const typeOptions=(selected="")=>trainingTypes.map(x=>'<option value="'+esc(x)+'" '+(x===selected?"selected":"")+'>'+esc(x)+'</option>').join("");
  function inferTrainingType(schedule){
    const supplied=String(schedule?.category||schedule?.type||"").trim();
    if(trainingTypes.includes(supplied))return supplied;
    const text=[schedule?.subject,schedule?.lesson,schedule?.details].join(" ").toLowerCase();
    if(/ems|medical|first aid|cpr|patient care/.test(text))return "EMS";
    if(/new driver|driver recruit|driver training.*new/.test(text))return "New Driver Training";
    if(/driver|operator|apparatus operation|pump operation/.test(text))return "Existing Driver Training";
    if(/facility|station drill|drill training/.test(text))return "Facilities/Drill Training";
    if(/hazmat|hazardous material/.test(text))return "Hazardous Materials";
    if(/inspector|inspection ce|fire inspector/.test(text))return "Inspector CE";
    if(/investigator|fire investigation/.test(text))return "Investigator CE";
    if(/officer|command|leadership/.test(text))return "Officer Training";
    if(/pre.?plan|preplan/.test(text))return "Preplan";
    if(/public educator|public education/.test(text))return "Public Educator CE";
    if(/recruit|academy|probationary/.test(text))return "Recruit";
    return "Company Training (Fire)";
  }
  const curriculumBySubject = {
    "building construction": {
      1:{title:"Construction Classifications",reading:"Essentials of Fire Fighting, 7th Ed., pp. 77–86",objectives:["Differentiate among types of building construction."],skills:[]},
      2:{title:"Floors, Ceilings, and Walls / Basements and Stairs",reading:"Essentials of Fire Fighting, 7th Ed., pp. 87–90",objectives:["Describe the construction of floors, ceilings, and walls.","Describe how basements and stairs may impact firefighting operations."],skills:[]},
      3:{title:"Roofs / Doors / Windows",reading:"Essentials of Fire Fighting, 7th Ed., pp. 90–111",objectives:["Compare the construction of different roof types.","Describe the construction and operation methods of different types of doors.","Describe the construction and operation methods of different types of windows."],skills:[]}
    },
    "building materials, structural collapse, and effects of fire suppression": {
      1:{title:"Building Materials",reading:"Essentials of Fire Fighting, 7th Ed., pp. 783–793",objectives:["Describe the effects of fire on various building materials."],skills:[]},
      2:{title:"Structural Collapse / Dangerous Building Conditions and Fire Suppression Activities",reading:"Essentials of Fire Fighting, 7th Ed., pp. 794–801",objectives:["Describe factors that contribute to structural collapse.","Identify indicators of structural instability and collapse.","Explain considerations to be taken when establishing collapse zones.","Describe actions that should be taken when structural collapse is imminent.","Describe building conditions and fire suppression activities that can impact fire spread and structural stability."],skills:[]}
    },
    "communications": {
      1:{title:"Receiving Emergency Calls",reading:"Essentials of Fire Fighting, 7th Ed., pp. 58–62",objectives:["Explain the procedures for receiving and dispatching emergency calls."],skills:["Skill Sheet 2-1: Handle nonemergency and emergency phone calls."]},
      2:{title:"Radio Communications",reading:"Essentials of Fire Fighting, 7th Ed., pp. 63–70",objectives:["Describe radio equipment and procedures used for internal fire department communications."],skills:["Skill Sheet 2-2: Use a portable radio for routine and emergency traffic."]}
    },
    "community risk reduction": {
      1:{title:"Importance of Fire and Life Safety Programs / Private Dwelling Surveys / Presentations",reading:"Essentials of Fire Fighting, 7th Ed., pp. 975–990",objectives:["Explain the importance of fire and life safety programs.","Describe fire safety surveys for private dwellings.","Explain the role of a Firefighter II with regard to fire and life safety presentations."],skills:["Conduct a fire and life safety survey in an occupied dwelling (p. 1015).","Deliver a fire and life safety presentation (p. 1016).","Conduct a fire station tour (p. 1017)."]},
      2:{title:"Pre-incident Surveys",reading:"Essentials of Fire Fighting, 7th Ed., pp. 991–1011",objectives:["Explain the process of conducting and documenting a pre-incident survey."],skills:["Prepare a pre-incident planning survey (p. 1018)."]}
    },
    "fire dynamics": {
      1:{title:"Fire Science / Thermal Energy / Fuel / Oxygen / Self-Sustained Chemical Reaction",reading:"Essentials of Fire Fighting, 7th Ed., pp. 117–144",objectives:["Explain the basic principles of fire science.","Describe how thermal energy impacts fire behavior.","Explain the function of fuel within the combustion process.","Explain the function of oxygen within the combustion process.","Explain the self-sustained chemical reaction involved in flaming combustion."],skills:[]},
      2:{title:"Compartment Fire Development / Structure Fire Development",reading:"Essentials of Fire Fighting, 7th Ed., pp. 144–160",objectives:["Differentiate among the stages of fire development.","Explain how firefighting operations can influence fire behavior in a structure."],skills:[]},
      3:{title:"Reaction of Building Construction to Fire",reading:"Essentials of Fire Fighting, 7th Ed., pp. 160–175",objectives:["Describe how building construction and layout affects fire development."],skills:[]}
    },
    "fire hose": {
      1:{title:"Fire Hose Characteristics / Inspection, Care, and Maintenance",reading:"Essentials of Fire Fighting, 7th Ed., pp. 541–555",objectives:["Describe characteristics of fire hose.","Describe the inspection, care, and maintenance of fire hose."],skills:["Couple and uncouple a hose (pp. 568–569).","Inspect, clean, and maintain a hose (pp. 570–572)."]},
      2:{title:"Hose Rolls / Hose Loads",reading:"Essentials of Fire Fighting, 7th Ed., pp. 556–565",objectives:["Explain methods of rolling hose.","Describe hose loads."],skills:["Make a straight hose roll (p. 573).","Make a donut hose roll (pp. 574–576).","Make a flat hose load (p. 577).","Make an accordion hose load (p. 578).","Make the preconnected flat hose load (p. 579).","Make the triple layer hose load (pp. 580–581).","Make the minuteman hose load (pp. 582–583)."]}
    },
    "fire origin and cause determination": {
      1:{title:"Fire Investigation Roles and Responsibilities / Area of Origin Assessment",reading:"Essentials of Fire Fighting, 7th Ed., pp. 933–942",objectives:["Identify the roles and responsibilities of firefighters and fire investigators at a fire investigation.","Explain the process of determining the area of origin."],skills:[]},
      2:{title:"Fire Cause Assessment / Evidence Preservation",reading:"Essentials of Fire Fighting, 7th Ed., pp. 942–952",objectives:["Explain the process of cause determination.","Describe considerations related to evidence preservation."],skills:["Protect and document evidence of fire origin and cause (pp. 955–956)."]}
    },
    "firefighter personal protective equipment": {
      1:{title:"Personal Protective Equipment",reading:"Essentials of Fire Fighting, 7th Ed., pp. 183–200",objectives:["Describe the various types and uses of PPE worn by firefighters.","Describe the inspection, cleaning, and maintenance of PPE."],skills:["Don structural PPE (p. 232)."]},
      2:{title:"SCBA / Donning and Doffing / Inspection and Maintenance",reading:"Essentials of Fire Fighting, 7th Ed., pp. 201–225",objectives:["Describe conditions that require the use of respiratory protection equipment.","Identify SCBA components.","Describe SCBA limitations.","Describe the procedures for donning and doffing SCBA.","Describe the process of inspecting and cleaning SCBA.","Describe methods of refilling, replacing, and storing SCBA cylinders.","Describe safety considerations for working in and exiting a hazardous atmosphere while wearing SCBA."],skills:["Don SCBA (pp. 233–236).","Inspect SCBA (pp. 241–242).","Fill an SCBA cylinder (pp. 244–247)."]}
    },
    "firefighter safety": {
      1:{title:"Firefighter Safety, Health, and Wellness",reading:"Essentials of Fire Fighting, 7th Ed., pp. 25–36",objectives:["Describe fire and life safety initiatives aimed at reducing firefighter illnesses, injuries, and fatalities.","Describe the aspects of NFPA 1500 related to firefighter safety and health.","Describe fire department programs intended to reduce firefighter illnesses, injuries, and fatalities."],skills:[]},
      2:{title:"Operational Safety and Scene Management",reading:"Essentials of Fire Fighting, 7th Ed., pp. 37–45",objectives:["Summarize general guidelines for operating safely at structural fire scenes.","Summarize safe practices for riding in fire service vehicles and apparatus.","Explain the use of emergency scene lighting and equipment.","Explain the importance of personnel accountability systems.","Summarize general guidelines for operating safely at highway/roadway incidents."],skills:["Skill Sheet 1-1: Mount and dismount an apparatus for incident response.","Skill Sheet 1-2: Deploy and operate a portable electrical power supply unit.","Skill Sheet 1-3: Deploy lighting equipment.","Skill Sheet 1-4: Demonstrate scene management at a roadway incident using traffic and scene safety control devices."]}
    },
    "forcible entry": {
      1:{title:"Basic Principles of Forcible Entry / Forcible Entry Tools",reading:"Essentials of Fire Fighting, 7th Ed., pp. 371–385",objectives:["Describe the basic principles of forcible entry.","Describe forcible entry tools.","Explain considerations for forcible entry tool safety.","Explain how to carry forcible entry tools."],skills:["Clean, inspect, and maintain hand tools and equipment (pp. 413–414)."]},
      2:{title:"Forcing Entry Through Doors",reading:"Essentials of Fire Fighting, 7th Ed., pp. 387–403",objectives:["Describe methods of forcing entry through doors."],skills:["Force entry through an inward swinging door (pp. 415–416).","Force entry through an outward swinging door (pp. 417–418).","Force entry through a door lock (pp. 419–421).","Force entry through a padlock (source document lists pp. 422–224)."]},
      3:{title:"Forcing Entry Through Windows / Breaching Walls",reading:"Essentials of Fire Fighting, 7th Ed., pp. 404–410",objectives:["Describe methods for forcing entry through windows.","Describe methods for breaching walls."],skills:["Force entry through a window (pp. 425–426).","Force entry through a wood-framed wall (pp. 427–428).","Breach a masonry wall with hand tools (p. 429).","Breach a metal wall with a rotary saw (p. 430)."]}
    },
    "foam firefighting, liquid fires, and gas fires": {
      1:{title:"Foam Firefighting / Liquid and Gas Fuel Fires",reading:"Essentials of Fire Fighting, 7th Ed., pp. 871–889",objectives:["Describe methods used to generate firefighting foam.","Identify materials and equipment needed to generate firefighting foam.","Describe methods of foam application.","Describe operations involving liquid and gas fuel fires."],skills:[]}
    },
    "ground ladders": {
      1:{title:"Parts of a Ladder / Ladder Types / Inspection, Cleaning, Maintenance, and Safety",reading:"Essentials of Fire Fighting, 7th Ed., pp. 315–325",objectives:["Identify the parts of a ladder.","Differentiate among types of ladders.","Describe the process of inspecting, cleaning, and maintaining a ladder.","Describe safe practices for using a ladder."],skills:["Clean, inspect, and maintain a ladder (source document lists pp. 345–345)."]},
      2:{title:"Carrying Ladders / Placing Ground Ladders / Securing Ground Ladders",reading:"Essentials of Fire Fighting, 7th Ed., pp. 326–335",objectives:["Describe the process of carrying a ladder.","Describe the proper procedure for placing a ground ladder.","Describe ways to secure a ground ladder."],skills:["Carry a ladder using the one-firefighter low shoulder method (p. 347).","Carry a ladder using a two-firefighter carry (p. 348)."]},
      3:{title:"Ladder Raises / Working from a Ladder",reading:"Essentials of Fire Fighting, 7th Ed., pp. 336–342",objectives:["Describe methods for raising and lowering a ladder.","Describe how to safely work from a ladder.","Describe methods to assist a victim down a ladder."],skills:["Raise and lower a ladder using a one-firefighter method (pp. 349–356).","Raise and lower a ladder using a two-firefighter method (pp. 357–359).","Shift a ladder (pp. 360–361).","Pivot a ladder (p. 362).","Leg lock on a ground ladder (p. 363).","Deploy a roof ladder (pp. 364–366).","Assist a victim down a ground ladder (pp. 367–368)."]}
    },
    "hazardous material: analyzing the incident (awareness)": {
      1:{title:"APIE Response Model / Hazardous Materials Fundamentals and Properties",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1047–1078",objectives:["Explain the APIE process at hazardous materials incidents.","Define a hazardous material incident.","Recognize ways that hazardous materials harm people.","Identify states of matter as they relate to hazardous materials.","Explain physical properties that aid in identifying potential hazards and predicting behavior of hazardous materials."],skills:["Analyze a hazardous materials scenario to identify potential hazards (pp. 1211–1212).","Identify indicators and hazards present at a hazardous materials incident using approved reference sources (p. 1213)."]},
      2:{title:"General Hazardous Materials Behavior Model / Seven Clues / Preincident Plans",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1079–1095",objectives:["Explain the role of the General Hazardous Materials Model in predicting the behavior of containers.","Identify the seven clues to the presence of hazardous materials.","Explain how preincident plans, occupancy types, and locations may indicate the presence and hazards of hazardous materials."],skills:["Analyze a hazardous materials scenario to identify potential hazards (pp. 1211–1212).","Identify indicators and hazards present at a hazardous materials incident using approved reference sources (p. 1213)."]},
      3:{title:"Container Types and Behavior",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1096–1151",objectives:["Recognize general container types and their associated behaviors and hazards."],skills:["Analyze a hazardous materials scenario to identify potential hazards (pp. 1211–1212).","Identify indicators and hazards present at a hazardous materials incident using approved reference sources (p. 1213)."]},
      4:{title:"Transportation Placards, Labels, and Markings / Written Resources",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1151–1204",objectives:["Describe ways that transportation placards, labels, and markings indicate the presence and hazards of hazardous materials.","Define the hazard classes.","Identify other markings and colors that indicate the presence of hazardous materials.","Describe ways written resources are used to identify hazardous materials and their hazards."],skills:["Analyze a hazardous materials scenario to identify potential hazards (pp. 1211–1212).","Identify indicators and hazards present at a hazardous materials incident using approved reference sources (p. 1213)."]}
    },
    "hazardous material: action options and response objectives (operations)": {
      1:{title:"Predetermined Procedures / Protective Actions / Size-Up and Risk Assessment / Incident Levels / Operational Strategies / Initial Response",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1217–1237",objectives:["Explain predetermined procedures.","Explain the role of first responders in initiating protective actions.","Describe the process of size-up and risk assessment.","Differentiate among hazardous materials incident levels.","Explain the three modes of operation at hazardous materials incidents.","Explain the process of planning the initial response at hazardous materials incidents."],skills:["Make appropriate notifications of a hazardous materials incident (p. 1298).","Implement protective actions at a hazardous materials incident (p. 1299).","Provide scene control at a hazardous materials incident (p. 1300)."]},
      2:{title:"Implementing Response Objectives and Action Options",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1238–1253",objectives:["Explain ways of implementing response objectives and action options."],skills:["Identify actions available at a hazardous materials incident (p. 1301)."]},
      3:{title:"Terrorist Attacks",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1254–1288",objectives:["Differentiate among types of terrorist attacks and their associated hazards."],skills:[]},
      4:{title:"Other Criminal Activities and Natural Disasters / Evaluating Progress",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1289–1293",objectives:["Identify hazards at illicit laboratories.","Recognize illegal hazmat dumps.","Describe hazardous materials response during and after natural disasters.","Identify process for evaluating progress at a hazardous materials incident."],skills:["Evaluate progress made at a hazardous materials incident (p. 1302)."]}
    },
    "hose operations and hose streams": {
      1:{title:"Supplying Water / Deploying Hose",reading:"Essentials of Fire Fighting, 7th Ed., pp. 587–607",objectives:["Describe methods of supplying water for firefighting operations.","Describe methods used to deploy fire hose."],skills:["Make a hydrant connection from a forward lay (pp. 638–639).","Make a reverse hose lay (p. 640)."]},
      2:{title:"Advancing Hose Lines / Hose Streams and Nozzles",reading:"Essentials of Fire Fighting, 7th Ed., pp. 607–624",objectives:["Describe methods of advancing hoselines.","Differentiate among types of hose streams and nozzles."],skills:["Advance a hose load using the flat hose method (p. 641).","Extend a hoseline (pp. 646–647).","Advance a hoseline up or down an interior stairway (pp. 655–656).","Advance an uncharged line up a ladder into a window (p. 658)."]},
      3:{title:"Applying Hose Streams",reading:"Essentials of Fire Fighting, 7th Ed., pp. 625–631",objectives:["Explain how to operate different types of hoselines, nozzles, and master stream devices."],skills:["Operate a charged attack line from a ladder (p. 660).","Operate a large hoseline for exposure protection using the one-firefighter method (p. 663).","Deploy and operate a master stream device (p. 665)."]}
    },
    "incident scene operations": {
      1:{title:"Initiating Operations / Transferring Command",reading:"Essentials of Fire Fighting, 7th Ed., pp. 899–911",objectives:["Explain the process of initiating incident operations.","Explain the process of transferring command."],skills:["Establish incident command and coordinate interior attack of a structure fire (p. 929)."]},
      2:{title:"Coordinating Unit Operations / Post-incident Reports",reading:"Essentials of Fire Fighting, 7th Ed., pp. 912–926",objectives:["Describe the duties of a unit or team leader during fireground operations.","Explain the use of post-incident reports."],skills:["Create a post-incident report (p. 930)."]}
    },
    "maintenance and testing responsibilities": {
      1:{title:"Equipment Maintenance / Service Testing Fire Hose",reading:"Essentials of Fire Fighting, 7th Ed., pp. 959–963",objectives:["Describe equipment maintenance procedures.","Describe the process of service testing fire hose."],skills:["Clean, inspect, and maintain power tools and equipment (pp. 965–966).","Inspect and maintain a portable generator and lighting equipment (pp. 967–968).","Service test fire hose (pp. 969–971)."]}
    },
    "overhaul, property conservation, and scene preservation": {
      1:{title:"Overhaul / Property Conservation / Scene Preservation and Protection",reading:"Essentials of Fire Fighting, 7th Ed., pp. 740–762",objectives:["Describe overhaul.","Explain how to conserve property at a fire scene.","Describe the duties that firefighters must perform to protect and preserve a fire scene."],skills:["Spread a folded salvage cover using a one-firefighter method (p. 769).","Spread a folded salvage cover using the two-firefighter method (pp. 772–773).","Construct a water chute and attach it to a catch-all (p. 777).","Clean, inspect, and repair a salvage cover (p. 779)."]}
    },
    "portable fire extinguishers": {
      1:{title:"Fire Extinguishers / Types / Selecting and Using Portable Fire Extinguishers",reading:"Essentials of Fire Fighting, 7th Ed., pp. 254–268",objectives:["Distinguish among the five classifications of portable fire extinguishers.","Distinguish among the various types of portable fire extinguishers.","Describe the process of selecting and using a portable fire extinguisher."],skills:["Extinguish an incipient Class A, B, or C fire with a portable fire extinguisher (pp. 270–271)."]}
    },
    "ropes and knots": {
      1:{title:"Ropes and Webbing",reading:"Essentials of Fire Fighting, 7th Ed., pp. 277–286",objectives:["Differentiate between life safety rope and utility rope.","Describe the various materials and methods used to construct rope.","Describe the procedures for inspecting, cleaning, and maintaining ropes."],skills:["Inspect, clean, and store rope (p. 298)."]},
      2:{title:"Knots",reading:"Essentials of Fire Fighting, 7th Ed., pp. 287–290",objectives:["Identify types of knots."],skills:["Tie an overhand knot (p. 299).","Tie a clove hitch around an object (p. 301).","Tie a figure-eight on a bight (p. 303).","Tie a figure-eight follow through (p. 304)."]},
      3:{title:"Hoisting Tools and Equipment / Other Emergency Scene Uses",reading:"Essentials of Fire Fighting, 7th Ed., pp. 291–296",objectives:["Describe the procedure for hoisting various tools and equipment.","Explain how ropes and knots are used during rescues and at other emergencies."],skills:["Hoist a pike pole (pp. 307–308).","Hoist a ladder (p. 309).","Hoist a dry hoseline (p. 310).","Hoist a power saw (p. 311)."]}
    },
    "structural search and rescue": {
      1:{title:"Firefighter Survival During Interior Operations / Air Monitoring",reading:"Essentials of Fire Fighting, 7th Ed., pp. 433–449",objectives:["Explain best practices to ensure firefighter survival during interior operations.","Describe air-monitoring operations."],skills:["Enact the proper procedures for an SCBA air emergency (p. 478).","Operate an air-monitoring device (p. 479)."]},
      2:{title:"Structural Searches / Victim Removal",reading:"Essentials of Fire Fighting, 7th Ed., pp. 450–466",objectives:["Describe structural search and rescue operations.","Describe victim removal methods."],skills:["Conduct a primary or secondary search (p. 480).","Perform an incline drag (p. 481).","Perform the extremities lift/carry using the two-rescuer method (p. 482).","Perform the webbing drag (p. 483)."]},
      3:{title:"Emergency Calls for Assistance / MAYDAY Protocols / Evacuation / Rapid Intervention",reading:"Essentials of Fire Fighting, 7th Ed., pp. 467–474",objectives:["Describe MAYDAY protocols.","Describe emergency evacuation methods.","Describe rapid intervention crew equipment and duties."],skills:["Transmit a MAYDAY report (p. 484).","Follow a hoseline or search line out as a withdrawal procedure (p. 485).","Perform reduced profile maneuvers without removal of SCBA using the side technique (p. 486).","Breach an interior wall (p. 487).","Perform low profile maneuvers without SCBA removal using the SCBA-first technique (p. 488).","Disentangle from debris or wires (p. 489)."]}
    },
    "tactical ventilation": {
      1:{title:"Reasons for Tactical Ventilation / Safety / Tools and Equipment",reading:"Essentials of Fire Fighting, 7th Ed., pp. 493–505",objectives:["Explain why tactical ventilation is performed at a structure fire.","Describe safety considerations related to tactical ventilation.","Describe ventilation tools and equipment."],skills:["Locate and explain the use of tools and equipment used for tactical ventilation carried on department apparatus."]},
      2:{title:"Horizontal Ventilation / Vertical Ventilation / Special Compartments and Structures",reading:"Essentials of Fire Fighting, 7th Ed., pp. 506–526",objectives:["Describe horizontal ventilation.","Describe vertical ventilation.","Describe considerations related to the ventilation of basements and other special compartments."],skills:["Locate and explain the use of tools and equipment used for mechanical positive pressure ventilation carried on department apparatus.","Locate and explain the use of tools and equipment used for horizontal hydraulic ventilation carried on department apparatus.","Locate and explain the use of tools and equipment used to ventilate a flat roof carried on department apparatus.","Locate and explain the use of tools and equipment used to ventilate a pitched roof carried on department apparatus."]}
    },
    "technical rescue support and vehicle extrication operations": {
      1:{title:"Assistance at Technical Rescue Incidents / Rescue Tools",reading:"Essentials of Fire Fighting, 7th Ed., pp. 807–833",objectives:["Describe the duties of a Firefighter at a technical rescue incident.","Describe rescue practices and goals at various types of rescue incidents.","Identify tools used at technical rescues."],skills:[]},
      2:{title:"General Vehicle Anatomy / Extrication Size-Up, Stabilization, and Victim Access",reading:"Essentials of Fire Fighting, 7th Ed., pp. 834–854",objectives:["Identify vehicle construction methods and components.","Describe size-up and hazard recognition at a vehicle extrication incident.","Describe vehicle stabilization operations.","Describe techniques used to access victims at a vehicle extrication incident."],skills:[]}
    },
    "first aid provider": {
      1:{title:"Fire-Service-Based Emergency Medical Care / Confidentiality / Infection Control",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1021–1029",objectives:["Describe the role of the fire service in providing emergency medical care.","Explain patient confidentiality requirements.","Identify communicable diseases that first responders commonly encounter.","Explain ways to prevent the spread of communicable diseases during emergency medical care."],skills:["Remove soiled gloves as outlined on p. 1028.","Clean a contaminated item as outlined on pp. 1029–1030."]},
      2:{title:"Patient Assessment / Cardiac Arrest and CPR",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1030–1037",objectives:["Explain the process of patient assessment.","Describe CPR."],skills:["Assess a patient as outlined on pp. 1030–1031.","Perform manual chest compressions on a CPR mannequin.","Perform rescue breaths using a BVM on a CPR mannequin."]},
      3:{title:"Bleeding Control / Shock Management",reading:"Essentials of Fire Fighting, 7th Ed., pp. 1037–1041",objectives:["Describe methods of controlling bleeding.","Explain shock management."],skills:[]}
    },
    "fire suppression": {
      1:{title:"The Science Behind Fire Suppression / Structural Fire Attack",reading:"Essentials of Fire Fighting, 7th Ed., pp. 669–684",objectives:["Explain the science behind fire suppression.","Describe methods for suppressing structural fires."],skills:["Simulate an interior structure fire attack at ground level using direct, indirect, and combination attack (pp. 720–722).","Simulate a structure fire attack using a transitional attack (p. 723)."]},
      2:{title:"Supporting Fire Protection Systems / Building Utilities",reading:"Essentials of Fire Fighting, 7th Ed., pp. 685–693",objectives:["Explain the role of firefighters with regard to supporting fire protection systems during fire suppression.","Explain the duties of firefighters related to building utilities."],skills:["Simulate or operate sprinkler system control valves (p. 726).","Stop the flow of water from an activated sprinkler (pp. 727–728).","Simulate or turn off building utilities (p. 729)."]},
      3:{title:"Vehicle Fires / Exterior Class A Fires / Ground Cover Fires",reading:"Essentials of Fire Fighting, 7th Ed., pp. 694–716",objectives:["Describe the process of attacking a vehicle fire.","Describe the process of attacking fires in exterior Class A materials.","Describe ground cover fire attack."],skills:["Simulate an attack on a passenger vehicle fire (p. 730).","Simulate an attack on a fire in exterior stacked or piled Class A materials (p. 731).","Simulate an attack on a fire in a trash container (p. 734).","Simulate an attack on a ground cover fire (p. 735)."]}
    }
  };
  const driverCurriculum = {
    "1":{title:"Apparatus Safety and Operating Emergency Vehicles",reading:"Pumping and Aerial Apparatus Driver/Operator Handbook, 3rd Edition, pp. 76–122",objectives:["Detect reasons for accidents.","Review apparatus rider safety considerations.","Explain considerations for operation of an apparatus.","Explain apparatus emergency response considerations.","Explain considerations when backing apparatus."],skills:["Drive a fire service apparatus (pp. 126–127).","Back apparatus using mirrors (p. 128).","Perform various driving exercises (pp. 129–130)."]},
    "2":{title:"Principles of Water/Hose Nozzles and Flow Rates",reading:"Pumping and Aerial Apparatus Driver/Operator Handbook, 3rd Edition, pp. 167–272",objectives:["Describe characteristics of water.","Summarize facts about water pressure and velocity.","Summarize principles of friction loss.","Distinguish among types of fire hose nozzles.","Summarize facts about nozzle pressure and reaction."],skills:[]},
    "3":{title:"Fire Pump Theory/Operating Fire Pumps",reading:"Pumping and Aerial Apparatus Driver/Operator Handbook, 3rd Edition, pp. 292–366",objectives:["Describe intake and discharge piping.","Explain operation of automatic pressure control devices.","Describe types of auxiliary cooling devices.","Explain making the pump operational.","Explain considerations when operating from a pressurized water source.","Describe actions taken for sprinkler and standpipe support."],skills:["Perform operations from the apparatus water tank (pp. 392–393).","Make the transition from apparatus water tank to external pressurized water supply (p. 394).","Operate from a pressurized water source (p. 395)."]},
    "4":{title:"Relay Pumping Operations/Water Shuttle Operations",reading:"Pumping and Aerial Apparatus Driver/Operator Handbook, 3rd Edition, pp. 422–468",objectives:["Describe relay apparatus and equipment.","Explain relay pumping operational considerations.","Identify water shuttle apparatus.","Describe fill site operations."],skills:["Operate in a closed relay (p. 438)."]}
  };
  function curriculumKey(subject) {
    return String(subject||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
  }
  function scheduledCurriculum(schedule) {
    if (!schedule) return "";
    const subject=String(schedule.subject||"").trim(), lessonText=String(schedule.lesson||"").trim();
    const lessonMatch=lessonText.match(/(?:lesson\s*)?(\d+)/i) || String(schedule.details||"").match(/lesson\s*(\d+)/i);
    const lessonNumber=lessonMatch?lessonMatch[1]:"";
    const key=curriculumKey(subject);
    let item=null;
    if (/driver training|driver operator|apparatus driver/.test(key)) item=driverCurriculum[lessonNumber];
    if (!item) {
      const normalized=key.replace(/^hazardous material /,"hazardous material ");
      const matchedSubject=Object.keys(curriculumBySubject).find(name=>curriculumKey(name)===key);
      item=curriculumBySubject[normalized]?.[lessonNumber] || curriculumBySubject[key]?.[lessonNumber] || (matchedSubject?curriculumBySubject[matchedSubject]?.[lessonNumber]:null) || null;
    }
    const lines=[];
    if(item?.title)lines.push(item.title);
    if(subject)lines.push("Scheduled subject: "+subject);
    if(lessonText)lines.push("Scheduled lesson: "+lessonText);
    if(item?.reading)lines.push("Assigned textbook reading: "+item.reading);
    if(item?.objectives?.length)lines.push("","Learning objectives:",...item.objectives.map(x=>"• "+x));
    else if(item)lines.push("","Learning objectives: No learning objectives are listed for this lesson in the curriculum document.");
    if(item?.skills?.length)lines.push("","Hands-on skills / JPR practice:",...item.skills.map(x=>"• "+x));
    else if(item)lines.push("","Hands-on skills / JPR practice: No specific skills practice was listed in the curriculum document for this lesson.");
    if(!item)lines.push("","Curriculum details for this subject/lesson were not found in the uploaded source document. Keep the scheduled subject and lesson and verify the curriculum before conducting training.");
    return lines.join("\n");
  }
  let curriculumScheduleSynced=false;
  async function syncScheduledCurriculum() {
    if(curriculumScheduleSynced || profile?.app_role!=="admin" || !db)return;
    const q=await db.from("training_schedule").select("id,subject,lesson,details").limit(5000);
    if(q.error)throw q.error;
    const changes=(q.data||[]).map(row=>({id:row.id,details:scheduledCurriculum(row)})).filter(x=>x.details && x.details!==String((q.data||[]).find(y=>String(y.id)===String(x.id))?.details||""));
    for(let i=0;i<changes.length;i+=40){
      const batch=changes.slice(i,i+40);
      const results=await Promise.all(batch.map(x=>db.from("training_schedule").update({details:x.details}).eq("id",x.id)));
      const failed=results.find(x=>x.error);if(failed)throw failed.error;
    }
    curriculumScheduleSynced=true;
  }
  const isManager = () => ["admin","officer"].includes(String(profile?.app_role || ""));
  const signedName = () => {const p=typeof currentPersonnel==="function"?currentPersonnel():null;return [p?.first_name,p?.last_name].filter(Boolean).join(" ") || [profile?.first_name,profile?.last_name].filter(Boolean).join(" ") || me?.email || "Officer";};
  const dateToday = () => typeof today === "function" ? today() : new Date().toISOString().slice(0,10);
  const isoDate = d => d.toISOString().slice(0,10);
  const addDays = (date,n) => { const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return isoDate(d); };
  function shiftForDate(date) {
    const d=new Date(date+"T00:00:00Z"), anchor=new Date("2027-01-01T00:00:00Z");
    const days=Math.round((d-anchor)/86400000), mod=((days%3)+3)%3;
    return ["C","A","B"][mod];
  }
  function buildScheduleRows(source) {
    const rows=source.map(x=>({schedule_date:x[0],shift:x[1],lesson:x[2],subject:x[3],start_time:"09:00",end_time:"12:00",source_year:2026,source_date:x[0]}));
    const by={A:[],B:[],C:[]};rows.forEach(r=>by[r.shift].push(r));
    const aFirstHalf=by.B.filter(r=>r.schedule_date<"2026-07-01");
    const a2026=[];let aCount=0;
    for(let date="2026-01-01";date<="2026-06-30";date=addDays(date,1)){
      const weekday=new Date(date+"T00:00:00Z").getUTCDay();
      if(weekday===0||weekday===6||shiftForDate(date)!=="A")continue;
      const sourceRow=aFirstHalf[aCount++];
      if(sourceRow)a2026.push({...sourceRow,schedule_date:date,shift:"A",source_year:2026,source_date:sourceRow.source_date});
    }
    const sequences={A:aFirstHalf.concat(by.A),B:by.B,C:by.C};
    const next={A:[],B:[],C:[]},counts={A:0,B:0,C:0};
    for(let date="2027-01-01";date<="2027-12-31";date=addDays(date,1)){
      const weekday=new Date(date+"T00:00:00Z").getUTCDay();
      if(weekday===0||weekday===6)continue;
      const shift=shiftForDate(date),sequence=sequences[shift],sourceRow=sequence.length?sequence[counts[shift]++%sequence.length]:null;
      if(sourceRow)next[shift].push({...sourceRow,schedule_date:date,shift,source_year:2026,source_date:sourceRow.source_date});
    }
    return rows.concat(a2026,next.A,next.B,next.C);
  }
  async function seedSchedule() {
    if(profile?.app_role!=="admin" || !db) return;
    const existing=await db.from("training_schedule").select("id").limit(1);
    if(existing.error)throw existing.error;
    if(existing.data?.length)return;
    const response=await fetch("/training-schedule-2026.json",{cache:"no-store"});
    if(!response.ok)throw new Error("The department training schedule source file could not be loaded.");
    const source=await response.json(),rows=buildScheduleRows(source);
    for(let i=0;i<rows.length;i+=100){
      const result=await db.from("training_schedule").upsert(rows.slice(i,i+100),{onConflict:"schedule_date,shift",ignoreDuplicates:true});
      if(result.error)throw result.error;
    }
  }
  async function loadRoster() {
    const r=await db.from("personnel").select("id,first_name,last_name,shift,active").eq("active",true).order("last_name").order("first_name");
    if(r.error)throw r.error;roster=r.data||[];
  }
  function personnelChecks(id,people,checkedIds) {
    const checked=new Set((checkedIds||[]).map(Number));
    return '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2" id="'+id+'">'+people.map(p=>'<label class="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm"><input type="checkbox" value="'+Number(p.id)+'" '+(checked.has(Number(p.id))?'checked':'')+'><span>'+esc(p.first_name+" "+p.last_name)+'</span><span class="ml-auto text-xs text-slate-400">'+esc(p.shift||"")+'</span></label>').join("")+'</div>';
  }
  function checkedIds(id){return Array.from($(id)?.querySelectorAll('input[type="checkbox"]:checked')||[]).map(x=>Number(x.value));}
  async function ensureScheduleYear(year) {
    if(year<2027)return;
    const from=year+"-01-01",to=year+"-12-31";
    const existing=await db.from("training_schedule").select("id").gte("schedule_date",from).lte("schedule_date",to).limit(1);
    if(existing.error)throw existing.error;
    if(!existing.data?.length){
      const generated=await db.rpc("ensure_training_schedule_year",{target_year:year});
      if(generated.error)throw generated.error;
    }
  }
  async function getSchedule(date,shift) {
    const r=await db.from("training_schedule").select("*").eq("schedule_date",date).eq("shift",shift).maybeSingle();
    if(r.error)throw r.error;return r.data||null;
  }
  async function getStaffed(date,shift) {
    const s=await db.from("daily_staffing").select("staffing_id").eq("staffing_date",date).eq("shift",shift).maybeSingle();
    if(s.error)throw s.error;if(!s.data)return {staffingId:null,people:[]};
    const [a,events]=await Promise.all([
      db.from("daily_app_assignments").select("daily_personnel_assignments(personnel_id,personnel(id,first_name,last_name,shift))").eq("staffing_id",s.data.staffing_id),
      db.from("daily_staffing_events").select("event_type,personnel_id,replacement_personnel_id,is_full_shift").eq("staffing_id",s.data.staffing_id)
    ]);
    if(a.error)throw a.error;if(events.error)throw events.error;
    const map=new Map();(a.data||[]).forEach(x=>(x.daily_personnel_assignments||[]).forEach(y=>{if(y.personnel_id&&y.personnel)map.set(Number(y.personnel_id),y.personnel)}));
    (events.data||[]).forEach(e=>{
      if(e.is_full_shift&&["leave","swap"].includes(e.event_type))map.delete(Number(e.personnel_id));
      if(e.replacement_personnel_id){const replacement=roster.find(p=>Number(p.id)===Number(e.replacement_personnel_id));if(replacement)map.set(Number(replacement.id),replacement);}
    });
    return {staffingId:s.data.staffing_id,people:Array.from(map.values()).sort((a,b)=>(a.last_name||"").localeCompare(b.last_name||""))};
  }
  function dailyHtml() {
    return '<div class="card p-5"><div class="flex flex-wrap justify-between gap-3 mb-4"><div><h2 class="text-xl font-black">Daily Shift Training Report</h2><p class="text-sm text-slate-500">Scheduled company training · Monday–Friday · 0900–1200</p></div><span id="trainingDailyStatus" class="text-xs font-bold text-slate-500">Not submitted</span></div><div class="grid sm:grid-cols-3 gap-3"><label class="text-sm font-semibold">Training date<input id="trainingDailyDate" type="date" class="block w-full border rounded-lg p-2 mt-1" value="'+dateToday()+'"></label><label class="text-sm font-semibold">Shift<input id="trainingDailyShift" class="block w-full border rounded-lg p-2 mt-1 bg-slate-100" readonly></label><label class="text-sm font-semibold">HOURS<input id="trainingDailyHours" class="block w-full border rounded-lg p-2 mt-1 bg-slate-100" readonly value="3.00"></label></div><div class="grid sm:grid-cols-2 gap-3 mt-3"><label class="text-sm font-semibold">Start time<input id="trainingDailyStart" type="time" class="block w-full border rounded-lg p-2 mt-1" value="09:00"></label><label class="text-sm font-semibold">End time<input id="trainingDailyEnd" type="time" class="block w-full border rounded-lg p-2 mt-1" value="12:00"></label></div><div class="grid sm:grid-cols-2 gap-3 mt-3"><label class="text-sm font-semibold">Scheduled lesson<input id="trainingDailyLesson" class="block w-full border rounded-lg p-2 mt-1 bg-slate-50" readonly></label><label class="text-sm font-semibold">Training subject<input id="trainingDailySubject" class="block w-full border rounded-lg p-2 mt-1" placeholder="Scheduled subject"></label><label class="text-sm font-semibold">Type<select id="trainingDailyCategory" class="block w-full border rounded-lg p-2 mt-1">'+typeOptions("Company Training (Fire)")+'</select></label><label class="text-sm font-semibold">Training location<input id="trainingDailyLocation" value="Station 1" class="block w-full border rounded-lg p-2 mt-1"></label></div><div class="mt-3"><label class="text-sm font-semibold">What was trained on (scheduled curriculum)<textarea id="trainingDailyDetails" rows="3" class="block w-full border rounded-lg p-2 mt-1 bg-slate-50"></textarea></label><p id="trainingScheduleHint" class="text-xs text-slate-500 mt-1"></p></div><div class="mt-4"><div class="flex justify-between gap-2 items-center mb-2"><h3 class="font-bold">Personnel staffed / attendance</h3><span id="trainingStaffingHint" class="text-xs text-slate-500"></span></div><div id="trainingDailyPeople" class="text-sm text-slate-500">Loading staffed personnel…</div></div><label class="block text-sm font-semibold mt-4">Additional notes<textarea id="trainingDailyNotes" rows="4" class="block w-full border rounded-lg p-3 mt-1" placeholder="Describe what was covered, practical exercises, deviations from the lesson, and any other notes."></textarea></label><label class="block text-sm font-semibold mt-3">Instructor<input id="trainingDailyOfficer" class="block w-full border rounded-lg p-2 mt-1" value="'+esc(signedName())+'"></label><div class="flex flex-wrap gap-2 mt-5"><button type="button" id="trainingDailySave" class="border rounded-lg px-4 py-2 font-bold">Save Draft</button><button type="button" id="trainingDailySign" class="bg-red-600 text-white rounded-lg px-4 py-2 font-bold">Sign Off · Training Conducted</button></div><p class="text-xs text-slate-500 mt-3">Signing confirms the training was conducted and records the officer, attendees, and individual training hours.</p></div>';
  }
  function eventHtml() {
    return '<div class="card p-5"><div class="mb-4"><h2 class="text-xl font-black">Training Event Report</h2><p class="text-sm text-slate-500">Use this blank form for special, multi-shift, outside-instructor, certification, and other unscheduled training.</p></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"><label class="text-sm font-semibold">Training date<input id="trainingEventDate" type="date" value="'+dateToday()+'" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">Start time<input id="trainingEventStart" type="time" value="09:00" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">End time<input id="trainingEventEnd" type="time" value="12:00" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">HOURS<input id="trainingEventHours" type="number" step="0.01" value="3.00" readonly class="block w-full border rounded-lg p-2 mt-1 bg-slate-100"></label><label class="text-sm font-semibold">Training subject<input id="trainingEventSubject" class="block w-full border rounded-lg p-2 mt-1" placeholder="Subject"></label><label class="text-sm font-semibold">Type<select id="trainingEventCategory" class="block w-full border rounded-lg p-2 mt-1"><option value="">Select type</option>'+typeOptions()+'</select></label><label class="text-sm font-semibold">Location<input id="trainingEventLocation" value="Station 1" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">Instructor<input id="trainingEventInstructor" value="'+esc(signedName())+'" class="block w-full border rounded-lg p-2 mt-1"></label></div><label class="block text-sm font-semibold mt-3">Lesson / course number<input id="trainingEventLesson" class="block w-full border rounded-lg p-2 mt-1" placeholder="Optional"></label><label class="block text-sm font-semibold mt-3">Training description<textarea id="trainingEventDescription" rows="4" class="block w-full border rounded-lg p-3 mt-1" placeholder="Describe the training objectives, material covered, practical evolutions, and outcomes."></textarea></label><label class="block text-sm font-semibold mt-3">Additional notes<textarea id="trainingEventNotes" rows="3" class="block w-full border rounded-lg p-3 mt-1" placeholder="Additional notes"></textarea></label><div class="mt-4"><h3 class="font-bold mb-2">Personnel attending</h3><input id="trainingEventMemberSearch" class="border rounded-lg p-2 w-full mb-2" placeholder="Search personnel…"><div id="trainingEventPeople">'+personnelChecks("trainingEventPeopleChecks",roster,[])+'</div></div><label class="block text-sm font-semibold mt-3">Officer / instructor submitting report<input id="trainingEventOfficer" class="block w-full border rounded-lg p-2 mt-1 bg-slate-50" readonly value="'+esc(signedName())+'"></label><div class="flex flex-wrap gap-2 mt-5"><button type="button" id="trainingEventSave" class="border rounded-lg px-4 py-2 font-bold">Save Draft</button><button type="button" id="trainingEventSign" class="bg-red-600 text-white rounded-lg px-4 py-2 font-bold">Sign & Complete Event</button></div></div>';
  }
  function renderShell() {
    const section=$("t-training");if(!section)return;
    eventRecordId=null;eventSelected.clear();
    section.innerHTML='<div class="flex flex-wrap justify-between items-center gap-3 mb-5"><div><h1 class="text-2xl font-black">Department Training</h1><p class="text-sm text-slate-500">Scheduled shift training and additional training events.</p></div><div class="flex gap-2"><button type="button" id="trainingDailyTab" class="bg-slate-950 text-white rounded-lg px-4 py-2 font-bold text-sm">Daily Training</button><button type="button" id="trainingEventTab" class="border rounded-lg px-4 py-2 font-bold text-sm">Add Other Training Event</button></div></div><div id="trainingDailyPanel">'+dailyHtml()+'</div><div id="trainingEventPanel" class="hiddenx">'+eventHtml()+'</div>';
    $("trainingDailyTab").onclick=()=>showView("daily");$("trainingEventTab").onclick=()=>{resetEventForm();showView("event");};
    $("trainingDailyDate").onchange=loadDailyForm;
    $("trainingDailyStart").oninput=updateDailyHours;$("trainingDailyEnd").oninput=updateDailyHours;
    $("trainingDailySave").onclick=()=>saveDaily(false);$("trainingDailySign").onclick=()=>saveDaily(true);
    $("trainingEventSave").onclick=()=>saveEvent(false);$("trainingEventSign").onclick=()=>saveEvent(true);$("trainingEventStart").oninput=updateEventHours;$("trainingEventEnd").oninput=updateEventHours;
    $("trainingEventMemberSearch").oninput=filterEventPeople;
    $("trainingEventPeople").addEventListener("change",e=>{if(e.target.matches('input[type="checkbox"]')){const id=Number(e.target.value);if(e.target.checked)eventSelected.add(id);else eventSelected.delete(id);}});
    if(!isManager()){ $("trainingDailySave").disabled=true;$("trainingDailySign").disabled=true;$("trainingEventSave").disabled=true;$("trainingEventSign").disabled=true; }
    showView(selectedTrainingView);
  }
  function showView(which) {
    selectedTrainingView=which;
    $("trainingDailyPanel")?.classList.toggle("hiddenx",which!=="daily");
    $("trainingEventPanel")?.classList.toggle("hiddenx",which!=="event");
    $("trainingDailyTab")?.classList.toggle("bg-slate-950",which==="daily");
    $("trainingDailyTab")?.classList.toggle("text-white",which==="daily");
    $("trainingEventTab")?.classList.toggle("bg-slate-950",which==="event");
    $("trainingEventTab")?.classList.toggle("text-white",which==="event");
  }
  function filterEventPeople() {
    const q=String($("trainingEventMemberSearch")?.value||"").toLowerCase();
    const selected=Array.from(eventSelected);
    const filtered=roster.filter(p=>(p.first_name+" "+p.last_name).toLowerCase().includes(q));
    $("trainingEventPeople").innerHTML=personnelChecks("trainingEventPeopleChecks",filtered,selected);
  }
  async function loadDailyForm() {
    if(!db)return;
    const date=$("trainingDailyDate").value||dateToday(),shift=shiftForDate(date);
    $("trainingDailyShift").value=shift+" Shift";
    $("trainingDailyOfficer").value=signedName();
    $("trainingDailyPeople").textContent="Loading staffed personnel…";
    try {
      await ensureScheduleYear(Number(date.slice(0,4)));
      await syncScheduledCurriculum();
      const [schedule,staffed]=await Promise.all([getSchedule(date,shift),getStaffed(date,shift)]);
      $("trainingDailySubject").value=schedule?.subject||"";
      $("trainingDailyLesson").value=schedule?.lesson||"";
      const curriculumDetails=scheduledCurriculum(schedule);
      $("trainingDailyDetails").value=schedule?(String(schedule.details||"").trim()||curriculumDetails):"";
      $("trainingDailyLocation").value="Station 1";$("trainingDailyCategory").value=inferTrainingType(schedule);$("trainingDailyOfficer").value=signedName();
      $("trainingDailyStart").value=(schedule?.start_time||"09:00").slice(0,5);
      $("trainingDailyEnd").value=(schedule?.end_time||"12:00").slice(0,5);updateDailyHours();
      $("trainingScheduleHint").textContent=schedule?"Scheduled subject and lesson loaded from the department training calendar.":"No scheduled lesson is listed for this date. The officer may enter the subject manually.";
      $("trainingStaffingHint").textContent=staffed.staffingId?"Staffing record loaded":"No daily staffing record found for this date and shift";
      const ids=staffed.people.map(p=>Number(p.id));
      $("trainingDailyPeople").innerHTML=staffed.people.length?personnelChecks("trainingDailyPeopleChecks",staffed.people,ids):'<p class="text-amber-700 bg-amber-50 rounded-lg p-3">No personnel are assigned in the daily staffing record. Update Staffing first, or contact an administrator.</p>';
      const q=await db.from("training_records").select("*,training_attendees(id,personnel_id,hours,personnel_name,shift_at_training)").eq("record_type","daily").eq("training_date",date).eq("shift",shift).maybeSingle();
      if(q.error)throw q.error;dailyRecord=q.data||null;
      if(dailyRecord){
        $("trainingDailySubject").value=dailyRecord.subject||$("trainingDailySubject").value;
        $("trainingDailyLesson").value=dailyRecord.lesson||$("trainingDailyLesson").value;
        $("trainingDailyStart").value=(dailyRecord.start_time||"09:00").slice(0,5);
        $("trainingDailyEnd").value=(dailyRecord.end_time||"12:00").slice(0,5);updateDailyHours();
        $("trainingDailyNotes").value=dailyRecord.notes||"";
        $("trainingDailyLocation").value=dailyRecord.location||"Station 1";$("trainingDailyCategory").value=dailyRecord.category||"Company Training (Fire)";$("trainingDailyDetails").value=dailyRecord.description||$("trainingDailyDetails").value;$("trainingDailyOfficer").value=dailyRecord.instructor||signedName();
        const attended=(dailyRecord.training_attendees||[]).map(x=>Number(x.personnel_id));
        $("trainingDailyPeople").innerHTML=personnelChecks("trainingDailyPeopleChecks",staffed.people,attended);
        $("trainingDailyStatus").textContent=dailyRecord.signed_at?"Signed · "+(dailyRecord.signed_by_name||"Officer"): "Draft saved";
      } else {$("trainingDailyNotes").value="";$("trainingDailyStatus").textContent="Not submitted";}
      const locked=!!dailyRecord?.signed_at&&profile?.app_role!=="admin";
      $("trainingDailySave").disabled=!isManager()||locked;$("trainingDailySign").disabled=!isManager()||locked;
    } catch(e){console.error(e);$("trainingDailyPeople").textContent="Unable to load training details: "+(e.message||e);}
  }
  function updateDailyHours(){const h=durationHours($("trainingDailyStart")?.value,$("trainingDailyEnd")?.value);if($("trainingDailyHours"))$("trainingDailyHours").value=h.toFixed(2);}
  function updateEventHours(){const h=durationHours($("trainingEventStart")?.value,$("trainingEventEnd")?.value);if($("trainingEventHours"))$("trainingEventHours").value=h.toFixed(2);}
  function resetEventForm(){eventRecordId=null;eventSelected.clear();["trainingEventSubject","trainingEventLesson","trainingEventDescription","trainingEventNotes"].forEach(id=>$(id).value="");$("trainingEventCategory").value="";$("trainingEventDate").value=dateToday();$("trainingEventStart").value="09:00";$("trainingEventEnd").value="12:00";$("trainingEventLocation").value="Station 1";$("trainingEventInstructor").value=signedName();$("trainingEventPeople").innerHTML=personnelChecks("trainingEventPeopleChecks",roster,[]);$("trainingEventMemberSearch").value="";updateEventHours();}
  function durationHours(start,end) {
    const a=String(start||"").split(":").map(Number),b=String(end||"").split(":").map(Number);
    if(a.length<2||b.length<2)return 0;
    return Math.max(0,((b[0]*60+b[1])-(a[0]*60+a[1]))/60);
  }
  async function saveRecord(payload,attendees,sign,attendeePeople=[]) {
    if(!isManager())throw new Error("Officer or administrator access is required.");
    if(!payload.subject.trim())throw new Error("Enter a training subject.");
    if(!payload.start_time||!payload.end_time||durationHours(payload.start_time,payload.end_time)<=0)throw new Error("Enter a valid start and end time.");
    if(!attendees.length)throw new Error("Select at least one attending firefighter.");
    if(sign){payload.conducted=true;payload.signed_by=me?.id||null;payload.signed_by_name=signedName();payload.signed_at=new Date().toISOString();}
    payload.updated_at=new Date().toISOString();
    let record;
    if(payload.id){
      const u=await db.from("training_records").update(payload).eq("id",payload.id).select("id").single();
      if(u.error)throw u.error;record=u.data;
    } else {
      payload.created_by=me?.id||null;
      const i=await db.from("training_records").insert(payload).select("id").single();
      if(i.error)throw i.error;record=i.data;
    }
    const del=await db.from("training_attendees").delete().eq("training_record_id",record.id);
    if(del.error)throw del.error;
    const hours=durationHours(payload.start_time,payload.end_time);
    const ins=await db.from("training_attendees").insert(attendees.map(id=>{const p=attendeePeople.find(x=>Number(x.id)===Number(id))||roster.find(x=>Number(x.id)===Number(id));return {training_record_id:record.id,personnel_id:id,personnel_name:p?[p.first_name,p.last_name].filter(Boolean).join(" "):"Unknown personnel",shift_at_training:p?.shift||null,hours};}));
    if(ins.error)throw ins.error;
    return record.id;
  }
  async function saveDaily(sign) {
    try {
      if(dailyRecord?.signed_at&&profile?.app_role!=="admin")throw new Error("This report has already been signed and is locked.");
      const date=$("trainingDailyDate").value,shift=shiftForDate(date),schedule=await getSchedule(date,shift),staffed=await getStaffed(date,shift);
      const payload={...(dailyRecord||{}),record_type:"daily",training_date:date,shift,staffing_id:staffed.staffingId,schedule_id:schedule?.id||dailyRecord?.schedule_id||null,subject:$("trainingDailySubject").value.trim(),lesson:$("trainingDailyLesson").value||null,category:$("trainingDailyCategory").value||"Company Training (Fire)",start_time:$("trainingDailyStart").value,end_time:$("trainingDailyEnd").value,location:$("trainingDailyLocation").value||null,instructor:$("trainingDailyOfficer").value.trim()||signedName(),description:$("trainingDailyDetails").value||null,notes:$("trainingDailyNotes").value||null};
      delete payload.training_attendees;delete payload.id;
      if(dailyRecord?.id)payload.id=dailyRecord.id;
      const id=await saveRecord(payload,checkedIds("trainingDailyPeopleChecks"),sign,staffed.people);
      alert(sign?"Daily training report signed and completed.":"Daily training draft saved.");
      await loadDailyForm();
      if(id)dailyRecord={...(dailyRecord||{}),id,signed_at:sign?new Date().toISOString():null};
    } catch(e){console.error(e);alert("Training report could not be saved: "+(e.message||e));}
  }
  async function saveEvent(sign) {
    try {
      const payload={id:eventRecordId||undefined,record_type:"event",training_date:$("trainingEventDate").value,shift:null,staffing_id:null,schedule_id:null,subject:$("trainingEventSubject").value.trim(),lesson:$("trainingEventLesson").value||null,category:$("trainingEventCategory").value||null,start_time:$("trainingEventStart").value,end_time:$("trainingEventEnd").value,location:$("trainingEventLocation").value||null,instructor:$("trainingEventInstructor").value||null,description:$("trainingEventDescription").value||null,notes:$("trainingEventNotes").value||null};
      const ids=Array.from(eventSelected);
      const id=await saveRecord(payload,ids,sign,roster);eventRecordId=id;
      alert(sign?"Training event signed and completed.":"Training event draft saved.");
      if(sign){resetEventForm();}
    } catch(e){console.error(e);alert("Training event could not be saved: "+(e.message||e));}
  }
  function printReport(r) {
    const attendees=(r.training_attendees||[]).map(a=>'<tr><td>'+esc(a.personnel?.first_name+" "+a.personnel?.last_name||"")+'</td><td>'+esc(a.personnel?.shift||"")+'</td><td>'+Number(a.hours||0).toFixed(2)+'</td></tr>').join("");
    const html='<!doctype html><html><head><title>Jasper Fire Department Training Report</title><style>body{font:14px Arial,sans-serif;color:#111;padding:28px}h1{font-size:20px;margin:0}h2{font-size:16px;margin:22px 0 8px}.muted{color:#555}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.field{border:1px solid #ddd;padding:9px}.field b{display:block;font-size:11px;text-transform:uppercase;color:#555}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ccc;padding:7px;text-align:left}pre{white-space:pre-wrap;font:14px Arial}@media print{button{display:none}}</style></head><body><h1>JASPER FIRE DEPARTMENT</h1><p class="muted">TRAINING REPORT</p><div class="grid"><div class="field"><b>Date</b>'+esc(r.training_date)+'</div><div class="field"><b>Shift / Type</b>'+esc(r.shift?r.shift+" Shift":"Training Event")+'</div><div class="field"><b>Subject</b>'+esc(r.subject)+'</div><div class="field"><b>Lesson / Category</b>'+esc([r.lesson,r.category].filter(Boolean).join(" · "))+'</div><div class="field"><b>Time</b>'+esc((r.start_time||"").slice(0,5)+" – "+(r.end_time||"").slice(0,5))+'</div><div class="field"><b>HOURS</b>'+durationHours(r.start_time,r.end_time).toFixed(2)+'</div><div class="field"><b>Type</b>'+esc(r.category||"") +'</div><div class="field"><b>Instructor / Officer</b>'+esc(r.instructor||r.signed_by_name||"")+'</div><div class="field"><b>Location</b>'+esc(r.location||"")+'</div><div class="field"><b>Status</b>'+(r.signed_at?"Completed / signed":"Draft")+'</div></div><h2>Training Description</h2><pre>'+esc(r.description||"")+'</pre><h2>Additional Notes</h2><pre>'+esc(r.notes||"")+'</pre><h2>Personnel Attendance</h2><table><thead><tr><th>Member</th><th>Shift</th><th>Hours</th></tr></thead><tbody>'+attendees+'</tbody></table><p style="margin-top:28px">Officer sign-off: '+esc(r.signed_by_name||"Not signed")+' '+esc(r.signed_at?new Date(r.signed_at).toLocaleString():"")+'</p><button onclick="window.print()">Print / Save as PDF</button></body></html>';
    const w=window.open("","_blank");if(!w){alert("Allow pop-ups to print or save this report as PDF.");return;}w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
  }
  function adminPanelHtml() {
    return '<div id="adminTrainingReportsSection" class="card p-5 mb-4 hiddenx"><div class="mb-4"><h2 class="text-xl font-black">Training Reports</h2><p class="text-sm text-slate-500">Search and retrieve completed and draft department training records.</p></div><div class="grid sm:grid-cols-2 lg:grid-cols-6 gap-2"><input id="adminTrainingSearch" class="border rounded-lg p-2" placeholder="Subject, notes, instructor…"><select id="adminTrainingMember" class="border rounded-lg p-2"><option value="">All personnel</option></select><select id="adminTrainingShift" class="border rounded-lg p-2"><option value="">All shifts / events</option><option>A</option><option>B</option><option>C</option></select><select id="adminTrainingCategory" class="border rounded-lg p-2"><option value="">All types</option>'+typeOptions()+'</select><input id="adminTrainingFrom" type="date" class="border rounded-lg p-2"><input id="adminTrainingTo" type="date" class="border rounded-lg p-2"></div><div class="flex gap-2 mt-3"><button id="adminTrainingSearchButton" class="bg-slate-950 text-white rounded-lg px-4 py-2 font-bold">Search Training</button><button id="adminTrainingExport" class="border rounded-lg px-4 py-2 font-bold">Export CSV</button></div><div id="adminTrainingResults" class="space-y-2 mt-4"><p class="text-sm text-slate-500">Choose search criteria and select Search Training.</p></div></div>';
  }
  async function refreshAdminTrainingMembers() {
    if(!$("adminTrainingMember")||!db)return;
    const attendeeRows=[];for(let offset=0;;offset+=1000){
      const r=await db.from("training_attendees").select("personnel_name,personnel(first_name,last_name)").range(offset,offset+999);
      if(r.error)throw r.error;attendeeRows.push(...(r.data||[]));if((r.data||[]).length<1000)break;
    }
    const names=new Set(roster.map(p=>[p.first_name,p.last_name].filter(Boolean).join(" ")));
    attendeeRows.forEach(a=>{const name=a.personnel_name||[a.personnel?.first_name,a.personnel?.last_name].filter(Boolean).join(" ");if(name)names.add(name);});
    $("adminTrainingMember").innerHTML='<option value="">All personnel</option>'+Array.from(names).sort((a,b)=>a.localeCompare(b)).map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join("");
  }
  let adminRows=[];
  async function searchAdminTraining() {
    const el=$("adminTrainingResults");el.innerHTML='<p class="text-sm text-slate-500">Searching…</p>';
    try {
      const allRecords=[];for(let offset=0;;offset+=1000){
        let q=db.from("training_records").select("*,training_attendees(id,personnel_id,hours,personnel_name,shift_at_training,personnel(id,first_name,last_name,shift))").order("training_date",{ascending:false});
        if($("adminTrainingFrom").value)q=q.gte("training_date",$("adminTrainingFrom").value);
        if($("adminTrainingTo").value)q=q.lte("training_date",$("adminTrainingTo").value);
        if($("adminTrainingShift").value)q=q.eq("shift",$("adminTrainingShift").value);
        if($("adminTrainingCategory").value)q=q.eq("category",$("adminTrainingCategory").value);
        const page=await q.range(offset,offset+999);if(page.error)throw page.error;allRecords.push(...(page.data||[]));if((page.data||[]).length<1000)break;
      }
      const term=$("adminTrainingSearch").value.toLowerCase().trim(),member=$("adminTrainingMember").value;
      adminRows=allRecords.filter(x=>{
        const people=x.training_attendees||[];
        const text=[x.subject,x.lesson,x.category,x.description,x.notes,x.instructor,x.signed_by_name].join(" ").toLowerCase();
        return (!term||text.includes(term))&&(!member||people.some(p=>(p.personnel_name||[p.personnel?.first_name,p.personnel?.last_name].filter(Boolean).join(" "))===member));
      });
      el.innerHTML=adminRows.map((x,i)=>'<div class="border rounded-lg p-3 flex flex-wrap justify-between items-center gap-3"><div><div class="font-bold">'+esc(x.subject)+'</div><div class="text-xs text-slate-500">'+esc(x.training_date)+' · '+esc(x.shift?x.shift+" Shift":"Training Event")+' · '+esc(x.category||x.lesson||"")+' · '+(x.signed_at?'<span class="text-green-700">Completed</span>':'<span class="text-amber-700">Draft</span>')+'</div><div class="text-xs text-slate-500 mt-1">'+(x.training_attendees||[]).map(p=>esc(p.personnel_name||[p.personnel?.first_name,p.personnel?.last_name].filter(Boolean).join(" "))).join(", ")+'</div></div><button type="button" data-index="'+i+'" class="trainingPrintBtn border rounded-lg px-3 py-2 text-sm font-bold">Download PDF</button></div>').join("")||'<p class="text-sm text-slate-500">No training records matched those filters.</p>';
      el.querySelectorAll(".trainingPrintBtn").forEach(b=>b.onclick=()=>adminArchivePdf("training",adminRows[Number(b.dataset.index)].id,false));
    } catch(e){el.innerHTML='<p class="text-sm text-red-700">'+esc(e.message||e)+'</p>';}
  }
  function exportAdminTraining() {
    const headers=["Date","Shift","Type","Subject","Lesson","Category","Start","End","Member","Member Shift","Hours","Instructor","Signed By","Signed At","Notes"];
    const rows=[headers].concat(adminRows.flatMap(r=>(r.training_attendees||[]).length?(r.training_attendees||[]).map(a=>[r.training_date,r.shift||"",r.record_type,r.subject,r.lesson||"",r.category||"",r.start_time,r.end_time,a.personnel_name||[a.personnel?.first_name,a.personnel?.last_name].filter(Boolean).join(" "),a.shift_at_training||a.personnel?.shift||"",a.hours,r.instructor||"",r.signed_by_name||"",r.signed_at||"",r.notes||""]):[[r.training_date,r.shift||"",r.record_type,r.subject,r.lesson||"",r.category||"",r.start_time,r.end_time,"","","",r.instructor||"",r.signed_by_name||"",r.signed_at||"",r.notes||""]]));
    const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="JFD_Training_Records.csv";a.click();URL.revokeObjectURL(url);
  }
  function installAdminCard() {
    const cards=$("adminSectionCards");if(!cards)return;
    if(!$("adminTrainingCard")){const b=document.createElement("button");b.id="adminTrainingCard";b.type="button";b.className="card p-4 text-left hover:border-red-400";b.innerHTML="<b>Training Reports</b><p class='text-xs text-slate-500 mt-1'>Search training by member, date, shift, subject, and download records.</p>";b.onclick=()=>window.adminOpenSection("adminTrainingReportsSection");cards.appendChild(b);}
    if(!$("adminTrainingReportsSection")){const panel=document.createElement("div");panel.innerHTML=adminPanelHtml();const node=panel.firstElementChild;$("adminReportArchive")?.insertAdjacentElement("afterend",node);}
    if($("adminTrainingSearchButton"))$("adminTrainingSearchButton").onclick=searchAdminTraining;if($("adminTrainingExport"))$("adminTrainingExport").onclick=exportAdminTraining;
    if($("adminTrainingMember"))refreshAdminTrainingMembers().catch(console.error);
  }
  function extendAdminNavigation() {
    const originalOpen=window.adminOpenSection,originalBack=window.adminShowSectionCards;
    if(originalOpen&&!originalOpen.__trainingWrapped){
      const wrapped=function(id){
        if(id!=="adminTrainingReportsSection"){$("adminTrainingReportsSection")?.classList.add("hiddenx");return originalOpen(id);}
        if(profile?.app_role!=="admin")return;
        loadRoster().then(()=>refreshAdminTrainingMembers()).catch(console.error);
        seedSchedule().catch(console.error);
        const ids=["adminReportArchive","adminStationsSection","adminApparatusSection","adminPersonnelSection","adminApparatusChecklistSection","adminInspectionChecklistSection","adminCallAnalysisPanel","adminHydrantReports","adminTrainingReportsSection"];
        $("adminSectionCards")?.classList.add("hiddenx");ids.forEach(k=>$(k)?.classList.toggle("hiddenx",k!==id));$("adminBackToCards")?.classList.remove("hiddenx");$("adminTrainingReportsSection")?.scrollIntoView({behavior:"smooth",block:"start"});
      };wrapped.__trainingWrapped=true;window.adminOpenSection=wrapped;
    }
    if(originalBack&&!originalBack.__trainingWrapped){
      const wrapped=function(){originalBack();$("adminTrainingReportsSection")?.classList.add("hiddenx");};wrapped.__trainingWrapped=true;window.adminShowSectionCards=wrapped;
    }
  }
  async function init() {
    if(!db||!me)return;
    try {
      await loadRoster();
      if(profile?.app_role==="admin")await seedSchedule();
      renderShell();
      installAdminCard();extendAdminNavigation();
      await loadDailyForm();
    } catch(e){console.error("Training module initialization failed",e);const section=$("t-training");if(section)section.innerHTML='<div class="card p-5 text-red-700">Training could not be loaded: '+esc(e.message||e)+'</div>';}
  }
  window.jfdTrainingTabEntered=init;
  window.jfdTrainingShiftForDate=shiftForDate;
  const originalTab=window.tab;
  if(originalTab&&!originalTab.__trainingWrapped){
    const wrapped=function(t){if(t==="training"&&!isManager()){alert("Training reports are available to officers and administrators.");return;}const result=originalTab(t);if(t==="training")setTimeout(()=>window.jfdTrainingTabEntered?.(),0);return result;};
    wrapped.__trainingWrapped=true;window.tab=wrapped;
  }
  document.addEventListener("DOMContentLoaded",()=>{
    const nav=document.querySelector("nav .max-w-7xl");
    if(nav&&!$("n-training")){const b=document.createElement("button");b.id="n-training";b.className="navbtn py-3 text-sm font-semibold";b.textContent="Training";b.onclick=()=>window.tab("training");const ref=$("n-inspections");ref?.insertAdjacentElement("afterend",b);}
    if(!$("t-training")){const section=document.createElement("section");section.id="t-training";section.className="hiddenx";$("t-admin")?.insertAdjacentElement("beforebegin",section);}
    installAdminCard();extendAdminNavigation();
  });
})();