// Run: node tests/i18n.test.cjs [path-to-jsdom-package]
// DOM tests only: no real browser, network requests or database writes.
const {JSDOM} = require(process.argv[2] || 'jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[3] || path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const tick = () => new Promise(resolve=>setImmediate(resolve));
async function page(name, stored, blockStorage=false) {
  const dom=new JSDOM(read(name),{url:'https://fiuari.github.io/kurs-federico/'+name,runScripts:'outside-only'});
  const w=dom.window;
  if(stored)w.sessionStorage.setItem('bankhotel.language',stored);
  if(blockStorage)Object.defineProperty(w,'sessionStorage',{get(){throw new Error('Storage blocked');}});
  w.eval(read('assets/js/translations-uk.js'));
  w.eval(read('assets/js/i18n.js'));
  await tick();
  return dom;
}
(async()=>{
  const pages=['index.html','auth.html','admin.html','booking.html','payment.html','room.html','rooms/superior-twin.html','rooms/cozy-single.html','rooms/deluxe-double.html','rooms/presidential-suite.html','facilities/restaurant.html','facilities/conference-hall.html','facilities/wine-bar.html','404.html'];
  for(const name of pages){
    const dom=await page(name),w=dom.window,d=w.document;
    assert.equal(d.querySelectorAll('[data-language-switch]').length,1,name+' switch');
    const textBefore=d.body.textContent,titleBefore=d.title;
    const links=[...d.querySelectorAll('a')].map(a=>a.href);
    const fields=[...d.querySelectorAll('input,select,textarea')].filter(e=>!e.closest('[data-language-switch]'));
    const values=fields.map(e=>e.value);
    w.HotelI18n.setLanguage('uk');await tick();
    assert.equal(d.documentElement.lang,'uk');
    assert.equal(w.sessionStorage.getItem('bankhotel.language'),'uk');
    assert.deepEqual([...d.querySelectorAll('a')].map(a=>a.href),links,name+' links unchanged');
    assert.deepEqual(fields.map(e=>e.value),values,name+' form values unchanged');
    assert.notEqual(d.body.textContent,textBefore,name+' translated');
    w.HotelI18n.setLanguage('en');await tick();
    assert.equal(d.body.textContent,textBefore,name+' exact English restoration');
    assert.equal(d.title,titleBefore,name+' title restored');
    dom.window.close();
  }
  const dom=await page('booking.html','uk'),w=dom.window,d=w.document;
  assert.equal(d.documentElement.lang,'uk','restored session before page setup');
  const guest=d.getElementById('guest');guest.value='English Guest';
  const room=d.getElementById('room');room.append(new w.Option('Cozy Single','cozy-single'));room.value='cozy-single';
  const date=d.getElementById('arrival');date.append(new w.Option('25 Nov 2026','2026-11-25'));
  d.getElementById('breakdown').textContent='2 nights × UAH 2,400.00';
  d.getElementById('booking-status').textContent='Loading rooms and availability…';
  const receipt=d.querySelector('.receipt');
  const raw='Cozy Single · English Guest\n25 Nov 2026, 14:00 → 27 Nov 2026, 10:00\nDue at reception · UAH 4,800.00\nBooking reference: guest-id-123';
  receipt.textContent=raw;
  await tick();
  assert.equal(room.options[0].textContent,'Затишний одномісний номер');
  assert.match(date.options[0].textContent,/лист/);
  assert.match(d.getElementById('breakdown').textContent,/2 ночі/);
  assert.match(d.getElementById('booking-status').textContent,/Перевіряємо/);
  assert.equal(w.HotelI18n.originalText(receipt),raw,'receipt source remains English');
  assert.match(receipt.textContent,/English Guest/);
  assert.match(receipt.textContent,/guest-id-123/);
  const first=d.getElementById('booking-status');first.firstChild.data='No dates available';
  const img=d.getElementById('room-photo');img.alt='Deluxe Double interior';
  await tick();assert.equal(first.textContent,'Немає доступних дат');assert.match(img.alt,/Інтер’єр/);
  guest.setCustomValidity(w.HotelI18n.t('Enter the guest’s full name.'));
  w.HotelI18n.setLanguage('en');await tick();
  assert.equal(guest.validationMessage,'Enter the guest’s full name.');
  assert.equal(guest.value,'English Guest');assert.equal(room.value,'cozy-single');assert.equal(date.value,'2026-11-25');
  assert.equal(receipt.textContent,raw);assert.equal(first.textContent,'No dates available');
  w.HotelI18n.setLanguage('uk');
  assert.equal(w.HotelI18n.t('Delete “Cozy Single”?'),'Видалити «Затишний одномісний номер»?');
  assert.equal(w.HotelI18n.searchText(null),' ');
  assert.equal(w.HotelI18n.t('21 rooms found'),'Знайдено 21 номер');
  assert.equal(w.HotelI18n.t('4 rooms found'),'Знайдено 4 номери');
  assert.equal(w.HotelI18n.t('11 rooms found'),'Знайдено 11 номерів');
  assert.equal(w.HotelI18n.t('A newly added custom room'),'A newly added custom room');
  assert.equal(w.HotelI18n.t('<img src=x onerror=alert(1)>'),'<img src=x onerror=alert(1)>');
  d.getElementById('room-description').textContent='<img src=x onerror=alert(1)>';
  await tick();assert.equal(d.getElementById('room-description').children.length,0,'never interprets HTML');
  const nextPage=await page('room.html',w.sessionStorage.getItem('bankhotel.language'));
  assert.equal(nextPage.window.document.documentElement.lang,'uk','same session on next page');nextPage.window.close();w.close();
  const search=await page('index.html'),sw=search.window;
  Object.defineProperty(sw.document,'currentScript',{value:{src:'https://fiuari.github.io/kurs-federico/assets/js/rooms-public.js'},configurable:true});
  sw.eval(read('assets/js/rooms-public.js'));
  const sample=[{name:'Presidential Suite',description:'A suite',price_per_night:7800},{name:'Cozy Single',description:'A small room',price_per_night:2400}];
  for(const lang of ['en','uk']) {
    sw.HotelI18n.setLanguage(lang);
    assert.equal(sw.selectPublicRooms(sample,'Президентський','price-asc')[0].name,'Presidential Suite');
    assert.equal(sw.selectPublicRooms(sample,'Cozy','price-asc')[0].name,'Cozy Single');
  }
  sw.close();
  const fresh=await page('index.html');assert.equal(fresh.window.document.documentElement.lang,'en','new session English');fresh.window.close();
  const blocked=await page('index.html',null,true);blocked.window.HotelI18n.setLanguage('uk');assert.equal(blocked.window.document.documentElement.lang,'uk','storage failure is handled');blocked.window.close();
  console.log('PASS: 14 pages, EN↔UK round trips, saved/new/blocked session, dynamic text and attributes, dates/prices/plurals, unchanged form values/links, custom validation, receipts and safe text rendering.');
})().catch(error=>{console.error(error);process.exitCode=1;});
