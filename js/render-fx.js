/* ============================================================
   RENDER / EFEKTLER — mermiler ve kısa ömürlü görseller:
   enkaz, alev püskürtme, iyileştirme birikintisi, şimşek yayları,
   patlamalar, parçacıklar ve uçuşan yazılar.
   Hepsinin ömrü engine tarafında azaltılır; burada sadece çizilir.
   ============================================================ */
/* Bölünen küplerden geriye kalan enkaz — kırılan şişenin sıvısı gibi,
   yerde bir süre saçılı duran küçük parçalar. Yalnızca görsel. */
function drawDebris(){
  if(!debris || !debris.length) return;
  ctx.save();
  debris.forEach(d=>{
    const fade = Math.max(0, Math.min(1, d.life / d.maxLife));
    ctx.globalAlpha = fade;
    d.pieces.forEach(p=>{
      ctx.save();
      ctx.translate(d.x+p.dx, d.y+p.dy);
      ctx.rotate(p.rot);
      const g = ctx.createLinearGradient(-p.size,-p.size,p.size,p.size);
      g.addColorStop(0, d.color); g.addColorStop(1, d.color2);
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(36,26,16,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  });
  ctx.restore();
}

/* LAV HUZMESİ — Ateş Kulesi artık atış atış değil, hedef gördüğü sürece
   KESİNTİSİZ akan erimiş bir lav huzmesi püskürtüyor (bkz. engine-update.js
   "LAV HUZMESİ"). Bu yüzden efektin kendi ömürlü kaydı yok: doğrudan
   kulelerin flameOn/flameAngle/flameCone/flameRange alanlarından çizilir.
   Namlu ucu, drawFireTower'daki pivot (y-13) ve namlu boyu (15+lvl*2) ile
   birebir aynı; kule görseli ölçeklendiği için aynı ölçek burada da
   uygulanır, aksi halde huzme namludan kopuk başlıyordu. */
function fireMuzzle(t){
  const sc  = TOWER_VISUAL_SCALE * towerLevelScale(t);
  const len = (15 + (t.level||0)*2) * sc;
  const a   = t.flameAngle;
  return { x: t.x + Math.cos(a)*len, y: t.y - 13*sc + Math.sin(a)*len, len };
}

/* Kule başına sabit kalan sözde-rastgele sayı: lav damlaları her karede
   yeniden zar atıp titremesin, her şerit kendi sabit yolunu izlesin. */
function lavaNoise(t, i){
  const v = Math.sin((t.x*12.9898 + t.y*78.233 + i*37.719)) * 43758.5453;
  return v - Math.floor(v);
}

function drawLavaStreams(){
  if(!towers.length) return;
  const t0 = performance.now()/1000;
  towers.forEach(t=>{
    if(!t.flameOn || t.buildLeft > 0) return;
    const m = fireMuzzle(t);
    const ang = t.flameAngle, cone = t.flameCone;
    const reach = Math.max(20, t.flameRange - m.len);

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(ang);

    // 1) Sıcaklık yıkaması — koninin tamamını kaplayan soluk kızıl parıltı
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0, reach, -cone, cone);
    ctx.closePath();
    const wash = ctx.createRadialGradient(0,0,2, 0,0,reach);
    wash.addColorStop(0,   'rgba(255,236,170,0.55)');
    wash.addColorStop(0.30,'rgba(255,132,36,0.34)');
    wash.addColorStop(0.70,'rgba(206,48,16,0.20)');
    wash.addColorStop(1,   'rgba(120,16,8,0)');
    ctx.fillStyle = wash; ctx.fill();

    // 2) Akan lav şeritleri — her şerit koninin içinde kendi hattında
    //    ilerler; ilerledikçe soğuyup koyulaşır (sarı -> turuncu -> kızıl).
    const lanes = 7;
    for(let i=0;i<lanes;i++){
      const n  = lavaNoise(t, i);
      const laneAng = (i/(lanes-1)*2 - 1) * cone * (0.55 + n*0.45);
      const speed   = 0.85 + n*0.5;
      const globs   = 4;
      for(let g=0; g<globs; g++){
        const cyc = ((t0*speed + i*0.23 + g/globs) % 1);
        const d   = 6 + cyc*reach;
        // Şerit uçta hafifçe savrulur — düz bir çizgi yerine akış hissi
        const sway = Math.sin(t0*5 + i*2.1 + cyc*4) * cone * 12 * cyc;
        const gx = Math.cos(laneAng)*d + 0;
        const gy = Math.sin(laneAng)*d + sway;
        const r  = (3.2 + n*2.6) * (0.45 + cyc*0.9);
        const cool = cyc;                          // 0 = namluda, 1 = uçta
        const gg = ctx.createRadialGradient(gx,gy,0, gx,gy,r);
        gg.addColorStop(0, `rgba(255,${Math.round(250-cool*110)},${Math.round(210-cool*180)},${0.95-cool*0.45})`);
        gg.addColorStop(0.55, `rgba(255,${Math.round(150-cool*70)},${Math.round(50-cool*35)},${0.7-cool*0.4})`);
        gg.addColorStop(1, 'rgba(150,26,10,0)');
        ctx.beginPath(); ctx.arc(gx,gy,r,0,Math.PI*2);
        ctx.fillStyle = gg; ctx.fill();
      }
    }

    // 3) Namlu ağzındaki beyaz-sıcak çekirdek — huzmenin çıktığı nokta
    const coreLen = reach*0.42;
    ctx.beginPath();
    ctx.moveTo(0,-3.4);
    ctx.quadraticCurveTo(coreLen*0.5, -cone*coreLen*0.42, coreLen, 0);
    ctx.quadraticCurveTo(coreLen*0.5,  cone*coreLen*0.42, 0, 3.4);
    ctx.closePath();
    const core = ctx.createLinearGradient(0,0,coreLen,0);
    core.addColorStop(0,   'rgba(255,255,235,0.95)');
    core.addColorStop(0.35,'rgba(255,214,110,0.75)');
    core.addColorStop(1,   'rgba(255,110,40,0)');
    ctx.fillStyle = core; ctx.fill();

    // 4) Sıçrayan kor damlaları — huzmenin dışına düşen ufak lav zerreleri
    for(let i=0;i<5;i++){
      const n = lavaNoise(t, 40+i);
      const cyc = (t0*(0.7+n*0.6) + n) % 1;
      const dx = 10 + cyc*reach*0.9;
      const dy = (n-0.5)*cone*90 + cyc*cyc*22*(n<0.5?-1:1);
      ctx.beginPath(); ctx.arc(dx, dy, 1.6*(1-cyc*0.7), 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,${Math.round(190-cyc*90)},70,${0.85*(1-cyc)})`;
      ctx.fill();
    }
    ctx.restore();
  });
}

/* MAVİ LAZER — Lazer Kulesi'nin ışını. Kaydı hedefi REFERANSLA tuttuğu
   için her karede düşmanın o anki konumuna yeniden çizilir: düşman
   kaçarsa ışın onu birebir takip eder. Kaynak, süzülen kürenin merkezi
   (drawMageTower'daki floatY ile aynı y-36 ofseti, kule ölçeğiyle). */
function drawBeams(){
  if(!beams || !beams.length) return;
  const t0 = performance.now()/1000;
  beams.forEach(b=>{
    const t = b.tower, e = b.target;
    const fade = Math.max(0, Math.min(1, b.life / b.maxLife));
    const sc = TOWER_VISUAL_SCALE * towerLevelScale(t);
    const x1 = t.x, y1 = t.y - 36*sc;
    const x2 = e.x, y2 = e.y;

    ctx.save();
    ctx.lineCap = 'round';

    // dış hale
    ctx.globalAlpha = 0.35*fade;
    ctx.strokeStyle = '#2f7fd6';
    ctx.lineWidth = 9;
    ctx.shadowColor = '#4fa8ff'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

    // gövde
    ctx.globalAlpha = 0.8*fade;
    ctx.strokeStyle = '#4fa8ff';
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

    // beyaz çekirdek
    ctx.globalAlpha = fade;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

    // ışın boyunca akan enerji noktaları
    const len = Math.hypot(x2-x1, y2-y1) || 1;
    const ux = (x2-x1)/len, uy = (y2-y1)/len;
    for(let i=0;i<3;i++){
      const d = ((t0*260 + i*len/3) % len);
      ctx.beginPath();
      ctx.arc(x1+ux*d, y1+uy*d, 2.4, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(220,242,255,'+(0.9*fade)+')';
      ctx.fill();
    }

    // hedefteki çarpma parlaması
    const flare = ctx.createRadialGradient(x2,y2,0, x2,y2,14);
    flare.addColorStop(0, 'rgba(240,250,255,'+(0.9*fade)+')');
    flare.addColorStop(0.45,'rgba(79,168,255,'+(0.5*fade)+')');
    flare.addColorStop(1, 'rgba(47,127,214,0)');
    ctx.beginPath(); ctx.arc(x2,y2,14,0,Math.PI*2);
    ctx.fillStyle = flare; ctx.fill();
    ctx.restore();
  });
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

function drawProjectile(p){
  ctx.save();
  if(p.kind==='mortar'){
    /* TOP GÜLLESİ — seyrek ama ağır atış, havada da ağır görünmeli:
       yüksek bir yay, iri bir gülle ve arkasında dağılan duman izi. */
    const remaining = Math.hypot(p.target.x-p.x, p.target.y-p.y);
    const progress = p.travel>0 ? 1-Math.min(remaining/p.travel,1) : 1;
    const arc = Math.sin(progress*Math.PI)*58;
    ctx.beginPath(); ctx.ellipse(p.x,p.y,6,3,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();
    // duman izi: güllenin geldiği yönde soluklaşan kıvrımlar
    for(let i=1;i<=4;i++){
      const back = i*0.055;
      const pr = Math.max(0, progress-back);
      const bx = p.x - (p.x-p.ox)*(back/Math.max(progress,0.001));
      const by = p.y - (p.y-p.oy)*(back/Math.max(progress,0.001)) - Math.sin(pr*Math.PI)*58;
      ctx.beginPath(); ctx.arc(bx, by, 3.4-i*0.5, 0, Math.PI*2);
      ctx.fillStyle='rgba(150,140,130,'+(0.26-i*0.05)+')'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(p.x,p.y-arc,7.5,0,Math.PI*2);
    ctx.fillStyle='#3a3530'; ctx.shadowColor='#000'; ctx.shadowBlur=5; ctx.fill();
    ctx.shadowBlur=0;
    ctx.lineWidth=1.4; ctx.strokeStyle='#1a1512'; ctx.stroke();
    // gülle üzerinde parlama
    ctx.beginPath(); ctx.arc(p.x-2.4,p.y-arc-2.4,2.2,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fill();
    // yanan fitil
    ctx.beginPath(); ctx.arc(p.x-1,p.y-arc-7.5,2.1,0,Math.PI*2);
    ctx.fillStyle='#ffb84a'; ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=10; ctx.fill();
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
    const fade = Math.max(x.life/(x.blast?0.5:0.35),0);
    ctx.save();
    /* blast: Mantar Havanı'nın gülle patlaması — sadece halka değil,
       içi dolu sıcak bir şok dalgası. Kozanın körleştirme patlaması
       eski sade halkasını korur. */
    if(x.blast){
      const g = ctx.createRadialGradient(x.x,x.y,0, x.x,x.y,x.r);
      g.addColorStop(0,   'rgba(255,248,210,'+(0.55*fade)+')');
      g.addColorStop(0.45,'rgba(255,150,50,'+(0.34*fade)+')');
      g.addColorStop(1,   'rgba(150,50,10,0)');
      ctx.beginPath(); ctx.arc(x.x,x.y,x.r,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      ctx.globalAlpha = fade*0.85;
      ctx.beginPath(); ctx.arc(x.x,x.y,x.r,0,Math.PI*2);
      ctx.strokeStyle='#ffe08a'; ctx.lineWidth=3; ctx.stroke();
    } else {
      ctx.globalAlpha = fade*0.6;
      ctx.beginPath(); ctx.arc(x.x,x.y,x.r,0,Math.PI*2);
      ctx.strokeStyle='#ffb84a'; ctx.lineWidth=4; ctx.stroke();
    }
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
