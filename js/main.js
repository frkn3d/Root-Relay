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

  /* iOS Safari'de window.innerHeight, araç çubuklarının kapladığı alanı
     içerir; bu yüzden içerik çubukların altında kalır. visualViewport
     gerçekten görünen alanı verdiği için önceliklidir. */
  const vv = window.visualViewport;
  const viewportH = vv ? vv.height : window.innerHeight;
  const viewportW = vv ? vv.width  : window.innerWidth;

  // Menüdeyken barlar gizli (yükseklik 0), saha tüm alanı kullanır.
  const inMenu = document.body.classList.contains('in-menu');
  // getBoundingClientRect kesirli yükseklikleri de doğru verir
  const barsH = inMenu ? 0 :
    (topBar.getBoundingClientRect().height + dock.getBoundingClientRect().height + 12 + 8);

  const availH = Math.max(200, viewportH - padY - barsH);
  const availW = Math.max(180, viewportW - padX - 8);

  // 3:5 oranını koruyarak sığdır; genişliği tam sayıya yuvarlayıp
  // yüksekliği ondan türet — böylece çerçevede boşluk kalmaz.
  const maxH = Math.min(availH, availW * 5 / 3);
  const w = Math.floor(maxH * 3 / 5);
  const h = Math.round(w * 5 / 3);

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
window.addEventListener('orientationchange', ()=>{
  // iOS yeni boyutları hemen bildirmez; birkaç kez tekrar ölç.
  [60, 250, 600].forEach(ms=>setTimeout(()=>{ invalidateFit(); fitGameToViewport(); }, ms));
});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', scheduleFit);
  // iOS'ta araç çubukları kayarken 'scroll' tetiklenir, 'resize' değil
  window.visualViewport.addEventListener('scroll', scheduleFit);
}
// Sekmeye geri dönüldüğünde iOS bazen eski ölçüleri korur
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden){ invalidateFit(); scheduleFit(); }
});
window.addEventListener('pageshow', ()=>{ invalidateFit(); scheduleFit(); });
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
// Kule çekmecesi açıkken canvas'ta başlayan dokunuşun izi — çekmeceyi
// yalnızca GERÇEK bir dokunuş (az hareket) kapatsın; çekmecedeki
// kartları kaydırmaya çalışırken parmak birkaç piksel canvas'a taşarsa
// artık çekmece anında kapanmıyor.
let drawerDismissStart = null;

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
  if(document.getElementById('towerDrawer').classList.contains('show')){
    drawerDismissStart = {x:e.clientX, y:e.clientY};
    return;
  }
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
  pressProgressTower=null; drawerDismissStart=null;
}
canvas.addEventListener('pointercancel', cancelPress);
canvas.addEventListener('pointerleave', ()=>{ clearTimeout(pressTimer); pressTimer=null; pressProgressTower=null; });

canvas.addEventListener('pointerup',(e)=>{
  clearTimeout(pressTimer); pressTimer=null;
  pressProgressTower=null;
  if(canvasInputBlocked()){ cancelPress(); return; }
  if(document.getElementById('towerDrawer').classList.contains('show')){
    const start = drawerDismissStart;
    const moved = start ? Math.hypot(e.clientX-start.x, e.clientY-start.y) : 0;
    // Sadece gerçek bir dokunuşsa (sürükleme/kaydırma değilse) kapat —
    // aksi halde çekmecedeki kartları kaydırmaya çalışan bir parmağın
    // canvas'a birkaç piksel taşması çekmeceyi anında kapatıyordu.
    if(moved <= MOVE_CANCEL_PX) closeTowerDrawer();
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

  // Boş bir alana tıklandı: açık panel/halka/onay varsa önce onu kapat.
  if(towerPanelOpen){ closeTowerPanel(); cancelPress(); return; }
  if(activeTowerRing){ activeTowerRing=null; cancelPress(); return; }

  let closest=null,bestD=Infinity;
  spots.forEach(s=>{
    if(s.occ) return;
    const d=Math.hypot(mx-s.x,my-s.y);
    if(d<28 && d<bestD){bestD=d; closest=s;}
  });

  if(!closest){
    // Boşluğa tıklandı — bekleyen onay varsa iptal et
    if(pendingSpot) closeBuildConfirm();
    cancelPress();
    return;
  }

  // Aynı noktaya tekrar dokunulduysa onayı kapat, değilse yeni onay aç
  if(pendingSpot === closest) closeBuildConfirm();
  else openBuildConfirm(closest);
  cancelPress();
});

document.getElementById('waveBtn').addEventListener('pointerup', startWave);
document.getElementById('overlayBtn').addEventListener('pointerup', ()=>{ playMenuTap(); loadLevel(currentLevelIdx); });
document.getElementById('nextLevelBtn').addEventListener('pointerup', ()=>{
  if(level && level.generated){
    if(level.levelNo >= GEN.TOTAL_LEVELS) return;
    playMenuTap();
    startGeneratedLevel(level.seed, level.levelNo + 1);
    return;
  }
  const next = currentLevelIdx + 1;
  if(!LEVELS[next]) return;
  playMenuTap();
  loadLevel(next);
  saveResume(next, 0);
});
document.getElementById('restartBtnPause').addEventListener('pointerup', ()=>{ playMenuTap(); loadLevel(currentLevelIdx); });
document.getElementById('menuBtn').addEventListener('pointerup', openPauseMenu);
document.getElementById('pauseToggleBtn').addEventListener('pointerup', toggleSimPause);
document.getElementById('resumeBtn').addEventListener('pointerup', resumeFromMenu);
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
document.getElementById('mmEndless').addEventListener('pointerup', ()=>{
  playMenuTap();
  showMenuPage('menuSeed');
  renderSeedPreview();
});
document.getElementById('seedRandomBtn').addEventListener('pointerup', ()=>{
  playMenuTap();
  document.getElementById('seedInput').value = 1 + Math.floor(Math.random()*GEN.TOTAL_LEVELS);
  renderSeedPreview();
});
document.getElementById('seedInput').addEventListener('input', renderSeedPreview);
document.getElementById('seedInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    e.preventDefault();
    e.target.blur();          // mobil klavyeyi kapat
    playSelectedGenLevel();
  }
});
document.getElementById('seedOkBtn').addEventListener('pointerup', ()=>{
  document.getElementById('seedInput').blur();
  playSelectedGenLevel();
});

function playSelectedGenLevel(){
  const inp = document.getElementById('seedInput');
  if(!inp.value.trim()){ playError(); return; }
  playMenuTap();
  const n = currentLevelNo();
  inp.value = n;                 // sınır dışıysa düzeltilmiş hali görünsün
  startGeneratedLevel(WORLD_SEED, n);
}

/* ============================================================
   GEÇİCİ — 1000 Bölüm test/gezinme butonları.
   Bölümleri hızlı kontrol etmek için üst bardaki ◀ ▶ ile bir üretilmiş
   bölümden diğerine geçiş. İleride kaldırılacak: bu blok +
   index.html'deki iki .level-nav-btn öğesi + css/style.css'teki
   ".level-nav-btn" kuralları silinince özellik tamamen gider
   (engine.js'teki loadLevel() içindeki tek satırlık çağrı, fonksiyon
   yoksa zaten sessizce hiçbir şey yapmaz).
   ============================================================ */
function updateLevelNavVisibility(){
  const on = currentLevelIdx === -1 && !!generatedLevel;
  const prevBtn = document.getElementById('levelPrevBtn');
  const nextBtn = document.getElementById('levelNextBtn');
  if(!prevBtn || !nextBtn) return;
  prevBtn.classList.toggle('show', on);
  nextBtn.classList.toggle('show', on);
  if(!on) return;
  prevBtn.classList.toggle('disabled', generatedLevel.levelNo <= 1);
  nextBtn.classList.toggle('disabled', generatedLevel.levelNo >= GEN.TOTAL_LEVELS);
}
document.getElementById('levelPrevBtn').addEventListener('pointerup', ()=>{
  if(!generatedLevel || generatedLevel.levelNo <= 1) return;
  playMenuTap();
  startGeneratedLevel(WORLD_SEED, generatedLevel.levelNo - 1);
  showWaveToast('Bölüm ' + generatedLevel.levelNo);
});
document.getElementById('levelNextBtn').addEventListener('pointerup', ()=>{
  if(!generatedLevel || generatedLevel.levelNo >= GEN.TOTAL_LEVELS) return;
  playMenuTap();
  startGeneratedLevel(WORLD_SEED, generatedLevel.levelNo + 1);
  showWaveToast('Bölüm ' + generatedLevel.levelNo);
});
/* /GEÇİCİ */
document.getElementById('mmHowTo').addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuHowTo'); });
document.getElementById('mmSettings').addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuSettings'); });
document.getElementById('mmAbout').addEventListener('pointerup', ()=>{ playMenuTap(); showMenuPage('menuAbout'); });
document.getElementById('bcOk').addEventListener('pointerup', (e)=>{ e.stopPropagation(); confirmBuild(); });
document.getElementById('bcCancel').addEventListener('pointerup', (e)=>{ e.stopPropagation(); playMenuTap(); closeBuildConfirm(); });
document.getElementById('shopBtn').addEventListener('pointerup', openShopOverlay);
document.getElementById('shopCloseBtn').addEventListener('pointerup', closeShopOverlay);
document.getElementById('gemBuyBtn').addEventListener('pointerup', ()=>{
  // TEST SÜRÜMÜ: her dokunuşta bedava 25 elmas.
  // İleride burası mağaza satın alması veya ödüllü reklam olacak.
  addGems(25);
  playCoin();
  refreshGemDisplay();
  renderShop();          // fiyatlar/pasiflik durumu tazelensin
});
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
    factoryReset();          // progress.js — tüm 'rr_' kayıtlarını siler
    soundEnabled = true;     // ses tercihi de varsayılana dönsün
    syncSoundButtons();
    btn.dataset.confirm='';
    btn.textContent='✅ Sıfırlandı';
    setTimeout(()=>{ btn.textContent='🗑️ Fabrika Ayarlarına Dön'; }, 1500);
    refreshGemDisplay();
    refreshContinueButton();
    renderStartLevelList();
    loadLevel(0);            // oyun durumunu da başa al
  } else {
    btn.dataset.confirm='1';
    btn.textContent='⚠️ Emin misin? Tekrar bas';
    setTimeout(()=>{
      if(btn.dataset.confirm==='1'){
        btn.dataset.confirm='';
        btn.textContent='🗑️ Fabrika Ayarlarına Dön';
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
  document.fonts.ready.then(()=>{ invalidateFit(); fitGameToViewport(); });
}
window.addEventListener('load', ()=>{ invalidateFit(); fitGameToViewport(); });
// iOS ilk açılışta viewport ölçülerini geç bildirir — birkaç kez tazele
[100, 400, 900].forEach(ms=>setTimeout(()=>{ invalidateFit(); fitGameToViewport(); }, ms));
requestAnimationFrame(loop);
