/* ============================================================
   RENDER / DÜŞMANLAR — özel siluetli birimler (boss, küp, şişe,
   koza) ve geri kalan herkesin kullandığı genel çizim.
   drawEnemy() e.shape'e bakıp doğru çizime yönlendirir.
   ============================================================ */
/* Boss'un taşıdığı don fırtınası — zemin katmanında, düşmanlardan
   önce çizilir ki içindeki birimlerin üstünü kapatmasın. */
function drawBossAura(e){
  if(!e.auraRadius) return;
  const t0 = performance.now()/1000;
  ctx.save();
  const R = e.auraRadius;

  // Sürü Anası'nın müttefik-güçlendirme aurası sıcak/altın renkte —
  // Don Efendisi'nin soğuk mavi don fırtınasından görsel olarak
  // ayrışsın diye (biri kuleleri yavaşlatır, diğeri düşmanları güçlendirir).
  const warm = !!e.allyBuffTypes;
  const c0 = warm ? 'rgba(245,210,90,0.04)'  : 'rgba(150,220,245,0.03)';
  const c1 = warm ? 'rgba(230,180,60,0.11)'  : 'rgba(120,200,235,0.10)';
  const c2 = warm ? 'rgba(200,150,40,0.02)'  : 'rgba(90,170,215,0.02)';
  const dotColor = warm ? 'rgba(255,235,180,0.6)' : 'rgba(230,250,255,0.55)';

  const g = ctx.createRadialGradient(e.x,e.y,R*0.2,e.x,e.y,R);
  g.addColorStop(0,c0);
  g.addColorStop(0.7,c1);
  g.addColorStop(1,c2);
  ctx.beginPath(); ctx.arc(e.x,e.y,R,0,Math.PI*2);
  ctx.fillStyle=g; ctx.fill();

  // içeride savrulan zerrecikler — sınırı çember yerine bu belirtir
  for(let i=0;i<18;i++){
    const ang = t0*0.5 + i*(Math.PI*2/18);
    const rr = R*(0.35 + ((t0*0.25+i*0.11)%1)*0.62);
    const sx = e.x+Math.cos(ang)*rr, sy = e.y+Math.sin(ang)*rr;
    ctx.beginPath(); ctx.arc(sx,sy,1.6,0,Math.PI*2);
    ctx.fillStyle=dotColor; ctx.fill();
  }
  ctx.restore();
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

  // etrafında dönen buz parçaları — fxPhase her boss'un yörüngesini
  // kaydırır, yoksa sahadaki bütün Don Efendileri aynı anda döner.
  const ph = e.fxPhase || 0;
  for(let i=0;i<5;i++){
    const ang = t0*0.9 + i*(Math.PI*2/5) + ph;
    const rr = R+16+Math.sin(t0*2+i+ph)*4;
    ctx.save();
    ctx.translate(Math.cos(ang)*rr, Math.sin(ang)*rr*0.7);
    ctx.rotate(t0*2+i+ph);
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
  ctx.fillStyle=enemyHpColor(e); ctx.fillRect(-w/2, -R-13, w*(e.hp/e.maxHp), 4);
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
  ctx.fillStyle=enemyHpColor(e); ctx.fillRect(-w/2,-R-14,w*(e.hp/e.maxHp),4);
  ctx.restore();
}

/* KIVILCIM KOZASI — nabız gibi atan, içi lav/spor dolu şişkin bir koza.
   Bacak/göz yok; organik bir tehlike hissi versin diye sadece dışa
   taşan bir nabız halkası ve içte parlayan bir köz var. */
function drawCocoonEnemy(e){
  const t0 = performance.now()/1000;
  const R = e.radius;
  const bob = Math.sin(e.bounce)*2;
  const flash = Math.max(0,e.flashT||0) > 0.05;
  const pulse = 0.5 + 0.5*Math.sin(t0*3.4 + e.bounce);

  ctx.save();
  ctx.translate(e.x, e.y + Math.abs(bob));

  // gölge
  ctx.beginPath(); ctx.ellipse(0, R+5, R*0.78, R*0.26, 0, 0, Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();

  // dışa taşan nabız halkası — patlama tehlikesini önceden hissettirir
  ctx.beginPath(); ctx.ellipse(0, 0, R*(1.15+pulse*0.2), R*(1.32+pulse*0.22), 0, 0, Math.PI*2);
  ctx.fillStyle = `rgba(255,120,60,${0.08+pulse*0.10})`; ctx.fill();

  // koza gövdesi — organik, oval
  ctx.beginPath();
  ctx.ellipse(0, 0, R*0.86, R*1.05, 0, 0, Math.PI*2);
  const g = ctx.createRadialGradient(-R*0.25,-R*0.3,2,0,0,R*1.15);
  g.addColorStop(0, flash?'#ffffff':'#ff9a5c');
  g.addColorStop(0.55, flash?'#ffffff':e.body);
  g.addColorStop(1, flash?'#ffffff':e.body2);
  ctx.fillStyle=g; ctx.fill();
  ctx.lineWidth=2.2; ctx.strokeStyle='#3a0f05'; ctx.stroke();

  // içindeki közün nabzı
  if(!flash){
    ctx.beginPath();
    ctx.arc(0, R*0.05, R*(0.26+pulse*0.16), 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,214,120,${0.55+pulse*0.35})`;
    ctx.fill();
  }

  // koza dikişleri/çatlakları
  ctx.strokeStyle='rgba(58,15,5,0.55)'; ctx.lineWidth=1.4;
  [[-0.5,-0.7,0.15,0.4],[0.55,-0.6,-0.1,0.5],[-0.2,0.3,0.35,0.85]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();
    ctx.moveTo(x1*R, y1*R);
    ctx.quadraticCurveTo((x1+x2)/2*R, (y1+y2)/2*R + R*0.15, x2*R, y2*R);
    ctx.stroke();
  });

  ctx.restore();

  // can barı
  const w=R*2.1;
  ctx.save();
  ctx.translate(e.x, e.y + Math.abs(bob));
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-w/2,-R-14,w,4);
  ctx.fillStyle=enemyHpColor(e); ctx.fillRect(-w/2,-R-14,w*(e.hp/e.maxHp),4);
  ctx.restore();
}

/* ZIRHLI'nın göğüs plakası — gövdenin ÜSTÜNE, gözlerin ALTINA çizilir
   ki hem plaka baskın dursun hem düşman "yüzsüz bir kalkan" olmasın.
   Plaka aşındıkça çatlaklar çoğalır, kırılınca yerinde yalnızca kopmuş
   kayışlar kalır: oyuncu tek bakışta hangi aşamada olduğunu görür.
   Durumun kaynağı e.armor / e.armorMax (bkz. applyDamage,
   engine-update.js); burada hiçbir şey hesaplanmaz, yalnızca çizilir. */
function drawArmorPlate(e){
  const R = e.radius;
  const cy = R*0.16;                       // plakanın merkezi biraz aşağıda
  const w = R*1.62, h = R*1.34;
  const broken = !(e.armor > 0);

  ctx.save();

  if(broken){
    // Kopmuş kayışlar — plakanın nereden söküldüğü belli olsun
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    [-1, 1].forEach(s=>{
      ctx.beginPath();
      ctx.moveTo(s*w*0.42, cy - h*0.42);
      ctx.quadraticCurveTo(s*w*0.56, cy - h*0.05, s*w*0.34, cy + h*0.30);
      ctx.stroke();
    });
    // yerinden sökülmüş perçin izleri
    ctx.fillStyle = 'rgba(30,24,18,0.45)';
    [[-0.34,-0.30],[0.34,-0.30],[-0.30,0.34],[0.30,0.34]].forEach(([px,py])=>{
      ctx.beginPath(); ctx.arc(px*w, cy+py*h, 1.5, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();
    return;
  }

  const frac = Math.max(0, Math.min(1, e.armor / (e.armorMax || 1)));
  const wear = 1 - frac;                   // 0 = yepyeni, 1 = kopmak üzere
  const spark = Math.max(0, e.armorFlash || 0) / 0.28;

  // gövde: dikey çelik gradyanı + hafif kubbe hissi
  const g = ctx.createLinearGradient(0, cy-h/2, 0, cy+h/2);
  g.addColorStop(0,    '#e2e9ef');
  g.addColorStop(0.42, '#9fadb9');
  g.addColorStop(1,    '#5b6773');
  ctx.beginPath();
  ctx.moveTo(-w/2, cy - h*0.42);
  ctx.quadraticCurveTo(0, cy - h*0.62, w/2, cy - h*0.42);   // üst kavis
  ctx.lineTo(w/2, cy + h*0.14);
  ctx.quadraticCurveTo(0, cy + h*0.62, -w/2, cy + h*0.14);  // sivri alt uç
  ctx.closePath();
  ctx.fillStyle = spark > 0 ? '#ffffff' : g;
  ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = '#2b333c'; ctx.stroke();

  // orta sırt
  ctx.beginPath();
  ctx.moveTo(0, cy - h*0.46); ctx.lineTo(0, cy + h*0.44);
  ctx.strokeStyle = 'rgba(40,50,60,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();

  // perçinler
  ctx.fillStyle = '#eef3f7'; ctx.strokeStyle = '#39434d'; ctx.lineWidth = 0.9;
  [[-0.34,-0.26],[0.34,-0.26],[-0.30,0.24],[0.30,0.24]].forEach(([px,py])=>{
    ctx.beginPath(); ctx.arc(px*w, cy+py*h, 1.7, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  });

  /* Çatlaklar — aşınmayla birlikte çoğalır (0, 1, 2, 3).
     Konumları sabit bir tablodan geliyor: her karede rastgele
     çizilirse plaka titrer gibi görünürdü. */
  const cracks = Math.floor(wear * 4);
  if(cracks > 0){
    const lines = [
      [[-0.30,-0.34],[-0.06,-0.02],[-0.18, 0.26]],
      [[ 0.32,-0.20],[ 0.08, 0.06],[ 0.22, 0.36]],
      [[-0.02,-0.44],[ 0.14,-0.10],[-0.10, 0.14]],
    ];
    ctx.strokeStyle = 'rgba(26,32,38,0.75)'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
    for(let i=0;i<Math.min(cracks, lines.length);i++){
      ctx.beginPath();
      lines[i].forEach(([px,py], k)=>{
        const x = px*w, y = cy + py*h;
        if(k === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }
  }

  // isabet kıvılcımı
  if(spark > 0){
    ctx.beginPath();
    ctx.arc(0, cy, R*0.9*(0.5+spark*0.6), 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,246,200,'+(0.75*spark)+')';
    ctx.lineWidth = 2; ctx.stroke();
  }

  ctx.restore();
}

/* Can çubuğunun rengi. Yaralı eşiğinin (WOUNDED_HP_FRAC, config.js)
   altına inen düşman %30 yavaşlar; çubuğun kırmızıya dönmesi bunun
   tek görsel işareti — oyuncu "bu neden ağırlaştı?" diye sormasın. */
function enemyHpColor(e){
  return (e.maxHp > 0 && e.hp <= e.maxHp * WOUNDED_HP_FRAC) ? '#ff6b5c' : '#7fe3b4';
}

function drawEnemy(e){
  if(e.shape==='boss'){ drawBossEnemy(e); return; }
  if(e.shape==='cube'){ drawCubeEnemy(e); return; }
  if(e.shape==='flask'){ drawFlaskEnemy(e); return; }
  if(e.shape==='cocoon'){ drawCocoonEnemy(e); return; }
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

  if(e.armorMax > 0) drawArmorPlate(e);

  /* Plaka koptuğu anda beyaz bir şok halkası — kırılmanın oyuncunun
     gözünden kaçmaması için (sesi de eşlik eder, bkz. playArmorHit). */
  if(e.armorBroke > 0){
    const k = e.armorBroke / 0.6;
    ctx.beginPath(); ctx.arc(0, 0, e.radius*(1.1 + (1-k)*1.1), 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(226,236,244,'+(0.8*k)+')'; ctx.lineWidth = 2.5; ctx.stroke();
  }

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
    ctx.fillText('+', 0, -e.radius - 6 - (((t0 + (e.fxPhase||0))*20)%10));
  }

  // ZEHİR: yükselen yeşil kabarcıklar — ateşle ORTAK yuvayı paylaşır,
  // o yüzden hangisinin aktif olduğu dotKind ile ayırt edilir.
  if(e.dotT > 0 && e.dotKind === 'poison'){
    const t0 = performance.now()/1000;
    ctx.beginPath(); ctx.arc(0,0,e.radius+1,0,Math.PI*2);
    ctx.fillStyle='rgba(150,220,80,0.28)'; ctx.fill();
    const ph = e.fxPhase || 0;
    for(let i=0;i<3;i++){
      const cyc = (t0*1.1 + i*0.33 + ph) % 1;
      const bx = (i-1)*e.radius*0.45;
      const by = -cyc*(e.radius+10);
      ctx.beginPath(); ctx.arc(bx, by, 1.6*(1-cyc*0.5), 0, Math.PI*2);
      ctx.fillStyle=`rgba(180,240,110,${0.8*(1-cyc)})`; ctx.fill();
    }
  }

  /* YANIYOR — Ateş Kulesi'nin lavına değen her düşman, yanma süresi
     boyunca gerçekten alev alır: gövdeyi saran sıcak hale, çepeçevre
     titreyen alev dilleri ve yükselen korlar. Zehirle ORTAK dot
     yuvasını paylaştığı için ayrım dotKind ile yapılır. */
  if(e.dotT > 0 && e.dotKind === 'fire'){
    const t0 = performance.now()/1000;
    // fxPhase: her yanan düşmanın alevi kendi fazında oynasın —
    // yoksa sahadaki bütün alevler aynı anda titrer.
    const ph = e.fxPhase || 0;
    const flick = 0.75 + Math.sin(t0*17 + e.bounce)*0.25;

    // 1) gövdeyi saran sıcak hale
    const halo = ctx.createRadialGradient(0,0,e.radius*0.4, 0,0,e.radius+9*flick);
    halo.addColorStop(0,   'rgba(255,196,80,0.34)');
    halo.addColorStop(0.6, 'rgba(255,110,36,0.28)');
    halo.addColorStop(1,   'rgba(190,40,14,0)');
    ctx.beginPath(); ctx.arc(0,0,e.radius+9*flick,0,Math.PI*2);
    ctx.fillStyle=halo; ctx.fill();

    // 2) gövdenin çevresini saran alev dilleri — her biri kendi fazında
    const tongues = 7;
    for(let i=0;i<tongues;i++){
      const a = i*(Math.PI*2/tongues) + Math.sin(t0*1.3+i+ph)*0.12;
      const wob = 0.6 + 0.4*Math.sin(t0*11 + i*2.3 + ph);
      const h = (e.radius*0.62 + 5) * wob;          // dilin boyu
      const w = e.radius*0.30;                      // dilin genişliği
      const bx = Math.cos(a)*e.radius*0.92;
      const by = Math.sin(a)*e.radius*0.92;
      ctx.save();
      ctx.translate(bx,by);
      // Diller gövdeye dik değil, her zaman YUKARI uzanır (alev
      // yerçekimine karşı yükselir) — böylece top gibi değil, yanan
      // bir şey görünür. Hafif sallanma rüzgâr hissi verir.
      ctx.rotate(Math.cos(t0*3+i+ph)*0.22);
      ctx.beginPath();
      ctx.moveTo(-w/2, 0);
      ctx.quadraticCurveTo(-w*0.55, -h*0.55, 0, -h);
      ctx.quadraticCurveTo( w*0.55, -h*0.55, w/2, 0);
      ctx.closePath();
      const fg = ctx.createLinearGradient(0,0,0,-h);
      fg.addColorStop(0,   'rgba(255,240,170,'+(0.85*wob)+')');
      fg.addColorStop(0.45,'rgba(255,146,44,'+(0.72*wob)+')');
      fg.addColorStop(1,   'rgba(214,44,18,0)');
      ctx.fillStyle=fg; ctx.fill();
      ctx.restore();
    }

    // 3) tepede yükselen ana alev + kopan korlar
    for(let i=0;i<4;i++){
      const cyc = (t0*1.7 + i*0.26 + ph) % 1;
      const bx = (i-1.5)*e.radius*0.42 + Math.sin(t0*4+i+ph)*1.6;
      const by = -e.radius*0.6 - cyc*(e.radius+16);
      const r  = 2.4*(1-cyc*0.75);
      ctx.beginPath(); ctx.arc(bx,by,r,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,${150+Math.floor(cyc*95)},${50+Math.floor(cyc*60)},${0.9*(1-cyc)})`;
      ctx.fill();
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
  ctx.fillStyle=enemyHpColor(e); ctx.fillRect(-w/2,-e.radius-14,w*(e.hp/e.maxHp),4);
  // ZIRH ÇUBUĞU — canın hemen üstünde, çelik grisi. Plaka bitince
  // tamamen kaybolur; "artık savunmasız" mesajı çubuğun yokluğu.
  if(e.armorMax > 0 && e.armor > 0){
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-w/2,-e.radius-19,w,3);
    ctx.fillStyle='#c3ced9'; ctx.fillRect(-w/2,-e.radius-19,w*(e.armor/e.armorMax),3);
  }
  ctx.restore();
}
