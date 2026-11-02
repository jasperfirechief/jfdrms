/* JFDRMS Hydrants module */
(function(){
  const $ = id => document.getElementById(id);
  const escH = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  let map = null, markerLayer = null, assets = [], schedules = [], inspections = [], flowTests = [], mapSheets = [], selected = null, mode = "inspection", initialized = false, loading = false;
  const todayISO = () => (typeof today === "function" ? today() : new Date().toISOString().slice(0,10));
  const allowed = () => typeof profile!=="undefined" && profile && ["admin","officer"].includes(String(profile.app_role||"").toLowerCase());
  function status(msg, bad=false){const n=$("hydrantStatus");if(n){n.textContent=msg;n.className="text-sm mt-2 "+(bad?"text-red-700":"text-slate-600")}}
  function monthValue(){return Number($("hydrantMonth")?.value||new Date().getMonth()+1)}
  function yearValue(){return Number($("hydrantYear")?.value||new Date().getFullYear())}
  function shiftValue(){return $("hydrantShift")?.value||"A"}
  function assetKey(v){return String(v||"").trim().toUpperCase()}
  function sheetList(a){return Array.isArray(a?.map_sheets)?a.map_sheets:(a?.map_sheet?[a.map_sheet]:[])}
  function assetHasSheet(a,sheet){const verified=Array.isArray(a?.verified_map_sheets)?a.verified_map_sheets:sheetList(a);return !!sheet&&verified.some(s=>assetKey(s)===assetKey(sheet))}
  function currentSchedule(){return schedules.filter(x=>String(x.shift)===shiftValue()&&Number(x.schedule_year)===yearValue()&&Number(x.schedule_month)===monthValue())}
  function scheduleFor(id){return currentSchedule().filter(x=>assetKey(x.hydrant_id||x.source_hydrant_id)===assetKey(id)||assetKey(x.test_hydrant_id)===assetKey(id)||assetKey(x.flow_hydrant_id)===assetKey(id))}
  function colorFor(id){const key=assetKey(id),sch=scheduleFor(id),isInspection=sch.some(x=>x.task_type==="inspection"&&assetKey(x.hydrant_id||x.source_hydrant_id)===key),isTest=sch.some(x=>x.task_type==="flow_test"&&assetKey(x.test_hydrant_id)===key),isFlow=sch.some(x=>assetKey(x.flow_hydrant_id)===key);if(isTest&&isFlow)return "#7c3aed";if(isTest)return "#0f766e";if(isFlow)return "#0284c7";if(isInspection)return "#d97706";return "#64748b"}
  function iconFor(id){const c=colorFor(id);return window.L.divIcon({className:"jfd-hydrant-marker",html:'<span style="display:flex;align-items:center;justify-content:center;width:25px;height:25px;border:2px solid white;border-radius:50%;background:'+c+';box-shadow:0 1px 5px #0008;color:white;font-size:10px;font-weight:900">'+escH(id).slice(0,4)+'</span>',iconSize:[25,25],iconAnchor:[12,12]})}
  function latestFor(rows,id,dateKey){return rows.filter(x=>assetKey(x.hydrant_id)===assetKey(id)).sort((a,b)=>String(b[dateKey]||"").localeCompare(String(a[dateKey]||"")))[0]||null}
  function latestFlowFor(id){return flowTests.filter(x=>[x.hydrant_id,x.test_hydrant_id,x.flow_hydrant_id].some(v=>assetKey(v)===assetKey(id))).sort((a,b)=>String(b.tested_at||"").localeCompare(String(a.tested_at||"")))[0]||null}
  function mapPopup(a){
    const ins=latestFor(inspections,a.id,"inspected_at"), fl=latestFlowFor(a.id);
    const sch=scheduleFor(a.id), coord=Number(a.latitude).toFixed(6)+", "+Number(a.longitude).toFixed(6);
    const scheduleText=sch.length?sch.map(x=>x.task_type==="flow_test"?(assetKey(x.test_hydrant_id)===assetKey(a.id)?"TEST hydrant · flow hydrant "+escH(x.flow_hydrant_id||"not assigned"):"FLOW hydrant · test hydrant "+escH(x.test_hydrant_id||"not identified in source schedule")+(x.pair_status==="needs_review"?" · ID REVIEW":"")):"Inspection area · "+escH(x.map_sheet||"scheduled").replace(/^$/,"scheduled")).join(" · "):"No individual task assigned in this month’s imported schedule";
    return '<div style="min-width:220px"><b style="font-size:16px">Hydrant '+escH(a.id)+'</b><div style="color:#64748b;font-size:11px">'+coord+(sheetList(a).length?" · Map sheet(s) "+escH(sheetList(a).join(", ")):"")+'</div><div style="margin:7px 0;font-size:12px">'+escH(scheduleText)+'</div><div style="font-size:12px">Last inspection: <b>'+escH(ins?.inspected_at||"No record")+'</b></div><div style="font-size:12px">Last flow test: <b>'+escH(fl?.tested_at||"No record")+'</b>'+(fl?.calculated_flow_gpm!=null?" · "+Number(fl.calculated_flow_gpm).toLocaleString()+" GPM":"")+'</div><div style="display:flex;gap:5px;margin-top:9px"><button onclick="jfdOpenHydrantForm(\''+escH(a.id)+'\',\'inspection\')" style="background:#b45309;color:white;border:0;padding:6px 8px;border-radius:5px;font-weight:bold">Inspect</button><button onclick="jfdOpenHydrantForm(\''+escH(a.id)+'\',\'flow_test\')" style="background:#0369a1;color:white;border:0;padding:6px 8px;border-radius:5px;font-weight:bold">Flow test</button><button onclick="jfdShowHydrantHistory(\''+escH(a.id)+'\')" style="border:1px solid #cbd5e1;padding:6px 8px;border-radius:5px">History</button></div></div>';
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
    const m=await db.from("hydrant_asset_map_sheets").select("hydrant_id,map_sheet,verified,source").order("map_sheet");
    if(m.error)throw m.error;
    const byHydrant=new Map();for(const row of (m.data||[])){const k=assetKey(row.hydrant_id);if(!byHydrant.has(k))byHydrant.set(k,[]);byHydrant.get(k).push(row);}
    assets=(q.data||[]).map(a=>{const links=byHydrant.get(assetKey(a.id))||[];return {...a,map_sheets:links.map(x=>x.map_sheet).filter(Boolean),verified_map_sheets:links.filter(x=>x.verified).map(x=>x.map_sheet).filter(Boolean),unverified_map_sheets:links.filter(x=>!x.verified).map(x=>x.map_sheet).filter(Boolean)}});
    mapSheets=[...new Set([...mapSheets,...assets.flatMap(a=>sheetList(a))])].sort();
  }
  async function loadRecords(){
    const scheduleQuery=yearValue()>=2027?Promise.resolve({data:[],error:null}):db.from("hydrant_schedule").select("*").eq("shift",shiftValue()).eq("schedule_year",yearValue()).eq("schedule_month",monthValue());
    const [s,i,f]=await Promise.all([
      scheduleQuery,
      db.from("hydrant_inspections").select("*").order("inspected_at",{ascending:false}).limit(2500),
      db.from("hydrant_flow_tests").select("*").order("tested_at",{ascending:false}).limit(2500)
    ]);
    if(s.error)throw s.error;if(i.error)throw i.error;if(f.error)throw f.error;
    let sourceRows=[];
    if(yearValue()>=2027){
      const sr=await fetch("/hydrant-schedule-2027-2030.json",{cache:"no-cache"});
      if(!sr.ok)throw new Error("The approved 2027-2030 hydrant schedule could not be loaded.");
      const sj=await sr.json();
      const baseYear=2027+((yearValue()-2027)%4);
      const assignment=(sj.inspection_assignments||[]).find(x=>x[0]===shiftValue()&&Number(x[1])===monthValue());
      const flowGroup=(sj.flow_test_pairs||[]).find(x=>x[0]===shiftValue()&&Number(x[1])===monthValue());const pairsForBaseYear=flowGroup?.[2]?.[baseYear-2027]||[];
      const mapSheet=shiftValue()+"-SHIFT "+String(monthNames[monthValue()-1]||"").toUpperCase();
      const inspectionsForMonth=(assignment?.[2]||[]).map(id=>({shift:shiftValue(),schedule_year:yearValue(),schedule_month:monthValue(),task_type:"inspection",hydrant_id:id,source_hydrant_id:id,map_sheet:mapSheet}));
      const pairsForMonth=pairsForBaseYear.map((pair,j)=>({shift:shiftValue(),schedule_year:yearValue(),schedule_month:monthValue(),task_type:"flow_test",hydrant_id:pair[0],source_hydrant_id:pair[0],test_hydrant_id:pair[0],flow_hydrant_id:pair[1]||null,pair_order:j+1,pair_status:pair[1]?"scheduled":"needs_review"}));
      sourceRows=[...inspectionsForMonth,...pairsForMonth];
      mapSheets=[...new Set([mapSheet,...assets.flatMap(a=>sheetList(a))])].sort();
    }else{
      try{
        const sr=await fetch("/hydrant-schedule.json",{cache:"no-cache"});
        if(sr.ok){
          const sj=await sr.json();
          mapSheets=[...new Set([...(sj.inspection_areas||[]).map(x=>x.map_sheet),...(sj.flow_test_pairs||[]).map(x=>x.map_sheet),...assets.flatMap(a=>sheetList(a))].filter(Boolean))].sort();
          const pairs=(sj.flow_test_pairs||[]).map(p=>({...p,task_type:"flow_test",hydrant_id:p.test_hydrant_id,source_hydrant_id:p.test_hydrant_id}));
          const unmatched=(sj.unmatched_flow_test_entries||[]).flatMap(e=>[...(e.unmatched_tests||[]).map((id,j)=>({...e,task_type:"flow_test",hydrant_id:id,source_hydrant_id:id,test_hydrant_id:id,flow_hydrant_id:null,pair_order:null,pair_status:"needs_review"})),...(e.unmatched_flows||[]).map(id=>({...e,task_type:"flow_test",hydrant_id:id,source_hydrant_id:id,test_hydrant_id:null,flow_hydrant_id:id,pair_order:null,pair_status:"needs_review"}))]);
          sourceRows=[...pairs,...unmatched,...(sj.inspection_areas||[])].filter(x=>String(x.shift)===shiftValue()&&Number(x.schedule_year)===yearValue()&&Number(x.schedule_month)===monthValue());
        }
      }catch(scheduleError){console.warn("Source hydrant schedule could not load",scheduleError)}
      const combined=[...sourceRows,...(s.data||[])],scheduleMap=new Map();
      for(const x of combined){const k=[x.shift,x.schedule_year,x.schedule_month,x.task_type,assetKey(x.hydrant_id||x.source_hydrant_id),x.test_hydrant_id||"",x.flow_hydrant_id||"",x.pair_order||"",x.map_sheet||""].join("|");scheduleMap.set(k,x)}
      sourceRows=[...scheduleMap.values()];
    }
    schedules=sourceRows;
    inspections=i.data||[];
    flowTests=f.data||[];
  }
  function ensureMap(){
    const el=$("hydrantMapCanvas");if(!el||!window.L)return;
    if(!map){map=L.map(el,{preferCanvas:true}).setView([33.875,-87.27],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);markerLayer=L.layerGroup().addTo(map);}
    markerLayer.clearLayers();
    assets.forEach(a=>{const lat=Number(a.latitude),lng=Number(a.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;L.marker([lat,lng],{icon:iconFor(a.id),title:"Hydrant "+a.id}).bindPopup(mapPopup(a)).on("click",()=>{selected=a;renderSelected()}).addTo(markerLayer)});
    const markerPoints=markerLayer.getLayers().map(m=>m.getLatLng()).filter(p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));if(markerPoints.length)map.fitBounds(L.latLngBounds(markerPoints).pad(.04));
    setTimeout(()=>map.invalidateSize(),150);
  }
  function renderMapSheetEditor(a){return '<p class="text-xs text-slate-500 mt-3">All hydrants are shown on one map. Select a shift and month to highlight that schedule\u2019s inspection hydrants and flow-test pairs.</p>'}
  function renderSelected(){
    const box=$("hydrantSelected");if(!box)return;
    if(!selected){box.innerHTML='<p class="text-sm text-slate-500">Select a hydrant marker or search by hydrant ID to view details and enter a record.</p>';return}
    const ins=latestFor(inspections,selected.id,"inspected_at"),fl=latestFlowFor(selected.id),sch=scheduleFor(selected.id);
    box.innerHTML='<div class="flex items-start justify-between gap-2"><div><div class="text-xl font-black">Hydrant '+escH(selected.id)+'</div><div class="text-xs text-slate-500">'+Number(selected.latitude).toFixed(6)+', '+Number(selected.longitude).toFixed(6)+(sheetList(selected).length?" · Map sheet(s) "+escH(sheetList(selected).join(", ")):"")+'</div></div><span class="text-xs rounded-full px-2 py-1 bg-slate-100">'+(sch.length?sch.map(x=>x.task_type==="flow_test"?"Flow test":"Inspection").join(" + "):"Not scheduled individually")+'</span></div>'+renderMapSheetEditor(selected)+'<div class="grid grid-cols-2 gap-2 mt-3"><div class="border rounded-lg p-3"><div class="text-xs text-slate-500">Last inspection</div><b>'+escH(ins?.inspected_at||"No record")+'</b><div class="text-xs mt-1">'+escH(ins?.inspector||"")+'</div>'+(ins?.follow_up_status&&ins.follow_up_status!=="Closed"?'<div class="text-xs font-bold text-amber-700 mt-1">'+escH(ins.follow_up_status)+'</div>':"")+'</div><div class="border rounded-lg p-3"><div class="text-xs text-slate-500">Last flow test</div><b>'+escH(fl?.tested_at||"No record")+'</b><div class="text-xs mt-1">'+(fl?.calculated_flow_gpm!=null?Number(fl.calculated_flow_gpm).toLocaleString()+" GPM":"No calculated flow")+'</div><div class="text-xs text-slate-500">'+(fl?.static_pressure!=null?"Static "+escH(fl.static_pressure)+" PSI":"")+'</div></div></div><div class="flex flex-wrap gap-2 mt-3"><button class="bg-amber-700 text-white rounded-lg px-3 py-2 font-bold" onclick="jfdOpenHydrantForm(\''+escH(selected.id)+'\',\'inspection\')">Enter inspection</button><button class="bg-sky-700 text-white rounded-lg px-3 py-2 font-bold" onclick="jfdOpenHydrantForm(\''+escH(selected.id)+'\',\'flow_test\')">Enter flow test</button><button class="border rounded-lg px-3 py-2 font-bold" onclick="jfdShowHydrantHistory(\''+escH(selected.id)+'\')">View history</button></div>';
  }
  function renderScheduleSummary(){
    const wrap=$("hydrantScheduleSummary");if(!wrap)return;
    const tasks=currentSchedule(),inspectionTasks=tasks.filter(x=>x.task_type==="inspection"),flowTasks=tasks.filter(x=>x.task_type==="flow_test");
    const period=String(yearValue())+"-"+String(monthValue()).padStart(2,"0");
    const inspectionDoneIds=new Set(inspections.filter(x=>String(x.inspected_at||"").slice(0,7)===period).map(x=>assetKey(x.hydrant_id)));
    const flowMonthRows=flowTests.filter(x=>String(x.tested_at||"").slice(0,7)===period);
    const flowDoneTestIds=new Set(flowMonthRows.map(x=>assetKey(x.test_hydrant_id)).filter(Boolean));
    const inventoryIds=new Set(assets.map(a=>assetKey(a.id)));
    const covered=new Set(inspectionTasks.filter(x=>inspectionDoneIds.has(assetKey(x.hydrant_id))||flowDoneTestIds.has(assetKey(x.hydrant_id))).map(x=>assetKey(x.hydrant_id)));
    const pairDone=p=>flowMonthRows.some(x=>assetKey(x.test_hydrant_id)===assetKey(p.test_hydrant_id)&&(!p.flow_hydrant_id||assetKey(x.flow_hydrant_id||x.hydrant_id)===assetKey(p.flow_hydrant_id)));
    const flowDone=flowTasks.filter(pairDone).length;
    const unmapped=inspectionTasks.filter(x=>!inventoryIds.has(assetKey(x.hydrant_id))).length;
    const baseYear=yearValue()>=2027?2027+((yearValue()-2027)%4):yearValue();
    wrap.innerHTML='<div class="grid grid-cols-3 gap-2"><div class="rounded-lg border p-3"><div class="text-xs text-slate-500">Annual inspections</div><b class="text-2xl">'+covered.size+' / '+inspectionTasks.length+'</b><div class="text-xs text-slate-500 mt-1">Completed this month; T flow tests count for the test hydrant</div></div><div class="rounded-lg border p-3"><div class="text-xs text-slate-500">Scheduled flow tests</div><b class="text-2xl">'+flowDone+' / '+flowTasks.length+'</b><div class="text-xs text-slate-500 mt-1">Each T/F pairing is tracked separately</div></div><div class="rounded-lg border p-3"><div class="text-xs text-slate-500">Four-year flow rotation</div><b class="text-2xl">'+baseYear+'</b><div class="text-xs text-slate-500 mt-1">'+(yearValue()>=2027?"Using "+baseYear+" T/F schedule for "+yearValue():"Legacy schedule")+(unmapped?' · '+unmapped+' assigned ID(s) not in map inventory':'')+'</div></div></div>';
    $("hydrantMapSheetNote").textContent="All "+assets.length+" hydrant inventory markers are displayed. "+inspectionTasks.length+" assigned hydrants are due for annual inspection in this shift/month. Flow tests follow the four-year schedule; T is tested and F is only its paired flow hydrant.";
    const list=$("hydrantScheduleList");
    const inspectionHtml=inspectionTasks.length?inspectionTasks.map(x=>{
      const id=String(x.hydrant_id||"");
      const exists=inventoryIds.has(assetKey(id));
      const done=inspectionDoneIds.has(assetKey(id))||flowDoneTestIds.has(assetKey(id));
      return '<button type="button" class="w-full flex justify-between items-center gap-2 border rounded-lg p-2 text-left hover:bg-slate-50" onclick="jfdOpenHydrantForm(\''+escH(id)+'\',\'inspection\')"><span><b>'+escH(id)+'</b><span class="block text-xs text-slate-500">'+escH(x.map_sheet||"Annual inspection assignment")+'</span></span><span class="text-xs font-bold '+(done?"text-green-700":(exists?"text-amber-700":"text-red-700"))+'">'+(done?"INSPECTED":(exists?"DUE":"NOT IN MAP"))+'</span></button>';
    }).join(""):'<p class="text-sm text-slate-500">No annual inspection assignments for this shift/month.</p>';
    const flowHtml=flowTasks.length?flowTasks.map(x=>{
      const test=String(x.test_hydrant_id||"");
      const flow=String(x.flow_hydrant_id||"");
      const done=pairDone(x);
      const known=inventoryIds.has(assetKey(test))&&(!flow||inventoryIds.has(assetKey(flow)));
      return '<button type="button" class="w-full flex justify-between items-center gap-2 border rounded-lg p-2 text-left hover:bg-slate-50" onclick="jfdOpenHydrantForm(\''+escH(test)+'\',\'flow_test\')"><span><b>T: '+escH(test)+'</b><span class="block text-xs text-slate-500">F: '+(flow?escH(flow):"Not listed in source schedule")+' · Pair '+escH(x.pair_order||"—")+'</span></span><span class="text-xs font-bold '+(done?"text-green-700":(known?"text-sky-700":"text-red-700"))+'">'+(done?"TESTED":(known?"FLOW TEST DUE":"CHECK ID / F"))+'</span></button>';
    }).join(""):'<p class="text-sm text-slate-500">No flow tests are scheduled for this shift/month/year.</p>';
    list.innerHTML='<div class="space-y-2"><h3 class="font-bold text-sm">Annual inspections · '+inspectionTasks.length+' hydrants</h3>'+inspectionHtml+'</div><div class="space-y-2 mt-4"><h3 class="font-bold text-sm">Flow-test pairings · '+flowTasks.length+' scheduled tests</h3>'+flowHtml+'</div>';
  }
  async function refresh(){
    if(!allowed())return status("Hydrants access is limited to administrators and officers.",true);
    if(loading)return;loading=true;status("Loading hydrant inventory and history…");
    try{
      if(!window.L){await new Promise((resolve,reject)=>{if(typeof window.jfdLoadLeaflet==="function"){window.jfdLoadLeaflet().then(resolve,reject)}else{const s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.onload=resolve;s.onerror=()=>reject(new Error("Map library failed to load."));document.head.appendChild(s)}})}
      await loadAssets();await loadRecords();populateHydrantRecordSelectors();ensureMap();renderScheduleSummary();renderSelected();renderHydrantRecordList();status("Loaded "+assets.length+" hydrant locations. Records are saved in JFDRMS.");
      initialized=true;
    }catch(e){console.error("Hydrants module",e);status("Unable to load hydrants: "+(e?.message||String(e)),true)}
    finally{loading=false}
  }
  function renderHydrantRecordList(){
    const el=$("hydrantRecentRecords");if(!el)return;
    const all=[...inspections.map(x=>({...x,_type:"inspection",_date:x.inspected_at})),...flowTests.map(x=>({...x,_type:"flow_test",_date:x.tested_at}))].sort((a,b)=>String(b._date||"").localeCompare(String(a._date||""))).slice(0,12);
    el.innerHTML=all.length?all.map(x=>{
      const historyId=x._type==="flow_test"?(x.test_hydrant_id||x.hydrant_id):x.hydrant_id;
      const heading=x._type==="flow_test"?"T: "+(x.test_hydrant_id||"—")+" · F: "+(x.flow_hydrant_id||x.hydrant_id):x.hydrant_id;
      return '<button type="button" class="w-full text-left border rounded-lg p-3 hover:bg-slate-50" onclick="jfdShowHydrantHistory(\''+escH(historyId)+'\')"><div class="flex justify-between gap-2"><b>'+escH(heading)+'</b><span class="text-xs text-slate-500">'+escH(x._date)+'</span></div><div class="text-sm">'+(x._type==="inspection"?"Annual inspection":"Flow test")+' · '+escH(x.inspector||x.tester||"")+'</div><div class="text-xs text-slate-500">'+(x._type==="flow_test"&&x.calculated_flow_gpm!=null?Number(x.calculated_flow_gpm).toLocaleString()+" GPM":escH(x.deficiencies||x.notes||""))+'</div></button>';
    }).join(""):'<p class="text-sm text-slate-500">No hydrant records have been entered yet.</p>';
  }
  function openForm(id,kind){
    if(!allowed())return alert("Only administrators and officers can enter hydrant records.");
    let scheduledPair=null;
    if(kind==="flow_test")scheduledPair=currentSchedule().find(x=>x.task_type==="flow_test"&&(assetKey(x.test_hydrant_id)===assetKey(id)||assetKey(x.flow_hydrant_id)===assetKey(id)))||null;
    const testId=kind==="flow_test"?(scheduledPair?.test_hydrant_id||""):"";
    const flowId=kind==="flow_test"?(scheduledPair?.flow_hydrant_id||(!scheduledPair?id:"")):id;
    const displayId=kind==="flow_test"?(flowId||id):id;
    selected=assets.find(a=>assetKey(a.id)===assetKey(displayId))||{id:displayId};
    mode=kind;populateHydrantRecordSelectors();
    $("hydrantRecordType").value=kind;
    $("hydrantRecordHydrant").value=kind==="flow_test"?(flowId||""):id;
    $("hydrantRecordHydrant").disabled=kind==="inspection";
    $("hydrantRecordHydrantLabel").textContent=kind==="flow_test"?"Flow hydrant (F)":"Hydrant to inspect";
    $("hydrantRecordDate").value=todayISO();
    $("hydrantRecordInspector").value=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||"";
    $("hydrantRecordMapSheet").value=currentSchedule().find(x=>x.task_type==="inspection"&&x.map_sheet)?.map_sheet||sheetList(selected)[0]||"";
    $("hydrantInspectionFields").classList.toggle("hiddenx",kind!=="inspection");
    $("hydrantFlowFields").classList.toggle("hiddenx",kind!=="flow_test");
    $("hydrantFormTitle").textContent=kind==="inspection"?"Annual Hydrant Inspection · "+id:(scheduledPair?"Flow test · T "+scheduledPair.test_hydrant_id+" / F "+(scheduledPair.flow_hydrant_id||"Select flow hydrant"):"Hydrant Flow Test");
    $("hydrantRecordForm").classList.remove("hiddenx");
    const old=kind==="inspection"?latestFor(inspections,id,"inspected_at"):flowTests.filter(x=>assetKey(x.hydrant_id)===assetKey(flowId)&&(!testId||assetKey(x.test_hydrant_id)===assetKey(testId))).sort((a,b)=>String(b.tested_at||"").localeCompare(String(a.tested_at||"")))[0]||null;
    if(kind==="inspection"&&old){
      const c=old.checklist||{};
      for(const key of ["accessible","caps_gaskets","barrel_valve","flushed","drain","lubricated","pressure_test"]){
        const v=c[key];
        document.querySelectorAll('input[name="hi_'+key+'"]').forEach(el=>el.checked=el.value===(v===true?"yes":v===false?"no":""));
        const r=$("hi_"+key+"_remarks");if(r)r.value=c[key+"_remarks"]||"";
      }
      $("hydrantInspectionNotes").value=old.notes||"";
    }else if(kind==="flow_test"&&old){
      $("hf_orifice").value=old.orifice_diameter??"2.5";
      $("hf_pitot").value=old.pitot_pressure??"";
      $("hf_static").value=old.static_pressure??"";
      $("hf_residual").value=old.residual_pressure??"";
      $("hf_testHydrant").value=old.test_hydrant_id||testId||"";
      $("hydrantRecordHydrant").value=old.flow_hydrant_id||old.hydrant_id||flowId||"";
      $("hf_notes").value=old.notes||"";
      calcFlow();
    }else if(kind==="flow_test"){
      $("hf_orifice").value="2.5";$("hf_pitot").value="";$("hf_static").value="";$("hf_residual").value="";
      $("hf_testHydrant").value=testId;
      $("hf_notes").value="";calcFlow();
    }else{
      $("hydrantInspectionNotes").value="";
      for(const key of ["accessible","caps_gaskets","barrel_valve","flushed","drain","lubricated","pressure_test"]){
        document.querySelectorAll('input[name="hi_'+key+'"]').forEach(el=>el.checked=false);
        const r=$("hi_"+key+"_remarks");if(r)r.value="";
      }
    }
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
    const id=$("hydrantRecordHydrant").value,kind=$("hydrantRecordType").value,date=$("hydrantRecordDate").value,person=$("hydrantRecordInspector").value.trim(),mapSheet=$("hydrantRecordMapSheet").value.trim();const testHydrantId=$("hf_testHydrant")?.value||"";
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
        const payload={hydrant_id:id,inspected_at:date,inspector:person,checklist,accessible:checklist.accessible,leaks:checklist.caps_gaskets===false,damage:checklist.barrel_valve===false,operational:checklist.barrel_valve!==false&&checklist.drain!==false,condition:failed.length?"Needs attention":"Satisfactory",deficiencies:failed.map(k=>checklist[k+"_remarks"]).filter(Boolean).join("; "),corrective_action:Object.entries(checklist).filter(([k,v])=>k.endsWith("_remarks")&&v).map(([k,v])=>v).join("; "),follow_up_status:failed.length?"Open":"Closed",notes:$("hydrantInspectionNotes").value.trim(),map_sheet:mapSheet||selected?.map_sheet||null,created_by:typeof me!=="undefined"?(me?.id||null):null};
        r=await db.from("hydrant_inspections").insert(payload);
      }else{
        const calc=calcFlow(),orifice=Number($("hf_orifice").value),pitot=Number($("hf_pitot").value),stat=Number($("hf_static").value),resid=Number($("hf_residual").value);
        if(!id)return alert("Select the flow hydrant (F) from the schedule or dropdown.");if(!testHydrantId)return alert("Select the test hydrant (T).");if(!(orifice>0&&pitot>0&&stat>resid&&resid>=0))return alert("Enter valid outlet diameter, pitot, static and residual readings. Static must be greater than residual.");
        const payload={hydrant_id:id,flow_hydrant_id:id,test_hydrant_id:testHydrantId,tested_at:date,tester:person,orifice_diameter:orifice,discharge_coefficient:calc.coefficient,static_pressure:stat,residual_pressure:resid,pitot_pressure:pitot,rate_gpm:calc.rate,calculated_flow_gpm:calc.flow,measured_flow_gpm:calc.flow,notes:$("hf_notes").value.trim(),created_by:typeof me!=="undefined"?(me?.id||null):null};
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
    const fl=flowTests.filter(x=>[x.hydrant_id,x.test_hydrant_id,x.flow_hydrant_id].some(v=>assetKey(v)===assetKey(id))).sort((a,b)=>String(b.tested_at).localeCompare(String(a.tested_at)));
    const out=$("hydrantHistoryContent");$("hydrantHistoryTitle").textContent="Hydrant "+id+" · History";
    const rows=[...ins.map(x=>({...x,_type:"inspection",_date:x.inspected_at})),...fl.map(x=>({...x,_type:"flow_test",_date:x.tested_at}))].sort((a,b)=>String(b._date).localeCompare(String(a._date)));
    out.innerHTML=rows.length?rows.map(x=>'<article class="border rounded-lg p-3"><div class="flex justify-between gap-2"><b>'+escH(x._type==="inspection"?"Inspection":"Flow test")+'</b><span>'+escH(x._date)+'</span></div><div class="text-sm mt-1">'+escH(x.inspector||x.tester||"")+'</div>'+(x._type==="inspection"?'<div class="text-sm mt-1">Condition: '+escH(x.condition||"—")+' · Follow-up: '+escH(x.follow_up_status||"—")+'</div><div class="text-sm">'+escH(x.deficiencies||"")+'</div><div class="text-xs text-slate-500 mt-1">'+escH(Object.entries(x.checklist||{}).filter(([k])=>!k.endsWith("_remarks")).map(([k,v])=>k.replaceAll("_"," ")+": "+(v?"Yes":"No")).join(" · "))+'</div>':'<div class="text-sm mt-1">Rate: '+escH(x.rate_gpm??"—")+' GPM · Flow at 20 PSI: '+escH(x.calculated_flow_gpm??"—")+' GPM</div><div class="text-sm">Static '+escH(x.static_pressure??"—")+' · Residual '+escH(x.residual_pressure??"—")+' · Pitot '+escH(x.pitot_pressure??"—")+' · Orifice '+escH(x.orifice_diameter??"—")+'"</div><div class="text-xs text-slate-500">Test hydrant: '+escH(x.test_hydrant_id||(String(x.notes||"").includes("pair not recorded")?"Pair not recorded in source report":"Same as flow hydrant"))+' · Flow hydrant: '+escH(String(x.notes||"").includes("pair not recorded")?"Not recorded in source report":(x.flow_hydrant_id||x.hydrant_id))+'</div>')+'<div class="text-sm mt-1">'+escH(x.notes||"")+'</div></article>').join(""):'<p class="text-sm text-slate-500">No history recorded for this hydrant.</p>';
    $("hydrantHistoryModal").classList.remove("hiddenx");
  }
  async function assignMapSheet(){
    if(!allowed())return alert("Only administrators and officers can assign map sheets.");
    if(!selected?.id)return;
    const hydrantId=selected.id;
    const chosen=[...document.querySelectorAll('input[name="hydrantMapSheetChoice"]:checked')].map(el=>el.value).filter(Boolean);
    try{
      if(chosen.length){
        const up=await db.from("hydrant_asset_map_sheets").upsert(chosen.map(map_sheet=>({hydrant_id:hydrantId,map_sheet,verified:true,source:"manual"})),{onConflict:"hydrant_id,map_sheet"});
        if(up.error)throw up.error;
      }
      const existing=await db.from("hydrant_asset_map_sheets").select("map_sheet").eq("hydrant_id",hydrantId);
      if(existing.error)throw existing.error;
      for(const row of (existing.data||[])){
        if(!chosen.some(s=>assetKey(s)===assetKey(row.map_sheet))){
          const del=await db.from("hydrant_asset_map_sheets").delete().eq("hydrant_id",hydrantId).eq("map_sheet",row.map_sheet);
          if(del.error)throw del.error;
        }
      }
      await loadAssets();
      selected=assets.find(a=>assetKey(a.id)===assetKey(hydrantId))||selected;
      ensureMap();renderSelected();renderScheduleSummary();
      status("Verified map-sheet assignments saved for hydrant "+hydrantId+".");
    }catch(e){status("Could not save map-sheet assignments: "+(e?.message||String(e)),true);alert("Could not save map-sheet assignments: "+(e?.message||String(e)));}
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
  window.jfdHydrantSearch=searchHydrant;window.jfdAssignHydrantMapSheet=assignMapSheet;
  window.jfdHydrantCalcFlow=calcFlow;
  window.jfdHydrantCloseHistory=()=> $("hydrantHistoryModal")?.classList.add("hiddenx");
  window.jfdHydrantCloseForm=()=> $("hydrantRecordForm")?.classList.add("hiddenx");
  window.jfdHydrantTabEntered=async function(){if(!allowed())return alert("Hydrants are available to administrators and officers.");if(!window.jfdHydrantShiftInitialized&&typeof personnel!=="undefined"&&typeof me!=="undefined"){const own=personnel.find(p=>p.auth_user_id===me.id);if(["A","B","C"].includes(String(own?.shift||"").toUpperCase()))$("hydrantShift").value=String(own.shift).toUpperCase();window.jfdHydrantShiftInitialized=true;}if(!initialized||!map||!map.getContainer().isConnected)await refresh();else{await loadRecords();ensureMap();renderScheduleSummary();renderSelected();renderHydrantRecordList();}};
  window.jfdHydrantFiltersChanged=async function(){if(!allowed())return;await loadRecords();ensureMap();renderScheduleSummary();renderSelected();renderHydrantRecordList();};
  document.addEventListener("DOMContentLoaded",()=>{
    const form=$("hydrantRecordInnerForm");form?.addEventListener("submit",saveRecord);
    ["hf_orifice","hf_pitot","hf_static","hf_residual","hf_coeff"].forEach(id=>$(id)?.addEventListener("input",calcFlow));
    ["hydrantShift","hydrantMonth","hydrantYear"].forEach(id=>$(id)?.addEventListener("change",()=>window.jfdHydrantFiltersChanged?.()));
    $("hydrantSearchButton")?.addEventListener("click",searchHydrant);$("hydrantSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchHydrant()}});
  });
})();