import fs from "node:fs";
const html=fs.readFileSync("index.html","utf8");
const scripts=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]);
let failures=0;
for(let i=0;i<scripts.length;i++){
  const src=scripts[i].trim();
  if(!src) continue;
  try{ new Function(src); }
  catch(e){ failures++; console.error("CLIENT SCRIPT SYNTAX ERROR in inline script #"+(i+1)+": "+e.message); }
}
for(const file of ["js/type-aware.js","js/report-actions.js"]){
  const src=fs.readFileSync(file,"utf8");
  try{ new Function(src); }
  catch(e){ failures++; console.error("CLIENT SCRIPT SYNTAX ERROR in "+file+": "+e.message); }
}
if(failures) process.exit(1);
console.log("Client JavaScript syntax check passed: "+scripts.length+" inline script(s) + 2 external script(s).");
