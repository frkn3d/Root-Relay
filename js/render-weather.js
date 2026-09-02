/* ============================================================
   RENDER / HAVA & ORTAM — kuş sürüsü, kar yağışı ve yağmur.
   Hepsi saf atmosferik; oynanışa hiç dokunmaz, en üst katmanda çizilir.
   ============================================================ */
/* Ortam kuşu sürüsü — biyoma göre tür/renk. Zamanlama ve uçuş durumu
   engine.js'te (birds, spawnBird, scheduleNextBird); burada sadece
   biyom→görsel eşlemesi ve çizim var. */
const BIOME_BIRDS = {
  forest:        { body:'#8a6f42', wing:'#4a3f22', size:0.9  },  // orman serçesi
  desert:        { body:'#d1a95c', wing:'#7a5a2c', size:1.15 },  // çöl şahini
  mediterranean: { body:'#eef4f6', wing:'#7fa3c2', size:1.05 },  // martı
  tundra:        { body:'#eef2f2', wing:'#b7c3c8', size:0.85 },  // kar kuşu
  swamp:         { body:'#4a5c46', wing:'#243024', size:1.2  },  // balıkçıl
  savanna:       { body:'#d99a4a', wing:'#8a5a24', size:1.15 },  // bozkır kartalı
  volcanic:      { body:'#7a3a34', wing:'#241a18', size:1.0  },  // kara karga
};

/* Üç evreli uçuş yolu — yaklaşma / süzülme (elips turu) / çıkış.
   Evre sınırlarında KONUM eşleşiyordu ama düz çizginin yönü elipsin o
   noktadaki teğetiyle örtüşmediği için kuş sınırda birden "kırılıyordu"
   (denendi: iki evrenin konumunu pencerede harmanlamak konumu düzeltse
   de aradaki farkı tek karede kapatmaya çalıştığından yön sıçraması
   sürüyordu). Gerçek çözüm: yaklaşma/çıkış düz çizgi DEĞİL, ucu tam
   elipsin o andaki teğet yönünü hedefleyen ikinci dereceden bir Bézier
   eğrisi — böylece yön, sınırda cebirsel olarak zaten eşleşiyor. */
function bezierPt(p0, p1, p2, p){
  const q = 1-p;
  return { x: q*q*p0.x + 2*q*p*p1.x + p*p*p2.x, y: q*q*p0.y + 2*q*p*p1.y + p*p*p2.y };
}
function ellipseTangentDir(rx, ry, theta, dir){
  const tx = -rx*Math.sin(theta), ty = ry*Math.cos(theta);
  const s = dir<0 ? -1 : 1;
  const len = Math.hypot(tx,ty) || 1;
  return { x: s*tx/len, y: s*ty/len };
}

/* Teğet yönü, düz çizginin doğal yönüyle (neredeyse) ters düşerse — kuş
   döngüden neredeyse geri dönerek giriyor/çıkıyormuş gibi — tam teğet
   eşleşmesi eğriyi S şekline sokup ortada bir "durma noktası" yaratıyordu
   (hız sıfıra yaklaşınca yön belirsizleşip aniden sıçrıyordu). Hizasızlık
   arttıkça teğet etkisini (k'yı) azaltarak bunu önlüyoruz — iyi hizalanmış
   çoğunluk durumda tam yumuşak geçiş, kötü hizalanmış nadir durumda düz
   çizgiye yakın (küçük bir sıçrama pahasına, ama S kavisi/durma yok). */
function tangentBlendK(dist, tangent, chordDir){
  const align = tangent.x*chordDir.x + tangent.y*chordDir.y;
  const kScale = Math.max(0, align) ** 2;   // hizasız/ters durumda 0'a insin — S kavisi/durma noktası oluşmasın
  return Math.max(8, dist*0.35) * kScale;
}

function birdApproachPos(b, t){
  const p = b.approachDur>0 ? Math.max(0, Math.min(1, t/b.approachDur)) : 1;
  const p0 = { x:b.x0, y:b.y0 };
  const p2 = { x: b.cx+Math.cos(b.angle)*b.rx, y: b.cy+Math.sin(b.angle)*b.ry };
  const dist = Math.hypot(p2.x-p0.x, p2.y-p0.y) || 1;
  const chordDir = { x:(p2.x-p0.x)/dist, y:(p2.y-p0.y)/dist };
  const tin = ellipseTangentDir(b.rx, b.ry, b.angle, b.dir);
  const k = tangentBlendK(dist, tin, chordDir);
  const p1 = { x: p2.x - tin.x*k, y: p2.y - tin.y*k };
  const bez = bezierPt(p0, p1, p2, p);
  // bob genliği uçların (kalkış / döngüye giriş) TAM SIFIR olması için
  // sin(p*PI) ile fade in/out yapılıyor.
  return { x: bez.x, y: bez.y + Math.sin(t*3+b.bobPhase)*b.bob*Math.sin(p*Math.PI) };
}
function birdLoopPos(b, tLoop){
  const p = b.loopDur>0 ? tLoop/b.loopDur : 1;
  const ang = b.angle + b.dir*p*b.loops*Math.PI*2;
  return { x: b.cx + Math.cos(ang)*b.rx, y: b.cy + Math.sin(ang)*b.ry };
}
function birdDepartPos(b, tDep){
  const p = b.departDur>0 ? Math.max(0, Math.min(1, tDep/b.departDur)) : 1;
  const angEnd = b.angle + b.dir*b.loops*Math.PI*2;
  const p0 = { x: b.cx+Math.cos(angEnd)*b.rx, y: b.cy+Math.sin(angEnd)*b.ry };
  const p2 = { x: b.x1, y: b.y1 };
  const dist = Math.hypot(p2.x-p0.x, p2.y-p0.y) || 1;
  const chordDir = { x:(p2.x-p0.x)/dist, y:(p2.y-p0.y)/dist };
  const tout = ellipseTangentDir(b.rx, b.ry, angEnd, b.dir);
  const k = tangentBlendK(dist, tout, chordDir);
  const p1 = { x: p0.x + tout.x*k, y: p0.y + tout.y*k };
  const bez = bezierPt(p0, p1, p2, p);
  const tAbs = tDep + b.approachDur + b.loopDur;   // bob dalgası mutlak zamana göre ilerler
  return { x: bez.x, y: bez.y + Math.sin(tAbs*3+b.bobPhase)*b.bob*Math.sin(p*Math.PI) };
}

function birdPositionAt(b, t){
  if(t <= b.approachDur) return birdApproachPos(b, t);
  const tLoop = t - b.approachDur;
  if(tLoop <= b.loopDur) return birdLoopPos(b, tLoop);
  return birdDepartPos(b, tLoop - b.loopDur);
}

let lastBirdFrameT = null;
function drawBirds(){
  const now = performance.now()/1000;
  const fdt = (lastBirdFrameT===null) ? 0 : Math.max(0, Math.min(0.1, now-lastBirdFrameT));
  lastBirdFrameT = now;
  birds.forEach(b=>drawOneBird(b, fdt));
}
const BIRD_MAX_TURN_RATE = Math.PI*1.6;   // rad/sn — normal döngü dönüşünün kat kat üstünde
function drawOneBird(bird, fdt){
  if(bird.t < 0) return;   // sürüde henüz sırası gelmedi (kenarın hemen dışında bekliyor)
  const t = Math.max(0, Math.min(bird.dur, bird.t));
  const pos = birdPositionAt(bird, t);
  const x = pos.x, y = pos.y;
  // Uçuşun tam son karesinde ileri bakış bird.dur'a takılıp konum
  // donduğundan yön sıfıra kilitleniyordu — sona yakınken geriye
  // bakışla hesaplanıyor ki son anda da yön doğru kalsın.
  const lookFwd = (t + 0.05 <= bird.dur);
  const refT = lookFwd ? t + 0.05 : Math.max(0, t - 0.05);
  const ref = birdPositionAt(bird, refT);
  const rawAngle = lookFwd
    ? Math.atan2(ref.y-pos.y, ref.x-pos.x)
    : Math.atan2(pos.y-ref.y, pos.x-ref.x);
  // Konum eğrisi matematiksel olarak sürekli olsa da (yaklaşma/elips/çıkış
  // arasında), evre sınırlarına yakın nadir açılarda anlık hız çok düşüp
  // yön ölçümü gürültülü kalabiliyordu. Görsel dönüşü bir üst limitle
  // (BIRD_MAX_TURN_RATE) sınırlayarak — normal elips dönüşünün çok
  // üstünde bir hız olduğundan doğal manevrayı KISMAMIYOR ama olası bir
  // ani sıçramayı kısa bir yumuşak dönüşe çeviriyor.
  let angle = rawAngle;
  if(fdt>0 && bird.dispAngle!==undefined){
    let diff = rawAngle - bird.dispAngle;
    while(diff>Math.PI) diff -= Math.PI*2;
    while(diff<-Math.PI) diff += Math.PI*2;
    const maxStep = BIRD_MAX_TURN_RATE*fdt;
    if(diff>maxStep) diff=maxStep; else if(diff<-maxStep) diff=-maxStep;
    angle = bird.dispAngle + diff;
  }
  bird.dispAngle = angle;
  const sp = bird.species;
  const s = bird.size * (sp.size||1);
  const flap = Math.sin(bird.t*bird.wingSpeed + bird.wingPhase);
  const sweep = 2.2 + flap*2.4;

  ctx.save();
  // kuş bakışından bakıyoruz: gölgesi tam altında, zeminin üstünde
  ctx.beginPath();
  ctx.ellipse(x, y, 7*s, 3*s, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -6.5*s);
  ctx.quadraticCurveTo(-sweep*s, 0, 1.6*s, 0.6*s);
  ctx.quadraticCurveTo(-sweep*s, 0, 0, 6.5*s);
  ctx.strokeStyle = sp.wing;
  ctx.lineWidth = 1.8*s;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.4*s, 1.4*s, 0, 0, Math.PI*2);
  ctx.fillStyle = sp.body;
  ctx.fill();
  ctx.restore();
}

/* Kışın sürekli kar yağışı — ekran genelinde, hafif rüzgârlı */
const snowFlakes = (()=>{
  const arr=[];
  for(let i=0;i<90;i++){
    arr.push({
      x: Math.random()*LW,
      y: Math.random()*LH,
      r: 1 + Math.random()*2.2,
      sp: 18 + Math.random()*38,
      sw: 0.5 + Math.random()*1.6,
      ph: Math.random()*Math.PI*2,
    });
  }
  return arr;
})();

function drawSnowfall(){
  if(!(level.theme && level.theme.season==='winter')) return;
  const t0 = performance.now()/1000;
  ctx.save();
  snowFlakes.forEach(f=>{
    // Sürekli aşağı akış + yanal salınım (döngüsel, durum tutmadan)
    const y = (f.y + t0*f.sp) % (LH+20);
    const x = f.x + Math.sin(t0*f.sw + f.ph) * 12;
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,'+(0.35 + f.r*0.12)+')';
    ctx.fill();
  });
  ctx.restore();
}

/* Yağmur twist'i (levelgen.js LEVEL_TWISTS): kar gibi sabit bir
   damla havuzu, sadece çok daha hızlı ve hafif eğik düşer. Görünürlüğü
   level.twist==='rain' ile kapılı — kışın karıyla aynı anda bile
   çıkabilir, bu kasıtlı olarak özel bir durum sayılmadı (çok nadir). */
const rainDrops = (()=>{
  const arr=[];
  for(let i=0;i<70;i++){
    arr.push({
      x: Math.random()*LW,
      y: Math.random()*LH,
      len: 10 + Math.random()*14,
      sp: 420 + Math.random()*260,
    });
  }
  return arr;
})();
function drawRain(){
  if(!(level.twist === 'rain')) return;
  const t0 = performance.now()/1000;
  ctx.save();
  ctx.strokeStyle = 'rgba(190,215,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  rainDrops.forEach(d=>{
    const y = ((d.y + t0*d.sp) % (LH+40)) - 20;
    const x = ((d.x + t0*d.sp*0.18) % (LW+40)) - 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - d.len*0.3, y - d.len);
    ctx.stroke();
  });
  ctx.restore();
}
