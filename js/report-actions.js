async function fetchIncidentPdfBlob(cad,reportId){
  if(!cad)throw new Error("This incident has no CAD number.");
  if(typeof ensureSupabaseClient==="function") await ensureSupabaseClient();
  if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");
  const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();
  if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");
  const allReports=Array.isArray(r.data.reports)?r.data.reports:[];
  const reports=reportId?allReports.filter(x=>String(x?.report_id||"")===String(reportId)):allReports;
  if(!reports.length)throw new Error("No saved report data is available for this incident yet.");
  const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({incident:r.data,reports})});
  if(!resp.ok){let b={};try{b=await resp.json()}catch{}throw new Error(b.error||"PDF generation failed.");}
  return {blob:await resp.blob(),incident:r.data,reports};
}
window.__reportActionsLoaded=true;
window.generateIncidentPdf=async function(cad,reportId){try{const x=await fetchIncidentPdfBlob(cad,reportId);const url=URL.createObjectURL(x.blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){alert(e?.message||String(e))}};
window.downloadIncidentPdf=async function(cad,reportId){try{const x=await fetchIncidentPdfBlob(cad,reportId);const url=URL.createObjectURL(x.blob),a=document.createElement("a");a.href=url;a.download=((cad||"incident")+" - JFD Incident Report.pdf").replace(/[\\/:*?"<>|]/g,"_");document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){alert(e?.message||String(e))}};
window.emailIncidentPdf=async function(cad,reportId){try{if(!cad)throw new Error("This incident has no CAD number.");if(typeof ensureSupabaseClient==="function")await ensureSupabaseClient();if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");const allReports=Array.isArray(r.data.reports)?r.data.reports:[];const reports=reportId?allReports.filter(x=>String(x?.report_id||"")===String(reportId)):allReports;if(!reports.length)throw new Error("No saved report data is available for this incident yet.");const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"email",incident:r.data,reports})});let b={};try{b=await resp.json()}catch{}if(!resp.ok||b.ok===false)throw new Error(b.error||"Email failed.");alert("Incident PDF emailed successfully to the department report email address.");return b;}catch(e){alert(e?.message||String(e));return {ok:false,error:e?.message||String(e)}}};
