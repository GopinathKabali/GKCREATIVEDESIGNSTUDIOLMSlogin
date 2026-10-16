import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler } from '../api/lms.js';
import { roleFor } from '../lib/access.js';
const origin = 'https://gkcreative-design-studio-lms.vercel.app';
const env = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_cHVibGljJA', CLERK_SECRET_KEY: 'test-server-secret' };
const courseList = [{ id:'word', lessons:[{id:'lesson1'},{id:'lesson2'}] }];
const student = { id:'student1', primaryEmailAddressId:'email1', emailAddresses:[{id:'email1',emailAddress:'student@example.com',verification:{status:'verified'}}],privateMetadata:{} };
const admin = { ...student,id:'admin1',emailAddresses:[{id:'email1',emailAddress:'gopinath88.work@gmail.com',verification:{status:'verified'}}] };
function setup(user=student, signedIn=true) {
  const calls=[];
  const client={authenticateRequest:async(req,opts)=>{calls.push({type:'auth',opts});return {isSignedIn:signedIn,toAuth:()=>({userId:user.id})}},users:{getUser:async()=>user,updateUserMetadata:async(id,data)=>{calls.push({type:'write',id,data})},getUserList:async()=>({data:[student],totalCount:1})}};
  return { calls, handler:makeHandler({getClient:()=>client,env,courseList}) };
}
async function request(handler,action='me',options={}){const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};await handler({url:'/api/lms?action='+action,method:'GET',headers:{authorization:'Bearer valid'},...options},res);return res}
test('admin requires verified primary email; unsafe client role cannot promote a student',()=>{
  assert.equal(roleFor(admin),'admin');assert.equal(roleFor({...student,unsafeMetadata:{role:'admin'}}),'student');
  assert.equal(roleFor({...admin,emailAddresses:[{...admin.emailAddresses[0],verification:{status:'unverified'}}]}),'student');
  assert.equal(roleFor({...admin,primaryEmailAddressId:'other'}),'student');
});
test('public config returns only publishable key',async()=>{const {handler}=setup();const r=await request(handler,'config',{headers:{}});assert.equal(r.code,200);assert.deepEqual(Object.keys(r.body),['publishableKey']);assert(!JSON.stringify(r.body).includes(env.CLERK_SECRET_KEY))});
test('unsigned and expired sessions cannot retrieve courses',async()=>{assert.equal((await request(setup().handler,'courses',{headers:{}})).code,401);assert.equal((await request(setup(student,false).handler,'courses')).code,401)});
test('student is denied admin directory',async()=>{assert.equal((await request(setup().handler,'admin')).code,403)});
test('verified admin can view paginated users, without private metadata',async()=>{const r=await request(setup(admin).handler,'admin');assert.equal(r.code,200);assert.equal(r.body.users[0].role,'student');assert(!('privateMetadata' in r.body.users[0]))});
test('progress writes target the authenticated user, ignoring supplied user id and role',async()=>{const {handler,calls}=setup();const r=await request(handler,'progress',{method:'PUT',headers:{authorization:'Bearer valid',origin,'content-type':'application/json'},body:{userId:'admin1',role:'admin',progress:{word:['lesson1']}}});assert.equal(r.code,200);const w=calls.find(c=>c.type==='write');assert.equal(w.id,'student1');assert.deepEqual(w.data.privateMetadata.gkLms.progress,{word:['lesson1']});assert.equal(w.data.privateMetadata.gkLms.role,undefined)});
test('cross-origin writes and invalid course or lesson ids are rejected',async()=>{const {handler,calls}=setup();let r=await request(handler,'progress',{method:'PUT',headers:{authorization:'Bearer valid',origin:'https://attacker.example','content-type':'application/json'},body:{progress:{word:['lesson1']}}});assert.equal(r.code,403);for(const progress of [{word:['fake']},{admin:[]},{word:'lesson1'}]){r=await request(handler,'progress',{method:'PUT',headers:{authorization:'Bearer valid',origin,'content-type':'application/json'},body:{progress}});assert.equal(r.code,400)}assert(!calls.some(c=>c.type==='write'))});
test('empty arrays preserve undo; duplicates are removed',async()=>{const {handler}=setup();for(const [input,expected] of [[[],[]],[['lesson1','lesson1'],['lesson1']]]){const r=await request(handler,'progress',{method:'PUT',headers:{authorization:'Bearer valid',origin,'content-type':'application/json'},body:{progress:{word:input}}});assert.equal(r.code,200);assert.deepEqual(r.body.progress.word,expected)}});
test('SDK session verification explicitly restricts token type and allowed origins',async()=>{const {handler,calls}=setup();await request(handler);assert.equal(calls[0].opts.acceptsToken,'session_token');assert(calls[0].opts.authorizedParties.includes(origin));assert(!calls[0].opts.authorizedParties.includes('https://attacker.example'))});
test('disabled accounts are denied',async()=>{assert.equal((await request(setup({...student,banned:true}).handler,'courses')).code,403)});
test('all authenticated responses disable caching',async()=>{assert.match((await request(setup().handler)).headers['Cache-Control'],/no-store/)});
