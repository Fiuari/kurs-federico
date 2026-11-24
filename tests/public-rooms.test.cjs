const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.argv[2] || path.join(__dirname,'..');
const calls=[];
let response={data:null,error:null};
const query={select(){return this;},eq(key,value){calls.push([key,value]);return this;},maybeSingle(){return this;},abortSignal:async()=>response};
const context=vm.createContext({
  URL,Intl,AbortController,setTimeout,clearTimeout,
  document:{currentScript:{src:'https://example.test/kurs-federico/assets/js/rooms-public.js'}},
  apiRequest:async route=>{calls.push(route);if(response.error)throw response.error;return response.data;}
});
vm.runInContext(fs.readFileSync(path.join(root,'assets/js/rooms-public.js'),'utf8'),context);
const run=code=>vm.runInContext(code,context);
(async()=>{
  assert.equal(run("roomPageUrl('new-suite')"),'https://example.test/kurs-federico/room.html?room=new-suite');
  assert.equal(run("roomBookingUrl('new-suite')"),'https://example.test/kurs-federico/booking.html?room=new-suite');
  assert.match(run("roomImageUrl('../secret.svg')"),/\/assets\/img\/hero.png$/);
  assert.match(run("roomImageUrl('roomfourmain.jpg')"),/\/assets\/img\/roomfourmain.jpg$/);
  const rooms=[{name:'Cozy',description:'Garden view',price_per_night:2400},{name:'Deluxe',description:'City view',price_per_night:4100},{name:'Twin',description:'Garden view',price_per_night:3200}];
  context.testRooms=rooms;
  assert.equal(run("selectPublicRooms(testRooms,' GARDEN ','price-desc').map(r=>r.name).join(',')"),'Twin,Cozy');
  assert.equal(run("selectPublicRooms(testRooms,'','price-asc').map(r=>r.name).join(',')"),'Cozy,Twin,Deluxe');
  assert.equal(run("selectPublicRooms(testRooms,'missing','price-asc').length"),0);
  assert.equal(rooms[0].name,'Cozy','sorting does not mutate source');
  await run("loadPublicRoom('new-suite')");
  assert.deepEqual(calls,['/rooms/new-suite'],'details are read through Express API');
  assert.equal(await run("loadPublicRoom('../../etc')"),null);
  assert.equal(calls.length,1,'invalid slug never queries database');
  response={data:null,error:{code:'offline'}};
  await assert.rejects(()=>run("loadPublicRoom('new-suite')"),e=>e.code==='offline');
  response={data:{slug:'new-suite',name:'Updated name'},error:null};
  assert.equal((await run("loadPublicRoom('new-suite')")).name,'Updated name');
  console.log('PASS: GitHub Pages URLs, safe images, search, both sort orders, empty results, active-only detail, invalid slug, network failure and current database content.');
})().catch(e=>{console.error(e);process.exitCode=1;});
