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

const MOVE_CANCEL_PX = 12;
let pressTimer = null;
let pressStartPos = null;
let pressTower = null;
let longPressFired = false;

function findTowerAt(mx,my){
  let found=null, bestD=Infinity;
  towers.forEach(t=>{
    const d=Math.hypot(mx-t.x,my-t.y);
    if(d<26 && d<bestD){bestD=d; found=t;}
  });
  return found;
}

function canvasInputBlocked(){
  if(gameOver||gameWon||paused) return true;
  if(!document.getElementById('startScreen').classList.contains('hide')) return true;
  return false;
}

canvas.addEventListener('pointerdown',(e)=>{
  if(canvasInputBlocked()) return;
  if(document.getElementById('towerDrawer').classList.contains('show')) return;
  const {x:mx,y:my} = pointerToLogical(e.clientX,e.clientY);
  pressStartPos = {x:mx,y:my};
  longPressFired = false;
  pressTower = findTowerAt(mx,my);
  if(pressTower){
    pressProgressTower = pressTower;
    pressProgressStart = performance.now();
    clearTimeout(pressTimer);
    pressTimer = setTimeout(()=>{
      longPressFired = true;
      pressProgressTower = null;
      openTowerPanel(pressTower);
      if(navigator.vibrate) { try{ navigator.vibrate(15); }catch(e){} }
    }, LONG_PRESS_MS);
  }
});

canvas.addEventListener('pointermove',(e)=>{
  if(!pressStartPos) return;
  const {x:mx,y:my} = pointerToLogical(e.clientX,e.clientY);
  if(Math.hypot(mx-pressStartPos.x,my-pressStartPos.y) > MOVE_CANCEL_PX){
    clearTimeout(pressTimer); pressTimer=null;
    pressProgressTower = null;
  }
});

function cancelPress(){
  clearTimeout(pressTimer); pressTimer=null;
  pressStartPos=null; pressTower=null; longPressFired=false;
  pressProgressTower=null;
}
canvas.addEventListener('pointercancel', cancelPress);
canvas.addEventListener('pointerleave', ()=>{ clearTimeout(pressTimer); pressTimer=null; pressProgressTower=null; });

canvas.addEventListener('pointerup',(e)=>{
  clearTimeout(pressTimer); pressTimer=null;
  pressProgressTower=null;
  if(canvasInputBlocked()){ cancelPress(); return; }
  if(document.getElementById('towerDrawer').classList.contains('show')){
    closeTowerDrawer();
    cancelPress();
    return;
  }
  if(longPressFired){
    // panel zaten basılı-tutma zamanlayıcısı tarafından açıldı
    cancelPress();
    return;
  }

  const {x:mx,y:my} = pointerToLogical(e.clientX,e.clientY);
  const tappedTower = pressTower || findTowerAt(mx,my);

  // Tek tık bir kulenin üzerindeyse: sadece menzil çemberini göster/gizle.
  if(tappedTower){
    if(towerPanelOpen) closeTowerPanel();
    activeTowerRing = (activeTowerRing===tappedTower) ? null : tappedTower;
    cancelPress();
    return;
  }

  // Boş bir alana tıklandı: açık panel/halka varsa önce onu kapat.
  if(towerPanelOpen){ closeTowerPanel(); cancelPress(); return; }
  if(activeTowerRing){ activeTowerRing=null; cancelPress(); return; }

  let closest=null,bestD=Infinity;
  spots.forEach(s=>{
    if(s.occ) return;
    const d=Math.hypot(mx-s.x,my-s.y);
    if(d<28 && d<bestD){bestD=d; closest=s;}
  });
  if(!closest){ cancelPress(); return; }
  const def=TOWER_TYPES[selectedType];
  if(gold<def.cost){
    playError();
    const chip=document.getElementById('goldChip');
    chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake');
    cancelPress();
    return;
  }
  gold-=def.cost;
  document.getElementById('goldVal').textContent=gold;
  const t={x:closest.x,y:closest.y,def,cooldown:0,pulse:0,level:0,totalSpent:def.cost};
  towers.push(t); closest.occ=t;
  playPlace();
  cancelPress();
});

document.getElementById('waveBtn').addEventListener('pointerup', startWave);
document.getElementById('overlayBtn').addEventListener('pointerup', ()=>{ playMenuTap(); loadLevel(currentLevelIdx); });
document.getElementById('restartBtnPause').addEventListener('pointerup', ()=>{ playMenuTap(); loadLevel(currentLevelIdx); });
document.getElementById('pauseBtn').addEventListener('pointerup', togglePause);
document.getElementById('resumeBtn').addEventListener('pointerup', togglePause);
document.getElementById('speedBtn').addEventListener('pointerup', toggleSpeed);
document.getElementById('towerSelectBtn').addEventListener('pointerup', toggleTowerDrawer);
document.getElementById('tpUpgradeBtn').addEventListener('pointerup', doUpgradeTower);
document.getElementById('tpSellBtn').addEventListener('pointerup', requestSellTower);
document.getElementById('tpSellCancel').addEventListener('pointerup', cancelSellTower);
document.getElementById('tpSellYes').addEventListener('pointerup', confirmSellTower);
document.getElementById('tpCloseBtn').addEventListener('pointerup', ()=>{ playMenuTap(); closeTowerPanel(); });
document.getElementById('mainMenuBtnPause').addEventListener('pointerup', goToMainMenu);
document.getElementById('mainMenuBtnOverlay').addEventListener('pointerup', goToMainMenu);
document.getElementById('soundBtn').addEventListener('pointerup', toggleSound);
document.getElementById('soundBtnPause').addEventListener('pointerup', toggleSound);

syncSoundButtons();
renderTowerSelectBtn();
renderTowerDrawer();
loadLevel(0);
requestAnimationFrame(loop);
