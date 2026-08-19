/* ============================================================
   MOTOR — oyun durumu ve simülasyon mantığı.
   config.js'e (veri) ve ui.js'e (HUD render) bağımlıdır.
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const LW = 600, LH = 1000;
let dpr = 1;

function setupCanvasDPR(){
  dpr = Math.max(1, Math.min(window.devicePixelRatio||1, 2.5));
  canvas.width = LW*dpr; canvas.height = LH*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
setupCanvasDPR();
window.addEventListener('resize', setupCanvasDPR);
window.addEventListener('orientationchange', ()=>setTimeout(setupCanvasDPR,200));

/* ---- Arka plan çim dokusu (bir kez üretilir) ---- */
const bgCanvas = document.createElement('canvas');
bgCanvas.width = LW; bgCanvas.height = LH;
(function bakeGrass(){
  const bctx = bgCanvas.getContext('2d');
  const g = bctx.createLinearGradient(0,0,0,LH);
  g.addColorStop(0,'#2f5233'); g.addColorStop(1,'#213b26');
  bctx.fillStyle = g; bctx.fillRect(0,0,LW,LH);
  for(let i=0;i<160;i++){
    const x=Math.random()*LW, y=Math.random()*LH, r=14+Math.random()*40;
    bctx.beginPath(); bctx.arc(x,y,r,0,Math.PI*2);
    bctx.fillStyle = Math.random()>0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    bctx.fill();
  }
  for(let i=0;i<70;i++){
    const x=Math.random()*LW, y=Math.random()*LH;
    bctx.beginPath();
    bctx.ellipse(x,y,3,7,Math.random()*Math.PI,0,Math.PI*2);
    bctx.fillStyle='rgba(20,50,25,0.35)'; bctx.fill();
  }
  for(let i=0;i<10;i++){
    const x=Math.random()*LW, y=Math.random()*LH, r=5+Math.random()*6;
    bctx.beginPath(); bctx.ellipse(x,y,r,r*0.6,0,0,Math.PI*2);
    bctx.fillStyle='rgba(140,140,120,0.5)'; bctx.fill();
    bctx.strokeStyle='rgba(0,0,0,0.3)'; bctx.lineWidth=1; bctx.stroke();
  }
})();

let currentLevelIdx = 0;
let level = LEVELS[0];
let pathTotalLen = 0;
let pathDecor = [];

function computePathLength(path){
  let len=0;
  for(let i=0;i<path.length-1;i++) len += Math.hypot(path[i+1].x-path[i].x, path[i+1].y-path[i].y);
  return len;
}
function pointAtDistance(path, totalLen, d){
  let remaining = Math.max(0, Math.min(d, totalLen));
  for(let i=0;i<path.length-1;i++){
    const a=path[i], b=path[i+1];
    const segLen = Math.hypot(b.x-a.x, b.y-a.y);
    if(remaining <= segLen || i===path.length-2){
      const t = segLen===0?0: Math.min(remaining/segLen,1);
      return {x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t};
    }
    remaining -= segLen;
  }
  return path[path.length-1];
}
function buildPathDecor(path, totalLen){
  const decor=[];
  const step = 26;
  for(let d=0; d<totalLen; d+=step){
    if(Math.random()>0.6){
      const p = pointAtDistance(path,totalLen,d);
      const side = Math.random()>0.5?1:-1;
      decor.push({x:p.x+side*(20+Math.random()*6), y:p.y+(Math.random()-0.5)*10, r:2+Math.random()*2.5});
    }
  }
  return decor;
}

let gold, lives, waveIndex, waveActive, gameOver, gameWon;
let startLivesEffective = 10;
let towers, enemies, projectiles, particles, floatTexts, explosions, arcs;
let spawnTimeline, waveElapsed;
let shake = 0;
let spots = [];
let selectedType = 'archer';
let seenEnemyTypes = new Set();
let paused = false;
let gameSpeed = 1;
let selectedTower = null;
let towerPanelOpen = false;
let activeTowerRing = null; // tek tıkla menzil önizlemesi (panel açmadan)
let pressProgressTower = null;  // basılı tutulan kule (ilerleme halkası için)
let pressProgressStart = 0;     // basılı tutmanın başladığı zaman damgası
const LONG_PRESS_MS = 500;      // yükseltme panelini açmak için gereken basılı tutma süresi
let sellConfirmPending = false;

const UPGRADE_COST_MULT = [0.6, 0.9, 1.3]; // level0->1, level1->2, level2->3

/* İnşa/yükseltme süreleri (saniye).
   BUILD_TIMES[0] = ilk kurulum, [1] = 2. seviye, [2] = 3. seviye.
   Market'teki "Hızlı İnşaat" yükseltmesi bu süreleri kısaltır. */
const BUILD_TIMES = [4, 6, 8];
function buildDurationFor(levelAfter){
  const base = BUILD_TIMES[Math.max(0, Math.min(levelAfter, BUILD_TIMES.length-1))];
  return base * shopBuildFactor();   // progress.js
}

function upgradeCost(t){
  const lvl = t.level||0;
  if(lvl>=3) return null;
  return Math.round(t.def.cost * UPGRADE_COST_MULT[lvl]);
}
function getTowerStats(t){
  const lvl = t.level||0;
  let range = t.def.range * (1+lvl*0.10);
  // Mantar Havanı son seviyede ek menzil kazanır (uzun menzilli topçu rolü)
  if(t.def.kind==='mortar' && lvl>=3) range += 25;
  return {
    dmg: t.def.dmg * (1+lvl*0.28),
    range: range,
    rate: t.def.rate * (1-lvl*0.15),
    splash: t.def.splash ? t.def.splash*(1+lvl*0.10) : 0,
    poisonDps: t.def.poisonDps ? t.def.poisonDps*(1+lvl*0.30) : 0,
    poisonDuration: t.def.poisonDuration || 0,
    chainCount: t.def.chainCount ? t.def.chainCount + lvl : 0,
    chainFalloff: t.def.chainFalloff || 0.6,
    chainRange: t.def.chainRange ? t.def.chainRange*(1+lvl*0.10) : 0,
  };
}
/* Menzil içindeki düşmanlardan, kulenin hedefleme moduna göre birini seçer.
   'first'     : yola en çok ilerlemiş (çıkışa en yakın) — varsayılan
   'weakest'   : en az canı kalan
   'strongest' : en çok canı kalan */
function pickTarget(t, range){
  let best=null, bestScore=-Infinity;
  const mode = t.targetMode || 'first';
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    if(Math.hypot(e.x-t.x, e.y-t.y) > range) continue;
    let score;
    if(mode==='weakest')        score = -e.hp;
    else if(mode==='strongest') score = e.hp;
    else                        score = e.dist; // yolda en ileri olan
    if(score > bestScore){ bestScore = score; best = e; }
  }
  return best;
}

/* Boss auralarının kule üzerindeki etkisi.
   Dönen değer atış aralığı çarpanıdır: 1 = normal, 2 = iki kat yavaş.
   Birden fazla aura üst üste binerse en güçlüsü uygulanır (çarpışmaz). */
function towerRateMultiplier(t){
  let worst = 0;
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    if(!e.auraRadius) continue;
    if(Math.hypot(e.x-t.x, e.y-t.y) <= e.auraRadius){
      if(e.auraSlow > worst) worst = e.auraSlow;
    }
  }
  t.chilled = worst > 0;
  return worst > 0 ? 1/(1-worst) : 1;   // %50 yavaş => aralık 2 katı
}

function setTargetMode(id){
  if(!selectedTower) return;
  selectedTower.targetMode = id;
  playMenuTap();
  renderTowerPanel();
}

function openTowerPanel(t){
  selectedTower = t; towerPanelOpen = true; sellConfirmPending = false;
  activeTowerRing = null;
  renderTowerPanel(); // ui.js
}
function closeTowerPanel(){
  towerPanelOpen = false; selectedTower = null; sellConfirmPending = false;
  activeTowerRing = null;
  const panel = document.getElementById('towerPanel');
  if(panel) panel.classList.remove('show');
}
function doUpgradeTower(){
  if(!selectedTower) return;
  const t = selectedTower;
  if(t.buildLeft > 0){ playError(); return; } // zaten inşa halinde
  const cost = upgradeCost(t);
  if(cost===null || gold<cost){ playError(); return; }
  gold -= cost;
  t.totalSpent += cost;
  document.getElementById('goldVal').textContent = gold;
  // Seviye hemen artmaz — inşa süresi dolunca uygulanır.
  const nextLevel = (t.level||0)+1;
  t.pendingLevel = nextLevel;
  t.buildDuration = buildDurationFor(nextLevel);
  t.buildLeft = t.buildDuration;
  playMenuTap();
  renderTowerPanel();
}
function requestSellTower(){ sellConfirmPending=true; playClick(); renderTowerPanel(); }
function cancelSellTower(){ sellConfirmPending=false; renderTowerPanel(); }
function confirmSellTower(){
  if(!selectedTower) return;
  const refund = Math.floor(selectedTower.totalSpent/2);
  gold += refund;
  towers = towers.filter(t=>t!==selectedTower);
  spots.forEach(s=>{ if(s.occ===selectedTower) s.occ=null; });
  document.getElementById('goldVal').textContent = gold;
  playCoin();
  closeTowerPanel();
}

const SPEED_STEPS = [1, 2, 4];
function toggleSpeed(){
  const idx = SPEED_STEPS.indexOf(gameSpeed);
  gameSpeed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
  playClick();
  const btn = document.getElementById('speedBtn');
  btn.textContent = gameSpeed+'×';
  btn.classList.toggle('active', gameSpeed === 2);
  btn.classList.toggle('turbo', gameSpeed >= 4);
}

function loadLevel(idx){
  currentLevelIdx = idx;
  level = LEVELS[idx];
  pathTotalLen = computePathLength(level.path);
  pathDecor = buildPathDecor(level.path, pathTotalLen);
  spots = level.spots.map(s=>({x:s.x,y:s.y,occ:null}));
  gold = level.startGold + shopBonusGold();
  lives = level.startLives + shopBonusLives();
  startLivesEffective = lives;   // yıldız hesabı bonus canı da hesaba katsın
  waveIndex = 0;
  waveActive=false; gameOver=false; gameWon=false;
  towers=[]; enemies=[]; projectiles=[]; particles=[]; floatTexts=[]; explosions=[]; arcs=[];
  spawnTimeline=[]; waveElapsed=0; shake=0;
  seenEnemyTypes = new Set();
  paused = false;
  hideWaveToast(); // ui.js
  setWaveBtnReady(true); // ui.js — ilk dalgaya davet
  document.getElementById('pauseOverlay').classList.remove('show');
  document.getElementById('pauseBtn').textContent = '⏸';
  document.getElementById('goldVal').textContent = gold;
  document.getElementById('livesVal').textContent = lives;
  document.getElementById('waveVal').textContent = waveIndex;
  document.getElementById('waveMax').textContent = level.waveCount;
  document.getElementById('overlay').classList.remove('show');
  closeTowerPanel();
  if(typeof closeTowerDrawer === 'function') closeTowerDrawer();
  renderWavePreview();    // ui.js
}

function togglePause(){
  if(gameOver||gameWon) return;
  paused = !paused;
  playMenuTap();
  document.getElementById('pauseOverlay').classList.toggle('show', paused);
  document.getElementById('pauseBtn').textContent = paused ? '▶' : '⏸';
  if(!paused) lastTime = performance.now();
}

function goToMainMenu(){
  playMenuTap();
  hideWaveToast(); // ui.js
  document.getElementById('pauseOverlay').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  paused = true;
  document.getElementById('pauseBtn').textContent = '▶';
  closeTowerPanel();
  if(typeof closeTowerDrawer === 'function') closeTowerDrawer();
  openStartScreen(); // ui.js
}

function startWave(){
  if(waveActive||gameOver||gameWon||paused) return;
  waveIndex++;
  document.getElementById('waveVal').textContent = waveIndex;
  const groups = generateWave(level, waveIndex);
  const mult = statMultipliers(level, waveIndex);
  spawnTimeline=[]; let t=0;
  groups.forEach(g=>{
    const def = ENEMY_TYPES[g.type];
    seenEnemyTypes.add(g.type);
    for(let i=0;i<g.count;i++){
      spawnTimeline.push({
        t, type:g.type,
        hp: def.hp*mult.hp, maxHp: def.hp*mult.hp,
        speed: def.speed*mult.speed,
        radius: def.radius, body:def.body, body2:def.body2, shape:def.shape, eyes:def.eyes,
        gold: def.gold, dmgToLives: def.dmgToLives,
        boss: !!def.boss, label: def.label,
        auraRadius: def.auraRadius || 0, auraSlow: def.auraSlow || 0,
        splitsLeft: def.splits || 0,
        splitsTotal: def.splits || 0,
        baseSpeed: def.speed*mult.speed,
        splitSpeedMults: def.splitSpeedMults || null,
        splitHpFactor: def.splitHpFactor || 0.4,
        splitSizeFactor: def.splitSizeFactor || 0.4,
        splitSpeedFactor: def.splitSpeedFactor || 1.12,
        minRadius: def.minRadius || 6,
        wobbleAmp: def.wobble || 0,
      });
      t += g.interval;
    }
    t += GROUP_GAP; // config.js — gruplar arası nefes payı
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
}

/* ---- Update (delta-time tabanlı) ---- */
let lastTime = performance.now();

function update(dt){
  if(gameOver||gameWon) return;

  if(waveActive){
    waveElapsed += dt;
    let pending=false;
    spawnTimeline.forEach(entry=>{
      if(!entry.spawned){
        if(entry.t<=waveElapsed){
          entry.spawned=true;
          enemies.push({
            ...entry, dist:0, flashT:0,
            bounce:Math.random()*10, slowT:0, slowFactor:1,
            // Her birim kendi salınım fazı/frekansı/genliğiyle doğar;
            // aksi halde aynı anda doğanlar senkronize hareket eder.
            wobbleT: Math.random()*Math.PI*2,
            wobbleSeed: Math.random()*2.2,
            wobbleScale: 0.65 + Math.random()*0.7,
            wobblePhase2: Math.random()*Math.PI*2,
            spin: Math.random()*Math.PI*2,
            spinDir: Math.random()<0.5 ? -1 : 1,
          });
        }
        else pending=true;
      }
    });
    if(!pending && enemies.length===0){
      waveActive=false;
      if(waveIndex>=level.waveCount){ endGame(true); return; }
      showWaveToast(`Dalga ${waveIndex} Tamamlandı!`); // ui.js
      setWaveBtnReady(true); // ui.js
      renderWavePreview();   // ui.js
    }
  }

  enemies.forEach(e=>{
    const slowMult = e.slowT>0 ? e.slowFactor : 1;
    e.dist += e.speed*slowMult*dt*60;
    const p = pointAtDistance(level.path, pathTotalLen, e.dist);
    const p2 = pointAtDistance(level.path, pathTotalLen, e.dist+2);
    e.x=p.x; e.y=p.y;
    e.angle = Math.atan2(p2.y-p.y, p2.x-p.x);

    // "Deli gibi" hareket: yolun eksenine dik, düzensiz salınım.
    // İki farklı frekansın toplamı düzenli bir sinüsten çok daha
    // öngörülemez görünür.
    if(e.wobbleAmp){
      e.wobbleT = (e.wobbleT||0) + dt*(3.2 + (e.wobbleSeed||0));
      // Üç farklı frekansın toplamı + birime özel faz kayması:
      // aynı anda doğan birimler bile birbirinden bağımsız savrulur.
      const ph = e.wobblePhase2 || 0;
      const off = Math.sin(e.wobbleT)*0.55
                + Math.sin(e.wobbleT*2.7 + 1.3 + ph)*0.3
                + Math.sin(e.wobbleT*0.61 + ph*2)*0.25;
      const len = Math.hypot(p2.x-p.x, p2.y-p.y) || 1;
      const nx = -(p2.y-p.y)/len, ny = (p2.x-p.x)/len;   // dik vektör
      const amp = e.wobbleAmp * (e.wobbleScale || 1);
      e.x += nx*off*amp;
      e.y += ny*off*amp;
      e.spin = (e.spin||0) + dt*(2.5 + off*2) * (e.spinDir || 1);
    }

    e.bounce += dt*e.speed*slowMult*9;
    if(e.flashT>0) e.flashT -= dt*3;
    if(e.slowT>0) e.slowT -= dt;
    // ZEHİR: süre boyunca saniyede poisonDps kadar hasar
    if(e.poisonT > 0){
      e.poisonT -= dt;
      e.hp -= (e.poisonDps||0) * dt;
      if(e.poisonT <= 0){ e.poisonT = 0; e.poisonDps = 0; }
    }
  });

  arcs.forEach(a=>{ a.life -= dt; });
  arcs = arcs.filter(a=>a.life > 0);

  const reached = enemies.filter(e=>e.dist>=pathTotalLen);
  if(reached.length){
    let dmg=0; reached.forEach(e=>dmg+=e.dmgToLives);
    lives-=dmg; shake=Math.min(shake+8,16);
    enemies = enemies.filter(e=>e.dist<pathTotalLen);
    document.getElementById('livesVal').textContent = Math.max(lives,0);
    if(lives<=0){ endGame(false); return; }
  }

  towers.forEach(t=>{
    // İnşa/yükseltme sürüyorsa kule çalışmaz; süre dolunca devreye girer.
    if(t.buildLeft > 0){
      t.buildLeft -= dt;
      if(t.buildLeft <= 0){
        t.buildLeft = 0;
        // Yükseltme tamamlandı: seviyeyi şimdi uygula ve kutla.
        if(t.pendingLevel !== undefined && t.pendingLevel !== null){
          t.level = t.pendingLevel;
          t.pendingLevel = null;
          for(let i=0;i<20;i++){
            const ang = (i/20)*Math.PI*2;
            particles.push({x:t.x,y:t.y-6,vx:Math.cos(ang)*90,vy:Math.sin(ang)*90-30,life:0.55,color:'#f4c04a'});
          }
          floatTexts.push({x:t.x,y:t.y-26,text:'SEVİYE '+t.level,life:0.9,vy:-28,color:'#f4c04a'});
        } else {
          for(let i=0;i<10;i++){
            const ang=(i/10)*Math.PI*2;
            particles.push({x:t.x,y:t.y+4,vx:Math.cos(ang)*60,vy:Math.sin(ang)*40-20,life:0.4,color:'#c9a463'});
          }
        }
        playPlace();
        if(towerPanelOpen && selectedTower===t) renderTowerPanel();
      }
      return; // inşa bitene kadar ateş etme
    }

    const st = getTowerStats(t);
    const rateMult = towerRateMultiplier(t);
    t.cooldown = Math.max(0, t.cooldown-dt);
    if(t.cooldown<=0){
      const target = pickTarget(t, st.range);
      if(target){
        const dist0 = Math.hypot(target.x-t.x, target.y-t.y);
        projectiles.push({x:t.x,y:t.y-20,target,dmg:st.dmg,splash:st.splash,kind:t.def.kind,
          speed:t.def.kind==='mortar'?4.2:(t.def.kind==='bolt'?11:7),travel:dist0,
          slow:t.def.slowFactor,slowDuration:t.def.slowDuration,
          poisonDps:st.poisonDps, poisonDuration:st.poisonDuration,
          chainCount:st.chainCount, chainFalloff:st.chainFalloff, chainRange:st.chainRange});
        t.cooldown = st.rate * rateMult;
        t.pulse = 1;
        t.angle = Math.atan2(target.y-t.y, target.x-t.x);
        playShoot(t.def.kind);
      }
    }
    if(t.pulse>0) t.pulse = Math.max(0,t.pulse-dt*2.5);
  });

  projectiles.forEach(p=>{
    if(!enemies.includes(p.target)){ p.dead=true; return; }
    const dx=p.target.x-p.x, dy=p.target.y-p.y, d=Math.hypot(dx,dy);
    const step = p.speed*dt*60;
    if(d < step+2){
      const ix=p.target.x, iy=p.target.y;
      if(p.splash>0){
        enemies.forEach(e=>{
          if(Math.hypot(e.x-ix,e.y-iy)<=p.splash){
            e.hp -= p.dmg; e.flashT=1;
          }
        });
        explosions.push({x:ix,y:iy,r:4,maxR:p.splash,life:0.35});
        shake=Math.min(shake+4,10);
        for(let i=0;i<16;i++) particles.push({x:ix,y:iy,vx:(Math.random()-0.5)*160,vy:(Math.random()-0.5)*160,life:0.4,color:'#e8a94a'});
      } else {
        if(p.dmg > 0){
          p.target.hp -= p.dmg; p.target.flashT=1;
          floatTexts.push({x:p.x,y:p.y,text:'-'+Math.round(p.dmg),life:0.6,vy:-30,color:p.kind==='mage'?'#b6f0e0':'#ffe3c2'});
        }
        if(p.slow){
          p.target.slowT = p.slowDuration;
          p.target.slowFactor = p.slow;
          if(p.dmg <= 0) p.target.flashT = 0.6;
        }
        // ZEHİR: hedefe zamana yayılı hasar yükle (en güçlü etki geçerli)
        if(p.poisonDps > 0){
          if(!(p.target.poisonDps > p.poisonDps)){
            p.target.poisonDps = p.poisonDps;
          }
          p.target.poisonT = Math.max(p.target.poisonT||0, p.poisonDuration);
        }
        // ŞİMŞEK: hedeften yakındaki düşmanlara sıçra
        if(p.chainCount > 0){
          let cur = p.target;
          let dmg = p.dmg;
          const hitSet = new Set([cur]);
          for(let c=0;c<p.chainCount;c++){
            let next=null, bestD=Infinity;
            for(let i=0;i<enemies.length;i++){
              const e = enemies[i];
              if(hitSet.has(e)) continue;
              const d = Math.hypot(e.x-cur.x, e.y-cur.y);
              if(d <= p.chainRange && d < bestD){ bestD=d; next=e; }
            }
            if(!next) break;
            dmg *= p.chainFalloff;
            next.hp -= dmg; next.flashT = 1;
            arcs.push({x1:cur.x, y1:cur.y, x2:next.x, y2:next.y, life:0.22});
            floatTexts.push({x:next.x,y:next.y,text:'-'+Math.round(dmg),life:0.5,vy:-26,color:'#fff3a8'});
            hitSet.add(next);
            cur = next;
          }
        }
        for(let i=0;i<5;i++) particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*90,vy:(Math.random()-0.5)*90,life:0.35,
          color:p.kind==='mage'?'#8fe3cc':(p.kind==='ice'?'#bfeeff':(p.kind==='poison'?'#b9ea78':(p.kind==='bolt'?'#fff3a8':'#c9a56a')))});
      }
      p.dead=true;
    } else {
      p.x += dx/d*step; p.y += dy/d*step;
    }
  });
  projectiles = projectiles.filter(p=>!p.dead);

  explosions.forEach(x=>{ x.life-=dt; x.r += (x.maxR-x.r)*0.3; });
  explosions = explosions.filter(x=>x.life>0);

  const dead = enemies.filter(e=>e.hp<=0);
  if(dead.length){
    const spawned = [];
    dead.forEach(e=>{
      gold += e.gold;
      playCoin();

      // KÜP BÖLÜNMESİ: ölen küp, canının ve boyutunun %40'ı kadar
      // iki yavru bırakır. splitsLeft bitene kadar zincir devam eder.
      if(e.splitsLeft > 0){
        // Kaçıncı küçülme olduğunu bul (1 = ilk küçülme)
        const gen = (e.splitsTotal || 0) - e.splitsLeft + 1;
        let childSpeed;
        if(e.splitSpeedMults && e.splitSpeedMults[gen-1] !== undefined){
          // Taban hıza göre kademeli çarpan (birikmeli değil)
          childSpeed = (e.baseSpeed || e.speed) * e.splitSpeedMults[gen-1];
        } else {
          childSpeed = e.speed * e.splitSpeedFactor;
        }
        for(let k=0;k<2;k++){
          const childHp = Math.max(1, e.maxHp * e.splitHpFactor);
          spawned.push({
            ...e,
            hp: childHp, maxHp: childHp,
            radius: Math.max(e.minRadius, e.radius * e.splitSizeFactor),
            speed: childSpeed,
            gold: Math.max(1, Math.round(e.gold*0.5)),
            splitsLeft: e.splitsLeft - 1,
            // yavrular yolda hafifçe ayrışsın ve farklı salınsın
            dist: Math.max(0, e.dist + (k===0 ? -10 : 10)),
            wobbleSeed: Math.random()*2.2,
            wobbleT: Math.random()*Math.PI*2,
            wobbleScale: 0.65 + Math.random()*0.7,
            wobblePhase2: Math.random()*Math.PI*2,
            spin: Math.random()*Math.PI*2,
            spinDir: Math.random()<0.5 ? -1 : 1,
            flashT: 0, slowT: e.slowT, slowFactor: e.slowFactor,
            bounce: Math.random()*10,
          });
        }
        for(let i=0;i<10;i++){
          const ang=(i/10)*Math.PI*2;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*100,vy:Math.sin(ang)*100,life:0.35,color:e.body});
        }
      }

      if(e.boss){
        shake = Math.min(shake+14, 20);
        showWaveToast(e.label + ' Yıkıldı!'); // ui.js
        for(let i=0;i<60;i++){
          const ang=(i/60)*Math.PI*2, sp=80+Math.random()*180;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.9,color:i%2?'#bfeeff':'#ffffff'});
        }
        explosions.push({x:e.x,y:e.y,r:8,maxR:e.auraRadius||120,life:0.6});
        floatTexts.push({x:e.x,y:e.y-30,text:'+'+e.gold+'🪙',life:1.2,vy:-30,color:'#f4c04a'});
      } else {
        floatTexts.push({x:e.x,y:e.y-10,text:'+'+e.gold+'🪙',life:0.7,vy:-25,color:'#f4c04a'});
        for(let i=0;i<12;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*120,vy:(Math.random()-0.5)*120,life:0.45,color:e.body});
      }
    });
    enemies = enemies.filter(e=>e.hp>0);
    if(spawned.length) enemies.push(...spawned);
    document.getElementById('goldVal').textContent = gold;
  }

  particles.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; });
  particles = particles.filter(p=>p.life>0);
  floatTexts.forEach(f=>{ f.y+=f.vy*dt; f.life-=dt; });
  floatTexts = floatTexts.filter(f=>f.life>0);

  if(shake>0) shake = Math.max(0, shake-dt*40);
}
