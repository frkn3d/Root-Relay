/* ============================================================
   RENDER — sadece canvas çizim fonksiyonları.
   Oyun durumunu (engine.js) okur, değiştirmez.
   ============================================================ */
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
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fill();
  const grad = ctx.createRadialGradient(x-4,y+6,2,x,y+10,20);
  grad.addColorStop(0,'#9a9382'); grad.addColorStop(1,'#5c574a');
  ctx.beginPath(); ctx.ellipse(x,y+10,18,8,0,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill();
  ctx.lineWidth=2.5; ctx.strokeStyle='#2b2820'; ctx.stroke();
}

function drawArcherTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.2;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);
  ctx.fillStyle='#7a4d29'; ctx.strokeStyle='#2b1a0c'; ctx.lineWidth=2.5;
  roundedRect(x-10,y-16,20,24,6); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x,y-16); ctx.scale(pulse,pulse);
  const capGrad = ctx.createRadialGradient(-6,-8,2,0,0,26);
  capGrad.addColorStop(0,'#a9dba0'); capGrad.addColorStop(1,'#4f7f52');
  ctx.beginPath(); ctx.ellipse(0,0,24,15,0,Math.PI,0);
  ctx.fillStyle=capGrad; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle='#26411f'; ctx.stroke();
  [[-11,-6],[4,-10],[12,-3]].forEach(([dx,dy])=>{
    ctx.beginPath(); ctx.arc(dx,dy,2.6,0,Math.PI*2); ctx.fillStyle='#eef7e2'; ctx.fill();
  });
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y-8, 3.5+((t.pulse||0)*2), 0, Math.PI*2);
  ctx.fillStyle='#ffd27a'; ctx.shadowColor='#ffd27a'; ctx.shadowBlur=10; ctx.fill();
  ctx.restore();
}

function drawMageTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.3;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);
  ctx.fillStyle='#2f6b57'; ctx.strokeStyle='#123128'; ctx.lineWidth=2.5;
  roundedRect(x-9,y-30,18,32,5); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x,y-30); ctx.scale(pulse,pulse);
  const shards=[[0,-30,9],[ -10,-14,7],[10,-16,7]];
  shards.forEach(([dx,dy,s])=>{
    ctx.beginPath();
    ctx.moveTo(dx,dy); ctx.lineTo(dx-s*0.6,dy+s*1.6); ctx.lineTo(dx+s*0.6,dy+s*1.6); ctx.closePath();
    const g=ctx.createLinearGradient(dx,dy,dx,dy+s*1.6);
    g.addColorStop(0,'#d9fff2'); g.addColorStop(1,'#3fae8f');
    ctx.fillStyle=g; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#123128'; ctx.stroke();
  });
  ctx.beginPath(); ctx.arc(0,-30,5+((t.pulse||0)*3),0,Math.PI*2);
  ctx.fillStyle='#c9fff0'; ctx.shadowColor='#4fc3a1'; ctx.shadowBlur=16; ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawIceTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.25;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);
  ctx.fillStyle='#6fa8b8'; ctx.strokeStyle='#1c3540'; ctx.lineWidth=2.5;
  roundedRect(x-9,y-14,18,20,5); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(x,y-14); ctx.scale(pulse,pulse);
  const shards=[[0,-28,8],[-9,-10,6],[9,-11,6],[0,-10,5]];
  shards.forEach(([dx,dy,s])=>{
    ctx.beginPath();
    ctx.moveTo(dx,dy-s); ctx.lineTo(dx-s*0.55,dy+s*0.5); ctx.lineTo(dx+s*0.55,dy+s*0.5); ctx.closePath();
    const g=ctx.createLinearGradient(dx,dy-s,dx,dy+s*0.5);
    g.addColorStop(0,'#ffffff'); g.addColorStop(1,'#8fd9f0');
    ctx.fillStyle=g; ctx.fill(); ctx.lineWidth=1.6; ctx.strokeStyle='#2c5866'; ctx.stroke();
  });
  ctx.restore();
  // buz sisi
  const t0 = performance.now()/1000;
  for(let i=0;i<3;i++){
    const ang = t0*0.6 + i*(Math.PI*2/3);
    const mx = x+Math.cos(ang)*14, my = y-4+Math.sin(ang)*6;
    ctx.beginPath(); ctx.arc(mx,my,3,0,Math.PI*2);
    ctx.fillStyle='rgba(220,248,255,0.5)'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x,y-22,3.5+((t.pulse||0)*2.5),0,Math.PI*2);
  ctx.fillStyle='#eafcff'; ctx.shadowColor='#8fd9f0'; ctx.shadowBlur=12; ctx.fill();
  ctx.restore();
}

function drawMortarTower(t){
  const {x,y}=t;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x,y+18,22,8,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fill();
  [-16,16].forEach(dx=>{
    ctx.beginPath(); ctx.arc(x+dx,y+14,7,0,Math.PI*2);
    ctx.fillStyle='#3d2a18'; ctx.fill(); ctx.strokeStyle='#1a0f07'; ctx.lineWidth=2; ctx.stroke();
  });
  const grad=ctx.createRadialGradient(x-6,y-2,3,x,y+4,22);
  grad.addColorStop(0,'#e8a069'); grad.addColorStop(1,'#a25a2c');
  ctx.beginPath(); ctx.ellipse(x,y+4,20,15,0,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle='#3f2410'; ctx.stroke();
  const barrelAngle = t.angle!==undefined ? t.angle : -Math.PI/2.2;
  ctx.save(); ctx.translate(x,y-2); ctx.rotate(barrelAngle*0.25 - Math.PI/2.4);
  ctx.fillStyle='#4a4a44'; ctx.strokeStyle='#1a1a17'; ctx.lineWidth=2.5;
  roundedRect(-6,-26,12,26,4); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(x,y-16,2+(t.pulse||0)*2,0,Math.PI*2);
  ctx.fillStyle='#ffb84a'; ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=8; ctx.fill();
  ctx.restore();
}

function drawTower(t){
  ctx.save();
  ctx.beginPath(); ctx.arc(t.x,t.y,t.def.range,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
  if(t.def.kind==='archer') drawArcherTower(t);
  else if(t.def.kind==='mage') drawMageTower(t);
  else if(t.def.kind==='ice') drawIceTower(t);
  else drawMortarTower(t);
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
  towers.forEach(drawTower);
  enemies.forEach(drawEnemy);
  projectiles.forEach(drawProjectile);
  drawExplosions();
  drawParticles();
  drawFloatTexts();
  ctx.restore();
}
