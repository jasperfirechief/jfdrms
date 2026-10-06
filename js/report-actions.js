async function fetchIncidentPdfBlob(cad,reportId){
  if(!cad)throw new Error("This incident has no CAD number.");
  if(typeof ensureSupabaseClient==="function") await ensureSupabaseClient();
  if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");
  const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();
  if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");
  const allReports=Array.isArray(r.data.reports)?r.data.reports:[];
  const reports=reportId?allReports.filter(x=>String(x?.report_id||"")===String(reportId)):allReports;
  if(!reports.length)throw new Error("No saved report data is available for this incident yet.");
  const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"download",incident:r.data,reports})});
  if(!resp.ok){let b={};try{b=await resp.json()}catch{}throw new Error(b.error||"PDF generation failed.");}
  return {blob:await resp.blob(),incident:r.data,reports};
}
window.__reportActionsLoaded=true;
window.jfdHandleReportAction=async function(button){
  try{
    const b=button?.dataset||{};
    const cad=b.cad||b.adminReviewCad||"";
    const reportId=b.reportId||b.adminReviewId||"";
    const action=String(b.reportAction||b.reportActionName||b.action||"").toLowerCase();
    if(!cad)throw new Error("Report CAD number is missing.");
    if((action!=="download_all"&&action!=="email_all")&&!reportId)throw new Error("Report ID is missing.");
    if(action==="download"||action==="pdf")return await window.downloadIncidentPdf(cad,reportId);
    if(action==="open")return await window.generateIncidentPdf(cad,reportId);
    if(action==="email")return await window.emailIncidentPdf(cad,reportId);
    if(action==="view"||action==="review")return await window.openSavedReport(cad,reportId);
    if(action==="submit"){
      const q=await db.from("incidents").select("reports").eq("cad",cad).maybeSingle();
      if(q.error||!q.data)throw new Error(q.error?.message||"Incident not found.");
      const reports=Array.isArray(q.data.reports)?q.data.reports:[];
      const idx=reports.findIndex(x=>String(x?.report_id||"")===String(reportId));
      if(idx<0)throw new Error("Report not found.");
      return await window.adminSubmitReport(cad,idx);
    }
    if(action==="delete")return await window.adminDeleteReportFromButton({dataset:{cad,reportId}});
    throw new Error("Unknown report action: "+action);
  }catch(e){
    console.error("JFD report action failed",e);
    alert(e?.message||String(e));
    return false;
  }
};
window.generateIncidentPdf=async function(cad,reportId){
  let tab=null;
  try{
    tab=window.open("about:blank","_blank");
    const x=await fetchIncidentPdfBlob(cad,reportId);
    const url=URL.createObjectURL(x.blob);
    if(!x.blob||x.blob.size<100)throw new Error("The PDF service returned an empty or invalid PDF.");
    if(tab&&!tab.closed){tab.location.replace(url);}else{const w=window.open(url,"_blank");if(!w)throw new Error("The browser blocked the PDF window. Please allow pop-ups for JFD RMS.");}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){
    if(tab&&!tab.closed)try{tab.close()}catch{}
    alert(e?.message||String(e));
  }
};
window.downloadIncidentPdf=async function(cad,reportId){try{const x=await fetchIncidentPdfBlob(cad,reportId);const url=URL.createObjectURL(x.blob),a=document.createElement("a");a.href=url;a.download=((cad||"incident")+" - JFD "+(x.reports.length===1?(String(x.reports[0]?.report_type||"").startsWith("pcr_")?"Patient Care Report":"Fire Incident Report"):"Incident Reports")+".pdf").replace(/[\\/:*?"<>|]/g,"_");document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){alert(e?.message||String(e))}};
window.emailIncidentPdf=async function(cad,reportId){try{if(!cad)throw new Error("This incident has no CAD number.");if(typeof ensureSupabaseClient==="function")await ensureSupabaseClient();if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");const allReports=Array.isArray(r.data.reports)?r.data.reports:[];const reports=reportId?allReports.filter(x=>String(x?.report_id||"")===String(reportId)):allReports;if(!reports.length)throw new Error("No saved report data is available for this incident yet.");const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"email",incident:r.data,reports})});let b={};try{b=await resp.json()}catch{}if(!resp.ok||b.ok===false)throw new Error(b.error||"Email failed.");alert("Incident PDF emailed successfully to the department report email address.");return b;}catch(e){alert(e?.message||String(e));return {ok:false,error:e?.message||String(e)}}};


window.downloadAllIncidentPdfs=async function(cad){
  try{
    if(!cad)throw new Error("This incident has no CAD number.");
    if(typeof ensureSupabaseClient==="function")await ensureSupabaseClient();
    const r=await db.from("incidents").select("*").eq("cad",cad).maybeSingle();
    if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");
    const reports=Array.isArray(r.data.reports)?r.data.reports:[];
    if(!reports.length)throw new Error("No saved reports are available for this incident.");
    const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");
    const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"download_all",incident:r.data,reports})});
    if(!resp.ok){let b={};try{b=await resp.json()}catch{}throw new Error(b.error||"Unable to create the incident PDF package.");}
    const blob=await resp.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=((cad||"incident")+" - JFD Incident Reports.zip").replace(/[\\/:*?"<>|]/g,"_");document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){alert(e?.message||String(e))}
};

window.emailAllIncidentPdfs=async function(cad){
  try{
    if(!cad)throw new Error("This incident has no CAD number.");
    if(typeof ensureSupabaseClient==="function")await ensureSupabaseClient();
    const r=await db.from("incidents").select("*").eq("cad",cad).maybeSingle();
    if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");
    const reports=Array.isArray(r.data.reports)?r.data.reports:[];
    if(!reports.length)throw new Error("No saved reports are available for this incident.");
    const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");
    const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"email_all",incident:r.data,reports})});
    let b={};try{b=await resp.json()}catch{}
    if(!resp.ok||b.ok===false)throw new Error(b.error||"Unable to email the incident reports.");
    alert("All incident PDFs were emailed successfully to the department report email address.");
    return b;
  }catch(e){alert(e?.message||String(e));return {ok:false,error:e?.message||String(e)}}
};
