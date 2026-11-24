const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('browser sends data through API, attaching tokens only for authenticated routes',async()=>{
 let session={access_token:'test-token'};let response={ok:true,status:200,json:async()=>[]};const calls=[];
 const context=vm.createContext({HOTEL_API_URL:'https://api.example.test',AbortController,setTimeout,clearTimeout,
  window:{supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session},error:null})}})}},
  fetch:async(...args)=>{calls.push(args);return response;}
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../assets/js/supabase-client.js'),'utf8'),context);
 await vm.runInContext('loadRooms()',context);
 assert.equal(calls[0][0],'https://api.example.test/api/rooms');assert.equal(calls[0][1].headers.Authorization,undefined);
 await vm.runInContext('apiRequest("/bookings",{method:"POST",body:{p_id:"id"},authenticated:true})',context);
 assert.equal(calls[1][1].headers.Authorization,'Bearer test-token');
 assert.equal(calls[1][1].body,'{"p_id":"id"}');
 session=null;await assert.rejects(()=>vm.runInContext('apiRequest("/me/admin",{authenticated:true})',context),/SIGN_IN_REQUIRED/);
 assert.equal(calls.length,2);
 response={ok:false,status:409,json:async()=>({error:{code:'23P01',message:'23P01'}})};
 await assert.rejects(()=>vm.runInContext('loadRooms()',context),e=>e.code==='23P01'&&e.status===409);
});
