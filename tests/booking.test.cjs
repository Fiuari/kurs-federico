const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = require('node:path').join(__dirname, '../assets/js');
const code = name => fs.readFileSync(root + '/' + name + '.js', 'utf8');
const flush = () => new Promise(setImmediate);

function scenario({ user = {id:'user-a',user_metadata:{full_name:'Guest'}}, fail = false, saved = null, storage = new Map() } = {}) {
  const nodes = new Map(), calls = [], events = {}, windowEvents = {};
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value:'', textContent:'', disabled:false, hidden:false, open:false, listeners:{},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      replaceChildren(...options) { this.value = options[0]?.value || ''; },
      querySelector(sel) { return node(id + sel); },
      querySelectorAll() { return ['room','arrival','departure','arrival-time','departure-time','guest'].map(node); },
      showModal() { this.open = true; }, close() { this.open = false; },
      setCustomValidity(text) { this.validity = text; }, reportValidity() {}
    });
    return nodes.get(id);
  }
  node('reservation').elements = {payment:{value:'desk'}};
  const rows = [{id:'room-a',slug:'cozy-single',name:'Cozy Single',price_per_night:2400,image_file:'a.jpg'}, {id:'room-b',slug:'deluxe-double',name:'Deluxe',price_per_night:4100,image_file:'b.jpg'}];
  const state = {user,fail,saved,occupancy:[],writes:[]};
  const response = fn => ({ single() { calls.push('single'); return this; }, abortSignal:async () => fn() });
  const client = {
    auth:{getUser:async()=>({data:{user:state.user},error:null})},
    rpc(name,args) {
      calls.push({name,args});
      return response(() => {
        if (name === 'room_availability') return {data:state.occupancy,error:null};
        if (state.fail) return {data:null,error:{message:'Network failed'}};
        const record = {id:args.p_id, user_id:state.user.id, guest_name:args.p_guest_name,
          room_id:args.p_room_id,check_in:args.p_check_in, check_out:args.p_check_out,
          arrival_time:args.p_arrival_time,departure_time:args.p_departure_time,
          total_amount:2400,payment_method:args.p_payment_method,demo_paid:args.p_payment_method==='online'};
        state.writes.push(record); return {data:record,error:null};
      });
    },
    from() { return {select() { return this; }, eq() { return this; }, maybeSingle() { return response(()=>({data:state.saved,error:null})); }}; }
  };
  const context = vm.createContext({
    Intl, Date, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, crypto:{randomUUID},
    document:{getElementById:node,addEventListener:(name,fn)=>events[name]=fn},
    window:{addEventListener:(name,fn)=>windowEvents[name]=fn},
    Option:function(label,value) { this.value=value; },
    location:{search:'?room=cozy-single',assign:url=>calls.push({redirect:url})},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val),removeItem:key=>storage.delete(key)},
    loadRooms:async()=>rows,getHotelClient:()=>client,
    apiRequest:async(route,options={})=>{
      if(route==='/availability')return state.occupancy;
      if(route.startsWith('/bookings/'))return state.saved;
      const result=await client.rpc('create_booking',options.body).single().abortSignal();
      if(result.error)throw result.error;return result.data;
    },
    accountUrl:()=>new URL('https://example.test/auth.html?next=booking')
  });
  vm.runInContext(code('booking-common'),context);
  const run = source => vm.runInContext(source, context);
  return {node,calls,state,run,context,events,windowEvents,storage,submit:()=>node('reservation').listeners.submit({preventDefault(){}})};
}
(async()=>{
  const common=scenario(); await common.run('loadInventory()');
  const days=common.run('calendarDays()');
  assert.equal(days.length,31);
  common.state.occupancy=[{room_id:'room-a',check_in:days[2],check_out:days[4]}];
  await common.run('loadInventory()');
  assert.equal(common.run(`departureDates('cozy-single','${days[0]}',calendarDays()).length`),2,'checkout on blocked arrival date allowed');
  assert.equal(common.run(`departureDates('cozy-single','${days[2]}',calendarDays()).length`),0,'cannot start during occupied stay');
  assert.equal(common.run(`nightTaken('cozy-single','${days[4]}')`),false,'check-out day available');
  assert.equal(common.run(`nightTaken('deluxe-double','${days[2]}')`),false,'other room unaffected');
  const desk=scenario({fail:true}); desk.run(code('booking')); await flush();
  await desk.node('start').listeners.click();
  await desk.submit();
  assert.equal(desk.node('confirmation').open,false,'no fake success on network error');
  const first=desk.calls.find(c=>c.name==='create_booking').args;
  assert.equal('p_user_id' in first,false,'owner is never supplied by browser');
  assert.equal('p_total_amount' in first,false,'total is never supplied by browser');
  desk.state.fail=false; await desk.submit();
  assert.equal(desk.state.writes[0].id,first.p_id,'retry reuses ID');
  assert.equal(desk.node('confirmation').open,true);
  assert.match(desk.node('confirmation.receipt').textContent,/Booking reference/);
  assert.ok(desk.calls.includes('single'),'RPC expects one booking');
  const guest=scenario({user:null}); guest.run(code('booking')); await flush(); await guest.node('start').listeners.click();
  assert.match(guest.calls.at(-1).redirect,/auth.html.*room=cozy-single/);
  assert.equal(guest.calls.some(c=>c.name==='create_booking'),false);
  const online=scenario(); online.run(code('booking')); await flush();
  await online.node('start').listeners.click(); online.node('reservation').elements.payment.value='online';
  await online.submit();
  assert.equal(online.calls.some(c=>c.name==='create_booking'),false,'online writes only on explicit demo Pay');
  assert.equal(online.calls.at(-1).redirect,'payment.html');
  const payment=scenario({storage:online.storage,fail:true}); payment.run(code('payment')); await payment.windowEvents.pageshow(); await flush();
  assert.equal(payment.node('pay').disabled,false);
  await payment.node('pay').listeners.click();
  assert.equal(payment.node('confirmation').open,false);
  payment.state.fail=false; await payment.node('pay').listeners.click();
  assert.equal(payment.state.writes.length,1);
  assert.equal(payment.state.writes[0].demo_paid,true);
  assert.equal(payment.node('confirmation').open,true);
  const changed=scenario({storage:online.storage,user:{id:'user-b'}}); changed.run(code('payment')); await changed.windowEvents.pageshow(); await flush();
  assert.equal(changed.node('pay').disabled,true,'different account cannot pay draft');
  assert.equal(changed.calls.some(c=>c.name==='create_booking'),false);
  payment.state.user={id:'user-b'};
  await assert.rejects(()=>payment.run('createBooking(readCheckout())'),/ACCOUNT_CHANGED/);
  const reload=scenario({storage:online.storage,saved:{...payment.state.writes[0],rooms:{name:'Cozy Single'}}});
  reload.run(code('payment')); await reload.windowEvents.pageshow(); await flush();
  assert.equal(reload.node('pay').disabled,true,'saved booking stays saved after reload');
  assert.match(reload.node('payment-summary').textContent,/Booking reference/);
  console.log('Passed: occupancy boundaries, room isolation, server-owned identity/total, failed write, retry ID, guest redirect, desk success, online draft/save/reload, account change. Supabase mocked; SQL not executed here.');
})().catch(error=>{console.error(error);process.exitCode=1;});
