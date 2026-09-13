(() => {
  const root=document.getElementById('view-docs');
  const pages=[...root.querySelectorAll('[data-doc-page]')];
  const links=[...root.querySelectorAll('[data-doc-link]')];
  const titles=Object.fromEntries(links.map(link=>[link.dataset.docLink,link.textContent.replace(/^\d+/, '').trim()]));
  let current=null;
  function render(){
    const route=location.hash.slice(1);
    if(route!=='docs'&&!route.startsWith('docs/'))return;
    const requested=route.split('/')[1]||'overview';
    const selected=pages.some(page=>page.dataset.docPage===requested)?requested:'overview';
    pages.forEach(page=>page.hidden=page.dataset.docPage!==selected);
    links.forEach(link=>{const active=link.dataset.docLink===selected;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    const index=pages.findIndex(page=>page.dataset.docPage===selected);
    const neighbors=[index-1,index+1].map((i,side)=>{if(!pages[i])return '<span></span>';const id=pages[i].dataset.docPage;return `<a href="#docs/${id}" class="docs-page-${side?'next':'previous'}"><span>${side?'Next chapter':'Previous chapter'}</span><strong>${titles[id]} <span aria-hidden="true">${side?'→':'←'}</span></strong></a>`;});
    document.getElementById('docs-pagination').innerHTML=neighbors.join('');
    document.title=`${titles[selected]} · Docs — Capital`;
    if(current!==null&&current!==selected){window.scrollTo({top:0,behavior:'auto'});pages[index].querySelector('h1').focus({preventScroll:true});}
    if(window.matchMedia?.('(max-width:800px)').matches) links.find(link=>link.dataset.docLink===selected)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    current=selected;
  }
  window.addEventListener('hashchange',render);
  render();
})();
