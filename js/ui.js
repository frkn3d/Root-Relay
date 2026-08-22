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
function renderPauseLevelInfo(){
  const box = document.getElementById('pauseLevelInfo');
  if(!box || !level) return;
  document.getElementById('pliName').textContent = level.name;
  const dots = pauseLevelDots(level);
  renderDots(document.getElementById('pliDiff'), dots.diffDots);
  renderDots(document.getElementById('pliAdv'), dots.advDots);
  renderDots(document.getElementById('pliBoss'), dots.bossDots);
}

/* ---- Menü sayfası gezinme ---- */
function showMenuPage(id){
  document.querySelectorAll('.menu-page').forEach(p=>{
    p.classList.toggle('active', p.id===id);
  });
  if(id==='menuMain') { refreshGemDisplay(); refreshContinueButton(); }
  if(id==='menuLevels') renderStartLevelList();
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
  document.getElementById('startScreen').classList.remove('hide');
  if(typeof invalidateFit === 'function') invalidateFit();
  if(typeof fitGameToViewport === 'function') fitGameToViewport();
}
function closeStartScreen(){
  document.body.classList.remove('in-menu');
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
  el.innerHTML =
    `<b>Bölüm ${n}</b> — ${s} · ${b} · ${r} yol<br>` +
    `${lv.entries} giriş / ${lv.exits} çıkış · ${lv.waveCount} dalga · ${lv.spots.length} kule noktası<br>` +
    `Zorluk: ${'●'.repeat(dots)}${'○'.repeat(5-dots)} · Tarz: ${lv.archetype.name}` +
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
  btn.innerHTML = `<span class="ts-icon">${def.icon}</span><span class="ts-cost">🪙${def.cost}</span>`;
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

function renderTowerDrawer(){
  const el = document.getElementById('towerDrawerRow');
  el.innerHTML='';
  Object.values(TOWER_TYPES).forEach(def=>{
    const card=document.createElement('div');
    card.className='tower-card'+(def.id===selectedType?' active':'');
    card.innerHTML = `<div class="icon">${def.icon}</div><div class="name">${def.name}</div><div class="cost">🪙${def.cost}</div>`;
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

/* İlk kez açılışta: kaydırılabilir olduğunu anlatmak için çekmece
   bir anlığına en sağa atlar, sonra 1 saniyede yumuşakça sola kayıp
   normal başlangıç konumuna yerleşir. Sadece bir kez (cihaz başına)
   gösterilir ve gerçekten kaydıracak içerik varsa çalışır. */
const TOWER_DRAWER_HINT_KEY = 'rr_td_hint_v1';
function maybePlayTowerDrawerHint(){
  const row = document.getElementById('towerDrawerRow');
  if(!row) return;
  const maxScroll = row.scrollWidth - row.clientWidth;
  if(maxScroll <= 1) return;
  let seen = false;
  try{ seen = !!localStorage.getItem(TOWER_DRAWER_HINT_KEY); }catch(e){}
  if(seen) return;
  try{ localStorage.setItem(TOWER_DRAWER_HINT_KEY, '1'); }catch(e){}

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

  let statsHtml = '';
  if(t.def.slowFactor){
    const slowPct = Math.round((1 - t.def.slowFactor) * 100);
    const bonus = st.slowDuration - t.def.slowDuration;
    const bonusTxt = Math.abs(bonus) > 0.05
      ? ` <span style="color:${bonus>0?'#8fe3a0':'#ff9f9f'}">(${bonus>0?'+':''}${bonus.toFixed(1)})</span>`
      : '';
    statsHtml += `<div class="tp-stat-row"><span>🐌 Yavaşlatma</span><b>%${slowPct}</b></div>`;
    statsHtml += `<div class="tp-stat-row"><span>⏳ Süre</span><b>${st.slowDuration.toFixed(1)}sn${bonusTxt}</b></div>`;
  } else {
    statsHtml += `<div class="tp-stat-row"><span>💥 Hasar</span><b>${Math.round(st.dmg)}</b></div>`;
  }
  statsHtml += `
    <div class="tp-stat-row"><span>🎯 Menzil</span><b>${Math.round(st.range)}</b></div>
    <div class="tp-stat-row"><span>⚡ Atış Hızı</span><b>${(1/st.rate).toFixed(1)}/sn</b></div>
  `;
  if(t.def.splash>0){
    statsHtml += `<div class="tp-stat-row"><span>💫 Alan Yarıçapı</span><b>${Math.round(st.splash)}</b></div>`;
  }
  if(st.poisonDps>0){
    statsHtml += `<div class="tp-stat-row"><span>☠️ Zehir</span><b>${Math.round(st.poisonDps)}/sn</b></div>`;
    statsHtml += `<div class="tp-stat-row"><span>⏳ Süre</span><b>${st.poisonDuration.toFixed(1)}sn</b></div>`;
  }
  if(st.chainCount>0){
    statsHtml += `<div class="tp-stat-row"><span>⚡ Sıçrama</span><b>${st.chainCount} hedef</b></div>`;
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
    return `<span class="chip${cls}"><i style="background:${def.body}"></i>${g.count}× ${def.label}${isNew?'<span class="new-badge">YENİ</span>':''}</span>`;
  }).join('');
}
