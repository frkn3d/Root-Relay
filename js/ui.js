/* ============================================================
   UI — DOM'a dokunan tüm render fonksiyonları burada.
   engine.js durum değiştiğinde bu fonksiyonları çağırır.
   ============================================================ */
function setWaveBtnReady(on){
  const btn = document.getElementById('waveBtn');
  if(btn) btn.classList.toggle('ready', !!on);
}

/* ---- Dalga tamamlandı bildirimi (2 saniye) ---- */
let waveToastTimer = null;
function showWaveToast(text){
  const el = document.getElementById('waveToast');
  if(!el) return;
  el.textContent = text;
  // Animasyonu yeniden tetiklemek için sınıfı sıfırla (reflow zorla).
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(waveToastTimer);
  waveToastTimer = setTimeout(()=>el.classList.remove('show'), 2000);
}
function hideWaveToast(){
  const el = document.getElementById('waveToast');
  if(el) el.classList.remove('show');
  clearTimeout(waveToastTimer);
}

function renderShop(){
  const el = document.getElementById('shopList');
  if(!el) return;
  el.innerHTML = '';
  const gems = getGems();

  SHOP_ITEMS.forEach(item=>{
    const bought = getSessionBuys(item.id);
    const cost = shopNextCost(item.id);
    const maxed = cost === null;

    let pips = '';
    for(let i=0;i<item.maxBuys;i++) pips += `<i class="${i<bought?'on':''}"></i>`;

    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `
      <div class="shop-ic">${item.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
        <div class="shop-effect">${item.effect}</div>
        <div class="shop-pips">${pips}</div>
      </div>
      <button class="shop-buy${maxed?' maxed':''}" ${maxed || gems<cost ? 'disabled' : ''}>
        ${maxed ? 'DOLDU' : '💎'+cost}
      </button>
    `;
    const btn = row.querySelector('.shop-buy');
    if(!maxed){
      btn.addEventListener('pointerup', ()=>{
        const res = buyInGameItem(item.id);   // engine.js
        if(res.ok){
          refreshGemDisplay();
          renderShop();
        } else {
          playError();
        }
      });
    }
    el.appendChild(row);
  });
}

function openShopOverlay(){
  if(gameOver || gameWon) return;
  playMenuTap();
  shopWasPaused = paused;
  paused = true;                       // market açıkken oyun durur
  refreshGemDisplay();
  renderShop();
  document.getElementById('shopOverlay').classList.add('show');
  syncPauseToggleBtn();                // engine.js — alt bardaki ikon/yanıp sönme senkron kalsın
}
function closeShopOverlay(){
  playMenuTap();
  document.getElementById('shopOverlay').classList.remove('show');
  if(!shopWasPaused){
    paused = false;
    lastTime = performance.now();      // duraklama süresi dt'ye yansımasın
  }
  syncPauseToggleBtn();                // engine.js
}
let shopWasPaused = false;

/* ---- Pause menüsündeki bölüm bilgisi kartı ----
   Zorluk/Macera/Boss'u ortak bir 5 noktalı ölçeğe indiriyor; klasik
   bölümlerde (LEVELS) doğrudan bir "zorluk01" alanı olmadığından
   dizideki konumu (0 = ilk bölüm, 1 = son bölüm) zorluk vekili olarak
   kullanılıyor — kampanya bölümleri zaten artan zorlukla sıralı. */
function pauseLevelDots(lvl){
  const generated = !!lvl.generated;
  const diff01 = generated
    ? lvl.difficulty01
    : (LEVELS.length > 1 ? currentLevelIdx / (LEVELS.length-1) : 0.5);
  const diffDots = Math.max(1, Math.min(5, Math.ceil(diff01*5)));

  // Macera: dalga sayısı — bölüm ne kadar uzun sürüyorsa o kadar
  // "macera". 1000 Bölüm modunda dalgalar 9-15 arasında; klasik
  // bölümler de benzer aralıkta, o yüzden aynı 8-16 skalası kullanılıyor.
  const waveCount = lvl.waveCount || 10;
  const advDots = Math.max(1, Math.min(5, Math.round(1 + (waveCount-8)/8*4)));

  let hasBoss;
  if(generated) hasBoss = !!lvl.allowBoss;
  else hasBoss = !!(lvl.waveOverrides && Object.values(lvl.waveOverrides).some(groups=>
    groups.some(g=>ENEMY_TYPES[g.type] && ENEMY_TYPES[g.type].boss)));
  const bossDots = hasBoss ? Math.max(1, Math.min(5, Math.round(1 + Math.max(0,diff01-0.5)/0.5*4))) : 0;

  return { diffDots, advDots, bossDots };
}
function renderDots(el, count){
  if(!el) return;
  let html = '';
  for(let i=0;i<5;i++) html += `<i class="${i<count?'on':''}"></i>`;
  el.innerHTML = html;
}

/* Bir bölümü kaç yıldızla bitirmek için kaç can gerektiğini hesaplar
   (bkz. endGame() — frac=lives/startLivesEffective, >=0.8 → 3 yıldız,
   >=0.4 → 2 yıldız). Menü ekranlarında oyuncuya somut bir sayı olarak
   gösterilir; yalnızca yüzde söylemek hangi bölümde kaç can ettiğini
   belirsiz bırakıyordu. */
function starLivesNeeded(startLives){
  return {
    three: Math.ceil(startLives*0.8),
    two: Math.ceil(startLives*0.4),
  };
}

function renderPauseLevelInfo(){
  const box = document.getElementById('pauseLevelInfo');
  if(!box || !level) return;
  document.getElementById('pliName').textContent = level.name;
  const dots = pauseLevelDots(level);
  renderDots(document.getElementById('pliDiff'), dots.diffDots);
  renderDots(document.getElementById('pliAdv'), dots.advDots);
  renderDots(document.getElementById('pliBoss'), dots.bossDots);
  const need = starLivesNeeded(level.startLives);
  const reqEl = document.getElementById('pliStarsReq');
  if(reqEl) reqEl.textContent = `⭐⭐⭐ ≥${need.three} can  ·  ⭐⭐ ≥${need.two} can`;
}

/* ---- Menü sayfası gezinme ---- */
function showMenuPage(id){
  document.querySelectorAll('.menu-page').forEach(p=>{
    p.classList.toggle('active', p.id===id);
  });
  if(id==='menuMain') { refreshGemDisplay(); refreshContinueButton(); }
  if(id==='menuLevels') renderStartLevelList();
  if(id==='menuStats') renderStatsScreen();
}

/* ---- İstatistikler ekranı ----
   Ömür boyu kazanılan/harcanan altına göre bir "unvan" gösterir ve
   ekrana günün ilk girişinde elmas ödülü verir (bkz. progress.js). */
const STAT_TITLES = [
  { min:0.00, name:'Tohum Biriktiren' },
  { min:0.35, name:'Filiz Yatırımcısı' },
  { min:0.65, name:'Dengeli Bahçıvan' },
  { min:0.90, name:'Sağlam Stratejist' },
];
function statTitleFor(ratio){
  let cur = STAT_TITLES[0].name;
  STAT_TITLES.forEach(t=>{ if(ratio >= t.min) cur = t.name; });
  return cur;
}
function renderStatsScreen(){
  const s = loadGoldStats();           // progress.js
  const ratio = s.earned > 0 ? Math.min(1, s.spent / s.earned) : 0;

  document.getElementById('statEarned').textContent = s.earned.toLocaleString('tr-TR');
  document.getElementById('statSpent').textContent = s.spent.toLocaleString('tr-TR');
  document.getElementById('statsTitle').textContent = statTitleFor(ratio);
  const fill = document.getElementById('statRatioFill');
  if(fill) fill.style.width = Math.round(ratio*100) + '%';

  const reward = claimDailyStatsReward();   // progress.js — günde bir kez
  if(reward > 0){
    playGem();   // audio.js
    refreshGemDisplay();
    showRewardToast(`+${reward} 💎 Günlük Ödül!`);
  }
}
let rewardToastTimer = null;
function showRewardToast(text){
  const el = document.getElementById('dailyRewardToast');
  if(!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(rewardToastTimer);
  rewardToastTimer = setTimeout(()=>el.classList.remove('show'), 2000);
}

function refreshGemDisplay(){
  const g = getGems();
  const a = document.getElementById('gemCount');
  const b = document.getElementById('gemCountShop');
  if(a) a.textContent = g;
  if(b) b.textContent = g;
}

function refreshContinueButton(){
  const btn = document.getElementById('mmContinue');
  if(!btn) return;
  const r = getResume();
  if(r && LEVELS[r.levelIdx]){
    btn.disabled = false;
    btn.textContent = `▶ Devam Et — ${LEVELS[r.levelIdx].name}`;
  } else {
    btn.disabled = true;
    btn.textContent = '▶ Devam Et';
  }
}

function openStartScreen(){
  showMenuPage('menuMain');
  document.body.classList.add('in-menu');
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js — menü teması girsin
  document.getElementById('startScreen').classList.remove('hide');
  if(typeof invalidateFit === 'function') invalidateFit();
  if(typeof fitGameToViewport === 'function') fitGameToViewport();
}
function closeStartScreen(){
  document.body.classList.remove('in-menu');
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js — menü teması çıksın, biyom girsin
  document.getElementById('startScreen').classList.add('hide');
  // Barlar yeniden göründü; oyun sahasını kalan alana göre yeniden ölç.
  if(typeof invalidateFit === 'function') invalidateFit();
  if(typeof fitGameToViewport === 'function'){
    fitGameToViewport();
    setTimeout(()=>{ invalidateFit(); fitGameToViewport(); }, 60);
  }
}

/* ---- Bölüm kilitleri ----
   TEST AŞAMASI: kilitler geçici olarak kapalı. Yayına geçerken
   UNLOCK_ALL değerini false yapmak yeterli. */
const UNLOCK_ALL = true;

function isLevelUnlocked(idx){
  if(UNLOCK_ALL) return true;
  if(idx <= 0) return true;
  const prev = LEVELS[idx-1];
  if(!prev) return false;
  return getLevelProgress(prev.id).bestStars > 0;
}

/* ============================================================
   1000 BÖLÜM — bölüm numarası girip doğrudan oynama

   Bölümler tek bir sabit tohumdan üretilir; oyuncunun girdiği sayı
   bölüm numarasıdır. Böylece herkes aynı 1000 bölümü oynar ve
   "Bölüm 347" herkeste aynı haritadır.
   ============================================================ */
const WORLD_SEED = 'root-relay';

function currentLevelNo(){
  const el = document.getElementById('seedInput');
  let v = parseInt((el && el.value) || '', 10);
  if(!isFinite(v)) v = 1;
  return Math.max(1, Math.min(GEN.TOTAL_LEVELS, v));
}

/* Girilen numaranın özetini gösterir */
function renderSeedPreview(){
  const el = document.getElementById('seedPreview');
  if(!el) return;
  const inp = document.getElementById('seedInput');
  if(!inp || !inp.value.trim()){
    el.innerHTML = '<span style="opacity:.6">Bölüm numarası gir…</span>';
    return;
  }
  const n = currentLevelNo();
  const lv = generateLevel(WORLD_SEED, n);      // levelgen.js
  const b = BIOMES[lv.theme.biome].name;
  const s = SEASONS[lv.theme.season].name;
  const r = ROAD_TYPES[lv.theme.road].name;
  const prog = getLevelProgress(lv.id);
  const dots = Math.max(1, Math.min(5, Math.round(lv.difficulty01*5)));
  const need = starLivesNeeded(lv.startLives);
  el.innerHTML =
    `<b>Bölüm ${n}</b> — ${s} · ${b} · ${r} yol<br>` +
    `${lv.entries} giriş / ${lv.exits} çıkış · ${lv.waveCount} dalga · ${lv.spots.length} kule noktası<br>` +
    `Zorluk: ${'●'.repeat(dots)}${'○'.repeat(5-dots)} · Tarz: ${lv.archetype.name}<br>` +
    `Can: ${lv.startLives} · ⭐⭐⭐ ≥${need.three} can · ⭐⭐ ≥${need.two} can` +
    (lv.mods.notes.length ? `<br><span style="color:#8fe3a0">☀ ${lv.mods.notes.join(' ')}</span>` : '') +
    (prog.bestStars>0 ? `<br>En iyi: ${'⭐'.repeat(prog.bestStars)}` : '');
}

function renderStars(n){
  let s='';
  for(let i=0;i<3;i++) s += i<n ? '⭐' : '☆';
  return s;
}

function renderStartLevelList(){
  const el = document.getElementById('ssLevelList');
  if(!el) return;
  el.innerHTML='';
  LEVELS.forEach((lv,i)=>{
    const prog = getLevelProgress(lv.id);
    const unlocked = isLevelUnlocked(i);
    const card=document.createElement('div');
    card.className='ss-level-card' + (unlocked ? '' : ' locked');

    if(unlocked){
      card.innerHTML = `
        <div class="ss-level-info">
          <div class="ss-level-name">${lv.name}</div>
          <div class="ss-level-stars">${renderStars(prog.bestStars)}</div>
          <div class="ss-level-best">${prog.bestWave>0 ? 'En iyi dalga: '+prog.bestWave+'/'+lv.waveCount : 'Henüz oynanmadı'}</div>
        </div>
        <div class="ss-level-play">▶</div>
      `;
      card.addEventListener('pointerup', ()=>{
        playMenuTap();
        loadLevel(i);
        saveResume(i, 0);
        closeStartScreen();
      });
    } else {
      const prevName = LEVELS[i-1] ? LEVELS[i-1].name : '';
      card.innerHTML = `
        <div class="ss-level-info">
          <div class="ss-level-name">${lv.name}</div>
          <div class="ss-level-locked">🔒 ${prevName} bölümünü tamamla</div>
        </div>
        <div class="ss-level-play locked">🔒</div>
      `;
      card.addEventListener('pointerup', ()=>{ playError(); });
    }
    el.appendChild(card);
  });
}

function renderTowerSelectBtn(){
  const btn = document.getElementById('towerSelectBtn');
  const def = TOWER_TYPES[selectedType];
  const left = towersRemaining(def);
  btn.innerHTML = `<span class="ts-icon${left<=0?' depleted':''}">${def.icon}</span>`
    + `<span class="tower-count-badge${left<=0?' depleted':''}">${left}</span>`
    + `<span class="ts-cost">🪙${buildCost(def)}</span>`;
}

/* Kart genişliği (58px) küçük ve çekmece kaydırmalı (overflow-x) olduğu
   için, satırı kaydırmaya çalışan bir parmak sıkça komşu bir kartın
   üzerinde bırakılıyordu — hareket miktarına bakılmadan HER pointerup
   o kartı seçip çekmeceyi kapatıyordu. Aynı basılı-tutma/kaydırma
   eşiğini (main.js'teki MOVE_CANCEL_PX) burada da uygulayarak, yalnızca
   gerçek bir dokunuş (az hareket) seçim yapsın; bir kaydırmanın ucu
   başka bir kartta bitse bile yanlışlıkla kule değiştirmesin/kapatmasın. */
const CARD_TAP_MOVE_PX = 12;
let cardPressStart = null;

/* Çekmece açıldığında, kartların HEMEN ÜSTÜNDE seçili kule türünün
   atış/vuruş özetini küçük punto ile gösterir — oyuncu kart seçerken
   neyi kurduğunu görmek için önce kurup panele bakmak zorunda kalmasın.
   Değerler 0. seviye (yeni kurulacak kule) içindir ve bölümün
   biyom/mevsim etkilerini de içerir (getTowerStats, engine-towers.js). */
function renderTowerDrawerStats(){
  const el = document.getElementById('towerDrawerStats');
  if(!el) return;
  const def = TOWER_TYPES[selectedType];
  const st = getTowerStats({def, level:0});
  const bits = [];
  if(def.slowFactor){
    bits.push(`🐌 %${Math.round((1-def.slowFactor)*100)}`);
    bits.push(`⏳ ${st.slowDuration.toFixed(1)}sn`);
  } else if(def.kind === 'fire'){
    bits.push(`🌋 ${(st.dmg/st.rate).toFixed(1)}/sn`);
  } else {
    bits.push(`💥 ${Math.round(st.dmg)}`);
  }
  bits.push(`🎯 ${Math.round(st.range)}`);
  if(def.kind === 'fire') bits.push('♾️ kesintisiz');
  else bits.push(`⚡ ${(1/st.rate).toFixed(1)}/sn`);
  if(st.splash>0)      bits.push(`💫 ${Math.round(st.splash)}`);
  if(st.poisonDps>0)   bits.push(`☠️ ${Math.round(st.poisonDps)}/sn`);
  if(st.burnDps>0)     bits.push(`🔥 ${Math.round(st.burnDps)}/sn · ${st.burnDuration.toFixed(0)}sn`);
  if(st.chainCount>0)  bits.push(`⚡ ${st.chainCount} sıçrama`);
  el.innerHTML = `<b style="color:${def.color}">${def.icon} ${def.name}</b>`
    + bits.map(b=>`<span>${b}</span>`).join('');
}

function renderTowerDrawer(){
  const el = document.getElementById('towerDrawerRow');
  el.innerHTML='';
  renderTowerDrawerStats();
  Object.values(TOWER_TYPES).forEach(def=>{
    const left = towersRemaining(def);
    const card=document.createElement('div');
    card.className='tower-card'+(def.id===selectedType?' active':'')+(left<=0?' depleted':'');
    card.innerHTML = `<span class="tower-count-badge${left<=0?' depleted':''}">${left}</span>`
      + `<div class="icon">${def.icon}</div><div class="name">${def.name}</div><div class="cost">🪙${buildCost(def)}</div>`;
    card.addEventListener('pointerdown', (e)=>{
      cardPressStart = {x:e.clientX, y:e.clientY};
    });
    card.addEventListener('pointerup', (e)=>{
      const start = cardPressStart;
      cardPressStart = null;
      const moved = start ? Math.hypot(e.clientX-start.x, e.clientY-start.y) : 0;
      if(moved > CARD_TAP_MOVE_PX) return;   // kaydırmaydı — seçim yapma
      selectedType = def.id;
      if(typeof closeBuildConfirm === 'function') closeBuildConfirm();
      renderTowerSelectBtn();
      renderTowerDrawer();
      closeTowerDrawer();
    });
    el.appendChild(card);
  });
  updateTowerDrawerThumb();
}

/* Kaydırma göstergesi: parça genişliği görünür/toplam oranını,
   konumu ise mevcut kaydırma ilerlemesini yansıtır. Kaydıracak bir
   şey yoksa (tüm kartlar sığıyorsa) çubuk tamamen gizlenir. */
function updateTowerDrawerThumb(){
  const row = document.getElementById('towerDrawerRow');
  const bar = document.getElementById('towerDrawerScrollbar');
  const thumb = document.getElementById('towerDrawerThumb');
  if(!row || !bar || !thumb) return;
  const maxScroll = row.scrollWidth - row.clientWidth;
  if(maxScroll <= 1){
    bar.style.display = 'none';
    return;
  }
  bar.style.display = '';
  const frac = Math.max(0.12, Math.min(1, row.clientWidth / row.scrollWidth));
  thumb.style.width = (frac*100) + '%';
  const travel = 100 - frac*100;
  thumb.style.left = (travel * (row.scrollLeft / maxScroll)) + '%';
}

/* Çekmece ilk açılışta kaydırılabilir olduğunu anlatmak için bir
   anlığına en sağa atlar, sonra 1 saniyede yumuşakça sola kayıp normal
   başlangıç konumuna yerleşir. Artık cihaz başına bir kez değil, HER
   YENİ BÖLÜM başladığında bir kez tekrar gösteriliyor — bkz.
   resetTowerDrawerHint(), loadLevel()'den çağrılıyor (engine.js). */
let towerDrawerHintShown = false;
function resetTowerDrawerHint(){ towerDrawerHintShown = false; }
function maybePlayTowerDrawerHint(){
  const row = document.getElementById('towerDrawerRow');
  if(!row) return;
  const maxScroll = row.scrollWidth - row.clientWidth;
  if(maxScroll <= 1) return;
  if(towerDrawerHintShown) return;
  towerDrawerHintShown = true;

  row.scrollLeft = maxScroll;
  const start = performance.now();
  const DUR = 1000;
  function step(now){
    const p = Math.min(1, (now-start)/DUR);
    const ease = 1 - Math.pow(1-p, 3);   // ease-out: hızlı başlar, yumuşak biter
    row.scrollLeft = maxScroll * (1-ease);
    updateTowerDrawerThumb();
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function toggleTowerDrawer(){
  playMenuTap();
  const el = document.getElementById('towerDrawer');
  const isOpen = el.classList.toggle('show');
  document.getElementById('towerSelectBtn').classList.toggle('open', isOpen);
  if(isOpen){
    updateTowerDrawerThumb();
    maybePlayTowerDrawerHint();
  }
}
function closeTowerDrawer(){
  document.getElementById('towerDrawer').classList.remove('show');
  document.getElementById('towerSelectBtn').classList.remove('open');
}

function renderTowerPanel(){
  const t = selectedTower;
  const panel = document.getElementById('towerPanel');
  if(!t){ panel.classList.remove('show'); return; }
  panel.classList.add('show');

  const lvl = t.level||0;
  const st = getTowerStats(t);

  document.getElementById('tpIcon').textContent = t.def.icon;
  document.getElementById('tpName').textContent = t.def.name;
  document.getElementById('tpLevel').textContent = `Yükseltme: ${lvl}/3`;

  /* YÜKSELTME ÖNİZLEMESİ — her satır "şu an" değerini gösterir; kule
     yükseltilebiliyorsa yanında bir sonraki seviyede alacağı değer
     yeşil bir ok ile yazılır. Böylece oyuncu parayı vermeden önce
     TAM OLARAK hangi özelliğin ne kadar artacağını görür.
     Kule şu an yükseltiliyorsa (pendingLevel) önizleme, biten
     yükseltmenin hedef seviyesini gösterir. */
  const targetLvl = (t.pendingLevel !== undefined && t.pendingLevel !== null) ? t.pendingLevel : lvl+1;
  const nx = targetLvl <= 3 ? getTowerStats(t, targetLvl) : null;   // engine-towers.js

  const statRow = (icon, label, curTxt, nextTxt)=>{
    const up = (nextTxt !== null && nextTxt !== undefined && nextTxt !== curTxt)
      ? `<i class="tp-up">▲ ${nextTxt}</i>` : '';
    return `<div class="tp-stat-row"><span>${icon} ${label}</span><b>${curTxt}</b>${up}</div>`;
  };
  const num  = v => String(Math.round(v));
  const sec  = v => v.toFixed(1)+'sn';
  const perS = v => v.toFixed(1)+'/sn';

  let statsHtml = '';
  if(t.def.slowFactor){
    const slowPct = Math.round((1 - t.def.slowFactor) * 100);
    const bonus = st.slowDuration - t.def.slowDuration;
    const bonusTxt = Math.abs(bonus) > 0.05
      ? ` <span style="color:${bonus>0?'#8fe3a0':'#ff9f9f'}">(${bonus>0?'+':''}${bonus.toFixed(1)})</span>`
      : '';
    statsHtml += `<div class="tp-stat-row"><span>🐌 Yavaşlatma</span><b>%${slowPct}</b></div>`;
    statsHtml += `<div class="tp-stat-row"><span>⏳ Süre</span><b>${st.slowDuration.toFixed(1)}sn${bonusTxt}</b></div>`;
  } else if(t.def.kind === 'fire'){
    // Lav huzmesi kesintisiz akar: "atış başına hasar" yerine saniyelik
    // hasar anlamlı (bkz. engine-update.js "LAV HUZMESİ").
    const lavaDps = c => c.dmg / c.rate;
    statsHtml += statRow('🌋','Lav Hasarı', perS(lavaDps(st)), nx ? perS(lavaDps(nx)) : null);
  } else {
    statsHtml += statRow('💥','Hasar', num(st.dmg), nx ? num(nx.dmg) : null);
  }

  statsHtml += statRow('🎯','Menzil', num(st.range), nx ? num(nx.range) : null);
  if(t.def.kind === 'fire'){
    statsHtml += `<div class="tp-stat-row"><span>♾️ Atış</span><b>Kesintisiz</b></div>`;
    statsHtml += statRow('📐','Koni', num(st.coneAngle*2*180/Math.PI)+'°', nx ? num(nx.coneAngle*2*180/Math.PI)+'°' : null);
  } else {
    statsHtml += statRow('⚡','Atış Hızı', perS(1/st.rate), nx ? perS(1/nx.rate) : null);
  }
  if(t.def.splash>0){
    statsHtml += statRow('💫','Alan Yarıçapı', num(st.splash), nx ? num(nx.splash) : null);
  }
  if(st.poisonDps>0){
    statsHtml += statRow('☠️','Zehir', perS(st.poisonDps), nx ? perS(nx.poisonDps) : null);
    statsHtml += statRow('⏳','Süre', sec(st.poisonDuration), nx ? sec(nx.poisonDuration) : null);
  }
  if(st.burnDps>0){
    statsHtml += statRow('🔥','Yanma', perS(st.burnDps), nx ? perS(nx.burnDps) : null);
    statsHtml += statRow('⏳','Süre', sec(st.burnDuration), nx ? sec(nx.burnDuration) : null);
  }
  if(st.chainCount>0){
    statsHtml += statRow('⚡','Sıçrama', st.chainCount+' hedef', nx ? nx.chainCount+' hedef' : null);
  }
  if(nx){
    statsHtml += `<div class="tp-stat-note">▲ = Seviye ${targetLvl}'te olacak değer</div>`;
  }
  document.getElementById('tpStats').innerHTML = statsHtml;

  // Atış önceliği seçicisi
  const curMode = t.targetMode || 'first';
  const tgEl = document.getElementById('tpTargets');
  tgEl.innerHTML = '';
  TARGET_MODES.forEach(m=>{
    const b = document.createElement('div');
    b.className = 'tp-target-btn' + (m.id===curMode ? ' active' : '');
    b.title = m.desc;
    b.innerHTML = `<span class="tt-ic">${m.icon}</span><span class="tt-lb">${m.label}</span>`;
    b.addEventListener('pointerup', (ev)=>{ ev.stopPropagation(); setTargetMode(m.id); });
    tgEl.appendChild(b);
  });

  const cost = upgradeCost(t);
  const upBtn = document.getElementById('tpUpgradeBtn');
  if(t.buildLeft > 0){
    upBtn.textContent = t.pendingLevel ? 'Yükseltiliyor…' : 'İnşa ediliyor…';
    upBtn.disabled = true;
  } else if(cost===null){
    upBtn.textContent = 'Maksimum Seviye';
    upBtn.disabled = true;
  } else {
    const secs = buildDurationFor((t.level||0)+1);
    upBtn.textContent = `Yükselt · 🪙${cost} · ${secs}s`;
    upBtn.disabled = gold < cost;
  }
  // engine.js'deki hafif tazeleyici ile durumu senkron tut
  lastAffordState = upBtn.disabled;

  const sellValue = Math.floor(t.totalSpent/2);
  document.getElementById('tpSellBtn').textContent = `Sat · +🪙${sellValue}`;

  const confirmRow = document.getElementById('tpSellConfirm');
  const mainActions = document.getElementById('tpMainActions');
  if(sellConfirmPending){
    confirmRow.classList.add('show');
    mainActions.style.display='none';
    document.getElementById('tpSellConfirmText').textContent = `Bu kuleyi satmak istediğine emin misin? +${sellValue} altın alacaksın.`;
  } else {
    confirmRow.classList.remove('show');
    mainActions.style.display='flex';
  }
}

function renderWavePreview(){
  const el = document.getElementById('wavePreview');
  const nextIdx = waveIndex+1;
  if(nextIdx > level.waveCount){ el.innerHTML='<span>Tüm dalgalar tamamlandı 🌿</span>'; return; }
  const groups = level.generated
    ? generateWaveForGenerated(level, nextIdx)
    : generateWave(level, nextIdx);
  const hasBoss = groups.some(g=>ENEMY_TYPES[g.type] && ENEMY_TYPES[g.type].boss);
  const lead = hasBoss ? `<span class="wp-boss">⚠ BOSS DALGASI (D${nextIdx})</span>` : `<span>Sıradaki (D${nextIdx}):</span>`;
  el.innerHTML = lead + groups.map(g=>{
    const def = ENEMY_TYPES[g.type];
    const isNew = !seenEnemyTypes.has(g.type);
    const cls = def.boss ? ' chip-boss' : '';
    // crowdCount (config.js): 13. dalgadan itibaren sahaya çıkan sayı
    // gruptaki ham sayıdan fazla; önizleme gerçeği göstermeli.
    const n = crowdCount(g.type, g.count, nextIdx);
    return `<span class="chip${cls}"><i style="background:${def.body}"></i>${n}× ${def.label}${isNew?'<span class="new-badge">YENİ</span>':''}</span>`;
  }).join('');
}
