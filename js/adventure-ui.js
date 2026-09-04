/* ============================================================
   MACERA ARAYÜZÜ — dünya haritası ve bölge ilerleme yolu

   İki ekran var:

   1) DÜNYA HARİTASI (menuAdventure)
      Sanat canvas'ta (adventure-map.js), etkileşim DOM'da. Bölge
      tabelaları canvas'ın üstünde birer buton — böylece metin keskin
      kalıyor, dokunma hedefleri işletim sisteminin bildiği gerçek
      öğeler oluyor ve canvas üzerinde piksel avlamak gerekmiyor.

   2) BÖLGE YOLU (menuRegion)
      Bölümler aşağıdan yukarıya kıvrılan bir yol üzerinde düğümler.
      Burası bilerek canvas DEĞİL: 160 bölümlük bir bölgede yol
      ~15.000 piksel uzunluğunda oluyor ve bu boyda bir canvas
      telefonlarda doku sınırına takılıyor (DPR 2'de ~38 milyon
      piksel). DOM düğüm + tek bir SVG yol hem sınırsız uzayabiliyor
      hem de kaydırmayı tarayıcıya bırakıyor.
   ============================================================ */

/* ---- dünya haritası -------------------------------------------- */

let advCanvasEl = null, advCanvasCtx = null;
let advViewW = 0, advViewH = 0, advScale = 1;

function advFitCanvas(){
  const wrap = document.getElementById('advWorld');
  const cv   = document.getElementById('advCanvas');
  if(!wrap || !cv) return;
  advCanvasEl = cv;
  const w = wrap.clientWidth || 360;
  // Harita genişliğe göre ölçekleniyor; yükseklik oranla uzuyor ve
  // dikeyde kaydırılıyor (kaydırmayı tarayıcı yapıyor).
  advScale = w / WORLD_W;
  advViewW = w;
  advViewH = Math.round(WORLD_H * advScale);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width  = Math.round(advViewW * dpr);
  cv.height = Math.round(advViewH * dpr);
  cv.style.width  = advViewW + 'px';
  cv.style.height = advViewH + 'px';
  advCanvasCtx = cv.getContext('2d');
  advCanvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function advDrawWorld(){
  if(!advCanvasCtx) return;
  const baked = bakeWorld();                 // adventure-map.js
  advCanvasCtx.clearRect(0, 0, advViewW, advViewH);
  advCanvasCtx.drawImage(baked, 0, 0, advViewW, advViewH);
}

/* Bölge tabelaları. Canvas'ın üstünde mutlak konumlu butonlar. */
function advRenderMarkers(){
  const host = document.getElementById('advMarkers');
  if(!host) return;
  host.innerHTML = '';
  const frontier = advFrontierRegion();

  REGIONS.forEach((r, i)=>{
    const cfg = ISLANDS[r.id];
    if(!cfg) return;
    const st = advRegionStats(r);
    const el = document.createElement('button');
    el.className = 'adv-marker' + (st.unlocked ? '' : ' locked')
                 + (r.id === frontier.id ? ' here' : '')
                 + (st.complete ? ' complete' : '');
    el.style.left = (cfg.x * advScale) + 'px';
    el.style.top  = ((cfg.y - 108) * advScale) + 'px';

    if(st.unlocked){
      el.innerHTML =
        '<span class="am-ic">' + r.icon + '</span>' +
        '<span class="am-body">' +
          '<span class="am-name">' + r.name + '</span>' +
          '<span class="am-bar"><i style="width:' + Math.round(st.pct*100) + '%"></i></span>' +
          '<span class="am-count">' + st.done + ' / ' + st.total + '</span>' +
        '</span>';
      el.addEventListener('pointerup', ()=>{ playMenuTap(); advOpenRegion(r.id); });
    } else {
      el.innerHTML =
        '<span class="am-ic">🔒</span>' +
        '<span class="am-body">' +
          '<span class="am-name">' + r.name + '</span>' +
          '<span class="am-count">Bölüm ' + r.from + '\'de açılır</span>' +
        '</span>';
      el.addEventListener('pointerup', ()=>{ playError(); });
    }
    host.appendChild(el);
  });
}

function advRenderWorld(){
  advFitCanvas();
  advDrawWorld();
  advRenderMarkers();
  const t = advTotals();
  const el = document.getElementById('advTotals');
  if(el) el.innerHTML = '<b>' + t.done + '</b> / ' + t.total + ' bölüm  ·  ⭐ ' + t.stars;
  // Oyuncunun bulunduğu bölgeye kaydır — haritayı hep en baştan
  // aramak zorunda kalmasın.
  const wrap = document.getElementById('advWorld');
  const cfg = ISLANDS[advFrontierRegion().id];
  if(wrap && cfg){
    const target = cfg.y * advScale - wrap.clientHeight * 0.55;
    wrap.scrollTop = Math.max(0, target);
  }
}

/* ---- bölge yolu ------------------------------------------------ */

/* ============================================================
   GEÇİCİ — TEST KİLİDİ
   Kilitli bir bölüme ÜST ÜSTE İKİ KEZ basmak onu yine de açar.
   Amaç geliştirme sırasında istediğimiz bölümü sırayı beklemeden
   deneyebilmek. İlk dokunuş düğümü "bir kez daha bas" durumuna alır
   ve bunu düğümün üstünde yazıyla söyler; ikinci dokunuş oynatır.
   Süre dolarsa kendiliğinden iptal olur, yani yanlışlıkla açılmaz.
   YAYINA ÇIKARKEN: ADV_TEST_UNLOCK = false yeterli.
   ============================================================ */
const ADV_TEST_UNLOCK = true;
const ADV_FORCE_MS = 1800;
let advForceLevel = 0, advForceAt = 0;

const RG_GAP    = 96;    // düğümler arası dikey mesafe
const RG_AMPL   = 0.30;  // yatay salınımın genişliğe oranı
const RG_PAD_TOP = 90, RG_PAD_BOTTOM = 110;

let advOpenRegionId = null;

/* Düğüm konumu. i = bölge içi sıra (0 tabanlı). İlk bölüm EN ALTTA:
   oyuncu yukarı doğru tırmanıyor, ilerleme yönü yukarı. */
function rgNodePos(i, count, w){
  const x = w/2 + Math.sin(i*0.64) * (w*RG_AMPL) + Math.sin(i*0.21) * (w*0.07);
  const y = RG_PAD_TOP + (count-1-i) * RG_GAP;
  return { x, y };
}

function advOpenRegion(id){
  const r = regionById(id);
  if(!r || !advIsRegionUnlocked(r)) { playError(); return; }
  advOpenRegionId = id;
  advSetLastRegion(id);
  showMenuPage('menuRegion');
}

function advRenderRegion(){
  const r = regionById(advOpenRegionId);
  if(!r) return;
  const st = advRegionStats(r);
  const nameEl = document.getElementById('rgName');
  const subEl  = document.getElementById('rgSub');
  const fill   = document.getElementById('rgProgFill');
  if(nameEl) nameEl.textContent = r.icon + ' ' + r.name;
  if(subEl)  subEl.textContent  = st.done + ' / ' + st.total + ' bölüm  ·  ⭐ ' + st.stars + ' / ' + st.maxStars;
  if(fill)   fill.style.width   = Math.round(st.pct*100) + '%';

  const scroll = document.getElementById('rgScroll');
  const inner  = document.getElementById('rgInner');
  const svg    = document.getElementById('rgPath');
  const nodes  = document.getElementById('rgNodes');
  if(!scroll || !inner || !svg || !nodes) return;

  const count = st.total;
  const w = scroll.clientWidth || 360;
  const h = RG_PAD_TOP + (count-1)*RG_GAP + RG_PAD_BOTTOM;
  inner.style.height = h + 'px';
  inner.style.setProperty('--rg-accent', r.accent);
  inner.style.setProperty('--rg-color',  r.color);

  // --- yol çizgisi (tek SVG) ---
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  svg.setAttribute('width',  w);
  svg.setAttribute('height', h);
  let d = '';
  for(let i=0;i<count;i++){
    const p = rgNodePos(i, count, w);
    if(i === 0) d += 'M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    else {
      const q = rgNodePos(i-1, count, w);
      const my = (p.y + q.y) / 2;
      d += ' C' + q.x.toFixed(1) + ' ' + my.toFixed(1) + ' ' +
                  p.x.toFixed(1) + ' ' + my.toFixed(1) + ' ' +
                  p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    }
  }
  svg.innerHTML =
    '<path class="rg-trail-bg" d="' + d + '"/>' +
    '<path class="rg-trail-fg" d="' + d + '"/>';

  // --- düğümler ---
  const frag = document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const n = r.from + i;
    const p = rgNodePos(i, count, w);
    const state = advLevelState(n);
    const boss  = isBossLevel(n);
    const stars = advStars(n);

    const el = document.createElement('button');
    el.className = 'rg-node ' + state + (boss ? ' boss' : '');
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.level = n;

    let inner2 = '';
    if(state === 'locked')      inner2 = '<span class="rn-face">🔒</span>';
    else if(boss)               inner2 = '<span class="rn-face">💀</span>';
    else                        inner2 = '<span class="rn-face">' + (i+1) + '</span>';

    let starRow = '';
    if(stars > 0){
      starRow = '<span class="rn-stars">' +
        '<i class="' + (stars>=1?'on':'') + '"></i>' +
        '<i class="' + (stars>=2?'on':'') + '"></i>' +
        '<i class="' + (stars>=3?'on':'') + '"></i></span>';
    }
    el.innerHTML = inner2 + starRow +
      (boss ? '<span class="rn-tag">PATRON</span>' : '');

    if(state === 'locked'){
      el.addEventListener('pointerup', ()=>{
        if(!ADV_TEST_UNLOCK){ playError(); return; }
        const now = Date.now();
        if(advForceLevel === n && (now - advForceAt) < ADV_FORCE_MS){
          // ikinci dokunuş — kilidi yok say ve oynat
          advForceLevel = 0;
          playMenuTap();
          if(advPlay(n, true)) closeStartScreen();
          return;
        }
        // ilk dokunuş — düğümü hazırla ve bunu ekranda söyle
        advForceLevel = n; advForceAt = now;
        playError();
        advArmNode(el, n);
      });
    } else {
      el.addEventListener('pointerup', ()=>{
        playMenuTap();
        if(advPlay(n)) closeStartScreen();
      });
    }
    frag.appendChild(el);
  }
  nodes.innerHTML = '';
  nodes.appendChild(frag);

  // Sıradaki oynanacak düğüm ekranın ortasına gelsin
  const nextIdx = st.next - r.from;
  const np = rgNodePos(Math.max(0, nextIdx), count, w);
  scroll.scrollTop = Math.max(0, np.y - scroll.clientHeight * 0.55);
}

/* Kilitli düğümü "bir kez daha bas" durumuna alır ve süre dolunca
   kendiliğinden geri döndürür. (GEÇİCİ — bkz. ADV_TEST_UNLOCK) */
function advArmNode(el, n){
  document.querySelectorAll('.rg-node.armed').forEach(o=>{
    o.classList.remove('armed');
    const t = o.querySelector('.rn-arm');
    if(t) t.remove();
  });
  el.classList.add('armed');
  const tag = document.createElement('span');
  tag.className = 'rn-arm';
  tag.textContent = 'bir kez daha bas';
  el.appendChild(tag);
  setTimeout(()=>{
    if(advForceLevel !== n) return;
    advForceLevel = 0;
    el.classList.remove('armed');
    if(tag.parentNode) tag.remove();
  }, ADV_FORCE_MS);
}

/* ---- dışarıdan çağrılan giriş noktaları ------------------------ */

/* Ana menüdeki "Maceraya Başla" */
function advOpenWorld(){
  showMenuPage('menuAdventure');
}

/* "Devam Et": oynanacak ilk bölümü doğrudan başlatır. Oyuncu menüde
   yolunu aramak zorunda kalmasın. */
function advContinue(){
  const n = advNextPlayable();
  if(n === null){ playError(); return; }
  if(advPlay(n)) closeStartScreen();
}

/* Sıradaki oynanmamış ama açık bölüm; hepsi bittiyse en sonuncusu. */
function advNextPlayable(){
  for(let i=1;i<=GEN.TOTAL_LEVELS;i++){
    if(!advIsUnlocked(i)) break;
    if(!advIsDone(i)) return i;
  }
  return GEN.TOTAL_LEVELS;
}
