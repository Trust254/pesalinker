(() => {
  const client = window.supabase.createClient(
    "https://oijxwrwnjaphpggenjxp.supabase.co",
    "sb_publishable_mFFQbi9UICiDodO6MBRygg_rEhrndTc"
  );
  const app = document.querySelector(".app");
  let user = null;
  const $ = (s, root=document) => root.querySelector(s);
  const msg = (s) => { const el=$("#authMessage"); el.textContent=s; el.style.display="block"; };
  const escape = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const enter = (u) => {
    user=u; app.classList.add("entered");
    $("#userAvatar").textContent=((u.user_metadata?.full_name || u.email || "K").trim()[0] || "K").toUpperCase();
    $("#signOutBtn").style.display="inline-flex";
    const isAdmin=u.app_metadata?.role==="admin"; $("#adminNav").style.display=isAdmin?"flex":"none"; $("#adminNavMobile").style.display=isAdmin?"grid":"none";
    window.showPage("home"); loadJobs();
  };
  const showAuth = () => { app.classList.remove("entered"); $("#signOutBtn").style.display="none"; window.authMode("signin"); };
  const register=$("#registerForm"), signin=$("#signinForm");
  register.addEventListener("submit", async e => {
    e.preventDefault(); e.stopImmediatePropagation();
    const b=$('button[type="submit"]',register); b.disabled=true;
    try {
      const {data,error}=await client.auth.signUp({
        email:$("#regEmail").value.trim(),
        password:$("#regPassword").value,
        options:{data:{full_name:$("#regName").value.trim()},emailRedirectTo:window.location.origin}
      });
      if(error) throw error;
      if(data.session) enter(data.user);
      else { window.authMode("signin"); $("#loginEmail").value=$("#regEmail").value.trim(); msg("Account created. Check your email for the confirmation link, then sign in."); }
    } catch(err) { msg(err.message || "Registration failed. Please try again."); }
    finally { b.disabled=false; }
  }, true);
  signin.addEventListener("submit", async e => {
    e.preventDefault(); e.stopImmediatePropagation();
    const b=$('button[type="submit"]',signin); b.disabled=true;
    try {
      const {data,error}=await client.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});
      if(error) throw error; enter(data.user);
    } catch(err) { msg(err.message || "Sign-in failed. Check your email and password."); }
    finally { b.disabled=false; }
  }, true);
  $("#signOutBtn").addEventListener("click", async () => { await client.auth.signOut(); user=null; showAuth(); });
  client.auth.onAuthStateChange((_event,session) => {
    if(session?.user && !user) enter(session.user);
    if(!session && user) { user=null; showAuth(); }
  });
  async function loadJobs() {
    const box=$("#jobResults"); if(!box) return;
    box.innerHTML='<div class="resultbox">Loading approved vacancies…</div>';
    let q=client.from("jobs").select("id,title,company_name,county,town,category,description,requirements,application_contact,application_url,source_type,source_name,posted_at,deadline").eq("status","published").or("deadline.is.null,deadline.gte."+new Date().toISOString().slice(0,10)).order("posted_at",{ascending:false}).limit(40);
    const county=$("#county").value, town=$("#town").value.trim(), cat=$("#category").value, word=$("#keyword").value.trim().replace(/[%_*]/g,"");
    if(county) q=q.eq("county",county);
    if(town) q=q.ilike("town","%"+town+"%");
    if(cat) q=q.eq("category",cat);
    if(word) q=q.ilike("title","%"+word+"%");
    const {data,error}=await q;
    if(error){box.innerHTML='<div class="resultbox">Vacancies could not load. Please refresh and try again.</div>';return;}
    if(!data.length){box.innerHTML='<div class="resultbox"><b>No approved vacancies match this search yet.</b><br>Verified listings will appear here after review. Try another county or category.</div>';return;}
    box.innerHTML=data.map(j=>'<article class="panel"><div class="panel-head"><div><h3>'+escape(j.title)+'</h3><small>'+escape(j.company_name)+' · '+escape(j.town)+', '+escape(j.county)+'</small></div><span class="tag">'+escape(j.category)+'</span></div><p style="font-size:13px;color:#c1d2c5">'+escape(j.description)+'</p>'+(j.requirements?'<p style="font-size:12px;color:#a8b3a5"><b>Requirements:</b> '+escape(j.requirements)+'</p>':'')+'<div class="tag">Source: '+escape(j.source_name||j.source_type)+'</div><div class="tag">Posted: '+new Date(j.posted_at).toLocaleDateString()+'</div>'+(j.deadline?'<div class="tag">Deadline: '+escape(j.deadline)+'</div>':'')+(j.application_contact?'<p style="font-size:12px">Apply/contact: <b>'+escape(j.application_contact)+'</b></p>':'')+(j.application_url?'<a class="btn small alt" target="_blank" rel="noopener" href="'+escape(j.application_url)+'">Apply ↗</a>':'')+'<div style="border-top:1px solid #34452f;margin-top:14px;padding-top:12px"><b style="font-size:13px">Comments</b><div id="comments-'+j.id+'" style="display:grid;gap:7px;margin:10px 0">Loading comments…</div><form class="comment-form" data-job="'+j.id+'"><div class="field"><label>ADD A COMMENT</label><textarea name="comment" maxlength="2000" required placeholder="Share useful information or ask a question" style="min-height:65px"></textarea></div><button class="btn small">Post comment</button></form></div></article>').join("");
    data.forEach(j=>loadComments(j.id));
    box.querySelectorAll(".comment-form").forEach(f=>f.addEventListener("submit",postComment));
  }
  async function loadComments(id) {
    const box=$("#comments-"+id); if(!box) return;
    const {data,error}=await client.from("job_comments").select("id,comment,created_at").eq("job_id",id).eq("is_hidden",false).order("created_at").limit(80);
    if(error){box.textContent="Comments are temporarily unavailable.";return;}
    box.innerHTML=data.length?data.map(c=>'<div style="padding:9px;border:1px solid #34452f;border-radius:10px;background:#0a120d"><small style="color:#e8c66f">KAZI LINKER member · '+new Date(c.created_at).toLocaleString()+'</small><div style="font-size:12px;margin-top:3px">'+escape(c.comment)+'</div></div>').join(""):'<small style="color:#a8b3a5">No comments yet. Be the first to contribute.</small>';
  }
  async function postComment(e) {
    e.preventDefault();
    if(!user){showAuth();return;}
    const form=e.currentTarget, id=form.dataset.job, comment=form.elements.comment.value.trim(), button=$("button",form);
    if(!comment)return; button.disabled=true;
    const {error}=await client.from("job_comments").insert({job_id:id,user_id:user.id,comment});
    button.disabled=false;
    if(error){alert(error.message);return;}
    form.reset();loadComments(id);
  }
  $("#searchJobs").addEventListener("click",loadJobs);
  $("#cvform").addEventListener("submit",async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(!user){alert("Please sign in before requesting a CV.");showAuth();return;}
    const a=$("input,textarea",e.currentTarget) ? Array.from(e.currentTarget.querySelectorAll("input,textarea")) : [];
    const contact=a[1].value.trim(), email=contact.includes("@")?contact:user.email;
    const {error}=await client.from("cv_requests").insert({user_id:user.id,full_name:a[0].value.trim(),email,phone:contact.includes("@")?"":contact,target_role:a[2].value.trim(),mpesa_transaction_code:a[3].value.trim(),experience:a[4].value.trim()});
    if(error){alert(error.message);return;}
    e.currentTarget.reset();alert("Your CV request has been submitted. Payment is pending manual verification.");
  },true);
  $("#jobform").addEventListener("submit",async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(!user){alert("Please sign in before submitting a vacancy.");showAuth();return;}
    const a=Array.from(e.currentTarget.querySelectorAll("input,select,textarea"));
    const {error}=await client.from("employer_submissions").insert({user_id:user.id,company_name:a[0].value.trim(),contact_name:user.user_metadata?.full_name || user.email,county:a[1].value,town:a[2].value.trim(),job_title:a[3].value.trim(),category:a[4].value,description:a[5].value.trim(),application_contact:a[6].value.trim(),contact_email:user.email});
    if(error){alert(error.message);return;}
    e.currentTarget.reset();alert("Vacancy submitted. It will appear publicly only after admin review.");
  },true);

  async function loadMyCv() {
    const box=$("#myCvRequests"); if(!box || !user)return;
    box.textContent="Loading your CV requests…";
    const {data,error}=await client.from("cv_requests").select("id,target_role,payment_status,status,created_at,cv_storage_path").eq("user_id",user.id).order("created_at",{ascending:false});
    if(error){box.textContent="Could not load your CV requests.";return;}
    if(!data.length){box.innerHTML='<small style="color:#a8b3a5">You have not submitted a CV request yet.</small>';return;}
    box.innerHTML=data.map(r=>'<div class="job" style="align-items:flex-start"><div><b>'+escape(r.target_role)+'</b><small>Submitted '+new Date(r.created_at).toLocaleDateString()+'</small><div class="tag">Payment: '+escape(r.payment_status)+'</div><div class="tag">Status: '+escape(r.status)+'</div></div><div>'+(r.cv_storage_path&&r.status==="completed"?'<button class="btn small" data-download="'+escape(r.cv_storage_path)+'">Download CV</button>':'')+'</div></div>').join("");
    box.querySelectorAll("[data-download]").forEach(b=>b.addEventListener("click",async()=>{const {data,error}=await client.storage.from("cv-documents").createSignedUrl(b.dataset.download,3600);if(error){alert(error.message);return;}window.open(data.signedUrl,"_blank","noopener");}));
  }
  async function loadAdmin() {
    if(!user || user.app_metadata?.role!=="admin"){alert("This account does not have admin access.");window.showPage("home");return;}
    const employers=$("#adminEmployers"), cvs=$("#adminCvs");
    employers.textContent="Loading employer submissions…";cvs.textContent="Loading CV requests…";
    const [er,cr]=await Promise.all([
      client.from("employer_submissions").select("*").eq("status","pending").order("created_at",{ascending:true}),
      client.from("cv_requests").select("*").order("created_at",{ascending:true})
    ]);
    if(er.error) employers.textContent="Could not load employer submissions.";
    else employers.innerHTML=er.data.length?er.data.map(x=>'<div class="panel" style="padding:13px"><b>'+escape(x.job_title)+' · '+escape(x.company_name)+'</b><small>'+escape(x.town)+', '+escape(x.county)+' · '+escape(x.application_contact)+'</small><p style="font-size:12px">'+escape(x.description)+'</p><button class="btn small" data-employer-approve="'+x.id+'">Approve & publish</button> <button class="btn ghost small" data-employer-reject="'+x.id+'">Reject</button></div>').join(""):'<small>No pending employer submissions.</small>';
    if(cr.error) cvs.textContent="Could not load CV requests.";
    else cvs.innerHTML=cr.data.length?cr.data.map(x=>'<div class="panel" style="padding:13px"><b>'+escape(x.full_name)+' · '+escape(x.target_role)+'</b><small>'+escape(x.email)+' · '+escape(x.mpesa_transaction_code)+'</small><div class="tag">Payment: '+escape(x.payment_status)+'</div><div class="tag">Status: '+escape(x.status)+'</div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px"><button class="btn small" data-cv-confirm="'+x.id+'">Confirm payment</button><button class="btn ghost small" data-cv-reject="'+x.id+'">Reject</button></div><div class="field"><label>UPLOAD COMPLETED CV (PDF/DOCX)</label><input type="file" accept=".pdf,.doc,.docx" data-cv-file="'+x.id+'"></div><button class="btn small" data-cv-upload="'+x.id+'" data-user="'+x.user_id+'" '+(x.payment_status!=="confirmed"?"disabled":"")+'>Upload & mark complete</button></div>').join(""):'<small>No CV requests yet.</small>';
    employers.querySelectorAll("[data-employer-approve]").forEach(b=>b.addEventListener("click",()=>reviewEmployer(b.dataset.employerApprove,"approved")));
    employers.querySelectorAll("[data-employer-reject]").forEach(b=>b.addEventListener("click",()=>reviewEmployer(b.dataset.employerReject,"rejected")));
    cvs.querySelectorAll("[data-cv-confirm]").forEach(b=>b.addEventListener("click",()=>updateCv(b.dataset.cvConfirm,{payment_status:"confirmed",status:"in_progress"})));
    cvs.querySelectorAll("[data-cv-reject]").forEach(b=>b.addEventListener("click",()=>updateCv(b.dataset.cvReject,{payment_status:"rejected",status:"rejected"})));
    cvs.querySelectorAll("[data-cv-upload]").forEach(b=>b.addEventListener("click",()=>uploadCv(b)));
  }
  async function reviewEmployer(id,decision) {
    const {data,error}=await client.from("employer_submissions").select("*").eq("id",id).single();
    if(error){alert(error.message);return;}
    if(decision==="approved"){
      const {error:jobError}=await client.from("jobs").insert({title:data.job_title,company_name:data.company_name,county:data.county,town:data.town,category:data.category,description:data.description,requirements:data.requirements,application_contact:data.application_contact,application_url:data.application_url,source_type:"employer",source_name:data.company_name,status:"published",created_by:user.id});
      if(jobError){alert(jobError.message);return;}
    }
    const {error:updateError}=await client.from("employer_submissions").update({status:decision,reviewed_at:new Date().toISOString()}).eq("id",id);
    if(updateError){alert(updateError.message);return;} loadAdmin();
  }
  async function updateCv(id,changes) {
    const {error}=await client.from("cv_requests").update(changes).eq("id",id);
    if(error){alert(error.message);return;} loadAdmin();
  }
  async function uploadCv(button) {
    const id=button.dataset.cvUpload, owner=button.dataset.user, fileInput=$('[data-cv-file="'+id+'"]'), file=fileInput.files[0];
    if(!file){alert("Choose the completed CV file first.");return;}
    const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"), path=owner+"/"+id+"/"+clean;
    button.disabled=true;
    const {error:uploadError}=await client.storage.from("cv-documents").upload(path,file,{upsert:true,contentType:file.type||"application/octet-stream"});
    if(uploadError){button.disabled=false;alert(uploadError.message);return;}
    const {error}=await client.from("cv_requests").update({cv_storage_path:path,status:"completed",payment_status:"confirmed"}).eq("id",id);
    button.disabled=false;
    if(error){alert(error.message);return;} loadAdmin();
  }
  $("#adminJobForm").addEventListener("submit",async e=>{
    e.preventDefault();if(!user||user.app_metadata?.role!=="admin"){alert("Admin access required.");return;}
    const v=Object.fromEntries(new FormData(e.currentTarget).entries());
    const {error}=await client.from("jobs").insert({title:v.title,company_name:v.company,county:v.county,town:v.town,category:v.category,description:v.description,requirements:v.requirements,application_contact:v.contact,application_url:v.apply_url||null,source_type:"public_source",source_name:v.source,source_url:v.source_url||null,deadline:v.deadline||null,status:"published",created_by:user.id});
    if(error){alert(error.message);return;}e.currentTarget.reset();alert("Vacancy published.");loadJobs();
  });
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-page]");if(!b)return;
    if(b.dataset.page==="account")loadMyCv();
    if(b.dataset.page==="admin")loadAdmin();
  });

  client.auth.getSession().then(({data})=>{if(data.session)enter(data.session.user);});
})();
