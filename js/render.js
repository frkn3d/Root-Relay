/* ============================================================
   RENDER — sadece canvas çizim fonksiyonları.
   Oyun durumunu (engine.js) okur, değiştirmez.
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

/* Yükseltilmiş kulelerin çevresinde dönen enerji halkaları —
   seviye sayısı kadar halka çizilir. */
function drawLevelAura(t){
  const lvl = t.level||0;
  if(lvl<=0) return;
  const t0 = performance.now()/1000;
  ctx.save();
  for(let i=0;i<lvl;i++){
    const ang = t0*(0.8+i*0.35) + i*(Math.PI*2/3);
    const rad = 22 + i*5;
    const px = t.x + Math.cos(ang)*rad;
    const py = t.y - 4 + Math.sin(ang)*rad*0.45;
    ctx.beginPath(); ctx.arc(px,py,2.2,0,Math.PI*2);
    ctx.fillStyle = '#f4c04a';
    ctx.shadowColor = '#f4c04a'; ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.restore();
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

/* Aktif bölümün yol renk takımı (tema varsa ondan, yoksa varsayılan) */
function roadPalette(){
  if(level.theme && ROAD_TYPES[level.theme.road]) return ROAD_TYPES[level.theme.road];
  return { edge:'#c9a463', fill:'#dab876', speck:'rgba(120,80,40,0.35)' };
}

function drawPath(){
  const pal = roadPalette();
  ctx.save();
  ctx.lineCap='round'; ctx.lineJoin='round';

  // Her rota için üç katman: gölge, kenar, dolgu
  levelPaths.forEach(pts=>{
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=52;
    ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  });
  levelPaths.forEach(pts=>{
    ctx.strokeStyle=pal.edge; ctx.lineWidth=42;
    ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  });
  levelPaths.forEach(pts=>{
    ctx.strokeStyle=pal.fill; ctx.lineWidth=34;
    ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  });

  // Kışın yol kenarlarında kar birikintisi
  if(level.theme && level.theme.season==='winter'){
    ctx.strokeStyle='rgba(255,255,255,0.30)'; ctx.lineWidth=46;
    levelPaths.forEach(pts=>{
      ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    });
    ctx.strokeStyle=pal.fill; ctx.lineWidth=34;
    levelPaths.forEach(pts=>{
      ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    });
  }

  // Asfaltta orta şerit çizgisi
  if(level.theme && level.theme.road==='asphalt'){
    ctx.setLineDash([14,16]);
    ctx.strokeStyle='rgba(240,230,180,0.35)'; ctx.lineWidth=2.5;
    levelPaths.forEach(pts=>{
      ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // Yol üstü çakıl/benek dokusu
  pathDecor.forEach(list=>{
    list.forEach(d=>{
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle=pal.speck; ctx.fill();
    });
  });
  ctx.restore();

  // Giriş ve çıkış işaretleri — her rotanın kendi uçları
  ctx.save();
  ctx.font='15px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const seenStart = [], seenEnd = [];
  const near = (arr,p)=>arr.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<24);
  levelPaths.forEach(pts=>{
    const s = pts[0], e = pts[pts.length-1];
    if(!near(seenStart,s)){
      seenStart.push(s);
      ctx.beginPath(); ctx.arc(s.x,s.y,13,0,Math.PI*2);
      ctx.fillStyle='rgba(226,80,74,0.22)'; ctx.fill();
      ctx.strokeStyle='rgba(226,80,74,0.7)'; ctx.lineWidth=2; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText('💀', s.x, s.y+1);
    }
    if(!near(seenEnd,e)){
      seenEnd.push(e);
      ctx.beginPath(); ctx.arc(e.x,e.y,13,0,Math.PI*2);
      ctx.fillStyle='rgba(244,192,74,0.22)'; ctx.fill();
      ctx.strokeStyle='rgba(244,192,74,0.75)'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillText('🔮', e.x, e.y+1);
    }
  });
  ctx.restore();
}
/* Yolun başına ve sonuna, gidiş yönünü belirten silik akan oklar.
   Yolun teğetine göre döner, sürekli ileri kayarak yönü belli eder. */
function drawDirectionArrows(){
  const t0 = performance.now()/1000;
  ctx.save();
  levelPaths.forEach((pts, pi)=>{
    const len = pathLens[pi] || 0;
    if(len < 120) return;
    const zones = [ 40, Math.max(60, len - 150) ];
    zones.forEach(zStart=>{
      for(let i=0;i<3;i++){
        const cyc = ((t0*0.45 + i/3) % 1);
        const d = zStart + cyc*110;
        if(d < 0 || d > len) continue;
        const p  = pointAtDistance(pts, len, d);
        const p2 = pointAtDistance(pts, len, Math.min(d+6, len));
        const ang = Math.atan2(p2.y-p.y, p2.x-p.x);
        const fade = Math.sin(cyc*Math.PI);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.30 * fade;
        ctx.strokeStyle = '#fff6dd';
        ctx.lineWidth = 3; ctx.lineCap='round'; ctx.lineJoin='round';
        ctx.beginPath();
        ctx.moveTo(-7,-7); ctx.lineTo(2,0); ctx.lineTo(-7,7);
        ctx.stroke();
        ctx.restore();
      }
    });
  });
  ctx.restore();
}

/* ============================================================
   MANZARA DEKORU — boş araziye serpilen biyom nesneleri.
   Yola ve kule noktalarına değmeyecek şekilde üretilmişlerdir.
   ============================================================ */
function propShadow(s){
  ctx.beginPath();
  ctx.ellipse(0, 2, 7*s, 2.6*s, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.fill();
}

function drawProp(p, snowy){
  const s = p.s;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.f*s, s);

  switch(p.type){
    case 'tree': {
      propShadow(1);
      ctx.fillStyle='#5a3a1e';
      ctx.fillRect(-1.6, -6, 3.2, 8);
      const g = ctx.createRadialGradient(-3,-14,1,0,-12,12);
      g.addColorStop(0, snowy?'#dfeee2':'#6fae62');
      g.addColorStop(1, snowy?'#8fae95':'#33622f');
      ctx.beginPath(); ctx.arc(0,-12,10,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      ctx.beginPath(); ctx.arc(-6,-8,6,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6,-9,6.5,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'pine': {
      propShadow(1);
      ctx.fillStyle='#4a3018';
      ctx.fillRect(-1.4, -5, 2.8, 7);
      for(let i=0;i<3;i++){
        const yy=-6-i*6, w=9-i*2.4;
        ctx.beginPath();
        ctx.moveTo(0, yy-9); ctx.lineTo(-w, yy); ctx.lineTo(w, yy);
        ctx.closePath();
        ctx.fillStyle = snowy ? (i===2?'#eaf5ef':'#9dbfa8') : (i%2?'#2f5c34':'#3a6d3c');
        ctx.fill();
      }
      break;
    }
    case 'bush': {
      propShadow(0.8);
      ctx.beginPath(); ctx.arc(0,-3,6,0,Math.PI*2);
      ctx.fillStyle = snowy?'#cfe3d4':'#446f34'; ctx.fill();
      ctx.beginPath(); ctx.arc(-4,-1,4.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(4,-2,4,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'shrub': {
      propShadow(0.7);
      ctx.strokeStyle = snowy?'#b9cfc0':'#5c7a3e'; ctx.lineWidth=1.6;
      for(let i=-2;i<=2;i++){
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(i*2.6, -6-Math.abs(i)); ctx.stroke();
      }
      break;
    }
    case 'cactus': {
      propShadow(0.8);
      ctx.fillStyle='#3f7a46'; ctx.strokeStyle='#28512d'; ctx.lineWidth=1;
      roundedRect(-2.6,-16,5.2,18,2.6); ctx.fill(); ctx.stroke();
      roundedRect(-8,-12,3.4,8,1.7); ctx.fill(); ctx.stroke();
      roundedRect(-8,-12.5,9,3.2,1.6); ctx.fill(); ctx.stroke();
      roundedRect(5,-9,3.4,7,1.7); ctx.fill(); ctx.stroke();
      roundedRect(-1,-9.5,7.5,3,1.5); ctx.fill(); ctx.stroke();
      break;
    }
    case 'rock': {
      propShadow(0.9);
      const g=ctx.createLinearGradient(-6,-8,6,2);
      g.addColorStop(0, snowy?'#e8eef0':'#9a968c');
      g.addColorStop(1,'#5d5a52');
      ctx.beginPath();
      ctx.moveTo(-7,1); ctx.lineTo(-4,-6); ctx.lineTo(2,-8); ctx.lineTo(7,-2); ctx.lineTo(5,1);
      ctx.closePath(); ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
      break;
    }
    case 'boulder': {
      propShadow(1.2);
      const g=ctx.createLinearGradient(-10,-12,10,3);
      g.addColorStop(0,'#8a7f76'); g.addColorStop(1,'#453f3a');
      ctx.beginPath();
      ctx.moveTo(-11,2); ctx.lineTo(-7,-9); ctx.lineTo(1,-13); ctx.lineTo(9,-6); ctx.lineTo(8,2);
      ctx.closePath(); ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1.2; ctx.stroke();
      break;
    }
    case 'olive': {
      propShadow(1);
      ctx.strokeStyle='#6b5a3a'; ctx.lineWidth=2.4;
      ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(-1,-6); ctx.stroke();
      ctx.beginPath(); ctx.arc(-4,-9,5.5,0,Math.PI*2);
      ctx.fillStyle = snowy?'#d5e2d6':'#6e8b52'; ctx.fill();
      ctx.beginPath(); ctx.arc(4,-10,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(0,-14,4.5,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'acacia': {
      propShadow(1);
      ctx.strokeStyle='#6b4a28'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(0,-8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(-6,-12); ctx.moveTo(0,-8); ctx.lineTo(6,-12); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0,-14,11,4.5,0,0,Math.PI*2);
      ctx.fillStyle = snowy?'#dfe7dc':'#6f8438'; ctx.fill();
      break;
    }
    case 'deadtree': {
      propShadow(0.9);
      ctx.strokeStyle='#4a3b2e'; ctx.lineWidth=2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(0,-12); ctx.stroke();
      ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(-6,-11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(5,-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(-3,-17); ctx.stroke();
      break;
    }
    case 'deadbush': {
      propShadow(0.6);
      ctx.strokeStyle='#8a7a54'; ctx.lineWidth=1.2;
      for(let i=0;i<6;i++){
        const a=-Math.PI/2 + (i-2.5)*0.35;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.lineTo(Math.cos(a)*6, Math.sin(a)*7);
        ctx.stroke();
      }
      break;
    }
    case 'reed': {
      ctx.strokeStyle = snowy?'#c8d6c9':'#5d7a44'; ctx.lineWidth=1.5; ctx.lineCap='round';
      for(let i=-2;i<=2;i++){
        ctx.beginPath();
        ctx.moveTo(i*2, 2);
        ctx.quadraticCurveTo(i*2.6, -6, i*2.6+i*1.5, -12);
        ctx.stroke();
      }
      break;
    }
    default: { // grass
      ctx.strokeStyle = snowy?'#d8e4d8':'#7c8a3e'; ctx.lineWidth=1.3; ctx.lineCap='round';
      for(let i=-2;i<=2;i++){
        ctx.beginPath(); ctx.moveTo(i*1.8,1);
        ctx.quadraticCurveTo(i*2.4,-3, i*3.4,-6.5); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawProps(){
  if(!level.props || !level.props.length) return;
  const snowy = level.theme && level.theme.season==='winter';
  level.props.forEach(p=>drawProp(p, snowy));
}

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

function drawBirds(){
  birds.forEach(drawOneBird);
}
function drawOneBird(bird){
  if(bird.t < 0) return;   // sürüde henüz sırası gelmedi (kenarın hemen dışında bekliyor)
  const p = Math.max(0, Math.min(1, bird.t / bird.dur));
  const x = bird.x0 + (bird.x1-bird.x0)*p;
  const y = bird.y0 + (bird.y1-bird.y0)*p + Math.sin(bird.t*3 + bird.bobPhase)*bird.bob;
  const angle = Math.atan2(bird.y1-bird.y0, bird.x1-bird.x0);
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

function drawSpots(){
  const t0 = performance.now()/1000;
  spots.forEach(s=>{
    if(s.occ) return;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(s.x,s.y+4,22,10,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill();

    if(pendingSpot === s){
      // Onay bekleyen nokta: kurulacak kulenin menzilini önizle
      const def = TOWER_TYPES[selectedType];
      ctx.beginPath(); ctx.arc(s.x,s.y,def.range,0,Math.PI*2);
      ctx.fillStyle = def.color+'22'; ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth=2;
      ctx.setLineDash([7,6]); ctx.stroke(); ctx.setLineDash([]);

      const pulse = 2+Math.sin(t0*4)*2;
      ctx.beginPath(); ctx.arc(s.x,s.y,17+pulse,0,Math.PI*2);
      ctx.strokeStyle='var(--gold)'; ctx.strokeStyle='#f4c04a';
      ctx.lineWidth=2.5; ctx.stroke();
      // hayalet ikon
      ctx.globalAlpha=0.55;
      ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(def.icon, s.x, s.y);
    } else {
      ctx.beginPath(); ctx.arc(s.x,s.y,17,0,Math.PI*2);
      ctx.strokeStyle='rgba(244,192,74,0.4)'; ctx.lineWidth=2; ctx.setLineDash([4,5]); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
}

function drawBasePlinth(x,y,pulse){
  ctx.beginPath(); ctx.ellipse(x,y+16,20,7,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fill();
  const grad = ctx.createRadialGradient(x-4,y+6,2,x,y+10,20);
  grad.addColorStop(0,'#a8a191'); grad.addColorStop(0.6,'#84806f'); grad.addColorStop(1,'#4c4839');
  ctx.beginPath(); ctx.ellipse(x,y+10,18,8,0,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill();
  ctx.lineWidth=2.5; ctx.strokeStyle='#241f16'; ctx.stroke();
  // taş dokusu benekleri
  [[-9,7],[6,10],[-2,5],[10,6]].forEach(([dx,dy])=>{
    ctx.beginPath(); ctx.ellipse(x+dx,y+dy,2,1.2,0.3,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fill();
  });
  // kenarda küçük yosun tutamları
  [[-15,10,'#5a8a4f'],[13,11,'#4f7a45'],[3,13,'#6b9e5c']].forEach(([dx,dy,c])=>{
    ctx.beginPath(); ctx.ellipse(x+dx,y+dy,3.2,2,0,0,Math.PI*2);
    ctx.fillStyle=c; ctx.fill();
  });
}

function drawArcherTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.2;
  const t0 = performance.now()/1000;
  const lvl = t.level||0;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  const trunkGrad = ctx.createLinearGradient(x-10,y-16,x+10,y+8);
  trunkGrad.addColorStop(0,'#8a5a34'); trunkGrad.addColorStop(1,'#6b4526');
  ctx.fillStyle=trunkGrad; ctx.strokeStyle='#2b1a0c'; ctx.lineWidth=2.5;
  roundedRect(x-10,y-16,20,24,6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
  [-5,0,5].forEach(dx=>{ ctx.beginPath(); ctx.moveTo(x+dx,y-13); ctx.lineTo(x+dx,y+6); ctx.stroke(); });

  ctx.save(); ctx.translate(x,y-16); ctx.scale(pulse,pulse);
  ctx.beginPath(); ctx.ellipse(1,2,25,16,0,Math.PI,0);
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
  const capGrad = ctx.createRadialGradient(-8,-10,2,0,-2,28);
  capGrad.addColorStop(0, brightenColor('#c3f0b8', lvl));
  capGrad.addColorStop(0.45, brightenColor('#8fc482', lvl));
  capGrad.addColorStop(1, brightenColor('#446f3f', lvl));
  ctx.beginPath(); ctx.ellipse(0,0,24,15,0,Math.PI,0);
  ctx.fillStyle=capGrad; ctx.fill();
  ctx.lineWidth = 2.5 + lvl*0.4;
  ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#22391d';
  ctx.stroke();
  ctx.strokeStyle='rgba(34,57,29,0.35)'; ctx.lineWidth=1;
  for(let i=-4;i<=4;i++){ ctx.beginPath(); ctx.moveTo(i*5,-1); ctx.lineTo(i*3.2,-11); ctx.stroke(); }
  // Seviye arttıkça şapkada daha çok benek belirir
  const spots = [[-11,-6,3.2],[4,-10,2.6],[12,-3,2.2],[-2,-4,1.8]];
  if(lvl>=1) spots.push([-17,-2,2.0],[8,-6,2.2]);
  if(lvl>=2) spots.push([17,-6,2.0],[-6,-11,1.9]);
  spots.forEach(([dx,dy,r])=>{
    ctx.beginPath(); ctx.arc(dx,dy,r,0,Math.PI*2);
    ctx.fillStyle='#eef7e2'; ctx.fill();
    ctx.beginPath(); ctx.arc(dx-0.6,dy-0.6,r*0.4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fill();
  });
  // 2. seviyeden itibaren şapkanın üstünde küçük bir taç filizi
  if(lvl>=2){
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(-3,-21); ctx.lineTo(3,-21); ctx.closePath();
    ctx.fillStyle='#d8f0a8'; ctx.fill();
    ctx.strokeStyle='#22391d'; ctx.lineWidth=1.4; ctx.stroke();
  }
  ctx.restore();

  // Seviye 1+ : ikinci bir yay belirir
  // Yay hedefe döner; ateş ettikten sonra kiriş gerilip boşalır
  const aim = (t.aimAngle !== undefined) ? t.aimAngle : -Math.PI/2;
  const draw = (t.pulse||0);          // 1 → yeni atış, 0 → dinlenme
  ctx.save();
  ctx.translate(x, y-4);
  ctx.rotate(aim);
  ctx.translate(9, 0);                // yay gövdenin önünde dursun
  ctx.strokeStyle='#3a2410'; ctx.lineWidth=2.2;
  ctx.beginPath(); ctx.arc(0,0,9,-1.05,1.05); ctx.stroke();
  // kiriş: atıştan sonra geriye çekilmiş, sonra düzleşir
  const pull = -draw*4;
  ctx.strokeStyle='rgba(235,225,205,0.85)'; ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(9*Math.cos(-1.05), 9*Math.sin(-1.05));
  ctx.lineTo(pull, 0);
  ctx.lineTo(9*Math.cos(1.05), 9*Math.sin(1.05));
  ctx.stroke();
  ctx.restore();

  if(lvl>=1){
    // İkinci yay, gövdenin arkasında ters yöne bakar
    ctx.save();
    ctx.translate(x, y-4);
    ctx.rotate(aim + Math.PI);
    ctx.translate(8, 0);
    ctx.strokeStyle='#3a2410'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,8,-0.95,0.95); ctx.stroke();
    ctx.strokeStyle='rgba(235,225,205,0.7)'; ctx.lineWidth=1.1;
    ctx.beginPath();
    ctx.moveTo(8*Math.cos(-0.95), 8*Math.sin(-0.95));
    ctx.lineTo(pull*0.7, 0);
    ctx.lineTo(8*Math.cos(0.95), 8*Math.sin(0.95));
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath(); ctx.arc(x, y-8, 3.5+lvl*0.5+((t.pulse||0)*2), 0, Math.PI*2);
  ctx.fillStyle='#ffd27a'; ctx.shadowColor='#ffd27a'; ctx.shadowBlur=10+lvl*3; ctx.fill();
  ctx.shadowBlur=0;

  for(let i=0;i<2+lvl;i++){
    const ang = t0*1.3 + i*(Math.PI*2/(2+lvl));
    const fx = x+Math.cos(ang)*18, fy = y-14+Math.sin(ang*1.4)*10;
    ctx.beginPath(); ctx.arc(fx,fy,1.6,0,Math.PI*2);
    ctx.fillStyle='#fff3b0'; ctx.shadowColor='#ffe08a'; ctx.shadowBlur=6; ctx.fill();
  }
  ctx.shadowBlur=0;
  ctx.restore();
}

/* IŞIK KULESİ — Don Peykesi ile karışmasın diye tamamen farklı bir
   form: kristal yok. Taş bir sütun üzerinde havada süzülen bir küre
   ve onu çevreleyen eğik yörünge halkaları. */
function drawMageTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.3;
  const t0 = performance.now()/1000;
  const lvl = t.level||0;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  // taban rün halkası
  ctx.save(); ctx.translate(x,y+9);
  for(let r=0;r<2;r++){
    ctx.beginPath(); ctx.ellipse(0,0,14-r*4,5-r*1.5,0,0,Math.PI*2);
    ctx.strokeStyle=`rgba(79,195,161,${0.5-r*0.15})`; ctx.lineWidth=1.2;
    ctx.setLineDash([3,3]); ctx.lineDashOffset=-t0*15*(r?1:-1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // taş sütun — yukarı doğru daralan
  const colGrad = ctx.createLinearGradient(x-11,y,x+11,y);
  colGrad.addColorStop(0,'#2f5a4b'); colGrad.addColorStop(0.5,'#79b39c'); colGrad.addColorStop(1,'#2f5a4b');
  ctx.beginPath();
  ctx.moveTo(x-11, y+4);
  ctx.lineTo(x-7, y-22);
  ctx.lineTo(x+7, y-22);
  ctx.lineTo(x+11, y+4);
  ctx.closePath();
  ctx.fillStyle=colGrad; ctx.fill();
  ctx.lineWidth=2.5; ctx.strokeStyle='#123128'; ctx.stroke();

  // sütun üzerinde kazınmış çizgiler
  ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=1;
  [-4,0,4].forEach(dx=>{
    ctx.beginPath(); ctx.moveTo(x+dx, y-19); ctx.lineTo(x+dx*1.3, y+2); ctx.stroke();
  });

  // sütun üstündeki çanak
  ctx.beginPath();
  ctx.ellipse(x, y-22, 9.5, 3.6, 0, 0, Math.PI*2);
  ctx.fillStyle='#3d7362'; ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle='#123128'; ctx.stroke();

  // havada süzülen küre
  const floatY = y - 36 + Math.sin(t0*1.6)*2.5;
  const R = (8.5 + lvl*1.1) * pulse;

  // sütundan küreye uzanan enerji hattı
  ctx.beginPath();
  ctx.moveTo(x, y-24); ctx.lineTo(x, floatY+R*0.7);
  ctx.strokeStyle='rgba(160,240,215,'+(0.35+(t.pulse||0)*0.4)+')';
  ctx.lineWidth=2; ctx.setLineDash([2,4]); ctx.lineDashOffset=-t0*18;
  ctx.stroke(); ctx.setLineDash([]);

  // küreyi çevreleyen eğik yörünge halkaları (seviyeyle çoğalır)
  const rings = 2 + Math.min(lvl,2);
  for(let i=0;i<rings;i++){
    const tilt = (i/rings)*Math.PI + t0*(0.5 + i*0.22);
    ctx.save();
    ctx.translate(x, floatY);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.ellipse(0, 0, R+7+i*2.5, (R+7+i*2.5)*0.30, 0, 0, Math.PI*2);
    ctx.strokeStyle = lvl>=3 ? 'rgba(244,192,74,0.75)' : 'rgba(150,235,205,0.6)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // dış parıltı
  const halo = ctx.createRadialGradient(x,floatY,R*0.3,x,floatY,R*2.2);
  halo.addColorStop(0,'rgba(180,255,235,0.32)');
  halo.addColorStop(1,'rgba(120,220,190,0)');
  ctx.beginPath(); ctx.arc(x,floatY,R*2.2,0,Math.PI*2);
  ctx.fillStyle=halo; ctx.fill();

  // kürenin kendisi
  const orb = ctx.createRadialGradient(x-R*0.35, floatY-R*0.4, R*0.15, x, floatY, R);
  orb.addColorStop(0,'#ffffff');
  orb.addColorStop(0.45, brightenColor('#7fe3c4', lvl));
  orb.addColorStop(1, brightenColor('#227a63', lvl));
  ctx.beginPath(); ctx.arc(x,floatY,R,0,Math.PI*2);
  ctx.fillStyle=orb; ctx.shadowColor='#4fc3a1'; ctx.shadowBlur=16+lvl*4; ctx.fill();
  ctx.shadowBlur=0;
  ctx.lineWidth=1.8; ctx.strokeStyle='rgba(12,45,36,0.6)'; ctx.stroke();

  // küre içinde dönen çekirdek
  ctx.beginPath();
  ctx.ellipse(x + Math.cos(t0*2)*R*0.28, floatY + Math.sin(t0*2)*R*0.18, R*0.32, R*0.2, t0, 0, Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fill();

  ctx.restore();
}

function drawIceTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.25;
  const t0 = performance.now()/1000;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  // donmuş zemin çatlakları
  ctx.save(); ctx.translate(x,y+11);
  ctx.strokeStyle='rgba(200,240,255,0.55)'; ctx.lineWidth=1;
  [[-14,-2,-6,4],[10,-3,16,3],[-4,4,-9,9],[3,5,8,10]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  ctx.restore();

  const trunkGrad = ctx.createLinearGradient(x-9,y-14,x+9,y+6);
  trunkGrad.addColorStop(0,'#8fd0e0'); trunkGrad.addColorStop(1,'#5589a0');
  ctx.fillStyle=trunkGrad; ctx.strokeStyle='#1c3540'; ctx.lineWidth=2.5;
  roundedRect(x-9,y-14,18,20,5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x-3,y-11); ctx.lineTo(x-3,y+3); ctx.stroke();

  ctx.save(); ctx.translate(x,y-14); ctx.scale(pulse,pulse);
  const lvl = t.level||0;
  const hueShift = Math.sin(t0*0.7)*8;
  const shards=[[0,-30,9],[-10,-11,6.5],[10,-12,6.5],[0,-10,5],[-6,-6,4],[6,-7,4]];
  if(lvl>=1) shards.push([-15,-20,5.5]);
  if(lvl>=2) shards.push([15,-21,5.5]);
  if(lvl>=3) shards.push([0,-42,6.5]);
  shards.forEach(([dx,dy,s],i)=>{
    ctx.beginPath();
    ctx.moveTo(dx,dy-s); ctx.lineTo(dx-s*0.55,dy+s*0.5); ctx.lineTo(dx+s*0.55,dy+s*0.5); ctx.closePath();
    const g=ctx.createLinearGradient(dx,dy-s,dx,dy+s*0.5);
    g.addColorStop(0,'#ffffff');
    g.addColorStop(0.55,`hsl(${196+hueShift},${70+lvl*8}%,${75+lvl*4}%)`);
    g.addColorStop(1,`hsl(${210+hueShift},${55+lvl*8}%,${55+lvl*5}%)`);
    ctx.fillStyle=g; ctx.fill();
    ctx.lineWidth = 1.6 + lvl*0.3;
    ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#1c3540';
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx-s*0.1,dy-s*0.8); ctx.lineTo(dx-s*0.05,dy);
    ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1; ctx.stroke();
    if(i<3){
      ctx.beginPath(); ctx.moveTo(dx-s*0.3,dy+s*0.45); ctx.lineTo(dx-s*0.15,dy+s*0.9); ctx.lineTo(dx,dy+s*0.45); ctx.closePath();
      ctx.fillStyle='rgba(220,248,255,0.85)'; ctx.fill();
    }
  });
  ctx.restore();

  for(let i=0;i<3+lvl;i++){
    const ang = t0*0.6 + i*(Math.PI*2/(3+lvl));
    const mx = x+Math.cos(ang)*14, my = y-4+Math.sin(ang)*6;
    ctx.beginPath(); ctx.arc(mx,my,3,0,Math.PI*2);
    ctx.fillStyle='rgba(220,248,255,0.5)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x,y-22,3.5+lvl*0.5+((t.pulse||0)*2.5),0,Math.PI*2);
  ctx.fillStyle='#eafcff'; ctx.shadowColor='#8fd9f0'; ctx.shadowBlur=12+lvl*4; ctx.fill();
  ctx.shadowBlur=0;

  // düşen kar taneleri — seviye ile çoğalır
  for(let i=0;i<3+lvl;i++){
    const cyc = (t0*0.3+i*0.33)%1;
    const sx = x-14+i*(28/(2+lvl)), sy = y-46+cyc*46;
    ctx.beginPath(); ctx.arc(sx,sy,1.3,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fill();
  }
  ctx.restore();
}

/* ZEHİR SARMAŞIĞI — dolanan sarmaşıklı, damlayan bir yaratık kulesi */
function drawPoisonTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.22;
  const t0 = performance.now()/1000;
  const lvl = t.level||0;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  // gövde: sarmaşık sarılı kütük
  const g = ctx.createLinearGradient(x-10,y-20,x+10,y+6);
  g.addColorStop(0, brightenColor('#5f8f3a', lvl));
  g.addColorStop(1, brightenColor('#33581f', lvl));
  ctx.fillStyle=g; ctx.strokeStyle='#16290d'; ctx.lineWidth=2.5;
  roundedRect(x-10,y-20,20,28,7); ctx.fill(); ctx.stroke();

  // dolanan sarmaşıklar
  ctx.strokeStyle=brightenColor('#8fc95a', lvl); ctx.lineWidth=2.2;
  for(let i=0;i<3;i++){
    const yy = y-16+i*9;
    ctx.beginPath();
    ctx.moveTo(x-10, yy);
    ctx.quadraticCurveTo(x, yy+(i%2?5:-5), x+10, yy);
    ctx.stroke();
  }

  // üstteki tomurcuk
  ctx.save(); ctx.translate(x,y-20); ctx.scale(pulse,pulse);
  const pods = [[0,-14,8],[-9,-6,5.5],[9,-7,5.5]];
  if(lvl>=1) pods.push([-13,-14,4.5]);
  if(lvl>=2) pods.push([13,-15,4.5]);
  if(lvl>=3) pods.push([0,-26,6]);
  pods.forEach(([dx,dy,r],i)=>{
    const wob = Math.sin(t0*1.6+i)*1.2;
    ctx.beginPath();
    ctx.ellipse(dx+wob, dy, r, r*1.25, 0, 0, Math.PI*2);
    const pg=ctx.createRadialGradient(dx-r*0.3,dy-r*0.4,1,dx,dy,r*1.3);
    pg.addColorStop(0, brightenColor('#d4f58f', lvl));
    pg.addColorStop(1, brightenColor('#4e8a26', lvl));
    ctx.fillStyle=pg; ctx.fill();
    ctx.lineWidth = 1.8+lvl*0.25;
    ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#16290d';
    ctx.stroke();
  });
  ctx.restore();

  // damlayan zehir
  for(let i=0;i<2+lvl;i++){
    const cyc = (t0*0.7 + i*0.4) % 1;
    const dx = x - 8 + i*(16/(1+lvl));
    ctx.beginPath();
    ctx.ellipse(dx, y-24+cyc*26, 1.8, 2.8, 0, 0, Math.PI*2);
    ctx.fillStyle = `rgba(160,225,90,${0.75*(1-cyc)})`;
    ctx.fill();
  }

  ctx.beginPath(); ctx.arc(x, y-10, 3+lvl*0.4+((t.pulse||0)*2), 0, Math.PI*2);
  ctx.fillStyle='#d9ff9e'; ctx.shadowColor='#9fdc5c'; ctx.shadowBlur=10+lvl*3; ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
}

/* ŞİMŞEK DİREĞİ — metal direk, tepesinde çatallı bobin ve kıvılcımlar */
function drawBoltTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.3;
  const t0 = performance.now()/1000;
  const lvl = t.level||0;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  // direk
  const g = ctx.createLinearGradient(x-7,y-34,x+7,y+4);
  g.addColorStop(0,'#8d93a1'); g.addColorStop(0.5,'#5a6070'); g.addColorStop(1,'#3a3f4c');
  ctx.fillStyle=g; ctx.strokeStyle='#1d2029'; ctx.lineWidth=2.5;
  roundedRect(x-7,y-34,14,38,4); ctx.fill(); ctx.stroke();
  // yatay kuşaklar
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.4;
  [-26,-16,-6].forEach(dy=>{
    ctx.beginPath(); ctx.moveTo(x-7,y+dy); ctx.lineTo(x+7,y+dy); ctx.stroke();
  });

  // tepedeki bobin
  ctx.save(); ctx.translate(x,y-34); ctx.scale(pulse,pulse);
  for(let i=0;i<3;i++){
    ctx.beginPath();
    ctx.ellipse(0, -4-i*4, 9-i*1.6, 3.2, 0, 0, Math.PI*2);
    ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#c9a34a';
    ctx.lineWidth=2; ctx.stroke();
  }
  // çatallı uçlar — hedefe doğru yelpaze açar
  const aim = (t.aimAngle !== undefined) ? t.aimAngle : -Math.PI/2;
  const prongs = 3 + Math.min(lvl,2);
  for(let i=0;i<prongs;i++){
    const a = aim + (i-(prongs-1)/2)*0.42;
    ctx.beginPath();
    ctx.moveTo(0,-14);
    ctx.lineTo(Math.cos(a)*11, -14+Math.sin(a)*11);
    ctx.strokeStyle='#b9c4d6'; ctx.lineWidth=2.2; ctx.stroke();
    ctx.beginPath();
    ctx.arc(Math.cos(a)*11, -14+Math.sin(a)*11, 2, 0, Math.PI*2);
    ctx.fillStyle='#fff3a8'; ctx.shadowColor='#ffe066'; ctx.shadowBlur=8; ctx.fill();
    ctx.shadowBlur=0;
  }
  // merkez çekirdek
  ctx.beginPath(); ctx.arc(0,-16,4+lvl*0.6+((t.pulse||0)*3),0,Math.PI*2);
  ctx.fillStyle='#fffbe0'; ctx.shadowColor='#ffe066'; ctx.shadowBlur=16+lvl*4; ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();

  // etrafta çakan kıvılcımlar
  for(let i=0;i<2+lvl;i++){
    if(((t0*7 + i*2.3) % 3) > 0.4) continue;   // aralıklı çaksın
    const a = t0*3 + i*2.1;
    const r = 14+Math.sin(t0*5+i)*4;
    ctx.beginPath();
    ctx.moveTo(x, y-34);
    ctx.lineTo(x+Math.cos(a)*r, y-34+Math.sin(a)*r);
    ctx.strokeStyle='rgba(255,240,150,0.8)'; ctx.lineWidth=1.4; ctx.stroke();
  }
  ctx.restore();
}

function drawMortarTower(t){
  const {x,y}=t;
  const t0 = performance.now()/1000;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x,y+18,22,8,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fill();

  // tekerlekler (jant çubuklu)
  [-16,16].forEach(dx=>{
    ctx.beginPath(); ctx.arc(x+dx,y+14,7,0,Math.PI*2);
    ctx.fillStyle='#3d2a18'; ctx.fill(); ctx.strokeStyle='#1a0f07'; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){
      const a=i*(Math.PI*2/5);
      ctx.beginPath(); ctx.moveTo(x+dx,y+14); ctx.lineTo(x+dx+Math.cos(a)*6,y+14+Math.sin(a)*6); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x+dx,y+14,2,0,Math.PI*2);
    ctx.fillStyle='#6b4a2e'; ctx.fill();
  });

  // cephane yığını (kule arkasında)
  [[-21,10],[-25,13]].forEach(([dx,dy],i)=>{
    ctx.beginPath(); ctx.arc(x+dx,y+dy,4.5,0,Math.PI*2);
    ctx.fillStyle='#3a3530'; ctx.fill(); ctx.strokeStyle='#1a1a17'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+dx,y+dy-4.5); ctx.lineTo(x+dx-2,y+dy-7);
    ctx.strokeStyle='#7a5a30'; ctx.lineWidth=1; ctx.stroke();
  });

  // gövde (perçinli)
  const lvl = t.level||0;
  const grad=ctx.createRadialGradient(x-6,y-2,3,x,y+4,22);
  grad.addColorStop(0, brightenColor('#eeb27a', lvl));
  grad.addColorStop(0.6, brightenColor('#c9793f', lvl));
  grad.addColorStop(1, brightenColor('#8a4a20', lvl));
  ctx.beginPath(); ctx.ellipse(x,y+4,20,15,0,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill();
  ctx.lineWidth = 2.5 + lvl*0.4;
  ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#3f2410';
  ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.ellipse(x,y+7,16,6,0,0,Math.PI); ctx.stroke();
  const rivets = [[-13,4],[13,4],[0,13],[-9,11],[9,11]];
  if(lvl>=1) rivets.push([-16,-2],[16,-2]);
  if(lvl>=2) rivets.push([-6,-8],[6,-8]);
  rivets.forEach(([dx,dy])=>{
    ctx.beginPath(); ctx.arc(x+dx,y+dy,1.4,0,Math.PI*2);
    ctx.fillStyle = lvl>=2 ? '#f4c04a' : '#5c3a1e'; ctx.fill();
  });

  // fener
  ctx.save(); ctx.translate(x+17,y-4);
  ctx.strokeStyle='#3a2410'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,0); ctx.stroke();
  const lanternFlicker = 0.7+Math.sin(t0*6)*0.15;
  ctx.beginPath(); ctx.arc(0,2,4,0,Math.PI*2);
  ctx.fillStyle=`rgba(255,180,80,${lanternFlicker})`; ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=8; ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='#2a1a0c'; ctx.lineWidth=1.4; ctx.stroke();
  ctx.restore();

  // namlu — hedefe döner, seviye arttıkça uzar
  const aim = (t.aimAngle !== undefined) ? t.aimAngle : (t.angle !== undefined ? t.angle : -Math.PI/2);
  const barrelLen = 26 + lvl*3;
  ctx.save();
  ctx.translate(x, y-4);
  // Namlu varsayılan olarak yukarı bakar (-PI/2); hedef açısına döndür
  ctx.rotate(aim + Math.PI/2);
  // Geri tepme: ateş ettikten hemen sonra namlu içeri çekilir
  const recoil = (t.pulse||0) * 4;
  ctx.translate(0, recoil);
  const barrelGrad = ctx.createLinearGradient(-6,-barrelLen,6,0);
  barrelGrad.addColorStop(0,'#5c5c56'); barrelGrad.addColorStop(0.5,'#3a3a34'); barrelGrad.addColorStop(1,'#4a4a44');
  ctx.fillStyle=barrelGrad;
  ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#1a1a17';
  ctx.lineWidth = 2.5 + lvl*0.3;
  roundedRect(-6,-barrelLen,12,barrelLen,4); ctx.fill(); ctx.stroke();
  // namlu bantları
  ctx.strokeStyle='rgba(180,150,90,0.5)'; ctx.lineWidth=2;
  for(let i=0;i<2+lvl;i++){
    const by = -18 - i*6;
    if(by > -barrelLen+3){
      ctx.beginPath(); ctx.moveTo(-6,by); ctx.lineTo(6,by); ctx.stroke();
    }
  }
  // namlu ağzı
  ctx.beginPath();
  ctx.ellipse(0, -barrelLen, 6, 2.4, 0, 0, Math.PI*2);
  ctx.fillStyle='#22221f'; ctx.fill();
  // ateş parlaması
  if((t.pulse||0) > 0.55){
    const f = (t.pulse-0.55)/0.45;
    ctx.beginPath();
    ctx.moveTo(-7*f, -barrelLen);
    ctx.lineTo(0, -barrelLen - 16*f);
    ctx.lineTo(7*f, -barrelLen);
    ctx.closePath();
    ctx.fillStyle='rgba(255,190,90,'+(0.85*f)+')';
    ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=14; ctx.fill(); ctx.shadowBlur=0;
  }
  ctx.restore();

  // sürekli tüten duman — seviye ile artar
  for(let i=0;i<3+lvl;i++){
    const cyc = (t0*0.5+i*0.34)%1;
    const sx = x+Math.sin(t0+i)*4, sy = y-24-cyc*22;
    ctx.beginPath(); ctx.arc(sx,sy,3+cyc*4,0,Math.PI*2);
    ctx.fillStyle=`rgba(180,180,175,${0.28*(1-cyc)})`; ctx.fill();
  }

  ctx.beginPath(); ctx.arc(x,y-16,2+lvl*0.4+(t.pulse||0)*2,0,Math.PI*2);
  ctx.fillStyle='#ffb84a'; ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=8+lvl*3; ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
}

/* İnşa/yükseltme sırasında kulenin üzerinde dönen dairesel ilerleme
   göstergesi + kalan süre. */
function drawBuildProgress(t){
  const dur = t.buildDuration || 1;
  const p = Math.max(0, Math.min(1 - (t.buildLeft / dur), 1));
  const R = 20;
  ctx.save();

  // arka halka
  ctx.beginPath(); ctx.arc(t.x, t.y, R, 0, Math.PI*2);
  ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=5; ctx.stroke();

  // dolan yay
  ctx.beginPath();
  ctx.arc(t.x, t.y, R, -Math.PI/2, -Math.PI/2 + p*Math.PI*2);
  ctx.strokeStyle = t.pendingLevel ? '#f4c04a' : '#7fe3b4';
  ctx.lineWidth = 5; ctx.lineCap='round';
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // dönen parlak uç
  const tipAng = -Math.PI/2 + p*Math.PI*2;
  ctx.beginPath();
  ctx.arc(t.x+Math.cos(tipAng)*R, t.y+Math.sin(tipAng)*R, 3, 0, Math.PI*2);
  ctx.fillStyle='#ffffff'; ctx.fill();

  // kalan süre
  const remain = Math.ceil(t.buildLeft);
  ctx.font='700 13px "Baloo 2", sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#ffffff';
  ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=4;
  ctx.fillText(remain+'s', t.x, t.y+1);
  ctx.restore();
}

/* Menzil halkası — düşmanlardan ÖNCE (zeminin üstüne) çizilir ki
   yarı saydam dolgu düşmanların üstünü kapatmasın. */
/* Boss'un taşıdığı don fırtınası — zemin katmanında, düşmanlardan
   önce çizilir ki içindeki birimlerin üstünü kapatmasın. */
function drawBossAura(e){
  if(!e.auraRadius) return;
  const t0 = performance.now()/1000;
  ctx.save();
  const R = e.auraRadius;

  const g = ctx.createRadialGradient(e.x,e.y,R*0.2,e.x,e.y,R);
  g.addColorStop(0,'rgba(150,220,245,0.03)');
  g.addColorStop(0.7,'rgba(120,200,235,0.10)');
  g.addColorStop(1,'rgba(90,170,215,0.02)');
  ctx.beginPath(); ctx.arc(e.x,e.y,R,0,Math.PI*2);
  ctx.fillStyle=g; ctx.fill();

  // içerideki savrulan kar — sınırı çember yerine bu belirtir
  for(let i=0;i<18;i++){
    const ang = t0*0.5 + i*(Math.PI*2/18);
    const rr = R*(0.35 + ((t0*0.25+i*0.11)%1)*0.62);
    const sx = e.x+Math.cos(ang)*rr, sy = e.y+Math.sin(ang)*rr;
    ctx.beginPath(); ctx.arc(sx,sy,1.6,0,Math.PI*2);
    ctx.fillStyle='rgba(230,250,255,0.55)'; ctx.fill();
  }
  ctx.restore();
}

/* Etki altındaki kulenin üstünde donma göstergesi */
function drawChillBadge(t){
  if(!t.chilled) return;
  const t0 = performance.now()/1000;
  ctx.save();
  ctx.beginPath(); ctx.arc(t.x, t.y, 24, 0, Math.PI*2);
  ctx.strokeStyle='rgba(160,225,250,'+(0.5+Math.sin(t0*4)*0.2)+')';
  ctx.lineWidth=2; ctx.setLineDash([3,4]); ctx.lineDashOffset=t0*10;
  ctx.stroke(); ctx.setLineDash([]);
  ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('❄', t.x, t.y-30);
  ctx.restore();
}

function drawTowerRange(t){
  const isSelected = towerPanelOpen && selectedTower===t;
  const showRing = isSelected || activeTowerRing===t;
  if(!showRing) return;
  const st = getTowerStats(t);
  ctx.save();
  ctx.beginPath(); ctx.arc(t.x,t.y,st.range,0,Math.PI*2);
  ctx.fillStyle = t.def.color+'30';
  ctx.fill();
  ctx.shadowColor = t.def.color; ctx.shadowBlur = 16;
  ctx.strokeStyle = t.def.color;
  ctx.lineWidth = 3;
  ctx.setLineDash([8,6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(t.x,t.y,st.range,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1;
  ctx.stroke();
  ctx.restore();
}

/* Kule gövdesi — düşmanlardan SONRA çizilir, böylece kuleler
   her zaman düşmanların önünde görünür. */
function drawTower(t){
  ctx.save();
  // İnşa halindeyken kule yarı saydam çizilir (henüz aktif değil)
  const building = t.buildLeft > 0;
  if(building) ctx.globalAlpha = 0.45;
  ctx.translate(t.x, t.y);
  ctx.scale(TOWER_VISUAL_SCALE * towerLevelScale(t), TOWER_VISUAL_SCALE * towerLevelScale(t));
  ctx.translate(-t.x, -t.y);
  if(t.def.kind==='archer') drawArcherTower(t);
  else if(t.def.kind==='mage') drawMageTower(t);
  else if(t.def.kind==='ice') drawIceTower(t);
  else if(t.def.kind==='poison') drawPoisonTower(t);
  else if(t.def.kind==='bolt') drawBoltTower(t);
  else drawMortarTower(t);
  ctx.restore();

  if(building) drawBuildProgress(t);
  else drawLevelAura(t);

  const lvl = t.level||0;
  if(lvl>0){
    ctx.save();
    for(let i=0;i<3;i++){
      ctx.beginPath(); ctx.arc(t.x-8+i*8, t.y+24, 2.6, 0, Math.PI*2);
      ctx.fillStyle = i<lvl ? '#f4c04a' : 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.strokeStyle='#0d1a10'; ctx.lineWidth=1; ctx.stroke();
    }
    ctx.restore();
  }

  if(towerPanelOpen && selectedTower===t){
    ctx.save();
    const pulse = 2+Math.sin(performance.now()/200)*1.5;
    ctx.beginPath(); ctx.arc(t.x,t.y,26+pulse,0,Math.PI*2);
    ctx.strokeStyle='#f4c04a'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  if(pressProgressTower===t){
    const p = Math.min((performance.now()-pressProgressStart)/LONG_PRESS_MS, 1);
    if(p>0.06){
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, 28, -Math.PI/2, -Math.PI/2 + p*Math.PI*2);
      ctx.strokeStyle='#f4c04a'; ctx.lineWidth=3.5; ctx.lineCap='round';
      ctx.shadowColor='#f4c04a'; ctx.shadowBlur=10;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/* BÜYÜK BOSS — buzdan taçlı, ağır adımlı bir dev.
   Diğer düşmanlardan bariz şekilde ayrışsın diye çok daha büyük,
   kristal zırhlı ve kendi ışığını yayan bir siluet. */
function drawBossEnemy(e){
  const t0 = performance.now()/1000;
  const R = e.radius;
  const bob = Math.sin(e.bounce*0.7)*3;
  const flash = Math.max(0, e.flashT||0) > 0.05;

  ctx.save();
  ctx.translate(e.x, e.y + bob);

  // gölge
  ctx.beginPath(); ctx.ellipse(0, R+10, R*0.9, R*0.3, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();

  // bacaklar
  const legPhase = Math.sin(e.bounce*0.9)*5;
  [[-R*0.45, legPhase],[R*0.45, -legPhase]].forEach(([dx,ph])=>{
    ctx.beginPath();
    ctx.ellipse(dx, R*0.78+ph*0.25, R*0.3, R*0.2, 0, 0, Math.PI*2);
    ctx.fillStyle=e.body2; ctx.fill();
    ctx.strokeStyle='#12303f'; ctx.lineWidth=2; ctx.stroke();
  });

  // omuz kristalleri
  [[-1,0.9],[1,0.9],[-1,0.45],[1,0.45]].forEach(([s,h])=>{
    const cx=s*R*0.85, cy=-R*h*0.45, sz=R*0.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy-sz); ctx.lineTo(cx-sz*0.5, cy+sz*0.55); ctx.lineTo(cx+sz*0.5, cy+sz*0.55);
    ctx.closePath();
    const cg=ctx.createLinearGradient(cx,cy-sz,cx,cy+sz*0.55);
    cg.addColorStop(0,'#ffffff'); cg.addColorStop(1,'#4a90b5');
    ctx.fillStyle=cg; ctx.fill();
    ctx.strokeStyle='#12303f'; ctx.lineWidth=1.8; ctx.stroke();
  });

  // gövde
  const bg = ctx.createRadialGradient(-R*0.3,-R*0.35,4,0,0,R);
  bg.addColorStop(0, flash ? '#ffffff' : '#d8f4ff');
  bg.addColorStop(0.4, flash ? '#ffffff' : e.body);
  bg.addColorStop(1, e.body2);
  ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2);
  ctx.fillStyle=bg; ctx.fill();
  ctx.lineWidth=3.5; ctx.strokeStyle='#0e2836'; ctx.stroke();

  // zırh çatlakları
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.5;
  [[-0.5,-0.2,-0.1,0.4],[0.35,-0.35,0.15,0.3],[0.1,-0.6,-0.15,-0.1]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1*R,y1*R); ctx.lineTo(x2*R,y2*R); ctx.stroke();
  });

  // taç
  ctx.save(); ctx.translate(0,-R*0.95);
  for(let i=-2;i<=2;i++){
    const h = (i===0?1.5:(Math.abs(i)===1?1.15:0.8))*R*0.42;
    const x = i*R*0.34;
    ctx.beginPath();
    ctx.moveTo(x, -h); ctx.lineTo(x-R*0.13, R*0.1); ctx.lineTo(x+R*0.13, R*0.1);
    ctx.closePath();
    const g=ctx.createLinearGradient(x,-h,x,R*0.1);
    g.addColorStop(0,'#ffffff'); g.addColorStop(1,'#5fa8cc');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#0e2836'; ctx.lineWidth=1.8; ctx.stroke();
  }
  ctx.restore();

  // gözler
  const eyeY = -R*0.12;
  [-1,1].forEach(s=>{
    ctx.beginPath(); ctx.ellipse(s*R*0.3, eyeY, R*0.17, R*0.2, 0, 0, Math.PI*2);
    ctx.fillStyle='#ffffff'; ctx.fill();
    ctx.strokeStyle='#0e2836'; ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.arc(s*R*0.3, eyeY+R*0.03, R*0.08, 0, Math.PI*2);
    ctx.fillStyle='#1b4a63'; ctx.fill();
    // parıltı
    ctx.beginPath(); ctx.arc(s*R*0.3, eyeY, R*0.055, 0, Math.PI*2);
    ctx.fillStyle='#8fe6ff'; ctx.shadowColor='#8fe6ff'; ctx.shadowBlur=8; ctx.fill();
    ctx.shadowBlur=0;
  });
  // kaşlar
  ctx.strokeStyle='#0e2836'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-R*0.55,eyeY-R*0.32); ctx.lineTo(-R*0.12,eyeY-R*0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(R*0.55,eyeY-R*0.32); ctx.lineTo(R*0.12,eyeY-R*0.12); ctx.stroke();

  // etrafında dönen buz parçaları
  for(let i=0;i<5;i++){
    const ang = t0*0.9 + i*(Math.PI*2/5);
    const rr = R+16+Math.sin(t0*2+i)*4;
    ctx.save();
    ctx.translate(Math.cos(ang)*rr, Math.sin(ang)*rr*0.7);
    ctx.rotate(t0*2+i);
    ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(-3,3); ctx.lineTo(3,3); ctx.closePath();
    ctx.fillStyle='rgba(220,248,255,0.85)'; ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // BOSS can barı — normalden büyük (isim yazısı yok, sahneyi kapatmasın)
  const w = R*2.6;
  ctx.save();
  ctx.translate(e.x, e.y + bob);
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(-w/2, -R-20, w, 7);
  const frac = Math.max(0, e.hp/e.maxHp);
  const hg = ctx.createLinearGradient(-w/2,0,w/2,0);
  hg.addColorStop(0,'#ff6b6b'); hg.addColorStop(1,'#ffd36b');
  ctx.fillStyle=hg;
  ctx.fillRect(-w/2, -R-20, w*frac, 7);
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1.5;
  ctx.strokeRect(-w/2, -R-20, w, 7);
  ctx.restore();
}

/* KÜP — dönen, titreyen kare düşman. Bölündükçe küçülür.
   Kalan bölünme hakkı köşelerdeki noktalarla gösterilir. */
function drawCubeEnemy(e){
  const R = e.radius;
  const flash = Math.max(0, e.flashT||0) > 0.05;
  const spin = e.spin || 0;
  const jitter = Math.sin((e.wobbleT||0)*5.3)*R*0.05;

  ctx.save();
  ctx.translate(e.x, e.y);

  ctx.beginPath();
  ctx.ellipse(0, R+4, R*0.8, R*0.25, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();

  ctx.rotate(spin);
  const s = R*1.55;

  const g = ctx.createLinearGradient(-s/2,-s/2,s/2,s/2);
  g.addColorStop(0, flash ? '#ffffff' : '#ffd9a8');
  g.addColorStop(0.45, flash ? '#ffffff' : e.body);
  g.addColorStop(1, e.body2);
  ctx.fillStyle = g;
  ctx.strokeStyle = '#4a2308';
  ctx.lineWidth = Math.max(1.6, R*0.11);
  roundedRect(-s/2+jitter, -s/2, s, s, Math.max(2, R*0.18));
  ctx.fill(); ctx.stroke();

  // yüzey çizgileri
  ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-s/2, -s*0.15); ctx.lineTo(s/2, -s*0.15); ctx.stroke();

  // kalan bölünme hakkı: köşe noktaları
  if(e.splitsLeft > 0){
    const c = s/2 - R*0.22;
    const corners = [[-c,-c],[c,-c],[-c,c],[c,c]].slice(0, e.splitsLeft+1);
    corners.forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.arc(cx,cy,Math.max(1.2,R*0.09),0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fill();
    });
  }

  // gözler (dönüşe karşı sabit dursun ki hep bize baksın)
  ctx.rotate(-spin);
  const eyeR = Math.max(1.6, R*0.2);
  const eyeY = -R*0.1;
  [-1,1].forEach(sd=>{
    ctx.beginPath(); ctx.arc(sd*R*0.34, eyeY, eyeR, 0, Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle='#4a2308'; ctx.lineWidth=Math.max(1, R*0.06); ctx.stroke();
    // bebek göz salınıma göre kayar — "deli" bakış
    const px = Math.sin((e.wobbleT||0)*2.2)*eyeR*0.35;
    ctx.beginPath(); ctx.arc(sd*R*0.34+px, eyeY+eyeR*0.12, eyeR*0.45, 0, Math.PI*2);
    ctx.fillStyle='#2b1608'; ctx.fill();
  });
  // çatık kaşlar
  if(R > 9){
    ctx.strokeStyle='#4a2308'; ctx.lineWidth=Math.max(1.2, R*0.09);
    ctx.beginPath(); ctx.moveTo(-R*0.62, eyeY-R*0.42); ctx.lineTo(-R*0.16, eyeY-R*0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R*0.62, eyeY-R*0.42); ctx.lineTo(R*0.16, eyeY-R*0.2); ctx.stroke();
  }

  // buz etkisi
  if(e.slowT>0){
    ctx.beginPath(); ctx.arc(0,0,R+2,0,Math.PI*2);
    ctx.fillStyle='rgba(180,235,255,0.35)'; ctx.fill();
  }
  ctx.restore();

  // can barı
  const w = R*2.1;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-w/2, -R-13, w, 4);
  ctx.fillStyle='#7fe3b4'; ctx.fillRect(-w/2, -R-13, w*(e.hp/e.maxHp), 4);
  ctx.restore();
}

/* ŞİŞE — cam gövdeli, içinde çalkalanan sıvı taşıyan düşman.
   Öldüğünde yere iyileştirme birikintisi bırakır. */
function drawFlaskEnemy(e){
  const t0 = performance.now()/1000;
  const R = e.radius;
  const bob = Math.sin(e.bounce)*2.5;
  const flash = Math.max(0,e.flashT||0) > 0.05;

  ctx.save();
  ctx.translate(e.x, e.y + Math.abs(bob));

  ctx.beginPath(); ctx.ellipse(0, R+5, R*0.75, R*0.26, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();

  // bacaklar
  const leg = Math.sin(e.bounce*1.4)*3;
  ctx.fillStyle=e.body2;
  ctx.beginPath(); ctx.ellipse(-R*0.36, R*0.78+leg*0.3, R*0.26, R*0.17,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(R*0.36, R*0.78-leg*0.3, R*0.26, R*0.17,0,0,Math.PI*2); ctx.fill();

  // şişe gövdesi (yuvarlak alt + dar boyun)
  ctx.beginPath();
  ctx.moveTo(-R*0.26, -R*0.95);
  ctx.lineTo(-R*0.26, -R*0.45);
  ctx.quadraticCurveTo(-R*1.02, -R*0.15, -R*0.78, R*0.55);
  ctx.quadraticCurveTo(-R*0.5, R*1.0, 0, R*1.0);
  ctx.quadraticCurveTo(R*0.5, R*1.0, R*0.78, R*0.55);
  ctx.quadraticCurveTo(R*1.02, -R*0.15, R*0.26, -R*0.45);
  ctx.lineTo(R*0.26, -R*0.95);
  ctx.closePath();

  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, flash ? '#ffffff' : 'rgba(215,245,230,0.92)');
  g.addColorStop(1, flash ? '#ffffff' : 'rgba(150,205,180,0.85)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#1e4a34'; ctx.stroke();

  // içindeki sıvı — can oranına göre doluluk, hafif çalkalanma
  const fill = Math.max(0.12, e.hp/e.maxHp);
  const surface = R*1.0 - (R*1.45)*fill;
  const wob = Math.sin(t0*3 + e.bounce)*1.6;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-R*0.26, -R*0.95);
  ctx.lineTo(-R*0.26, -R*0.45);
  ctx.quadraticCurveTo(-R*1.02, -R*0.15, -R*0.78, R*0.55);
  ctx.quadraticCurveTo(-R*0.5, R*1.0, 0, R*1.0);
  ctx.quadraticCurveTo(R*0.5, R*1.0, R*0.78, R*0.55);
  ctx.quadraticCurveTo(R*1.02, -R*0.15, R*0.26, -R*0.45);
  ctx.lineTo(R*0.26, -R*0.95);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-R*1.2, surface+wob);
  ctx.quadraticCurveTo(0, surface-wob*2, R*1.2, surface+wob);
  ctx.lineTo(R*1.2, R*1.3); ctx.lineTo(-R*1.2, R*1.3);
  ctx.closePath();
  ctx.fillStyle = e.body; ctx.fill();
  // kabarcıklar
  for(let i=0;i<3;i++){
    const cyc=(t0*0.8+i*0.33)%1;
    const bx=(i-1)*R*0.3;
    const by=R*0.9 - cyc*(R*0.9-surface);
    if(by>surface){
      ctx.beginPath(); ctx.arc(bx,by,1.4,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
    }
  }
  ctx.restore();

  // cam parlaması
  ctx.beginPath();
  ctx.moveTo(-R*0.5, -R*0.1); ctx.quadraticCurveTo(-R*0.66, R*0.35, -R*0.42, R*0.65);
  ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2; ctx.stroke();

  // mantar tıpa
  ctx.fillStyle='#a9763f'; ctx.strokeStyle='#5c3a1c'; ctx.lineWidth=1.6;
  roundedRect(-R*0.34, -R*1.3, R*0.68, R*0.42, 2); ctx.fill(); ctx.stroke();

  // gözler
  const eyeY = R*0.28;
  [-1,1].forEach(s=>{
    ctx.beginPath(); ctx.arc(s*R*0.28, eyeY, R*0.16, 0, Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle='#1e4a34'; ctx.lineWidth=1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(s*R*0.28+s*0.8, eyeY+0.8, R*0.07, 0, Math.PI*2);
    ctx.fillStyle='#1e4a34'; ctx.fill();
  });

  ctx.restore();

  // can barı
  const w=R*2.1;
  ctx.save();
  ctx.translate(e.x, e.y + Math.abs(bob));
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-w/2,-R-14,w,4);
  ctx.fillStyle='#7fe3b4'; ctx.fillRect(-w/2,-R-14,w*(e.hp/e.maxHp),4);
  ctx.restore();
}

/* Kırılan şişelerin bıraktığı iyileştirme birikintisi */
function drawHealZones(){
  if(!healZones || !healZones.length) return;
  const t0 = performance.now()/1000;
  ctx.save();
  healZones.forEach(z=>{
    // Ömrü dolarken soluklaşsın
    const fade = Math.min(1, z.life / 3);      // son 3 sn'de sön
    const R = z.r;

    const g = ctx.createRadialGradient(z.x,z.y,R*0.15,z.x,z.y,R);
    g.addColorStop(0, 'rgba(140,240,190,'+(0.30*fade)+')');
    g.addColorStop(0.7,'rgba(90,205,150,'+(0.20*fade)+')');
    g.addColorStop(1, 'rgba(60,160,115,'+(0.05*fade)+')');
    ctx.beginPath(); ctx.arc(z.x,z.y,R,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();

    // kenar halkası
    ctx.beginPath(); ctx.arc(z.x,z.y,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(170,250,205,'+(0.5*fade)+')';
    ctx.lineWidth=2; ctx.setLineDash([6,5]); ctx.lineDashOffset=t0*10;
    ctx.stroke(); ctx.setLineDash([]);

    // yükselen kabarcıklar
    for(let i=0;i<7;i++){
      const cyc = (t0*0.55 + i*0.14) % 1;
      const ang = i*(Math.PI*2/7) + t0*0.3;
      const rr = R*0.65*(0.3+((i*0.17)%1)*0.7);
      const bx = z.x + Math.cos(ang)*rr;
      const by = z.y + Math.sin(ang)*rr*0.6 - cyc*16;
      ctx.beginPath(); ctx.arc(bx,by,1.6*(1-cyc*0.5),0,Math.PI*2);
      ctx.fillStyle='rgba(210,255,230,'+(0.65*(1-cyc)*fade)+')';
      ctx.fill();
    }

    // kalan süre göstergesi (son 10 sn)
    if(z.life <= 10){
      ctx.font='700 11px "Baloo 2", sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(200,255,225,'+(0.75*fade)+')';
      ctx.fillText(Math.ceil(z.life)+'s', z.x, z.y);
    }
  });
  ctx.restore();
}

function drawEnemy(e){
  if(e.shape==='boss'){ drawBossEnemy(e); return; }
  if(e.shape==='cube'){ drawCubeEnemy(e); return; }
  if(e.shape==='flask'){ drawFlaskEnemy(e); return; }
  const bob = Math.sin(e.bounce)*3;
  const squash = 1 - Math.abs(Math.sin(e.bounce))*0.12;
  ctx.save();
  ctx.translate(e.x, e.y+Math.abs(bob));
  ctx.beginPath(); ctx.ellipse(0, e.radius+6, e.radius*0.8, e.radius*0.28, 0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();

  ctx.save(); ctx.scale(1/squash, squash);
  const flashAmt = Math.max(0,e.flashT||0);
  const bodyColor = flashAmt>0.05 ? '#ffffff' : e.body;

  if(e.shape==='brute'){
    [[-9,4],[9,4]].forEach(([dx,dy])=>{
      ctx.beginPath(); ctx.moveTo(dx-6,dy+e.radius*0.2); ctx.lineTo(dx,dy-e.radius*0.9); ctx.lineTo(dx+6,dy+e.radius*0.2); ctx.closePath();
      ctx.fillStyle=e.body2; ctx.fill(); ctx.strokeStyle='#1a0f1e'; ctx.lineWidth=1.5; ctx.stroke();
    });
  }

  const grad=ctx.createRadialGradient(-e.radius*0.3,-e.radius*0.3,2,0,0,e.radius);
  grad.addColorStop(0,'#fff'); grad.addColorStop(0.15,bodyColor); grad.addColorStop(1,e.body2);
  ctx.beginPath(); ctx.arc(0,0,e.radius,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.lineWidth=2.5; ctx.strokeStyle='#241a10'; ctx.fill(); ctx.stroke();

  if(e.slowT>0){
    ctx.beginPath(); ctx.arc(0,0,e.radius+2,0,Math.PI*2);
    ctx.fillStyle='rgba(180,235,255,0.35)'; ctx.fill();
    ctx.strokeStyle='rgba(230,250,255,0.8)'; ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){
      const ang=i*(Math.PI*2/3)+e.bounce;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang)*e.radius*0.3,Math.sin(ang)*e.radius*0.3);
      ctx.lineTo(Math.cos(ang)*e.radius*0.9,Math.sin(ang)*e.radius*0.9);
      ctx.stroke();
    }
  }

  // İYİLEŞME: birikinti içindeyken yeşil parıltı ve yükselen artılar
  if(e.healedT > 0){
    const t0 = performance.now()/1000;
    ctx.beginPath(); ctx.arc(0,0,e.radius+3,0,Math.PI*2);
    ctx.fillStyle='rgba(130,240,180,0.30)'; ctx.fill();
    ctx.font='700 10px "Baloo 2", sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(180,255,210,0.9)';
    ctx.fillText('+', 0, -e.radius - 6 - ((t0*20)%10));
  }

  // ZEHİR: yükselen yeşil kabarcıklar
  if(e.poisonT > 0){
    const t0 = performance.now()/1000;
    ctx.beginPath(); ctx.arc(0,0,e.radius+1,0,Math.PI*2);
    ctx.fillStyle='rgba(150,220,80,0.28)'; ctx.fill();
    for(let i=0;i<3;i++){
      const cyc = (t0*1.1 + i*0.33) % 1;
      const bx = (i-1)*e.radius*0.45;
      const by = -cyc*(e.radius+10);
      ctx.beginPath(); ctx.arc(bx, by, 1.6*(1-cyc*0.5), 0, Math.PI*2);
      ctx.fillStyle=`rgba(180,240,110,${0.8*(1-cyc)})`; ctx.fill();
    }
  }

  const legPhase = Math.sin(e.bounce*1.4)*4;
  ctx.fillStyle=e.body2;
  ctx.beginPath(); ctx.ellipse(-e.radius*0.4, e.radius*0.75+legPhase*0.3, e.radius*0.28, e.radius*0.18,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(e.radius*0.4, e.radius*0.75-legPhase*0.3, e.radius*0.28, e.radius*0.18,0,0,Math.PI*2); ctx.fill();

  const eyeY = -e.radius*0.15;
  if(e.eyes===1){
    ctx.beginPath(); ctx.arc(0,eyeY,e.radius*0.32,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#241a10'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(1,eyeY+1,e.radius*0.14,0,Math.PI*2); ctx.fillStyle='#241a10'; ctx.fill();
  } else {
    [-1,1].forEach(s=>{
      ctx.beginPath(); ctx.arc(s*e.radius*0.32,eyeY,e.radius*0.22,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#241a10'; ctx.lineWidth=1.3; ctx.stroke();
      ctx.beginPath(); ctx.arc(s*e.radius*0.32+s*1,eyeY+1,e.radius*0.1,0,Math.PI*2); ctx.fillStyle='#241a10'; ctx.fill();
    });
    if(e.shape==='brute'){
      ctx.strokeStyle='#241a10'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-e.radius*0.55,eyeY-e.radius*0.35); ctx.lineTo(-e.radius*0.15,eyeY-e.radius*0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.radius*0.55,eyeY-e.radius*0.35); ctx.lineTo(e.radius*0.15,eyeY-e.radius*0.15); ctx.stroke();
    }
  }
  ctx.restore();

  const w=e.radius*2.1;
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-w/2,-e.radius-14,w,4);
  ctx.fillStyle='#7fe3b4'; ctx.fillRect(-w/2,-e.radius-14,w*(e.hp/e.maxHp),4);
  ctx.restore();
}

function drawProjectile(p){
  ctx.save();
  if(p.kind==='mortar'){
    const remaining = Math.hypot(p.target.x-p.x, p.target.y-p.y);
    const progress = p.travel>0 ? 1-Math.min(remaining/p.travel,1) : 1;
    const arc = Math.sin(progress*Math.PI)*46;
    ctx.beginPath(); ctx.ellipse(p.x,p.y,5,2.5,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y-arc,6,0,Math.PI*2);
    ctx.fillStyle='#3a3530'; ctx.shadowColor='#000'; ctx.shadowBlur=4; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x-1,p.y-arc-6,1.8,0,Math.PI*2);
    ctx.fillStyle='#ffb84a'; ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=8; ctx.fill();
  } else if(p.kind==='mage'){
    ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,Math.PI*2);
    ctx.fillStyle='#bdf5e4'; ctx.shadowColor='#4fc3a1'; ctx.shadowBlur=14; ctx.fill();
  } else if(p.kind==='ice'){
    const ang = Math.atan2(p.target.y-p.y, p.target.x-p.x);
    ctx.translate(p.x,p.y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(6,0); ctx.lineTo(-3,-3); ctx.lineTo(-6,0); ctx.lineTo(-3,3); ctx.closePath();
    const g=ctx.createLinearGradient(-6,0,6,0);
    g.addColorStop(0,'#8fd9f0'); g.addColorStop(1,'#ffffff');
    ctx.fillStyle=g; ctx.shadowColor='#8fd9f0'; ctx.shadowBlur=10; ctx.fill();
  } else if(p.kind==='poison'){
    const t0 = performance.now()/1000;
    ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,Math.PI*2);
    ctx.fillStyle='#b9ea78'; ctx.shadowColor='#9fdc5c'; ctx.shadowBlur=12; ctx.fill();
    ctx.shadowBlur=0;
    for(let i=0;i<2;i++){
      const a=t0*6+i*Math.PI;
      ctx.beginPath(); ctx.arc(p.x+Math.cos(a)*5, p.y+Math.sin(a)*5, 1.5, 0, Math.PI*2);
      ctx.fillStyle='rgba(200,245,140,0.7)'; ctx.fill();
    }
  } else if(p.kind==='bolt'){
    const ang = Math.atan2(p.target.y-p.y, p.target.x-p.x);
    ctx.translate(p.x,p.y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-10,0); ctx.lineTo(-3,-3.5); ctx.lineTo(0,0.5); ctx.lineTo(8,-1);
    ctx.strokeStyle='#fff3a8'; ctx.lineWidth=2.4; ctx.lineCap='round';
    ctx.shadowColor='#ffe066'; ctx.shadowBlur=12; ctx.stroke();
    ctx.shadowBlur=0;
  } else {
    const ang = Math.atan2(p.target.y-p.y, p.target.x-p.x);
    ctx.translate(p.x,p.y); ctx.rotate(ang);
    ctx.strokeStyle='#5c3a1e'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(6,0); ctx.stroke();
    ctx.fillStyle='#5c3a1e';
    ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(1,-3); ctx.lineTo(1,3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#e8e0cf'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(-13,-3); ctx.moveTo(-9,0); ctx.lineTo(-13,3); ctx.stroke();
  }
  ctx.restore();
}
/* Şimşek zincirinin sıçrama yayları — kırık çizgi olarak çizilir */
function drawArcs(){
  arcs.forEach(a=>{
    const alpha = Math.max(0, a.life/0.22);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle='#fff3a8';
    ctx.lineWidth=2.6; ctx.lineCap='round';
    ctx.shadowColor='#ffe066'; ctx.shadowBlur=12;
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    // ortada kırılmalar: düz çizgi yerine zikzak
    const segs = 4;
    for(let i=1;i<segs;i++){
      const tt = i/segs;
      const mx = a.x1 + (a.x2-a.x1)*tt;
      const my = a.y1 + (a.y2-a.y1)*tt;
      const nx = -(a.y2-a.y1), ny = (a.x2-a.x1);
      const len = Math.hypot(nx,ny) || 1;
      const off = (Math.random()-0.5)*14;
      ctx.lineTo(mx + nx/len*off, my + ny/len*off);
    }
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawExplosions(){
  explosions.forEach(x=>{
    ctx.save(); ctx.globalAlpha = Math.max(x.life/0.35,0)*0.6;
    ctx.beginPath(); ctx.arc(x.x,x.y,x.r,0,Math.PI*2);
    ctx.strokeStyle='#ffb84a'; ctx.lineWidth=4; ctx.stroke();
    ctx.restore();
  });
}
function drawParticles(){
  particles.forEach(p=>{
    ctx.save(); ctx.globalAlpha=Math.max(p.life/0.45,0);
    ctx.beginPath(); ctx.arc(p.x,p.y,2.4,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); ctx.restore();
  });
}
function drawFloatTexts(){
  ctx.save(); ctx.font='700 13px "Baloo 2", sans-serif'; ctx.textAlign='center';
  floatTexts.forEach(f=>{
    ctx.globalAlpha=Math.max(f.life/0.7,0);
    ctx.fillStyle=f.color; ctx.fillText(f.text, f.x, f.y);
  });
  ctx.restore();
}

function render(){
  ctx.save();
  if(shake>0) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  ctx.clearRect(-20,-20,LW+40,LH+40);
  ensureBackground();
  ctx.drawImage(bgCanvas,0,0);
  drawPath(); drawDirectionArrows(); drawProps(); drawSpots();
  // Katman sırası: boss auraları ve menzil halkaları zeminde,
  // sonra düşmanlar, en üstte kuleler — kuleler arkada kalmasın.
  enemies.forEach(drawBossAura);
  drawHealZones();          // zeminde: birikintiler düşmanların altında
  towers.forEach(drawTowerRange);
  enemies.forEach(drawEnemy);
  towers.forEach(drawTower);
  towers.forEach(drawChillBadge);
  projectiles.forEach(drawProjectile);
  drawArcs();
  drawExplosions();
  drawParticles();
  drawFloatTexts();
  drawBirds();      // ortam kuşu sürüsü — kardan önce, gökyüzü katmanında
  drawSnowfall();   // en üstte: kar her şeyin önünden geçer
  ctx.restore();
}
