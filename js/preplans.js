/* Jasper Fire Department pre-incident planning */
(function(){
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const BUCKET = "preplan-files";
  let map=null, preplanLayer=null, hydrantLayer=null, plans=[], plansLoaded=false, hydrantAssets=[], hydrantInspections=[], hydrantFlows=[], activePlan=null, editing=false, placing=false, activeTab="worksheet";
  const canEdit=()=>["admin","officer"].includes(String((typeof profile!=="undefined"?profile?.app_role:window.profile?.app_role)||"").toLowerCase());
  const userId=()=>(typeof me!=="undefined"?me?.id:window.me?.id)||null;
  const fields=[
    ["Occupancy Information",[
      ["occupancy_name","Occupancy Name"],["address","Address"],["phone","Phone"],["emergency_contact","Emergency Contact"],["emergency_phone","Emergency Contact Phone"],
      ["occupancy_classification","Occupancy Classification","checks",["Assembly","Business","Education","Factory","Institution","Mercantile","Residential","Storage","Multi-Occupancy","High-Hazard"]]
    ]],
    ["Operating Information and Access",[
      ["business_hours","Business Hours"],["primary_entrance","Primary Entrance"],["secondary_entrance","Secondary Entrance"],["knox_box_location","Knox Box Location"],
      ["interior_roof_access","Interior Roof Access","yesno"],["interior_roof_access_location","Interior Roof Access Location"],
      ["aerial_obstructions","Obstructions to Aerial","yesno"],["aerial_obstruction_locations","Obstruction Location(s)","textarea"]
    ]],
    ["Life Safety",[
      ["occupant_load","Occupant Load","select",["Low","Moderate","High"]],["fire_load","Fire Load","select",["Low","Moderate","High"]],["fire_load_locations","Fire Load Locations"],
      ["stairs_1","Stairs 1","textarea"],["stairs_2","Stairs 2","textarea"],["outside_fire_escape_stair","Outside Fire Escape / Stair","textarea"],
      ["persons_with_disabilities","Person(s) with Disability Locations","textarea"],["rescue_access_locations","Rescue Access Location(s)","textarea"],
      ["life_safety_concerns","Life Safety Concerns","textarea"],["evacuation_assembly_plan","Evacuation Assembly Plan","yesno"],["assembly_location","Assembly Location"]
    ]],
    ["Water Supply",[
      ["hydrant_location_1","Hydrant Location 1"],["hydrant_gpm_1","Hydrant 1 GPM"],["hydrant_location_2","Hydrant Location 2"],["hydrant_gpm_2","Hydrant 2 GPM"]
    ]],
    ["Exposures",[
      ["exposure_side_a","Side A Exposure","textarea"],["exposure_side_b","Side B Exposure","textarea"],["exposure_side_c","Side C Exposure","textarea"],["exposure_side_d","Side D Exposure","textarea"]
    ]],
    ["Hazards",[
      ["waste_trash_hazards","Waste and Trash Hazards","textarea"],["incinerator_inside","Incinerator or Compactor Inside","yesno"],["incinerator_location","Inside Location"],
      ["outside_compactors","Outside Compactors or Dumpsters","yesno"],["outside_compactor_location","Outside Location"],
      ["hazmat_1","Hazardous Material 1 · Type / Qty / Location","textarea"],["hazmat_2","Hazardous Material 2 · Type / Qty / Location","textarea"],["hazmat_3","Hazardous Material 3 · Type / Qty / Location","textarea"],
      ["msds_location","MSDS Location"],["right_to_know_facility","Right-to-Know Facility","yesno"],["sara_facility","SARA Facility","yesno"]
    ]],
    ["Building Construction",[
      ["roof_construction","Roof Construction","checks",["Truss","Metal Truss","Wood Truss","Lightweight Truss","Heavyweight Truss","Solid Wood Joist","Steel","Poured Concrete / Rebar","Wooden I-Beams","Steel I-Beams"]],
      ["attic_cockloft_access","Attic / Cockloft Access","yesno"],["attic_cockloft_location","Attic / Cockloft Access Location"],["roof_vents","Roof Vents","yesno"],["roof_vents_type","Roof Vents","checks",["Automatic","Manual","N/A"]],["roof_vents_location","Roof Vent Location"],
      ["floor_construction","Floor Construction","checks",["Truss","Metal Truss","Wood Truss","Lightweight Truss","Heavyweight Truss","Solid Wood Joist","Steel","Poured Concrete / Rebar","Wooden I-Beams","Steel I-Girder"]],
      ["floor_decking","Floor Decking","checks",["Poured Concrete","Pre-Cast Concrete","Wood Plank","Plywood","Composite"]],
      ["basement","Basement","checks",["Full","Partial","N/A"]],["basement_partial_sides","Basement Partial · Sides"],["basement_access_interior","Basement Access · Interior"],["basement_access_exterior","Basement Access · Exterior"],["crawl_space_access","Crawl Space Access"],
      ["combustible_concealed_spaces","Combustible Concealed Spaces","checks",["Attic","Cockloft","Crawl Space","Other"]],
      ["elevator_key_location","Elevator Key Location"],["elevator_numbers","Elevator Number(s)"],["elevator_floors_served","Elevator Floors Served"],["elevator_mechanical_room_floors","Elevator Mechanical Room Floor(s)"],
      ["heating_system","Heating System","checks",["Electric","Gas","Oil","Other"]],["heating_system_other","Other Heating System"],["heating_emergency_shutoff","Heating Emergency Shutoff"],
      ["hvac_control_locations","HVAC Control Locations 1-4","textarea"],["smoke_management_purge","Smoke Management System Purge","checks",["Automatic","Manual","N/A"]],
      ["air_intake_locations","Air Intake Locations","textarea"],["equipment_room_locations","Equipment Room Location(s)","textarea"],
      ["emergency_generator","Emergency Generator / Location"],["electric_shutoff","Electric Shutoff"],["gas_shutoff","Gas Shutoff"],["water_shutoff","Water Shutoff"],["other_utility_shutoff","Other Utility Shutoff"]
    ]],
    ["Building Fire Protection Systems",[
      ["fire_alarm","Fire Alarm","yesno"],["fire_alarm_panel_location","Fire Alarm Panel Location"],
      ["sprinkler_system","Sprinkler System","yesno"],["sprinkler_types","Sprinkler Type","checks",["Wet","Dry","Deluge","Pre-Action"]],["sprinkler_coverage","Sprinkler Coverage","checks",["Full","Partial"]],["sprinkler_partial_location","Partial Sprinkler Location"],["sprinkler_riser_room","Riser Room Location"],["sprinkler_fdc","FDC Location"],
      ["standpipes","Standpipes","yesno"],["standpipe_locations","Standpipe Location(s)"],["standpipe_class","Standpipe Class","checks",["I","II","III"]],["standpipe_fdc","Standpipe FDC / OY&S"],
      ["chemical_extinguishment","Chemical Extinguishment System","checks",["Clean Agent","Dry Chemical","Wet Chemical","CO2","Other"]],["chemical_extinguishment_other","Other Chemical System"],
      ["fire_walls","Fire Walls","textarea"],["fire_partitions","Fire Partitions","textarea"]
    ]]
  ];
  function fieldHtml(f,data){
    const [key,label,type="text",opts]=f, value=data[key]??"";
    const disabled=editing?"":"disabled";
    if(type==="checks"){
      const selected=Array.isArray(value)?value:[];
      return '<fieldset class="border rounded-lg p-3"><legend class="px-1 text-sm font-semibold">'+esc(label)+'</legend><div class="grid sm:grid-cols-2 gap-2">'+opts.map(o=>'<label class="text-sm flex gap-2 items-start"><input type="checkbox" data-field="'+key+'" data-multi="1" value="'+esc(o)+'" '+(selected.includes(o)?"checked ":"")+disabled+'> '+esc(o)+'</label>').join("")+'</div></fieldset>';
    }
    if(type==="yesno")return '<label class="block text-sm font-semibold">'+esc(label)+'<select data-field="'+key+'" '+disabled+' class="mt-1 w-full border rounded-lg p-2 bg-white"><option value="">Select</option><option '+(value==="Yes"?"selected":"")+' value="Yes">Yes</option><option '+(value==="No"?"selected":"")+' value="No">No</option><option '+(value==="N/A"?"selected":"")+' value="N/A">N/A</option></select></label>';
    if(type==="select")return '<label class="block text-sm font-semibold">'+esc(label)+'<select data-field="'+key+'" '+disabled+' class="mt-1 w-full border rounded-lg p-2 bg-white"><option value="">Select</option>'+opts.map(o=>'<option '+(value===o?"selected ":"")+'value="'+esc(o)+'">'+esc(o)+'</option>').join("")+'</select></label>';
    const area=type==="textarea"||String(value).length>100;
    return '<label class="block text-sm font-semibold">'+esc(label)+(area?'<textarea data-field="'+key+'" '+disabled+' rows="2" class="mt-1 w-full border rounded-lg p-2 bg-white">'+esc(value)+'</textarea>':'<input data-field="'+key+'" '+disabled+' value="'+esc(value)+'" class="mt-1 w-full border rounded-lg p-2 bg-white">')+'</label>';
  }
  function worksheetHtml(plan){
    const d=plan.worksheet_data||{};
    return '<div class="space-y-5">'+fields.map(([section,fs])=>'<section><h3 class="font-black text-lg border-b pb-2 mb-3">'+esc(section)+'</h3><div class="grid md:grid-cols-2 gap-3">'+fs.map(f=>fieldHtml(f,d)).join("")+'</div></section>').join("")+
      '<section><h3 class="font-black text-lg border-b pb-2 mb-3">Building Layout Sketches</h3><p class="text-sm text-slate-600">Add sketches or floor plans in the Pictures tab. Label each image as Sketch 1, Sketch 2, or Sketch 3.</p></section></div>';
  }
  function ensureModal(){
    let m=$("jfdPreplanModal");if(m)return m;
    m=document.createElement("div");m.id="jfdPreplanModal";m.className="hiddenx fixed inset-0 z-[100000] bg-slate-950/70 p-2 sm:p-5 overflow-y-auto";
    m.innerHTML='<div class="max-w-5xl mx-auto bg-white rounded-xl shadow-2xl my-3"><div class="p-4 sm:p-5 border-b flex flex-wrap justify-between gap-3 items-start"><div><h2 id="jfdPreplanTitle" class="text-xl font-black">Pre-Plan</h2><p id="jfdPreplanLocation" class="text-xs text-slate-500 mt-1"></p></div><div class="flex flex-wrap gap-2"><button id="jfdPreplanEdit" class="hiddenx bg-slate-900 text-white rounded-lg px-3 py-2 text-sm font-bold">Edit</button><button id="jfdPreplanSave" class="hiddenx bg-red-600 text-white rounded-lg px-3 py-2 text-sm font-bold">Save Changes</button><button id="jfdPreplanDelete" class="hiddenx border border-red-300 text-red-700 rounded-lg px-3 py-2 text-sm font-bold">Delete Preplan</button><button id="jfdPreplanClose" class="border rounded-lg px-3 py-2 text-sm font-bold">Close</button></div></div><div class="px-4 sm:px-5 pt-3 border-b flex gap-2 overflow-x-auto"><button data-ptab="worksheet" class="jfd-ptab px-3 py-2 font-bold border-b-2 border-red-600 whitespace-nowrap">Pre-Plan Worksheet</button><button data-ptab="notes" class="jfd-ptab px-3 py-2 font-bold border-b-2 border-transparent whitespace-nowrap">Notes</button><button data-ptab="files" class="jfd-ptab px-3 py-2 font-bold border-b-2 border-transparent whitespace-nowrap">Files</button><button data-ptab="pictures" class="jfd-ptab px-3 py-2 font-bold border-b-2 border-transparent whitespace-nowrap">Pictures</button></div><div id="jfdPreplanBody" class="p-4 sm:p-5"></div></div>';
    document.body.appendChild(m);
    $("jfdPreplanClose").onclick=()=>m.classList.add("hiddenx");
    m.querySelectorAll("[data-ptab]").forEach(b=>b.onclick=()=>{activeTab=b.dataset.ptab;renderModal()});
    $("jfdPreplanEdit").onclick=()=>{if(!canEdit())return;editing=true;renderModal()};
    $("jfdPreplanSave").onclick=savePlan;
    $("jfdPreplanDelete").onclick=deletePlan;
    return m;
  }
  function renderModal(){
    if(!activePlan)return;
    const m=ensureModal(),plan=activePlan,editable=canEdit()&&editing;
    $("jfdPreplanTitle").textContent=plan.property_name||plan.title||"Pre-Plan";
    $("jfdPreplanLocation").textContent=[plan.address,Number(plan.latitude).toFixed(6)+", "+Number(plan.longitude).toFixed(6)].filter(Boolean).join(" · ");
    $("jfdPreplanEdit").classList.toggle("hiddenx",!canEdit()||editing);
    $("jfdPreplanSave").classList.toggle("hiddenx",!editable);
    $("jfdPreplanDelete").classList.toggle("hiddenx",!canEdit());
    m.querySelectorAll("[data-ptab]").forEach(b=>{const on=b.dataset.ptab===activeTab;b.classList.toggle("border-red-600",on);b.classList.toggle("border-transparent",!on)});
    const body=$("jfdPreplanBody");
    if(activeTab==="worksheet"){
      body.innerHTML='<div class="grid md:grid-cols-2 gap-3 mb-4"><label class="block text-sm font-semibold">Occupancy / Property Name<input id="ppPropertyName" '+(editable?"":"disabled")+' value="'+esc(plan.property_name||"")+'" class="mt-1 w-full border rounded-lg p-2"></label><label class="block text-sm font-semibold">Property Address<input id="ppAddress" '+(editable?"":"disabled")+' value="'+esc(plan.address||"")+'" class="mt-1 w-full border rounded-lg p-2"></label></div>'+worksheetHtml(plan);
    }else if(activeTab==="notes"){
      body.innerHTML='<h3 class="font-black text-lg mb-2">Operational Notes</h3><textarea id="ppNotes" '+(editable?"":"disabled")+' rows="12" class="w-full border rounded-lg p-3" placeholder="Access instructions, hazards, tactical considerations, updates...">'+esc(plan.notes||"")+'</textarea><p class="text-xs text-slate-500 mt-2">Notes are saved with this preplan.</p>';
    }else{
      const pics=activeTab==="pictures",items=(plan.attachments||[]).filter(x=>(x.kind==="picture")===pics);
      body.innerHTML=(editable?'<div class="border rounded-lg p-3 mb-4"><label class="block text-sm font-bold">'+(pics?"Upload Pictures":"Upload Files")+'<input id="ppUpload" type="file" '+(pics?'accept="image/*" multiple':'multiple')+' class="block mt-2 text-sm"></label><p class="text-xs text-slate-500 mt-1">Private department storage. Maximum file size 50 MB.</p></div>':"")+
        (items.length?'<div class="'+(pics?'grid sm:grid-cols-2 lg:grid-cols-3 gap-3':'space-y-2')+'">'+items.map((x,i)=>pics?'<article class="border rounded-lg p-2"><a href="#" data-open-file="'+i+'" class="block"><img data-preview="'+i+'" alt="'+esc(x.name)+'" class="w-full h-48 object-cover rounded bg-slate-100"><span class="block text-sm font-semibold mt-2">'+esc(x.name)+'</span></a>'+(editable?'<button data-delete-file="'+i+'" class="mt-2 text-sm text-red-700 font-bold">Delete picture</button>':"")+'</article>':'<article class="border rounded-lg p-3 flex justify-between gap-3 items-center"><div class="min-w-0"><b class="text-sm">'+esc(x.name)+'</b><div class="text-xs text-slate-500">'+esc(x.mime_type||"File")+' · '+Math.max(1,Math.round((x.size||0)/1024))+' KB</div></div><div class="flex gap-2 shrink-0"><button data-open-file="'+i+'" class="border rounded px-2 py-1 text-sm">Open</button>'+(editable?'<button data-delete-file="'+i+'" class="text-red-700 text-sm font-bold">Delete</button>':"")+'</div></article>').join("")+'</div>':'<p class="text-sm text-slate-500">No '+(pics?"pictures":"files")+' uploaded.</p>');
      body.querySelectorAll("[data-open-file]").forEach(b=>b.onclick=async e=>{e.preventDefault();const x=items[Number(b.dataset.openFile)];const win=window.open("about:blank","_blank");const r=await db.storage.from(BUCKET).createSignedUrl(x.path,3600);if(r.error){win?.close();return alert(r.error.message)}if(win)win.location.href=r.data.signedUrl});
      body.querySelectorAll("[data-delete-file]").forEach(b=>b.onclick=()=>removeAttachment(items[Number(b.dataset.deleteFile)]));
      if(pics)items.forEach(async(x,i)=>{const r=await db.storage.from(BUCKET).createSignedUrl(x.path,3600);const img=body.querySelector('[data-preview="'+i+'"]');if(!r.error&&img)img.src=r.data.signedUrl});
      $("ppUpload")?.addEventListener("change",uploadAttachments);
    }
    if(activeTab==="worksheet")body.querySelectorAll("[data-field]").forEach(el=>el.addEventListener("change",()=>{}));
  }
  async function savePlan(){
    if(!canEdit()||!activePlan)return;
    const body=$("jfdPreplanBody");
    if(activeTab==="worksheet"){
      const data={...(activePlan.worksheet_data||{})};
      body.querySelectorAll("[data-field]").forEach(el=>{const k=el.dataset.field;if(el.dataset.multi){const vals=[...body.querySelectorAll('[data-field="'+k+'"][data-multi="1"]:checked')].map(x=>x.value);data[k]=vals}else data[k]=el.value});
      activePlan.worksheet_data=data;
      const nameInput=$("ppPropertyName")?.value.trim()||"",addressInput=$("ppAddress")?.value.trim()||"";
      data.occupancy_name=nameInput!==String(activePlan.property_name||"")?nameInput:(data.occupancy_name||nameInput);
      data.address=addressInput!==String(activePlan.address||"")?addressInput:(data.address||addressInput);
      activePlan.property_name=data.occupancy_name;
      activePlan.address=data.address;
      activePlan.title=activePlan.property_name||activePlan.address||"Pre-Plan";
    }else if(activeTab==="notes")activePlan.notes=$("ppNotes")?.value||"";
    const payload={worksheet_data:activePlan.worksheet_data||{},notes:activePlan.notes||"",property_name:activePlan.property_name||null,address:activePlan.address||null,title:activePlan.title||"Pre-Plan",updated_by:userId(),updated_at:new Date().toISOString()};
    const r=await db.from("preincident_plans").update(payload).eq("id",activePlan.id).select("*").maybeSingle();
    if(r.error)return alert("Could not save preplan: "+r.error.message);
    activePlan=r.data||activePlan;editing=false;await loadPlans();renderModal();alert("Preplan saved.");
  }
  async function uploadAttachments(ev){
    if(!canEdit()||!activePlan)return;
    const files=[...(ev.target.files||[])];if(!files.length)return;
    for(const file of files){
      if(file.size>50*1024*1024){alert(file.name+" exceeds the 50 MB limit.");continue}
      const kind=file.type.startsWith("image/")?"picture":"file";
      if(activeTab==="pictures"&&(!["image/jpeg","image/png","image/webp"].includes(file.type))){alert("Pictures must be JPG, PNG, or WebP images.");continue}
      if(activeTab==="files"&&kind==="picture"){alert("Upload images in the Pictures tab.");continue}
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path=activePlan.id+"/"+kind+"/"+crypto.randomUUID()+"-"+safe;
      const up=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
      if(up.error){alert("Upload failed for "+file.name+": "+up.error.message);continue}
      const meta={name:file.name,path,kind,mime_type:file.type||"",size:file.size,uploaded_at:new Date().toISOString(),uploaded_by:userId()};
      const next=[...(activePlan.attachments||[]),meta];
      const upd=await db.from("preincident_plans").update({attachments:next,updated_by:userId(),updated_at:new Date().toISOString()}).eq("id",activePlan.id).select("*").maybeSingle();
      if(upd.error){await db.storage.from(BUCKET).remove([path]);alert("File uploaded but could not be attached to the preplan: "+upd.error.message);continue}
      activePlan=upd.data||{...activePlan,attachments:next};
    }
    renderModal();
  }
  async function removeAttachment(item){
    if(!canEdit()||!item||!activePlan)return;
    if(!confirm("Delete "+item.name+" from this preplan?"))return;
    const r=await db.storage.from(BUCKET).remove([item.path]);if(r.error)return alert(r.error.message);
    const next=(activePlan.attachments||[]).filter(x=>x.path!==item.path);
    const u=await db.from("preincident_plans").update({attachments:next,updated_by:userId(),updated_at:new Date().toISOString()}).eq("id",activePlan.id).select("*").maybeSingle();
    if(u.error)return alert("Storage file deleted, but the preplan record could not be updated: "+u.error.message);
    activePlan=u.data||{...activePlan,attachments:next};renderModal();
  }
  async function deletePlan(){
    if(!canEdit()||!activePlan)return;
    if(!confirm("Permanently delete this preplan and all attached files?"))return;
    const paths=(activePlan.attachments||[]).map(x=>x.path).filter(Boolean);
    if(paths.length){const rm=await db.storage.from(BUCKET).remove(paths);if(rm.error)return alert("Files could not be deleted: "+rm.error.message)}
    const r=await db.from("preincident_plans").delete().eq("id",activePlan.id);
    if(r.error)return alert(r.error.message);
    $("jfdPreplanModal").classList.add("hiddenx");activePlan=null;editing=false;await loadPlans();renderCards();
  }
  async function openPlan(id){
    const r=await db.from("preincident_plans").select("*").eq("id",id).maybeSingle();
    if(r.error||!r.data)return alert(r.error?.message||"Preplan not found.");
    activePlan=r.data;editing=false;activeTab="worksheet";renderModal();$("jfdPreplanModal").classList.remove("hiddenx");
  }
  function renderCards(){
    const el=$("preplanList");if(!el)return;
    el.innerHTML=plans.length?plans.map(p=>'<button type="button" data-plan-card="'+p.id+'" class="w-full text-left card p-3 hover:border-red-400"><b>'+esc(p.property_name||p.title||"Pre-Plan")+'</b><div class="text-sm text-slate-600">'+esc(p.address||"Map location")+'</div><div class="text-xs text-slate-500">'+Number(p.latitude).toFixed(5)+", "+Number(p.longitude).toFixed(5)+' · '+(p.attachments||[]).length+' attachments</div></button>').join(""):'<p class="text-sm text-slate-500">No preplans have been added yet.</p>';
    el.querySelectorAll("[data-plan-card]").forEach(b=>b.onclick=()=>openPlan(b.dataset.planCard));
  }
  async function loadPlans(){
    const r=await db.from("preincident_plans").select("*").order("property_name");
    if(r.error)throw r.error;
    plans=r.data||[];plansLoaded=true;renderCards();drawMarkers();attachIncidentButtons();
  }
  function hydrantIcon(id){
    return L.divIcon({className:"jfd-preplan-hydrant-icon",html:'<span style="display:flex;align-items:center;justify-content:center;min-width:42px;height:27px;padding:0 5px;border:2px solid #fff;border-radius:6px;background:#c62828;box-shadow:0 1px 5px #0009;color:#fff;font-size:12px;font-weight:900">'+esc(id)+'</span>',iconSize:[48,29],iconAnchor:[24,14]});
  }
  function preplanIcon(){
    return L.divIcon({className:"jfd-preplan-pp-icon",html:'<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#174ea6;box-shadow:0 2px 6px #0009;color:#fff;font-size:13px;font-weight:900"><span style="transform:rotate(45deg)">PP</span></span>',iconSize:[36,36],iconAnchor:[18,34]});
  }
  function latestHydrantRecord(rows,id,key){
    return rows.filter(x=>String(x.hydrant_id||"").toUpperCase()===String(id).toUpperCase() || (key==="tested_at"&&[x.test_hydrant_id,x.flow_hydrant_id].some(v=>String(v||"").toUpperCase()===String(id).toUpperCase()))).sort((a,b)=>String(b[key]||"").localeCompare(String(a[key]||"")))[0]||null;
  }
  function hydrantPopup(a){
    const ins=latestHydrantRecord(hydrantInspections,a.id,"inspected_at"),fl=latestHydrantRecord(hydrantFlows,a.id,"tested_at");
    return '<div style="min-width:210px"><b style="font-size:15px">Hydrant '+esc(a.id)+'</b><div style="font-size:11px;color:#64748b">'+Number(a.latitude).toFixed(6)+', '+Number(a.longitude).toFixed(6)+'</div><hr style="margin:6px 0"><div style="font-size:12px"><b>Last inspection:</b> '+esc(ins?.inspected_at||"No record")+'</div><div style="font-size:12px"><b>Condition:</b> '+esc(ins?.condition||"Not recorded")+'</div><div style="font-size:12px"><b>Inspector:</b> '+esc(ins?.inspector||"Not recorded")+'</div><div style="font-size:12px;margin-top:5px"><b>Last flow test:</b> '+esc(fl?.tested_at||"No record")+'</div><div style="font-size:12px"><b>Flow:</b> '+(fl?.calculated_flow_gpm!=null?Number(fl.calculated_flow_gpm).toLocaleString()+" GPM":"Not recorded")+'</div><div style="font-size:12px"><b>Static / Residual:</b> '+esc(fl?.static_pressure??"—")+' / '+esc(fl?.residual_pressure??"—")+' PSI</div></div>';
  }
  async function loadHydrantOverlay(){
    const [coordsRes,idsRes,insRes,flowRes]=await Promise.all([
      fetch("/hydrants.json",{cache:"no-cache"}),fetch("/hydrant-ids.json",{cache:"no-cache"}),
      db.from("hydrant_inspections").select("hydrant_id,inspected_at,inspector,condition").order("inspected_at",{ascending:false}).limit(2500),
      db.from("hydrant_flow_tests").select("hydrant_id,test_hydrant_id,flow_hydrant_id,tested_at,calculated_flow_gpm,static_pressure,residual_pressure").order("tested_at",{ascending:false}).limit(2500)
    ]);
    if(!coordsRes.ok||!idsRes.ok)throw new Error("Hydrant coordinate files could not be loaded.");
    if(insRes.error)throw insRes.error;if(flowRes.error)throw flowRes.error;
    const coords=await coordsRes.json(),ids=await idsRes.json();hydrantAssets=[];
    for(let i=0;i<Math.min(coords.length,ids.length);i++){
      const id=String(ids[i]||"").trim().toUpperCase(),lat=Number(coords[i]?.lat),lng=Number(coords[i]?.lng);
      if(id&&!/^Fire St /i.test(id)&&Number.isFinite(lat)&&Number.isFinite(lng))hydrantAssets.push({id,latitude:lat,longitude:lng});
    }
    hydrantInspections=insRes.data||[];hydrantFlows=flowRes.data||[];
  }
  function drawMarkers(){
    if(!map||!preplanLayer||!hydrantLayer)return;
    preplanLayer.clearLayers();hydrantLayer.clearLayers();
    hydrantAssets.forEach(a=>L.marker([a.latitude,a.longitude],{icon:hydrantIcon(a.id),title:"Hydrant "+a.id}).bindPopup(hydrantPopup(a)).addTo(hydrantLayer));
    plans.forEach(p=>{const lat=Number(p.latitude),lng=Number(p.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const marker=L.marker([lat,lng],{icon:preplanIcon(),title:"Preplan: "+(p.property_name||p.address||"Preplan")}).bindPopup('<b>'+esc(p.property_name||p.title||"Preplan")+'</b><br>'+esc(p.address||"")+'<br><button type="button" onclick="jfdOpenPreplan(\\''+p.id+'\\')" style="margin-top:6px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:5px">Open Preplan</button>');
      marker.addTo(preplanLayer);
    });
  }
  function initMap(){
    const el=$("preplanMap");if(!el||!window.L)return;
    if(!map){map=L.map(el).setView([33.875,-87.27],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);hydrantLayer=L.layerGroup().addTo(map);preplanLayer=L.layerGroup().addTo(map);
      map.on("click",e=>{if(!placing||!canEdit())return;placing=false;$("preplanPlaceButton").textContent="Add Preplan Location";$("preplanPlaceHint").textContent="";createPlanAt(e.latlng.lat,e.latlng.lng)});
    }
    drawMarkers();setTimeout(()=>map.invalidateSize(),150);
  }
  async function createPlanAt(lat,lng){
    if(!canEdit())return;
    const title=prompt("Preplan property or occupancy name:");if(title===null)return;
    const address=prompt("Property address (optional; map coordinates will also be saved):")||"";
    const payload={title:title.trim()||address.trim()||"New Pre-Plan",property_name:title.trim()||null,address:address.trim()||null,latitude:lat,longitude:lng,worksheet_data:{},attachments:[],notes:"",status:"Draft",created_by:userId(),updated_by:userId()};
    const r=await db.from("preincident_plans").insert(payload).select("*").maybeSingle();
    if(r.error)return alert("Could not create preplan: "+r.error.message);
    await loadPlans();await openPlan(r.data.id);
  }
  async function enter(){
    $("preplanPlaceButton")?.classList.toggle("hiddenx",!canEdit());
    try{
      if(!window.L&&typeof window.jfdLoadLeaflet==="function")await window.jfdLoadLeaflet();
      if(!window.L){const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";await new Promise((res,rej)=>{s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
      await loadHydrantOverlay();initMap();await loadPlans();
    }catch(e){console.error("Preplans",e);const st=$("preplanStatus");if(st)st.textContent="Unable to load preplans: "+(e.message||e)}
  }
  async function attachIncidentButtons(){
    if(!plansLoaded){try{await loadPlans()}catch(e){return}}
    if(!plans.length)return;
    document.querySelectorAll("#incidentList .scene-card").forEach(card=>{
      if(card.querySelector("[data-preplan-button]"))return;
      const loc=String(card.dataset.location||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
      const lat=Number(card.dataset.lat),lng=Number(card.dataset.lng);
      const p=plans.find(x=>{
        const addr=String(x.address||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
        if(addr&&loc&&addr===loc)return true;
        if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat-Number(x.latitude))<0.0004&&Math.abs(lng-Number(x.longitude))<0.0004)return true;
        return false;
      });
      if(!p)return;
      const actions=card.querySelector(".scene-actions");if(!actions)return;
      const b=document.createElement("button");b.type="button";b.dataset.preplanButton="1";b.className="scene-action scene-secondary px-3 py-2 rounded-lg text-sm font-bold";b.textContent="Open Preplan";b.onclick=()=>openPlan(p.id);actions.appendChild(b);
    });
  }
  window.jfdOpenPreplan=openPlan;
  window.jfdPreplansEnter=enter;
  document.addEventListener("DOMContentLoaded",()=>{
    $("preplanPlaceButton")?.addEventListener("click",()=>{if(!canEdit())return alert("Only officers and administrators can add preplans.");placing=!placing;$("preplanPlaceButton").textContent=placing?"Cancel Map Selection":"Add Preplan Location";$("preplanPlaceHint").textContent=placing?"Click the map to place the preplan marker.":""});
    const incidentList=$("incidentList");
    if(incidentList&&window.MutationObserver)new MutationObserver(()=>attachIncidentButtons()).observe(incidentList,{childList:true,subtree:true});
  });
})();