/* ============================================================
   MAIN — girdi (mouse+touch), oyun döngüsü, başlangıç.
   Diğer tüm dosyalar yüklendikten sonra çalışır.
   ============================================================ */

/* Oyun sahasını, üst/alt barların GERÇEK yüksekliğini ölçerek
   kalan alana tam oturtur. Genişlik ve yükseklik TAM SAYI olarak
   verilir; aksi halde ondalık yuvarlama çerçevede boşluk bırakır. */
let lastFitKey = '';
function invalidateFit(){ lastFitKey = ''; }
function fitGameToViewport(){
  const wrap = document.querySelector('.wrap');
  const topBar = document.querySelector('.top-bar');
  const dock = document.querySelector('.bottom-dock');
  if(!wrap || !topBar || !dock) return;

  const wrapStyle = getComputedStyle(wrap);
  const padY = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom);
  const padX = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight);

  const viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const viewportW = window.visualViewport ? window.visualViewport.width : window.innerWidth;

  // Menüdeyken barlar gizli (offsetHeight = 0), saha tüm alanı kullanır.
  const inMenu = document.body.classList.contains('in-menu');
  const barsH = inMenu ? 0 : (topBar.offsetHeight + dock.offsetHeight + 12 + 8);

  const availH = Math.max(240, viewportH - padY - barsH);
  // Çerçeve kenarlığı (2×4px) da genişliğe dahil olduğu için düşülür
  const availW = Math.max(200, viewportW - padX - 8);

  // 3:5 oranını koruyarak hem genişliğe hem yüksekliğe sığdır.
  // Önce genişliği tam sayıya yuvarla, yüksekliği ondan türet:
  // böylece oran hatası hiç birikmez ve çerçeve tam oturur.
  const maxH = Math.min(availH, availW * 5 / 3);
  const w = Math.floor(maxH * 3 / 5);
  const h = Math.round(w * 5 / 3);

  // Aynı ölçüde ise DOM'a hiç dokunma (gereksiz reflow/titremeyi önler)
  const key = w + 'x' + h;
  if(key === lastFitKey) return;
  lastFitKey = key;

  document.documentElement.style.setProperty('--game-w', w + 'px');
  document.documentElement.style.setProperty('--game-h', h + 'px');
}

/* Art arda gelen boyut olaylarını tek bir kareye topla */
let fitScheduled = false;
function scheduleFit(){
  if(fitScheduled) return;
  fitScheduled = true;
  requestAnimationFrame(()=>{ fitScheduled = false; fitGameToViewport(); });
}

window.addEventListener('resize', scheduleFit);
window.addEventListener('orientationchange', ()=>setTimeout(fitGameToViewport, 250));
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', scheduleFit);
}
// Barların yüksekliği değişirse (yazı tipi yüklenmesi, HUD içeriği vb.)
// sahayı yeniden ölç. Kule menüsü artık düzeni itmediği için burayı
// tetiklemez; oyun sahası menü açılırken sabit kalır.
if(window.ResizeObserver){
  const ro = new ResizeObserver(scheduleFit);
  const observeBars = ()=>{
    const tb = document.querySelector('.top-bar');
    const bd = document.querySelector('.bottom-dock');
    if(tb) ro.observe(tb);
    if(bd) ro.observe(bd);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', observeBars);
  else observeBars();
}

function loop(now){
  const raw = Math.min((now-lastTime)/1000, 0.05);
  lastTime = now;
  if(!paused){
    // Yüksek hızlarda tek karede büyük dt sıçraması, düşmanların
    // kule menzillerini atlamasına yol açar. Bu yüzden simülasyon
    // sabit tavanlı alt adımlara bölünerek çalıştırılır.
    let remaining = raw * gameSpeed;
    const MAX_STEP = 0.034;
    let guard = 0;
    while(remaining > 0 && guard < 8){
      const step = Math.min(remaining, MAX_STEP);
      update(step);
      remaining -= step;
      guard++;
    }
  }
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
  if(document.getElementById('shopOverlay').classList.contains('show')) return true;
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
  const t={
    x:closest.x, y:closest.y, def, cooldown:0, pulse:0,
    level:0, totalSpent:def.cost,
    targetMode:'first',
    buildDuration: buildDurationFor(0),
    buildLeft: buildDurationFor(0),
    pendingLevel: null,
  };
  towers.push(t); closest.occ=t;
  playMenuTap();
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

/* ---- Ana menü gezinme ---- */
document.getElementById('mmLevels').addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuLevels'); });
document.getElementById('mmSettings').addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuSettings'); });
document.getElementById('mmAbout').addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuAbout'); });
document.getElementById('shopBtn').addEventListener('pointerup', openShopOverlay);
document.getElementById('shopCloseBtn').addEventListener('pointerup', closeShopOverlay);
document.querySelectorAll('[data-back]').forEach(btn=>{
  btn.addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuMain'); });
});

document.getElementById('mmContinue').addEventListener('pointerup', ()=>{
  const btn = document.getElementById('mmContinue');
  if(btn.disabled) return;
  const r = getResume();
  if(!r || !LEVELS[r.levelIdx]) return;
  ensureAudioCtx();
  playMenuTap();
  loadLevel(r.levelIdx);
  closeStartScreen();
});

document.getElementById('resetProgressBtn').addEventListener('pointerup', ()=>{
  playMenuTap();
  const btn = document.getElementById('resetProgressBtn');
  if(btn.dataset.confirm==='1'){
    try{
      localStorage.removeItem('rr_progress_v1');
      localStorage.removeItem('rr_gems_v1');
      localStorage.removeItem('rr_resume_v1');
    }catch(e){}
    btn.dataset.confirm='';
    btn.textContent='✅ Sıfırlandı';
    setTimeout(()=>{ btn.textContent='🗑️ İlerlemeyi Sıfırla'; }, 1500);
    refreshGemDisplay();
    refreshContinueButton();
    renderStartLevelList();
  } else {
    btn.dataset.confirm='1';
    btn.textContent='⚠️ Emin misin? Tekrar bas';
    setTimeout(()=>{
      if(btn.dataset.confirm==='1'){
        btn.dataset.confirm='';
        btn.textContent='🗑️ İlerlemeyi Sıfırla';
      }
    }, 3000);
  }
});

document.getElementById('fsBtn').addEventListener('pointerup', ()=>{
  playMenuTap();
  const el = document.documentElement;
  if(!document.fullscreenElement && !document.webkitFullscreenElement){
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if(req) req.call(el).catch(()=>{});
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if(exit) exit.call(document).catch(()=>{});
  }
});
document.addEventListener('fullscreenchange', ()=>{
  const btn = document.getElementById('fsBtn');
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.textContent = isFs ? '⛗' : '⛶';
  setTimeout(fitGameToViewport, 120);
});

syncSoundButtons();
renderTowerSelectBtn();
renderTowerDrawer();
loadLevel(0);
showMenuPage('menuMain');
fitGameToViewport();
// Yazı tipleri yüklenince bar yükseklikleri değişebilir; yeniden ölç.
if(document.fonts && document.fonts.ready){
  document.fonts.ready.then(()=>fitGameToViewport());
}
window.addEventListener('load', fitGameToViewport);
requestAnimationFrame(loop);
