/* ============================================================
   RENDER / KULE GÖRSELLERİ — her kule tipinin kendi çizimi.
   Ortak kaide (drawBasePlinth) dışında hepsi birbirinden bağımsızdır;
   yeni bir kule tipi eklerken sadece buraya bir fonksiyon yazılır ve
   render-towers.js'teki drawTower() dağıtıcısına bağlanır.
   ============================================================ */
/* Kaide her kulede birebir aynı — tek fark konumu. Bu yüzden artık
   YEREL koordinatlarda çiziliyor (önce translate): gradyan da her
   kule için ayrı değil, tek bir önbellek girdisi oluyor. Öteleme
   tam sayı aritmetiği olduğu için görüntü birebir aynı kalır. */
function drawBasePlinth(x,y,pulse){
  ctx.save();
  ctx.translate(x, y);
  /* Kaide çizimi tamamen sabit (pulse hiç kullanılmıyor): 24 çizim
     çağrısı yerine tek bir drawImage. Kutu, çizimin taştığı en geniş
     alan — kenar çizgisi ve yosun tutamları dahil. */
  staticSprite('plinth', [-22, -2, 44, 24], drawPlinthArt);
  ctx.restore();
}

function drawPlinthArt(){
  ctx.beginPath(); ctx.ellipse(0,16,20,7,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.32)'; ctx.fill();
  const grad = cachedGrad('plinth', ()=>{        // render-core.js
    const g = ctx.createRadialGradient(-4,6,2,0,10,20);
    g.addColorStop(0,'#a8a191'); g.addColorStop(0.6,'#84806f'); g.addColorStop(1,'#4c4839');
    return g;
  });
  ctx.beginPath(); ctx.ellipse(0,10,18,8,0,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill();
  ctx.lineWidth=2.5; ctx.strokeStyle='#241f16'; ctx.stroke();
  // taş dokusu benekleri
  [[-9,7],[6,10],[-2,5],[10,6]].forEach(([dx,dy])=>{
    ctx.beginPath(); ctx.ellipse(dx,dy,2,1.2,0.3,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fill();
  });
  // kenarda küçük yosun tutamları
  [[-15,10,'#5a8a4f'],[13,11,'#4f7a45'],[3,13,'#6b9e5c']].forEach(([dx,dy,c])=>{
    ctx.beginPath(); ctx.ellipse(dx,dy,3.2,2,0,0,Math.PI*2);
    ctx.fillStyle=c; ctx.fill();
  });
}

function drawArcherTower(t){
  const {x,y}=t, pulse=1+(t.pulse||0)*0.2;
  const t0 = performance.now()/1000;
  const lvl = t.level||0;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  const trunkGrad = cachedGrad('archerTrunk|'+x+'|'+y, ()=>{
    const g_ = ctx.createLinearGradient(x-10,y-16,x+10,y+8);
    g_.addColorStop(0,'#8a5a34'); g_.addColorStop(1,'#6b4526');
    return g_;
  });
  ctx.fillStyle=trunkGrad; ctx.strokeStyle='#2b1a0c'; ctx.lineWidth=2.5;
  roundedRect(x-10,y-16,20,24,6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
  [-5,0,5].forEach(dx=>{ ctx.beginPath(); ctx.moveTo(x+dx,y-13); ctx.lineTo(x+dx,y+6); ctx.stroke(); });

  ctx.save(); ctx.translate(x,y-16); ctx.scale(pulse,pulse);
  ctx.beginPath(); ctx.ellipse(1,2,25,16,0,Math.PI,0);
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
  const capGrad = cachedGrad('archerCap|'+lvl, ()=>{
    const g_ = ctx.createRadialGradient(-8,-10,2,0,-2,28);
    g_.addColorStop(0, brightenColor('#c3f0b8', lvl));
    g_.addColorStop(0.45, brightenColor('#8fc482', lvl));
    g_.addColorStop(1, brightenColor('#446f3f', lvl));
    return g_;
  });
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

  // glowDot (render-core.js): shadowBlur yerine önbelleklenmiş sprite
  glowDot(x, y-8, 3.5+lvl*0.5+((t.pulse||0)*2), '#ffd27a', '#ffd27a', 10+lvl*3);

  for(let i=0;i<2+lvl;i++){
    const ang = t0*1.3 + i*(Math.PI*2/(2+lvl));
    const fx = x+Math.cos(ang)*18, fy = y-14+Math.sin(ang*1.4)*10;
    glowDot(fx, fy, 1.6, '#fff3b0', '#ffe08a', 6);
  }
  ctx.restore();
}

/* LAZER KULESİ (eski adı "Işık Kulesi") — Don Peykesi ile karışmasın
   diye tamamen farklı bir form: kristal yok. Taş bir sütun üzerinde
   havada süzülen bir küre ve onu çevreleyen eğik yörünge halkaları.
   Ateş ederken küreden hedefe MAVİ bir lazer uzanır (bkz. drawBeams,
   render-fx.js) — bu yüzden kulenin tüm paleti maviye çevrildi. */
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
    ctx.strokeStyle=`rgba(79,168,255,${0.5-r*0.15})`; ctx.lineWidth=1.2;
    ctx.setLineDash([3,3]); ctx.lineDashOffset=-t0*15*(r?1:-1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // taş sütun — yukarı doğru daralan
  const colGrad = cachedGrad('mageCol|'+x+'|'+y, ()=>{
    const g_ = ctx.createLinearGradient(x-11,y,x+11,y);
    g_.addColorStop(0,'#20405e'); g_.addColorStop(0.5,'#74a6cf'); g_.addColorStop(1,'#20405e');
    return g_;
  });
  ctx.beginPath();
  ctx.moveTo(x-11, y+4);
  ctx.lineTo(x-7, y-22);
  ctx.lineTo(x+7, y-22);
  ctx.lineTo(x+11, y+4);
  ctx.closePath();
  ctx.fillStyle=colGrad; ctx.fill();
  ctx.lineWidth=2.5; ctx.strokeStyle='#0e2237'; ctx.stroke();

  // sütun üzerinde kazınmış çizgiler
  ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=1;
  [-4,0,4].forEach(dx=>{
    ctx.beginPath(); ctx.moveTo(x+dx, y-19); ctx.lineTo(x+dx*1.3, y+2); ctx.stroke();
  });

  // sütun üstündeki çanak
  ctx.beginPath();
  ctx.ellipse(x, y-22, 9.5, 3.6, 0, 0, Math.PI*2);
  ctx.fillStyle='#2f5c80'; ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle='#0e2237'; ctx.stroke();

  // havada süzülen küre
  const floatY = y - 36 + Math.sin(t0*1.6)*2.5;
  const R = (8.5 + lvl*1.1) * pulse;

  // sütundan küreye uzanan enerji hattı
  ctx.beginPath();
  ctx.moveTo(x, y-24); ctx.lineTo(x, floatY+R*0.7);
  ctx.strokeStyle='rgba(160,215,255,'+(0.35+(t.pulse||0)*0.4)+')';
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
    ctx.strokeStyle = lvl>=3 ? 'rgba(244,192,74,0.75)' : 'rgba(150,205,255,0.6)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // dış parıltı
  const halo = ctx.createRadialGradient(x,floatY,R*0.3,x,floatY,R*2.2);
  halo.addColorStop(0,'rgba(175,222,255,0.36)');
  halo.addColorStop(1,'rgba(90,165,240,0)');
  ctx.beginPath(); ctx.arc(x,floatY,R*2.2,0,Math.PI*2);
  ctx.fillStyle=halo; ctx.fill();

  // kürenin kendisi
  const orb = ctx.createRadialGradient(x-R*0.35, floatY-R*0.4, R*0.15, x, floatY, R);
  orb.addColorStop(0,'#ffffff');
  orb.addColorStop(0.45, brightenColor('#7fc4ff', lvl));
  orb.addColorStop(1, brightenColor('#1f5aa0', lvl));
  ctx.beginPath(); ctx.arc(x,floatY,R,0,Math.PI*2);
  ctx.fillStyle=orb; ctx.shadowColor='#4fa8ff'; ctx.shadowBlur=16+lvl*4; ctx.fill();
  ctx.shadowBlur=0;
  ctx.lineWidth=1.8; ctx.strokeStyle='rgba(10,32,58,0.6)'; ctx.stroke();

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

  const trunkGrad = cachedGrad('iceTrunk|'+x+'|'+y, ()=>{
    const g_ = ctx.createLinearGradient(x-9,y-14,x+9,y+6);
    g_.addColorStop(0,'#8fd0e0'); g_.addColorStop(1,'#5589a0');
    return g_;
  });
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
  glowDot(x, y-22, 3.5+lvl*0.5+((t.pulse||0)*2.5), '#eafcff', '#8fd9f0', 12+lvl*4);

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
  const g = cachedGrad('poisonBody|'+x+'|'+y+'|'+lvl, ()=>{
    const g_ = ctx.createLinearGradient(x-10,y-20,x+10,y+6);
    g_.addColorStop(0, brightenColor('#5f8f3a', lvl));
    g_.addColorStop(1, brightenColor('#33581f', lvl));
    return g_;
  });
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

  glowDot(x, y-10, 3+lvl*0.4+((t.pulse||0)*2), '#d9ff9e', '#9fdc5c', 10+lvl*3);
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
  const g = cachedGrad('boltBody|'+x+'|'+y, ()=>{
    const g_ = ctx.createLinearGradient(x-7,y-34,x+7,y+4);
    g_.addColorStop(0,'#8d93a1'); g_.addColorStop(0.5,'#5a6070'); g_.addColorStop(1,'#3a3f4c');
    return g_;
  });
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
    glowDot(Math.cos(a)*11, -14+Math.sin(a)*11, 2, '#fff3a8', '#ffe066', 8);
  }
  // merkez çekirdek
  glowDot(0, -16, 4+lvl*0.6+((t.pulse||0)*3), '#fffbe0', '#ffe066', 16+lvl*4);
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

/* ATEŞ KULESİ — köşeli bir yakıt tankı ve nişan açısına dönen bir
   püskürtme namlusu; namlu ucunda ateş etmese bile küçük bir pilot
   alevi titrer, "sönmemiş" hissi versin diye. */
function drawFireTower(t){
  const {x,y}=t;
  const t0 = performance.now()/1000;
  const lvl = t.level||0;
  const aim = (t.aimAngle !== undefined) ? t.aimAngle : -Math.PI/2;
  ctx.save();
  drawBasePlinth(x,y,t.pulse);

  // yakıt tankı
  const tankGrad = cachedGrad('fireTank|'+x+'|'+y, ()=>{
    const g_ = ctx.createLinearGradient(x-10,y-24,x+10,y+2);
    g_.addColorStop(0,'#5a4038'); g_.addColorStop(0.5,'#3a2620'); g_.addColorStop(1,'#241511');
    return g_;
  });
  ctx.fillStyle=tankGrad; ctx.strokeStyle='#160b08'; ctx.lineWidth=2.5;
  roundedRect(x-10,y-24,20,26,6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.4;
  [-18,-2].forEach(dy=>{ ctx.beginPath(); ctx.moveTo(x-10,y+dy); ctx.lineTo(x+10,y+dy); ctx.stroke(); });

  // gözetleme camı — için için kızarır
  const glowPulse = 0.6+Math.sin(t0*3)*0.25+(t.pulse||0)*0.3;
  ctx.beginPath(); ctx.arc(x,y-11,5+lvl*0.6,0,Math.PI*2);
  ctx.fillStyle=`rgba(255,${120+lvl*15},60,${glowPulse})`;
  ctx.shadowColor='#ff5a2e'; ctx.shadowBlur=14+lvl*3; ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='#160b08'; ctx.lineWidth=1.5; ctx.stroke();

  // namlu — nişan açısına döner
  ctx.save(); ctx.translate(x,y-13); ctx.rotate(aim);
  const barrelLen = 15+lvl*2;
  const bg = ctx.createLinearGradient(0,-3,barrelLen,3);
  bg.addColorStop(0,'#6b5850'); bg.addColorStop(1,'#2a1c17');
  ctx.fillStyle=bg; ctx.strokeStyle='#160b08'; ctx.lineWidth=2;
  roundedRect(0,-4,barrelLen,8,3); ctx.fill(); ctx.stroke();

  // namlu ucunda titreyen pilot alevi
  const flick = 0.7+Math.sin(t0*14)*0.3;
  for(let i=0;i<3;i++){
    const fl = (barrelLen-2) + i*3*flick;
    const fh = (3-i*0.7)*flick;
    ctx.beginPath();
    ctx.moveTo(fl,0);
    ctx.quadraticCurveTo(fl+4+i*2, -fh, fl+7+i*2.4, 0);
    ctx.quadraticCurveTo(fl+4+i*2, fh, fl,0);
    const fg = ctx.createLinearGradient(fl,0,fl+9,0);
    fg.addColorStop(0,'#fff3a8'); fg.addColorStop(0.4,'#ff9a3c'); fg.addColorStop(1,'rgba(255,90,46,0)');
    ctx.fillStyle=fg; ctx.fill();
  }
  ctx.restore();

  // etrafta yükselen kor parçacıkları
  for(let i=0;i<2+lvl;i++){
    const cyc = (t0*0.6+i*0.37)%1;
    const ang0 = i*2.4;
    const ex = x + Math.cos(ang0)*(6+cyc*8);
    const ey = y-16 - cyc*18;
    ctx.beginPath(); ctx.arc(ex,ey,1.6*(1-cyc*0.6),0,Math.PI*2);
    ctx.fillStyle=`rgba(255,${150+Math.floor(cyc*80)},80,${0.75*(1-cyc)})`;
    ctx.fill();
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
  const grad = cachedGrad('mortarBase|'+x+'|'+y+'|'+lvl, ()=>{
    const g_ = ctx.createRadialGradient(x-6,y-2,3,x,y+4,22);
    g_.addColorStop(0, brightenColor('#eeb27a', lvl));
    g_.addColorStop(0.6, brightenColor('#c9793f', lvl));
    g_.addColorStop(1, brightenColor('#8a4a20', lvl));
    return g_;
  });
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

  glowDot(x, y-16, 2+lvl*0.4+(t.pulse||0)*2, '#ffb84a', '#ff8a2a', 8+lvl*3);
  ctx.restore();
}
