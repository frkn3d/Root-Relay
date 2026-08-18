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
let towers, enemies, projectiles, particles, floatTexts, explosions;
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
const LONG_PRESS_MS = 1000;     // yükseltme panelini açmak için gereken basılı tutma süresi
let sellConfirmPending = false;

const UPGRADE_COST_MULT = [0.6, 0.9, 1.3]; // level0->1, level1->2, level2->3

function upgradeCost(t){
  const lvl = t.level||0;
  if(lvl>=3) return null;
  return Math.round(t.def.cost * UPGRADE_COST_MULT[lvl]);
}
function getTowerStats(t){
  const lvl = t.level||0;
  return {
    dmg: t.def.dmg * (1+lvl*0.28),
    range: t.def.range * (1+lvl*0.10),
    rate: t.def.rate * (1-lvl*0.15),
    splash: t.def.splash ? t.def.splash*(1+lvl*0.10) : 0,
  };
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
  const cost = upgradeCost(selectedTower);
  if(cost===null || gold<cost){ playError(); return; }
  gold -= cost;
  selectedTower.totalSpent += cost;
  selectedTower.level = (selectedTower.level||0)+1;
  document.getElementById('goldVal').textContent = gold;
  playPlace();
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

function toggleSpeed(){
  gameSpeed = gameSpeed===1 ? 2 : 1;
  playClick();
  const btn = document.getElementById('speedBtn');
  btn.textContent = gameSpeed+'×';
  btn.classList.toggle('active', gameSpeed===2);
}

function loadLevel(idx){
  currentLevelIdx = idx;
  level = LEVELS[idx];
  pathTotalLen = computePathLength(level.path);
  pathDecor = buildPathDecor(level.path, pathTotalLen);
  spots = level.spots.map(s=>({x:s.x,y:s.y,occ:null}));
  gold = level.startGold; lives = level.startLives; waveIndex = 0;
  waveActive=false; gameOver=false; gameWon=false;
  towers=[]; enemies=[]; projectiles=[]; particles=[]; floatTexts=[]; explosions=[];
  spawnTimeline=[]; waveElapsed=0; shake=0;
  seenEnemyTypes = new Set();
  paused = false;
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
      });
      t += g.interval;
    }
    t += 0.5;
  });
  waveElapsed=0; waveActive=true;
  saveResume(currentLevelIdx, waveIndex);
  playWaveStart();
  renderWavePreview();   // ui.js
}

function endGame(win){
  gameOver=!win; gameWon=win;
  closeTowerPanel();
  if(typeof closeTowerDrawer === 'function') closeTowerDrawer();
  const overlay=document.getElementById('overlay');
  const h=document.getElementById('overlayTitle'), p=document.getElementById('overlayText');
  const starsEl = document.getElementById('overlayStars');
  if(win){
    const frac = lives/level.startLives;
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
        if(entry.t<=waveElapsed){ entry.spawned=true; enemies.push({...entry, dist:0, flashT:0, bounce:Math.random()*10, slowT:0, slowFactor:1}); }
        else pending=true;
      }
    });
    if(!pending && enemies.length===0){
      waveActive=false;
      if(waveIndex>=level.waveCount){ endGame(true); return; }
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
    e.bounce += dt*e.speed*slowMult*9;
    if(e.flashT>0) e.flashT -= dt*3;
    if(e.slowT>0) e.slowT -= dt;
  });

  const reached = enemies.filter(e=>e.dist>=pathTotalLen);
  if(reached.length){
    let dmg=0; reached.forEach(e=>dmg+=e.dmgToLives);
    lives-=dmg; shake=Math.min(shake+8,16);
    enemies = enemies.filter(e=>e.dist<pathTotalLen);
    document.getElementById('livesVal').textContent = Math.max(lives,0);
    if(lives<=0){ endGame(false); return; }
  }

  towers.forEach(t=>{
    const st = getTowerStats(t);
    t.cooldown = Math.max(0, t.cooldown-dt);
    if(t.cooldown<=0){
      let target=null,bestD=Infinity;
      enemies.forEach(e=>{
        const d=Math.hypot(e.x-t.x,e.y-t.y);
        if(d<=st.range && d<bestD){bestD=d; target=e;}
      });
      if(target){
        const dist0 = Math.hypot(target.x-t.x, target.y-t.y);
        projectiles.push({x:t.x,y:t.y-20,target,dmg:st.dmg,splash:st.splash,kind:t.def.kind,speed:t.def.kind==='mortar'?4.2:7,travel:dist0,slow:t.def.slowFactor,slowDuration:t.def.slowDuration});
        t.cooldown = st.rate;
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
        p.target.hp -= p.dmg; p.target.flashT=1;
        if(p.slow){ p.target.slowT = p.slowDuration; p.target.slowFactor = p.slow; }
        floatTexts.push({x:p.x,y:p.y,text:'-'+p.dmg,life:0.6,vy:-30,color:p.kind==='mage'?'#b6f0e0':(p.kind==='ice'?'#cdf3ff':'#ffe3c2')});
        for(let i=0;i<5;i++) particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*90,vy:(Math.random()-0.5)*90,life:0.35,color:p.kind==='mage'?'#8fe3cc':(p.kind==='ice'?'#bfeeff':'#c9a56a')});
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
    dead.forEach(e=>{
      gold += e.gold;
      playCoin();
      floatTexts.push({x:e.x,y:e.y-10,text:'+'+e.gold+'🪙',life:0.7,vy:-25,color:'#f4c04a'});
      for(let i=0;i<12;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*120,vy:(Math.random()-0.5)*120,life:0.45,color:e.body});
    });
    enemies = enemies.filter(e=>e.hp>0);
    document.getElementById('goldVal').textContent = gold;
  }

  particles.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; });
  particles = particles.filter(p=>p.life>0);
  floatTexts.forEach(f=>{ f.y+=f.vy*dt; f.life-=dt; });
  floatTexts = floatTexts.filter(f=>f.life>0);

  if(shake>0) shake = Math.max(0, shake-dt*40);
}
