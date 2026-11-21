const SUPABASE_URL="https://audgtwcctdoiptuekqvn.supabase.co";
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
const clean=(v,n=4000)=>String(v??"").trim().slice(0,n);
async function db(path,opts={}){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...opts,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",Prefer:"return=representation",...(opts.headers||{})}});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!r.ok)throw new Error(data?.message||data?.hint||data?.details||String(data||"Database request failed"));
 return data;
}
async function authenticate(req){
 const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 if(!token)throw Object.assign(new Error("Sign in required."),{status:401});
 const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:PUBLISHABLE_KEY,Authorization:"Bearer "+token}});
 if(!r.ok)throw Object.assign(new Error("Invalid session."),{status:401});
 const user=await r.json();
 const profiles=await db("users?select=app_role,active&user_id=eq."+encodeURIComponent(user.id));
 const profile=profiles?.[0];
 if(!profile?.active)throw Object.assign(new Error("Active account required."),{status:403});
 return {user,role:profile.app_role};
}
export async function handleShiftCalendarEvents(req,res){
 try{
  if(!SERVICE_KEY)throw new Error("Database service is not configured.");
  const {user,role}=await authenticate(req);
  const body=req.body||{};
  const action=req.method==="GET"?"list":body.event_action;
  if(req.method==="GET"||action==="list"){
   const from=clean(req.query?.from||body.from,10),to=clean(req.query?.to||body.to,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return res.status(400).json({error:"Valid date range required."});
   const events=await db("staffing_calendar_events?select=*&event_date=gte."+encodeURIComponent(from)+"&event_date=lte."+encodeURIComponent(to)+"&order=event_date,start_time");
   return res.status(200).json({events});
  }
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
  if(!["admin","officer"].includes(role))return res.status(403).json({error:"Officer or administrator access required."});
  if(action==="create"||action==="update"){
   const event_date=clean(body.event_date,10),event_title=clean(body.event_title,160),start=clean(body.start_time,5),end=clean(body.end_time,5),details=clean(body.details,4000);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(event_date)||!event_title)return res.status(400).json({error:"Enter an event date and title."});
   if(start&&!/^\d{2}:\d{2}$/.test(start)||end&&!/^\d{2}:\d{2}$/.test(end))return res.status(400).json({error:"Enter valid event times."});
   if(start&&end&&end<=start)return res.status(400).json({error:"End time must be after start time."});
   const values={event_date,event_title,start_time:start||null,end_time:end||null,details,updated_at:new Date().toISOString()};
   if(action==="create"){
    const created=(await db("staffing_calendar_events",{method:"POST",body:JSON.stringify({...values,created_by:user.id})}))[0];
    return res.status(200).json({ok:true,event:created});
   }
   const id=clean(body.event_id,50);
   if(!id)return res.status(400).json({error:"Event ID required."});
   const updated=(await db("staffing_calendar_events?event_id=eq."+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(values)}))[0];
   if(!updated)return res.status(404).json({error:"Scheduled shift event not found."});
   return res.status(200).json({ok:true,event:updated});
  }
  if(action==="delete"){
   const id=clean(body.event_id,50);
   if(!id)return res.status(400).json({error:"Event ID required."});
   await db("staffing_calendar_events?event_id=eq."+encodeURIComponent(id),{method:"DELETE"});
   return res.status(200).json({ok:true});
  }
  return res.status(400).json({error:"Unknown scheduled shift event action."});
 }catch(error){return res.status(error.status||500).json({error:error.message||"Scheduled shift event request failed."});}
}
