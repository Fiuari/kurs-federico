const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2] || path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root,'assets/js/room-page.js'),'utf8');
async function scenario(result, error) {
  const elements=new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id,{textContent:'',hidden:false,content:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},querySelectorAll(selector){return selector==='[data-book-room]'?[element('booking-link')]:[element('room-image')];}});
    return elements.get(id);
  }
  const document={title:'',body:{dataset:{}},getElementById:element,querySelector:()=>element('meta'),addEventListener(){}};
  const context=vm.createContext({document,location:{search:'?room=new-garden-suite'},URLSearchParams,
    loadPublicRoom:async slug=>{assert.equal(slug,'new-garden-suite');if(error)throw error;return result;},
    publicRoomMoney:new Intl.NumberFormat('en-GB',{style:'currency',currency:'UAH'}),
    roomBookingUrl:slug=>'booking.html?room='+slug,setRoomImage:(image,room)=>{image.src=room.image_file;},window:{addEventListener(){}}
  });
  vm.runInContext(code,context);await new Promise(setImmediate);
  return {element,document};
}
(async()=>{
  const fresh=await scenario({slug:'new-garden-suite',name:'Garden <Suite>',description:'Updated description',price_per_night:2999,image_file:'roomtwomain.webp'});
  assert.equal(fresh.element('room-content').hidden,false);
  assert.equal(fresh.element('room-name').textContent,'Garden <Suite>','database text is not parsed as HTML');
  assert.equal(fresh.element('room-description').textContent,'Updated description');
  assert.match(fresh.element('room-nightly-rate').textContent,/2,999/);
  assert.equal(fresh.element('booking-link').href,'booking.html?room=new-garden-suite');
  const missing=await scenario(null);
  assert.equal(missing.element('room-content').hidden,true);
  assert.equal(missing.element('room-state-title').textContent,'Room unavailable');
  const offline=await scenario(null,new Error('offline'));
  assert.equal(offline.element('retry-room').hidden,false);
  assert.equal(offline.element('room-content').hidden,true);
  console.log('PASS: brand-new room without generated HTML, updated fields, safe text rendering, booking URL, missing/inactive room state and retryable network failure. Responses mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
