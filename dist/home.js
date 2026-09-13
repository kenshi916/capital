(() => {
  const wall = document.getElementById('home-company-wall');
  const control = document.getElementById('home-motion');
  const { opportunities, escapeHtml: esc } = window.MainstreetDirectory;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let paused = !!reducedMotion?.matches;
  const groups = [[], [], []];
  opportunities.forEach((company, index) => groups[index % 3].push(company));
  const card = (company, duplicate) => `<button class="home-company" type="button" data-opportunity="${esc(company.id)}" aria-label="Explore ${esc(company.name)}"${duplicate ? ' tabindex="-1"' : ''}><img src="${esc(company.image)}" alt="" width="220" height="144" decoding="async" style="object-fit:${company.imageFit || 'cover'};object-position:${company.imagePosition || 'center'}"><span class="home-company-name">${esc(company.name)}<span aria-hidden="true">↗</span></span></button>`;
  wall.innerHTML = groups.map((companies, index) => `<div class="company-lane lane-${index + 1}"><div class="company-track"><div class="company-track-set">${companies.map(c => card(c, false)).join('')}</div><div class="company-track-set" aria-hidden="true">${companies.map(c => card(c, true)).join('')}</div></div></div>`).join('');
  function update() {
    wall.dataset.paused = String(paused);
    control.setAttribute('aria-pressed', String(paused));
    control.querySelector('span').textContent = paused ? 'Play animation' : 'Pause animation';
    control.querySelector('path').setAttribute('d', paused ? 'M7 4l8 6-8 6Z' : 'M7 5v10M13 5v10');
  }
  control.addEventListener('click', () => { paused = !paused; update(); });
  reducedMotion?.addEventListener?.('change', event => { paused = event.matches; update(); });
  // Keyboard users get a stationary, scrollable list of the original companies.
  wall.addEventListener('focusin', event => {
    if (!event.target.matches(':focus-visible')) return;
    paused = true; update();
    event.target.closest('.home-company')?.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
  });
  update();
})();
