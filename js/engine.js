/* ============================================================
   MOTOR — kare bestecisi. Simülasyonun kendisi adım adım
   engine-update.js'te; burada yalnızca adımların SIRASI durur.

   Motor dosyaları:
     engine-canvas.js  tuval kurulumu + arka plan dokusu
     engine-state.js   bölüm/yol/oyun durumu + kuşlar
     engine-towers.js  kule ekonomisi, stat, hedefleme, panel, market
     engine-flow.js    bölüm yükleme, duraklatma, dalga, bölüm sonu
     engine-update.js  simülasyon adımları
   ============================================================ */
/* ---- Update (delta-time tabanlı) ---- */
let lastTime = performance.now();

/* Ortam kuşu sürüsü — 1x/2x/4x hız çarpanından bilerek bağımsız tutulur.
   update(dt), main.js'teki döngüde gameSpeed ile ölçeklenmiş adımlarla
   çağrılıyor; kuşlar da o dt'yi kullansaydı hızlandırmada fırlıyorlardı.
   Bu yüzden main.js her karede, hızdan bağımsız GERÇEK dt ile ayrıca
   çağırıyor (yalnızca oyun duraklı değilken, dondurma davranışı aynı). */
function updateBirds(dt){
  if(!level) return;
  birdCooldown -= dt;
  if(birdCooldown <= 0){
    if(!birds.length) spawnBird();
    scheduleNextBird();
  }
  if(birds.length){
    birds.forEach(b=>{ b.t += dt; });
    birds = birds.filter(b=>b.t < b.dur);
  }
}

function update(dt){
  if(gameOver||gameWon) return;

  // Dalga ilerlemesi bölümü kazandırmışsa bu kare burada biter.
  if(!updateWaveProgress(dt)) return;

  applyQueenAuras();
  const newborns = updateEnemyMovement(dt);
  updateTransientEffects(dt);
  // Yavrular efekt adımından SONRA eklenir: doğdukları karede
  // iyileştirme birikintisinden faydalanmasınlar.
  if(newborns.length) enemies.push(...newborns);

  // Sızan düşmanlar canı bitirmişse bu kare burada biter.
  if(!applyLeaks()) return;

  updateTowers(dt);
  updateProjectiles(dt);
  updateExplosions(dt);
  resolveEnemyDeaths();
  updateParticlesAndTexts(dt);

  if(shake>0) shake = Math.max(0, shake-dt*40);
  refreshTowerPanelAffordability();
}
