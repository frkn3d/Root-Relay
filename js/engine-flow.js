/* ============================================================
   MOTOR / AKIŞ — bölüm yaşam döngüsü: bölüm yükleme (elle yazılmış
   ya da prosedürel üretilmiş), duraklatma ve menü geçişleri,
   dalga başlatma ve bölüm sonu (kazanma/kaybetme) ekranı.
   ============================================================ */
/* Üretilmiş (prosedürel) bir bölümü yükleyip oyunu başlatır.
   LEVELS dizisine dokunmaz; geçici bir bölüm nesnesi kullanır. */
let generatedLevel = null;
function startGeneratedLevel(seed, levelNo){
  generatedLevel = generateLevel(seed, levelNo);   // levelgen.js
  loadLevel(-1);                                    // -1 = üretilmiş bölüm
  closeStartScreen();                               // ui.js
}

function loadLevel(idx){
  currentLevelIdx = idx;
  // idx === -1 ise prosedürel üretilmiş bölüm oynanıyor demektir
  level = (idx === -1 && generatedLevel) ? generatedLevel : LEVELS[idx];
  if(!level) return;
  if(idx !== -1) generatedLevel = null;
  levelPaths = levelRoutes(level);
  pathLens = levelPaths.map(p=>computePathLength(p));
  pathTotalLen = pathLens.length ? Math.max(...pathLens) : 0;
  pathDecor = levelPaths.map((p,i)=>buildPathDecor(p, pathLens[i]));
  spots = level.spots.map(s=>({x:s.x,y:s.y,occ:null}));
  gold = level.startGold;
  lives = level.startLives;
  startLivesEffective = lives;   // yıldız hesabı için taban
  resetSessionShop();            // progress.js — bölüm içi alımlar sıfırlanır
  waveIndex = 0;
  waveActive=false; gameOver=false; gameWon=false;
  towers=[]; enemies=[]; projectiles=[]; particles=[]; floatTexts=[]; explosions=[]; arcs=[]; healZones=[]; debris=[]; beams=[];
  towerPurchaseCounts = {};
  spawnTimeline=[]; waveElapsed=0; shake=0;
  seenEnemyTypes = new Set();
  birds = []; scheduleNextBird();
  paused = false;
  hideWaveToast(); // ui.js
  closeBuildConfirm();
  document.getElementById('shopOverlay').classList.remove('show');
  setWaveBtnReady(true); // ui.js — ilk dalgaya davet
  document.getElementById('pauseOverlay').classList.remove('show');
  syncPauseToggleBtn();
  document.getElementById('goldVal').textContent = gold;
  document.getElementById('livesVal').textContent = lives;
  document.getElementById('waveVal').textContent = waveIndex;
  document.getElementById('waveMax').textContent = level.waveCount;
  document.getElementById('overlay').classList.remove('show');
  closeTowerPanel();
  if(typeof closeTowerDrawer === 'function') closeTowerDrawer();
  if(typeof resetTowerDrawerHint === 'function') resetTowerDrawerHint();   // ui.js — kayma ipucu her bölümde bir kez tekrar oynasın
  if(typeof updateLevelNavVisibility === 'function') updateLevelNavVisibility();   // GEÇİCİ (main.js)
  renderTowerSelectBtn(); renderTowerDrawer();  // ui.js — kalan-sayı rozetleri yeni bölümle sıfırlansın
  renderWavePreview();    // ui.js

  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js — mevsim/hava katmanı

  // Mevsim/biyom etkisi varsa oyuncuya kısaca bildir
  if(level.mods && level.mods.notes && level.mods.notes.length){
    showWaveToast(level.mods.labels.join(' · '));  // ui.js
  }
}

function syncPauseToggleBtn(){
  const btn = document.getElementById('pauseToggleBtn');
  if(!btn) return;
  btn.textContent = paused ? '▶' : '⏸';
  // Duraklatınca oynat ikonu yanıp sönsün — üst bar/alt bar hiçbir
  // overlay ile kapanmadığı için bu, oyuncunun hâlâ durduğunu
  // fark etmesinin tek sürekli görsel ipucu.
  btn.classList.toggle('blinking', paused);
}

/* Alt bardaki saf duraklat/devam — MENÜ AÇMAZ. Oyuncu simülasyonu
   durdurup ekrana bakarak strateji kurabilsin diye; bir önceki
   tasarımda duraklatma her zaman menüyü de açıp görüşü kapatıyordu. */
function toggleSimPause(){
  if(gameOver||gameWon) return;
  // Market açıkken bu buton oyunu devam ettirmesin — üst/alt bar
  // hiçbir overlay tarafından kapatılmadığı için market açıkken bile
  // tıklanabiliyor, ama market açıkken oyun HER ZAMAN duraklı kalmalı.
  if(document.getElementById('shopOverlay').classList.contains('show')) return;
  paused = !paused;
  if(paused) playPauseSfx(); else playResumeSfx();   // audio.js
  if(!paused) document.getElementById('pauseOverlay').classList.remove('show');
  syncPauseToggleBtn();
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js
  if(!paused) lastTime = performance.now();
}

/* Üst bardaki ☰ artık menü butonu: her zaman duraklatıp pause menüsünü
   açar (menüye basmak = duraklatmak, bu ikisi ayrılmaz). */
function openPauseMenu(){
  if(gameOver||gameWon) return;
  playPauseSfx();   // audio.js
  paused = true;
  document.getElementById('pauseOverlay').classList.add('show');
  syncPauseToggleBtn();
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js
  renderPauseLevelInfo(); // ui.js — bölüm adı + zorluk/macera/boss noktaları
}

/* Pause menüsündeki "Devam Et" — hem menüyü kapatır hem devam ettirir.
   İSTİSNA: market menü üzerinden açılıp arkada kalmışsa (☰ market
   açıkken de basılabiliyor) devam ettirme — market kapanana kadar
   oyun duraklı kalmalı, yoksa market açıkken oyun arkada koşuyordu. */
function resumeFromMenu(){
  playResumeSfx();   // audio.js
  document.getElementById('pauseOverlay').classList.remove('show');
  if(!document.getElementById('shopOverlay').classList.contains('show')){
    paused = false;
    lastTime = performance.now();
  }
  syncPauseToggleBtn();
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js
}

function goToMainMenu(){
  playMenuTap();
  hideWaveToast(); // ui.js
  closeBuildConfirm();
  document.getElementById('shopOverlay').classList.remove('show');
  document.getElementById('pauseOverlay').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  paused = true;
  syncPauseToggleBtn();
  closeTowerPanel();
  if(typeof closeTowerDrawer === 'function') closeTowerDrawer();
  openStartScreen(); // ui.js
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js
}

function startWave(){
  if(waveActive||gameOver||gameWon||paused) return;
  waveIndex++;
  document.getElementById('waveVal').textContent = waveIndex;
  const groups = level.generated
    ? generateWaveForGenerated(level, waveIndex)   // levelgen.js
    : generateWave(level, waveIndex);              // config.js
  const mult = statMultipliers(level, waveIndex);
  const m = levelMods();
  // bunchIntervalMult (config.js): bölümün ikinci yarısından itibaren
  // düşmanlar birbirine daha yakın gelsin diye spawn aralığı kısaltılır.
  const bunch = bunchIntervalMult(waveIndex, level.waveCount);
  spawnTimeline=[]; let t=0;
  let routeCursor = 0;
  const routeCount = Math.max(1, levelPaths.length);
  groups.forEach(g=>{
    const def = ENEMY_TYPES[g.type];
    seenEnemyTypes.add(g.type);
    // denseIntervalMult (config.js): 8. dalgadan itibaren hafif
    // türler birbirine daha yakın doğsun diye ek kısaltma.
    const dense = denseIntervalMult(g.type, waveIndex);
    /* crowdCountMult (config.js): 13. dalgadan itibaren %20 daha çok
       düşman. Adım, İSTENEN değil GERÇEKLEŞEN sayı oranıyla bölünüyor
       (yuvarlama yüzünden ikisi aynı olmayabilir); grup n adım
       tükettiğinden count/step çarpımı sabit kalır, yani grubun
       süresi birebir korunur. */
    const count = crowdCount(g.type, g.count, waveIndex);
    const step = g.interval * bunch * dense * (g.count / count);
    for(let i=0;i<count;i++){
      /* hpTiers (bkz. ENEMY_TYPES.flask): aynı türden birimler farklı
         dayanıklılıkta gelsin diye seçilen kat. Tanımı olmayan
         türlerde 1, yani hiçbir şey değişmez. */
      const tier = def.hpTiers
        ? def.hpTiers[Math.floor(Math.random()*def.hpTiers.length)]
        : 1;
      spawnTimeline.push({
        // spawnJitter (config.js): doğuşlar bant üzerinde gibi değil,
        // birbirinden bağımsız küçük gecikmelerle gelsin.
        t: t + spawnJitter(step), type:g.type,
        // Birden çok giriş varsa düşmanlar sırayla rotalara paylaştırılır
        pathIdx: routeCount>1 ? (routeCursor++ % routeCount) : 0,
        hp: def.hp*mult.hp*tier, maxHp: def.hp*mult.hp*tier, hpTier: tier,
        speed: def.speed*mult.speed*m.enemySpeedMul,
        // Kat, gövdeyi de büyütür: 1x -> 15, 2x -> 17, 3x -> 19 yarıçap.
        // Oyuncu hangi şişenin sert olduğunu vurmadan önce görsün.
        radius: Math.round(def.radius * (1 + (tier-1)*0.13)),
        body:def.body, body2:def.body2, shape:def.shape, eyes:def.eyes,
        // Üç kat emek isteyen birim üç kat da ödesin
        gold: Math.max(1, Math.round(def.gold*m.goldMul*tier)), dmgToLives: def.dmgToLives,
        boss: !!def.boss, label: def.label,
        auraRadius: def.auraRadius || 0, auraSlow: def.auraSlow || 0,
        allyBuffTypes: def.allyBuffTypes || null, allySpeedBuff: def.allySpeedBuff || 0, allyDmgResist: def.allyDmgResist || 0,
        healRadius: def.healRadius || 0, healPerSec: def.healPerSec || 0, healDuration: def.healDuration || 0,
        blockArc: def.blockArc || 0,
        // ZIRHLI plakası — can gibi dalga çarpanıyla ölçeklenir,
        // yoksa geç dalgalarda kâğıttan kalırdı.
        armor: (def.armorHp || 0) * mult.hp,
        armorMax: (def.armorHp || 0) * mult.hp,
        armorSoak: def.armorSoak || 0,
        broodEvery: def.broodEvery || 0, broodType: def.broodType || null, broodMax: def.broodMax || 0, broodT: 0, broodCount: 0,
        overloadSec: def.overloadSec || 0, overloadChance: def.overloadChance || 0,
        splitsLeft: def.splits || 0,
        splitsTotal: def.splits || 0,
        baseSpeed: def.speed*mult.speed*m.enemySpeedMul,
        splitSpeedMults: def.splitSpeedMults || null,
        splitHpFactor: def.splitHpFactor || 0.4,
        splitSizeFactor: def.splitSizeFactor || 0.4,
        splitSpeedFactor: def.splitSpeedFactor || 1.12,
        minRadius: def.minRadius || 6,
        wobbleAmp: def.wobble || 0,
      });
      t += step;
    }
    t += GROUP_GAP * bunch; // config.js — gruplar arası nefes payı
  });

  /* Son güvence: rastgele gecikme çakışmaların çoğunu ayırır ama
     hepsini değil. Sıraladıktan sonra araya en az SPAWN_MIN_GAP
     konur — böylece hiçbir iki düşman aynı anda belirmez. Sıra
     önemli değil (updateWaveProgress her kare tüm listeyi tarar),
     sıralama yalnızca bu geçiş için gerekli. */
  spawnTimeline.sort((a,b)=>a.t-b.t);
  for(let i=1;i<spawnTimeline.length;i++){
    const prev = spawnTimeline[i-1].t;
    if(spawnTimeline[i].t - prev < SPAWN_MIN_GAP) spawnTimeline[i].t = prev + SPAWN_MIN_GAP;
  }
  waveElapsed=0; waveActive=true;
  setWaveBtnReady(false); // ui.js
  saveResume(currentLevelIdx, waveIndex);
  playWaveStart();
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js — savaş katmanı girsin
  renderWavePreview();   // ui.js
}

function endGame(win){
  gameOver=!win; gameWon=win;
  hideWaveToast(); // ui.js
  closeBuildConfirm();
  document.getElementById('shopOverlay').classList.remove('show');
  setWaveBtnReady(false); // ui.js
  closeTowerPanel();
  if(typeof closeTowerDrawer === 'function') closeTowerDrawer();
  const overlay=document.getElementById('overlay');
  const h=document.getElementById('overlayTitle'), p=document.getElementById('overlayText');
  const starsEl = document.getElementById('overlayStars');
  if(win){
    const frac = lives/startLivesEffective;
    const stars = frac>=0.8 ? 3 : (frac>=0.4 ? 2 : 1);
    const prev = getLevelProgress(level.id);
    updateLevelProgress(level.id, stars, level.waveCount);
    // Elmas ödülü: yalnızca yeni kazanılan yıldızlar için verilir,
    // böylece aynı bölümü tekrar oynayıp sonsuz elmas kasılamaz.
    const newStars = Math.max(0, stars - prev.bestStars);
    if(newStars>0){
      addGems(newStars*5);
      // Zafer fanfarının üstüne binmesin diye ödül sesi biraz gecikir
      setTimeout(playGem, 900);                       // audio.js
      // Bu bölüm ilk kez yıldızlandıysa sıradaki bölümün kilidi açıldı
      if(prev.bestStars === 0 && !level.generated && LEVELS[currentLevelIdx+1]){
        setTimeout(playLevelUnlock, 1500);            // audio.js
      }
    }
    clearResume();
    h.textContent='Bölüm Tamamlandı'; h.className='win';
    p.textContent = newStars>0
      ? `${level.name} temizlendi — +${newStars*5} 💎`
      : `${level.name} temizlendi — ${gold} altınla`;
    starsEl.textContent = renderStars(stars);
    playVictory();
  } else {
    updateLevelProgress(level.id, 0, waveIndex);
    h.textContent='Röle Düştü'; h.className='lose';
    p.textContent=`Dalga ${waveIndex}/${level.waveCount}'de yenildin`;
    starsEl.textContent = '';
    playDefeat();
  }
  overlay.classList.add('show');
  if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js — savaş katmanı sussun

  // Kazanıldıysa ve sıradaki bölüm varsa doğrudan geçiş butonu göster
  const nextBtn = document.getElementById('nextLevelBtn');
  if(nextBtn){
    let hasNext = false, label = '';
    if(level.generated){
      hasNext = win && level.levelNo < GEN.TOTAL_LEVELS;
      label = 'Bölüm ' + (level.levelNo+1) + ' →';
    } else {
      hasNext = win && !!LEVELS[currentLevelIdx+1];
      if(hasNext) label = LEVELS[currentLevelIdx+1].name + ' →';
    }
    nextBtn.style.display = hasNext ? '' : 'none';
    if(hasNext) nextBtn.textContent = label;
  }
}
