const SUPABASE_URL="https://audgtwcctdoiptuekqvn.supabase.co";
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
async function db(path,opts={}) {
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...opts,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",Prefer:"return=representation",...(opts.headers||{})}});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!r.ok)throw new Error(data?.message||data?.hint||data?.details||String(data||"Database request failed"));
 return data;
}
const clean=(v,n=300)=>String(v??"").trim().slice(0,n);
function shiftForDate(date){const d=new Date(date+"T12:00:00Z"),a=new Date("2027-01-01T12:00:00Z"),n=Math.round((d-a)/86400000);return ["C","A","B"][((n%3)+3)%3]}
async function authenticate(req){
 const token=String(req.headers.authorization||"").replace(/^Bearer\\s+/i,"");
 if(!token)throw Object.assign(new Error("Sign in required."),{status:401});
 const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:PUBLISHABLE_KEY,Authorization:"Bearer "+token}});
 if(!r.ok)throw Object.assign(new Error("Invalid session."),{status:401});
 const user=await r.json(),profiles=await db("users?select=app_role,active&user_id=eq."+encodeURIComponent(user.id)),profile=profiles?.[0];
 if(!profile?.active)throw Object.assign(new Error("Active account required."),{status:403});
 return {user,admin:profile.app_role==="admin"};
}
async function sendEventNotice(to,subject,text){
 const key=process.env.BREVO_API_KEY,from=process.env.BREVO_FROM_EMAIL;
 if(!key||!from)throw new Error("Brevo email is not configured.");
 const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:[{email:to}],subject,textContent:text})});
 if(!r.ok)throw new Error("Email delivery failed: "+(await r.text()).slice(0,300));
}
async function eventCount(id){return (await db("staffing_special_event_signups?select=signup_id&event_id=eq."+encodeURIComponent(id))).length}
async function syncFullNotification(event){
 const count=await eventCount(event.event_id),full=count>=Number(event.personnel_needed);
 if(full&&!event.full_notified_at){
  await sendEventNotice(event.created_by_email,"Jasper Fire Department: Event Fully Staffed — "+event.event_name,"Your special staffing event is fully staffed.\n\nEvent: "+event.event_name+"\nDate: "+event.event_date+"\nLocation: "+event.location+"\nPersonnel assigned: "+count+" of "+event.personnel_needed+"\n\nView the event in the JFDRMS Staffing Calendar.");
  await db("staffing_special_events?event_id=eq."+encodeURIComponent(event.event_id),{method:"PATCH",body:JSON.stringify({full_notified_at:new Date().toISOString()})});
 }else if(!full&&event.full_notified_at){
  await db("staffing_special_events?event_id=eq."+encodeURIComponent(event.event_id),{method:"PATCH",body:JSON.stringify({full_notified_at:null})});
 }
}
async function getBundle(from,to,admin){
 const events=await db("staffing_special_events?select=*&cancelled_at=is.null&event_date=gte."+encodeURIComponent(from)+"&event_date=lte."+encodeURIComponent(to)+"&order=event_date,start_time");
 const ids=events.map(e=>e.event_id);
 const signups=ids.length?await db("staffing_special_event_signups?select=signup_id,event_id,personnel_id,signup_type,notes,created_at,personnel(first_name,last_name,role,shift)&event_id=in.("+ids.join(",")+")&order=created_at"):[];
 const personnel=admin?await db("personnel?select=id,first_name,last_name,role,shift&active=eq.true&order=last_name,first_name"):[];
 return {events:events.map(e=>{const rows=signups.filter(s=>s.event_id===e.event_id);return {...e,signups:rows,signup_count:rows.length,is_full:rows.length>=Number(e.personnel_needed)}}),personnel};
}
async function addEventSignup(event,personnelId,type,userId){
 await db("rpc/add_staffing_special_event_signup",{method:"POST",body:JSON.stringify({p_event_id:event.event_id,p_personnel_id:Number(personnelId),p_signup_type:type,p_added_by:userId})});
 await syncFullNotification(event);
}
export async function handleSpecialEvents(req,res){
 try{
  if(!SERVICE_KEY)throw new Error("Database service is not configured.");
  const {user,admin}=await authenticate(req),body=req.body||{},action=req.method==="GET"?"list":body.event_action;
  if(req.method==="GET"||action==="list"){
   const from=clean(req.query?.from||body.from,10),to=clean(req.query?.to||body.to,10);
   if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(from)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(to))return res.status(400).json({error:"Valid date range required."});
   return res.status(200).json(await getBundle(from,to,admin));
  }
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  if(["create","update","cancel","admin_add","remove"].includes(action)&&!admin)return res.status(403).json({error:"Administrator access required."});
  if(action==="create"||action==="update"){
   const event={event_date:clean(body.event_date,10),event_name:clean(body.event_name,160),location:clean(body.location,300),start_time:clean(body.start_time,5),end_time:clean(body.end_time,5),details:clean(body.details,4000),personnel_needed:Number(body.personnel_needed)};
   if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(event.event_date)||!event.event_name||!event.location||!/^\\d{2}:\\d{2}$/.test(event.start_time)||!/^\\d{2}:\\d{2}$/.test(event.end_time)||event.end_time<=event.start_time||!Number.isInteger(event.personnel_needed)||event.personnel_needed<1||event.personnel_needed>100)return res.status(400).json({error:"Enter valid event details, times, and a personnel requirement from 1 to 100."});
   if(action==="create"){
    const created=(await db("staffing_special_events",{method:"POST",body:JSON.stringify({...event,created_by:user.id,created_by_email:user.email||""})}))[0];
    return res.status(200).json({ok:true,event:created});
   }
   const id=clean(body.event_id,50),existing=(await db("staffing_special_events?select=*&event_id=eq."+encodeURIComponent(id)+"&cancelled_at=is.null"))[0];
   if(!existing)return res.status(404).json({error:"Event not found."});
   const updated=(await db("staffing_special_events?event_id=eq."+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({...event,updated_at:new Date().toISOString()})}))[0];
   await syncFullNotification(updated||existing);
   return res.status(200).json({ok:true});
  }
  if(action==="cancel"){
   await db("staffing_special_events?event_id=eq."+encodeURIComponent(clean(body.event_id,50)),{method:"PATCH",body:JSON.stringify({cancelled_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
   return res.status(200).json({ok:true});
  }
  if(action==="signup"||action==="admin_add"){
   const id=clean(body.event_id,50),event=(await db("staffing_special_events?select=*&event_id=eq."+encodeURIComponent(id)+"&cancelled_at=is.null"))[0];
   if(!event)return res.status(404).json({error:"Event not found."});
   let personnelId=Number(body.personnel_id);
   if(action==="signup"){
    const matches=await db("personnel?select=id,shift&auth_user_id=eq."+encodeURIComponent(user.id)+"&active=eq.true");
    const person=matches?.[0];
    if(!person)return res.status(403).json({error:"Your login is not linked to an active personnel record. Contact an administrator."});
    personnelId=Number(person.id);
    if(String(person.shift||"").toUpperCase()===shiftForDate(event.event_date))return res.status(403).json({error:"Personnel assigned to that day's regular shift cannot volunteer for the event."});
    const staff=await db("daily_staffing?select=staffing_id&staffing_date=eq."+encodeURIComponent(event.event_date)),ids=staff.map(x=>x.staffing_id);
    if(ids.length){
     const [apps,changes]=await Promise.all([
      db("daily_app_assignments?select=daily_personnel_assignments(personnel_id)&staffing_id=in.("+ids.join(",")+")"),
      db("daily_staffing_events?select=personnel_id,replacement_personnel_id&staffing_id=in.("+ids.join(",")+")")
     ]);
     const scheduled=new Set();
     for(const row of apps)for(const p of row.daily_personnel_assignments||[])scheduled.add(Number(p.personnel_id));
     for(const row of changes){if(row.personnel_id)scheduled.add(Number(row.personnel_id));if(row.replacement_personnel_id)scheduled.add(Number(row.replacement_personnel_id))}
     if(scheduled.has(personnelId))return res.status(403).json({error:"You are already scheduled or recorded on the regular staffing roster for that date."});
    }
   }
   if(!Number.isInteger(personnelId)||personnelId<=0)return res.status(400).json({error:"Select personnel."});
   const active=(await db("personnel?select=id,active&id=eq."+encodeURIComponent(personnelId)))[0];
   if(!active?.active)return res.status(400).json({error:"Select an active personnel record."});
   await addEventSignup(event,personnelId,action==="admin_add"?"admin_added":"volunteer",user.id);
   return res.status(200).json({ok:true});
  }
  if(action==="remove"){
   const id=clean(body.event_id,50),personnelId=Number(body.personnel_id);
   await db("staffing_special_event_signups?event_id=eq."+encodeURIComponent(id)+"&personnel_id=eq."+encodeURIComponent(personnelId),{method:"DELETE"});
   const event=(await db("staffing_special_events?select=*&event_id=eq."+encodeURIComponent(id)))[0];
   if(event)await syncFullNotification(event);
   return res.status(200).json({ok:true});
  }
  return res.status(400).json({error:"Unknown special event action."});
 }catch(error){return res.status(error.status||500).json({error:error.message||"Special event request failed."})}
}
