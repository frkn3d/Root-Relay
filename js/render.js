/* ============================================================
   RENDER — kare bestecisi. Kendisi çizim yapmaz; katman sırasını
   belirleyip render-*.js dosyalarındaki çizicileri sırayla çağırır.
   Oyun durumunu (engine) yalnızca OKUR, değiştirmez.

   Çizim dosyaları:
     render-core.js       ortak yardımcılar
     render-world.js      yol, oklar, dekor, yapı alanları
     render-weather.js    kuşlar, kar, yağmur
     render-tower-art.js  kule gövdeleri
     render-towers.js     kule dağıtıcısı + rozetler + menzil
     render-enemies.js    düşman çizimleri
     render-fx.js         mermiler ve kısa ömürlü efektler
   ============================================================ */
function render(){
  ctx.save();
  if(shake>0) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  ctx.clearRect(-20,-20,LW+40,LH+40);
  ensureBackground();
  ctx.drawImage(bgCanvas,0,0);
  drawPath(); drawDirectionArrows(); drawProps(); drawSpots();
  // Katman sırası: boss auraları ve menzil halkaları zeminde,
  // sonra düşmanlar, en üstte kuleler — kuleler arkada kalmasın.
  enemies.forEach(drawBossAura);
  drawDebris();             // zeminde: küp enkazı düşmanların altında
  drawHealZones();          // zeminde: birikintiler düşmanların altında
  towers.forEach(drawTowerRange);
  enemies.forEach(drawEnemy);
  towers.forEach(drawTower);
  towers.forEach(drawUpgradeBadge);   // yükseltmeye hazır kuleler
  towers.forEach(drawChillBadge);
  towers.forEach(drawBlindBadge);
  projectiles.forEach(drawProjectile);
  drawArcs();
  drawLavaStreams();
  drawBeams();
  drawExplosions();
  drawParticles();
  drawFloatTexts();
  drawBirds();      // ortam kuşu sürüsü — kardan önce, gökyüzü katmanında
  drawSnowfall();   // en üstte: kar her şeyin önünden geçer
  drawRain();       // en üstte: yağmur twist'i (nadir)
  ctx.restore();
}
