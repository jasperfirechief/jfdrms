export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const key=process.env.BREVO_API_KEY,from=process.env.BREVO_FROM_EMAIL;
  if(!key||!from) return res.status(500).json({error:"Brevo environment variables are missing.",hasKey:!!key,from:from||null});
  const payload={sender:{email:from,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFDRMS Brevo Test Email",textContent:"This is a test email from the Jasper Fire Department Records Management System. Brevo delivery is working."};
  const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify(payload)});
  const body=await r.text();
  if(!r.ok)return res.status(502).json({error:"Brevo delivery failed",details:body});
  return res.status(200).json({ok:true,brevo:JSON.parse(body)});
}