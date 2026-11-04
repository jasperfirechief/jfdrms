(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let roster = [], dailyRecord = null, eventRecordId = null, selectedTrainingView = "daily", scheduleCache = [];
  const isManager = () => ["admin","officer"].includes(String(profile?.app_role || ""));
  const signedName = () => [profile?.first_name,profile?.last_name].filter(Boolean).join(" ") || me?.email || "Officer";
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
    const sequences={A:aFirstHalf.concat(by.A),B:by.B,C:by.C};
    const next={A:[],B:[],C:[]},counts={A:0,B:0,C:0};
    for(let date="2027-01-01";date<="2027-12-31";date=addDays(date,1)){
      const weekday=new Date(date+"T00:00:00Z").getUTCDay();
      if(weekday===0||weekday===6)continue;
      const shift=shiftForDate(date),sequence=sequences[shift],sourceRow=sequence.length?sequence[counts[shift]++%sequence.length]:null;
      if(sourceRow)next[shift].push({...sourceRow,schedule_date:date,shift,source_year:2026,source_date:sourceRow.source_date});
    }
    return rows.concat(next.A,next.B,next.C);
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
  async function getSchedule(date,shift) {
    const r=await db.from("training_schedule").select("*").eq("schedule_date",date).eq("shift",shift).maybeSingle();
    if(r.error)throw r.error;return r.data||null;
  }
  async function getStaffed(date,shift) {
    const s=await db.from("daily_staffing").select("staffing_id").eq("staffing_date",date).eq("shift",shift).maybeSingle();
    if(s.error)throw s.error;if(!s.data)return {staffingId:null,people:[]};
    const a=await db.from("daily_app_assignments").select("daily_personnel_assignments(personnel_id,personnel(id,first_name,last_name,shift))").eq("staffing_id",s.data.staffing_id);
    if(a.error)throw a.error;
    const map=new Map();(a.data||[]).forEach(x=>(x.daily_personnel_assignments||[]).forEach(y=>{if(y.personnel_id&&y.personnel)map.set(Number(y.personnel_id),y.personnel)}));
    return {staffingId:s.data.staffing_id,people:Array.from(map.values()).sort((a,b)=>(a.last_name||"").localeCompare(b.last_name||""))};
  }
  function dailyHtml() {
    return '<div class="card p-5"><div class="flex flex-wrap justify-between gap-3 mb-4"><div><h2 class="text-xl font-black">Daily Shift Training Report</h2><p class="text-sm text-slate-500">Scheduled company training · Monday–Friday · 0900–1200</p></div><span id="trainingDailyStatus" class="text-xs font-bold text-slate-500">Not submitted</span></div><div class="grid sm:grid-cols-3 gap-3"><label class="text-sm font-semibold">Training date<input id="trainingDailyDate" type="date" class="block w-full border rounded-lg p-2 mt-1" value="'+dateToday()+'"></label><label class="text-sm font-semibold">Shift<input id="trainingDailyShift" class="block w-full border rounded-lg p-2 mt-1 bg-slate-100" readonly></label><label class="text-sm font-semibold">Training hours<input id="trainingDailyHours" class="block w-full border rounded-lg p-2 mt-1 bg-slate-100" readonly value="3.00"></label></div><div class="grid sm:grid-cols-2 gap-3 mt-3"><label class="text-sm font-semibold">Start time<input id="trainingDailyStart" type="time" class="block w-full border rounded-lg p-2 mt-1" value="09:00"></label><label class="text-sm font-semibold">End time<input id="trainingDailyEnd" type="time" class="block w-full border rounded-lg p-2 mt-1" value="12:00"></label></div><div class="grid sm:grid-cols-2 gap-3 mt-3"><label class="text-sm font-semibold">Scheduled lesson<input id="trainingDailyLesson" class="block w-full border rounded-lg p-2 mt-1 bg-slate-50" readonly></label><label class="text-sm font-semibold">Training subject<input id="trainingDailySubject" class="block w-full border rounded-lg p-2 mt-1" placeholder="Scheduled subject"></label></div><div class="mt-3"><label class="text-sm font-semibold">Scheduled training details<textarea id="trainingDailyDetails" rows="3" readonly class="block w-full border rounded-lg p-2 mt-1 bg-slate-50"></textarea></label><p id="trainingScheduleHint" class="text-xs text-slate-500 mt-1"></p></div><div class="mt-4"><div class="flex justify-between gap-2 items-center mb-2"><h3 class="font-bold">Personnel staffed / attendance</h3><span id="trainingStaffingHint" class="text-xs text-slate-500"></span></div><div id="trainingDailyPeople" class="text-sm text-slate-500">Loading staffed personnel…</div></div><label class="block text-sm font-semibold mt-4">Additional notes<textarea id="trainingDailyNotes" rows="4" class="block w-full border rounded-lg p-3 mt-1" placeholder="Describe what was covered, practical exercises, deviations from the lesson, and any other notes."></textarea></label><label class="block text-sm font-semibold mt-3">Officer conducting training<input id="trainingDailyOfficer" class="block w-full border rounded-lg p-2 mt-1 bg-slate-50" readonly value="'+esc(signedName())+'"></label><div class="flex flex-wrap gap-2 mt-5"><button type="button" id="trainingDailySave" class="border rounded-lg px-4 py-2 font-bold">Save Draft</button><button type="button" id="trainingDailySign" class="bg-red-600 text-white rounded-lg px-4 py-2 font-bold">Sign Off · Training Conducted</button></div><p class="text-xs text-slate-500 mt-3">Signing confirms the training was conducted and records the officer, attendees, and individual training hours.</p></div>';
  }
  function eventHtml() {
    return '<div class="card p-5"><div class="mb-4"><h2 class="text-xl font-black">Training Event Report</h2><p class="text-sm text-slate-500">Use this blank form for special, multi-shift, outside-instructor, certification, and other unscheduled training.</p></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"><label class="text-sm font-semibold">Training date<input id="trainingEventDate" type="date" value="'+dateToday()+'" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">Start time<input id="trainingEventStart" type="time" value="09:00" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">End time<input id="trainingEventEnd" type="time" value="12:00" class="block w-full border rounded-lg p-2 mt-1"></label><label class="text-sm font-semibold">Training subject<input id="trainingEventSubject" class="block w-full border rounded-lg p-2 mt-1" placeholder="Subject"></label><label class="text-sm font-semibold">Training category<select id="trainingEventCategory" class="block w-full border rounded-lg p-2 mt-1"><option value="">Select category</option><option>Fire suppression</option><option>Fire prevention / inspections</option><option>EMS / First Aid</option><option>Hazardous materials</option><option>Technical rescue</option><option>Driver / operator</option><option>Safety / PPE</option><option>Communications</option><option>Certification</option><option>Joint training</option><option>Other</option></select></label><label class="text-sm font-semibold">Location<input id="trainingEventLocation" class="block w-full border rounded-lg p-2 mt-1" placeholder="Training location"></label><label class="text-sm font-semibold">Instructor<input id="trainingEventInstructor" class="block w-full border rounded-lg p-2 mt-1" placeholder="Instructor name"></label></div><label class="block text-sm font-semibold mt-3">Lesson / course number<input id="trainingEventLesson" class="block w-full border rounded-lg p-2 mt-1" placeholder="Optional"></label><label class="block text-sm font-semibold mt-3">Training description<textarea id="trainingEventDescription" rows="4" class="block w-full border rounded-lg p-3 mt-1" placeholder="Describe the training objectives, material covered, practical evolutions, and outcomes."></textarea></label><label class="block text-sm font-semibold mt-3">Additional notes<textarea id="trainingEventNotes" rows="3" class="block w-full border rounded-lg p-3 mt-1" placeholder="Additional notes"></textarea></label><div class="mt-4"><h3 class="font-bold mb-2">Personnel attending</h3><input id="trainingEventMemberSearch" class="border rounded-lg p-2 w-full mb-2" placeholder="Search personnel…"><div id="trainingEventPeople">'+personnelChecks("trainingEventPeopleChecks",roster,[])+'</div></div><label class="block text-sm font-semibold mt-3">Officer / instructor submitting report<input id="trainingEventOfficer" class="block w-full border rounded-lg p-2 mt-1 bg-slate-50" readonly value="'+esc(signedName())+'"></label><div class="flex flex-wrap gap-2 mt-5"><button type="button" id="trainingEventSave" class="border rounded-lg px-4 py-2 font-bold">Save Draft</button><button type="button" id="trainingEventSign" class="bg-red-600 text-white rounded-lg px-4 py-2 font-bold">Sign & Complete Event</button></div></div>';
  }
  function renderShell() {
    const section=$("t-training");if(!section)return;
    section.innerHTML='<div class="flex flex-wrap justify-between items-center gap-3 mb-5"><div><h1 class="text-2xl font-black">Department Training</h1><p class="text-sm text-slate-500">Scheduled shift training and additional training events.</p></div><div class="flex gap-2"><button type="button" id="trainingDailyTab" class="bg-slate-950 text-white rounded-lg px-4 py-2 font-bold text-sm">Daily Training</button><button type="button" id="trainingEventTab" class="border rounded-lg px-4 py-2 font-bold text-sm">Training Event</button></div></div><div id="trainingDailyPanel">'+dailyHtml()+'</div><div id="trainingEventPanel" class="hiddenx">'+eventHtml()+'</div>';
    $("trainingDailyTab").onclick=()=>showView("daily");$("trainingEventTab").onclick=()=>showView("event");
    $("trainingDailyDate").onchange=loadDailyForm;
    $("trainingDailyStart").oninput=updateDailyHours;$("trainingDailyEnd").oninput=updateDailyHours;
    $("trainingDailySave").onclick=()=>saveDaily(false);$("trainingDailySign").onclick=()=>saveDaily(true);
    $("trainingEventSave").onclick=()=>saveEvent(false);$("trainingEventSign").onclick=()=>saveEvent(true);
    $("trainingEventMemberSearch").oninput=filterEventPeople;
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
    const selected=checkedIds("trainingEventPeopleChecks");
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
      const [schedule,staffed]=await Promise.all([getSchedule(date,shift),getStaffed(date,shift)]);
      $("trainingDailySubject").value=schedule?.subject||"";
      $("trainingDailyLesson").value=schedule?.lesson||"";
      $("trainingDailyDetails").value=schedule?.details||"";
      $("trainingDailyStart").value=(schedule?.start_time||"09:00").slice(0,5);
      $("trainingDailyEnd").value=(schedule?.end_time||"12:00").slice(0,5);updateDailyHours();
      $("trainingScheduleHint").textContent=schedule?"Scheduled subject and lesson loaded from the department training calendar.":"No scheduled lesson is listed for this date. The officer may enter the subject manually.";
      $("trainingStaffingHint").textContent=staffed.staffingId?"Staffing record loaded":"No daily staffing record found for this date and shift";
      const ids=staffed.people.map(p=>Number(p.id));
      $("trainingDailyPeople").innerHTML=staffed.people.length?personnelChecks("trainingDailyPeopleChecks",staffed.people,ids):'<p class="text-amber-700 bg-amber-50 rounded-lg p-3">No personnel are assigned in the daily staffing record. Update Staffing first, or contact an administrator.</p>';
      const q=await db.from("training_records").select("*,training_attendees(id,personnel_id,hours)").eq("record_type","daily").eq("training_date",date).eq("shift",shift).maybeSingle();
      if(q.error)throw q.error;dailyRecord=q.data||null;
      if(dailyRecord){
        $("trainingDailySubject").value=dailyRecord.subject||$("trainingDailySubject").value;
        $("trainingDailyLesson").value=dailyRecord.lesson||$("trainingDailyLesson").value;
        $("trainingDailyStart").value=(dailyRecord.start_time||"09:00").slice(0,5);
        $("trainingDailyEnd").value=(dailyRecord.end_time||"12:00").slice(0,5);updateDailyHours();
        $("trainingDailyNotes").value=dailyRecord.notes||"";
        const attended=(dailyRecord.training_attendees||[]).map(x=>Number(x.personnel_id));
        $("trainingDailyPeople").innerHTML=personnelChecks("trainingDailyPeopleChecks",staffed.people,attended);
        $("trainingDailyStatus").textContent=dailyRecord.signed_at?"Signed · "+(dailyRecord.signed_by_name||"Officer"): "Draft saved";
      } else {$("trainingDailyNotes").value="";$("trainingDailyStatus").textContent="Not submitted";}
      const locked=!!dailyRecord?.signed_at&&profile?.app_role!=="admin";
      $("trainingDailySave").disabled=!isManager()||locked;$("trainingDailySign").disabled=!isManager()||locked;
    } catch(e){console.error(e);$("trainingDailyPeople").textContent="Unable to load training details: "+(e.message||e);}
  }
  function updateDailyHours(){const h=durationHours($("trainingDailyStart")?.value,$("trainingDailyEnd")?.value);if($("trainingDailyHours"))$("trainingDailyHours").value=h.toFixed(2);}
  function durationHours(start,end) {
    const a=String(start||"").split(":").map(Number),b=String(end||"").split(":").map(Number);
    if(a.length<2||b.length<2)return 0;
    return Math.max(0,((b[0]*60+b[1])-(a[0]*60+a[1]))/60);
  }
  async function saveRecord(payload,attendees,sign) {
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
    const ins=await db.from("training_attendees").insert(attendees.map(id=>({training_record_id:record.id,personnel_id:id,hours})));
    if(ins.error)throw ins.error;
    return record.id;
  }
  async function saveDaily(sign) {
    try {
      if(dailyRecord?.signed_at&&profile?.app_role!=="admin")throw new Error("This report has already been signed and is locked.");
      const date=$("trainingDailyDate").value,shift=shiftForDate(date),schedule=await getSchedule(date,shift),staffed=await getStaffed(date,shift);
      const payload={...(dailyRecord||{}),record_type:"daily",training_date:date,shift,staffing_id:staffed.staffingId,schedule_id:schedule?.id||dailyRecord?.schedule_id||null,subject:$("trainingDailySubject").value.trim(),lesson:$("trainingDailyLesson").value||null,start_time:$("trainingDailyStart").value,end_time:$("trainingDailyEnd").value,description:schedule?.details||null,notes:$("trainingDailyNotes").value||null};
      delete payload.training_attendees;delete payload.id;
      if(dailyRecord?.id)payload.id=dailyRecord.id;
      const id=await saveRecord(payload,checkedIds("trainingDailyPeopleChecks"),sign);
      alert(sign?"Daily training report signed and completed.":"Daily training draft saved.");
      await loadDailyForm();
      if(id)dailyRecord={...(dailyRecord||{}),id,signed_at:sign?new Date().toISOString():null};
    } catch(e){console.error(e);alert("Training report could not be saved: "+(e.message||e));}
  }
  async function saveEvent(sign) {
    try {
      const payload={id:eventRecordId||undefined,record_type:"event",training_date:$("trainingEventDate").value,shift:null,staffing_id:null,schedule_id:null,subject:$("trainingEventSubject").value.trim(),lesson:$("trainingEventLesson").value||null,category:$("trainingEventCategory").value||null,start_time:$("trainingEventStart").value,end_time:$("trainingEventEnd").value,location:$("trainingEventLocation").value||null,instructor:$("trainingEventInstructor").value||null,description:$("trainingEventDescription").value||null,notes:$("trainingEventNotes").value||null};
      const ids=checkedIds("trainingEventPeopleChecks");
      const id=await saveRecord(payload,ids,sign);eventRecordId=id;
      alert(sign?"Training event signed and completed.":"Training event draft saved.");
      if(sign){eventRecordId=null;$("trainingEventSubject").value="";$("trainingEventLesson").value="";$("trainingEventCategory").value="";$("trainingEventLocation").value="";$("trainingEventInstructor").value="";$("trainingEventDescription").value="";$("trainingEventNotes").value="";roster=roster.slice();$("trainingEventPeople").innerHTML=personnelChecks("trainingEventPeopleChecks",roster,[]);}
    } catch(e){console.error(e);alert("Training event could not be saved: "+(e.message||e));}
  }
  function printReport(r) {
    const attendees=(r.training_attendees||[]).map(a=>'<tr><td>'+esc(a.personnel?.first_name+" "+a.personnel?.last_name||"")+'</td><td>'+esc(a.personnel?.shift||"")+'</td><td>'+Number(a.hours||0).toFixed(2)+'</td></tr>').join("");
    const html='<!doctype html><html><head><title>Jasper Fire Department Training Report</title><style>body{font:14px Arial,sans-serif;color:#111;padding:28px}h1{font-size:20px;margin:0}h2{font-size:16px;margin:22px 0 8px}.muted{color:#555}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.field{border:1px solid #ddd;padding:9px}.field b{display:block;font-size:11px;text-transform:uppercase;color:#555}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ccc;padding:7px;text-align:left}pre{white-space:pre-wrap;font:14px Arial}@media print{button{display:none}}</style></head><body><h1>JASPER FIRE DEPARTMENT</h1><p class="muted">TRAINING REPORT</p><div class="grid"><div class="field"><b>Date</b>'+esc(r.training_date)+'</div><div class="field"><b>Shift / Type</b>'+esc(r.shift?r.shift+" Shift":"Training Event")+'</div><div class="field"><b>Subject</b>'+esc(r.subject)+'</div><div class="field"><b>Lesson / Category</b>'+esc([r.lesson,r.category].filter(Boolean).join(" · "))+'</div><div class="field"><b>Time</b>'+esc((r.start_time||"").slice(0,5)+" – "+(r.end_time||"").slice(0,5))+'</div><div class="field"><b>Instructor / Officer</b>'+esc(r.instructor||r.signed_by_name||"")+'</div><div class="field"><b>Location</b>'+esc(r.location||"")+'</div><div class="field"><b>Status</b>'+(r.signed_at?"Completed / signed":"Draft")+'</div></div><h2>Training Description</h2><pre>'+esc(r.description||"")+'</pre><h2>Additional Notes</h2><pre>'+esc(r.notes||"")+'</pre><h2>Personnel Attendance</h2><table><thead><tr><th>Member</th><th>Shift</th><th>Hours</th></tr></thead><tbody>'+attendees+'</tbody></table><p style="margin-top:28px">Officer sign-off: '+esc(r.signed_by_name||"Not signed")+' '+esc(r.signed_at?new Date(r.signed_at).toLocaleString():"")+'</p><button onclick="window.print()">Print / Save as PDF</button></body></html>';
    const w=window.open("","_blank");if(!w){alert("Allow pop-ups to print or save this report as PDF.");return;}w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
  }
  function adminPanelHtml() {
    return '<div id="adminTrainingReportsSection" class="card p-5 mb-4 hiddenx"><div class="mb-4"><h2 class="text-xl font-black">Training Reports</h2><p class="text-sm text-slate-500">Search and retrieve completed and draft department training records.</p></div><div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-2"><input id="adminTrainingSearch" class="border rounded-lg p-2" placeholder="Subject, notes, instructor…"><select id="adminTrainingMember" class="border rounded-lg p-2"><option value="">All personnel</option></select><select id="adminTrainingShift" class="border rounded-lg p-2"><option value="">All shifts / events</option><option>A</option><option>B</option><option>C</option></select><input id="adminTrainingFrom" type="date" class="border rounded-lg p-2"><input id="adminTrainingTo" type="date" class="border rounded-lg p-2"></div><div class="flex gap-2 mt-3"><button id="adminTrainingSearchButton" class="bg-slate-950 text-white rounded-lg px-4 py-2 font-bold">Search Training</button><button id="adminTrainingExport" class="border rounded-lg px-4 py-2 font-bold">Export CSV</button></div><div id="adminTrainingResults" class="space-y-2 mt-4"><p class="text-sm text-slate-500">Choose search criteria and select Search Training.</p></div></div>';
  }
  let adminRows=[];
  async function searchAdminTraining() {
    const el=$("adminTrainingResults");el.innerHTML='<p class="text-sm text-slate-500">Searching…</p>';
    try {
      let q=db.from("training_records").select("*,training_attendees(id,personnel_id,hours,personnel(id,first_name,last_name,shift))").order("training_date",{ascending:false}).limit(1000);
      if($("adminTrainingFrom").value)q=q.gte("training_date",$("adminTrainingFrom").value);
      if($("adminTrainingTo").value)q=q.lte("training_date",$("adminTrainingTo").value);
      if($("adminTrainingShift").value)q=q.eq("shift",$("adminTrainingShift").value);
      const r=await q;if(r.error)throw r.error;
      const term=$("adminTrainingSearch").value.toLowerCase().trim(),member=$("adminTrainingMember").value;
      adminRows=(r.data||[]).filter(x=>{
        const people=x.training_attendees||[];
        const text=[x.subject,x.lesson,x.category,x.description,x.notes,x.instructor,x.signed_by_name].join(" ").toLowerCase();
        return (!term||text.includes(term))&&(!member||people.some(p=>String(p.personnel_id)===member));
      });
      el.innerHTML=adminRows.map((x,i)=>'<div class="border rounded-lg p-3 flex flex-wrap justify-between items-center gap-3"><div><div class="font-bold">'+esc(x.subject)+'</div><div class="text-xs text-slate-500">'+esc(x.training_date)+' · '+esc(x.shift?x.shift+" Shift":"Training Event")+' · '+esc(x.category||x.lesson||"")+' · '+(x.signed_at?'<span class="text-green-700">Completed</span>':'<span class="text-amber-700">Draft</span>')+'</div><div class="text-xs text-slate-500 mt-1">'+(x.training_attendees||[]).map(p=>esc(p.personnel?.first_name+" "+p.personnel?.last_name)).join(", ")+'</div></div><button type="button" data-index="'+i+'" class="trainingPrintBtn border rounded-lg px-3 py-2 text-sm font-bold">Open / Print PDF</button></div>').join("")||'<p class="text-sm text-slate-500">No training records matched those filters.</p>';
      el.querySelectorAll(".trainingPrintBtn").forEach(b=>b.onclick=()=>printReport(adminRows[Number(b.dataset.index)]));
    } catch(e){el.innerHTML='<p class="text-sm text-red-700">'+esc(e.message||e)+'</p>';}
  }
  function exportAdminTraining() {
    const headers=["Date","Shift","Type","Subject","Lesson","Category","Start","End","Member","Hours","Instructor","Signed By","Signed At","Notes"];
    const rows=[headers].concat(adminRows.flatMap(r=>(r.training_attendees||[]).length?(r.training_attendees||[]).map(a=>[r.training_date,r.shift||"",r.record_type,r.subject,r.lesson||"",r.category||"",r.start_time,r.end_time,[a.personnel?.first_name,a.personnel?.last_name].filter(Boolean).join(" "),a.hours,r.instructor||"",r.signed_by_name||"",r.signed_at||"",r.notes||""]):[[r.training_date,r.shift||"",r.record_type,r.subject,r.lesson||"",r.category||"",r.start_time,r.end_time,"","",r.instructor||"",r.signed_by_name||"",r.signed_at||"",r.notes||""]]));
    const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="JFD_Training_Records.csv";a.click();URL.revokeObjectURL(url);
  }
  function installAdminCard() {
    const cards=$("adminSectionCards");if(!cards)return;
    if(!$("adminTrainingCard")){const b=document.createElement("button");b.id="adminTrainingCard";b.type="button";b.className="card p-4 text-left hover:border-red-400";b.innerHTML="<b>Training Reports</b><p class='text-xs text-slate-500 mt-1'>Search training by member, date, shift, subject, and download records.</p>";b.onclick=()=>window.adminOpenSection("adminTrainingReportsSection");cards.appendChild(b);}
    if(!$("adminTrainingReportsSection")){const panel=document.createElement("div");panel.innerHTML=adminPanelHtml();const node=panel.firstElementChild;$("adminReportArchive")?.insertAdjacentElement("afterend",node);}
    if($("adminTrainingSearchButton"))$("adminTrainingSearchButton").onclick=searchAdminTraining;if($("adminTrainingExport"))$("adminTrainingExport").onclick=exportAdminTraining;
    if($("adminTrainingMember"))$("adminTrainingMember").innerHTML='<option value="">All personnel</option>'+roster.map(p=>'<option value="'+p.id+'">'+esc(p.first_name+" "+p.last_name)+'</option>').join("");
  }
  function extendAdminNavigation() {
    const originalOpen=window.adminOpenSection,originalBack=window.adminShowSectionCards;
    if(originalOpen&&!originalOpen.__trainingWrapped){
      const wrapped=function(id){
        if(id!=="adminTrainingReportsSection"){$("adminTrainingReportsSection")?.classList.add("hiddenx");return originalOpen(id);}
        if(profile?.app_role!=="admin")return;
        loadRoster().then(()=>{if($("adminTrainingMember"))$("adminTrainingMember").innerHTML='<option value="">All personnel</option>'+roster.map(p=>'<option value="'+p.id+'">'+esc(p.first_name+" "+p.last_name)+'</option>').join("");}).catch(console.error);
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