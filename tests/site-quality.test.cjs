const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const css = require('css-tree');
const root = path.join(__dirname, '..');
const pages = ['', 'rooms', 'facilities'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => path.join(dir,f)));
const docs = new Map(pages.map(file => [file, new JSDOM(fs.readFileSync(path.join(root,file),'utf8')).window.document]));
const titles = new Set();
for (const [file, doc] of docs) {
  assert(doc.title.trim(), file+' title');
  assert(!titles.has(doc.title), file+' unique title'); titles.add(doc.title);
  assert(doc.querySelector('meta[name="description"]')?.content.trim(), file+' description');
  assert.equal([...doc.querySelectorAll('h1')].filter(el=>!el.closest('[hidden]')).length, 1, file+' one h1');
  assert(!doc.querySelector('[style]'), file+' no inline styles');
  assert.equal(doc.querySelectorAll('[id]').length, new Set([...doc.querySelectorAll('[id]')].map(e=>e.id)).size, file+' unique IDs');
  for (const el of doc.querySelectorAll('[src],link[href],a[href]')) {
    const ref = el.getAttribute('src') || el.getAttribute('href');
    if (!ref || /^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
    const [local, hash] = ref.split('#');
    const url = new URL(ref, 'https://example.test/kurs-federico/'+file.replaceAll('\\','/'));
    const target = path.normalize(decodeURIComponent(url.pathname.replace(/^\/kurs-federico\//,'')) || 'index.html');
    assert(fs.existsSync(path.join(root,target)), file+' missing '+ref);
    if (hash && target.endsWith('.html')) assert(docs.get(target)?.getElementById(decodeURIComponent(hash)), file+' missing anchor '+ref);
    if(el.tagName==='A') assert(!ref.includes('404.html'),file+' placeholder navigation '+ref);
  }
}
for(const file of fs.readdirSync(path.join(root,'assets/css')).filter(f=>f.endsWith('.css'))) {
  const source=fs.readFileSync(path.join(root,'assets/css',file),'utf8');
  css.parse(source,{onParseError(error){throw new Error(file+': '+error.message);}});
}
// Menu keyboard and outside-click behavior without network or user data.
const dom=new JSDOM(fs.readFileSync(path.join(root,'auth.html'),'utf8'),{runScripts:'outside-only'});
dom.window.eval(fs.readFileSync(path.join(root,'assets/js/site.js'),'utf8'));
const d=dom.window.document, button=d.querySelector('.nav-toggle');
button.click(); assert.equal(button.getAttribute('aria-expanded'),'true');
d.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(d.activeElement,button);
button.click(); d.querySelector('main').click();assert.equal(button.getAttribute('aria-expanded'),'false');
button.click();d.querySelector('.room-nav a').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));assert.equal(button.getAttribute('aria-expanded'),'false');
dom.window.close();
console.log(pages.length+' pages: metadata, local assets/anchors, CSS syntax and mobile menu passed.');
