/* ============================================================
   DÜNYA HARİTASI — izometrik ada haritası

   Yedi bölge (bkz. REGIONS, levelgen.js) yedi ada olarak çiziliyor.
   Ada aşağıdan yukarıya doğru bir yolculuk oluşturuyor: Yosun Vadisi
   en altta, Kül Dağları en üstte. Deniz üzerindeki kesikli rota
   adaları sırayla bağlıyor.

   NEDEN CANVAS, NEDEN PİŞİRİLİYOR
   Ada başına ~150 izometrik karo, üstüne ağaç/kaya/kaktüs süsleri —
   toplamda binlerce çizim çağrısı. Bunları her karede tekrarlamak
   telefonda ısıtırdı. Harita bir kez OFFSCREEN bir yüzeye pişiriliyor
   (bakeWorld); her kare yalnızca o hazır resmi bir kez basıyor,
   üstüne de sadece hareketli olanları çiziyor: bölge tabelaları,
   nabız atan "şu an buradasın" işareti ve kaydırma. Oyun sahnesinde
   kullandığımız yöntemin (ensureScene, engine-canvas.js) aynısı.

   Harita mantıksal ölçüde (WORLD_W x WORLD_H) çiziliyor, ekrana
   genişliğe göre ölçekleniyor ve dikeyde parmakla kaydırılıyor.
   ============================================================ */

const WORLD_W = 1000;
const WORLD_H = 2760;

/* İzometrik karo ölçüsü. Genişlik/yükseklik oranı 2:1 — klasik
   izometrik görünüm. Karolar bilerek KÜÇÜK: ada ızgarası ne kadar
   ince olursa kıyı çizgisi o kadar organik çıkıyor. İlk denemede
   11x9'luk kaba bir ızgara vardı ve adalar dikdörtgen bloklara
   benziyordu. ISO_STEP bir yükseklik kademesinin kaç piksel
   yukarı ittiği. */
const ISO_W = 34, ISO_H = 17, ISO_STEP = 10;

/* Yükseklik kademe sayısı. Tam sayı kademe kullanmak kasıtlı:
   izometrik arazi, yumuşak bir eğimden çok TERASLI göründüğünde
   okunuyor — her kademe kendi gölgesini üretiyor. */
const ISO_TIERS = 4;

/* Adaların haritadaki yerleşimi. Yılan gibi hafifçe sağa-sola
   kayıyorlar ki göz aşağıdan yukarı bir yol takip etsin; ama
   adalar büyük olduğu için sapma küçük tutuldu. */
const ISLANDS = {
  vadi:   { x:430, y:2520, rw:18, rh:14, scale:1.00 },
  kiyi:   { x:575, y:2140, rw:18, rh:14, scale:0.98 },
  savan:  { x:420, y:1770, rw:19, rh:15, scale:1.00 },
  col:    { x:585, y:1390, rw:19, rh:15, scale:1.02 },
  batak:  { x:420, y:1010, rw:18, rh:14, scale:1.00 },
  tundra: { x:580, y:640,  rw:19, rh:15, scale:1.00 },
  kul:    { x:480, y:265,  rw:20, rh:16, scale:1.04 },
};

/* ---- yardımcılar ---------------------------------------------- */

function isoX(cx, cy){ return (cx - cy) * ISO_W * 0.5; }
function isoY(cx, cy){ return (cx + cy) * ISO_H * 0.5; }

/* Bir rengi koyulaştırır/açar. Karo yan yüzleri üst yüzden koyu olsun
   diye; ışık hep sol üstten geliyormuş gibi duruyor.

   HEM hex HEM rgb() kabul etmesi şart: bu fonksiyonun ÇIKTISI rgb()
   ve zincirleme çağrılıyor (önce kademe rengi üretiliyor, sonra o
   rengin yan yüzü). Yalnızca hex ayrıştıran ilk sürüm ikinci çağrıda
   NaN üretiyor, canvas geçersiz rengi yok sayıp bir önceki fillStyle
   ile boyuyordu — haritada yer yer siyah uçurumlar çıkıyordu. */
function shade(col, k){
  let r, g, b;
  if(col[0] === '#'){
    let h = col.slice(1);
    if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h, 16);
    r = (n>>16)&255; g = (n>>8)&255; b = n&255;
  } else {
    const m = col.match(/-?\d+(\.\d+)?/g);
    if(!m || m.length < 3) return col;
    r = +m[0]; g = +m[1]; b = +m[2];
  }
  if(k >= 0){ r += (255-r)*k; g += (255-g)*k; b += (255-b)*k; }
  else { r *= (1+k); g *= (1+k); b *= (1+k); }
  const cl = (v)=> Math.max(0, Math.min(255, v|0));
  return 'rgb(' + cl(r) + ',' + cl(g) + ',' + cl(b) + ')';
}

/* Yumuşak değer gürültüsü. Kaba bir kafes üzerinde rastgele değerler
   üretip aralarını yumuşatarak okuyor — böylece yükseklik alanı
   karodan karoya zıplamıyor, tepeler ve vadiler oluşuyor. */
function valueNoise(seedStr, lattice){
  const rng = makeRng(hashSeed(seedStr));
  const L = lattice;
  const lat = [];
  for(let j=0;j<=L;j++){ const row = []; for(let i=0;i<=L;i++) row.push(rng()); lat.push(row); }
  return function(u, v){
    const fx = Math.max(0, Math.min(1, u)) * L, fy = Math.max(0, Math.min(1, v)) * L;
    const i = Math.min(L-1, Math.floor(fx)), j = Math.min(L-1, Math.floor(fy));
    const tx = fx - i, ty = fy - j;
    const sx = tx*tx*(3-2*tx), sy = ty*ty*(3-2*ty);
    const a = lat[j][i]   + (lat[j][i+1]   - lat[j][i])   * sx;
    const b = lat[j+1][i] + (lat[j+1][i+1] - lat[j+1][i]) * sx;
    return a + (b-a) * sy;
  };
}

/* Ada gövdesi: merkezden uzaklığı açıya göre dalgalanan bir maske.
   Düz elips yerine harmonik toplamı kullanılıyor ki kıyı çizgisi
   organik olsun — deterministik, bölge kimliğinden türeyen tohumla. */
function islandMask(region, cfg){
  const rng = makeRng(hashSeed('island#' + region.id));
  const harm = [];
  for(let i=0;i<4;i++) harm.push({ k: 2+i, a: rnd(rng, 0.05, 0.15), p: rng()*Math.PI*2 });
  const hNoise = valueNoise('height#' + region.id, 4);

  const cx0 = (cfg.rw-1)/2, cy0 = (cfg.rh-1)/2;
  const cells = [];
  for(let cy=0; cy<cfg.rh; cy++){
    for(let cx=0; cx<cfg.rw; cx++){
      const dx = (cx-cx0)/(cfg.rw*0.5), dy = (cy-cy0)/(cfg.rh*0.5);
      const d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      let rad = 0.90;
      for(const h of harm) rad += Math.sin(ang*h.k + h.p) * h.a;
      if(d > rad) continue;
      cells.push({ cx, cy, t: d/rad, u: cx/(cfg.rw-1), v: cy/(cfg.rh-1) });
    }
  }

  /* YÜKSEKLİK
     - kubbe: merkeze yakın olan yüksek (adanın omurgası)
     - gürültü: kubbeyi bozup tepe/vadi üretir
     - volkanik bölgede ortaya ayrı bir KONİ biniyor; tundra düzdür.
     Bölgeler siluetlerinden de ayırt edilebilsin istiyoruz. */
  const isVolcano = region.id === 'kul';
  const flat = region.id === 'tundra' ? 0.45 : 1;
  for(const c of cells){
    const dome = Math.cos(Math.min(1, c.t) * Math.PI * 0.5);      // 1 merkez, 0 kıyı
    let h = (dome * 0.72 + hNoise(c.u, c.v) * 0.5) * flat;
    if(isVolcano){
      const cone = Math.max(0, 1 - c.t / 0.42);
      h += cone * cone * 1.15;
    }
    // Kıyıya doğru sıfıra in: ada denizden dik bir duvar gibi çıkmasın
    h *= Math.min(1, (1 - c.t) / 0.22);
    c.h = Math.max(0, Math.min(ISO_TIERS, Math.round(h * ISO_TIERS)));
    c.shore = c.t > 0.80;                      // kum şeridi — dar tutuldu
    c.crater = isVolcano && c.t < 0.10;
  }
  return cells;
}

/* Adanın deniz üzerindeki gölgesi ve kıyı parlaması. Bu iki katman
   olmadan adalar suyun üstünde YÜZÜYORMUŞ gibi duruyor. */
function drawIslandShore(ctx, cells, ox, oy, S){
  const hw = ISO_W*0.5*S, hh = ISO_H*0.5*S;
  // sığ su halkası
  ctx.fillStyle = 'rgba(150, 225, 235, 0.20)';
  for(const c of cells){
    if(!c.shore) continue;
    const px = ox + isoX(c.cx, c.cy) * S;
    const py = oy + isoY(c.cx, c.cy) * S;
    ctx.beginPath();
    ctx.moveTo(px, py-hh*2.1); ctx.lineTo(px+hw*2.1, py);
    ctx.lineTo(px, py+hh*2.1); ctx.lineTo(px-hw*2.1, py);
    ctx.closePath(); ctx.fill();
  }
  // gölge
  ctx.fillStyle = 'rgba(0, 20, 30, 0.22)';
  for(const c of cells){
    const px = ox + isoX(c.cx, c.cy) * S + 10*S;
    const py = oy + isoY(c.cx, c.cy) * S + 16*S;
    ctx.beginPath();
    ctx.moveTo(px, py-hh); ctx.lineTo(px+hw, py);
    ctx.lineTo(px, py+hh); ctx.lineTo(px-hw, py);
    ctx.closePath(); ctx.fill();
  }
}

/* ---- süsler ---------------------------------------------------- */

function drawTree(ctx, x, y, s, dark, light){
  ctx.fillStyle = '#5a4326';
  ctx.fillRect(x-1*s, y-4*s, 2*s, 5*s);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x, y-16*s); ctx.lineTo(x+6*s, y-4*s); ctx.lineTo(x-6*s, y-4*s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x, y-16*s); ctx.lineTo(x+2.5*s, y-4*s); ctx.lineTo(x-6*s, y-4*s);
  ctx.closePath(); ctx.fill();
}
function drawBush(ctx, x, y, s, dark, light){
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(x, y-3*s, 6*s, 4.4*s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.ellipse(x-1.6*s, y-4.4*s, 3.4*s, 2.6*s, 0, 0, 7); ctx.fill();
}
function drawGrass(ctx, x, y, s, dark, light){
  ctx.strokeStyle = dark; ctx.lineWidth = 1.4*s; ctx.lineCap = 'round';
  for(let i=-1;i<=1;i++){
    ctx.beginPath();
    ctx.moveTo(x + i*2.6*s, y);
    ctx.quadraticCurveTo(x + i*3.6*s, y-4*s, x + i*1.6*s + 1.4*s, y-7.5*s);
    ctx.stroke();
  }
  ctx.strokeStyle = light; ctx.lineWidth = 1*s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x-1.4*s, y-4.6*s, x-2.6*s, y-8*s); ctx.stroke();
}
function drawCactus(ctx, x, y, s, dark, light){
  ctx.strokeStyle = dark; ctx.lineWidth = 3.4*s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y-12*s); ctx.stroke();
  ctx.lineWidth = 2.4*s;
  ctx.beginPath(); ctx.moveTo(x, y-7*s); ctx.lineTo(x-4.4*s, y-7*s); ctx.lineTo(x-4.4*s, y-10.5*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y-9.5*s); ctx.lineTo(x+3.8*s, y-9.5*s); ctx.lineTo(x+3.8*s, y-12.5*s); ctx.stroke();
  ctx.strokeStyle = light; ctx.lineWidth = 1.1*s;
  ctx.beginPath(); ctx.moveTo(x-0.8*s, y-1.5*s); ctx.lineTo(x-0.8*s, y-11*s); ctx.stroke();
}
function drawReed(ctx, x, y, s, dark, light){
  ctx.strokeStyle = dark; ctx.lineWidth = 1.3*s; ctx.lineCap = 'round';
  for(let i=-1;i<=1;i++){
    ctx.beginPath(); ctx.moveTo(x+i*2.4*s, y); ctx.lineTo(x+i*3.2*s, y-9*s); ctx.stroke();
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.ellipse(x+i*3.2*s, y-10.5*s, 1.2*s, 2.4*s, 0, 0, 7); ctx.fill();
  }
}
function drawIce(ctx, x, y, s, dark, light){
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x, y-13*s); ctx.lineTo(x+4.4*s, y-1*s); ctx.lineTo(x-4.4*s, y-1*s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x, y-13*s); ctx.lineTo(x+4.4*s, y-1*s); ctx.lineTo(x+0.8*s, y-1*s);
  ctx.closePath(); ctx.fill();
}
function drawRock(ctx, x, y, s, dark, light){
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x-5*s, y); ctx.lineTo(x-3*s, y-6*s); ctx.lineTo(x+1*s, y-7.5*s);
  ctx.lineTo(x+5*s, y-3.5*s); ctx.lineTo(x+3.5*s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x-3*s, y-6*s); ctx.lineTo(x+1*s, y-7.5*s); ctx.lineTo(x-0.5*s, y-3.6*s);
  ctx.closePath(); ctx.fill();
}
/* Her bölgenin süs repertuvarı — bölge biyomundan türüyor. */
const ISLE_DECOR = {
  forest:        [drawTree, drawTree, drawBush],
  mediterranean: [drawBush, drawTree, drawRock],
  savanna:       [drawGrass, drawGrass, drawTree],
  desert:        [drawCactus, drawRock, drawRock],
  swamp:         [drawReed, drawReed, drawBush],
  tundra:        [drawIce, drawRock, drawIce],
  volcanic:      [drawRock, drawRock, drawIce],
};

/* ---- ada ------------------------------------------------------- */

/* Bölgeye özel yüzey renkleri. Tundra'nın üstü kar, altı buzul mavisi;
   volkanik adanın tepesi kızıl kaya. Sadece tonu değil MALZEMEYİ
   değiştiriyoruz — bölge uzaktan tanınsın diye. */
/* Haritadaki YÜZEY rengi, bölgenin arayüz renginden ayrı olabilir.
   Tundra'nın kimlik rengi mavi-gri (tabela ve patika onu kullanıyor)
   ama adanın yüzeyi kar olmalı; gri bir ada beton gibi duruyordu. */
const ISLE_SURFACE = { tundra:'#e3eef7' };

function islandPalette(region, dim){
  const base = ISLE_SURFACE[region.id] || region.color;
  const top  = dim ? shade(base, -0.55) : base;
  const acc  = dim ? shade(region.accent,-0.55) : region.accent;
  let sand   = dim ? '#6a6f78' : '#e6d29a';
  let snowy  = false;
  if(region.id === 'tundra'){ sand = dim ? '#7d848a' : '#eaf4fa'; snowy = true; }
  if(region.id === 'kul' && !dim) sand = '#7a6a63';
  return {
    top, acc, snowy, sand,
    // Yüksek kademeler açılır: tepe ışık alır, dip gölgede kalır
    tier: (h) => shade(top, snowy ? 0.06*h : 0.045*h - 0.06),
    sideL: (c) => shade(c, -0.26),
    sideR: (c) => shade(c, -0.44),
    sandS: shade(sand, -0.30),
  };
}

function drawIsland(ctx, region, cfg, dim){
  const cells = islandMask(region, cfg);
  // Arkadan öne: (cx+cy) küçük olan önce çizilir (ressam algoritması)
  cells.sort((a,b)=> (a.cx+a.cy) - (b.cx+b.cy));

  const S  = cfg.scale;
  const ox = cfg.x - isoX((cfg.rw-1)/2, (cfg.rh-1)/2) * S;
  const oy = cfg.y - isoY((cfg.rw-1)/2, (cfg.rh-1)/2) * S;
  const P  = islandPalette(region, dim);

  drawIslandShore(ctx, cells, ox, oy, S);

  const hw = ISO_W*0.5*S, hh = ISO_H*0.5*S, step = ISO_STEP*S;
  const BASE = 22*S;   // adanın deniz altına inen kalınlığı

  for(const c of cells){
    const px = ox + isoX(c.cx, c.cy) * S;
    const py = oy + isoY(c.cx, c.cy) * S - c.h*step;

    let faceTop;
    if(c.crater)      faceTop = dim ? '#4a3b38' : '#3a1b12';
    else if(c.shore)  faceTop = P.sand;
    else              faceTop = P.tier(c.h);
    const faceL = c.shore ? P.sandS : P.sideL(faceTop);
    const faceR = c.shore ? shade(P.sand,-0.46) : P.sideR(faceTop);
    const depth = c.h*step + BASE;

    // sol yan yüz
    ctx.fillStyle = faceL;
    ctx.beginPath();
    ctx.moveTo(px-hw, py); ctx.lineTo(px, py+hh);
    ctx.lineTo(px, py+hh+depth); ctx.lineTo(px-hw, py+depth);
    ctx.closePath(); ctx.fill();
    // sağ yan yüz
    ctx.fillStyle = faceR;
    ctx.beginPath();
    ctx.moveTo(px+hw, py); ctx.lineTo(px, py+hh);
    ctx.lineTo(px, py+hh+depth); ctx.lineTo(px+hw, py+depth);
    ctx.closePath(); ctx.fill();
    // üst yüz
    ctx.fillStyle = faceTop;
    ctx.beginPath();
    ctx.moveTo(px, py-hh); ctx.lineTo(px+hw, py);
    ctx.lineTo(px, py+hh); ctx.lineTo(px-hw, py);
    ctx.closePath(); ctx.fill();

    /* Kraterden çıkan lav: volkanik adanın tepesi karanlık bir çukur
       değil, içi yanan bir ağız olsun. */
    if(c.crater && !dim){
      ctx.fillStyle = 'rgba(255,120,40,0.85)';
      ctx.beginPath();
      ctx.moveTo(px, py-hh*0.55); ctx.lineTo(px+hw*0.55, py);
      ctx.lineTo(px, py+hh*0.55); ctx.lineTo(px-hw*0.55, py);
      ctx.closePath(); ctx.fill();
    }

    // süs: kıyıya ve kratere konmaz, her karoya da konmaz
    if(!c.shore && !c.crater){
      const r = makeRng(hashSeed('dec#' + region.id + '#' + c.cx + '#' + c.cy));
      if(r() < 0.46){
        const kit = ISLE_DECOR[region.biome] || ISLE_DECOR.forest;
        const fn = kit[Math.floor(r()*kit.length)];
        const jx = (r()-0.5) * hw * 0.8, jy = (r()-0.5) * hh * 0.6;
        fn(ctx, px+jx, py+jy, S * (1.15 + r()*0.5),
           dim ? shade(region.color,-0.62) : shade(region.color,-0.36),
           dim ? shade(region.accent,-0.5) : P.acc);
      }
    }
  }

  /* Volkanik adanın tepesinden duman. Bölgeyi siluetinden tanımak,
     etiketi okumaktan hızlıdır. */
  if(region.id === 'kul' && !dim){
    const top = cells.reduce((a,c)=> c.h > a.h ? c : a, cells[0]);
    const px = ox + isoX(top.cx, top.cy) * S;
    const py = oy + isoY(top.cx, top.cy) * S - top.h*step;
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    for(let i=0;i<4;i++){
      ctx.beginPath();
      ctx.ellipse(px + i*9*S - 10*S, py - 22*S - i*20*S, (15+i*6)*S, (10+i*4)*S, 0, 0, 7);
      ctx.fill();
    }
  }
}

/* ---- deniz ----------------------------------------------------- */

function drawSea(ctx){
  const grd = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grd.addColorStop(0,    '#2a4a58');
  grd.addColorStop(0.45, '#2f5b6a');
  grd.addColorStop(1,    '#376b78');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Dalga çizgileri: seyrek, düşük kontrast — arka plan olarak kalsın
  const rng = makeRng(hashSeed('sea'));
  ctx.strokeStyle = 'rgba(255,255,255,0.075)';
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  for(let i=0;i<260;i++){
    const x = rng()*WORLD_W, y = rng()*WORLD_H, w = 10 + rng()*20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x+w*0.5, y-3, x+w, y);
    ctx.stroke();
  }
}

/* Denizdeki küçük sahne öğeleri. Boş su büyük bir alan kaplıyor ve
   çıplak bırakıldığında harita "yolculuk" değil "yüzen bloklar" gibi
   duruyor. Yerleşim deterministik ve adalardan uzak tutuluyor. */
function drawSeaProps(ctx){
  const rng = makeRng(hashSeed('seaprops'));
  const spots = [];
  const isles = REGIONS.map(r=>ISLANDS[r.id]).filter(Boolean);
  // Adalara ve birbirlerine yakın olmayan noktalar seç
  let guard = 0;
  while(spots.length < 26 && guard++ < 4000){
    const x = 60 + rng()*(WORLD_W-120);
    const y = 60 + rng()*(WORLD_H-120);
    let ok = true;
    for(const c of isles){
      const rx = (c.rw+c.rh) * ISO_W * 0.30 * c.scale;
      const ry = (c.rw+c.rh) * ISO_H * 0.34 * c.scale + 60;
      if(Math.abs(x-c.x) < rx && Math.abs(y-c.y) < ry){ ok = false; break; }
    }
    if(ok) for(const p of spots) if(Math.hypot(p.x-x, p.y-y) < 190){ ok = false; break; }
    if(ok) spots.push({ x, y, k: rng(), s: 0.85 + rng()*0.5 });
  }
  for(const p of spots){
    if(p.k < 0.30)      seaBoat(ctx, p.x, p.y, p.s);
    else if(p.k < 0.62) seaFish(ctx, p.x, p.y, p.s);
    else if(p.k < 0.80) seaWaves(ctx, p.x, p.y, p.s);
    else                seaRock(ctx, p.x, p.y, p.s);
  }
}
function seaBoat(ctx, x, y, s){
  ctx.fillStyle = 'rgba(0,20,30,0.22)';
  ctx.beginPath(); ctx.ellipse(x, y+5*s, 15*s, 4*s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6b4526';                       // gövde
  ctx.beginPath();
  ctx.moveTo(x-13*s, y-1*s); ctx.lineTo(x+13*s, y-1*s);
  ctx.lineTo(x+8*s, y+5*s);  ctx.lineTo(x-8*s, y+5*s);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.6*s;  // direk
  ctx.beginPath(); ctx.moveTo(x, y-2*s); ctx.lineTo(x, y-20*s); ctx.stroke();
  ctx.fillStyle = '#e2504a';                       // yelken
  ctx.beginPath();
  ctx.moveTo(x+1.5*s, y-19*s); ctx.lineTo(x+11*s, y-4*s); ctx.lineTo(x+1.5*s, y-4*s);
  ctx.closePath(); ctx.fill();
}
function seaFish(ctx, x, y, s){
  ctx.strokeStyle = 'rgba(220,240,245,0.42)';
  ctx.lineWidth = 1.7*s; ctx.lineCap = 'round';
  for(let i=0;i<3;i++){
    const fx = x + (i-1)*13*s, fy = y + (i%2 ? 7*s : 0);
    ctx.beginPath();
    ctx.moveTo(fx-5*s, fy); ctx.quadraticCurveTo(fx, fy-3.4*s, fx+5*s, fy);
    ctx.quadraticCurveTo(fx, fy+3.4*s, fx-5*s, fy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx-5*s, fy); ctx.lineTo(fx-8.5*s, fy-3*s);
    ctx.moveTo(fx-5*s, fy); ctx.lineTo(fx-8.5*s, fy+3*s);
    ctx.stroke();
  }
}
function seaWaves(ctx, x, y, s){
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 2.2*s; ctx.lineCap = 'round';
  for(let i=0;i<3;i++){
    const wy = y + i*8*s, w = (16 - i*3) * s;
    ctx.beginPath();
    ctx.moveTo(x-w, wy);
    ctx.quadraticCurveTo(x-w*0.5, wy-3.2*s, x, wy);
    ctx.quadraticCurveTo(x+w*0.5, wy+3.2*s, x+w, wy);
    ctx.stroke();
  }
}
function seaRock(ctx, x, y, s){
  ctx.fillStyle = 'rgba(0,20,30,0.22)';
  ctx.beginPath(); ctx.ellipse(x, y+3*s, 13*s, 4*s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a5560';
  ctx.beginPath();
  ctx.moveTo(x-10*s, y+3*s); ctx.lineTo(x-4*s, y-9*s); ctx.lineTo(x+2*s, y-11*s);
  ctx.lineTo(x+9*s, y-2*s);  ctx.lineTo(x+7*s, y+3*s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6a7784';
  ctx.beginPath();
  ctx.moveTo(x-4*s, y-9*s); ctx.lineTo(x+2*s, y-11*s); ctx.lineTo(x-1*s, y-3*s);
  ctx.closePath(); ctx.fill();
}

/* Adaları sırayla bağlayan kesikli rota. Yolculuğun yönünü gösterir. */
function drawRoute(ctx){
  ctx.save();
  ctx.setLineDash([9, 11]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.34)';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for(let i=0;i<REGIONS.length-1;i++){
    const a = ISLANDS[REGIONS[i].id], b = ISLANDS[REGIONS[i+1].id];
    if(!a || !b) continue;
    const mx = (a.x+b.x)/2 + (i%2 ? 90 : -90);
    const my = (a.y+b.y)/2;
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}

/* ---- pişirme --------------------------------------------------- */

let worldBake = null;      // offscreen canvas
let worldBakeKey = '';     // hangi kilit durumuyla pişirildi

/* Kilitli adalar gri çizilir; kilit durumu değişince yeniden pişmeli.
   Anahtar, bölgelerin açık/kapalı dizisi. */
function worldLockKey(){
  return REGIONS.map(r => advIsRegionUnlocked(r) ? '1' : '0').join('');
}

function bakeWorld(){
  const key = worldLockKey();
  if(worldBake && worldBakeKey === key) return worldBake;
  if(!worldBake){
    worldBake = document.createElement('canvas');
    worldBake.width = WORLD_W; worldBake.height = WORLD_H;
  }
  const ctx = worldBake.getContext('2d');
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  drawSea(ctx);
  drawSeaProps(ctx);
  drawRoute(ctx);
  // Arkadaki (yukarıdaki) ada önce çizilsin ki öndeki üstüne binsin
  const order = REGIONS.slice().sort((a,b)=> ISLANDS[a.id].y - ISLANDS[b.id].y);
  for(const r of order){
    const cfg = ISLANDS[r.id];
    if(!cfg) continue;
    drawIsland(ctx, r, cfg, !advIsRegionUnlocked(r));
  }
  worldBakeKey = key;
  return worldBake;
}
/* Yıldız kazanınca kilitler değişmiş olabilir. */
function invalidateWorldBake(){ worldBakeKey = ''; }
