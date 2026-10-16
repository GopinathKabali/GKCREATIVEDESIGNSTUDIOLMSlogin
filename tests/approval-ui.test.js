import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function harness(responses) {
  const elements=new Map(),requests=[];
  const node=()=>({innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{toggle(){}},setAttribute(){},showModal(){this.open=true}});
  const query=k=>{if(!elements.has(k))elements.set(k,node());return elements.get(k)};
  const ctx={document:{querySelector:query,querySelectorAll:()=>[],addEventListener(){},hidden:false},location:{search:'',reload(){},assign(){},replace(){}},URLSearchParams,Date,setInterval(){},fetch:async(url,options)=>{requests.push({url,options});const action=url.split('action=')[1];return {ok:true,json:async()=>responses[action]}}};
  ctx.window=ctx;ctx.Clerk={session:{getToken:async()=> 'session-token'},openUserProfile(){}};
  ctx.OFFICE_COURSES=[{id:'word',category:'Word',lessons:[{id:'lesson1'}]}];
  const source=fs.readFileSync(new URL('../auth-ui.js',import.meta.url),'utf8').replace(/init\(\);\s*\}\)\(\);/, 'window.testUI={enter,showAdmin,showWaiting,showSessions};})();');
  vm.runInNewContext(source,ctx);
  return {ctx,query,requests};
}
test('pending student sees approval message and never requests course links',async()=>{
  const {ctx,query,requests}=harness({me:{id:'user_student',name:'New learner',role:'student',access:{status:'pending',courseIds:[],emailVerified:true}}});
  await ctx.testUI.enter();assert.equal(query('#portal').hidden,true);assert.equal(query('#authGate').hidden,false);assert.match(query('#approvalMessage').innerHTML,/administrator will review/i);assert(!requests.some(r=>r.url.includes('action=courses')));
});
test('admin directory renders decisions, course checkboxes, login times, and escaped learner text',async()=>{
  const {ctx,query}=harness({ 'admin&offset=0':{totalCount:1,offset:0,limit:20,users:[{id:'user_learner',name:'<script>alert(1)</script>',email:'student@example.com',verified:false,role:'student',access:{status:'pending',courseIds:[]},createdAt:1,lastSignInAt:100,lastActiveAt:200,progress:{word:0}}]} });
  await ctx.testUI.showAdmin();const html=query('#app').innerHTML;
  for(const text of ['Approve selected','Reject','Revoke','View login sessions','Last sign-in','Last active','data-enrollment="user_learner"','disabled title='])assert(html.includes(text));
  assert(!html.includes('<script>alert(1)</script>'));assert(html.includes('&lt;script&gt;'));
});
test('session dialog shows login activity without token fields',async()=>{
  const {ctx,query}=harness({'sessions&userId=user_learner&offset=0':{totalCount:1,limit:20,sessions:[{status:'active',createdAt:1,lastActiveAt:2,expireAt:3}]}});
  await ctx.testUI.showSessions('user_learner');assert(query('#modal').open);assert.match(query('#modalBody').innerHTML,/active/);assert.match(query('#modalBody').innerHTML,/Last active/);
});
