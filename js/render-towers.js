/* ============================================================
   RENDER / KULE SARMALAYICI — kule tipini seçip çizdiren dağıtıcı
   (drawTower) ve kulenin çevresindeki durum göstergeleri:
   menzil halkası, inşa ilerlemesi, seviye aurası, don/körlük rozetleri.
   Kule gövdelerinin kendisi render-tower-art.js'te.
   ============================================================ */
/* Yükseltilmiş kulelerin çevresinde dönen enerji parçacıkları —
   seviye sayısı kadar parçacık döner. Renk artık sabit altın değil,
   KULENİN KENDİ RENGİ (TOWER_TYPES[...].color): zehir yeşil, lazer
   mavi, ateş turuncu… böylece kule tipi uzaktan da okunabiliyor. */
function drawLevelAura(t){
  const lvl = t.level||0;
  if(lvl<=0) return;
  const t0 = performance.now()/1000;
  const col = brightenColor(t.def.color, lvl);
  ctx.save();
  for(let i=0;i<lvl;i++){
    const ang = t0*(0.8+i*0.35) + i*(Math.PI*2/3);
    const rad = 22 + i*5;
    const px = t.x + Math.cos(ang)*rad;
    const py = t.y - 4 + Math.sin(ang)*rad*0.45;
    // ince bir kuyruk: parçacığın döndüğü yön belli olsun
    ctx.beginPath();
    ctx.ellipse(t.x, t.y-4, rad, rad*0.45, 0, ang-0.45, ang);
    ctx.strokeStyle = t.def.color+'55';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(px,py,2.2,0,Math.PI*2);
    ctx.fillStyle = col;
    ctx.shadowColor = t.def.color; ctx.shadowBlur = 8;
    ctx.fill();
  }
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
  ctx.strokeStyle = t.pendingLevel ? '#f4c04a' : t.def.color;
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

/* Kıvılcım Kozası'nın patlaması bir kuleyi kör ettiğinde — o kule
   ateş edemezken üstünde turuncu, dönen bir polen/toz halkası. */
function drawBlindBadge(t){
  if(!(t.blindT > 0)) return;
  const t0 = performance.now()/1000;
  ctx.save();
  ctx.beginPath(); ctx.arc(t.x, t.y, 24, 0, Math.PI*2);
  ctx.strokeStyle='rgba(255,160,90,'+(0.5+Math.sin(t0*5)*0.2)+')';
  ctx.lineWidth=2; ctx.setLineDash([3,4]); ctx.lineDashOffset=-t0*14;
  ctx.stroke(); ctx.setLineDash([]);
  ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('💫', t.x, t.y-30);
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
  else if(t.def.kind==='poison') drawPoisonTower(t);
  else if(t.def.kind==='bolt') drawBoltTower(t);
  else if(t.def.kind==='fire') drawFireTower(t);
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
