/* JFDRMS Hydrants module */
(function(){
  const $ = id => document.getElementById(id);
  const escH = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  let map = null, markerLayer = null, assets = [], schedules = [], inspections = [], flowTests = [], selected = null, mode = "inspection", initialized = false, loading = false;
  const todayISO = () => (typeof today === "function" ? today() : new Date().toISOString().slice(0,10));
  const allowed = () => typeof profile!=="undefined" && profile && ["admin","officer"].includes(String(profile.app_role||"").toLowerCase());
  function status(msg, bad=false){const n=$("hydrantStatus");if(n){n.textContent=msg;n.className="text-sm mt-2 "+(bad?"text-red-700":"text-slate-600")}}
  function monthValue(){return Number($("hydrantMonth")?.value||new Date().getMonth()+1)}
  function yearValue(){return Number($("hydrantYear")?.value||new Date().getFullYear())}
  function shiftValue(){return $("hydrantShift")?.value||"A"}
  function assetKey(v){return String(v||"").trim().toUpperCase()}
  function currentSchedule(){return schedules.filter(x=>String(x.shift)===shiftValue()&&Number(x.schedule_year)===yearValue()&&Number(x.schedule_month)===monthValue())}
  function scheduleFor(id){return currentSchedule().filter(x=>assetKey(x.hydrant_id)===assetKey(id))}
  function colorFor(id){const t=scheduleFor(id).map(x=>x.task_type);if(t.includes("inspection")&&t.includes("flow_test"))return "#7c3aed";if(t.includes("inspection"))return "#d97706";if(t.includes("flow_test"))return "#0284c7";return "#64748b"}
  function iconFor(id){const c=colorFor(id);return window.L.divIcon({className:"jfd-hydrant-marker",html:'<span style="display:flex;align-items:center;justify-content:center;width:25px;height:25px;border:2px solid white;border-radius:50%;background:'+c+';box-shadow:0 1px 5px #0008;color:white;font-size:10px;font-weight:900">'+escH(id).slice(0,4)+'</span>',iconSize:[25,25],iconAnchor:[12,12]})}
  function latestFor(rows,id,dateKey){return rows.filter(x=>assetKey(x.hydrant_id)===assetKey(id)).sort((a,b)=>String(b[dateKey]||"").localeCompare(String(a[dateKey]||"")))[0]||null}
  function mapPopup(a){
    const ins=latestFor(inspections,a.id,"inspected_at"), fl=latestFor(flowTests,a.id,"tested_at");
    const sch=scheduleFor(a.id), coord=Number(a.latitude).toFixed(6)+", "+Number(a.longitude).toFixed(6);
    const scheduleText=sch.length?sch.map(x=>x.task_type==="flow_test"?"Flow test scheduled":"Inspection scheduled").join(" · "):"No individual task assigned in this month’s imported schedule";
    return '<div style="min-width:220px"><b style="font-size:16px">Hydrant '+escH(a.id)+'</b><div style="color:#64748b;font-size:11px">'+coord+(a.map_sheet?" · Map sheet "+escH(a.map_sheet):"")+'</div><div style="margin:7px 0;font-size:12px">'+escH(scheduleText)+'</div><div style="font-size:12px">Last inspection: <b>'+escH(ins?.inspected_at||"No record")+'</b></div><div style="font-size:12px">Last flow test: <b>'+escH(fl?.tested_at||"No record")+'</b>'+(fl?.calculated_flow_gpm!=null?" · "+Number(fl.calculated_flow_gpm).toLocaleString()+" GPM":"")+'</div><div style="display:flex;gap:5px;margin-top:9px"><button onclick="jfdOpenHydrantForm(\''+escH(a.id)+'\',\'inspection\')" style="background:#b45309;color:white;border:0;padding:6px 8px;border-radius:5px;font-weight:bold">Inspect</button><button onclick="jfdOpenHydrantForm(\''+escH(a.id)+'\',\'flow_test\')" style="background:#0369a1;color:white;border:0;padding:6px 8px;border-radius:5px;font-weight:bold">Flow test</button><button onclick="jfdShowHydrantHistory(\''+escH(a.id)+'\')" style="border:1px solid #cbd5e1;padding:6px 8px;border-radius:5px">History</button></div></div>';
  }
  async function loadAssets(){
    const [coordsRes,idsRes]=await Promise.all([fetch("/hydrants.json",{cache:"no-cache"}),fetch("/hydrant-ids.json",{cache:"no-cache"})]);
    if(!coordsRes.ok||!idsRes.ok)throw new Error("Could not load the hydrant coordinate/identifier files.");
    const coords=await coordsRes.json(),ids=await idsRes.json();
    if(!Array.isArray(coords)||!Array.isArray(ids)||!coords.length)throw new Error("Hydrant GIS data is empty or invalid.");
    const count=Math.min(coords.length,ids.length);
    const data=[];
    for(let i=0;i<count;i++){const c=coords[i],id=String(ids[i]||"").trim().toUpperCase();if(!id||/^Fire St /i.test(id))continue;const lat=Number(c.lat),lng=Number(c.lng);if(Number.isFinite(lat)&&Number.isFinite(lng))data.push({id,latitude:lat,longitude:lng,label:id});}
    if(!data.length)throw new Error("No valid hydrant assets were found.");
    const r=await db.from("hydrant_assets").upsert(data,{onConflict:"id"}).select("id");
    if(r.error)throw r.error;
    const q=await db.from("hydrant_assets").select("*").order("id");
    if(q.error)throw q.error;
    assets=q.data||[];
  }
  async function loadRecords(){
    const [s,i,f]=await Promise.all([
      db.from("hydrant_schedule").select("*").eq("shift",shiftValue()).eq("schedule_year",yearValue()).eq("schedule_month",monthValue()),
      db.from("hydrant_inspections").select("*").order("inspected_at",{ascending:false}).limit(2500),
      db.from("hydrant_flow_tests").select("*").order("tested_at",{ascending:false}).limit(2500)
    ]);
    if(s.error)throw s.error;if(i.error)throw i.error;if(f.error)throw f.error;
    let sourceRows=[];try{const sr=await fetch("/hydrant-schedule.json",{cache:"no-cache"});if(sr.ok){const sj=await sr.json();sourceRows=[...(sj.assignments||[]),...(sj.inspection_areas||[])].filter(x=>String(x.shift)===shiftValue()&&Number(x.schedule_year)===yearValue()&&Number(x.schedule_month)===monthValue());}}catch(scheduleError){console.warn("Source hydrant schedule could not load",scheduleError)}const combined=[...sourceRows,...(s.data||[])],scheduleMap=new Map();for(const x of combined){const k=[x.shift,x.schedule_year,x.schedule_month,x.task_type,assetKey(x.hydrant_id||x.source_hydrant_id),x.map_sheet||"",x.weekday_label||""].join("|");scheduleMap.set(k,x)}schedules=[...scheduleMap.values()]; inspections=i.data||[]; flowTests=f.data||[];
  }
  function ensureMap(){
    const el=$("hydrantMapCanvas");if(!el||!window.L)return;
    if(!map){map=L.map(el,{preferCanvas:true}).setView([33.875,-87.27],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);markerLayer=L.layerGroup().addTo(map);}
    markerLayer.clearLayers();
    assets.forEach(a=>{const lat=Number(a.latitude),lng=Number(a.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;L.marker([lat,lng],{icon:iconFor(a.id),title:"Hydrant "+a.id}).bindPopup(mapPopup(a)).on("click",()=>{selected=a;renderSelected()}).addTo(markerLayer)});
    if(markerLayer.getLayers().length)map.fitBounds(markerLayer.getBounds().pad(.04));
    setTimeout(()=>map.invalidateSize(),150);
  }
  function renderSelected(){
    const box=$("hydrantSelected");if(!box)return;
    if(!selected){box.innerHTML='<p class="text-sm text-slate-500">Select a hydrant marker or search by hydrant ID to view details and enter a record.</p>';return}
    const ins=latestFor(inspections,selected.id,"inspected_at"),fl=latestFor(flowTests,selected.id,"tested_at"),sch=scheduleFor(selected.id);
    box.innerHTML='<div class="flex items-start justify-between gap-2"><div><div class="text-xl font-black">Hydrant '+escH(selected.id)+'</div><div class="text-xs text-slate-500">'+Number(selected.latitude).toFixed(6)+', '+Number(selected.longitude).toFixed(6)+(selected.map_sheet?" · Map sheet "+escH(selected.map_sheet):"")+'</div></div><span class="text-xs rounded-full px-2 py-1 bg-slate-100">'+(sch.length?sch.map(x=>x.task_type==="flow_test"?"Flow test":"Inspection").join(" + "):"Not scheduled individually")+'</span></div><div class="grid grid-cols-2 gap-2 mt-3"><div class="border rounded-lg p-3"><div class="text-xs text-slate-500">Last inspection</div><b>'+escH(ins?.inspected_at||"No record")+'</b><div class="text-xs mt-1">'+escH(ins?.inspector||"")+'</div>'+(ins?.follow_up_status&&ins.follow_up_status!=="Closed"?'<div class="text-xs font-bold text-amber-700 mt-1">'+escH(ins.follow_up_status)+'</div>':"")+'</div><div class="border rounded-lg p-3"><div class="text-xs text-slate-500">Last flow test</div><b>'+escH(fl?.tested_at||"No record")+'</b><div class="text-xs mt-1">'+(fl?.calculated_flow_gpm!=null?Number(fl.calculated_flow_gpm).toLocaleString()+" GPM":"No calculated flow")+'</div><div class="text-xs text-slate-500">'+(fl?.static_pressure!=null?"Static "+escH(fl.static_pressure)+" PSI":"")+'</div></div></div><div class="flex flex-wrap gap-2 mt-3"><button class="bg-amber-700 text-white rounded-lg px-3 py-2 font-bold" onclick="jfdOpenHydrantForm(\''+escH(selected.id)+'\',\'inspection\')">Enter inspection</button><button class="bg-sky-700 text-white rounded-lg px-3 py-2 font-bold" onclick="jfdOpenHydrantForm(\''+escH(selected.id)+'\',\'flow_test\')">Enter flow test</button><button class="border rounded-lg px-3 py-2 font-bold" onclick="jfdShowHydrantHistory(\''+escH(selected.id)+'\')">View history</button></div>';
  }
  function renderScheduleSummary(){
    const wrap=$("hydrantScheduleSummary");if(!wrap)return;
    const tasks=currentSchedule(),inspectionCount=tasks.filter(x=>x.task_type==="inspection").length,flowCount=tasks.filter(x=>x.task_type==="flow_test").length;
    wrap.innerHTML='<div class="grid grid-cols-3 gap-2"><div class="rounded-lg border p-3"><div class="text-xs text-slate-500">Inspection map sheets</div><b class="text-2xl">'+inspectionCount+'</b></div><div class="rounded-lg border p-3"><div class="text-xs text-slate-500">Scheduled flow tests</div><b class="text-2xl">'+flowCount+'</b></div><div class="rounded-lg border p-3"><div class="text-xs text-slate-500">Completed inspections</div><b class="text-2xl">'+new Set(inspections.filter(x=>String(x.inspected_at||"").slice(0,4)===String(yearValue())&&Number(String(x.inspected_at||"").slice(5,7))===monthValue()&&assetKey(x.hydrant_id)).map(x=>assetKey(x.hydrant_id))).size+'</b></div></div>';
    const sheets=[...new Set(tasks.map(x=>x.map_sheet).filter(Boolean))];
    $("hydrantMapSheetNote").textContent=sheets.length?"Inspection map sheet(s): "+sheets.join(", "):"Inspection map-sheet assignment is displayed when schedule data includes map-sheet references.";
    const list=$("hydrantScheduleList");
    list.innerHTML=tasks.length?tasks.map(x=>'<div class="flex justify-between items-center gap-2 border rounded-lg p-2"><div><b>'+escH(x.hydrant_id||x.source_hydrant_id||("Map sheet "+x.map_sheet))+'</b><div class="text-xs text-slate-500">'+(x.task_type==="flow_test"?"Flow test":"Inspection")+(x.weekday_label?" · "+escH(x.weekday_label):"")+'</div></div><span class="text-xs rounded-full px-2 py-1 '+(x.task_type==="flow_test"?"bg-sky-100 text-sky-800":"bg-amber-100 text-amber-800")+'">'+(x.task_type==="flow_test"?"FLOW":"INSPECT")+'</span></div>').join(""):'<p class="text-sm text-slate-500">No individual assignments are loaded for this shift/month/year yet. The shift schedule documents must be reconciled to map-sheet boundaries and individual hydrant IDs before highlighting inspections accurately.</p>';
  }
  async function refresh(){
    if(!allowed())return status("Hydrants access is limited to administrators and officers.",true);
    if(loading)return;loading=true;status("Loading hydrant inventory and history…");
    try{
      if(!window.L){await new Promise((resolve,reject)=>{if(typeof window.jfdLoadLeaflet==="function"){window.jfdLoadLeaflet().then(resolve,reject)}else{const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.onload=resolve;s.onerror=()=>reject(new Error("Map library failed to load."));document.head.appendChild(s)}})}
      await loadAssets();await loadRecords();const testSel=$("hf_testHydrant");if(testSel){const keep=testSel.value;testSel.innerHTML='<option value="">Same as flow hydrant</option>'+assets.map(a=>'<option value="'+escH(a.id)+'">'+escH(a.id)+'</option>').join("");testSel.value=keep;}ensureMap();renderScheduleSummary();renderSelected();renderHydrantRecordList();status("Loaded "+assets.length+" hydrant locations. Records are saved in JFDRMS.");
      initialized=true;
    }catch(e){console.error("Hydrants module",e);status("Unable to load hydrants: "+(e?.message||String(e)),true)}
    finally{loading=false}
  }
  function renderHydrantRecordList(){
    const el=$("hydrantRecentRecords");if(!el)return;
    const all=[...inspections.map(x=>({...x,_type:"inspection",_date:x.inspected_at})),...flowTests.map(x=>({...x,_type:"flow_test",_date:x.tested_at}))].sort((a,b)=>String(b._date||"").localeCompare(String(a._date||""))).slice(0,12);
    el.innerHTML=all.length?all.map(x=>'<button type="button" class="w-full text-left border rounded-lg p-3 hover:bg-slate-50" onclick="jfdShowHydrantHistory(\''+escH(x.hydrant_id)+'\')"><div class="flex justify-between gap-2"><b>'+escH(x.hydrant_id)+'</b><span class="text-xs text-slate-500">'+escH(x._date)+'</span></div><div class="text-sm">'+(x._type==="inspection"?"Inspection":"Flow test")+' · '+escH(x.inspector||x.tester||"")+'</div><div class="text-xs text-slate-500">'+(x._type==="flow_test"&&x.calculated_flow_gpm!=null?Number(x.calculated_flow_gpm).toLocaleString()+" GPM":escH(x.deficiencies||x.notes||""))+'</div></button>').join(""):'<p class="text-sm text-slate-500">No hydrant records have been entered yet.</p>';
  }
  function openForm(id,kind){
    if(!allowed())return alert("Only administrators and officers can enter hydrant records.");
    selected=assets.find(a=>assetKey(a.id)===assetKey(id))||{id};
    mode=kind;$("hydrantRecordType").value=kind;$("hydrantRecordHydrant").value=selected.id;$("hydrantRecordDate").value=todayISO();$("hydrantRecordInspector").value=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||"";
    $("hydrantInspectionFields").classList.toggle("hiddenx",kind!=="inspection");$("hydrantFlowFields").classList.toggle("hiddenx",kind!=="flow_test");
    $("hydrantFormTitle").textContent=kind==="inspection"?"Hydrant Inspection · "+selected.id:"Hydrant Flow Test · "+selected.id;
    $("hydrantRecordForm").classList.remove("hiddenx");
    const old=kind==="inspection"?latestFor(inspections,id,"inspected_at"):latestFor(flowTests,id,"tested_at");
    if(kind==="inspection"&&old){const c=old.checklist||{};for(const key of ["accessible","caps_gaskets","barrel_valve","flushed","drain","lubricated","pressure_test"]){const v=c[key];document.querySelectorAll('input[name="hi_'+key+'"]').forEach(el=>el.checked=el.value===(v===true?"yes":v===false?"no":""));const r=$('hi_'+key+'_remarks');if(r)r.value=c[key+"_remarks"]||"";} $("hydrantInspectionNotes").value=old.notes||"";}
    else if(kind==="flow_test"&&old){$("hf_orifice").value=old.orifice_diameter??"2.5";$("hf_pitot").value=old.pitot_pressure??"";$("hf_static").value=old.static_pressure??"";$("hf_residual").value=old.residual_pressure??"";$("hf_testHydrant").value=old.test_hydrant_id||"";$("hf_notes").value=old.notes||"";calcFlow();}
    else if(kind==="flow_test"){$("hf_orifice").value="2.5";$("hf_pitot").value="";$("hf_static").value="";$("hf_residual").value="";$("hf_testHydrant").value="";$("hf_notes").value="";calcFlow();}
    if(kind==="inspection"&&!old){$("hydrantInspectionNotes").value="";for(const key of ["accessible","caps_gaskets","barrel_valve","flushed","drain","lubricated","pressure_test"]){document.querySelectorAll('input[name="hi_'+key+'"]').forEach(el=>el.checked=false);const r=$('hi_'+key+'_remarks');if(r)r.value="";}}
    $("hydrantRecordForm").scrollIntoView({behavior:"smooth",block:"start"});renderSelected();
  }
  function calcFlow(){
    const d=Number($("hf_orifice")?.value),p=Number($("hf_pitot")?.value),s=Number($("hf_static")?.value),r=Number($("hf_residual")?.value),c=Number($("hf_coeff")?.value||0.9);
    const valid=d>0&&p>0&&c>0,rate=valid?29.84*c*d*d*Math.sqrt(p):null;
    const validProjection=rate!==null&&s>20&&r<s&&r>=0,flow=validProjection?rate*Math.sqrt((s-20)/(s-r)):null;
    $("hf_rateDisplay").textContent=rate!==null?Math.round(rate).toLocaleString()+" GPM":"Enter outlet diameter and pitot pressure";
    $("hf_flowDisplay").textContent=flow!==null?Math.round(flow).toLocaleString()+" GPM":"Enter static/residual pressure (static must exceed residual and 20 PSI)";
    $("hf_rateValue").value=rate!==null?String(Math.round(rate)):"";$("hf_flowValue").value=flow!==null?String(Math.round(flow)):"";
    return {rate:rate===null?null:Math.round(rate),flow:flow===null?null:Math.round(flow),coefficient:c};
  }
  async function saveRecord(ev){
    ev.preventDefault();if(!allowed())return alert("Only administrators and officers can enter hydrant records.");
    const id=$("hydrantRecordHydrant").value,kind=$("hydrantRecordType").value,date=$("hydrantRecordDate").value,person=$("hydrantRecordInspector").value.trim();
    if(!id||!date||!person)return alert("Hydrant, date, and inspector/tester are required.");
    $("hydrantSaveButton").disabled=true;$("hydrantSaveButton").textContent="Saving…";
    try{
      let r;
      if(kind==="inspection"){
        const checklist={};for(const [key,label] of [["accessible","Accessible / visible"],["caps_gaskets","Caps and gaskets"],["barrel_valve","Barrel and valve"],["flushed","Flushed until clear"],["drain","Drain working"],["lubricated","Threads, gaskets and valve lubricated"],["pressure_test","Pressure test conducted"]]){
          const v=document.querySelector('input[name="hi_'+key+'"]:checked')?.value||"";if(v==="")return alert("Complete Yes/No for: "+label);
          checklist[key]=v==="yes";checklist[key+"_remarks"]=$("hi_"+key+"_remarks").value.trim();
        }
        const failed=Object.entries(checklist).filter(([k,v])=>!k.endsWith("_remarks")&&v===false).map(([k])=>k);
        const payload={hydrant_id:id,inspected_at:date,inspector:person,checklist,accessible:checklist.accessible,leaks:checklist.caps_gaskets===false,damage:checklist.barrel_valve===false,operational:checklist.barrel_valve!==false&&checklist.drain!==false,condition:failed.length?"Needs attention":"Satisfactory",deficiencies:failed.map(k=>checklist[k+"_remarks"]).filter(Boolean).join("; "),corrective_action:Object.entries(checklist).filter(([k,v])=>k.endsWith("_remarks")&&v).map(([k,v])=>v).join("; "),follow_up_status:failed.length?"Open":"Closed",notes:$("hydrantInspectionNotes").value.trim(),map_sheet:selected?.map_sheet||null,created_by:typeof me!=="undefined"?(me?.id||null):null};
        r=await db.from("hydrant_inspections").insert(payload);
      }else{
        const calc=calcFlow(),orifice=Number($("hf_orifice").value),pitot=Number($("hf_pitot").value),stat=Number($("hf_static").value),resid=Number($("hf_residual").value);
        if(!(orifice>0&&pitot>0&&stat>resid&&resid>=0))return alert("Enter valid outlet diameter, pitot, static and residual readings. Static must be greater than residual.");
        const payload={hydrant_id:id,flow_hydrant_id:id,test_hydrant_id:$("hf_testHydrant").value||null,tested_at:date,tester:person,orifice_diameter:orifice,discharge_coefficient:calc.coefficient,static_pressure:stat,residual_pressure:resid,pitot_pressure:pitot,rate_gpm:calc.rate,calculated_flow_gpm:calc.flow,measured_flow_gpm:calc.flow,notes:$("hf_notes").value.trim(),created_by:typeof me!=="undefined"?(me?.id||null):null};
        r=await db.from("hydrant_flow_tests").insert(payload);
      }
      if(r.error)throw r.error;
      $("hydrantRecordForm").classList.add("hiddenx");status((kind==="inspection"?"Inspection":"Flow test")+" saved for hydrant "+id+".");
      await refresh();
    }catch(e){status("Could not save record: "+(e?.message||String(e)),true);alert("Could not save hydrant record: "+(e?.message||String(e)))}
    finally{$("hydrantSaveButton").disabled=false;$("hydrantSaveButton").textContent="Save record"}
  }
  function showHistory(id){
    const ins=inspections.filter(x=>assetKey(x.hydrant_id)===assetKey(id)).sort((a,b)=>String(b.inspected_at).localeCompare(String(a.inspected_at)));
    const fl=flowTests.filter(x=>assetKey(x.hydrant_id)===assetKey(id)).sort((a,b)=>String(b.tested_at).localeCompare(String(a.tested_at)));
    const out=$("hydrantHistoryContent");$("hydrantHistoryTitle").textContent="Hydrant "+id+" · History";
    const rows=[...ins.map(x=>({...x,_type:"inspection",_date:x.inspected_at})),...fl.map(x=>({...x,_type:"flow_test",_date:x.tested_at}))].sort((a,b)=>String(b._date).localeCompare(String(a._date)));
    out.innerHTML=rows.length?rows.map(x=>'<article class="border rounded-lg p-3"><div class="flex justify-between gap-2"><b>'+escH(x._type==="inspection"?"Inspection":"Flow test")+'</b><span>'+escH(x._date)+'</span></div><div class="text-sm mt-1">'+escH(x.inspector||x.tester||"")+'</div>'+(x._type==="inspection"?'<div class="text-sm mt-1">Condition: '+escH(x.condition||"—")+' · Follow-up: '+escH(x.follow_up_status||"—")+'</div><div class="text-sm">'+escH(x.deficiencies||"")+'</div><div class="text-xs text-slate-500 mt-1">'+escH(Object.entries(x.checklist||{}).filter(([k])=>!k.endsWith("_remarks")).map(([k,v])=>k.replaceAll("_"," ")+": "+(v?"Yes":"No")).join(" · "))+'</div>':'<div class="text-sm mt-1">Rate: '+escH(x.rate_gpm??"—")+' GPM · Flow at 20 PSI: '+escH(x.calculated_flow_gpm??"—")+' GPM</div><div class="text-sm">Static '+escH(x.static_pressure??"—")+' · Residual '+escH(x.residual_pressure??"—")+' · Pitot '+escH(x.pitot_pressure??"—")+' · Orifice '+escH(x.orifice_diameter??"—")+'"</div><div class="text-xs text-slate-500">Test hydrant: '+escH(x.test_hydrant_id||"Same as flow hydrant")+'</div>')+'<div class="text-sm mt-1">'+escH(x.notes||"")+'</div></article>').join(""):'<p class="text-sm text-slate-500">No history recorded for this hydrant.</p>';
    $("hydrantHistoryModal").classList.remove("hiddenx");
  }
  function searchHydrant(){
    const q=assetKey($("hydrantSearch").value);if(!q)return;
    const a=assets.find(x=>assetKey(x.id)===q)||assets.find(x=>assetKey(x.id).includes(q));
    if(!a){status("No hydrant found for “"+$("hydrantSearch").value+"”.",true);return}
    selected=a;renderSelected();map?.setView([a.latitude,a.longitude],18);const marker=markerLayer?.getLayers().find(m=>m.getLatLng().lat===Number(a.latitude)&&m.getLatLng().lng===Number(a.longitude));marker?.openPopup();
  }
  window.jfdOpenHydrantForm=openForm;window.jfdShowHydrantHistory=showHistory;
  window.jfdRefreshHydrants=refresh;
  window.jfdHydrantSave=saveRecord;
  window.jfdHydrantSearch=searchHydrant;
  window.jfdHydrantCalcFlow=calcFlow;
  window.jfdHydrantCloseHistory=()=> $("hydrantHistoryModal")?.classList.add("hiddenx");
  window.jfdHydrantCloseForm=()=> $("hydrantRecordForm")?.classList.add("hiddenx");
  window.jfdHydrantTabEntered=async function(){if(!allowed())return alert("Hydrants are available to administrators and officers.");if(!initialized||!map||!map.getContainer().isConnected)await refresh();else{await loadRecords();ensureMap();renderScheduleSummary();renderSelected();renderHydrantRecordList();}};
  window.jfdHydrantFiltersChanged=async function(){if(!allowed())return;await loadRecords();ensureMap();renderScheduleSummary();renderSelected();renderHydrantRecordList();};
  document.addEventListener("DOMContentLoaded",()=>{
    const form=$("hydrantRecordInnerForm");form?.addEventListener("submit",saveRecord);
    ["hf_orifice","hf_pitot","hf_static","hf_residual","hf_coeff"].forEach(id=>$(id)?.addEventListener("input",calcFlow));
    ["hydrantShift","hydrantMonth","hydrantYear"].forEach(id=>$(id)?.addEventListener("change",()=>window.jfdHydrantFiltersChanged?.()));
    $("hydrantSearchButton")?.addEventListener("click",searchHydrant);$("hydrantSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchHydrant()}});
  });
})();