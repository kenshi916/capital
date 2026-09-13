(() => {
  const wall = document.getElementById('home-company-wall');
  const control = document.getElementById('home-motion');
  const featureControl = document.getElementById('home-features-motion');
  const home = document.getElementById('view-home');
  const { opportunities, escapeHtml: esc } = window.MainstreetDirectory;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let paused = !!reducedMotion?.matches;
  const groups = [[], [], []];
  opportunities.forEach((company, index) => groups[index % 3].push(company));
  const card = (company, duplicate) => `<button class="home-company" type="button" data-opportunity="${esc(company.id)}" aria-label="Explore ${esc(company.name)}"${duplicate ? ' tabindex="-1"' : ''}><img src="${esc(company.image)}" alt="" width="220" height="144" decoding="async" style="object-fit:${company.imageFit || 'cover'};object-position:${company.imagePosition || 'center'}"><span class="home-company-name">${esc(company.name)}<span aria-hidden="true">↗</span></span></button>`;
  wall.innerHTML = groups.map((companies, index) => `<div class="company-lane lane-${index + 1}"><div class="company-track"><div class="company-track-set">${companies.map(c => card(c, false)).join('')}</div><div class="company-track-set" aria-hidden="true">${companies.map(c => card(c, true)).join('')}</div></div></div>`).join('');
  const featured=['miso-robotics','animoca-brands','atombeam','greenfield-robotics','chatrx'].map(id=>opportunities.find(c=>c.id===id)).filter(Boolean);
  const featureChip=c=>`<span class="discovery-chip"><img src="${esc(c.image)}" alt="" width="46" height="46" loading="lazy" style="object-fit:${c.imageFit||'cover'};object-position:${c.imagePosition||'center'}"><span><strong>${esc(c.name)}</strong><small>${esc(c.category)}</small></span></span>`;
  document.getElementById('feature-company-track').innerHTML=[0,1].map(()=>`<div class="discovery-set">${featured.map(featureChip).join('')}</div>`).join('');
  document.getElementById('feature-shortlist-rows').innerHTML=featured.slice(0,3).map((c,i)=>`<div class="shortlist-row feature-animated" style="--row:${i}"><img src="${esc(c.image)}" alt="" width="30" height="30" loading="lazy"><strong>${esc(c.name)}</strong><span>↗</span></div>`).join('');
  function update() {
    wall.dataset.paused = String(paused);
    home.dataset.motionPaused = String(paused);
    [control,featureControl].forEach(button=>{
      button.setAttribute('aria-pressed', String(paused));
      button.querySelector('span').textContent = paused ? 'Play animations' : 'Pause animations';
      button.querySelector('path').setAttribute('d', paused ? 'M7 4l8 6-8 6Z' : 'M7 5v10M13 5v10');
    });
  }
  [control,featureControl].forEach(button=>button.addEventListener('click', () => { paused = !paused; update(); }));
  reducedMotion?.addEventListener?.('change', event => { paused = event.matches; update(); });
  // Keyboard users get a stationary, scrollable list of the original companies.
  wall.addEventListener('focusin', event => {
    if (!event.target.matches(':focus-visible')) return;
    paused = true; update();
    event.target.closest('.home-company')?.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
  });
  update();
  const features=document.getElementById('capital-features');
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{features.dataset.inView=String(entries[0].isIntersecting);},{rootMargin:'100px'});observer.observe(features);}
})();
