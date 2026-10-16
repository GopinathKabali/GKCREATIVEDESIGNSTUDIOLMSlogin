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
if(adminIntent&&account.role!=='admin'){gate.hidden=false;portal.hidden=true;if(mountMode){if(mountMode==='signup')Clerk.unmountSignUp(mount);else Clerk.unmountSignIn(mount);mountMode=null}mount.innerHTML='<div class="auth-denied"><h2>Administrator access required</h2><p>This account has student access. You can continue learning or sign out to use an administrator account.</p><button id="continueStudent" class="primary">Continue as student →</button><button id="switchAccount" class="text-btn">Sign out</button></div>';return}
const catalog=await api('courses');
window.GK_ACCOUNT=account;window.OFFICE_COURSES=catalog.courses;activeUser=account.id;
window.GK_API=api;
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
async function showAdmin(offset=0){
const app=document.querySelector('#app');app.innerHTML='<p role="status">Loading registered learners…</p>';
document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.id==='adminNav'));document.querySelector('#breadcrumb').textContent='Administration';
try{
const data=await api('admin&offset='+offset),courses=window.OFFICE_COURSES;
app.innerHTML='<div class="intro"><div><div class="eyebrow">ADMIN STUDIO</div><h1>Your learning community.</h1><p class="subtitle">Registered accounts and account-saved lesson progress.</p></div></div><div class="stats"><div class="stat"><strong>'+data.totalCount+'</strong><small>Registered accounts</small></div><div class="stat"><strong>3</strong><small>Office courses</small></div><div class="stat"><strong>106</strong><small>Video lessons</small></div></div><div class="admin-table-wrap"><table class="admin-table"><caption>Registered learners — '+(data.totalCount?data.offset+1:0)+'–'+Math.min(data.offset+data.users.length,data.totalCount)+' of '+data.totalCount+'</caption><thead><tr><th scope="col">Learner</th><th scope="col">Role</th>'+courses.map(c=>'<th scope="col">'+safe(c.category)+'</th>').join('')+'</tr></thead><tbody>'+data.users.map(u=>'<tr><td><b>'+safe(u.name)+'</b><small>'+safe(u.email)+(u.verified?' · verified':' · unverified')+'</small></td><td>'+safe(u.role)+'</td>'+courses.map(c=>'<td>'+u.progress[c.id]+' / '+c.lessons.length+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+(data.users.length?'':'<p class="subtitle">No registered accounts yet.</p>')+'</div><div class="admin-pages">'+(data.offset>0?'<button class="primary" data-admin-offset="'+Math.max(0,data.offset-data.limit)+'">← Previous</button>':'')+(data.offset+data.limit<data.totalCount?'<button class="primary" data-admin-offset="'+(data.offset+data.limit)+'">Next →</button>':'')+'<button class="text-btn" data-admin-offset="'+data.offset+'">Refresh</button></div><p class="notice">Progress records lesson completion selected by each learner; it does not measure video watch time.</p>';
}catch(error){app.innerHTML='<div class="empty" role="alert">'+safe(error.message)+' <button class="text-btn" data-admin-offset="0">Try again</button></div>'}
}
document.addEventListener('click',e=>{
const b=e.target.closest('button');if(!b)return;
if(b.dataset.authMode)showMode(b.dataset.authMode);
if(b.id==='authRetry')location.reload();
if(b.id==='adminNav')showAdmin(0);
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
init();
})();
