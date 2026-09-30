export default async function handler(req,res){
  try{
    const base="https://jfdrms.vercel.app/index.html?syntax="+Date.now();
    const html=await (await fetch(base)).text();
    const matches=[...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
    const results=[];
    for(const [n,m] of matches.entries()){
      const code=m[1].trim();if(!code)continue;
      try{new Function(code);results.push({script:n+1,ok:true,lines:code.split("\\n").length});}
      catch(e){results.push({script:n+1,ok:false,error:String(e?.message||e),stack:e?.stack});}
    }
    return res.status(200).json({ok:results.every(x=>x.ok),results});
  }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e),stack:e?.stack});}
}