(function(){
  const $=id=>document.getElementById(id);
  const escHtml=s=>typeof esc==="function"?esc(String(s??"")):String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const isAdmin=()=>profile?.app_role==="admin";
  const isOfficer=()=>profile?.app_role==="officer"||isAdmin();
  const personName=id=>{const p=personnel.find(x=>Number(x.id)===Number(id));return p?[p.first_name,p.last_name].filter(Boolean).join(" "):"Unknown member"};
  const dateFmt=d=>d?new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
  const dateCycle=d=>Math.floor((Date.parse(d+"T12:00:00Z")-Date.parse("2026-11-28T12:00:00Z"))/(28*86400000));
  const mins=(full,start,end)=>{if(full)return 1440;if(!start||!end||start===end)return 0;const a=Number(start.slice(0,2))*60+Number(start.slice(3,5)),b=Number(end.slice(0,2))*60+Number(end.slice(3,5));return (b-a+1440)%1440};
  const timeText=(full,s,e)=>full?"Full 24-hour shift":(s+"–"+e);
  let editing=null,requestCache=[];
  function ensureUi(){
    const staff=document.getElementById("t-staffing");
    if(staff&&!$("jfdSwapPanel")){
      const anchor=staff.querySelector(".card.p-4.mb-5")||staff.firstElementChild;
      const panel=document.createElement("div");panel.id="jfdSwapPanel";panel.className="card p-4 mb-5";panel.classList.toggle("hidden",!isOfficer());
      panel.innerHTML='<div class="flex flex-wrap items-start justify-between gap-3 mb-3"><div><h2 class="font-black text-lg">Temporary Shift Swap Requests</h2><p class="text-sm text-slate-500">Officer-submitted requests · Admin approval required before the staffing calendar changes.</p></div><button type="button" id="jfdSwapRefresh" class="border rounded-lg px-3 py-2 text-sm font-semibold">Refresh</button></div><div id="jfdSwapFormWrap" class="border rounded-xl p-3 mb-4"><h3 class="font-bold mb-2" id="jfdSwapFormTitle">Submit a shift swap</h3><div class="grid md:grid-cols-2 gap-3"><div class="rounded-lg bg-slate-50 p-3"><b>Member initiating the swap</b><label class="block text-sm mt-2">Member<select id="jfdSwapMember1" class="block w-full border rounded p-2 mt-1"></select></label><label class="block text-sm mt-2">Regular shift date<input id="jfdSwapRegular1" type="date" class="block w-full border rounded p-2 mt-1"></label><div class="text-xs text-slate-500 mt-1" id="jfdSwapShift1">Shift: —</div><label class="flex items-center gap-2 text-sm mt-3"><input id="jfdSwapFull1" type="checkbox" checked> Full 24-hour shift</label><div id="jfdSwapTimes1" class="grid grid-cols-2 gap-2 mt-2 hidden"><label class="text-xs">Start<input id="jfdSwapStart1" type="time" class="block w-full border rounded p-2 mt-1"></label><label class="text-xs">End<input id="jfdSwapEnd1" type="time" class="block w-full border rounded p-2 mt-1"></label></div><div class="text-sm mt-3">Will work the other member’s regular date: <b id="jfdSwapTarget1">—</b></div></div><div class="rounded-lg bg-slate-50 p-3"><b>Member agreeing to the swap</b><label class="block text-sm mt-2">Member<select id="jfdSwapMember2" class="block w-full border rounded p-2 mt-1"></select></label><label class="block text-sm mt-2">Regular shift date<input id="jfdSwapRegular2" type="date" class="block w-full border rounded p-2 mt-1"></label><div class="text-xs text-slate-500 mt-1" id="jfdSwapShift2">Shift: —</div><label class="flex items-center gap-2 text-sm mt-3"><input id="jfdSwapFull2" type="checkbox" checked> Full 24-hour shift</label><div id="jfdSwapTimes2" class="grid grid-cols-2 gap-2 mt-2 hidden"><label class="text-xs">Start<input id="jfdSwapStart2" type="time" class="block w-full border rounded p-2 mt-1"></label><label class="text-xs">End<input id="jfdSwapEnd2" type="time" class="block w-full border rounded p-2 mt-1"></label></div><div class="text-sm mt-3">Will work the other member’s regular date: <b id="jfdSwapTarget2">—</b></div></div></div><div class="mt-3"><div id="jfdSwapDuration" class="text-sm font-semibold text-slate-600">Equal work time is required.</div><label class="block text-sm font-semibold mt-3">Reason for requesting the swap<textarea id="jfdSwapReason" rows="3" class="block w-full border rounded p-2 mt-1" placeholder="Explain the reason for the requested swap."></textarea></label><p class="text-xs text-slate-500 mt-2">Both dates must fall within the same 28-day work cycle. Each member works the other member’s regular shift date. No leave or other off-time may be substituted for the agreed work.</p></div><div class="flex flex-wrap gap-2 mt-3"><button id="jfdSwapSubmit" type="button" class="bg-red-700 text-white rounded-lg px-4 py-2 font-bold">Submit request</button><button id="jfdSwapCancelEdit" type="button" class="border rounded-lg px-4 py-2 hidden">Cancel edit</button></div></div><div><h3 class="font-bold mb-2">Requests and approvals</h3><div id="jfdSwapList" class="space-y-2 text-sm">Loading requests…</div></div>';
      if(anchor?.parentNode)anchor.parentNode.insertBefore(panel,anchor.nextSibling);else staff.prepend(panel);
    }
    if($("jfdSwapPanel"))$("jfdSwapPanel").classList.toggle("hidden",!isOfficer());
    const home=$("t-home"),cards=$("homeCards");
    if(home&&cards&&!$("jfdAdminPending")){const box=document.createElement("div");box.id="jfdAdminPending";box.className="card p-4 mt-5 hidden";box.innerHTML='<div class="flex items-center justify-between gap-3"><div><h2 class="font-black text-lg">Admin Pending Actions</h2><p class="text-sm text-slate-500">Items requiring administrator attention.</p></div><button id="jfdPendingRefresh" class="border rounded px-3 py-2 text-sm font-semibold">Refresh</button></div><div id="jfdPendingItems" class="mt-3 space-y-2"></div>';cards.parentNode.insertBefore(box,cards.nextSibling);}
    bindUi();
  }
  function bindUi(){
    if($("jfdSwapRefresh"))$("jfdSwapRefresh").onclick=()=>loadRequests();
    if($("jfdPendingRefresh"))$("jfdPendingRefresh").onclick=()=>refreshPending();
    if($("jfdSwapSubmit"))$("jfdSwapSubmit").onclick=()=>submitRequest();
    if($("jfdSwapCancelEdit"))$("jfdSwapCancelEdit").onclick=()=>resetForm();
    ["1","2"].forEach(n=>{
      ["Regular"+n,"Full"+n,"Start"+n,"End"+n].forEach(k=>{const el=$("jfdSwap"+k);if(el)el.addEventListener("change",updateFormSummary)});
      const full=$("jfdSwapFull"+n),wrap=$("jfdSwapTimes"+n);if(full)full.addEventListener("change",()=>{wrap.classList.toggle("hidden",full.checked);updateFormSummary()});
    });
    ["jfdSwapRegular1","jfdSwapRegular2"].forEach(id=>$(id)?.addEventListener("change",updateFormSummary));
  }
  function fillPeople(){
    ["jfdSwapMember1","jfdSwapMember2"].forEach(id=>{const el=$(id);if(!el)return;const old=el.value;el.innerHTML='<option value="">Select member</option>'+personnel.filter(p=>p.active!==false&&["A","B","C"].includes(String(p.shift||"").toUpperCase())).map(p=>'<option value="'+Number(p.id)+'">'+escHtml([p.first_name,p.last_name].filter(Boolean).join(" "))+' · '+escHtml(p.shift||"")+'</option>').join("");if(old)el.value=old});
    if(!editing){const cp=personnel.find(p=>p.auth_user_id===me?.id);if(cp&&$("jfdSwapMember1"))$("jfdSwapMember1").value=String(cp.id);}
  }
  function updateFormSummary(){
    const d1=$("jfdSwapRegular1")?.value||"",d2=$("jfdSwapRegular2")?.value||"";
    const s1=d1&&typeof staffShiftForDate==="function"?staffShiftForDate(d1):"—",s2=d2&&typeof staffShiftForDate==="function"?staffShiftForDate(d2):"—";
    if($("jfdSwapShift1"))$("jfdSwapShift1").textContent="Regular shift: "+s1;
    if($("jfdSwapShift2"))$("jfdSwapShift2").textContent="Regular shift: "+s2;
    if($("jfdSwapTarget1"))$("jfdSwapTarget1").textContent=d2?dateFmt(d2)+" · "+s2:"—";
    if($("jfdSwapTarget2"))$("jfdSwapTarget2").textContent=d1?dateFmt(d1)+" · "+s1:"—";
    const f1=$("jfdSwapFull1")?.checked!==false,f2=$("jfdSwapFull2")?.checked!==false;
    const m1=mins(f1,$("jfdSwapStart1")?.value,$("jfdSwapEnd1")?.value),m2=mins(f2,$("jfdSwapStart2")?.value,$("jfdSwapEnd2")?.value);
    const ok=m1>0&&m1===m2;
    if($("jfdSwapDuration")){$("jfdSwapDuration").textContent=m1&&m2?"Member 1: "+(m1/60)+" hours · Member 2: "+(m2/60)+" hours · "+(ok?"Equal duration":"Durations must match"):"Enter both time ranges or select full shift."; $("jfdSwapDuration").className="text-sm font-semibold "+(ok?"text-emerald-700":"text-red-700");}
  }
  function resetForm(){
    editing=null;$("jfdSwapFormTitle").textContent="Submit a shift swap";$("jfdSwapSubmit").textContent="Submit request";$("jfdSwapCancelEdit").classList.add("hidden");
    ["jfdSwapRegular1","jfdSwapRegular2","jfdSwapStart1","jfdSwapEnd1","jfdSwapStart2","jfdSwapEnd2","jfdSwapReason"].forEach(id=>$(id).value="");
    ["jfdSwapFull1","jfdSwapFull2"].forEach(id=>$(id).checked=true);
    ["1","2"].forEach(n=>$("jfdSwapTimes"+n)?.classList.add("hidden"));
    fillPeople();updateFormSummary();
  }
  function validateForm(){
    const m1=Number($("jfdSwapMember1").value),m2=Number($("jfdSwapMember2").value),d1=$("jfdSwapRegular1").value,d2=$("jfdSwapRegular2").value;
    if(!m1||!m2||m1===m2)return "Select two different department members.";
    if(!d1||!d2)return "Enter both members’ regular shift dates.";
    if(d1===d2)return "Choose two different regular shift dates.";
    const p1=personnel.find(p=>Number(p.id)===m1),p2=personnel.find(p=>Number(p.id)===m2),s1=staffShiftForDate(d1),s2=staffShiftForDate(d2);
    if(String(p1?.shift||"").toUpperCase()!==s1||String(p2?.shift||"").toUpperCase()!==s2)return "Each regular date must match that member’s assigned A/B/C shift.";
    if(dateCycle(d1)!==dateCycle(d2))return "Both regular dates must be within the same 28-day work cycle.";
    const f1=$("jfdSwapFull1").checked,f2=$("jfdSwapFull2").checked;
    const m1mins=mins(f1,$("jfdSwapStart1").value,$("jfdSwapEnd1").value),m2mins=mins(f2,$("jfdSwapStart2").value,$("jfdSwapEnd2").value);
    if(!m1mins||!m2mins)return "Enter valid start and end times for both members.";
    if(m1mins!==m2mins)return "The two members must exchange exactly the same number of hours.";
    if(!$("jfdSwapReason").value.trim())return "Enter the reason for the requested swap.";
    return null;
  }
  function formPayload(){
    const d1=$("jfdSwapRegular1").value,d2=$("jfdSwapRegular2").value,f1=$("jfdSwapFull1").checked,f2=$("jfdSwapFull2").checked;
    return {member_one_id:Number($("jfdSwapMember1").value),member_two_id:Number($("jfdSwapMember2").value),member_one_regular_shift:staffShiftForDate(d1),member_two_regular_shift:staffShiftForDate(d2),member_one_regular_date:d1,member_two_regular_date:d2,member_one_swap_date:d2,member_two_swap_date:d1,member_one_full_shift:f1,member_two_full_shift:f2,member_one_start_time:f1?null:$("jfdSwapStart1").value,member_one_end_time:f1?null:$("jfdSwapEnd1").value,member_two_start_time:f2?null:$("jfdSwapStart2").value,member_two_end_time:f2?null:$("jfdSwapEnd2").value,member_one_minutes:mins(f1,$("jfdSwapStart1").value,$("jfdSwapEnd1").value),member_two_minutes:mins(f2,$("jfdSwapStart2").value,$("jfdSwapEnd2").value),reason:$("jfdSwapReason").value.trim(),submitted_by:me.id,status:"pending",reviewed_by:null,reviewed_at:null,review_notes:null,approved_at:null,member_one_calendar_event_id:null,member_two_calendar_event_id:null};
  }
  async function submitRequest(){
    if(!isOfficer()||!db)return alert("Only Officers and Administrators can submit shift swap requests.");
    if(profile?.app_role==="officer"&&(!crew||!crew.length))return alert("Only an on-duty Shift Officer can submit a swap request.");
    const err=validateForm();if(err)return alert(err);
    const payload=formPayload();let q;const wasEditing=!!editing;
    if(editing){
      const old=requestCache.find(x=>x.swap_id===editing);if(old)payload.submitted_by=old.submitted_by;
      if(old?.status==="approved"&&!isAdmin()&&old?.submitted_by!==me.id)return alert("Only the submitting Officer or an Administrator can edit an approved swap.");
      if(old?.status==="approved"){
        if(!confirm("This approved swap will be removed from the staffing calendar and returned to Pending until an Administrator approves it again. Continue?"))return;
        const delError=await removeCalendarEvents([old.member_one_calendar_event_id,old.member_two_calendar_event_id]);if(delError)return alert("Could not reverse the previous calendar entries: "+delError.message);
      }
      q=await db.from("shift_swap_requests").update({...payload,member_one_calendar_event_id:null,member_two_calendar_event_id:null}).eq("swap_id",editing).select("swap_id").maybeSingle();
    }else q=await db.from("shift_swap_requests").insert(payload).select("swap_id").maybeSingle();
    if(q.error)return alert("Could not save shift swap request: "+q.error.message);
    if(!q.data?.swap_id)return alert("The request was not saved.");
    resetForm();await loadRequests();await refreshPending();if(wasEditing)await refreshCalendarForSwap(payload);
    alert(wasEditing?"Request updated and returned for approval.":"Shift swap request submitted for Administrator approval.");
  }
  function beginEdit(x){
    if(x.status==="approved"&&!isAdmin()&&x.submitted_by!==me.id)return alert("Only the submitting Officer or an Administrator can edit an approved swap.");
    if(!isAdmin()&&x.submitted_by!==me.id)return alert("You can only edit your own request.");
    editing=x.swap_id;
    $("jfdSwapMember1").value=String(x.member_one_id);$("jfdSwapMember2").value=String(x.member_two_id);
    $("jfdSwapRegular1").value=x.member_one_regular_date||"";$("jfdSwapRegular2").value=x.member_two_regular_date||"";
    $("jfdSwapFull1").checked=!!x.member_one_full_shift;$("jfdSwapFull2").checked=!!x.member_two_full_shift;
    $("jfdSwapStart1").value=x.member_one_start_time||"";$("jfdSwapEnd1").value=x.member_one_end_time||"";
    $("jfdSwapStart2").value=x.member_two_start_time||"";$("jfdSwapEnd2").value=x.member_two_end_time||"";
    $("jfdSwapReason").value=x.reason||"";$("jfdSwapFormTitle").textContent="Edit shift swap · "+x.status.toUpperCase();
    $("jfdSwapSubmit").textContent=x.status==="approved"?"Edit and request reapproval":"Save changes";
    $("jfdSwapCancelEdit").classList.remove("hidden");
    ["1","2"].forEach(n=>$("jfdSwapTimes"+n).classList.toggle("hidden",$("jfdSwapFull"+n).checked));
    updateFormSummary();$("jfdSwapPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function loadHistory(id){
    const q=await db.from("shift_swap_history").select("*").eq("swap_id",id).order("changed_at",{ascending:false});
    if(q.error)return '<p class="text-xs text-red-700">History unavailable: '+escHtml(q.error.message)+'</p>';
    return (q.data||[]).map(h=>'<div class="text-xs text-slate-500 border-t pt-1 mt-1">'+escHtml(h.action.replace(/_/g," "))+' · '+new Date(h.changed_at).toLocaleString()+'</div>').join("");
  }
  async function loadRequests(){
    if(!isOfficer()||!db||!$("jfdSwapList"))return;
    $("jfdSwapList").textContent="Loading requests…";
    const q=await db.from("shift_swap_requests").select("*").order("created_at",{ascending:false});
    if(q.error){$("jfdSwapList").textContent="Unable to load swap requests: "+q.error.message;return;}
    requestCache=q.data||[];
    const submitterIds=[...new Set(requestCache.map(x=>x.submitted_by).filter(Boolean))],submitters={};if(submitterIds.length){const uq=await db.from("users").select("user_id,first_name,last_name").in("user_id",submitterIds);(uq.data||[]).forEach(u=>submitters[u.user_id]=[u.first_name,u.last_name].filter(Boolean).join(" "));}
    if(!requestCache.length){$("jfdSwapList").innerHTML='<p class="text-slate-500">No shift swap requests have been submitted.</p>';return;}
    const items=[];
    for(const x of requestCache){
      const canEdit=(["pending","approved"].includes(x.status)&&(isAdmin()||x.submitted_by===me.id));
      const canApprove=isAdmin()&&x.status==="pending";
      const canCancel=["pending","approved"].includes(x.status)&&(isAdmin()||x.submitted_by===me.id);
      const history=await loadHistory(x.swap_id);
      items.push('<article class="border rounded-xl p-3"><div class="flex flex-wrap justify-between gap-2"><div><b>'+escHtml(personName(x.member_one_id))+' ↔ '+escHtml(personName(x.member_two_id))+'</b><div class="text-xs text-slate-500 mt-1">'+dateFmt(x.member_one_regular_date)+' ('+escHtml(x.member_one_regular_shift)+') ↔ '+dateFmt(x.member_two_regular_date)+' ('+escHtml(x.member_two_regular_shift)+')</div><div class="text-xs text-slate-500">Both members exchange the other member’s date · '+(Number(x.member_one_minutes)/60)+' hours each</div><div class="text-xs text-slate-600 mt-1">'+escHtml(personName(x.member_one_id))+' covers '+dateFmt(x.member_two_regular_date)+': '+escHtml(timeText(x.member_one_full_shift,x.member_one_start_time,x.member_one_end_time))+' · '+escHtml(personName(x.member_two_id))+' covers '+dateFmt(x.member_one_regular_date)+': '+escHtml(timeText(x.member_two_full_shift,x.member_two_start_time,x.member_two_end_time))+'</div></div><span class="rounded-full px-3 py-1 text-xs font-bold '+(x.status==="approved"?"bg-emerald-100 text-emerald-800":x.status==="pending"?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700")+'">'+escHtml(x.status.toUpperCase())+'</span></div><p class="text-sm mt-2">'+escHtml(x.reason)+'</p>'+(x.review_notes?'<p class="text-xs mt-1 text-slate-600">Admin note: '+escHtml(x.review_notes)+'</p>':'')+'<p class="text-xs text-slate-500 mt-1">Submitted by: '+escHtml(submitters[x.submitted_by]||"Officer")+' · '+(x.submitted_at?new Date(x.submitted_at).toLocaleString():"")+'</p><div class="flex flex-wrap gap-2 mt-3">'+(canEdit?'<button data-swap-edit="'+x.swap_id+'" class="border rounded px-3 py-1 text-xs font-semibold">Edit</button>':'')+(canApprove?'<button data-swap-approve="'+x.swap_id+'" class="bg-emerald-700 text-white rounded px-3 py-1 text-xs font-bold">Approve & add to calendar</button><button data-swap-deny="'+x.swap_id+'" class="border border-red-300 text-red-700 rounded px-3 py-1 text-xs font-semibold">Deny</button>':'')+(canCancel?'<button data-swap-cancel="'+x.swap_id+'" class="border border-red-300 text-red-700 rounded px-3 py-1 text-xs font-semibold">Cancel</button>':'')+'</div>'+history+'</article>');
    }
    $("jfdSwapList").innerHTML=items.join("");
    $("jfdSwapList").querySelectorAll("[data-swap-edit]").forEach(b=>b.onclick=()=>beginEdit(requestCache.find(x=>x.swap_id===b.dataset.swapEdit)));
    $("jfdSwapList").querySelectorAll("[data-swap-approve]").forEach(b=>b.onclick=()=>approveRequest(b.dataset.swapApprove));
    $("jfdSwapList").querySelectorAll("[data-swap-deny]").forEach(b=>b.onclick=()=>denyRequest(b.dataset.swapDeny));
    $("jfdSwapList").querySelectorAll("[data-swap-cancel]").forEach(b=>b.onclick=()=>cancelRequest(b.dataset.swapCancel));
  }
  async function removeCalendarEvents(ids){
    const clean=(ids||[]).filter(Boolean);if(!clean.length)return null;
    const d=await db.from("daily_staffing_events").delete().in("event_id",clean);
    return d.error||null;
  }
  async function refreshCalendarForSwap(x){
    if(typeof renderStaffCalendar==="function")await renderStaffCalendar();
    const selected=document.getElementById("staffDate")?.value||"";
    if(selected&&[x.member_one_regular_date,x.member_two_regular_date].includes(selected)&&typeof renderStaffingCalendarDetails==="function")await renderStaffingCalendarDetails(selected,staffShiftForDate(selected));
  }
  async function addCalendarEvent(staffDate,shift,personId,replacementId,full,start,end,notes){
    const base=await getOrCreateStaffing(staffDate,shift);if(base.error)throw base.error;
    const ins=await db.from("daily_staffing_events").insert({staffing_id:base.data.staffing_id,event_type:"swap",effective_date:staffDate,leave_start_date:null,leave_end_date:null,personnel_id:personId,replacement_personnel_id:replacementId,station_id:null,apparatus_id:null,leave_type:"swap",is_full_shift:full,start_time:full?null:start,end_time:full?null:end,notes,created_by:me.id}).select("event_id").maybeSingle();
    if(ins.error)throw ins.error;if(!ins.data?.event_id)throw new Error("Calendar entry was not returned after save.");return ins.data.event_id;
  }
  async function approveRequest(id){
    if(!isAdmin())return alert("Administrator approval is required.");
    const x=requestCache.find(r=>r.swap_id===id);if(!x||x.status!=="pending")return;
    if(!confirm("Approve this swap and add both personnel changes to the staffing calendar?"))return;
    let a=null,b=null;
    try{
      a=await addCalendarEvent(x.member_one_regular_date,x.member_one_regular_shift,x.member_one_id,x.member_two_id,x.member_two_full_shift,x.member_two_start_time,x.member_two_end_time,"Approved shift swap · "+id);
      b=await addCalendarEvent(x.member_two_regular_date,x.member_two_regular_shift,x.member_two_id,x.member_one_id,x.member_one_full_shift,x.member_one_start_time,x.member_one_end_time,"Approved shift swap · "+id);
      const u=await db.from("shift_swap_requests").update({status:"approved",reviewed_by:me.id,reviewed_at:new Date().toISOString(),approved_at:new Date().toISOString(),member_one_calendar_event_id:a,member_two_calendar_event_id:b}).eq("swap_id",id).eq("status","pending").select("swap_id").maybeSingle();
      if(u.error||!u.data?.swap_id)throw u.error||new Error("Request status was not updated.");
      await loadRequests();await refreshPending();await refreshCalendarForSwap(x);alert("Swap approved and added to the staffing calendar.");
    }catch(e){
      const cleanupError=await removeCalendarEvents([a,b]);
      alert("Approval was not completed. "+(cleanupError?"Calendar cleanup needs administrator attention: "+cleanupError.message+". ":"No partial calendar change was kept. ")+(e.message||e));
    }
  }
  async function denyRequest(id){
    if(!isAdmin())return;
    const note=prompt("Optional reason for denying this shift swap:")||"";
    const u=await db.from("shift_swap_requests").update({status:"denied",reviewed_by:me.id,reviewed_at:new Date().toISOString(),review_notes:note}).eq("swap_id",id).eq("status","pending");
    if(u.error)return alert(u.error.message);await loadRequests();await refreshPending();
  }
  async function cancelRequest(id){
    const x=requestCache.find(r=>r.swap_id===id);if(!x)return;
    if(x.status==="approved"&&!isAdmin()&&x.submitted_by!==me.id)return alert("Only the submitting Officer or an Administrator can cancel an approved swap.");
    if(x.status==="pending"&&!isAdmin()&&x.submitted_by!==me.id)return alert("You can only cancel your own request.");
    if(!confirm(x.status==="approved"?"Cancel this approved swap and remove its calendar entries?":"Cancel this pending request?"))return;
    const deleteError=await removeCalendarEvents([x.member_one_calendar_event_id,x.member_two_calendar_event_id]);if(deleteError)return alert("Could not reverse the calendar entries: "+deleteError.message);
    const u=await db.from("shift_swap_requests").update({status:"cancelled",cancelled_by:me.id,cancelled_at:new Date().toISOString()}).eq("swap_id",id);
    if(u.error)return alert("Calendar entries were removed, but request status could not be updated: "+u.error.message);
    await loadRequests();await refreshPending();await refreshCalendarForSwap(x);
  }
  async function refreshPending(){
    const box=$("jfdAdminPending");if(!box)return;
    if(!isAdmin()){box.classList.add("hidden");return;}
    box.classList.remove("hidden");const out=$("jfdPendingItems");out.textContent="Checking pending actions…";
    const [sw,inc]=await Promise.all([
      db.from("shift_swap_requests").select("swap_id",{count:"exact",head:true}).eq("status","pending"),
      db.from("incidents").select("cad,reports").order("updated_at",{ascending:false}).limit(100)
    ]);
    const rows=[];
    if(sw.error)rows.push('<div class="text-sm text-red-700">Shift swaps: '+escHtml(sw.error.message)+'</div>');
    else if(sw.count)rows.push('<button type="button" id="jfdPendingSwaps" class="w-full text-left border rounded-lg p-3 hover:bg-slate-50"><b>'+sw.count+' shift swap request'+(sw.count===1?"":"s")+' awaiting approval</b><div class="text-xs text-slate-500">Open Staffing → Temporary Shift Swap Requests</div></button>');
    if(inc.error)rows.push('<div class="text-sm text-red-700">NERIS queue: '+escHtml(inc.error.message)+'</div>');
    else {const ready=(inc.data||[]).flatMap(i=>(Array.isArray(i.reports)?i.reports:[]).filter(rep=>rep.status==="ready_for_neris").map(rep=>i.cad||"Incident"));if(ready.length)rows.push('<button type="button" id="jfdPendingNeris" class="w-full text-left border rounded-lg p-3 hover:bg-slate-50"><b>'+ready.length+' incident report'+(ready.length===1?"":"s")+' awaiting NERIS submission</b><div class="text-xs text-slate-500">'+ready.slice(0,5).map(escHtml).join(" · ")+'</div></button>');}
    out.innerHTML=rows.length?rows.join(""):'<p class="text-sm text-emerald-700">No pending administrator actions.</p>';
    $("jfdPendingSwaps")?.addEventListener("click",()=>{tab("staffing");setTimeout(()=> $("jfdSwapPanel")?.scrollIntoView({behavior:"smooth"}),100)});
    $("jfdPendingNeris")?.addEventListener("click",()=>{tab("admin");setTimeout(()=>{window.renderNerisReviewQueue?.();$("adminNerisQueue")?.scrollIntoView({behavior:"smooth",block:"start"});},150)});
  }
  window.jfdSwapWorkflowInit=function(){ensureUi();if(isOfficer()){fillPeople();loadRequests();}refreshPending();};
  window.jfdSwapWorkflowRender=function(){ensureUi();if(isOfficer()){fillPeople();loadRequests();} };
  window.jfdSwapWorkflowRefresh=refreshPending;
  document.addEventListener("DOMContentLoaded",()=>{ensureUi();});
})();