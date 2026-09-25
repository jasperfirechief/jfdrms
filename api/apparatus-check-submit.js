const URL="https://audgtwcctdoiptuekqvn.supabase.co",KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
async function api(path,auth,opts={}){const r=await fetch(URL+"/rest/v1/"+path,{...opts,headers:{apikey:KEY,Authorization:auth,"Content-Type":"application/json",Prefer:"return=representation",...(opts.headers||{})}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.hint||d?.details||String(d||"Database request failed"));return d}
async function caller(auth){const r=await fetch(URL+"/auth/v1/user",{headers:{apikey:KEY,Authorization:auth}});if(!r.ok)throw new Error("Invalid or expired session");return r.json()}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const auth=req.headers.authorization||"";if(!auth.startsWith("Bearer "))return res.status(401).json({error:"Authentication required"});
 try{
  const u=await caller(auth), p=(await api("users?select=user_id,first_name,last_name,app_role,active&user_id=eq."+u.id,auth))[0];
  if(!p?.active)throw new Error("Active RMS profile required.");
  const b=typeof req.body==="string"?JSON.parse(req.body):req.body, aid=Number(b?.apparatus_id);
  if(!aid||!b?.checklist)throw new Error("Apparatus and checklist are required.");
  const app=(await api("apparatus?select=apparatus_id,unit_number,apparatus_type,active&apparatus_id=eq."+aid,auth))[0];
  if(!app?.active)throw new Error("Apparatus not found or inactive.");
  let ok=p.app_role==="admin";
  if(!ok){
   const person=(await api("personnel?select=id,auth_user_id,role&auth_user_id=eq."+u.id+"&active=eq.true",auth))[0];
   const ds=(await api("daily_staffing?select=staffing_id&staffing_date=eq."+new Date().toISOString().slice(0,10)+"&shift=eq.daily&limit=1",auth))[0];
   if(person&&ds){
    if(person.role==="officer") ok=true;
    else {
      const aa=await api("daily_app_assignments?select=assignment_id,apparatus_id,daily_personnel_assignments(personnel_id,assignment_role)&staffing_id=eq."+ds.staffing_id+"&apparatus_id=eq."+aid,auth);
      ok=(aa||[]).some(x=>(x.daily_personnel_assignments||[]).some(y=>Number(y.personnel_id)===Number(person.id)&&y.assignment_role==="driver"));
    }
   }
  }
  if(!ok)throw new Error("Only the assigned on-duty driver, assigned on-duty officer, or an administrator may complete this apparatus check.");
  const items=await api("apparatus_check_items?select=item_id,category,item_text,sort_order&active=eq.true&order=sort_order,item_id",auth);
  const problems=items.filter(x=>b.checklist[String(x.item_id)]==="Problem").map(x=>({item_id:x.item_id,item_text:x.item_text,notes:b.checklist[x.item_id+"_notes"]||""}));
  const now=new Date(),date=now.toISOString().slice(0,10),time=now.toTimeString().slice(0,5);
  const row={apparatus_id:aid,performed_by:u.id,check_date:date,check_time:time,status:problems.length?"failed":"complete",checklist:b.checklist,notes:String(b.notes||""),problem_count:problems.length,email_status:problems.length?"pending":"not_required"};
  const saved=await api("apparatus_checks",auth,{method:"POST",body:JSON.stringify(row)}),check=saved[0];
  let emailStatus="not_required";
  if(problems.length){
   const key=process.env.SENDGRID_API_KEY,from=process.env.SENDGRID_FROM_EMAIL||"noreply@jaspercity.com";
   if(key){
    const lines=items.map(x=>x.item_text+": "+(b.checklist[String(x.item_id)]||"N/A")+(b.checklist[x.item_id+"_notes"]?" | "+b.checklist[x.item_id+"_notes"]:"")).join("\n");
    const msg="Jasper Fire Department apparatus check\nApparatus: "+app.unit_number+"\nDate: "+date+" "+time+"\nPerformed by: "+p.first_name+" "+p.last_name+"\nProblems: "+problems.length+"\n\n"+lines+"\n\nNotes: "+String(b.notes||"");
    const sg=await fetch("https://api.sendgrid.com/v3/mail/send",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({personalizations:[{to:[{email:"deputyfirechief@jaspercity.com"},{email:"firechief@jaspercity.com"}]}],from:{email:from,name:"Jasper Fire Department"},subject:"APPARATUS PROBLEM - "+app.unit_number+" - "+date,content:[{type:"text/plain",value:msg}]} )});
    if(!sg.ok)throw new Error("Check saved, but problem notification email failed.");
    emailStatus="sent";await api("apparatus_checks?check_id=eq."+check.check_id,auth,{method:"PATCH",body:JSON.stringify({email_status:"sent",emailed_at:new Date().toISOString()})});
   }else emailStatus="not_configured";
  }
  return res.status(200).json({ok:true,check_id:check.check_id,status:row.status,email_status:emailStatus,problem_count:problems.length});
 }catch(e){console.error("Apparatus check error",e);return res.status(400).json({error:e?.message||"Unable to save apparatus check."})}
}