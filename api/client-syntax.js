export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"GET only"});
  try{
    const base="https://raw.githubusercontent.com/jasperfirechief/jfdrms/main/";
    const files=["index.html","js/type-aware.js","js/report-actions.js"];
    const results=[];
    for(const file of files){
      const r=await fetch(base+file,{headers:{"User-Agent":"JasperFireDepartmentRMS-SyntaxCheck"}});
      if(!r.ok)throw new Error(file+" fetch failed: "+r.status);
      const src=await r.text();
      if(file==="index.html"){
        for(const [n,m] of [...src.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].entries()){
          const code=m[1].trim();if(!code)continue;
          try{new Function(code);results.push({file,script:n+1,ok:true});}
          catch(e){results.push({file,script:n+1,ok:false,error:String(e?.message||e)});}
        }
      }else{
        try{new Function(src);results.push({file,ok:true});}
        catch(e){results.push({file,ok:false,error:String(e?.message||e)});}
      }
    }
    const failures=results.filter(x=>!x.ok);
    return res.status(200).json({ok:failures.length===0,failures,checked:results.length});
  }catch(e){return res.status(500).json({ok:false,error:String(e?.message||e)});}
}