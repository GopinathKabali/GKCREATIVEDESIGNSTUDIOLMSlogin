'use strict';
(() => {
const gate=document.querySelector('#authGate'),portal=document.querySelector('#portal'),status=document.querySelector('#authStatus'),mount=document.querySelector('#clerkMount');
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let loadedApp=false,activeUser=null,currentMode='signin',mountMode=null,booting=false;
const params=new URLSearchParams(location.search);
let adminIntent=params.get('mode')==='admin';
async function loadScript(src,attributes={}){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';for(const [k,v] of Object.entries(attributes))s.setAttribute(k,v);s.onload=resolve;s.onerror=()=>reject(new Error('Sign-in could not load. Check your connection and try again.'));document.head.appendChild(s)})}
async function api(action,options={}){
const token=await window.Clerk.session?.getToken();
if(!token)throw new Error('Please sign in to continue.');
const res=await fetch('/api/lms?action='+action,{...options,headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},cache:'no-store'});
const body=await res.json();if(!res.ok)throw new Error(body.error||'The request could not be completed.');return body;
}
function showError(error){status.textContent=error.message||'Please try again.';status.setAttribute('role','alert');document.querySelector('#authRetry').hidden=false}
function showMode(mode){
if(!window.Clerk)return;
if(mountMode==='signup')window.Clerk.unmountSignUp(mount);else if(mountMode==='signin')window.Clerk.unmountSignIn(mount);
mountMode=null;mount.innerHTML='';currentMode=mode;
adminIntent=mode==='admin';
document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.authMode===mode?'true':'false'));
document.querySelector('#authHeading').textContent=mode==='signup'?'Your next chapter starts here.':mode==='admin'?'Welcome to your admin studio.':'Welcome back to your learning studio.';
document.querySelector('#authDescription').textContent=mode==='signup'?'Create a student account to start learning PowerPoint, Word, and Excel.':mode==='admin'?'Sign in with your verified administrator account.':'Sign in to continue your courses and keep your progress in sync.';
status.textContent='';
const appearance={variables:{colorPrimary:'#0759d6',borderRadius:'0.6rem',fontFamily:'DM Sans, sans-serif'},elements:{rootBox:{width:'100%'},cardBox:{width:'100%',boxShadow:'none'},card:{boxShadow:'none'}}};
if(mode==='signup'){window.Clerk.mountSignUp(mount,{routing:'hash',signInUrl:'/?mode=signin',forceRedirectUrl:'/',appearance});mountMode='signup'}
else {window.Clerk.mountSignIn(mount,{routing:'hash',signUpUrl:'/?mode=signup',forceRedirectUrl:mode==='admin'?'/?mode=admin':'/',signUpForceRedirectUrl:'/',appearance});mountMode='signin'}
}
async function enter(){
if(booting)return;booting=true;
try{
const account=await api('me');
activeUser=account.id;window.GK_ACCOUNT=account;
if(adminIntent&&account.role!=='admin'){showWaiting(account,true);return}
if(account.role!=='admin'&&(!account.access.emailVerified||account.access.status!=='approved'||!account.access.courseIds.length)){showWaiting(account);return}
const catalog=await api('courses');
window.GK_ACCOUNT=account;window.OFFICE_COURSES=catalog.courses;activeUser=account.id;
window.GK_API=api;
window.GK_ACCESS_CHANGED=()=>location.reload();
window.GK_SAVE_PROGRESS=progress=>api('progress',{method:'PUT',body:JSON.stringify({progress})});
if(!loadedApp){await loadScript('/app.js');loadedApp=true}
portal.hidden=false;gate.hidden=true;
document.querySelector('#learnerName').textContent=account.name;
document.querySelector('#learnerRole').textContent=account.role==='admin'?'Administrator':'Student';
document.querySelector('.avatar').textContent=account.name.slice(0,1).toUpperCase();
document.querySelector('#adminNav').hidden=account.role!=='admin';
Clerk.mountUserButton(document.querySelector('#userButton'),{signOutFallbackRedirectUrl:'/'});
if(adminIntent)await showAdmin(0);
}catch(error){gate.hidden=false;portal.hidden=true;showError(error)}
finally{booting=false}
}

function showWaiting(account,adminDenied=false){
gate.hidden=false;portal.hidden=true;mount.hidden=true;
document.querySelector('#authChoices').hidden=true;
document.querySelector('#authRetry').hidden=true;status.textContent='';
document.querySelector('#authHeading').textContent=adminDenied?'Administrator access required.':!account.access.emailVerified?'Verify your email first.':account.access.status==='rejected'?'Your access request was declined.':account.access.status==='revoked'?'Your course access is paused.':'Your account is awaiting approval.';
document.querySelector('#authDescription').textContent=adminDenied?'This account does not have administrator access.':'Signing up does not automatically grant access to learning materials.';
const box=document.querySelector('#approvalMessage');box.hidden=false;
box.innerHTML='<div class="auth-denied"><b>'+safe(account.name)+'</b><p>'+(adminDenied?'Sign in with the administrator account, or continue to your student account.':!account.access.emailVerified?'Complete email verification in your account settings. The administrator can then review your account.':account.access.status==='approved'?'No courses are assigned to your account. Please contact the administrator.':account.access.status==='pending'?'The administrator will review your account and select which courses you can access. Please check back after approval.':'Please contact GK Creative Design Studio if you need this decision reviewed.')+'</p><button id="refreshApproval" class="primary">Check access again</button><button id="manageAccount" class="text-btn">Account settings</button><button id="switchAccount" class="text-btn">Sign out</button>'+(adminDenied?'<button id="continueStudent" class="text-btn">Continue as student</button>':'')+'</div>';
}
const formatTime=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'No activity recorded';
let adminOffset=0;
async function showAdmin(offset=0,message=''){
adminOffset=offset;
const app=document.querySelector('#app');app.innerHTML='<p role="status">Loading learners and access requests…</p>';
document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.id==='adminNav'));document.querySelector('#breadcrumb').textContent='Administration';
try{
const data=await api('admin&offset='+offset),courses=window.OFFICE_COURSES;
app.innerHTML='<div class="intro"><div><div class="eyebrow">ADMIN CONTROL CENTRE</div><h1>Review. Approve. Monitor.</h1><p class="subtitle">New learners wait for your approval. Assign access to individual courses.</p></div></div><div class="stats"><div class="stat"><strong>'+data.totalCount+'</strong><small>Registered accounts</small></div><div class="stat"><strong>'+data.users.filter(u=>u.access.status==='pending').length+'</strong><small>Pending on this page</small></div><div class="stat"><strong>'+data.users.filter(u=>u.access.status==='approved').length+'</strong><small>Approved on this page</small></div></div><p id="reviewStatus" role="status">'+safe(message)+'</p><div class="admin-table-wrap"><table class="admin-table"><caption>Learners '+(data.totalCount?data.offset+1:0)+'–'+Math.min(data.offset+data.users.length,data.totalCount)+' of '+data.totalCount+'</caption><thead><tr><th scope="col">Learner & verification</th><th scope="col">Login activity</th><th scope="col">Course progress</th><th scope="col">Access review</th></tr></thead><tbody>'+data.users.map(u=>'<tr><td><b>'+safe(u.name)+'</b><small>'+safe(u.email)+'</small><span class="status-badge '+(u.verified?'approved':'pending')+'">'+(u.verified?'Email verified':'Email unverified')+'</span><small>'+safe(u.role)+' · Joined '+safe(formatTime(u.createdAt))+'</small></td><td><b>Last sign-in</b><small>'+safe(formatTime(u.lastSignInAt))+'</small><b>Last active</b><small>'+safe(formatTime(u.lastActiveAt))+'</small><button class="text-btn" data-sessions-user="'+safe(u.id)+'">View login sessions ↗</button></td><td>'+courses.map(c=>'<small>'+safe(c.category)+': '+u.progress[c.id]+' / '+c.lessons.length+'</small>').join('')+'</td><td><span class="status-badge '+safe(u.access.status)+'">'+safe(u.role==='admin'?'Administrator':u.access.status)+'</span>'+(u.role==='admin'?'<p class="notice">Administrator has full access.</p>':'<fieldset class="course-access"><legend>Allow courses for '+safe(u.name)+'</legend>'+courses.map(c=>'<label><input type="checkbox" data-enrollment="'+safe(u.id)+'" value="'+c.id+'" '+(u.access.courseIds.includes(c.id)?'checked':'')+'> '+safe(c.category)+'</label>').join('')+'</fieldset><div class="review-actions"><button class="primary" data-access-user="'+safe(u.id)+'" data-access-status="approved" '+(!u.verified?'disabled title="Learner must verify their email first"':'')+'>Approve selected</button><button class="text-btn" data-access-user="'+safe(u.id)+'" data-access-status="rejected">Reject</button><button class="text-btn" data-access-user="'+safe(u.id)+'" data-access-status="revoked">Revoke</button></div>'+(u.access.reviewedAt?'<small>Last decision: '+safe(formatTime(u.access.reviewedAt))+'</small>':''))+'</td></tr>').join('')+'</tbody></table>'+(data.users.length?'':'<p class="subtitle">No registered accounts yet.</p>')+'</div><div class="admin-pages">'+(data.offset>0?'<button class="primary" data-admin-offset="'+Math.max(0,data.offset-data.limit)+'">← Previous</button>':'')+(data.offset+data.limit<data.totalCount?'<button class="primary" data-admin-offset="'+(data.offset+data.limit)+'">Next →</button>':'')+'<button class="text-btn" data-admin-offset="'+data.offset+'">Refresh</button></div><p class="notice">Session details show Clerk login sessions, not every failed login attempt. Course completion is selected by the learner. Revoking portal access cannot withdraw a Drive file already shared or downloaded.</p>';
}catch(error){app.innerHTML='<div class="empty" role="alert">'+safe(error.message)+' <button class="text-btn" data-admin-offset="0">Try again</button></div>'}
}
async function updateAccess(button){
const userId=button.dataset.accessUser,statusValue=button.dataset.accessStatus;
const selected=[...document.querySelectorAll('input[data-enrollment="'+userId+'"]:checked')].map(el=>el.value);
const statusBox=document.querySelector('#reviewStatus');
if(statusValue==='approved'&&!selected.length){statusBox.textContent='Select at least one course before approving.';return}
const controls=[...document.querySelectorAll('button[data-access-user="'+userId+'"]')];controls.forEach(b=>b.disabled=true);statusBox.textContent='Saving access decision…';
try{await api('access',{method:'PUT',body:JSON.stringify({userId,status:statusValue,courseIds:selected})});await showAdmin(adminOffset,'Access decision saved. The learner’s next access check will use these permissions.')}
catch(error){statusBox.textContent=error.message;controls.forEach(b=>b.disabled=false)}
}
async function showSessions(userId,offset=0){
const dialog=document.querySelector('#modal'),body=document.querySelector('#modalBody');
document.querySelector('#modalTitle').textContent='Learner login sessions';body.innerHTML='<p role="status">Loading sessions…</p>';if(!dialog.open)dialog.showModal();
try{const data=await api('sessions&userId='+encodeURIComponent(userId)+'&offset='+offset);body.innerHTML='<p class="subtitle">'+data.totalCount+' recorded sessions. Showing '+(data.totalCount?offset+1:0)+'–'+Math.min(offset+data.sessions.length,data.totalCount)+'.</p><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Status</th><th>Created</th><th>Last active</th><th>Expires</th></tr></thead><tbody>'+data.sessions.map(s=>'<tr><td>'+safe(s.status)+'</td><td>'+safe(formatTime(s.createdAt))+'</td><td>'+safe(formatTime(s.lastActiveAt))+'</td><td>'+safe(formatTime(s.expireAt))+'</td></tr>').join('')+'</tbody></table></div>'+(data.sessions.length?'':'<p>No sessions recorded.</p>')+'<div class="admin-pages">'+(offset>0?'<button class="text-btn" data-sessions-user="'+safe(userId)+'" data-session-offset="'+Math.max(0,offset-data.limit)+'">← Previous</button>':'')+(offset+data.limit<data.totalCount?'<button class="text-btn" data-sessions-user="'+safe(userId)+'" data-session-offset="'+(offset+data.limit)+'">Next →</button>':'')+'</div>'}
catch(error){body.innerHTML='<p role="alert">'+safe(error.message)+'</p>'}
}


document.addEventListener('click',e=>{
const b=e.target.closest('button');if(!b)return;
if(b.dataset.authMode){location.assign('/?mode='+b.dataset.authMode);return;}
if(b.id==='authRetry')location.reload();
if(b.id==='adminNav')showAdmin(0);
if(b.dataset.accessUser)updateAccess(b);
if(b.dataset.sessionsUser)showSessions(b.dataset.sessionsUser,Number(b.dataset.sessionOffset||0));
if(b.id==='refreshApproval')enter();
if(b.id==='manageAccount')Clerk.openUserProfile();
if(b.dataset.adminOffset!==undefined)showAdmin(Number(b.dataset.adminOffset));
if(b.id==='continueStudent'){adminIntent=false;enter()}
if(b.id==='switchAccount')Clerk.signOut({redirectUrl:'/'});
});
async function init(){
try{
const response=await fetch('/api/lms?action=config',{cache:'no-store'}),config=await response.json();if(!response.ok)throw new Error(config.error);
const domain=atob(config.publishableKey.split('_')[2].replace(/-/g,'+').replace(/_/g,'/')).replace(/\$$/,'');
if(!/^[a-z0-9.-]+$/i.test(domain))throw new Error('Invalid sign-in configuration.');
await loadScript('https://'+domain+'/npm/@clerk/ui@1/dist/ui.browser.js');
await loadScript('https://'+domain+'/npm/@clerk/clerk-js@6/dist/clerk.browser.js',{'data-clerk-publishable-key':config.publishableKey});
await Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
document.querySelector('#authChoices').hidden=false;
if(Clerk.user)await enter();else showMode(params.get('mode')==='signup'?'signup':adminIntent?'admin':'signin');
Clerk.addListener(({user,session})=>{
if(!user||!session){if(activeUser)location.replace('/');return}
if(activeUser&&activeUser!==user.id){location.replace('/');return}
if(!activeUser)enter();
});
}catch(error){showError(error)}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeUser)checkAccess()});
async function checkAccess(){if(!activeUser)return;try{const latest=await api('me');if(JSON.stringify(latest.access)!==JSON.stringify(window.GK_ACCOUNT.access)){location.reload()}}catch{location.reload()}}
setInterval(checkAccess,60000);
init();
})();
