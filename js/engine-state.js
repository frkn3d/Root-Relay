/* ============================================================
   MOTOR / DURUM — bölüm ve yol verisi, yol üzerinde mesafe
   hesapları, tüm oyun durumu değişkenleri (altın, can, diziler)
   ve ortam kuşu sürüsünün doğuşu.
   Buradaki değişkenler diğer motor/çizim dosyalarınca paylaşılır.
   ============================================================ */
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
/* beams: Lazer Kulesi'nin çakan ışınları. Mermi DEĞİL — hasar ışın
   doğduğu anda uygulanır; kayıt yalnızca ışının kısa ömürlü görselini
   taşır ve hedefi referansla tuttuğu için düşman kaçsa bile ışın onu
   birebir takip eder (bkz. drawBeams, render-fx.js). */
let towers, enemies, projectiles, particles, floatTexts, explosions, arcs, healZones, debris, beams;
let spawnTimeline, waveElapsed;
let shake = 0;
let spots = [];
let selectedType = 'archer';
/* Bölüm başına, tür başına şu an İNŞA HALİNDE OLAN kule sayısı — satış
   bu sayacı bir azaltıp satın alma hakkını geri verir (bkz.
   TOWER_TYPES[id].maxCount, confirmSellTower()). */
let towerPurchaseCounts = {};
function towersRemaining(def){
  return def.maxCount - (towerPurchaseCounts[def.id]||0);
}
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
