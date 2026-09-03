/* ============================================================
   RENDER / DÜNYA — zemin katmanı: yol, yön okları, manzara
   dekoru ve boş yapı alanları. Kule ve düşmanlardan ÖNCE çizilir.
   ============================================================ */
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

  // Giriş ve çıkış işaretleri — her rotanın kendi uçları.
  // Giriş (düşman doğuşu) yeşil, çıkış (röleye ulaşılan uç) kırmızı —
  // trafik ışığı mantığıyla: yeşilden gelir, kırmızıya (tehlike/röle)
  // ulaşır. Çıkış ayrıca nabız gibi atan bir dış halkayla daha vurgulu.
  ctx.save();
  ctx.font='15px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const seenStart = [], seenEnd = [];
  const near = (arr,p)=>arr.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<24);
  const tGlow = performance.now()/1000;
  const pulse = 0.5 + 0.5*Math.sin(tGlow*2.4);
  levelPaths.forEach(pts=>{
    const s = pts[0], e = pts[pts.length-1];
    if(!near(seenStart,s)){
      seenStart.push(s);
      ctx.beginPath(); ctx.arc(s.x,s.y,13,0,Math.PI*2);
      ctx.fillStyle='rgba(88,196,120,0.22)'; ctx.fill();
      ctx.strokeStyle='rgba(88,196,120,0.7)'; ctx.lineWidth=2; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText('💀', s.x, s.y+1);
    }
    if(!near(seenEnd,e)){
      seenEnd.push(e);
      ctx.beginPath(); ctx.arc(e.x,e.y,17+pulse*3,0,Math.PI*2);
      ctx.strokeStyle=`rgba(226,80,74,${0.28+pulse*0.22})`; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.arc(e.x,e.y,13,0,Math.PI*2);
      ctx.fillStyle='rgba(226,80,74,0.25)'; ctx.fill();
      ctx.strokeStyle='rgba(226,80,74,0.85)'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillText('🔮', e.x, e.y+1);
    }
  });
  ctx.restore();
}
/* Yolun başına ve sonuna, gidiş yönünü belirten silik akan oklar.
   Yolun teğetine göre döner, sürekli ileri kayarak yönü belli eder.
   Giriş ucundakiler yeşil, çıkış (röle) ucundakiler kırmızı ve daha
   belirgin — girişle çıkışı renkle ayırıp çıkışı daha vurguluyor.
   Koyu dış kontur yalnızca DURAKLIYKEN ya da bölüm hiç başlamamışken
   (ilk dalga atılmadan önce) tam görünür — oyun başlayınca 0.5 saniye
   içinde sıfıra iner, aksiyon sırasında dikkat dağıtmasın diye. Rengin
   kendisi (kontursuz ok) her zaman aynı kalır. */
let arrowOutlineAlpha = 1;
let lastArrowFrameT = null;
function drawDirectionArrows(){
  const t0 = performance.now()/1000;
  const fdt = (lastArrowFrameT===null) ? 0 : Math.max(0, Math.min(0.1, t0-lastArrowFrameT));
  lastArrowFrameT = t0;
  const boldPhase = paused || (waveIndex===0 && !waveActive);
  const target = boldPhase ? 1 : 0;
  const step = fdt/0.5;   // 0.5 saniyede tam geçiş
  if(arrowOutlineAlpha < target) arrowOutlineAlpha = Math.min(target, arrowOutlineAlpha+step);
  else if(arrowOutlineAlpha > target) arrowOutlineAlpha = Math.max(target, arrowOutlineAlpha-step);

  ctx.save();
  levelPaths.forEach((pts, pi)=>{
    const len = pathLens[pi] || 0;
    if(len < 120) return;
    const zones = [
      { start: 40,                            color:'88,196,120', alpha:0.65 }, // giriş
      { start: Math.max(60, len - 150),       color:'226,80,74',  alpha:0.80 }, // çıkış — daha vurgulu
    ];
    zones.forEach(zone=>{
      for(let i=0;i<3;i++){
        const cyc = ((t0*0.45 + i/3) % 1);
        const d = zone.start + cyc*110;
        if(d < 0 || d > len) continue;
        const p  = pointAtDistance(pts, len, d);
        const p2 = pointAtDistance(pts, len, Math.min(d+6, len));
        const ang = Math.atan2(p2.y-p.y, p2.x-p.x);
        const fade = Math.sin(cyc*Math.PI);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.lineCap='round'; ctx.lineJoin='round';
        // Koyu bir dış kontur önce çizilip üstüne renk basılıyor —
        // altındaki zemin açık ya da koyu olsun fark etmeksizin okun
        // her zeminde net seçilmesini sağlıyor.
        if(arrowOutlineAlpha > 0.001){
          ctx.globalAlpha = Math.min(1, zone.alpha*1.1) * fade * arrowOutlineAlpha;
          ctx.strokeStyle = 'rgba(20,16,10,0.85)';
          ctx.lineWidth = 6.5;
          ctx.beginPath();
          ctx.moveTo(-9,-8); ctx.lineTo(3,0); ctx.lineTo(-9,8);
          ctx.stroke();
        }
        ctx.globalAlpha = zone.alpha * fade;
        ctx.strokeStyle = `rgb(${zone.color})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-9,-8); ctx.lineTo(3,0); ctx.lineTo(-9,8);
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

function drawSpots(){
  const t0 = performance.now()/1000;
  spots.forEach(s=>{
    if(s.occ) return;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(s.x,s.y+4,22,10,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill();

    if(pendingSpot === s){
      /* Onay bekleyen nokta: kurulacak kulenin menzilini önizle.
         def.range DEĞİL getTowerStats kullanılır — ilk kurulum menzil
         cezası (buildRangePenalty, engine-towers.js) yüzünden ikisi
         aynı değil; önizleme gerçekte kurulacak çemberi göstermeli. */
      const def = TOWER_TYPES[selectedType];
      const previewRange = getTowerStats({def, level:0}).range;
      ctx.beginPath(); ctx.arc(s.x,s.y,previewRange,0,Math.PI*2);
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
