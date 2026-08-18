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

function drawPath(){
  ctx.save();
  ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=52; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); level.path.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  ctx.strokeStyle='#c9a463'; ctx.lineWidth=42;
  ctx.beginPath(); level.path.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  ctx.strokeStyle='#dab876'; ctx.lineWidth=34;
  ctx.beginPath(); level.path.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  pathDecor.forEach(d=>{
    ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
    ctx.fillStyle='rgba(120,80,40,0.35)'; ctx.fill();
  });
  ctx.restore();

  // spawn işareti
  const start = level.path[0], end = level.path[level.path.length-1];
  ctx.save();
  ctx.font='15px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.beginPath(); ctx.arc(start.x,start.y,13,0,Math.PI*2);
  ctx.fillStyle='rgba(226,80,74,0.22)'; ctx.fill();
  ctx.strokeStyle='rgba(226,80,74,0.7)'; ctx.lineWidth=2; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillText('💀', start.x, start.y+1);

  // hedef/röle işareti
  ctx.beginPath(); ctx.arc(end.x,end.y,13,0,Math.PI*2);
  ctx.fillStyle='rgba(244,192,74,0.22)'; ctx.fill();
  ctx.strokeStyle='rgba(244,192,74,0.75)'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillText('🔮', end.x, end.y+1);
  ctx.restore();
}
function drawSpots(){
  spots.forEach(s=>{
    if(s.occ) return;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(s.x,s.y+4,22,10,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill();
    ctx.beginPath(); ctx.arc(s.x,s.y,17,0,Math.PI*2);
    ctx.strokeStyle='rgba(244,192,74,0.4)'; ctx.lineWidth=2; ctx.setLineDash([4,5]); ctx.stroke();
    ctx.setLineDash([]);
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
  ctx.save(); ctx.translate(x+9,y-4); ctx.rotate(0.5);
  ctx.strokeStyle='#3a2410'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,9,-0.9,0.9); ctx.stroke();
  ctx.strokeStyle='rgba(230,220,200,0.8)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(9*Math.cos(-0.9),9*Math.sin(-0.9)); ctx.lineTo(9*Math.cos(0.9),9*Math.sin(0.9)); ctx.stroke();
  ctx.restore();
  if(lvl>=1){
    ctx.save(); ctx.translate(x-9,y-4); ctx.rotate(Math.PI-0.5);
    ctx.strokeStyle='#3a2410'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,8,-0.9,0.9); ctx.stroke();
    ctx.strokeStyle='rgba(230,220,200,0.8)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(8*Math.cos(-0.9),8*Math.sin(-0.9)); ctx.lineTo(8*Math.cos(0.9),8*Math.sin(0.9)); ctx.stroke();
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

function drawMageTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.3;
  const t0 = performance.now()/1000;
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

  const trunkGrad = ctx.createLinearGradient(x-9,y-30,x+9,y+2);
  trunkGrad.addColorStop(0,'#3d8069'); trunkGrad.addColorStop(1,'#1f4a3b');
  ctx.fillStyle=trunkGrad; ctx.strokeStyle='#0d241c'; ctx.lineWidth=2.5;
  roundedRect(x-9,y-30,18,32,5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x-3,y-27); ctx.lineTo(x-3,y-1); ctx.stroke();

  ctx.save(); ctx.translate(x,y-30); ctx.scale(pulse,pulse);
  const lvl = t.level||0;
  const shards=[[0,-32,10],[-11,-15,7.5],[11,-17,7.5],[-5,-8,5],[6,-9,5]];
  // Seviye arttıkça yeni kristaller filizlenir
  if(lvl>=1) shards.push([-16,-24,6]);
  if(lvl>=2) shards.push([16,-26,6]);
  if(lvl>=3) shards.push([0,-46,7]);
  shards.forEach(([dx,dy,s],i)=>{
    ctx.save(); ctx.translate(dx,dy); ctx.rotate(Math.sin(t0*0.8+i)*0.05);
    ctx.beginPath();
    ctx.moveTo(0,-s); ctx.lineTo(-s*0.55,s*0.7); ctx.lineTo(s*0.55,s*0.7); ctx.closePath();
    const g=ctx.createLinearGradient(0,-s,0,s*0.7);
    g.addColorStop(0, brightenColor('#eafffa', lvl));
    g.addColorStop(0.5, brightenColor('#7fe3c4', lvl));
    g.addColorStop(1, brightenColor('#2c8067', lvl));
    ctx.fillStyle=g; ctx.fill();
    ctx.lineWidth = 1.8 + lvl*0.3;
    ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#0d241c';
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s*0.15,-s*0.6); ctx.lineTo(-s*0.1,s*0.3);
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  });
  // çekirdek parlaması (katmanlı) — seviye ile büyür
  [16,10,5].forEach((r,i)=>{
    ctx.beginPath(); ctx.arc(0,-32,r+lvl*2+((t.pulse||0)*3),0,Math.PI*2);
    ctx.fillStyle = i===2 ? '#ffffff' : `rgba(180,255,235,${0.25-i*0.08})`;
    ctx.fill();
  });
  ctx.shadowColor='#4fc3a1'; ctx.shadowBlur=18+lvl*5;
  ctx.beginPath(); ctx.arc(0,-32,4+lvl*0.6,0,Math.PI*2); ctx.fillStyle='#eafffa'; ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();

  // yörüngede dönen ışık zerreleri — seviye ile çoğalır
  for(let i=0;i<3+lvl;i++){
    const ang = t0*1.6 + i*(Math.PI*2/(3+lvl));
    const r = 20+Math.sin(t0*2+i)*4;
    const mx = x+Math.cos(ang)*r, my = y-30+Math.sin(ang)*r*0.6;
    ctx.beginPath(); ctx.arc(mx,my,1.8,0,Math.PI*2);
    ctx.fillStyle='#bdf5e4'; ctx.shadowColor='#4fc3a1'; ctx.shadowBlur=8; ctx.fill();
  }
  ctx.shadowBlur=0;
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

  // namlu — seviye arttıkça uzar ve bantları çoğalır
  const barrelAngle = t.angle!==undefined ? t.angle : -Math.PI/2.2;
  const barrelLen = 26 + lvl*3;
  ctx.save(); ctx.translate(x,y-2); ctx.rotate(barrelAngle*0.25 - Math.PI/2.4);
  const barrelGrad = ctx.createLinearGradient(-6,-barrelLen,6,0);
  barrelGrad.addColorStop(0,'#5c5c56'); barrelGrad.addColorStop(0.5,'#3a3a34'); barrelGrad.addColorStop(1,'#4a4a44');
  ctx.fillStyle=barrelGrad;
  ctx.strokeStyle = lvl>=3 ? '#f4c04a' : '#1a1a17';
  ctx.lineWidth = 2.5 + lvl*0.3;
  roundedRect(-6,-barrelLen,12,barrelLen,4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(180,150,90,0.5)'; ctx.lineWidth=2;
  for(let i=0;i<2+lvl;i++){
    const by = -18 - i*6;
    if(by > -barrelLen+3){
      ctx.beginPath(); ctx.moveTo(-6,by); ctx.lineTo(6,by); ctx.stroke();
    }
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

function drawEnemy(e){
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
  ctx.drawImage(bgCanvas,0,0);
  drawPath(); drawSpots();
  // Katman sırası: menzil halkaları zeminde, sonra düşmanlar,
  // en üstte kuleler — böylece kuleler düşmanların arkasında kalmaz.
  towers.forEach(drawTowerRange);
  enemies.forEach(drawEnemy);
  towers.forEach(drawTower);
  projectiles.forEach(drawProjectile);
  drawExplosions();
  drawParticles();
  drawFloatTexts();
  ctx.restore();
}
