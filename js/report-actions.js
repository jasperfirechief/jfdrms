async function fetchIncidentPdfBlob(cad,reportId){
  if(!cad)throw new Error("This incident has no CAD number.");
  if(typeof ensureSupabaseClient==="function") await ensureSupabaseClient();
  if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");
  const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();
  if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");
  const allReports=Array.isArray(r.data.reports)?r.data.reports:[];
  const reports=allReports;
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
      let reports=[];
      if(profile?.app_role==="clerk"){const safe=await db.rpc("clerk_search_incident_reports");if(safe.error)throw new Error(safe.error.message);const row=(safe.data||[]).find(x=>String(x.cad)===String(cad));reports=Array.isArray(row?.reports)?row.reports:[];}
      else{const q=await db.from("incidents").select("reports").eq("cad",cad).maybeSingle();if(q.error||!q.data)throw new Error(q.error?.message||"Incident not found.");reports=Array.isArray(q.data.reports)?q.data.reports:[];}
      const idx=reports.findIndex(x=>String(x?.report_id||"")===String(reportId));
      if(idx<0)throw new Error("Report not found.");
      return await window.adminSubmitReport(cad,idx);
    }
    if(action==="delete_neris"){if(profile?.app_role!=="admin")throw new Error("Administrator access required.");return await window.adminDeleteNerisIncident(cad,reportId);}
    if(action==="delete")return await window.adminDeleteReportFromButton({dataset:{cad,reportId}});
    throw new Error("Unknown report action: "+action);
  }catch(e){
    console.error("JFD report action failed",e);
    alert(e?.message||String(e));
    return false;
  }
};
window.adminDeleteNerisIncident=async function(cad,reportId){
  try{
    if(profile?.app_role!=="admin")throw new Error("Only RMS administrators can delete incidents from NERIS.");
    if(!cad||!reportId)throw new Error("Report CAD number and report ID are required.");
    if(typeof ensureSupabaseClient==="function")await ensureSupabaseClient();
    if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");
    const saved=await db.from("incidents").select("reports").eq("cad",cad).maybeSingle();
    if(saved.error||!saved.data)throw new Error(saved.error?.message||"Incident not found.");
    const matches=(Array.isArray(saved.data.reports)?saved.data.reports:[]).filter(x=>String(x?.report_id||"")===String(reportId));
    if(matches.length!==1)throw new Error("Saved report not found or report ID is ambiguous.");
    const report=matches[0];
    if(report.status!=="submitted_to_neris")throw new Error("Only a report currently submitted to NERIS can be deleted.");
    const nerisIncidentId=String(report?.neris?.neris_incident_id||"").trim();
    if(!nerisIncidentId)throw new Error("The saved submission does not contain a NERIS incident ID. Do not attempt deletion until the ID is verified.");
    const reason=window.prompt("Enter the reason for deleting this incident from NERIS. This reason will be recorded in the JFDRMS audit trail.","");
    if(reason===null)return {ok:false,cancelled:true};
    if(!String(reason).trim())throw new Error("A deletion reason is required.");
    const confirmed=window.confirm(
      "PERMANENT NERIS DELETION\n\nCAD: "+cad+
      "\nNERIS incident ID: "+nerisIncidentId+
      "\n\nThis deletes the entire incident from NERIS, not just one report. The original JFDRMS report and incident will remain saved.\n\nReason: "+String(reason).trim()+
      "\n\nAre you sure you want to continue?"
    );
    if(!confirmed)return {ok:false,cancelled:true};
    const session=(await db.auth.getSession()).data?.session;
    if(!session)throw new Error("Authentication required.");
    const response=await fetch("/api/neris",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
      body:JSON.stringify({action:"delete",cad:String(cad),report_id:String(reportId),neris_incident_id:nerisIncidentId,reason:String(reason).trim()})
    });
    let result={};try{result=await response.json()}catch{}
    if(!response.ok||result.ok!==true){
      if(result.deleted===true&&result.audit_recorded===false){
        alert("NERIS reports that the incident was deleted, but JFDRMS could not record the audit entry. Do not retry the deletion. Contact the RMS administrator and preserve this message:\n"+(result.error||"Audit recording failed."));
        return result;
      }
      throw new Error(result.error||"NERIS deletion failed.");
    }
    if(typeof renderReports==="function")await renderReports();
    if(typeof renderNerisReviewQueue==="function")await renderNerisReviewQueue();
    if(typeof window.openSavedReport==="function")await window.openSavedReport(cad,reportId);
    alert("The incident was deleted from NERIS. The original JFDRMS incident and report remain saved. The administrator, timestamp, reason, and NERIS response were recorded.");
    return result;
  }catch(e){
    console.error("JFDRMS NERIS deletion failed:",e);
    alert(e?.message||String(e));
    return {ok:false,error:e?.message||String(e)};
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
window.emailIncidentPdf=async function(cad,reportId){try{if(!cad)throw new Error("This incident has no CAD number.");if(typeof ensureSupabaseClient==="function")await ensureSupabaseClient();if(!db)throw new Error("RMS database is not ready. Please wait a moment and try again.");const r=await db.from("incidents").select("*,incident_details(*)").eq("cad",cad).maybeSingle();if(r.error||!r.data)throw new Error(r.error?.message||"Incident not found.");const allReports=Array.isArray(r.data.reports)?r.data.reports:[];const reports=allReports;if(!reports.length)throw new Error("No saved report data is available for this incident yet.");const session=(await db.auth.getSession()).data?.session;if(!session)throw new Error("Authentication required.");const resp=await fetch("/api/report-pdf",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"email",incident:r.data,reports})});let b={};try{b=await resp.json()}catch{}if(!resp.ok||b.ok===false)throw new Error(b.error||"Email failed.");alert("Incident PDF emailed successfully to the department report email address.");return b;}catch(e){alert(e?.message||String(e));return {ok:false,error:e?.message||String(e)}}};


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
