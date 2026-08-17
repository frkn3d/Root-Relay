/* ============================================================
   UI — DOM'a dokunan tüm render fonksiyonları burada.
   engine.js durum değiştiğinde bu fonksiyonları çağırır.
   ============================================================ */
function renderLevelPicker(){
  const el = document.getElementById('levelPicker');
  el.innerHTML='';
  LEVELS.forEach((lv,i)=>{
    const card=document.createElement('div');
    card.className='level-card'+(i===currentLevelIdx?' active':'');
    card.textContent = lv.name;
    card.addEventListener('pointerup', ()=>loadLevel(i));
    el.appendChild(card);
  });
}

function renderTowerSelectBtn(){
  const btn = document.getElementById('towerSelectBtn');
  const def = TOWER_TYPES[selectedType];
  btn.innerHTML = `<span class="ts-icon">${def.icon}</span><span class="ts-cost">🪙${def.cost}</span>`;
}

function renderTowerDrawer(){
  const el = document.getElementById('towerDrawer');
  el.innerHTML='';
  Object.values(TOWER_TYPES).forEach(def=>{
    const card=document.createElement('div');
    card.className='tower-card'+(def.id===selectedType?' active':'');
    card.innerHTML = `<div class="icon">${def.icon}</div><div class="name">${def.name}</div><div class="cost">🪙${def.cost}</div>`;
    card.addEventListener('pointerup', ()=>{
      selectedType = def.id;
      renderTowerSelectBtn();
      renderTowerDrawer();
      closeTowerDrawer();
    });
    el.appendChild(card);
  });
}

function toggleTowerDrawer(){
  const el = document.getElementById('towerDrawer');
  const isOpen = el.classList.toggle('show');
  document.getElementById('towerSelectBtn').classList.toggle('open', isOpen);
}
function closeTowerDrawer(){
  document.getElementById('towerDrawer').classList.remove('show');
  document.getElementById('towerSelectBtn').classList.remove('open');
}

function renderWavePreview(){
  const el = document.getElementById('wavePreview');
  const nextIdx = waveIndex+1;
  if(nextIdx > level.waveCount){ el.innerHTML='<span>Tüm dalgalar tamamlandı 🌿</span>'; return; }
  const groups = generateWave(level, nextIdx);
  el.innerHTML = `<span>Sıradaki (D${nextIdx}):</span>` + groups.map(g=>{
    const def = ENEMY_TYPES[g.type];
    const isNew = !seenEnemyTypes.has(g.type);
    return `<span class="chip"><i style="background:${def.body}"></i>${g.count}× ${def.label}${isNew?'<span class="new-badge">YENİ</span>':''}</span>`;
  }).join('');
}
