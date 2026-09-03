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

/* ============================================================
   BÖLGELER — 1000 bölümün coğrafyası

   Eskiden her bölümün biyomu tamamen tohuma bağlıydı: 347. bölüm çöl,
   348. bataklık, 349. tundra olabiliyordu. Bu, tek tek bölümler için
   sorun değildi ama bir DÜNYA HARİTASI çizilemez hale getiriyordu —
   haritada "çöl bölgesi" diye gösterebileceğin bitişik bir bölüm
   kümesi yoktu.

   Artık 1000 bölüm yedi bölgeye ayrılıyor ve her bölgenin baskın bir
   biyomu var. Bölge içinde tam tekdüzelik de istemiyoruz: bölümlerin
   bir kısmı komşu biyomlardan geliyor (biomeMix), mevsim de bölgenin
   kendi mevsim döngüsü içinde 7 bölümde bir dönüyor. Yani bölge
   tanınır ama sıkıcı değil.

   ÖNEMLİ — bölge sırası zorluk eğrisini DEĞİŞTİRMEZ. Zorluk hâlâ
   yalnızca bölüm numarasına bağlı (difficultyFor). Bölgeler zorluğun
   üstüne binen bir coğrafya katmanı; oyuncuya nerede olduğunu ve ne
   kadar yol aldığını gösterir.
   ============================================================ */
const REGIONS = [
  { id:'vadi',    name:'Yosun Vadisi',   short:'Vadi',
    from:1,   to:120, biome:'forest',        alt:['mediterranean','swamp'],
    seasons:['spring','summer'],            biomeMix:0.72,
    color:'#5f9e52', accent:'#8fd07a', icon:'🌲',
    blurb:'Yolculuğun başladığı yer. Yumuşak toprak, bol ağaç, sakin dalgalar.' },
  { id:'kiyi',    name:'Kavak Kıyısı',   short:'Kıyı',
    from:121, to:260, biome:'mediterranean', alt:['forest','savanna'],
    seasons:['spring','summer','autumn'],   biomeMix:0.70,
    color:'#7d9a45', accent:'#b9d16a', icon:'🫒',
    blurb:'Zeytinlikler ve taşlı patikalar. Yollar burada ilk kez ikiye ayrılıyor.' },
  { id:'savan',   name:'Kuru Savan',     short:'Savan',
    from:261, to:400, biome:'savanna',       alt:['desert','mediterranean'],
    seasons:['summer','autumn'],            biomeMix:0.70,
    color:'#a89a4a', accent:'#ddc86e', icon:'🦁',
    blurb:'Uzun otlar ve uzun yollar. Açık arazi, uzun menzilli kuleyi ödüllendirir.' },
  { id:'col',     name:'Kızıl Çöl',      short:'Çöl',
    from:401, to:540, biome:'desert',        alt:['savanna','volcanic'],
    seasons:['summer','autumn'],            biomeMix:0.74,
    color:'#c08c46', accent:'#e8bc6a', icon:'🏜️',
    blurb:'Gölge yok, sığınak yok. Kuleyi nereye koyduğun burada en çok önemli.' },
  { id:'batak',   name:'Sisli Bataklık', short:'Bataklık',
    from:541, to:680, biome:'swamp',         alt:['forest','tundra'],
    seasons:['autumn','spring'],            biomeMix:0.72,
    color:'#4c6b4a', accent:'#7fae74', icon:'🐊',
    blurb:'Dar geçitler ve puslu görüş. Yavaşlatan kuleler burada altın değerinde.' },
  { id:'tundra',  name:'Buz Tundrası',   short:'Tundra',
    from:681, to:840, biome:'tundra',        alt:['swamp','volcanic'],
    seasons:['winter'],                     biomeMix:0.78,
    color:'#7f97a6', accent:'#cfe6f2', icon:'❄️',
    blurb:'Donmuş düzlükler. Kışın kendi kuralları var; don burada bedava gelmiyor.' },
  { id:'kul',     name:'Kül Dağları',    short:'Kül',
    from:841, to:1000, biome:'volcanic',     alt:['tundra','desert'],
    seasons:['winter','autumn'],            biomeMix:0.80,
    color:'#8a5a52', accent:'#d98a70', icon:'🌋',
    blurb:'Yolculuğun sonu. Kül, lav ve en kalabalık dalgalar.' },
];

/* Bölge başına kaç bölümde bir patron dövüşü. Bölge içi sıraya göre
   sayılır: bir bölgenin 20., 40., 60. bölümü patron bölümüdür. */
const BOSS_EVERY = 20;

function regionOf(levelNo){
  for(let i=0;i<REGIONS.length;i++)
    if(levelNo >= REGIONS[i].from && levelNo <= REGIONS[i].to) return REGIONS[i];
  return REGIONS[REGIONS.length-1];
}
function regionIndexOf(levelNo){
  for(let i=0;i<REGIONS.length;i++)
    if(levelNo >= REGIONS[i].from && levelNo <= REGIONS[i].to) return i;
  return REGIONS.length-1;
}
function regionById(id){ return REGIONS.find(r=>r.id===id) || null; }
function regionLevelCount(r){ return r.to - r.from + 1; }
/* Bölge içi sıra (1 tabanlı) */
function localIndexOf(levelNo){ return levelNo - regionOf(levelNo).from + 1; }
/* Patron bölümü mü? Bölge içi sıra BOSS_EVERY'nin katıysa evet. */
function isBossLevel(levelNo){ return localIndexOf(levelNo) % BOSS_EVERY === 0; }

/* 3 yol tipi — renk ve doku farkı */
const ROAD_TYPES = {
  dirt:   { id:'dirt',   name:'Toprak', edge:'#c9a463', fill:'#dab876', speck:'rgba(120,80,40,0.35)' },
  stone:  { id:'stone',  name:'Taş',    edge:'#8e8b83', fill:'#a9a69c', speck:'rgba(60,58,54,0.35)' },
  asphalt:{ id:'asphalt',name:'Asfalt', edge:'#4a4d52', fill:'#5d6167', speck:'rgba(20,20,22,0.4)' },
};

/* Dünyanın tohumu. 1000 bölümün tamamı bundan üretilir; herkeste
   "Bölüm 347" aynı haritadır. Hem 1000 Bölüm menüsü hem Macera aynı
   sabiti kullanır (ui.js, adventure.js). */
const WORLD_SEED = 'root-relay';

/* ---------- Kural sabitleri ---------- */
const GEN = {
  W: 600, H: 1000,                 // mantıksal saha ölçüsü
  MARGIN: 60,                      // kenar boşluğu
  MAX_PATH_RATIO: 5.2,             // yol uzunluğu / ekran yüksekliği tavanı
  MIN_SPOT_TO_PATH: 60,            // kule–yol asgari mesafesi (kaos önleme) — eskisinden (46) %30 fazla
  MIN_SPOT_TO_SPOT: 74,            // kule–kule asgari mesafesi
  /* YOL UZUNLUĞU BAŞINA NOKTA — sabit: 175 birime 1 kule.
     Bir tur bu aralığı zorlukla açmayı denedik (geç bölümler daha az
     kule alsın diye); ölçüm işe yaradığını gösterdi ama HARİTAYI
     değiştiriyordu. Aynı sonucu haritaya dokunmadan almak için
     denge artık dalga baskısından yapılıyor — bkz. pressureFor(). */
  SPOTS_PER_LEN: 1/175,
  TOTAL_LEVELS: 1000,
  MIN_WAVES: 9,                    // bölüm başına asgari dalga sayısı
  MAX_WAVES: 18,                   // bölüm başına azami dalga sayısı
  LONG_PATH_CHANCE: 0.8,           // bölümlerin bu oranı uzun/karmaşık yol alır
  MAX_SPOTS: 18,                   // kule dikme noktası üst sınırı — hiçbir bölüm bunu aşamaz
  /* Çok rotalı bölümlerde (2 giriş ya da 2 çıkış) oyuncu iki ayrı
     hattı aynı anda tutmak zorunda; 18 nokta ikiye bölününce her
     kola 9 düşüyor ve ikisi de savunulamıyordu. Bu bölümlerde sınır
     biraz yükseliyor — kule TÜRÜ başına satın alma limitleri
     (TOWER_TYPES.maxCount) zaten toplamı 24'te tutuyor. */
  MAX_SPOTS_MULTI: 22,
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

/* Kule noktaları için, yolun kullandığı GRID_COLS×GRID_ROWS ızgarasının
   3 katı sıklıkta bir ALT ızgara (her çizgisi yol ızgarasıyla çakışır,
   aralarına ekstra çizgiler eklenir). Kuleler bu adaylardan seçilerek
   yerleştirilir — sonuç, saf rastgele dağılımdan farklı olarak yolun
   hizasına uyan düzenli sıra/sütunlar halinde durur. */
const SPOT_GRID_COLS = GRID_COLS * 3;
const SPOT_GRID_ROWS = GRID_ROWS * 3;
/* Aday ızgarası — YALNIZCA kule dikilebilir dikdörtgenin içi
   (BUILD_AREA, config.js). Eskiden tüm sahaya yayılıyordu ve şeride
   düşenler bölüm yüklenirken kırpılıyordu; yani üretici, sonradan
   çöpe gidecek noktalar üretip bazı bölümleri savunmasız bırakıyordu
   (en kötüsü 18 noktadan 12'ye düşüyordu). Artık üretici ile
   yükleyici aynı dikdörtgeni biliyor. */
function spotGridCandidates(){
  const cw = GEN.W / SPOT_GRID_COLS, ch = GEN.H / SPOT_GRID_ROWS;
  const pts = [];
  for(let cx=0; cx<SPOT_GRID_COLS; cx++){
    for(let cy=0; cy<SPOT_GRID_ROWS; cy++){
      const x = cw*(cx+0.5), y = ch*(cy+0.5);
      if(!insideBuildArea(x, y)) continue;    // config.js
      pts.push({ x, y });
    }
  }
  return pts;
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

  // Bölümlerin GEN.LONG_PATH_CHANCE kadarı (varsayılan %80) uzun ve
  // karmaşık bir yol hedefler; geri kalanı daha kısa/basit kalıp
  // dalgalanmaya nefes payı bırakır.
  const wantsLongPath = rng() < GEN.LONG_PATH_CHANCE;
  const cellBase    = wantsLongPath ? 14 : 8;
  const cellPerDiff  = wantsLongPath ? 6  : 4;
  const cellMaxBase  = wantsLongPath ? 22 : 13;
  const cellMaxPerDiff = wantsLongPath ? 12 : 9;

  const minCells = Math.max(6, Math.round((cellBase + diff*cellPerDiff) * lenScale));
  const maxCells = Math.max(minCells+2, Math.min(30, Math.round((cellMaxBase + diff*cellMaxPerDiff) * lenScale)));

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

/* ============================================================
   ROTA PAYI — her rotanın kendi kule kotası.

   Eski yerleştirme tek bir havuza bakıyordu: "yolun 165 pikseli
   içindeki herhangi bir yer" uygundu. Çok girişli/çıkışlı bölümlerde
   bu, bir rotanın diğerinin payını yemesine yol açıyordu — ölçümde
   bazı rotaya yalnızca 3 kule noktası düşüyordu, yani o kol pratikte
   savunulamıyordu.

   Kota uzunlukla ölçekleniyor ama TABANI var: kısa bir rota, kısa
   olduğu için kolay geçilecek bir kestirme olmasın diye birim
   uzunluk başına DAHA YOĞUN kule alır.
     1000 px yol -> 6 nokta (170 px'e bir kule)
     2500 px yol -> 12 nokta (208 px'e bir kule)
   ============================================================ */
const SPOT_SERVE_RANGE = 165;   // bu mesafedeki nokta o yolu dövebilir
const SERVE_PER_LEN    = 210;   // uzun rotalarda her bu kadar px'e bir kule
const MIN_SERVE        = 6;     // en kısa rota bile bundan az alamaz
const MAX_SERVE        = 12;

function routeServiceNeed(len){
  return Math.max(MIN_SERVE, Math.min(MAX_SERVE, Math.ceil(len / SERVE_PER_LEN)));
}

/* Bir rotayı kaç nokta dövebiliyor */
function countServing(spots, path){
  let n = 0;
  for(const s of spots) if(distToPath(s.x, s.y, path) < SPOT_SERVE_RANGE) n++;
  return n;
}

/* Bölümün en kötü rotası kotasının ne kadar altında? 0 = sorun yok.
   generateLevel bunu yolu yeniden şekillendirmek için kullanır. */
function routeStarvation(spots, paths){
  let worst = 0;
  for(const p of paths){
    const need = routeServiceNeed(polyLen(p));
    worst = Math.max(worst, need - countServing(spots, p));
  }
  return worst;
}

function placeSpots(rng, paths, diff, totalLen){
  const {MIN_SPOT_TO_PATH,MIN_SPOT_TO_SPOT,MAX_SPOTS} = GEN;

  // KURAL 5: yol uzunluğuna göre asgari nokta sayısı
  const minBySize = Math.ceil(totalLen * GEN.SPOTS_PER_LEN);
  // KURAL 4: zorluğa göre ±1 oynama (taban biraz azaltıldı — çok uzun
  // yollu bölümlerde nokta sayısı fazla kalabalık görünüyordu)
  const wobble = rndInt(rng, -1, 1);
  const rawTarget = Math.max(minBySize, 7 + Math.round(diff*7) + wobble);
  // Üst sınır: kule dikme noktası hiçbir şekilde MAX_SPOTS'u aşamaz.
  // Uzun yollu bölümlerde minBySize tek başına bu sınırı aşabildiğinden
  // hem hedef hem de aşağıdaki gevşetme geri dönüşü buna göre kırpılır.
  const cap = paths.length > 1 ? GEN.MAX_SPOTS_MULTI : MAX_SPOTS;
  const target = Math.min(rawTarget, cap);
  const minTarget = Math.min(minBySize, cap);

  // Kuleler artık serbest rastgele koordinatlarda değil, yolun kullandığı
  // ızgaranın 3 katı sıklıkta bir ALT IZGARA üzerindeki adaylardan seçilir
  // — böylece dağınık değil, yolla aynı hizada düzenli sıra/sütunlar
  // halinde dururlar. Tohumlu Fisher–Yates ile karıştırılıp sırayla
  // denenir (deterministik ama bölüm başına farklı bir sırayla).
  const candidates = spotGridCandidates();
  for(let i=candidates.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [candidates[i],candidates[j]] = [candidates[j],candidates[i]];
  }

  const spots = [];
  function tryAdd(x, y, minPath, maxPath, minGap){
    let dp = Infinity;
    for(const p of paths) dp = Math.min(dp, distToPath(x,y,p));
    if(dp < minPath || dp > maxPath) return false;   // KURAL 7: yola çok yakın/kopuk olamaz
    for(const s of spots){
      if(Math.hypot(s.x-x, s.y-y) < minGap) return false;   // noktalar birbirine binmesin
    }
    spots.push({x:Math.round(x), y:Math.round(y)});
    return true;
  }

  /* FAZ 1 — ROTA PAYI. En kısa rotadan başlanır: o en kırılgan olan,
     ve uzun rota nasılsa geniş bir alandan besleniyor. Adaylar
     karıştırılmış sırada geziliyor (yakınlık sırasına göre değil),
     yoksa noktalar yolun dibine dizilip dağılım bozulurdu. */
  const byLen = paths.map(p=>({ p, len: polyLen(p) })).sort((a,b)=>a.len-b.len);
  const share = Math.max(MIN_SERVE, Math.floor(cap / paths.length) + 1);
  byLen.forEach(r=>{
    const need = Math.min(routeServiceNeed(r.len), share);
    let have = countServing(spots, r.p);
    if(have >= need) return;
    for(const c of candidates){
      if(have >= need || spots.length >= cap) break;
      if(distToPath(c.x, c.y, r.p) >= SPOT_SERVE_RANGE) continue;
      if(tryAdd(c.x, c.y, MIN_SPOT_TO_PATH, SPOT_SERVE_RANGE, MIN_SPOT_TO_SPOT)) have++;
    }
  });

  /* FAZ 2 — genel doldurma: kalan bütçe sahanın tamamına dağılır. */
  candidates.forEach(c=>{
    if(spots.length >= target) return;
    tryAdd(c.x, c.y, MIN_SPOT_TO_PATH, 165, MIN_SPOT_TO_SPOT);
  });

  // Hedefe ulaşılamadıysa (aday ızgarası bu kısıtlarla yetersiz kaldıysa)
  // kısıtı kademeli gevşetip aynı aday listesini tekrar dener.
  // (minTarget zaten MAX_SPOTS'a kırpılı — bu döngü de üst sınırı asla aşamaz)
  /* Gevşetme, aralığı SPOT_GAP_FLOOR'un altına indiremez: iki kule
     görsel olarak üst üste binmesin. Son seviye bir kulenin kaidesi
     ~46 piksel geniş, 60 piksel aralık onları ayrı tutar. Eskiden
     taban 38'e kadar iniyordu ve nadiren de olsa iki kule birbirine
     yapışıyordu. */
  const SPOT_GAP_FLOOR = 60;
  let relax = 0;
  while(spots.length < minTarget && relax < 3){
    relax++;
    const minGap = Math.max(SPOT_GAP_FLOOR, MIN_SPOT_TO_SPOT - relax*12);
    const minPath = MIN_SPOT_TO_PATH - relax*6;
    candidates.forEach(c=>{
      if(spots.length >= minTarget) return;
      tryAdd(c.x, c.y, minPath, 190, minGap);
    });
  }

  return spots;
}

/* ---------- Tema seçimi ---------- */
/* Tema artık bölüm numarasının düştüğü BÖLGEden geliyor (bkz. REGIONS).

   RNG ÇEKİLİŞ SAYISI KORUNDU (3 adet). Bu fonksiyon üretim zincirinin
   ortasında çağrılıyor; bir çekiliş eksik ya da fazla tüketmek
   kendisinden SONRA gelen her şeyi (yol, yapı noktaları, dalgalar)
   kaydırırdı. Değerlerin kullanımı değişti, sayısı değişmedi —
   1000 bölümün geometrisi birebir aynı kaldı. */
function pickTheme(rng, levelNo){
  const roadIds = Object.keys(ROAD_TYPES);
  const r = regionOf(levelNo);

  const seasonOffset = rndInt(rng, 0, 3);   // 1. çekiliş
  const mixRoll      = rng();               // 2. çekiliş
  const road         = pick(rng, roadIds);  // 3. çekiliş

  // Mevsim bölgenin kendi döngüsünde 7 bölümde bir dönüyor
  const season = r.seasons[(Math.floor((levelNo-1)/7) + seasonOffset) % r.seasons.length];

  // Bölümlerin çoğu bölgenin baskın biyomu; gerisi komşu biyomlardan
  // geliyor ki bölge tanınır olsun ama tekdüze olmasın.
  let biome = r.biome;
  if(mixRoll >= r.biomeMix && r.alt.length){
    const k = Math.floor((mixRoll - r.biomeMix) / (1 - r.biomeMix) * r.alt.length);
    biome = r.alt[Math.min(r.alt.length - 1, k)];
  }

  return { season, biome, road };
}

/* ---- Dalga arketipleri ----
   Aynı düşman havuzundan bile farklı "his" üretmek için bölüme bir
   karakter atanır. Sadece sayılar değil, kompozisyonun ağırlık merkezi
   ve ritmi değişir. */
const WAVE_ARCHETYPES = [
  { id:'dengeli',  name:'Dengeli',
    shares:{spore:0.42, swarm:0.34, sprinter:0.28, husk:0.16, brute:0.12, flask:0.10, cocoon:0.08, swarmqueen:0.06, cube:0.14}, pace:1.00 },
  { id:'akin',     name:'Akın',            // çok sayıda küçük, hızlı akış
    shares:{spore:0.30, swarm:0.95, sprinter:0.55, husk:0.05, brute:0.03, flask:0.06, cocoon:0.04, swarmqueen:0.05, cube:0.08}, pace:0.62 },
  { id:'kusatma',  name:'Kuşatma',         // az sayıda ağır, yavaş baskı
    shares:{spore:0.14, swarm:0.08, sprinter:0.10, husk:0.55, brute:0.42, flask:0.16, cocoon:0.10, swarmqueen:0.04, cube:0.18}, pace:1.65 },
  { id:'kosu',     name:'Koşu',            // hız odaklı
    shares:{spore:0.18, swarm:0.30, sprinter:0.95, husk:0.10, brute:0.06, flask:0.06, cocoon:0.04, swarmqueen:0.05, cube:0.08}, pace:0.70 },
  { id:'kalabalik',name:'Kalabalık',       // ekranı dolduran yığın
    shares:{spore:0.85, swarm:0.75, sprinter:0.30, husk:0.14, brute:0.08, flask:0.08, cocoon:0.05, swarmqueen:0.07, cube:0.10}, pace:0.75 },
  { id:'zirhli',   name:'Zırhlı',          // dayanıklılık sınavı
    shares:{spore:0.20, swarm:0.15, sprinter:0.14, husk:0.70, brute:0.22, flask:0.18, cocoon:0.08, swarmqueen:0.04, cube:0.20}, pace:1.35 },
  { id:'dalgali',  name:'Dalgalı',         // gruplar arası belirgin boşluk
    shares:{spore:0.50, swarm:0.45, sprinter:0.35, husk:0.22, brute:0.16, flask:0.12, cocoon:0.10, swarmqueen:0.06, cube:0.14}, pace:1.45 },
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

/* ============================================================
   SAVUNMA KAPASİTESİNE GÖRE DALGA BASKISI (pressureFor)

   Ölçüm (334 bölüm, sabit referans oyuncu, üç ayrı oyuncu gücü):
   bir bölümün zor olup olmadığını belirleyen EN GÜÇLÜ tek etken
   haritanın kaç yapı noktası verdiğiydi.
     10-11 nokta -> %5 sızıntısız geçildi / %67 kaybedildi
     14-15 nokta -> %31 / %40
     18-19 nokta -> %65 / %17
   Yani zorluğu oyuncunun kararları değil, haritanın çekilişi
   belirliyordu: geniş harita = kolay bölüm, dar harita = duvar.

   Haritayı küçültmek bunu düzeltirdi ama yanlış yerden düzeltirdi —
   kule sayısını kısmak strateji alanını da kısıyor. Onun yerine
   DALGA BASKISI haritanın verdiği kapasiteye göre ayarlanıyor:
   çok kule alan bölüme daha kalabalık dalgalar, az kule alan bölüme
   daha seyrek dalgalar gelir. Böylece
     - kolay bölümler kolay olmaktan çıkar,
     - zor bölümler duvar olmaktan çıkar,
     - geriye belirleyici etken olarak KULEYİ NEREYE KOYDUĞUN kalır.

   ÇOK ROTALI BÖLÜMLER: kapasite TOPLAM noktayla değil ROTA BAŞINA
   nokta ile ölçülür. İki hatlı bir bölüm daha çok nokta alır ama
   noktalar iki kola bölünür; bir koldaki kule diğer kolu koruyamaz.
   İlk denemede toplam noktaya düz bir %10 indirim uygulandı ve
   yetmedi: 20-22 noktalı (yani hep çok rotalı) bölümler %61 oranında
   kaybedilir hale geldi. Şimdi 20 noktalı 2 rotalı bir bölüm,
   10'ar noktalı iki kol olarak değerlendiriliyor.

   Kol başına eşik (11) tek rotalı eşikten (15) düşük: çok rotalı
   bölümün kendine has bir cezası var — kule TÜRÜ kotaları (maxCount)
   toplamda sabit olduğu için iki kolu birden donatmak imkânsız,
   ayrıca hasarı tek bir noktada toplayamıyorsun. Ölçümde bu bölümler
   daha çok noktaya rağmen daha sık kaybediliyordu (%43'e karşı %33).
   ============================================================ */

/* EŞİKLER NEDEN TAM SAYI DEĞİL: 1000 bölümün ORTALAMA baskı katsayısı
   tam olarak 1.00 çıksın diye seçildiler (ölçülen değer 0.998). Yani
   bu sistem oyunu topluca zorlaştırmıyor ya da kolaylaştırmıyor —
   baskıyı bölümler ARASINDA yeniden dağıtıyor. Geniş harita kendi
   kolaylığını ödüyor, dar harita rahatlıyor, toplam aynı kalıyor. */
const PRESSURE_PIVOT_SINGLE = 14.4;  // tek rotalı bölümde nötr nokta sayısı
const PRESSURE_PIVOT_LANE   = 10.4;  // çok rotalı bölümde ROTA BAŞINA nötr nokta
const PRESSURE_PER_SPOT     = 0.06;// her fazladan/eksik nokta ±%6 baskı
const PRESSURE_MIN          = 0.75;
const PRESSURE_MAX          = 1.35;

function pressureFor(spotCount, routeCount){
  const multi    = routeCount > 1;
  const capacity = multi ? spotCount / routeCount : spotCount;
  const pivot    = multi ? PRESSURE_PIVOT_LANE : PRESSURE_PIVOT_SINGLE;
  const f = 1 + (capacity - pivot) * PRESSURE_PER_SPOT;
  return Math.max(PRESSURE_MIN, Math.min(PRESSURE_MAX, f));
}

/* ---------- Dalga üretimi ---------- */
function buildWaves(rng, diff, levelNo){
  // Dalga sayısı her zaman GEN.MIN_WAVES–GEN.MAX_WAVES aralığında; zorlukla
  // birlikte bu aralıkta yükselir. İlk bölümlerin kolaylığı artık dalga
  // SAYISI ile değil (KURAL 3), düşman havuzu/sayısı/gücüyle sağlanıyor.
  const waveCount = Math.max(GEN.MIN_WAVES, Math.min(GEN.MAX_WAVES,
    Math.round(GEN.MIN_WAVES + diff*(GEN.MAX_WAVES-GEN.MIN_WAVES) + rnd(rng,-0.5,0.5))));

  // 50. bölümden 1000. bölüme kadar hepsi "zor bölge": havuz
  // karıştırılmadan (bkz. aşağı) tam haliyle kullanılır, dalga
  // yoğunluğu da ayrıca generateWaveForGenerated'te %80 artırılır.
  const isHardZone = levelNo >= 50;

  // Düşman havuzu zorlukla açılır
  const pool = ['spore','swarm'];
  if(diff > 0.14) pool.push('sprinter');
  if(diff > 0.30) pool.push('husk');
  if(diff > 0.38) pool.push('flask');   // destek birimi: iyileştirme birikintisi
  if(diff > 0.46) pool.push('brute');
  if(diff > 0.30) pool.push('cocoon');  // kamikaze — yalnızca son dalgalarda görünür (bkz. isVeryLateWave)
  // KÜP artık kendi başına ayrı bir dalga değil — diğer türlerle
  // karışık gelsin diye normal havuzun bir parçası.
  if(diff > 0.34) pool.push('cube');
  // SÜRÜ ANASI: ilk 8 bölümde kesinlikle yok; sonrasında bölüm başına
  // %35 ihtimalle havuza girer (tohuma bağlı, o yüzden aynı bölüm
  // numarası her zaman aynı sonucu verir — "rastgele ama deterministik").
  if(levelNo > 8 && rng() < 0.35) pool.push('swarmqueen');
  // ZIRHLI: havuza erken girer ama dalga eşiği (ARMOR_FROM_WAVE)
  // sahaya çıkmasını 5. dalgadan öncesine bırakmaz.
  if(diff > 0.18) pool.push('armor');

  // Havuzdan bazen bir tür çıkarılır — aynı havuz her bölümde
  // aynı hissi vermesin diye. (En az 2 tür kalır.) 50-1000 arası "zor
  // bölge"de bu kısıtlama hiç uygulanmaz — hepsi karışsın istendi.
  if(!isHardZone && pool.length >= 4 && rng() < 0.35){
    const dropIdx = rndInt(rng, 1, pool.length-2);   // ilk ve son korunur
    pool.splice(dropIdx, 1);
  }

  const archetype = pickArchetype(rng, diff);
  const allowBoss = diff > 0.55;

  return { waveCount, pool, allowBoss, archetype };
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

/* Boş kalan geniş alanları biyoma uygun EK nesnelerle doldurur.
   placeProps() saf rastgele dağıtım yaptığından bazı geniş alanlar
   şans eseri boş kalabiliyor; bu geçiş özellikle yoldan, kule
   noktalarından ve mevcut nesnelerden uzak — gerçekten "boş" — hücreleri
   tarar. Böyle bir boşluk yoksa hiçbir şey eklemez, yani her bölümde
   tetiklenmek zorunda değildir. */
function fillEmptyAreas(rng, paths, spots, props, biomeId){
  const table = BIOME_PROPS[biomeId] || BIOME_PROPS.forest;
  const cols = 8, rows = 13;
  const cw = GEN.W/cols, ch = GEN.H/rows;
  const extra = [];
  for(let cx=0; cx<cols; cx++){
    for(let cy=0; cy<rows; cy++){
      const x = cw*(cx+0.5), y = ch*(cy+0.5);

      let dPath = Infinity;
      for(const p of paths) dPath = Math.min(dPath, distToPath(x,y,p));
      if(dPath < 75) continue;                 // yola yakınsa "boş alan" sayılmaz

      let near = false;
      for(const s of spots){ if(Math.hypot(s.x-x,s.y-y) < 70){ near=true; break; } }
      if(near) continue;
      for(const q of props){ if(Math.hypot(q.x-x,q.y-y) < 55){ near=true; break; } }
      if(near) continue;
      for(const q of extra){ if(Math.hypot(q.x-x,q.y-y) < 55){ near=true; break; } }
      if(near) continue;

      // Gerçekten boş bir bölge bulundu — her zaman değil, organik
      // görünsün diye %65 ihtimalle bir nesne ekle.
      if(rng() < 0.65){
        extra.push({
          x: Math.round(x), y: Math.round(y),
          type: pickWeighted(rng, table),
          s: 0.75 + rng()*0.6,
          f: rng() < 0.5 ? -1 : 1,
          t: rng(),
        });
      }
    }
  }
  return extra;
}

/* ============================================================
   BÖLÜM TWIST'LERİ

   Mevsim/biyom her bölümde vardır ve dengeli kalsın diye etkileri
   %15 ile sınırlıdır (bkz. buildMods). Twist'ler bunun tersi: NADİR
   ama BELİRGİN — hatta biraz sert — özel durumlar. "Bu bölüm
   farklıydı" hissi versin diye o %15 tavanının tamamen DIŞINDA
   uygulanır (bkz. generateLevel). Aynı anda en fazla bir twist aktif
   olur; havuzda birden fazla twist varsa sırayla denenir, ilk tutan
   kazanır (tohuma bağlı, deterministik).
   ============================================================ */
const LEVEL_TWISTS = [
  {
    id:'rain', name:'Yağmur', chance:0.03,
    label:'🌧️ Yağmur',
    note:'Yağmurda Şimşek Direği %20 daha güçlü çarpar, Don Peykesi\'nin etkisi biraz daha kısa sürer.',
    dmgMul:{ bolt:1.20 },
    iceSlowBonus:-1.1,
    // Zaten kar yağan (kış) bölümlerde yağmur anlamsız; çölde de
    // yağmur olmaz.
    excludeSeasons:['winter'],
    excludeBiomes:['desert'],
  },
];

function pickTwist(rng, theme){
  for(const tw of LEVEL_TWISTS){
    if(tw.excludeSeasons && tw.excludeSeasons.includes(theme.season)) continue;
    if(tw.excludeBiomes && tw.excludeBiomes.includes(theme.biome)) continue;
    if(rng() < tw.chance) return tw;
  }
  return null;
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

  function shapeRoutes(salt){
    let r = null, len = 0;
    for(let i=0;i<scales.length;i++){
      const rngTry = makeRng(hashSeed(seed + '#' + levelNo + salt));
      r = buildRoutes(rngTry, diff, scales[i]);
      len = r.paths.reduce((s,p)=>s+polyLen(p), 0);
      if(len <= CAP) break;
    }
    return { routes:r, totalLen:len };
  }

  /* KURAL 8: HER ROTA SAVUNULABİLİR OLMALI.
     Bazı yol şekilleri, kuleyi koyacak yer bırakmıyor: kol kenara
     yapışıyor, ya da iki rota birbirine öyle yakın geçiyor ki
     aralarına nokta sığmıyor. Sonuç, oyuncunun döveMEDİĞİ bir
     kestirme — bir bölümü haksız yere kaybettiren şey bu.

     placeSpots artık her rotaya kendi kotasını ayırıyor
     (bkz. routeServiceNeed); yine de kota dolmuyorsa sorun kule
     yerleştirmede değil YOLUN ŞEKLİNDE demektir. O yüzden yol
     yeniden üretiliyor: her deneme aynı tohumdan ama farklı bir
     tuzdan türetildiği için sonuç hâlâ deterministik, sadece o
     bölüm başka bir şekil alıyor.

     En iyi deneme saklanıyor: hiçbiri kusursuz değilse en az aç
     kalan şekil kullanılır — yani kural asla bölümü bozamaz,
     yalnızca iyileştirir. */
  const SHAPE_SALTS = ['', '#s2', '#s3', '#s4', '#s5', '#s6'];
  let best = null, bestScore = Infinity;

  for(const salt of SHAPE_SALTS){
    const attempt = shapeRoutes(salt);
    /* Deneme yerleştirmesi TEK KULLANIMLIK bir akışla yapılır; asıl
       akış (rng) aşağıda, yalnızca kazanan şekil için bir kez
       tüketilir. Böylece yeniden şekillendirme gerekmeyen bölümlerde
       rastgele dizisi eskisiyle birebir aynı kalır — tema, dekor ve
       dalga kompozisyonu kaymaz. */
    const probe = makeRng(hashSeed(seed + '#' + levelNo + '#rest'));
    const sp = placeSpots(probe, attempt.routes.paths, diff, attempt.totalLen);
    const starve = routeStarvation(sp, attempt.routes.paths);
    if(starve < bestScore){ bestScore = starve; best = attempt; }
    if(starve === 0) break;
  }
  const routes = best.routes, totalLen = best.totalLen;

  // Yerleşim ve tema için ayrı bir akış (yol denemelerinden etkilenmesin)
  const rng = makeRng(hashSeed(seed + '#' + levelNo + '#rest'));
  const spots = placeSpots(rng, routes.paths, diff, totalLen);
  const theme = pickTheme(rng, levelNo);
  const baseProps = placeProps(rng, routes.paths, spots, theme.biome, theme.season);
  const props = baseProps.concat(fillEmptyAreas(rng, routes.paths, spots, baseProps, theme.biome));
  const waves = buildWaves(rng, diff, levelNo);

  // Twist: mevsim/biyom %15 tavanının DIŞINDA uygulanır — bkz. LEVEL_TWISTS.
  const mods = buildMods(theme);
  const twist = pickTwist(rng, theme);
  if(twist){
    Object.keys(twist.dmgMul || {}).forEach(k=>{
      mods.dmgMul[k] = (mods.dmgMul[k] || 1) * twist.dmgMul[k];
    });
    mods.iceSlowBonus += (twist.iceSlowBonus || 0);
    mods.labels = mods.labels.concat(twist.label);
    mods.notes = mods.notes.concat(twist.note);
  }

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
    mods,
    twist: twist ? twist.id : null,
    layout: routes.layout,
    style: routes.style,
    entries: routes.entries,
    exits: routes.exits,
    paths: routes.paths,
    spots,
    props,
    waveCount: waves.waveCount,
    startGold, startLives,
    /* Haritanın verdiği kule kapasitesine göre dalga baskısı.
       generateWaveForGenerated bunu düşman sayısıyla çarpar. */
    pressure: pressureFor(spots.length, routes.paths.length),
    enemyPool: waves.pool,
    archetype: waves.archetype,
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

  // Son dalga: boss izinliyse boss dalgası. Boss SAYISI sabit kalır
  // (o dalganın kimliği), yanındaki destek birimleri baskıyla ölçeklenir.
  if(last && level.allowBoss){
    const bp = 1 + ((level.pressure || 1) - 1) * 0.5;
    return [
      // BOSS_COUNT/BOSS_INTERVAL (config.js): beş Don Efendisi, aralıklı
      {type:'frostlord', count: BOSS_COUNT, interval: BOSS_INTERVAL},
      {type:'flask', count: Math.max(1, Math.round((3+diff*4)*bp)), interval:2.2},
      {type:'husk', count: Math.max(1, Math.round((6+diff*10)*bp)), interval:1.2},
      {type:'sprinter', count: Math.max(1, Math.round((8+diff*12)*bp)), interval:0.6},
    ];
  }

  // lateWaveBoost (config.js): 8. dalgadan sonra her dalga giderek
  // daha kalabalık olsun diye ek doğrusal çarpan (9. dalga +%10, ...)
  const mult = (1 + waveIndex*0.16) * lateWaveBoost(waveIndex);
  const arch = level.archetype || WAVE_ARCHETYPES[0];
  // 50. bölümden 1000. bölüme kadar "zor bölge": dalga başına düşman
  // yoğunluğu %80 artırılır (bkz. buildWaves'teki havuz-karıştırma
  // kısıtının da bu bölümlerde devre dışı bırakılması).
  const isHardZone = level.levelNo >= 50;
  const hardZoneMult = isHardZone ? 1.80 : 1;
  // EXTRA_DENSITY_BOOST (config.js): genel +%30 yoğunluk artışı — klasik
  // bölümlerdeki waveCountMultiplier ile aynı çarpanı kullanır.
  /* BASKI KATSAYISI (bkz. pressureFor): geniş haritada daha kalabalık,
     dar haritada daha seyrek dalga. SAYIYA yarım oranda yansır —
     tam oranı can çarpanı taşıyor (bkz. statMultipliers, config.js),
     çünkü düşman sayısı aynı zamanda oyuncunun gelirini de belirliyor. */
  const pressure = level.pressure || 1;
  const countPressure = 1 + (pressure - 1) * 0.5;
  const count = Math.round((p.countBase + waveIndex*p.countGrowth) * mult * 0.55 * hardZoneMult * EXTRA_DENSITY_BOOST * countPressure);
  const groups = [];
  const pool = level.enemyPool;

  // Arketip, hangi türün ağır basacağını ve ritmi belirler. KÜP artık
  // ayrı bir dalga değil — diğer türlerle birlikte normal havuzdan gelir.
  const baseIntervals = { swarm:0.40, sprinter:0.75, spore:0.75, husk:1.20, brute:1.70, flask:1.50, cocoon:2.2, swarmqueen:1.8, cube:3.2, armor:1.60 };
  // ZIRHLI arketip paylarına girmiyor: her dalgada birkaç tane olsun
  // istiyoruz, arketipe göre dalgayı domine etmesin.
  const ARMOR_SHARE = 0.10;
  // ŞİŞE yalnızca son 3 dalgada görünür — her dalgada çıkması hem
  // tekrara düşürüyor hem de erken dalgaları gereksiz zorlaştırıyordu.
  const isLateWave = waveIndex > level.waveCount - 3;
  // KIVILCIM KOZASI yalnızca son 5 dalgada görünür — kamikaze etkisi
  // (ölünce kuleleri kör etmesi) erken dalgalarda orantısız sert olurdu.
  const isVeryLateWave = waveIndex > level.waveCount - 5;
  // KÜP ilk 7 dalgada hiç çıkmaz — bölünerek çoğalan kaotik hasarı
  // oyunun en erken anlarında orantısız sert olurdu.
  const isVeryEarlyWave = waveIndex <= 7;
  pool.forEach(type=>{
    if(type === 'flask' && !isLateWave) return;
    if(type === 'cocoon' && !isVeryLateWave) return;
    if(type === 'cube' && isVeryEarlyWave) return;
    // ZIRHLI (config.js ARMOR_FROM_WAVE): 5. dalgadan önce çıkmaz
    if(type === 'armor' && waveIndex < ARMOR_FROM_WAVE) return;
    const share = type === 'armor' ? ARMOR_SHARE
                : (arch.shares[type] !== undefined ? arch.shares[type] : 0.2);
    const c = Math.max(1, Math.round(count * share));
    const interval = (baseIntervals[type] || 0.8) * arch.pace;
    groups.push({type, count:c, interval:Math.round(interval*100)/100});
  });
  return groups;
}
