// Shared navigation for inner pages. Without JavaScript, links stay visible.
(() => {
  const header = document.querySelector('.masthead');
  const nav = header?.querySelector('.room-nav');
  if (!nav) return;
  nav.id = 'page-navigation';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Menu');
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span>';
  header.insertBefore(toggle, nav);
  header.classList.add('nav-ready');
  function close() { header.classList.remove('nav-open'); toggle.setAttribute('aria-expanded','false'); }
  toggle.addEventListener('click', () => {
    const open = !header.classList.contains('nav-open');
    header.classList.toggle('nav-open',open); toggle.setAttribute('aria-expanded',String(open));
  });
  nav.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  document.addEventListener('click',event=>{if(!header.contains(event.target))close();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && header.classList.contains('nav-open')) {close();toggle.focus();}
  });
})();
