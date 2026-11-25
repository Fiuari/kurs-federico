// Run: node tests/dialogs.test.cjs [path-to-jsdom-package]
// DOM integration tests with mocked API/auth; no live bookings are created.
const {JSDOM} = require(process.argv[2] || 'jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(setImmediate);
async function settle() { for (let i=0;i<8;i++) await tick(); }
const key = 'bankhotel.booking.form';
const paymentKey = 'bankhotel.booking.checkout';
const rooms = [{id:'room-a',slug:'cozy-single',name:'Cozy Single',description:'Room A',price_per_night:2400,image_file:'a.png',image_alt:'Room'},
  {id:'room-b',slug:'deluxe-double',name:'Deluxe Double',description:'Room B',price_per_night:4100,image_file:'b.png',image_alt:'Room'}];
async function page({storage=new Map(), user={id:'a',user_metadata:{full_name:'Guest'}}, saved=null, occupancy=[], blocked=false, url='booking.html?room=cozy-single', inventoryError=false}={}) {
  const dom = new JSDOM(read('booking.html'), {url:'https://example.test/'+url,runScripts:'outside-only'});
  const w=dom.window,d=w.document, writes=[];
  const state={user,saved,occupancy,inventoryError,gate:null};
  Object.defineProperty(w,'sessionStorage',{value:{getItem:k=>storage.get(k)||null,
    setItem(k,v){if(blocked)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;setImmediate(()=>this.dispatchEvent(new w.Event('close')));};
  d.querySelectorAll('dialog').forEach(el=>{el.getBoundingClientRect=()=>({left:100,top:100,right:500,bottom:500});});
  w.loadRooms=async()=>{if(state.inventoryError)throw Error('offline');return rooms;};
  w.getHotelClient=()=>({auth:{getUser:async()=>({data:{user:state.user},error:null})}});
  w.accountUrl=()=>new URL('https://example.test/auth.html');
  w.apiRequest=async(route,options={})=>{
    if(route==='/availability')return state.occupancy;
    if(route.startsWith('/bookings/'))return state.saved;
    if(state.gate)await state.gate;
    const p=options.body;
    const record={id:p.p_id,guest_name:p.p_guest_name,check_in:p.p_check_in,check_out:p.p_check_out,
      arrival_time:p.p_arrival_time,departure_time:p.p_departure_time,total_amount:2400};
    writes.push(record);return record;
  };
  w.eval(['booking-common','dialogs','booking'].map(n=>read('assets/js/'+n+'.js')).join('\n'));
  await settle();
  return {w,d,state,storage,writes,close:()=>w.close(),modal:d.getElementById('booking-dialog'),
    async start(){d.getElementById('start').click();await settle();},
    input(id,value){const el=d.getElementById(id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));},
    submit(){d.getElementById('reservation').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));},
    gesture(el,start,end=start){el.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:start,clientY:start}));el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,button:0,clientX:end,clientY:end}));}
  };
}
(async()=>{
  const initial=await page();assert.equal(initial.modal.open,false);
  await initial.start();assert.equal(initial.modal.open,true);
  initial.input('guest','My draft guest');
  initial.gesture(initial.modal,150);assert.equal(initial.modal.open,true,'dialog padding is not backdrop');
  initial.gesture(initial.modal,150,10);assert.equal(initial.modal.open,true,'drag out keeps form');
  const restored=await page({storage:new Map(initial.storage)});
  assert.equal(restored.modal.open,true,'reload restores open state');
  assert.equal(restored.d.getElementById('guest').value,'My draft guest');
  assert.equal(restored.writes.length,0,'reload never submits');
  restored.gesture(restored.modal,10);await settle();assert.equal(restored.modal.open,false);
  assert.equal(JSON.parse(restored.storage.get(key)).open,false);
  const closed=await page({storage:new Map(restored.storage)});
  assert.equal(closed.modal.open,false,'closed stays closed after reload');
  await closed.start();assert.equal(closed.d.getElementById('guest').value,'My draft guest');
  closed.d.querySelector('#booking-dialog .close').click();await settle();
  assert.equal(JSON.parse(closed.storage.get(key)).open,false,'close button persists');
  const other=await page({storage:new Map(initial.storage),user:{id:'other'}});
  assert.equal(other.modal.open,false);assert.equal(other.storage.has(key),false,'other account cannot restore personal draft');
  const newRoom=await page({storage:new Map(initial.storage),url:'booking.html?room=deluxe-double'});
  assert.equal(newRoom.modal.open,false);assert.equal(newRoom.d.getElementById('room').value,'deluxe-double');
  const stale=JSON.parse(initial.storage.get(key));stale.stay.arrival='2020-01-01';stale.stay.departure='2020-01-03';
  const changed=await page({storage:new Map([[key,JSON.stringify(stale)]])});
  assert.match(changed.d.getElementById('form-message').textContent,/Availability has changed/);
  assert.notEqual(changed.d.getElementById('arrival').value,'2020-01-01');
  const success=await page();await success.start();
  let release;success.state.gate=new Promise(resolve=>{release=resolve;});
  success.submit();await settle();success.gesture(success.modal,10);
  assert.equal(success.modal.open,true,'cannot dismiss pending write');
  const cancel=new success.w.Event('cancel',{cancelable:true});success.modal.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented,true,'Escape is blocked while saving');
  release();await settle();assert.equal(success.writes.length,1);
  assert.equal(success.storage.has(key),false,'successful booking clears draft');
  assert.equal(success.modal.open,false);
  const confirmation=success.d.getElementById('confirmation');assert.equal(confirmation.open,true);
  success.gesture(confirmation,10);assert.equal(confirmation.open,false);
  const interruptedStorage=new Map(initial.storage);
  interruptedStorage.set(paymentKey,JSON.stringify({userId:'a',id:'already-saved'}));
  const interrupted=await page({storage:interruptedStorage,saved:{id:'already-saved'}});
  assert.equal(interrupted.modal.open,false);assert.equal(interrupted.storage.has(key),false);
  assert.equal(interrupted.writes.length,0,'saved request never resubmitted on reload');
  initial.w.document.dispatchEvent(new initial.w.CustomEvent('hotel-auth-change',{detail:{event:'SIGNED_OUT',session:null}}));
  await settle();assert.equal(initial.modal.open,false);assert.equal(initial.storage.has(key),false);
  const noStorage=await page({blocked:true});await noStorage.start();assert.equal(noStorage.modal.open,true);
  const malformed=await page({storage:new Map([[key,'broken json']])});assert.equal(malformed.modal.open,false);
  const retry=await page({storage:new Map(restored.storage),inventoryError:true});
  assert.equal(retry.d.getElementById('retry-booking').hidden,false);
  retry.state.inventoryError=false;retry.d.getElementById('retry-booking').click();await settle();
  assert.equal(retry.d.getElementById('guest').value,'My draft guest');
  // Simulate Back restoring an old open document after successful demo payment.
  await restored.start();restored.storage.delete(key);
  const backEvent=new restored.w.Event('pageshow');Object.defineProperty(backEvent,'persisted',{value:true});
  restored.w.dispatchEvent(backEvent);await settle();
  assert.equal(restored.modal.open,false);assert.equal(restored.d.getElementById('guest').value,'');
  for(const instance of [initial,restored,closed,other,newRoom,changed,success,interrupted,noStorage,malformed,retry])instance.close();
  console.log('PASS: backdrop/padding/drag, close button, busy/Escape guard, open/closed reload, draft/account isolation, stale dates, successful/interrupted booking, storage failure, retry and Back after payment. API mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
