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
        options:{data:{full_name:$("#regName").value.trim()}}
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
  client.auth.getSession().then(({data})=>{if(data.session)enter(data.session.user);});
})();
