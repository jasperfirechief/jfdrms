import fs from "node:fs";
const files=["index.html","js/type-aware.js","js/report-actions.js"];
let failed=false;
for(const file of files){
 const src=fs.readFileSync(file,"utf8");
 if(file==="index.html"){
  const re=/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi;
  for(const [n,m] of [...src.matchAll(re)].entries()){
   const code=m[1].trim(); if(!code) continue;
   try{new Function(code);console.log("OK",file,"script",n+1)}
   catch(e){failed=true;console.error("FAIL",file,"script",n+1,e?.stack||e?.message||e)}
  }
 } else {
  try{new Function(src);console.log("OK",file)}
  catch(e){failed=true;console.error("FAIL",file,e?.stack||e?.message||e)}
 }
}
if(failed)process.exit(1);
