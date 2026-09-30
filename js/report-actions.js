window.generateIncidentPdf=async function(cad){
  if(!cad)return alert("This incident has no CAD number.");
  try{
    const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();
    if(r.error||!r.data)return alert(r.error?.message||"Incident not found.");
    const reports=Array.isArray(r.data.reports)?r.data.reports:[];
    if(!reports.length)return alert("No saved report data is available for this incident yet.");
    const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({incident:r.data,reports})});
    if(!resp.ok){let b={};try{b=await resp.json()}catch{}throw new Error(b.error||"PDF generation failed.");}
    const blob=await resp.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=(cad+" - JFD Incident Report.pdf").replace(/[\\/:*?"<>|]/g,"_");document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){alert(e?.message||String(e))}
};
window.emailIncidentPdf=async function(cad){if(!cad)return alert("This incident has no CAD number.");try{const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");const reports=Array.isArray(r.data.reports)?r.data.reports:[];if(!reports.length)throw new Error("No saved report data is available for this incident.");const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"email",incident:r.data,reports})});let b={};try{b=await resp.json()}catch{}if(!resp.ok||b.ok===false)throw new Error(b.error||"Email failed.");alert("Incident PDF emailed successfully.");}catch(e){alert(e?.message||String(e))}};
