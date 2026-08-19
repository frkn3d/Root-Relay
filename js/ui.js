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
}
function closeShopOverlay(){
  playMenuTap();
  document.getElementById('shopOverlay').classList.remove('show');
  if(!shopWasPaused){
    paused = false;
    lastTime = performance.now();      // duraklama süresi dt'ye yansımasın
  }
}
let shopWasPaused = false;

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
   İlk bölüm hep açık. Sonraki bölümler, bir öncekini en az 1 yıldızla
   tamamlayınca açılır. */
function isLevelUnlocked(idx){
  if(idx <= 0) return true;
  const prev = LEVELS[idx-1];
  if(!prev) return false;
  return getLevelProgress(prev.id).bestStars > 0;
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

function renderTowerDrawer(){
  const el = document.getElementById('towerDrawer');
  el.innerHTML='';
  Object.values(TOWER_TYPES).forEach(def=>{
    const card=document.createElement('div');
    card.className='tower-card'+(def.id===selectedType?' active':'');
    card.innerHTML = `<div class="icon">${def.icon}</div><div class="name">${def.name}</div><div class="cost">🪙${def.cost}</div>`;
    card.addEventListener('pointerup', ()=>{
      selectedType = def.id;
      if(typeof closeBuildConfirm === 'function') closeBuildConfirm();
      renderTowerSelectBtn();
      renderTowerDrawer();
      closeTowerDrawer();
    });
    el.appendChild(card);
  });
}

function toggleTowerDrawer(){
  playMenuTap();
  const el = document.getElementById('towerDrawer');
  const isOpen = el.classList.toggle('show');
  document.getElementById('towerSelectBtn').classList.toggle('open', isOpen);
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
    statsHtml += `<div class="tp-stat-row"><span>🐌 Yavaşlatma</span><b>%${slowPct}</b></div>`;
    statsHtml += `<div class="tp-stat-row"><span>⏳ Süre</span><b>${t.def.slowDuration.toFixed(1)}sn</b></div>`;
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
  const groups = generateWave(level, nextIdx);
  const hasBoss = groups.some(g=>ENEMY_TYPES[g.type] && ENEMY_TYPES[g.type].boss);
  const lead = hasBoss ? `<span class="wp-boss">⚠ BOSS DALGASI (D${nextIdx})</span>` : `<span>Sıradaki (D${nextIdx}):</span>`;
  el.innerHTML = lead + groups.map(g=>{
    const def = ENEMY_TYPES[g.type];
    const isNew = !seenEnemyTypes.has(g.type);
    const cls = def.boss ? ' chip-boss' : '';
    return `<span class="chip${cls}"><i style="background:${def.body}"></i>${g.count}× ${def.label}${isNew?'<span class="new-badge">YENİ</span>':''}</span>`;
  }).join('');
}
