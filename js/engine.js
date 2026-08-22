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

/* ---- Arka plan dokusu ----
   Tema (mevsim + bitki örtüsü) değiştiğinde yeniden pişirilir.
   Her karede yeniden çizmek pahalı olurdu; bir kez üretilip
   önbelleğe alınır. */
const bgCanvas = document.createElement('canvas');
bgCanvas.width = LW; bgCanvas.height = LH;
let bakedThemeKey = null;

function bakeBackground(theme){
  const bctx = bgCanvas.getContext('2d');
  // Varsayılan (klasik bölümler): orman/ilkbahar
  let c1='#2f5233', c2='#213b26', decor='tree', density=1.0, tint=null;

  if(theme && typeof BIOMES!=='undefined' && BIOMES[theme.biome]){
    const b = BIOMES[theme.biome];
    const pair = (b.base[theme.season] || b.base.spring);
    c1 = pair[0]; c2 = pair[1];
    decor = b.decor; density = b.decorDensity;
    tint = (SEASONS[theme.season]||{}).tint;
  }

  const g = bctx.createLinearGradient(0,0,0,LH);
  g.addColorStop(0,c1); g.addColorStop(1,c2);
  bctx.fillStyle = g; bctx.fillRect(0,0,LW,LH);

  // Yumuşak leke katmanı (derinlik hissi)
  for(let i=0;i<160;i++){
    const x=Math.random()*LW, y=Math.random()*LH, r=14+Math.random()*40;
    bctx.beginPath(); bctx.arc(x,y,r,0,Math.PI*2);
    bctx.fillStyle = Math.random()>0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    bctx.fill();
  }

  // Bitki örtüsüne özgü dekor
  const n = Math.round(70*density);
  for(let i=0;i<n;i++){
    const x=Math.random()*LW, y=Math.random()*LH;
    if(decor==='tree'){
      bctx.beginPath(); bctx.ellipse(x,y,3,7,Math.random()*Math.PI,0,Math.PI*2);
      bctx.fillStyle='rgba(20,50,25,0.35)'; bctx.fill();
    } else if(decor==='rock'){
      bctx.beginPath(); bctx.ellipse(x,y,4+Math.random()*4,3+Math.random()*2,0,0,Math.PI*2);
      bctx.fillStyle='rgba(0,0,0,0.18)'; bctx.fill();
    } else if(decor==='bush'){
      bctx.beginPath(); bctx.arc(x,y,3+Math.random()*3,0,Math.PI*2);
      bctx.fillStyle='rgba(30,60,25,0.30)'; bctx.fill();
    } else if(decor==='reed'){
      bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x+ (Math.random()-0.5)*4, y-8-Math.random()*6);
      bctx.strokeStyle='rgba(25,55,35,0.35)'; bctx.lineWidth=1.4; bctx.stroke();
    } else { // grass
      bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x+1.5, y-5);
      bctx.strokeStyle='rgba(80,80,30,0.25)'; bctx.lineWidth=1.2; bctx.stroke();
    }
  }

  // Serpiştirilmiş taşlar
  for(let i=0;i<10;i++){
    const x=Math.random()*LW, y=Math.random()*LH, r=5+Math.random()*6;
    bctx.beginPath(); bctx.ellipse(x,y,r,r*0.6,0,0,Math.PI*2);
    bctx.fillStyle='rgba(140,140,120,0.5)'; bctx.fill();
    bctx.strokeStyle='rgba(0,0,0,0.3)'; bctx.lineWidth=1; bctx.stroke();
  }

  // Mevsim rengi ince bir katman olarak üstüne biner
  if(tint){
    bctx.save();
    bctx.globalAlpha = theme.season==='winter' ? 0.34 : 0.07;
    bctx.fillStyle = tint;
    bctx.fillRect(0,0,LW,LH);
    bctx.restore();
  }

  // Kışın belirgin kar örtüsü: beyaz yamalar + serpme kar
  if(theme && theme.season==='winter'){
    // Zemine oturmuş kar yamaları
    for(let i=0;i<70;i++){
      const x=Math.random()*LW, y=Math.random()*LH;
      const r=18+Math.random()*46;
      bctx.beginPath(); bctx.ellipse(x,y,r,r*0.55,Math.random()*Math.PI,0,Math.PI*2);
      bctx.fillStyle='rgba(255,255,255,0.16)'; bctx.fill();
    }
    // İnce serpme kar
    for(let i=0;i<260;i++){
      const x=Math.random()*LW, y=Math.random()*LH;
      bctx.beginPath(); bctx.arc(x,y,1+Math.random()*1.8,0,Math.PI*2);
      bctx.fillStyle='rgba(255,255,255,0.4)'; bctx.fill();
    }
  }
}

/* Tema değiştiyse arka planı yeniden üret */
function ensureBackground(){
  const key = level && level.theme
    ? (level.theme.season+'|'+level.theme.biome)
    : 'default';
  if(key === bakedThemeKey) return;
  bakedThemeKey = key;
  bakeBackground(level ? level.theme : null);
}

let currentLevelIdx = 0;
let level = LEVELS[0];
let pathTotalLen = 0;      // en uzun yolun uzunluğu (geriye dönük uyum)
let pathDecor = [];        // yol başına dekor dizileri
let levelPaths = [];       // [[{x,y}...], ...] — bir veya daha fazla rota
let pathLens = [];         // her rotanın uzunluğu

/* Bir bölümün rotalarını normalize eder: hem tek yollu (level.path)
   hem çok yollu (level.paths) tanımları aynı biçime getirir. */
function levelRoutes(lv){
  if(lv.paths && lv.paths.length) return lv.paths;
  if(lv.path) return [lv.path];
  return [];
}

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
let towers, enemies, projectiles, particles, floatTexts, explosions, arcs, healZones, debris, flameSprays;
let spawnTimeline, waveElapsed;
let shake = 0;
let spots = [];
let selectedType = 'archer';
let seenEnemyTypes = new Set();
let paused = false;
let gameSpeed = 1;

/* ---- Ortam kuşu: kuş bakışı sahneden ara sıra geçen küçük bir sürü ----
   Saf görsel/atmosferik; oynanışa hiç dokunmaz. Tür ve renk bölümün
   biyomuna göre değişir (BIOME_BIRDS, render.js); kış mevsiminde çok
   daha seyrek görünür. */
let birds = [];
let birdCooldown = 8;
function scheduleNextBird(){
  const theme = (level && level.theme) || {};
  const winter = theme.season === 'winter';
  const lo = winter ? 45 : 14;
  const hi = winter ? 85 : 30;
  birdCooldown = lo + Math.random()*(hi-lo);
}
/* Uçuş üç evreli: kenardan ekranın ortasına yaklaşma (düz), orta
   noktada 1-2 tur elips çizme (süzülme), sonra bir kenardan çıkış
   (düz). approachDur/loopDur/departDur toplamı bird.dur'u oluşturur;
   render.js bu üç evreyi bird.t'ye göre ayrı ayrı konumlandırır. */
function spawnBird(){
  const margin = 40;
  const edgePoint = ()=>{
    const edge = ['top','bottom','left','right'][Math.floor(Math.random()*4)];
    if(edge==='top')    return {x:Math.random()*LW, y:-margin, edge};
    if(edge==='bottom') return {x:Math.random()*LW, y:LH+margin, edge};
    if(edge==='left')   return {x:-margin, y:Math.random()*LH, edge};
    return {x:LW+margin, y:Math.random()*LH, edge};
  };
  const a = edgePoint();
  let b = edgePoint();
  for(let i=0;i<5 && b.edge===a.edge;i++) b = edgePoint();

  const theme = (level && level.theme) || { biome:'forest' };
  const species = (typeof BIOME_BIRDS !== 'undefined' && BIOME_BIRDS[theme.biome]) || BIOME_BIRDS.forest;

  // Ekranın ortasına yakın, hafif kaymış bir elips merkezi — sürü
  // buraya gelip 1-2 tur atıp sonra yoluna devam eder.
  const cx = LW*0.5 + (Math.random()-0.5)*LW*0.28;
  const cy = LH*0.45 + (Math.random()-0.5)*LH*0.22;
  const baseRx = 55 + Math.random()*45;
  const baseRy = 35 + Math.random()*35;
  const loops = Math.random() < 0.5 ? 1 : 2;
  const dir = Math.random() < 0.5 ? 1 : -1;
  // Giriş açısı tamamen rastgele seçilirse, elipsin o noktadaki teğeti
  // genel a→b uçuş yönüyle sık sık ters düşüyor; render.js bunu düz
  // çizgiyle teğeti eşleştiren bir eğriyle bağlıyor, ama teğet ters
  // yöndeyse eğri neredeyse durma noktasına inip yön aniden sıçrıyordu.
  // Açıyı, o noktadaki teğet zaten genel uçuş yönüne yakın olacak
  // şekilde seçip üstüne sınırlı bir rastgelelik ekliyoruz.
  const travelAngle = Math.atan2(b.y-a.y, b.x-a.x);
  const baseAngle = travelAngle - dir*(Math.PI/2) + (Math.random()-0.5)*0.7;
  const ab = Math.hypot(b.x-a.x, b.y-a.y) || 1;
  const nx = -(b.y-a.y)/ab, ny = (b.x-a.x)/ab;   // uçuş eksenine dik — formasyon açıklığı için
  const count = Math.random() < 0.5 ? 3 : 5;
  const spacing = 16 + Math.random()*10;

  birds = [];
  for(let i=0;i<count;i++){
    const off = (i - (count-1)/2) * spacing;

    // Eskisinden ÇOK daha yavaş düz uçuş (~%80 azaltıldı) + her kuşta
    // ufak farklar (yarıçap/açı/tempo/hız/zamanlama) — sürü aynı
    // manevrayı yapar ama robotik biçimde birebir aynı değildir.
    const speed = 16 + Math.random()*9;
    const rx = baseRx * (0.9 + Math.random()*0.2);
    const ry = baseRy * (0.9 + Math.random()*0.2);
    const angle = baseAngle + (i-(count-1)/2)*0.06 + (Math.random()-0.5)*0.12;
    const stagger = Math.abs(i-(count-1)/2)*0.035 + (Math.random()-0.5)*0.02;

    const loopX = cx + Math.cos(angle)*rx, loopY = cy + Math.sin(angle)*ry;
    const x0 = a.x+nx*off, y0 = a.y+ny*off;
    const x1 = b.x+nx*off, y1 = b.y+ny*off;
    const approachDur = Math.hypot(loopX-x0, loopY-y0) / speed;
    // Döngü süresi bağımsız rastgele bir "period"dan DEĞİL, elipsin
    // çevresinden hesaplanıyor — aksi halde tur hızı düz uçuş hızından
    // (speed) tamamen kopuk oluyordu (~120-150 birim/sn'ye çıkabiliyordu,
    // düz uçuşun 16-25 birim/sn'sine karşı) ve sınırda ani bir "hızlanma"
    // sıçraması oluyordu. Ramanujan yaklaşık elips çevresi / speed ile
    // tur hızı düz uçuşla aynı kalıyor.
    const h = Math.pow((rx-ry)/(rx+ry), 2);
    const circumference = Math.PI*(rx+ry)*(1 + 3*h/(10+Math.sqrt(4-3*h)));
    const loopDur = (circumference*loops) / speed;
    const departDur = Math.hypot(x1-loopX, y1-loopY) / speed;

    birds.push({
      x0, y0, x1, y1,
      cx, cy, rx, ry, angle, loops, dir, loopDur, approachDur, departDur,
      dur: approachDur + loopDur + departDur,
      t: -stagger,
      species,
      size: 0.85 + Math.random()*0.5,
      wingPhase: Math.random()*Math.PI*2,
      wingSpeed: 7 + Math.random()*3,
      bob: 3 + Math.random()*4,
      bobPhase: Math.random()*Math.PI*2,
    });
  }
}
let selectedTower = null;
let towerPanelOpen = false;
let activeTowerRing = null; // tek tıkla menzil önizlemesi (panel açmadan)
let pressProgressTower = null;  // basılı tutulan kule (ilerleme halkası için)
let pressProgressStart = 0;     // basılı tutmanın başladığı zaman damgası
const LONG_PRESS_MS = 500;      // yükseltme panelini açmak için gereken basılı tutma süresi
let sellConfirmPending = false;

// Yükseltme maliyetleri anaparanın (TOWER_TYPES.cost) katları:
// level0->1 = x1.4, level1->2 = x2, level2->3 (son seviye) = x4.
// Şu an son seviye 3 olduğu için 4. bir yükseltme yok; olsaydı x5 olurdu.
const UPGRADE_COST_MULT = [1.4, 2.0, 4.0];

/* İnşa/yükseltme süreleri (saniye).
   BUILD_TIMES[0] = ilk kurulum, [1] = 2. seviye, [2] = 3. seviye.
   Market'teki "Hızlı İnşaat" yükseltmesi bu süreleri kısaltır. */
const BUILD_TIMES = [4, 6, 8];
function buildDurationFor(levelAfter){
  const base = BUILD_TIMES[Math.max(0, Math.min(levelAfter, BUILD_TIMES.length-1))];
  // Yarım saniyenin katına yuvarla — arayüzde küsürlü sayı görünmesin
  return Math.max(0.5, Math.round(base * sessionBuildFactor() * 2) / 2);
}

// Kurulum maliyeti zorlukla ölçeklenmiyor — sabit (TOWER_TYPES.cost).
// Diff bazlı ölçekleme (×7'ye varan) denendi, geç bölümlerde okçuyu
// bile 280 altına çıkarıp başlangıcı imkansız kıldığı için geri alındı.
function buildCost(def){
  return def.cost;
}

function upgradeCost(t){
  const lvl = t.level||0;
  if(lvl>=3) return null;
  // Fiyatlar her zaman 5'in katı olsun — okunması kolay, tutarlı sayılar
  return Math.round(t.def.cost * UPGRADE_COST_MULT[lvl] / 5) * 5;
}
/* Aktif bölümün mevsim/biyom etkileri. Klasik bölümlerde tema
   olmadığı için nötr değerler döner. */
const NEUTRAL_MODS = { iceSlowBonus:0, enemySpeedMul:1, goldMul:1, rangeMul:1, dmgMul:{}, notes:[], labels:[] };
function levelMods(){
  return (level && level.mods) ? level.mods : NEUTRAL_MODS;
}

function getTowerStats(t){
  const lvl = t.level||0;
  const m = levelMods();
  const kind = t.def.kind;
  const dmgMul = m.dmgMul[kind] || 1;

  let range = t.def.range * (1+lvl*0.10) * m.rangeMul;
  // Mantar Havanı son seviyede ek menzil kazanır (uzun menzilli topçu rolü)
  if(kind==='mortar' && lvl>=3) range += 25;
  return {
    dmg: t.def.dmg * (1+lvl*0.28) * dmgMul,
    range: range,
    rate: t.def.rate * (1-lvl*0.15),
    splash: t.def.splash ? t.def.splash*(1+lvl*0.10) : 0,
    poisonDps: t.def.poisonDps ? t.def.poisonDps*(1+lvl*0.30)*dmgMul : 0,
    poisonDuration: t.def.poisonDuration || 0,
    chainCount: t.def.chainCount ? t.def.chainCount + lvl : 0,
    chainFalloff: t.def.chainFalloff || 0.6,
    chainRange: t.def.chainRange ? t.def.chainRange*(1+lvl*0.10) : 0,
    // Don Peykesi'nin yavaşlatma süresi mevsime göre uzar/kısalır
    slowDuration: t.def.slowDuration
      ? Math.max(0.5, t.def.slowDuration + m.iceSlowBonus)
      : 0,
    burnDps: t.def.burnDps ? t.def.burnDps*(1+lvl*0.30)*dmgMul : 0,
    burnDuration: t.def.burnDuration || 0,
    // Seviye arttıkça püskürtme konisi biraz daha geniş açılır
    coneAngle: t.def.coneAngle ? t.def.coneAngle*(1+lvl*0.08) : 0,
  };
}
/* Menzil içindeki düşmanlardan, kulenin hedefleme moduna göre birini seçer.
   'first'     : yola en çok ilerlemiş (çıkışa en yakın) — varsayılan
   'weakest'   : en az canı kalan
   'strongest' : en çok canı kalan */
function pickTargetWhere(t, range, filterFn){
  let best=null, bestScore=-Infinity;
  const mode = t.targetMode || 'first';
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    if(filterFn && !filterFn(e)) continue;
    if(Math.hypot(e.x-t.x, e.y-t.y) > range) continue;
    let score;
    if(mode==='weakest')        score = -e.hp;
    else if(mode==='strongest') score = e.hp;
    else                        score = e.dist; // yolda en ileri olan
    if(score > bestScore){ bestScore = score; best = e; }
  }
  return best;
}

/* Don Peykesi zaten donmuş bir düşmanı tekrar hedeflemez — etkiyi
   boşa harcamak yerine menzildeki başka bir düşmana yönelir. Menzilde
   donmamış kimse yoksa (yani "başka biri yoksa") donuk olana da vurur,
   böylece kule asla boşa durmaz. */
function pickTarget(t, range){
  if(t.def.kind === 'ice'){
    const fresh = pickTargetWhere(t, range, e => !(e.slowT > 0));
    if(fresh) return fresh;
  }
  return pickTargetWhere(t, range, null);
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

/* Kule paneli açıkken altın miktarı sürekli değişir (düşman öldükçe).
   Panelin tamamını her karede yeniden çizmek pahalı olacağından,
   yalnızca butonun aktif/pasif durumunu tazeleyen hafif bir kontrol. */
let lastAffordState = null;
let lastBuildAfford = null;
function refreshTowerPanelAffordability(){
  // Kurulum onayı açıksa ✓ butonunun durumunu tazele
  if(pendingSpot){
    const def = TOWER_TYPES[selectedType];
    const dis = gold < buildCost(def);
    if(dis !== lastBuildAfford){
      lastBuildAfford = dis;
      const b = document.getElementById('bcOk');
      if(b) b.disabled = dis;
    }
  } else {
    lastBuildAfford = null;
  }

  if(!towerPanelOpen || !selectedTower) { lastAffordState = null; return; }
  const t = selectedTower;
  const cost = upgradeCost(t);
  const shouldDisable = (t.buildLeft > 0) || (cost === null) || (gold < cost);
  if(shouldDisable === lastAffordState) return;   // durum değişmediyse DOM'a dokunma
  lastAffordState = shouldDisable;
  const btn = document.getElementById('tpUpgradeBtn');
  if(btn) btn.disabled = shouldDisable;
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
  lastAffordState = null;
  renderTowerPanel(); // ui.js
}
function closeTowerPanel(){
  towerPanelOpen = false; selectedTower = null; sellConfirmPending = false;
  activeTowerRing = null;
  lastAffordState = null;
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

/* Bölüm içi market: alım yapar ve etkiyi ANINDA uygular.
   Etkiler yalnızca bu bölüm için geçerlidir. */
function buyInGameItem(id){
  const cost = shopNextCost(id);        // progress.js
  if(cost === null) return {ok:false, reason:'max'};
  if(getGems() < cost) return {ok:false, reason:'gems'};

  addGems(-cost);
  markSessionBuy(id);

  if(id === 'goldPack'){
    gold += 50;
    document.getElementById('goldVal').textContent = gold;
    floatTexts.push({x:LW/2, y:LH*0.35, text:'+50🪙', life:1.1, vy:-34, color:'#f4c04a'});
  } else if(id === 'lifePack'){
    lives += 3;
    startLivesEffective += 3;   // yıldız oranı bozulmasın
    document.getElementById('livesVal').textContent = lives;
    floatTexts.push({x:LW/2, y:LH*0.35, text:'+3 ❤️', life:1.1, vy:-34, color:'#ff8f78'});
  } else if(id === 'buildBoost'){
    // Halihazırda inşa halindeki kuleler de hızlansın
    const f = 0.9;
    towers.forEach(t=>{
      if(t.buildLeft > 0){ t.buildLeft *= f; t.buildDuration *= f; }
    });
    floatTexts.push({x:LW/2, y:LH*0.35, text:'İNŞAAT HIZLANDI', life:1.2, vy:-30, color:'#8fe3a0'});
  }
  playCoin();
  return {ok:true};
}

let pendingSpot = null;   // kurulum onayı bekleyen yapı alanı

/* Kurulum onay penceresini ilgili noktanın üzerinde açar */
function openBuildConfirm(spot){
  pendingSpot = spot;
  const def = TOWER_TYPES[selectedType];
  const cost = buildCost(def);
  const box = document.getElementById('buildConfirm');
  document.getElementById('bcIcon').textContent = def.icon;
  document.getElementById('bcCost').textContent = '🪙'+cost;
  document.getElementById('bcOk').disabled = gold < cost;

  // Mantıksal canvas koordinatını ekran (CSS) koordinatına çevir
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / LW, sy = rect.height / LH;
  // Pencereyi noktanın biraz üstünde konumlandır
  let left = spot.x * sx;
  let top  = spot.y * sy - 44;
  // Çerçeve kenarlarından taşmasın
  left = Math.max(48, Math.min(left, rect.width - 48));
  top  = Math.max(34, Math.min(top,  rect.height - 34));
  box.style.left = left + 'px';
  box.style.top  = top  + 'px';
  box.classList.add('show');
  playMenuTap();
}

function closeBuildConfirm(){
  pendingSpot = null;
  const box = document.getElementById('buildConfirm');
  if(box) box.classList.remove('show');
}

/* Onaylandı: kuleyi gerçekten kur */
function confirmBuild(){
  if(!pendingSpot) return;
  const spot = pendingSpot;
  const def = TOWER_TYPES[selectedType];
  const cost = buildCost(def);
  if(spot.occ){ closeBuildConfirm(); return; }
  if(gold < cost){
    playError();
    const chip=document.getElementById('goldChip');
    chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
    return;
  }
  gold -= cost;
  document.getElementById('goldVal').textContent = gold;
  const t = {
    x:spot.x, y:spot.y, def, cooldown:0, pulse:0,
    level:0, totalSpent:cost,
    targetMode:'first',
    buildDuration: buildDurationFor(0),
    buildLeft: buildDurationFor(0),
    pendingLevel: null,
  };
  towers.push(t); spot.occ = t;
  playMenuTap();
  closeBuildConfirm();
}

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
  towers=[]; enemies=[]; projectiles=[]; particles=[]; floatTexts=[]; explosions=[]; arcs=[]; healZones=[]; debris=[]; flameSprays=[];
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

/* ---- Update (delta-time tabanlı) ---- */
let lastTime = performance.now();

/* Ortam kuşu sürüsü — 1x/2x/4x hız çarpanından bilerek bağımsız tutulur.
   update(dt), main.js'teki döngüde gameSpeed ile ölçeklenmiş adımlarla
   çağrılıyor; kuşlar da o dt'yi kullansaydı hızlandırmada fırlıyorlardı.
   Bu yüzden main.js her karede, hızdan bağımsız GERÇEK dt ile ayrıca
   çağırıyor (yalnızca oyun duraklı değilken, dondurma davranışı aynı). */
function updateBirds(dt){
  if(!level) return;
  birdCooldown -= dt;
  if(birdCooldown <= 0){
    if(!birds.length) spawnBird();
    scheduleNextBird();
  }
  if(birds.length){
    birds.forEach(b=>{ b.t += dt; });
    birds = birds.filter(b=>b.t < b.dur);
  }
}

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
            // Birden fazla giriş varsa düşmanlar rotalara dağıtılır
            pathIdx: entry.pathIdx || 0,
          });
        }
        else pending=true;
      }
    });
    if(!pending && enemies.length===0){
      waveActive=false;
      if(waveIndex>=level.waveCount){ endGame(true); return; }
      playWaveComplete();   // audio.js — dalga başarıyla bitince kısa bir başarı ezgisi
      showWaveToast(`Dalga ${waveIndex} Tamamlandı!`); // ui.js
      setWaveBtnReady(true); // ui.js
      renderWavePreview();   // ui.js
    }
  }

  /* SÜRÜ ANASI AURASI: yarıçapındaki müttefik türlere (Spor/Sürü gibi)
     hız ve hasar direnci verir — Don Efendisi'nin tam tersi, kuleleri
     değil düşmanları güçlendirir. Onu öncelikli öldürmek dalgayı
     belirgin şekilde kolaylaştırır çünkü buff'lı birimler onunla
     birlikte yeteneklerini kaybeder. */
  enemies.forEach(e=>{ e.queenSpeedBuff = 0; e.queenDmgResist = 0; });
  enemies.forEach(q=>{
    if(!q.allyBuffTypes || !q.allyBuffTypes.length) return;
    enemies.forEach(e=>{
      if(e===q || !q.allyBuffTypes.includes(e.type)) return;
      if(Math.hypot(e.x-q.x, e.y-q.y) <= q.auraRadius){
        if(q.allySpeedBuff > e.queenSpeedBuff) e.queenSpeedBuff = q.allySpeedBuff;
        if(q.allyDmgResist > e.queenDmgResist) e.queenDmgResist = q.allyDmgResist;
      }
    });
  });

  const newborns = [];   // Kuluçka'nın bu karede bıraktığı yavrular
  enemies.forEach(e=>{
    const slowMult = e.slowT>0 ? e.slowFactor : 1;
    const queenMult = 1 + (e.queenSpeedBuff||0);
    e.dist += e.speed*slowMult*queenMult*dt*60;
    const myPath = levelPaths[e.pathIdx || 0] || levelPaths[0];
    const myLen  = pathLens[e.pathIdx || 0] || pathTotalLen;
    const p = pointAtDistance(myPath, myLen, e.dist);
    const p2 = pointAtDistance(myPath, myLen, e.dist+2);
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
    if(e.blockFlash>0) e.blockFlash -= dt*3;
    if(e.slowT>0) e.slowT -= dt;

    /* KULUÇKA: yaşadığı sürece belirli aralıklarla yavru bırakır.
       Öldürülünce üretim durur — "hemen indir" baskısı yaratır. */
    if(e.broodEvery > 0 && e.broodCount < e.broodMax){
      e.broodT += dt;
      if(e.broodT >= e.broodEvery){
        e.broodT = 0;
        e.broodCount++;
        const def = ENEMY_TYPES[e.broodType] || ENEMY_TYPES.swarm;
        const mult = statMultipliers(level, waveIndex);
        const m = levelMods();
        newborns.push({
          type:e.broodType,
          hp: def.hp*mult.hp, maxHp: def.hp*mult.hp,
          speed: def.speed*mult.speed*m.enemySpeedMul,
          radius: def.radius, body:def.body, body2:def.body2, shape:def.shape, eyes:def.eyes,
          gold: Math.max(1, Math.round(def.gold*m.goldMul)), dmgToLives: def.dmgToLives,
          pathIdx: e.pathIdx || 0,
          dist: Math.max(0, e.dist - 12),
          flashT:0, slowT:0, slowFactor:1, bounce:Math.random()*10,
          wobbleT:Math.random()*Math.PI*2, wobbleSeed:Math.random()*2.2,
          wobbleScale:0.65+Math.random()*0.7, wobblePhase2:Math.random()*Math.PI*2,
          spin:Math.random()*Math.PI*2, spinDir:Math.random()<0.5?-1:1,
          splitsLeft:0, broodEvery:0, blockArc:0, overloadSec:0,
          healRadius:0, auraRadius:0,
        });
        for(let i=0;i<8;i++){
          const a=(i/8)*Math.PI*2;
          particles.push({x:e.x,y:e.y,vx:Math.cos(a)*60,vy:Math.sin(a)*60,life:0.3,color:e.body});
        }
      }
    }
    // ZEHİR: süre boyunca saniyede poisonDps kadar hasar
    if(e.poisonT > 0){
      e.poisonT -= dt;
      e.hp -= (e.poisonDps||0) * dt * (1-(e.queenDmgResist||0));
      if(e.poisonT <= 0){ e.poisonT = 0; e.poisonDps = 0; }
    }
    // ATEŞ: süre boyunca saniyede burnDps kadar hasar — Don Peykesi'nin
    // yavaşlatmasıyla aynı hedefte bir arada duramaz (bkz. "ATEŞ vs DON").
    if(e.burnT > 0){
      e.burnT -= dt;
      e.hp -= (e.burnDps||0) * dt * (1-(e.queenDmgResist||0));
      if(e.burnT <= 0){ e.burnT = 0; e.burnDps = 0; }
    }
  });

  arcs.forEach(a=>{ a.life -= dt; });
  arcs = arcs.filter(a=>a.life > 0);

  /* KÜP ENKAZI (bkz. "KÜP BÖLÜNMESİ") — yalnızca görsel, oynanışa etkisi yok */
  if(debris.length){
    debris.forEach(d=>{ d.life -= dt; });
    debris = debris.filter(d=>d.life > 0);
  }

  /* ALEV PÜSKÜRTME GÖRSELİ — yalnızca görsel, oynanışa etkisi yok */
  if(flameSprays.length){
    flameSprays.forEach(f=>{ f.life -= dt; });
    flameSprays = flameSprays.filter(f=>f.life > 0);
  }

  /* İYİLEŞTİRME BİRİKİNTİLERİ (kırılan şişelerden)
     Üst üste binen birikintiler toplanmaz; en güçlüsü uygulanır.
     Aksi halde birkaç şişe yan yana kırıldığında bölüm kilitlenir. */
  if(healZones.length){
    healZones.forEach(z=>{ z.life -= dt; });
    healZones = healZones.filter(z=>z.life > 0);

    if(healZones.length && enemies.length){
      enemies.forEach(e=>{
        let best = 0;
        for(let i=0;i<healZones.length;i++){
          const z = healZones[i];
          if(Math.hypot(e.x-z.x, e.y-z.y) <= z.r && z.healPerSec > best) best = z.healPerSec;
        }
        if(best > 0 && e.hp < e.maxHp){
          e.hp = Math.min(e.maxHp, e.hp + best*dt);
          e.healedT = 0.35;    // görsel geri bildirim için kısa işaret
        }
        if(e.healedT > 0) e.healedT -= dt;
      });
    }
  }

  if(newborns.length) enemies.push(...newborns);

  const reachedEnd = e => e.dist >= (pathLens[e.pathIdx||0] || pathTotalLen);
  const reached = enemies.filter(reachedEnd);
  if(reached.length){
    let dmg=0; reached.forEach(e=>dmg+=e.dmgToLives);
    lives-=dmg; shake=Math.min(shake+8,16);
    playLifeLoss();
    enemies = enemies.filter(e=>!reachedEnd(e));
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
    if(t.overloadT > 0) t.overloadT -= dt;
    if(t.blindT > 0) t.blindT -= dt;

    /* NİŞAN ALMA: kule, ateş etmese bile menzilindeki hedefe döner.
       Namlu/yay anlık zıplamasın diye açı yumuşatılarak takip edilir. */
    const aimTarget = pickTarget(t, st.range);
    if(aimTarget){
      t.angle = Math.atan2(aimTarget.y - t.y, aimTarget.x - t.x);
    }
    if(t.aimAngle === undefined) t.aimAngle = t.angle !== undefined ? t.angle : -Math.PI/2;
    if(t.angle !== undefined){
      // En kısa yönden döndür (-π..π aralığına indirge)
      let diff = t.angle - t.aimAngle;
      while(diff >  Math.PI) diff -= Math.PI*2;
      while(diff < -Math.PI) diff += Math.PI*2;
      t.aimAngle += diff * Math.min(1, dt*7);
    }

    if(t.cooldown<=0){
      const target = aimTarget;
      if(target){
        if(t.def.kind === 'fire'){
          // ALEV PÜSKÜRTME: tek hedefe uçan bir mermi değil — nişan
          // açısındaki koni içinde, menzildeki HERKESE anında isabet eder.
          const aimAng = t.angle;
          const cone = st.coneAngle;
          enemies.forEach(e=>{
            if(Math.hypot(e.x-t.x, e.y-t.y) > st.range) return;
            let diff = Math.atan2(e.y-t.y, e.x-t.x) - aimAng;
            while(diff >  Math.PI) diff -= Math.PI*2;
            while(diff < -Math.PI) diff += Math.PI*2;
            if(Math.abs(diff) > cone) return;
            if(st.dmg>0) e.hp -= st.dmg*(1-(e.queenDmgResist||0));
            e.flashT = 1;
            // ATEŞ vs DON: aynı hedefte bir arada duramaz — alev,
            // üzerindeki yavaşlatmayı/donu hemen eritir.
            e.slowT = 0;
            e.burnDps = Math.max(e.burnDps||0, st.burnDps);
            e.burnT = Math.max(e.burnT||0, st.burnDuration);
          });
          flameSprays.push({x:t.x, y:t.y-20, angle:aimAng, cone, range:st.range, life:0.30, maxLife:0.30});
          playShoot('fire');
        } else {
          const dist0 = Math.hypot(target.x-t.x, target.y-t.y);
          projectiles.push({x:t.x,y:t.y-20,target,dmg:st.dmg,splash:st.splash,kind:t.def.kind,
            ox:t.x, oy:t.y, tower:t,
            speed:t.def.kind==='mortar'?4.2:(t.def.kind==='bolt'?11:7),travel:dist0,
            slow:t.def.slowFactor,slowDuration:st.slowDuration,
            poisonDps:st.poisonDps, poisonDuration:st.poisonDuration,
            chainCount:st.chainCount, chainFalloff:st.chainFalloff, chainRange:st.chainRange});
          playShoot(t.def.kind);
        }
        t.cooldown = st.rate * rateMult;
        t.pulse = 1;
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
            e.hp -= p.dmg * (1-(e.queenDmgResist||0)); e.flashT=1;
            playHit(e.radius, e.boss);
          }
        });
        explosions.push({x:ix,y:iy,r:4,maxR:p.splash,life:0.35});
        shake=Math.min(shake+4,10);
        for(let i=0;i<16;i++) particles.push({x:ix,y:iy,vx:(Math.random()-0.5)*160,vy:(Math.random()-0.5)*160,life:0.4,color:'#e8a94a'});
      } else {
        const tgt = p.target;

        /* KALKAN TAŞIYICI: mermi önden geldiyse seker.
           Kalkan hareket yönüne bakar; atış kaynağı ile hareket
           yönü arasındaki açı dar ise darbe önden gelmiş demektir. */
        let blocked = false;
        if(tgt.blockArc > 0){
          const inx = (p.ox !== undefined ? p.ox : p.x) - tgt.x;
          const iny = (p.oy !== undefined ? p.oy : p.y) - tgt.y;
          const il = Math.hypot(inx, iny) || 1;
          const fx = Math.cos(tgt.angle||0), fy = Math.sin(tgt.angle||0);
          const dot = (inx/il)*fx + (iny/il)*fy;      // 1 = tam önden
          if(dot > Math.cos(tgt.blockArc)) blocked = true;
        }

        if(blocked){
          tgt.blockFlash = 0.35;
          floatTexts.push({x:p.x,y:p.y,text:'BLOKE',life:0.5,vy:-24,color:'#bcd2f0'});
          for(let i=0;i<4;i++) particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*70,vy:(Math.random()-0.5)*70,life:0.25,color:'#dce8ff'});
        } else {
          if(p.dmg > 0){
            tgt.hp -= p.dmg * (1-(tgt.queenDmgResist||0)); tgt.flashT=1;
            if(p.kind==='bolt') playElectricHit(tgt.radius, tgt.boss); else playHit(tgt.radius, tgt.boss);
            floatTexts.push({x:p.x,y:p.y,text:'-'+Math.round(p.dmg),life:0.6,vy:-30,color:p.kind==='mage'?'#b6f0e0':'#ffe3c2'});

            /* YANSITICI: hasarın bir kısmını atan kuleye geri yansıtır.
               Kule kısa süre aşırı yüklenir ve ateş edemez. */
            if(tgt.overloadSec > 0 && p.tower && Math.random() < tgt.overloadChance){
              const tw = p.tower;
              if(towers.includes(tw) && tw.buildLeft <= 0){
                tw.cooldown = Math.max(tw.cooldown, tgt.overloadSec);
                tw.overloadT = tgt.overloadSec;
                floatTexts.push({x:tw.x,y:tw.y-30,text:'AŞIRI YÜK',life:0.8,vy:-24,color:'#ffe066'});
                for(let i=0;i<6;i++){
                  const a=(i/6)*Math.PI*2;
                  particles.push({x:tw.x,y:tw.y-10,vx:Math.cos(a)*70,vy:Math.sin(a)*70,life:0.35,color:'#fff3a8'});
                }
              }
            }
          }
          if(p.slow){
            tgt.slowT = p.slowDuration;
            tgt.slowFactor = p.slow;
            // ATEŞ vs DON: yavaşlatma, üzerindeki yanmayı hemen söndürür.
            tgt.burnT = 0; tgt.burnDps = 0;
            if(p.dmg <= 0) tgt.flashT = 0.6;
          }
          // ZEHİR: hedefe zamana yayılı hasar yükle (en güçlü etki geçerli)
          if(p.poisonDps > 0){
            if(!(tgt.poisonDps > p.poisonDps)) tgt.poisonDps = p.poisonDps;
            tgt.poisonT = Math.max(tgt.poisonT||0, p.poisonDuration);
          }
          // ŞİMŞEK: hedeften yakındaki düşmanlara sıçra
          if(p.chainCount > 0){
            let cur = tgt;
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
              next.hp -= dmg * (1-(next.queenDmgResist||0)); next.flashT = 1;
              playElectricHit(next.radius, next.boss);
              arcs.push({x1:cur.x, y1:cur.y, x2:next.x, y2:next.y, life:0.22});
              floatTexts.push({x:next.x,y:next.y,text:'-'+Math.round(dmg),life:0.5,vy:-26,color:'#fff3a8'});
              hitSet.add(next);
              cur = next;
            }
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
      playKill();

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

        // ENKAZ: kırılan şişenin yere döktüğü sıvı gibi, küpün
        // parçaları da bir süre yerde saçılı kalır (yalnızca görsel).
        const pieces = [];
        const pieceCount = 6 + Math.floor(Math.random()*3);
        for(let i=0;i<pieceCount;i++){
          const a = Math.random()*Math.PI*2, d = 6 + Math.random()*(e.radius*0.9);
          pieces.push({ dx:Math.cos(a)*d, dy:Math.sin(a)*d, rot:Math.random()*Math.PI, size:3+Math.random()*4 });
        }
        debris.push({ x:e.x, y:e.y, life:1.6, maxLife:1.6, color:e.body, color2:e.body2, pieces });
      }

      // ŞİŞE KIRILMASI: yere dökülen sıvı uzun süre iyileştirir
      if(e.healRadius > 0){
        healZones.push({
          x:e.x, y:e.y,
          r:e.healRadius,
          healPerSec:e.healPerSec,
          life:e.healDuration,
          maxLife:e.healDuration,
        });
        // Kırılma efekti: cam kırıkları + sıvı sıçraması
        for(let i=0;i<22;i++){
          const ang=(i/22)*Math.PI*2, sp=60+Math.random()*110;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.5,
            color: i%3===0 ? '#dffbe9' : '#7fe0a8'});
        }
        floatTexts.push({x:e.x,y:e.y-16,text:'ŞİŞE KIRILDI',life:1.0,vy:-26,color:'#7fe0a8'});
      }

      // KIVILCIM PATLAMASI: ölünce geniş bir alana patlayıcı polen saçar;
      // yarıçaptaki kuleler bir süreliğine kör olup ateş edemez.
      if(e.deathBlindRadius > 0){
        let blinded = 0;
        towers.forEach(tw=>{
          if(tw.buildLeft > 0) return;   // inşa halindeki kule zaten ateş etmiyor
          if(Math.hypot(tw.x-e.x, tw.y-e.y) <= e.deathBlindRadius){
            tw.cooldown = Math.max(tw.cooldown, e.deathBlindDuration);
            tw.blindT = e.deathBlindDuration;
            blinded++;
          }
        });
        explosions.push({x:e.x,y:e.y,r:6,maxR:e.deathBlindRadius,life:0.5});
        shake = Math.min(shake+6, 16);
        playBlindBurst();
        for(let i=0;i<26;i++){
          const ang=(i/26)*Math.PI*2, sp=70+Math.random()*130;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.55,
            color: i%3===0 ? '#ffe08a' : (i%3===1 ? '#ff8a4a' : '#ffb35c')});
        }
        if(blinded>0) floatTexts.push({x:e.x,y:e.y-16,text:'KÖRLEŞTİ',life:0.9,vy:-26,color:'#ffb35c'});
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

  refreshTowerPanelAffordability();
}
