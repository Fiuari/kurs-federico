const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const script = fs.readFileSync(path.join(__dirname, '../assets/js/admin-api.js'), 'utf8');
const calls = [];
let response = {data:{id:'room-1'},error:null};
let user = {id:'admin'};
let allowed = true;
const query = {
  insert(value){calls.push(['insert',value]);return this;},update(value){calls.push(['update',value]);return this;},
  delete(){calls.push(['delete']);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},
  select(){return this;},single(){return this;},maybeSingle(){return this;},order(){return this;},
  async abortSignal(){return response;}
};
const context = vm.createContext({setTimeout,clearTimeout,AbortController,
apiRequest:async(route,options={})=>{
 if(route==='/me/admin')return allowed;
 if(options.method==='PATCH'){query.update(options.body).eq('id',route.split('/').at(-1));}
 if(options.method==='POST')query.insert(options.body);
 if(response.error)throw response.error;
 if(options.method==='DELETE'&&!response.data)throw new Error('ROOM_NOT_FOUND');
 return response.data;
},getHotelClient:()=>({
  auth:{getUser:async()=>({data:{user},error:null})},
  rpc:()=>({abortSignal:async()=>({data:allowed,error:null})}),from:()=>query
})});
vm.runInContext(script,context);
const run = source=>vm.runInContext(source,context);
(async()=>{
  assert.equal((await run('requireHotelAdmin()')).id,'admin');
  allowed=false; await assert.rejects(()=>run('requireHotelAdmin()'),/ADMIN_REQUIRED/);
  allowed=true; user=null; await assert.rejects(()=>run('requireHotelAdmin()'),/SIGN_IN_REQUIRED/);
  await run("saveAdminRoom('room-1',{slug:'stable-address',name:'Updated'},true)");
  assert.equal(calls.at(-2)[0],'update');
  assert.equal('slug' in calls.at(-2)[1],false,'immutable address omitted from update');
  await run("saveAdminRoom('new-id',{slug:'new-room',name:'New'},false)");
  assert.equal(calls.at(-1)[1].id,'new-id');
  response={data:null,error:{code:'23505'}};
  await assert.rejects(()=>run("saveAdminRoom('new-id',{},false)"),e=>e.code==='23505');
  response={data:null,error:null};
  await assert.rejects(()=>run("deleteAdminRoom('missing')"),/ROOM_NOT_FOUND/);
  assert.match(run("adminError({code:'23001'})"),/has bookings/);
  assert.match(run("adminError({code:'42501'})"),/Administrator access/);
  console.log('PASS: role check, signed-out denial, immutable address, create ID, write errors, missing delete, protected booking error. API responses mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
