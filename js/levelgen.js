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

/* Bir omurga (spine) üretir: yukarıdan aşağı zikzak çizen polyline. */
function buildSpine(rng, startX, rows, opts){
  const {W,H,MARGIN} = GEN;
  const pts = [];
  const usableW = W - MARGIN*2;
  const rowH = (H - MARGIN*1.2) / rows;

  let x = startX;
  pts.push({x, y:-20});                       // ekran dışından giriş
  pts.push({x, y:MARGIN*0.7});

  for(let r=0; r<rows; r++){
    const y = MARGIN*0.7 + rowH*(r+1);
    // Yatay sıçrama: sağ/sol uçlara doğru salın
    const goRight = (r % 2 === 0) ? (opts.flip ? false : true) : (opts.flip ? true : false);
    const target = goRight
      ? MARGIN + usableW * rnd(rng, 0.62, 0.98)
      : MARGIN + usableW * rnd(rng, 0.02, 0.38);
    pts.push({x:target, y:pts[pts.length-1].y});   // yatay kol
    pts.push({x:target, y});                       // dikey iniş
    x = target;
  }
  pts.push({x, y:H+20});                      // ekran dışına çıkış
  return pts;
}

/* Bir polyline'ın uzunluğu */
function polyLen(pts){
  let L=0;
  for(let i=0;i<pts.length-1;i++) L += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y);
  return L;
}

/* İki yolu belirli bir noktadan sonra birleştirir (2 giriş → 1 çıkış). */
function mergeTail(pathA, pathB, mergeFrac){
  const idx = Math.max(2, Math.floor(pathA.length * mergeFrac));
  const tail = pathA.slice(idx);
  // B'nin başını koru, kuyruğunu A'nınkiyle değiştir
  const headB = pathB.slice(0, Math.max(2, Math.floor(pathB.length * mergeFrac)));
  return headB.concat(tail);
}

/* Rota düzenini seçer ve yolları üretir.
   Dönen: { paths:[...], entries:n, exits:n, layoutName } */
function buildRoutes(rng, diff){
  // Zorluk arttıkça çok girişli/çıkışlı düzenlerin olasılığı artar
  const r = rng();
  let layout;
  if(diff < 0.18)      layout = '1-1';
  else if(diff < 0.40) layout = (r < 0.72) ? '1-1' : '2-1';
  else if(diff < 0.65) layout = (r < 0.45) ? '1-1' : (r < 0.78 ? '2-1' : '1-2');
  else                 layout = (r < 0.32) ? '1-1' : (r < 0.58 ? '2-1' : (r < 0.80 ? '1-2' : '2-2'));

  const {W,MARGIN} = GEN;
  const rowsBase = 3 + Math.round(diff*3);            // 3..6 zikzak katı
  const paths = [];

  if(layout === '1-1'){
    const rows = rowsBase + rndInt(rng,0,1);
    paths.push(buildSpine(rng, MARGIN + (W-MARGIN*2)*rnd(rng,0.15,0.85), rows, {flip:rng()<0.5}));
  }
  else if(layout === '2-1'){
    const rows = rowsBase;
    const a = buildSpine(rng, MARGIN + (W-MARGIN*2)*rnd(rng,0.05,0.30), rows, {flip:false});
    const b = buildSpine(rng, MARGIN + (W-MARGIN*2)*rnd(rng,0.70,0.95), rows, {flip:true});
    // İkisi de aynı kuyruğu paylaşsın → tek çıkış
    paths.push(a);
    paths.push(mergeTail(a, b, 0.62));
  }
  else if(layout === '1-2'){
    const rows = rowsBase;
    const a = buildSpine(rng, MARGIN + (W-MARGIN*2)*rnd(rng,0.35,0.65), rows, {flip:false});
    // Ortak baş, ayrışan kuyruk
    const splitIdx = Math.max(3, Math.floor(a.length*0.5));
    const head = a.slice(0, splitIdx);
    const b = buildSpine(rng, head[head.length-1].x, Math.max(2, rows-1), {flip:true});
    paths.push(a);
    paths.push(head.concat(b.slice(2)));
  }
  else { // 2-2
    const rows = Math.max(3, rowsBase-1);
    paths.push(buildSpine(rng, MARGIN + (W-MARGIN*2)*rnd(rng,0.05,0.28), rows, {flip:false}));
    paths.push(buildSpine(rng, MARGIN + (W-MARGIN*2)*rnd(rng,0.72,0.95), rows, {flip:true}));
  }

  // KURAL 1: toplam yol uzunluğu tavanı aşarsa katları azaltarak yeniden üret
  let guard = 0;
  while(paths.reduce((s,p)=>s+polyLen(p),0) > GEN.H*GEN.MAX_PATH_RATIO && guard < 4){
    guard++;
    paths.forEach((p,i)=>{
      // Ara noktaları seyrelt (her üçüncüyü at) — uzunluğu kısaltır
      if(p.length > 8){
        const trimmed = p.filter((_,k)=> k<2 || k>p.length-3 || k%3!==0);
        paths[i] = trimmed;
      }
    });
  }

  const entries = (layout==='2-1'||layout==='2-2') ? 2 : 1;
  const exits   = (layout==='1-2'||layout==='2-2') ? 2 : 1;
  return { paths, entries, exits, layout };
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

/* ---------- Dalga üretimi ---------- */
function buildWaves(rng, diff, levelNo){
  // KURAL 3: ilk bölümler az dalga
  const waveCount = Math.max(4, Math.min(14, Math.round(4 + diff*9 + rnd(rng,-0.5,0.5))));

  // Düşman havuzu zorlukla açılır
  const pool = ['spore','swarm'];
  if(diff > 0.14) pool.push('sprinter');
  if(diff > 0.30) pool.push('husk');
  if(diff > 0.46) pool.push('brute');
  const allowCube = diff > 0.34;
  const allowBoss = diff > 0.55;

  return { waveCount, pool, allowCube, allowBoss };
}

/* ---------- Ana üretici ---------- */
function generateLevel(seed, levelNo){
  const rng = makeRng(hashSeed(seed + '#' + levelNo));
  const diff = difficultyFor(levelNo);

  const routes = buildRoutes(rng, diff);
  const totalLen = routes.paths.reduce((s,p)=>s+polyLen(p), 0);
  const spots = placeSpots(rng, routes.paths, diff, totalLen);
  const theme = pickTheme(rng, levelNo);
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
    layout: routes.layout,
    entries: routes.entries,
    exits: routes.exits,
    paths: routes.paths,
    spots,
    waveCount: waves.waveCount,
    startGold, startLives,
    enemyPool: waves.pool,
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
  const count = Math.round((p.countBase + waveIndex*p.countGrowth) * mult * 0.55);
  const groups = [];
  const pool = level.enemyPool;

  // Ağırlıklı dağıtım: erken tipler daha kalabalık
  const shares = { spore:0.42, swarm:0.34, sprinter:0.28, husk:0.16, brute:0.12 };
  pool.forEach(type=>{
    const c = Math.max(1, Math.round(count * (shares[type]||0.2)));
    const interval = (type==='swarm') ? 0.4 : (type==='brute' ? 1.7 : (type==='husk' ? 1.2 : 0.75));
    groups.push({type, count:c, interval});
  });
  return groups;
}
