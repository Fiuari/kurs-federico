const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../app');
const id='11111111-1111-4111-8111-111111111111';
test('API protects routes, validates writes and forwards per-user identity',async()=>{
  const calls=[];
  let dbError=null;
  const app=createApp({url:'https://example.invalid',key:'public',origins:['https://fiuari.github.io'],clientFactory:(url,key,options)=>{
    const token=options.global.headers.Authorization;
    return {auth:{getUser:async()=>({data:{user:token==='Bearer invalid'?null:{id:token}},error:null})},
      rpc:(name,args)=>{calls.push({name,args,token});return {single(){return this;},abortSignal:async()=>({data:name==='is_hotel_admin'?token==='Bearer admin':{id},error:dbError})};},
      from:table=>{const filters=[];let method='read',body;
        const q={select(){return this;},order(){return this;},eq(k,v){filters.push([k,v]);return this;},maybeSingle(){return this;},single(){return this;},
          insert(b){method='insert';body=b;return this;},update(b){method='update';body=b;return this;},delete(){method='delete';return this;},
          abortSignal:async()=>{calls.push({table,filters,method,body,token});return {data:method==='read'?[]:{id},error:dbError};}};return q;}
    };
  }});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const request=(path,token,method='GET',body)=>fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  try {
    assert.equal((await request('/health')).status,200);
    assert.equal((await request('/api/rooms')).status,200);
    assert.deepEqual(calls.at(-1).filters,[['is_active',true]]);
    assert.equal(calls.at(-1).token,undefined,'public query has no privileged token');
    assert.equal((await request('/api/admin/rooms')).status,401);
    assert.equal((await request('/api/admin/rooms','invalid')).status,401);
    assert.equal((await request('/api/admin/rooms','member')).status,403);
    assert.equal((await request('/api/admin/rooms','admin')).status,200);
    const room={id,slug:'test',name:'Test',description:'Test',price_per_night:10,image_file:'roomonemain.png',image_alt:'Room',is_active:true};
    assert.equal((await request('/api/admin/rooms','admin','POST',room)).status,201);
    assert.equal(calls.at(-1).token,'Bearer admin');
    assert.equal((await request('/api/admin/rooms','member','POST',room)).status,403);
    assert.equal((await request('/api/admin/rooms','admin','POST',{...room,price_per_night:-1})).status,400);
    const {id:unused,slug:unusedSlug,...editable}=room;
    assert.equal((await request('/api/admin/rooms/'+id,'admin','PATCH',editable)).status,200);
    assert.equal((await request('/api/admin/rooms/'+id,'admin','PATCH',{...editable,slug:'hacked'})).status,400);
    await request('/api/bookings/'+id,'alice');
    assert.deepEqual(calls.at(-1).filters,[['id',id],['user_id','Bearer alice']]);
    const booking={p_id:id,p_room_id:id,p_guest_name:'Guest',p_check_in:'2026-12-01',p_check_out:'2026-12-02',p_arrival_time:'14:00',p_departure_time:'12:00',p_payment_method:'desk',p_expected_rate:10};
    assert.equal((await request('/api/bookings','alice','POST',{...booking,user_id:'bob'})).status,400);
    assert.equal((await request('/api/bookings','alice','POST',booking)).status,201);
    assert.equal(calls.at(-1).name,'create_booking');assert.equal(calls.at(-1).token,'Bearer alice');
    dbError={code:'23P01',message:'sensitive database detail'};
    const conflict=await request('/api/bookings','alice','POST',booking);
    assert.equal(conflict.status,409);assert.equal((await conflict.json()).error.message,'23P01');
    dbError=null;
    assert.equal((await request('/api/admin/rooms/'+id,'admin','DELETE')).status,200);
    const cors=await fetch(base+'/api/rooms',{headers:{Origin:'https://fiuari.github.io'}});
    assert.equal(cors.headers.get('access-control-allow-origin'),'https://fiuari.github.io');
    assert.equal((await fetch(base+'/api/rooms',{headers:{Origin:'https://evil.invalid'}})).status,403);
    const bad=await fetch(base+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});
    assert.equal(bad.status,400);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
