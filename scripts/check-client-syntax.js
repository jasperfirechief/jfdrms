import fs from "node:fs";
const files=["index.html","js/type-aware.js","js/report-actions.js"];
const results=[];
for(const file of files){
 const src=fs.readFileSync(file,"utf8");
 if(file==="index.html"){
  const re=/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi;
  for(const [n,m] of [...src.matchAll(re)].entries()){
   const code=m[1].trim(); if(!code) continue;
   try{new Function(code);results.push({file,script:n+1,ok:true});}
   catch(e){results.push({file,script:n+1,ok:false,error:String(e?.message||e),stack:e?.stack});}
  }
 } else {
  try{new Function(src);results.push({file,ok:true});}
  catch(e){results.push({file,ok:false,error:String(e?.message||e),stack:e?.stack});}
 }
}
fs.writeFileSync("syntax-result.json",JSON.stringify({results},null,2));
console.log(JSON.stringify({results},null,2));
