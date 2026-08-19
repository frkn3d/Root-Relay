/* ============================================================
   LEVELGEN — tohum (seed) tabanlı prosedürel bölüm üreteci.

   Aynı tohum + aynı bölüm numarası HER ZAMAN aynı bölümü üretir.
   Rastgelelik tamamen deterministiktir; hiçbir yerde Math.random
   kullanılmaz. Böylece bir tohum paylaşılabilir ve tekrar oynanabilir.

   Kurallar (tasarım şartnamesi):
   1. Toplam yol uzunluğu ekran alanına göre bir tavanı aşamaz.
   2. Zorluk dalgalanır — sürekli artmaz, dopamin döngüsü korunur.
   3. İlk bölümler kolay: az dalga, az düşman.
   4. Kule noktası sayısı zorlukla ±1 oynar.
   5. Nokta sayısı, yol uzunluğuna göre bir tabanın altına inemez.
   6. Bazı bölümler 2 giriş / 1 çıkış, 2/2 veya 1/2 olabilir.
   7. Kule noktaları yola belirli bir mesafeden yakın olamaz.
   8. 4 mevsim × 7 bitki örtüsü × 3 yol tipi = görsel çeşitlilik.
   ============================================================ */

/* ---------- Deterministik rastgelelik ---------- */

// 32-bit karma: metin tohumu sayıya çevirir
function hashSeed(str){
  let h = 2166136261 >>> 0;
  const s = String(str);
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — küçük, hızlı, iyi dağılımlı PRNG
function makeRng(seedInt){
  let a = seedInt >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Yardımcılar
function rnd(rng, min, max){ return min + rng()*(max-min); }
function rndInt(rng, min, max){ return Math.floor(rnd(rng, min, max+1)); }
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }

/* ---------- Tema tanımları ---------- */

const SEASONS = {
  spring: { id:'spring', name:'İlkbahar', tint:'#8fd07a', sky:'#2f5233' },
  summer: { id:'summer', name:'Yaz',      tint:'#e8c96a', sky:'#3a5a2a' },
  autumn: { id:'autumn', name:'Sonbahar', tint:'#d98a43', sky:'#4a3a22' },
  winter: { id:'winter', name:'Kış',      tint:'#cfe6f2', sky:'#33424d' },
};

/* 7 bitki örtüsü. Her biri mevsime göre değişen taban renkleri taşır. */
const BIOMES = {
  forest:    { id:'forest',    name:'Orman',
    base:{ spring:['#2f5233','#213b26'], summer:['#2b4d2c','#1c3520'], autumn:['#4a3f22','#332c18'], winter:['#33423a','#232f29'] },
    decor:'tree', decorDensity:1.0 },
  desert:    { id:'desert',    name:'Çöl',
    base:{ spring:['#8a7440','#6b5930'], summer:['#a98c4c','#836b39'], autumn:['#8f7038','#6d552a'], winter:['#7e7359','#5f5642'] },
    decor:'rock', decorDensity:0.5 },
  mediterranean:{ id:'mediterranean', name:'Akdeniz',
    base:{ spring:['#4f6b3a','#3a5029'], summer:['#5f6f36','#465227'], autumn:['#6a5c2e','#4d4321'], winter:['#44553c','#31402c'] },
    decor:'bush', decorDensity:0.8 },
  tundra:    { id:'tundra',    name:'Tundra',
    base:{ spring:['#5a6a5e','#414d45'], summer:['#63705f','#4a5546'], autumn:['#5e6250','#45483a'], winter:['#7d8f99','#5c6a72'] },
    decor:'rock', decorDensity:0.6 },
  swamp:     { id:'swamp',     name:'Bataklık',
    base:{ spring:['#33452f','#233020'], summer:['#2e4429','#1f301c'], autumn:['#3b3d22','#282a16'], winter:['#313d39','#222b28'] },
    decor:'reed', decorDensity:1.1 },
  savanna:   { id:'savanna',   name:'Savan',
    base:{ spring:['#6f7a3a','#525a29'], summer:['#8a8542','#67632f'], autumn:['#87703a','#635027'], winter:['#6b6a4c','#4d4c37'] },
    decor:'grass', decorDensity:0.7 },
  volcanic:  { id:'volcanic',  name:'Volkanik',
    base:{ spring:['#463a3a','#2e2626'], summer:['#4e3a34','#332624'], autumn:['#4a332c','#31211d'], winter:['#3d3636','#282323'] },
    decor:'rock', decorDensity:0.9 },
};

/* 3 yol tipi — renk ve doku farkı */
const ROAD_TYPES = {
  dirt:   { id:'dirt',   name:'Toprak', edge:'#c9a463', fill:'#dab876', speck:'rgba(120,80,40,0.35)' },
  stone:  { id:'stone',  name:'Taş',    edge:'#8e8b83', fill:'#a9a69c', speck:'rgba(60,58,54,0.35)' },
  asphalt:{ id:'asphalt',name:'Asfalt', edge:'#4a4d52', fill:'#5d6167', speck:'rgba(20,20,22,0.4)' },
};

/* ---------- Kural sabitleri ---------- */
const GEN = {
  W: 600, H: 1000,                 // mantıksal saha ölçüsü
  MARGIN: 60,                      // kenar boşluğu
  MAX_PATH_RATIO: 4.2,             // yol uzunluğu / ekran yüksekliği tavanı
  MIN_SPOT_TO_PATH: 46,            // kule–yol asgari mesafesi (kaos önleme)
  MIN_SPOT_TO_SPOT: 74,            // kule–kule asgari mesafesi
  SPOTS_PER_LEN: 1/150,            // yol uzunluğu başına asgari nokta
  TOTAL_LEVELS: 1000,
};

/* ---------- Zorluk eğrisi ----------
   Taban artış + üç farklı periyotta salınım. Sürekli tırmanmaz;
   zor bölümden sonra nefes aldıran bölümler gelir. */
function difficultyFor(levelNo){
  const n = levelNo;                                   // 1..1000
  // Taban tırmanış: baştan sona yavaşça 0.04 -> 1.00
  const base = 0.04 + 0.96 * Math.pow(n / GEN.TOTAL_LEVELS, 0.85);

  // Salınımlar: kısa (7), orta (19) ve uzun (67) döngüler.
  // ÖNEMLİ: salınım mutlak değil ORANSAL uygulanır. Aksi halde erken
  // bölümlerde taban küçük olduğu için toplam negatife düşer ve zorluk
  // uzun süre alt sınıra yapışıp düzleşir (dalgalanma kaybolur).
  const w1 = Math.sin(n / 7  * Math.PI) * 0.16;
  const w2 = Math.sin(n / 19 * Math.PI) * 0.11;
  const w3 = Math.sin(n / 67 * Math.PI) * 0.08;

  const relief = (n % 10 === 0) ? -0.22 : 0;   // her 10. bölüm nefes aldırır
  const spike  = (n % 25 === 0) ?  0.26 : 0;   // her 25. bölüm zirve

  let d = base * (1 + w1 + w2 + w3 + relief + spike);

  // İlk bölümler kesinlikle kolay
  if(n <= 5)  d = Math.min(d, 0.03 + n*0.010);
  if(n <= 15) d = Math.min(d, 0.09 + n*0.008);

  return Math.max(0.02, Math.min(1, d));
}

/* ---------- Yol üretimi ---------- */

/* ============================================================
   YOL ÜRETİMİ — ızgara üzerinde kendini kesmeyen yürüyüş

   Eski "zikzak omurga" yöntemi yolun kendi üzerinden geçmesini
   yapısal olarak engelleyemiyordu. Bunun yerine saha kaba bir
   ızgaraya bölünür ve yol, hiçbir hücreyi iki kez kullanmayan bir
   yürüyüşle çizilir. Bu, kesişmeyi matematiksel olarak imkânsız
   kılar; ayrıca giriş/çıkış herhangi bir kenardan olabilir.
   ============================================================ */

const GRID_COLS = 5;
const GRID_ROWS = 8;

function cellCenter(cx, cy){
  const cw = GEN.W / GRID_COLS;
  const ch = GEN.H / GRID_ROWS;
  return { x: cw*(cx+0.5), y: ch*(cy+0.5) };
}

/* Bir kenardan rastgele giriş/çıkış hücresi seçer */
function edgeCell(rng, edge){
  switch(edge){
    case 'top':    return { cx: rndInt(rng,0,GRID_COLS-1), cy: 0 };
    case 'bottom': return { cx: rndInt(rng,0,GRID_COLS-1), cy: GRID_ROWS-1 };
    case 'left':   return { cx: 0,             cy: rndInt(rng,1,GRID_ROWS-2) };
    default:       return { cx: GRID_COLS-1,   cy: rndInt(rng,1,GRID_ROWS-2) };
  }
}

/* Hücre merkezinden ekran dışına uzanan giriş/çıkış payı */
function edgeStub(edge, p){
  switch(edge){
    case 'top':    return { x:p.x, y:-25 };
    case 'bottom': return { x:p.x, y:GEN.H+25 };
    case 'left':   return { x:-25, y:p.y };
    default:       return { x:GEN.W+25, y:p.y };
  }
}

/* Kendini kesmeyen yürüyüş: başlangıç hücresinden hedefe, hiçbir
   hücreyi tekrar kullanmadan. Rastgele sıralı derinlik öncelikli
   arama + geri izleme. blocked: başka bir yolun kapladığı hücreler. */
function selfAvoidingWalk(rng, start, goal, blocked, minCells, maxCells){
  const key = (c)=>c.cx+','+c.cy;
  const blockedSet = new Set((blocked||[]).map(key));
  const path = [];
  const used = new Set();
  let steps = 0;
  const STEP_CAP = 9000;

  function neighbors(c){
    const list = [
      {cx:c.cx+1, cy:c.cy}, {cx:c.cx-1, cy:c.cy},
      {cx:c.cx, cy:c.cy+1}, {cx:c.cx, cy:c.cy-1},
    ].filter(n =>
      n.cx>=0 && n.cx<GRID_COLS && n.cy>=0 && n.cy<GRID_ROWS &&
      !used.has(key(n)) && !blockedSet.has(key(n))
    );
    // Rastgele sırala (Fisher–Yates, tohumlu)
    for(let i=list.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [list[i],list[j]] = [list[j],list[i]];
    }
    // Hedefe yaklaşanları hafifçe öne al ki yürüyüş tıkanmasın
    list.sort((a,b)=>{
      const da = Math.abs(a.cx-goal.cx)+Math.abs(a.cy-goal.cy);
      const db = Math.abs(b.cx-goal.cx)+Math.abs(b.cy-goal.cy);
      return (da-db) * (rng()<0.55 ? 1 : -1);
    });
    return list;
  }

  function dfs(c){
    if(steps++ > STEP_CAP) return false;
    path.push(c); used.add(key(c));

    if(c.cx===goal.cx && c.cy===goal.cy){
      if(path.length >= minCells) return true;
      // Çok kısa — geri dön ve daha uzun bir rota dene
      path.pop(); used.delete(key(c));
      return false;
    }
    if(path.length >= maxCells){
      path.pop(); used.delete(key(c));
      return false;
    }
    for(const n of neighbors(c)){
      if(dfs(n)) return true;
    }
    path.pop(); used.delete(key(c));
    return false;
  }

  return dfs(start) ? path : null;
}

/* Hücre dizisini yumuşatılmış polyline'a çevirir.
   Köşelerde küçük kırılmalar bırakır ki yol organik görünsün. */
function cellsToPolyline(cells, entryEdge, exitEdge){
  const pts = cells.map(c=>cellCenter(c.cx, c.cy));
  const out = [ edgeStub(entryEdge, pts[0]) ];
  pts.forEach(p=>out.push(p));
  out.push(edgeStub(exitEdge, pts[pts.length-1]));
  return out;
}

/* Bir hücre yürüyüşünün sahayı ne kadar kapsadığını ölçer.
   Yol ekranın bir köşesine sıkışırsa geri kalan alan boş kalır ve
   kompozisyon bozulur; bu yüzden asgari yayılım şartı aranır. */
function walkCoverage(cells){
  let minX=99, maxX=-1, minY=99, maxY=-1;
  cells.forEach(c=>{
    if(c.cx<minX) minX=c.cx; if(c.cx>maxX) maxX=c.cx;
    if(c.cy<minY) minY=c.cy; if(c.cy>maxY) maxY=c.cy;
  });
  return {
    w: maxX-minX+1, h: maxY-minY+1,
    minX, maxX, minY, maxY,
  };
}

/* Rota düzenini seçer ve kesişmeyen yollar üretir. */
function buildRoutes(rng, diff, budgetScale){
  const scale = budgetScale === undefined ? 1 : budgetScale;
  const r = rng();
  let layout;
  if(diff < 0.18)      layout = '1-1';
  else if(diff < 0.40) layout = (r < 0.72) ? '1-1' : '2-1';
  else if(diff < 0.65) layout = (r < 0.45) ? '1-1' : (r < 0.78 ? '2-1' : '1-2');
  else                 layout = (r < 0.32) ? '1-1' : (r < 0.58 ? '2-1' : (r < 0.80 ? '1-2' : '2-2'));

  // Çok rotalı düzenlerde her rota daha kısa olmalı ki TOPLAM uzunluk
  // tavanı aşmasın (KURAL 1). budgetScale, tavan aşılırsa üst katman
  // tarafından küçültülerek yeniden denenir.
  const multi = (layout !== '1-1');
  const lenScale = scale * (multi ? 0.62 : 1);

  const minCells = Math.max(6, Math.round((8 + diff*4) * lenScale));
  const maxCells = Math.max(minCells+2, Math.min(26, Math.round((13 + diff*9) * lenScale)));

  const EDGES = ['top','bottom','left','right'];
  const opposite = { top:'bottom', bottom:'top', left:'right', right:'left' };

  /* Bir rota dener; başarısız olursa farklı kenarlarla tekrar dener.
     Kapsama şartı: yol, ızgaranın en az belli bir bölümünü kat etmeli. */
  const NEED_W = Math.max(2, Math.round(GRID_COLS*0.7));   // en az 4/5 sütun
  const NEED_H = Math.max(3, Math.round(GRID_ROWS*0.62));  // en az 5/8 satır

  function tryRoute(blocked, forcedEntry){
    let fallback = null;
    for(let attempt=0; attempt<26; attempt++){
      const entryEdge = forcedEntry || pick(rng, EDGES);
      // Çıkış: karşı kenar ağırlıklı, bazen komşu kenar
      const exitEdge = rng() < 0.65
        ? opposite[entryEdge]
        : pick(rng, EDGES.filter(e=>e!==entryEdge));
      const start = edgeCell(rng, entryEdge);
      const goal  = edgeCell(rng, exitEdge);
      if(start.cx===goal.cx && start.cy===goal.cy) continue;
      const cells = selfAvoidingWalk(rng, start, goal, blocked, minCells, maxCells);
      if(!cells) continue;
      const cov = walkCoverage(cells);
      if(cov.w >= NEED_W && cov.h >= NEED_H) return { cells, entryEdge, exitEdge };
      // Kapsama yetersiz — yedek olarak sakla, daha iyisini aramaya devam et
      if(!fallback || (cov.w*cov.h) > walkCoverage(fallback.cells).w*walkCoverage(fallback.cells).h){
        fallback = { cells, entryEdge, exitEdge };
      }
    }
    return fallback;   // hiç ideal bulunamazsa en geniş olanı kullan
  }

  const paths = [];
  const usedCells = [];
  let entries = 1, exits = 1;

  const a = tryRoute([]);
  if(!a){
    // Aşırı nadir: kısıtları gevşetip basit bir dikey rota üret
    const cells = [];
    const col = rndInt(rng, 1, GRID_COLS-2);
    for(let cy=0; cy<GRID_ROWS; cy++) cells.push({cx:col, cy});
    paths.push(cellsToPolyline(cells, 'top', 'bottom'));
    return { paths, entries:1, exits:1, layout:'1-1' };
  }
  paths.push(cellsToPolyline(a.cells, a.entryEdge, a.exitEdge));
  a.cells.forEach(c=>usedCells.push(c));

  if(layout === '2-1'){
    // İkinci giriş, birincinin kuyruğuna katılır → tek çıkış
    const joinAt = Math.max(2, Math.floor(a.cells.length * 0.55));
    const joinCell = a.cells[joinAt];
    /* ÖNEMLİ: ikinci yol, birinci yolun SADECE birleşme hücresine
       dokunabilir. Aksi halde kuyruk hücrelerinden geçer ve birleşme
       sonrası aynı hücreler tekrar kullanıldığı için yol kendi
       üzerinden geri döner (düşmanlar kavşakta ters yöne sapar). */
    const blockAll = a.cells.filter((_,i)=> i !== joinAt);
    let b = null;
    for(let attempt=0; attempt<20 && !b; attempt++){
      const entryEdge = pick(rng, EDGES);
      const start = edgeCell(rng, entryEdge);
      if(blockAll.some(c=>c.cx===start.cx && c.cy===start.cy)) continue;
      if(start.cx===joinCell.cx && start.cy===joinCell.cy) continue;
      const cells = selfAvoidingWalk(rng, start, joinCell, blockAll, 4, 14);
      if(cells) b = { cells, entryEdge };
    }
    if(b){
      const tail = a.cells.slice(joinAt+1);
      const merged = b.cells.concat(tail);
      paths.push(cellsToPolyline(merged, b.entryEdge, a.exitEdge));
      entries = 2; exits = 1;
    } else { layout = '1-1'; }
  }
  else if(layout === '1-2'){
    // Ortak baş, ayrışan kuyruk → iki çıkış
    const splitAt = Math.max(2, Math.floor(a.cells.length * 0.45));
    const head = a.cells.slice(0, splitAt+1);
    const tailBlocked = a.cells.slice(splitAt+1);
    let b = null;
    for(let attempt=0; attempt<14 && !b; attempt++){
      const exitEdge = pick(rng, EDGES.filter(e=>e!==a.entryEdge));
      const goal = edgeCell(rng, exitEdge);
      if(head.some(c=>c.cx===goal.cx && c.cy===goal.cy)) continue;
      const cells = selfAvoidingWalk(rng, head[head.length-1], goal, head.slice(0,-1).concat(tailBlocked), 4, 14);
      if(cells) b = { cells, exitEdge };
    }
    if(b){
      const merged = head.slice(0,-1).concat(b.cells);
      paths.push(cellsToPolyline(merged, a.entryEdge, b.exitEdge));
      entries = 1; exits = 2;
    } else { layout = '1-1'; }
  }
  else if(layout === '2-2'){
    // Tamamen ayrı ikinci rota — birinciyle hiç hücre paylaşmaz
    const b = tryRoute(usedCells);
    if(b){
      paths.push(cellsToPolyline(b.cells, b.entryEdge, b.exitEdge));
      entries = 2; exits = 2;
    } else { layout = '1-1'; }
  }

  return { paths, entries, exits, layout, style:'grid' };
}

/* Bir polyline'ın uzunluğu */
function polyLen(pts){
  let L=0;
  for(let i=0;i<pts.length-1;i++) L += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y);
  return L;
}


/* ---------- Kule noktası yerleşimi ---------- */

/* Bir noktanın polyline'a en kısa mesafesi */
function distToPath(px, py, pts){
  let best = Infinity;
  for(let i=0;i<pts.length-1;i++){
    const ax=pts[i].x, ay=pts[i].y, bx=pts[i+1].x, by=pts[i+1].y;
    const dx=bx-ax, dy=by-ay;
    const len2 = dx*dx+dy*dy;
    let t = len2 ? ((px-ax)*dx + (py-ay)*dy)/len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx=ax+dx*t, cy=ay+dy*t;
    const d = Math.hypot(px-cx, py-cy);
    if(d<best) best=d;
  }
  return best;
}

function placeSpots(rng, paths, diff, totalLen){
  const {W,H,MARGIN,MIN_SPOT_TO_PATH,MIN_SPOT_TO_SPOT} = GEN;

  // KURAL 5: yol uzunluğuna göre asgari nokta sayısı
  const minBySize = Math.ceil(totalLen * GEN.SPOTS_PER_LEN);
  // KURAL 4: zorluğa göre ±1 oynama
  const wobble = rndInt(rng, -1, 1);
  const target = Math.max(minBySize, 8 + Math.round(diff*8) + wobble);

  const spots = [];
  let attempts = 0;
  const MAX_ATTEMPTS = 4000;

  while(spots.length < target && attempts < MAX_ATTEMPTS){
    attempts++;
    const x = rnd(rng, MARGIN*0.5, W - MARGIN*0.5);
    const y = rnd(rng, MARGIN*0.6, H - MARGIN*0.6);

    // KURAL 7: yola çok yakın olamaz (ama menzil içinde kalmalı)
    let dp = Infinity;
    for(const p of paths) dp = Math.min(dp, distToPath(x,y,p));
    if(dp < MIN_SPOT_TO_PATH) continue;
    if(dp > 165) continue;                 // yoldan tamamen kopuk olmasın

    // Noktalar birbirine binmesin
    let ok = true;
    for(const s of spots){
      if(Math.hypot(s.x-x, s.y-y) < MIN_SPOT_TO_SPOT){ ok=false; break; }
    }
    if(!ok) continue;

    spots.push({x:Math.round(x), y:Math.round(y)});
  }

  // Hedefe ulaşılamadıysa kısıtı kademeli gevşeterek tamamla
  let relax = 0;
  while(spots.length < minBySize && relax < 3){
    relax++;
    const minGap = MIN_SPOT_TO_SPOT - relax*12;
    const minPath = MIN_SPOT_TO_PATH - relax*6;
    let tries = 0;
    while(spots.length < minBySize && tries < 1500){
      tries++;
      const x = rnd(rng, MARGIN*0.5, W - MARGIN*0.5);
      const y = rnd(rng, MARGIN*0.6, H - MARGIN*0.6);
      let dp = Infinity;
      for(const p of paths) dp = Math.min(dp, distToPath(x,y,p));
      if(dp < minPath || dp > 190) continue;
      let ok = true;
      for(const s of spots){ if(Math.hypot(s.x-x,s.y-y) < minGap){ ok=false; break; } }
      if(!ok) continue;
      spots.push({x:Math.round(x), y:Math.round(y)});
    }
  }

  return spots;
}

/* ---------- Tema seçimi ---------- */
function pickTheme(rng, levelNo){
  const seasonIds = Object.keys(SEASONS);
  const biomeIds  = Object.keys(BIOMES);
  const roadIds   = Object.keys(ROAD_TYPES);

  // Mevsim yavaşça dönsün ama tohuma göre kayabilsin
  const seasonOffset = rndInt(rng, 0, 3);
  const season = seasonIds[(Math.floor((levelNo-1)/7) + seasonOffset) % 4];

  // Bitki örtüsü ve yol tipi tamamen tohuma bağlı
  const biome = pick(rng, biomeIds);
  const road  = pick(rng, roadIds);

  return { season, biome, road };
}

/* ---- Dalga arketipleri ----
   Aynı düşman havuzundan bile farklı "his" üretmek için bölüme bir
   karakter atanır. Sadece sayılar değil, kompozisyonun ağırlık merkezi
   ve ritmi değişir. */
const WAVE_ARCHETYPES = [
  { id:'dengeli',  name:'Dengeli',
    shares:{spore:0.42, swarm:0.34, sprinter:0.28, husk:0.16, brute:0.12}, pace:1.00 },
  { id:'akin',     name:'Akın',            // çok sayıda küçük, hızlı akış
    shares:{spore:0.30, swarm:0.95, sprinter:0.55, husk:0.05, brute:0.03}, pace:0.62 },
  { id:'kusatma',  name:'Kuşatma',         // az sayıda ağır, yavaş baskı
    shares:{spore:0.14, swarm:0.08, sprinter:0.10, husk:0.55, brute:0.42}, pace:1.65 },
  { id:'kosu',     name:'Koşu',            // hız odaklı
    shares:{spore:0.18, swarm:0.30, sprinter:0.95, husk:0.10, brute:0.06}, pace:0.70 },
  { id:'kalabalik',name:'Kalabalık',       // ekranı dolduran yığın
    shares:{spore:0.85, swarm:0.75, sprinter:0.30, husk:0.14, brute:0.08}, pace:0.75 },
  { id:'zirhli',   name:'Zırhlı',          // dayanıklılık sınavı
    shares:{spore:0.20, swarm:0.15, sprinter:0.14, husk:0.70, brute:0.22}, pace:1.35 },
  { id:'dalgali',  name:'Dalgalı',         // gruplar arası belirgin boşluk
    shares:{spore:0.50, swarm:0.45, sprinter:0.35, husk:0.22, brute:0.16}, pace:1.45 },
];

function pickArchetype(rng, diff){
  // Zor arketipler ancak zorluk yeterince yükselince açılır
  const pool = WAVE_ARCHETYPES.filter(a=>{
    if(a.id==='kusatma' || a.id==='zirhli') return diff > 0.32;
    if(a.id==='kosu') return diff > 0.16;
    return true;
  });
  return pick(rng, pool);
}

/* ---------- Dalga üretimi ---------- */
function buildWaves(rng, diff, levelNo){
  // KURAL 3: ilk bölümler az dalga
  const waveCount = Math.max(4, Math.min(14, Math.round(4 + diff*9 + rnd(rng,-0.5,0.5))));

  // Düşman havuzu zorlukla açılır
  const pool = ['spore','swarm'];
  if(diff > 0.14) pool.push('sprinter');
  if(diff > 0.30) pool.push('husk');
  if(diff > 0.46) pool.push('brute');

  // Havuzdan bazen bir tür çıkarılır — aynı havuz her bölümde
  // aynı hissi vermesin diye. (En az 2 tür kalır.)
  if(pool.length >= 4 && rng() < 0.35){
    const dropIdx = rndInt(rng, 1, pool.length-2);   // ilk ve son korunur
    pool.splice(dropIdx, 1);
  }

  const archetype = pickArchetype(rng, diff);
  const allowCube = diff > 0.34;
  const allowBoss = diff > 0.55;

  return { waveCount, pool, allowCube, allowBoss, archetype };
}

/* ---------- Manzara dekoru ----------
   Boş araziye biyoma uygun nesneler serpilir. Yola ve kule
   noktalarına değmezler; sadece görsel zenginlik katarlar. */
const BIOME_PROPS = {
  forest:        [['tree',0.5],['pine',0.25],['bush',0.25]],
  desert:        [['cactus',0.45],['rock',0.4],['deadbush',0.15]],
  mediterranean: [['olive',0.4],['bush',0.35],['rock',0.25]],
  tundra:        [['rock',0.45],['pine',0.3],['shrub',0.25]],
  swamp:         [['reed',0.45],['bush',0.3],['deadtree',0.25]],
  savanna:       [['acacia',0.35],['grass',0.4],['rock',0.25]],
  volcanic:      [['rock',0.55],['deadtree',0.25],['boulder',0.2]],
};

function pickWeighted(rng, pairs){
  let r = rng(), acc = 0;
  for(const [id,w] of pairs){ acc += w; if(r <= acc) return id; }
  return pairs[pairs.length-1][0];
}

function placeProps(rng, paths, spots, biomeId, seasonId){
  const table = BIOME_PROPS[biomeId] || BIOME_PROPS.forest;
  const props = [];
  const target = 26 + Math.floor(rng()*14);
  let tries = 0;

  while(props.length < target && tries < 1200){
    tries++;
    // Yuvarlamayi ONCE yap: aksi halde kontrolu gecen bir nokta
    // yuvarlandiktan sonra sinirin icine kayabiliyor.
    const x = Math.round(rnd(rng, 14, GEN.W-14));
    const y = Math.round(rnd(rng, 14, GEN.H-14));

    // Yola ve kule noktalarina degmesin
    let dPath = Infinity;
    for(const p of paths) dPath = Math.min(dPath, distToPath(x,y,p));
    if(dPath < 40) continue;
    let clash = false;
    for(const s of spots){ if(Math.hypot(s.x-x, s.y-y) < 36){ clash=true; break; } }
    if(clash) continue;
    for(const q of props){ if(Math.hypot(q.x-x, q.y-y) < 30){ clash=true; break; } }
    if(clash) continue;

    props.push({
      x, y,
      type: pickWeighted(rng, table),
      s: 0.75 + rng()*0.6,          // ölçek
      f: rng() < 0.5 ? -1 : 1,      // yatay ayna
      t: rng(),                     // ton varyasyonu
    });
  }
  return props;
}

/* ============================================================
   MEVSİM & BİYOM ETKİLERİ

   Tema sadece görsel değil, taktiksel bir katman: her mevsim ve
   bitki örtüsü oynanışı hafifçe değiştirir. Oranlar bilinçli olarak
   %15 ile sınırlıdır ki bölümler adil kalsın. Tek istisna Don
   Peykesi'nin süre bonusudur — o saniye cinsinden verilir.
   ============================================================ */

const SEASON_MODS = {
  spring: { label:'İlkbahar dengesi', note:'Belirgin bir etki yok.' },

  summer: { label:'Yaz sıcağı',
            note:'Buz daha çabuk erir, zehir daha hızlı yayılır.',
            iceSlowBonus:-0.5, dmgMul:{poison:1.12} },

  autumn: { label:'Sonbahar hasadı',
            note:'Düşmanlardan %12 daha fazla altın düşer.',
            goldMul:1.12 },

  winter: { label:'Kış donu',
            note:'Don Peykesi +2 sn, düşmanlar %8 yavaş, havan %10 zayıf.',
            iceSlowBonus:+2.0, enemySpeedMul:0.92, dmgMul:{mortar:0.90} },
};

const BIOME_MODS = {
  forest:        { label:'Orman evi', note:'Okçular kendi evinde: +%12 hasar.',
                   dmgMul:{archer:1.12} },

  desert:        { label:'Çöl kavuruculuğu', note:'Don Peykesi −1 sn, düşmanlar %10 hızlı.',
                   iceSlowBonus:-1.0, enemySpeedMul:1.10 },

  mediterranean: { label:'Ilıman iklim', note:'Belirgin bir etki yok.' },

  tundra:        { label:'Donmuş toprak', note:'Don Peykesi +0.5 sn, düşmanlar %6 yavaş.',
                   iceSlowBonus:+0.5, enemySpeedMul:0.94 },

  swamp:         { label:'Bataklık çamuru', note:'Düşmanlar %10 yavaş, zehir +%15 etkili.',
                   enemySpeedMul:0.90, dmgMul:{poison:1.15} },

  savanna:       { label:'Açık savan', note:'Düşmanlar %8 hızlı, menziller +%8.',
                   enemySpeedMul:1.08, rangeMul:1.08 },

  volcanic:      { label:'Volkanik zemin', note:'Havan +%15 hasar, Don Peykesi −0.5 sn.',
                   iceSlowBonus:-0.5, dmgMul:{mortar:1.15} },
};

/* Mevsim ve biyom etkilerini tek bir modifikatör nesnesinde birleştirir. */
function buildMods(theme){
  const s = SEASON_MODS[theme.season] || {};
  const b = BIOME_MODS[theme.biome] || {};

  const dmgMul = {};
  [s.dmgMul, b.dmgMul].forEach(src=>{
    if(!src) return;
    Object.keys(src).forEach(k=>{ dmgMul[k] = (dmgMul[k] || 1) * src[k]; });
  });
  // Güvenlik: hasar/menzil çarpanları %15 sınırını aşmasın
  Object.keys(dmgMul).forEach(k=>{
    dmgMul[k] = Math.max(0.85, Math.min(1.15, dmgMul[k]));
  });

  const enemySpeedMul = Math.max(0.85, Math.min(1.15,
    (s.enemySpeedMul || 1) * (b.enemySpeedMul || 1)));
  const goldMul = Math.max(0.85, Math.min(1.15,
    (s.goldMul || 1) * (b.goldMul || 1)));
  const rangeMul = Math.max(0.85, Math.min(1.15,
    (s.rangeMul || 1) * (b.rangeMul || 1)));

  return {
    iceSlowBonus: (s.iceSlowBonus || 0) + (b.iceSlowBonus || 0),
    enemySpeedMul, goldMul, rangeMul, dmgMul,
    notes: [s.note, b.note].filter(n=>n && n!=='Belirgin bir etki yok.'),
    labels: [s.label, b.label].filter(Boolean),
  };
}

/* ---------- Ana üretici ---------- */
function generateLevel(seed, levelNo){
  const diff = difficultyFor(levelNo);

  /* KURAL 1: toplam yol uzunluğu tavanı aşamaz.
     Aşarsa hücre bütçesi küçültülerek yeniden üretilir. Her deneme
     aynı tohumdan türetilir, yani sonuç yine deterministiktir. */
  const CAP = GEN.H * GEN.MAX_PATH_RATIO;
  const scales = [1, 0.8, 0.65, 0.5, 0.4];
  let routes = null, totalLen = 0;
  for(let i=0;i<scales.length;i++){
    const rngTry = makeRng(hashSeed(seed + '#' + levelNo));
    routes = buildRoutes(rngTry, diff, scales[i]);
    totalLen = routes.paths.reduce((s,p)=>s+polyLen(p), 0);
    if(totalLen <= CAP) break;
  }

  // Yerleşim ve tema için ayrı bir akış (yol denemelerinden etkilenmesin)
  const rng = makeRng(hashSeed(seed + '#' + levelNo + '#rest'));
  const spots = placeSpots(rng, routes.paths, diff, totalLen);
  const theme = pickTheme(rng, levelNo);
  const props = placeProps(rng, routes.paths, spots, theme.biome, theme.season);
  const waves = buildWaves(rng, diff, levelNo);

  // Ekonomi: zorlukla birlikte biraz artan başlangıç kaynakları
  const startGold  = Math.round((150 + diff*120) / 10) * 10;
  const startLives = Math.max(6, Math.round(12 - diff*5));

  return {
    id: 'gen-' + seed + '-' + levelNo,
    generated: true,
    seed, levelNo,
    name: 'Bölüm ' + levelNo,
    difficulty01: diff,
    theme,
    mods: buildMods(theme),
    layout: routes.layout,
    style: routes.style,
    entries: routes.entries,
    exits: routes.exits,
    paths: routes.paths,
    spots,
    props,
    waveCount: waves.waveCount,
    startGold, startLives,
    enemyPool: waves.pool,
    archetype: waves.archetype,
    allowCube: waves.allowCube,
    allowBoss: waves.allowBoss,
    // Klasik bölümlerle uyum için zorluk parametreleri
    difficulty:{
      hpGrowth: 0.12 + diff*0.14,
      speedGrowth: 0.018 + diff*0.016,
      speedCap: 1.35 + diff*0.4,
      countBase: Math.round(5 + diff*5),
      countGrowth: 1.2 + diff*1.1,
    },
  };
}

/* Üretilmiş bölüm için dalga kompozisyonu.
   Klasik generateWave ile aynı sözleşmeyi döndürür. */
function generateWaveForGenerated(level, waveIndex){
  const rng = makeRng(hashSeed(level.seed + '#' + level.levelNo + '#w' + waveIndex));
  const diff = level.difficulty01;
  const p = level.difficulty;
  const last = waveIndex >= level.waveCount;

  // Son dalga: boss izinliyse boss dalgası
  if(last && level.allowBoss){
    return [
      {type:'frostlord', count: diff>0.8 ? 2 : 1, interval:8.0},
      {type:'husk', count: Math.round(6+diff*10), interval:1.2},
      {type:'sprinter', count: Math.round(8+diff*12), interval:0.6},
    ];
  }

  // Küp dalgası: izinliyse ortalarda bir yerde
  const cubeWave = level.allowCube && waveIndex === Math.max(3, Math.round(level.waveCount*0.55));
  if(cubeWave){
    return [
      {type:'cube', count: Math.round(8+diff*14), interval: 3.6},
      {type:'swarm', count: Math.round(12+diff*16), interval:0.5},
    ];
  }

  const mult = 1 + waveIndex*0.16;
  const arch = level.archetype || WAVE_ARCHETYPES[0];
  const count = Math.round((p.countBase + waveIndex*p.countGrowth) * mult * 0.55);
  const groups = [];
  const pool = level.enemyPool;

  // Arketip, hangi türün ağır basacağını ve ritmi belirler
  const baseIntervals = { swarm:0.40, sprinter:0.75, spore:0.75, husk:1.20, brute:1.70 };
  pool.forEach(type=>{
    const share = arch.shares[type] !== undefined ? arch.shares[type] : 0.2;
    const c = Math.max(1, Math.round(count * share));
    const interval = (baseIntervals[type] || 0.8) * arch.pace;
    groups.push({type, count:c, interval:Math.round(interval*100)/100});
  });
  return groups;
}
