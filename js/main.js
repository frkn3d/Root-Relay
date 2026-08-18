/* ============================================================
   MAIN — girdi (mouse+touch), oyun döngüsü, başlangıç.
   Diğer tüm dosyalar yüklendikten sonra çalışır.
   ============================================================ */
function loop(now){
  const dt = Math.min((now-lastTime)/1000, 0.05) * gameSpeed;
  lastTime = now;
  if(!paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

function pointerToLogical(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  return { x:(clientX-rect.left)*(LW/rect.width), y:(clientY-rect.top)*(LH/rect.height) };
}
canvas.addEventListener('pointerup',(e)=>{
  if(gameOver||gameWon||paused) return;
  if(!document.getElementById('startScreen').classList.contains('hide')) return;
  if(document.getElementById('towerDrawer').classList.contains('show')){
    closeTowerDrawer();
    return;
  }
  const {x:mx,y:my} = pointerToLogical(e.clientX,e.clientY);

  let tappedTower=null, bestDT=Infinity;
  towers.forEach(t=>{
    const d=Math.hypot(mx-t.x,my-t.y);
    if(d<26 && d<bestDT){bestDT=d; tappedTower=t;}
  });
  if(tappedTower){
    if(selectedTower===tappedTower && towerPanelOpen) closeTowerPanel();
    else openTowerPanel(tappedTower);
    return;
  }
  if(towerPanelOpen){ closeTowerPanel(); return; }

  let closest=null,bestD=Infinity;
  spots.forEach(s=>{
    if(s.occ) return;
    const d=Math.hypot(mx-s.x,my-s.y);
    if(d<28 && d<bestD){bestD=d; closest=s;}
  });
  if(!closest) return;
  const def=TOWER_TYPES[selectedType];
  if(gold<def.cost){
    playError();
    const chip=document.getElementById('goldChip');
    chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
    return;
  }
  gold-=def.cost;
  document.getElementById('goldVal').textContent=gold;
  const t={x:closest.x,y:closest.y,def,cooldown:0,pulse:0,level:0,totalSpent:def.cost};
  towers.push(t); closest.occ=t;
  playPlace();
});

document.getElementById('waveBtn').addEventListener('pointerup', startWave);
document.getElementById('resetBtn').addEventListener('pointerup', ()=>loadLevel(currentLevelIdx));
document.getElementById('overlayBtn').addEventListener('pointerup', ()=>loadLevel(currentLevelIdx));
document.getElementById('pauseBtn').addEventListener('pointerup', togglePause);
document.getElementById('resumeBtn').addEventListener('pointerup', togglePause);
document.getElementById('speedBtn').addEventListener('pointerup', toggleSpeed);
document.getElementById('towerSelectBtn').addEventListener('pointerup', toggleTowerDrawer);
document.getElementById('tpUpgradeBtn').addEventListener('pointerup', doUpgradeTower);
document.getElementById('tpSellBtn').addEventListener('pointerup', requestSellTower);
document.getElementById('tpSellCancel').addEventListener('pointerup', cancelSellTower);
document.getElementById('tpSellYes').addEventListener('pointerup', confirmSellTower);
document.getElementById('tpCloseBtn').addEventListener('pointerup', closeTowerPanel);
document.getElementById('ssPlayBtn').addEventListener('pointerup', ()=>{
  ensureAudioCtx();
  playClick();
  document.getElementById('startScreen').classList.add('hide');
});
document.getElementById('soundBtn').addEventListener('pointerup', toggleSound);
document.getElementById('soundBtnTop').addEventListener('pointerup', toggleSound);

syncSoundButtons();
renderTowerSelectBtn();
renderTowerDrawer();
loadLevel(0);
requestAnimationFrame(loop);
