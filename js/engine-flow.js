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
  playMenuTap();
  if(!paused) document.getElementById('pauseOverlay').classList.remove('show');
  syncPauseToggleBtn();
  if(!paused) lastTime = performance.now();
}

/* Üst bardaki ☰ artık menü butonu: her zaman duraklatıp pause menüsünü
   açar (menüye basmak = duraklatmak, bu ikisi ayrılmaz). */
function openPauseMenu(){
  if(gameOver||gameWon) return;
  playMenuTap();
  paused = true;
  document.getElementById('pauseOverlay').classList.add('show');
  syncPauseToggleBtn();
  renderPauseLevelInfo(); // ui.js — bölüm adı + zorluk/macera/boss noktaları
}

/* Pause menüsündeki "Devam Et" — hem menüyü kapatır hem devam ettirir.
   İSTİSNA: market menü üzerinden açılıp arkada kalmışsa (☰ market
   açıkken de basılabiliyor) devam ettirme — market kapanana kadar
   oyun duraklı kalmalı, yoksa market açıkken oyun arkada koşuyordu. */
function resumeFromMenu(){
  playMenuTap();
  document.getElementById('pauseOverlay').classList.remove('show');
  if(!document.getElementById('shopOverlay').classList.contains('show')){
    paused = false;
    lastTime = performance.now();
  }
  syncPauseToggleBtn();
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
    for(let i=0;i<g.count;i++){
      spawnTimeline.push({
        t, type:g.type,
        // Birden çok giriş varsa düşmanlar sırayla rotalara paylaştırılır
        pathIdx: routeCount>1 ? (routeCursor++ % routeCount) : 0,
        hp: def.hp*mult.hp, maxHp: def.hp*mult.hp,
        speed: def.speed*mult.speed*m.enemySpeedMul,
        radius: def.radius, body:def.body, body2:def.body2, shape:def.shape, eyes:def.eyes,
        gold: Math.max(1, Math.round(def.gold*m.goldMul)), dmgToLives: def.dmgToLives,
        boss: !!def.boss, label: def.label,
        auraRadius: def.auraRadius || 0, auraSlow: def.auraSlow || 0,
        allyBuffTypes: def.allyBuffTypes || null, allySpeedBuff: def.allySpeedBuff || 0, allyDmgResist: def.allyDmgResist || 0,
        healRadius: def.healRadius || 0, healPerSec: def.healPerSec || 0, healDuration: def.healDuration || 0,
        blockArc: def.blockArc || 0,
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
      t += g.interval * bunch;
    }
    t += GROUP_GAP * bunch; // config.js — gruplar arası nefes payı
  });
  waveElapsed=0; waveActive=true;
  setWaveBtnReady(false); // ui.js
  saveResume(currentLevelIdx, waveIndex);
  playWaveStart();
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
    if(newStars>0) addGems(newStars*5);
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
