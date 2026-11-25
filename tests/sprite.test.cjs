// Run: node tests/sprite.test.cjs [path-to-jsdom-package]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM} = require(process.argv[2] || 'jsdom');
const root = path.join(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const map = JSON.parse(read('assets/img/icons/sprite-map.json'));
const svg = read('assets/img/icons/sprite.svg');
const css = read('assets/css/sprite.css');
const pngs = [...svg.matchAll(/href="data:image\/png;base64,([^"]+)"/g)];
const sources = map.icons.filter(i=>i.file);
assert.equal(pngs.length,6);
sources.forEach((entry,index)=>{
  assert.deepEqual(Buffer.from(pngs[index][1],'base64'),fs.readFileSync(path.join(root,'assets/img/icons',entry.file)),entry.file+' preserved byte-for-byte');
});
for(const entry of map.icons) {
  assert.ok(entry.x>=8 && entry.y>=8 && entry.x+entry.width<=map.width-8 && entry.y+entry.height<=map.height-8);
  assert.ok(css.includes('.sprite-'+entry.name+' '));
  for(const other of map.icons) if(other!==entry) {
    assert.ok(entry.x+entry.width<=other.x || other.x+other.width<=entry.x || entry.y+entry.height<=other.y || other.y+other.height<=entry.y,'sprite cells do not overlap');
  }
}
const pages=['index.html','room.html',...fs.readdirSync(path.join(root,'rooms')).map(f=>'rooms/'+f),...fs.readdirSync(path.join(root,'facilities')).map(f=>'facilities/'+f)];
for(const page of pages) {
  const dom=new JSDOM(read(page)),d=dom.window.document;
  const link=d.querySelector('link[href$="/sprite.css"]');assert.ok(link,page+' includes sprite CSS');
  assert.ok(fs.existsSync(path.resolve(root,path.dirname(page),link.getAttribute('href'))));
  assert.equal(d.querySelectorAll('img[src*="icons/"]:not([src$="wave.png"])').length,0,page+' does not request individual icons');
  d.querySelectorAll('.sprite').forEach(e=>assert.equal(e.getAttribute('aria-hidden'),'true'));
  dom.window.close();
}
for(const file of ['home.css','room.css','facility.css'])assert.doesNotMatch(read('assets/css/'+file),/icons\/(?:Star|Starbig|flower|down|up|right)\.png/);
const tick=()=>new Promise(setImmediate);
(async()=>{
  const dom=new JSDOM(read('index.html'),{url:'https://fiuari.github.io/kurs-federico/',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  Object.defineProperty(d,'currentScript',{value:{src:'https://fiuari.github.io/kurs-federico/assets/js/rooms-public.js'},configurable:true});
  const sample=[{slug:'new-room',name:'New room',description:'Newly added',price_per_night:1000,image_file:'hero.png',image_alt:'Room'},
    {slug:'second-room',name:'Second room',description:'Another room',price_per_night:2000,image_file:'hero.png',image_alt:'Room'}];
  w.loadRooms=async()=>sample;
  w.eval(read('assets/js/rooms-public.js')+'\n'+read('assets/js/home-rooms.js'));
  await tick();
  assert.equal(d.querySelector('#room-slider .sprite-star')?.getAttribute('aria-hidden'),'true');
  assert.ok(d.querySelector('#room-slider .sprite-decagon-gold'));
  assert.equal(d.querySelector('#room-slider [data-book-room]').href,'https://fiuari.github.io/kurs-federico/booking.html?room=new-room');
  for(const id of ['previous-room','next-room']) {
    assert.ok(d.getElementById(id).querySelector('.sprite-right'));
    assert.equal(d.getElementById(id).textContent.trim(),'','slider uses original image, not a text arrow');
  }
  d.getElementById('next-room').click();
  assert.equal(d.querySelector('.room-title-link').textContent,'Second room');
  assert.ok(d.querySelector('#room-slider .sprite-decagon-gold'));
  assert.ok(d.querySelector('.octagon .sprite-octagon-outline'));
  assert.ok(d.querySelector('.double-poly .sprite-decagon-outline'));
  assert.ok(d.querySelector('.double-poly .sprite-down'));
  assert.equal(d.querySelectorAll('.accordion-toggle .sprite-right').length,3);
  dom.window.close();
  console.log('PASS: six PNGs preserved byte-for-byte, vector polygon variants, non-overlapping atlas, nested paths, generated pages and dynamic room cards/slider. API mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
