const SUPABASE_URL="https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY;
async function rows(path){const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{headers:{apikey:SERVICE,Authorization:"Bearer "+SERVICE}});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}if(!r.ok)throw new Error(j?.message||String(j));return j}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 try{
  if(!SERVICE||!process.env.BREVO_API_KEY||!process.env.BREVO_FROM_EMAIL)throw new Error("Email service is not configured.");
  const token=String(req.headers.authorization||"").replace(/^Bearer\\s+/i,"");if(!token)return res.status(401).json({error:"Sign in required."});
  const auth=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+token}});if(!auth.ok)return res.status(401).json({error:"Invalid session."});const user=await auth.json();
  const profile=(await rows("users?select=app_role,active&user_id=eq."+encodeURIComponent(user.id)))[0];if(!profile?.active||!["admin","officer"].includes(profile.app_role))return res.status(403).json({error:"Administrator or officer access required."});
  const {audience,shift,subject,message}=req.body||{};if(!["shift","officers","everyone"].includes(audience)||!String(subject||"").trim()||!String(message||"").trim())return res.status(400).json({error:"Choose recipients and enter a subject and message."});
  let recipients=[];
  if(audience==="shift"){if(!["A","B","C"].includes(shift))return res.status(400).json({error:"Select a valid shift."});recipients=await rows("personnel?select=email&active=eq.true&shift=eq."+shift+"&email=not.is.null");}
  else if(audience==="everyone"){recipients=await rows("personnel?select=email&active=eq.true&email=not.is.null");}
  else {recipients=await rows("users?select=email&active=eq.true&app_role=eq.officer&email=not.is.null");}
  const emails=[...new Set(recipients.map(x=>String(x.email||"").trim().toLowerCase()).filter(x=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(x)))];
  if(!emails.length)return res.status(400).json({error:"No active recipients with valid email addresses were found."});
  const payload={sender:{email:process.env.BREVO_FROM_EMAIL,name:"Jasper Fire Department"},to:[{email:emails[0]}],bcc:emails.slice(1).map(email=>({email})),subject:"Jasper Fire Department: "+String(subject).trim().slice(0,180),textContent:String(message).trim().slice(0,20000)};
  const sent=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":process.env.BREVO_API_KEY,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify(payload)});
  if(!sent.ok)throw new Error("Brevo delivery failed: "+(await sent.text()).slice(0,500));
  return res.status(200).json({ok:true,recipient_count:emails.length});
 }catch(e){return res.status(500).json({error:e.message||"Email failed."})}
}