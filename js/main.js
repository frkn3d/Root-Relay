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
  const {x:mx,y:my} = pointerToLogical(e.clientX,e.clientY);
  let closest=null,bestD=Infinity;
  spots.forEach(s=>{
    if(s.occ) return;
    const d=Math.hypot(mx-s.x,my-s.y);
    if(d<28 && d<bestD){bestD=d; closest=s;}
  });
  if(!closest) return;
  const def=TOWER_TYPES[selectedType];
  if(gold<def.cost) return;
  gold-=def.cost;
  document.getElementById('goldVal').textContent=gold;
  const t={x:closest.x,y:closest.y,def,cooldown:0,pulse:0};
  towers.push(t); closest.occ=t;
});

document.getElementById('waveBtn').addEventListener('pointerup', startWave);
document.getElementById('resetBtn').addEventListener('pointerup', ()=>loadLevel(currentLevelIdx));
document.getElementById('overlayBtn').addEventListener('pointerup', ()=>loadLevel(currentLevelIdx));
document.getElementById('pauseBtn').addEventListener('pointerup', togglePause);
document.getElementById('resumeBtn').addEventListener('pointerup', togglePause);
document.getElementById('speedBtn').addEventListener('pointerup', toggleSpeed);

renderTowerDock();
loadLevel(0);
requestAnimationFrame(loop);
