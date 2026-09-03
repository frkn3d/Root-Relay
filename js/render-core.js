/* ============================================================
   RENDER / ÇEKİRDEK — bütün çizim dosyalarının paylaştığı
   küçük yardımcılar. Kendi başına hiçbir şey çizmez.
   ============================================================ */
const TOWER_VISUAL_SCALE = 0.78; // kulelerin görsel boyutu (menzil/mantık etkilenmez)

/* Yükseltme her seviyede kuleyi %10 büyütür — oyuncu bakışta
   hangi kulenin geliştiğini anlayabilsin diye. */
function towerLevelScale(t){
  return Math.pow(1.10, (t.level||0));
}

/* Seviye arttıkça renkleri kademeli olarak daha parlak/doygun yapar.
   HSL üzerinden çalışır; hex girdiyi çevirir. */
function brightenColor(hex, level){
  if(!level) return hex;
  const m = hex.replace('#','');
  const r = parseInt(m.substring(0,2),16)/255;
  const g = parseInt(m.substring(2,4),16)/255;
  const b = parseInt(m.substring(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  const d=max-min;
  if(d!==0){
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) h=((g-b)/d + (g<b?6:0))/6;
    else if(max===g) h=((b-r)/d + 2)/6;
    else h=((r-g)/d + 4)/6;
  }
  const H = h*360;
  const S = Math.min(100, s*100 + level*11);
  const L = Math.min(78, l*100 + level*7);
  return `hsl(${H.toFixed(0)}, ${S.toFixed(0)}%, ${L.toFixed(0)}%)`;
}

/* ============================================================
   ÖNBELLEKLER — çizim maliyetini düşüren iki mekanizma.
   İkisi de GÖRÜNTÜYÜ DEĞİŞTİRMEZ; aynı pikselleri daha ucuza üretir.

   1) GRADYAN ÖNBELLEĞİ
      createLinearGradient/createRadialGradient her çağrıda yeni bir
      nesne üretir. Kuleler sabit yerde durduğu, düşmanlar da kendi
      yerel koordinat sisteminde çizildiği (ctx.translate) için aynı
      gradyan her karede birebir yeniden kuruluyordu — karede ~100
      nesne, saniyede 6000. Anahtar aynıysa nesne yeniden kullanılır.
      Gradyanlar dönüşümden bağımsızdır: dönüşüm fill anında uygulanır,
      bu yüzden önbellek güvenli.

   2) IŞIMA (GLOW) SPRITE ÖNBELLEĞİ
      ctx.shadowBlur mobilde en pahalı canvas işlemi: her çağrı ayrı
      bir ara yüzeye çizip bulanıklık geçişi çalıştırır. Oyunda karede
      ~100 tane vardı. Işıyan nokta aslında hep aynı görüntü; bir kez
      küçük bir tuvale çizilip drawImage ile basılırsa AYNI pikseller
      tek bir kopyalama maliyetiyle çıkar.

   Sprite'lar cihazın gerçek çözünürlüğünde (mevcut dönüşüm ölçeği)
   pişirilir, yoksa ölçeklenip bulanıklaşırdı.
   ============================================================ */
/* ANAHTAR KURALI: gradyanın görüntüsünü etkileyen HER ŞEY anahtarda
   olmalı — koordinatlar, ölçüler ve renkleri belirleyen değişkenler
   (ör. kule seviyesi, düşman rengi, flash durumu). Eksik bir anahtar
   sessiz bir görsel hataya yol açar: yükseltilmiş bir kule eski
   seviyesinin rengiyle çizilir. assert_perf.js bunu kaynak üzerinden
   denetler. */
const GRAD_CACHE_MAX = 400;
const _gradCache = new Map();

function cachedGrad(key, make){
  let g = _gradCache.get(key);
  if(g === undefined){
    // Sınırsız büyümesin: dolduğunda tamamen boşalt (basit ve ucuz).
    if(_gradCache.size >= GRAD_CACHE_MAX) _gradCache.clear();
    g = make();
    _gradCache.set(key, g);
  }
  return g;
}

/* Mevcut dönüşümün ölçeği — sprite'ı hangi çözünürlükte pişirmek
   gerektiğini söyler (DPR × kule görsel ölçeği × seviye büyümesi). */
function currentScale(){
  if(!ctx.getTransform) return dpr || 1;
  const m = ctx.getTransform();
  return Math.max(0.05, Math.hypot(m.a, m.b));
}

const GLOW_CACHE_MAX = 240;
const _glowCache = new Map();

/* Işıyan bir daire: dolgu rengi + shadowBlur halesi.
   Aynı görüntüyü sprite'tan basar. r ve ölçek 1/4 piksel adımına
   yuvarlanır — halenin yumuşak kenarında gözle ayırt edilemez, ama
   önbelleği birkaç düzine sprite'ta tutar. */
function glowDot(x, y, r, fill, glow, blur){
  const s = currentScale();
  const qs = Math.round(s*4)/4;
  const qr = Math.round(r*4)/4;
  const key = fill+'|'+glow+'|'+qr+'|'+blur+'|'+qs;
  let sp = _glowCache.get(key);
  if(sp === undefined){
    if(_glowCache.size >= GLOW_CACHE_MAX) _glowCache.clear();
    const half = qr + blur + 2;              // hale yarıçapı + pay
    const px = Math.max(2, Math.ceil(half*2*qs));
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const c2 = cv.getContext('2d');
    c2.setTransform(qs, 0, 0, qs, 0, 0);
    c2.beginPath(); c2.arc(half, half, qr, 0, Math.PI*2);
    c2.fillStyle = fill;
    if(blur > 0){ c2.shadowColor = glow; c2.shadowBlur = blur; }
    c2.fill();
    sp = { cv, half };
    _glowCache.set(key, sp);
  }
  ctx.drawImage(sp.cv, x - sp.half, y - sp.half, sp.half*2, sp.half*2);
}

/* ---- DEĞİŞMEYEN ÇİZİM SPRITE'I ----
   Her karede birebir aynı çıkan bir çizim öbeğini (ör. kule kaidesi)
   bir kez pişirip drawImage ile basar. Sprite mevcut dönüşüm ölçeğinde
   üretildiği için sonuç piksel piksel aynıdır.
     key  — önbellek anahtarı; çizim neye bağlıysa hepsi içinde olmalı
     box  — [solx, usty, genislik, yukseklik] yerel koordinatlarda
     draw — çizimi yapan fonksiyon (yerel koordinatlarda) */
const STATIC_CACHE_MAX = 80;
const _staticCache = new Map();

function staticSprite(key, box, draw){
  const s = currentScale();
  const qs = Math.round(s*4)/4;
  const [bx, by, bw, bh] = box;
  const ck = key + '|' + qs;
  let sp = _staticCache.get(ck);
  if(sp === undefined){
    if(_staticCache.size >= STATIC_CACHE_MAX) _staticCache.clear();
    const cv = document.createElement('canvas');
    cv.width  = Math.max(1, Math.ceil(bw*qs));
    cv.height = Math.max(1, Math.ceil(bh*qs));
    const c2 = cv.getContext('2d');
    c2.setTransform(qs, 0, 0, qs, -bx*qs, -by*qs);
    const real = ctx;
    ctx = c2;
    try { draw(); } finally { ctx = real; }
    sp = { cv, bx, by, bw, bh };
    _staticCache.set(ck, sp);
  }
  ctx.drawImage(sp.cv, sp.bx, sp.by, sp.bw, sp.bh);
}

/* Tuval boyutu ya da tema değişince pişmiş her şey geçersizdir. */
function clearRenderCaches(){
  _gradCache.clear();
  _glowCache.clear();
  _staticCache.clear();
}

function roundedRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
