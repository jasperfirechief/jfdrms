(function(){
  "use strict";
  const CHIEF_EMAIL = "firechief@jaspercity.com";
  const STORAGE_PREFIX = "jfdChiefAssistantV1:";
  let root, panel, messagesNode, input, sendButton, statusNode;
  let messages = [];
  let busy = false;
  let drag = null;
  let userKey = "";

  function isChief(){
    try {
      return !!(typeof profile !== "undefined" && profile && profile.active === true &&
        String(profile.app_role || "").toLowerCase() === "admin" &&
        String(profile.email || me?.email || "").toLowerCase() === CHIEF_EMAIL);
    } catch (_) { return false; }
  }
  function save(){
    if(!userKey)return;
    try{localStorage.setItem(STORAGE_PREFIX+userKey,JSON.stringify(messages.slice(-40)))}catch(_){}
  }
  function addMessage(role,content){
    messages.push({role,content:String(content||"")});
    messages=messages.slice(-40);
    save();
    renderMessages();
  }
  function renderMessages(){
    if(!messagesNode)return;
    messagesNode.replaceChildren();
    if(!messages.length){
      const welcome=document.createElement("div");
      welcome.className="jfd-ai-welcome";
      welcome.textContent="Good evening, Chief. I'm your JFD Assistant. Ask me a question or have me help draft something. This first preview can chat and help with RMS workflows; live RMS record lookups will be added after we verify the chat.";
      messagesNode.appendChild(welcome);
    }
    messages.forEach(m=>{
      const row=document.createElement("div");
      row.className="jfd-ai-row "+(m.role==="user"?"jfd-ai-user":"jfd-ai-assistant");
      const bubble=document.createElement("div");
      bubble.className="jfd-ai-bubble";
      bubble.textContent=m.content;
      row.appendChild(bubble);
      messagesNode.appendChild(row);
    });
    messagesNode.scrollTop=messagesNode.scrollHeight;
  }
  function setBusy(value){
    busy=value;
    if(sendButton){sendButton.disabled=value;sendButton.textContent=value?"…":"Send";}
    if(input)input.disabled=value;
    if(statusNode)statusNode.textContent=value?"Thinking…":"";
  }
  async function send(){
    if(busy||!input)return;
    const text=input.value.trim();
    if(!text)return;
    if(typeof db==="undefined"||!db?.auth?.getSession){statusNode.textContent="RMS sign-in is not ready. Refresh and try again.";return;}
    let session;
    try{
      const result=await db.auth.getSession();
      session=result.data?.session;
    }catch(_){}
    if(!session?.access_token){statusNode.textContent="Your RMS session expired. Please sign in again.";return;}
    input.value="";
    addMessage("user",text);
    setBusy(true);
    try{
      const response=await fetch("/api/jfd-assistant",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},
        body:JSON.stringify({messages:messages.slice(-16)})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"The assistant could not respond.");
      addMessage("assistant",data.reply||"I wasn't able to generate a response.");
    }catch(error){
      statusNode.textContent=error?.message||"Unable to reach JFD Assistant.";
      input.value=text;
    }finally{setBusy(false);input?.focus();}
  }
  function closePanel(){panel?.classList.add("jfd-ai-hidden");}
  function togglePanel(){
    if(!panel)return;
    panel.classList.toggle("jfd-ai-hidden");
    if(!panel.classList.contains("jfd-ai-hidden"))input?.focus();
  }
  function setPosition(left,top){
    if(!panel)return;
    const maxLeft=Math.max(8,window.innerWidth-panel.offsetWidth-8);
    const maxTop=Math.max(8,window.innerHeight-panel.offsetHeight-8);
    panel.style.left=Math.max(8,Math.min(left,maxLeft))+"px";
    panel.style.top=Math.max(8,Math.min(top,maxTop))+"px";
    panel.style.right="auto";panel.style.bottom="auto";
  }
  function build(){
    if(root)return;
    const style=document.createElement("style");
    style.textContent=`
      #jfdAssistantRoot{position:fixed;z-index:99990;font-family:Inter,system-ui,sans-serif}
      #jfdAssistantLauncher{position:fixed;right:22px;bottom:22px;width:58px;height:58px;border:0;border-radius:50%;background:#b5121b;color:white;box-shadow:0 5px 20px #0004;font-size:25px;font-weight:800;cursor:pointer;display:grid;place-items:center}
      #jfdAssistantPanel{position:fixed;right:22px;bottom:92px;width:min(430px,calc(100vw - 24px));height:min(590px,calc(100vh - 118px));background:#fff;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 16px 50px #0004;display:flex;flex-direction:column;overflow:hidden;color:#0f172a}
      #jfdAssistantPanel.jfd-ai-hidden{display:none}
      .jfd-ai-head{height:54px;flex:0 0 54px;background:#991b1b;color:white;display:flex;align-items:center;gap:10px;padding:0 12px;cursor:move;touch-action:none;user-select:none}
      .jfd-ai-head strong{font-size:14px;flex:1}.jfd-ai-head small{display:block;font-size:10px;opacity:.8;font-weight:400}
      .jfd-ai-head button{border:0;background:#ffffff20;color:white;border-radius:7px;width:30px;height:30px;font-size:18px;cursor:pointer}
      .jfd-ai-messages{flex:1;overflow:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}
      .jfd-ai-welcome{font-size:13px;line-height:1.5;color:#475569;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px}
      .jfd-ai-row{display:flex}.jfd-ai-user{justify-content:flex-end}.jfd-ai-assistant{justify-content:flex-start}
      .jfd-ai-bubble{max-width:88%;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.5;padding:10px 12px;border-radius:13px}
      .jfd-ai-user .jfd-ai-bubble{background:#991b1b;color:white;border-bottom-right-radius:4px}
      .jfd-ai-assistant .jfd-ai-bubble{background:white;border:1px solid #e2e8f0;color:#1e293b;border-bottom-left-radius:4px}
      .jfd-ai-compose{padding:10px;border-top:1px solid #e2e8f0;background:white}
      .jfd-ai-compose textarea{display:block;width:100%;min-height:66px;max-height:130px;resize:vertical;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font:13px inherit;outline:none}
      .jfd-ai-compose textarea:focus{border-color:#991b1b;box-shadow:0 0 0 2px #991b1b20}
      .jfd-ai-controls{display:flex;align-items:center;gap:8px;margin-top:7px}
      .jfd-ai-controls span{font-size:11px;color:#64748b;flex:1}
      .jfd-ai-controls button{background:#b5121b;color:white;border:0;border-radius:8px;padding:8px 14px;font-weight:700;font-size:12px}
      .jfd-ai-controls button:disabled{opacity:.5}
      @media(max-width:600px){#jfdAssistantPanel{right:12px;bottom:82px;width:calc(100vw - 24px);height:min(70vh,600px)}#jfdAssistantLauncher{right:16px;bottom:16px}}
    `;
    document.head.appendChild(style);
    root=document.createElement("div");root.id="jfdAssistantRoot";
    root.innerHTML='<button id="jfdAssistantLauncher" type="button" aria-label="Open JFD Assistant" title="JFD Assistant">✦</button><section id="jfdAssistantPanel" class="jfd-ai-hidden" role="dialog" aria-label="JFD Assistant"><header class="jfd-ai-head" id="jfdAssistantDrag"><div style="font-size:21px">✦</div><strong>JFD Assistant<small>Private Chief assistant</small></strong><button id="jfdAssistantMin" type="button" aria-label="Minimize">−</button><button id="jfdAssistantClose" type="button" aria-label="Close">×</button></header><div id="jfdAssistantMessages" class="jfd-ai-messages" aria-live="polite"></div><div class="jfd-ai-compose"><textarea id="jfdAssistantInput" placeholder="Ask JFD Assistant…" rows="2"></textarea><div class="jfd-ai-controls"><span id="jfdAssistantStatus"></span><button id="jfdAssistantSend" type="button">Send</button></div></div></section>';
    document.body.appendChild(root);
    panel=root.querySelector("#jfdAssistantPanel");
    messagesNode=root.querySelector("#jfdAssistantMessages");
    input=root.querySelector("#jfdAssistantInput");
    sendButton=root.querySelector("#jfdAssistantSend");
    statusNode=root.querySelector("#jfdAssistantStatus");
    root.querySelector("#jfdAssistantLauncher").addEventListener("click",togglePanel);
    root.querySelector("#jfdAssistantMin").addEventListener("click",closePanel);
    root.querySelector("#jfdAssistantClose").addEventListener("click",closePanel);
    sendButton.addEventListener("click",send);
    input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
    const handle=root.querySelector("#jfdAssistantDrag");
    handle.addEventListener("pointerdown",e=>{
      if(e.target.closest("button"))return;
      const rect=panel.getBoundingClientRect();
      drag={x:e.clientX-rect.left,y:e.clientY-rect.top};
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove",e=>{if(drag)setPosition(e.clientX-drag.x,e.clientY-drag.y);});
    const stop=()=>{drag=null;};
    handle.addEventListener("pointerup",stop);handle.addEventListener("pointercancel",stop);
    window.addEventListener("resize",()=>{if(panel&&!panel.classList.contains("jfd-ai-hidden")){const r=panel.getBoundingClientRect();setPosition(r.left,r.top);}});
    renderMessages();
  }
  function sync(){
    const allowed=isChief();
    if(!allowed){if(root)root.style.display="none";return;}
    build();
    root.style.display="";
    const id=String(me?.id||"chief");
    if(userKey!==id){
      userKey=id;
      try{const saved=JSON.parse(localStorage.getItem(STORAGE_PREFIX+userKey)||"[]");messages=Array.isArray(saved)?saved.filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string").slice(-40):[];}catch(_){messages=[];}
      renderMessages();
    }
  }
  function start(){
    sync();
    const app=document.getElementById("app");
    if(app)new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:["class"]});
    setInterval(sync,1500);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();