/* ============================================================
   MOTOR / KULELER — kule ekonomisi ve etkileşimi:
   maliyet ve inşa süreleri, bölüm etkileriyle hesaplanan stat'lar,
   hedef seçimi, yükseltme/satış paneli, hız düğmesi, bölüm içi market
   ve kurulum onayı.
   ============================================================ */
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

/* Zehir Sarmaşığı ve Ateş Kulesi (alan/süre etkili, aynı seviyede diğer
   kulelerden orantısız güçlü kalıyorlar) yükseltmelerine ekstra düz zam.
   Taban zam ikisinde de +100 / +200 / +300 idi; Ateş Kulesi son ayarla
   bunun üstüne +50 / +100 / +240 daha aldı, yani [150, 300, 540]. */
const EXTRA_UPGRADE_SURCHARGE = {
  poison: [100, 200, 300],
  fire:   [150, 300, 540],
  /* LAZER KULESİ — yalnızca son yükseltmeye zam: 420 -> 720 altın.
     Tablodaki sayı neden 300 değil 400: 420'nin içindeki 100 altın
     FINAL_UPGRADE_BUMP'tan geliyordu (taban 320, eşiğin altında).
     Zam fiyatı eşiğin üstüne çıkarınca o 100 düşüyor; istenen +300'ü
     tutturmak için tabloya 400 yazılıyor. 320 + 400 = 720. */
  mage:   [0, 0, 400],
};
/* SON YÜKSELTME TABANI — 3. yükseltme (seviye 2 -> 3) ucuza gelen
   kulelerde fazla erişilebilir kalıyordu. Bu eşiğin ALTINDA kalan son
   yükseltmelere düz bir zam biniyor; eşiği aşanlar (Havan, Zehir,
   Şimşek, Ateş) zaten pahalı olduğu için dokunulmuyor. */
const FINAL_UPGRADE_FLOOR = 500;
const FINAL_UPGRADE_BUMP  = 100;

function upgradeCost(t){
  const lvl = t.level||0;
  if(lvl>=3) return null;
  // Fiyatlar her zaman 5'in katı olsun — okunması kolay, tutarlı sayılar
  const base = Math.round(t.def.cost * UPGRADE_COST_MULT[lvl] / 5) * 5;
  const surcharge = (EXTRA_UPGRADE_SURCHARGE[t.def.id] || [0,0,0])[lvl];
  let price = base + surcharge;
  // lvl 2 = 3. (son) yükseltme
  if(lvl === 2 && price < FINAL_UPGRADE_FLOOR) price += FINAL_UPGRADE_BUMP;
  return price;
}
/* Aktif bölümün mevsim/biyom etkileri. Klasik bölümlerde tema
   olmadığı için nötr değerler döner. */
const NEUTRAL_MODS = { iceSlowBonus:0, enemySpeedMul:1, goldMul:1, rangeMul:1, dmgMul:{}, notes:[], labels:[] };
function levelMods(){
  return (level && level.mods) ? level.mods : NEUTRAL_MODS;
}

/* levelOverride verilirse kulenin ŞU ANKİ seviyesi yerine o seviyedeki
   değerler hesaplanır — yükseltme panelinde "bir sonraki seviyede ne
   olacak" önizlemesi bununla üretilir (bkz. renderTowerPanel, ui.js). */
function getTowerStats(t, levelOverride){
  const lvl = (levelOverride !== undefined && levelOverride !== null) ? levelOverride : (t.level||0);
  const m = levelMods();
  const kind = t.def.kind;
  const dmgMul = m.dmgMul[kind] || 1;

  let range = t.def.range * (1+lvl*0.10) * m.rangeMul;
  // Mantar Havanı son seviyede ek menzil kazanır (uzun menzilli topçu rolü).
  // Taban menzille birlikte %50 büyütüldü (25 -> 37.5), böylece havanın
  // menzil artışı HER seviyede tam olarak %50 oluyor.
  if(kind==='mortar' && lvl>=3) range += 37.5;
  return {
    dmg: t.def.dmg * (1+lvl*0.28) * dmgMul,
    range: range,
    /* Atış aralığı (saniye). Kulelerin çoğu genel formülü kullanır:
       her seviye %15 hızlanma. Bir kule kendi eğrisini dayatmak
       isterse (ör. Mantar Havanı'nın 3.0 -> 1.0 sn'lik top ritmi)
       def.rateByLevel dizisi bunu geçersiz kılar. */
    rate: t.def.rateByLevel
      ? t.def.rateByLevel[Math.min(lvl, t.def.rateByLevel.length-1)]
      : t.def.rate * (1-lvl*0.15),
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
/* Kulenin GÖRSEL namlu/yay/uç noktasının dünya koordinatı — render.js'teki
   ilgili çizim fonksiyonundaki döndürme pivotu ve uzunlukla BİREBİR eşleşir
   (drawArcherTower/drawMortarTower/drawBoltTower). Mermi buradan çıkmazsa
   namlu görsel olarak hedefe dönükken mermi kule merkezinin üstünden
   fırlamış gibi görünür — bkz. "havan namlu ucundan atmıyor" hatası.
   Don Peykesi/Zehir Sarmaşığı döner bir namluya sahip değil; bunlar için
   sabit, yöne bağlı olmayan bir çıkış noktası yeterli. Lazer Kulesi'nin
   ışını da süzülen küreden çıkar, o da yönden bağımsız. */
function muzzlePoint(t){
  const aim = (t.aimAngle !== undefined) ? t.aimAngle : (t.angle !== undefined ? t.angle : -Math.PI/2);
  const lvl = t.level||0;
  let pivotY, dist;
  switch(t.def.kind){
    case 'archer': pivotY = -4;  dist = 10;          break;  // yay yarıçapı
    case 'mortar': pivotY = -4;  dist = 26 + lvl*3;  break;  // namlu boyu (bkz. drawMortarTower)
    case 'bolt':   pivotY = -48; dist = 11;          break;  // çatal uçları
    /* Lav namlusunun ucu (bkz. drawFireTower): pivot y-13, boy 15+lvl*2 */
    case 'fire':   pivotY = -13; dist = 15 + lvl*2;  break;
    case 'mage':   return { x:t.x, y:t.y-36 };               // süzülen küre, yönden bağımsız
    case 'ice':    return { x:t.x, y:t.y-22 };               // kristal ucu, yönden bağımsız
    case 'poison': return { x:t.x, y:t.y-10 };               // tomurcuk ucu, yönden bağımsız
    default:       pivotY = -20; dist = 0;
  }
  return { x: t.x + Math.cos(aim)*dist, y: t.y + pivotY + Math.sin(aim)*dist };
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
  if(worst > 0) playFrostlordAura();   // audio.js — kendi içinde uzun aralıkla kısıtlı
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
    const dis = gold < buildCost(def) || towersRemaining(def) <= 0;
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
  playTargetMode();   // audio.js
  renderTowerPanel();
}

/* ============================================================
   YÜKSELTMEYE HAZIR ROZETİ — bir kule şu anda yükseltilebiliyorsa
   yanında küçük yeşil bir düğme yanar. Amaç oyuncuyu tetikte tutmak:
   altın biriktiğinde "şimdi harcayabilirsin" işareti sahada görünür,
   panel açmaya gerek kalmadan.
   Geometri hem çizim (drawUpgradeBadge, render-towers.js) hem de
   dokunma testi (main.js) tarafından kullanıldığı için burada,
   ikisinin de öncesinde yüklenen dosyada duruyor. */
const UPGRADE_BADGE_DX = 20;    // kule merkezine göre yatay kayma
const UPGRADE_BADGE_DY = -22;   // ...ve dikey
const UPGRADE_BADGE_R  = 9;     // çizim yarıçapı
const UPGRADE_BADGE_TAP_R = 14; // dokunma yarıçapı (parmak için biraz geniş)

function towerUpgradeReady(t){
  if(!t || t.buildLeft > 0) return false;       // inşa/yükseltme sürüyor
  const cost = upgradeCost(t);
  if(cost === null) return false;               // son seviye
  return gold >= cost;                          // parası var mı
}

/* Rozete dokunulduysa o kuleyi döndürür (main.js kullanır). */
function findUpgradeBadgeAt(mx, my){
  let found = null, bestD = Infinity;
  towers.forEach(t=>{
    if(!towerUpgradeReady(t)) return;
    if(towerPanelOpen && selectedTower === t) return;   // panel zaten açık
    const d = Math.hypot(mx-(t.x+UPGRADE_BADGE_DX), my-(t.y+UPGRADE_BADGE_DY));
    if(d < UPGRADE_BADGE_TAP_R && d < bestD){ bestD = d; found = t; }
  });
  return found;
}

function openTowerPanel(t){
  playTowerSelect();   // audio.js
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
  addGoldSpentStat(cost);
  t.totalSpent += cost;
  document.getElementById('goldVal').textContent = gold;
  // Seviye hemen artmaz — inşa süresi dolunca uygulanır.
  const nextLevel = (t.level||0)+1;
  t.pendingLevel = nextLevel;
  t.buildDuration = buildDurationFor(nextLevel);
  t.buildLeft = t.buildDuration;
  playTowerUpgrade();   // audio.js
  renderTowerPanel();
}
function requestSellTower(){ sellConfirmPending=true; playClick(); renderTowerPanel(); }
function cancelSellTower(){ sellConfirmPending=false; renderTowerPanel(); }
function confirmSellTower(){
  if(!selectedTower) return;
  const refund = Math.floor(selectedTower.totalSpent/2);
  gold += refund;
  const soldId = selectedTower.def.id;
  towerPurchaseCounts[soldId] = Math.max(0, (towerPurchaseCounts[soldId]||0) - 1);
  towers = towers.filter(t=>t!==selectedTower);
  spots.forEach(s=>{ if(s.occ===selectedTower) s.occ=null; });
  document.getElementById('goldVal').textContent = gold;
  playTowerSell();   // audio.js
  closeTowerPanel();
  renderTowerSelectBtn(); renderTowerDrawer(); // ui.js — satılan türün rozeti/silikleşmesi anında güncellensin
}

const SPEED_STEPS = [1, 2, 4];
function toggleSpeed(){
  const idx = SPEED_STEPS.indexOf(gameSpeed);
  gameSpeed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
  playSpeedToggle();   // audio.js
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
    addGoldEarnedStat(50);
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
  document.getElementById('bcOk').disabled = gold < cost || towersRemaining(def) <= 0;

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
  if(towersRemaining(def) <= 0){ playError(); return; }
  if(gold < cost){
    playError();
    const chip=document.getElementById('goldChip');
    chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
    return;
  }
  gold -= cost;
  addGoldSpentStat(cost);
  document.getElementById('goldVal').textContent = gold;
  towerPurchaseCounts[def.id] = (towerPurchaseCounts[def.id]||0) + 1;
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
  renderTowerSelectBtn(); renderTowerDrawer(); // ui.js — kalan sayı rozetleri tazelensin
}
