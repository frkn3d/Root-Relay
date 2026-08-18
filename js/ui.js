/* ============================================================
   UI — DOM'a dokunan tüm render fonksiyonları burada.
   engine.js durum değiştiğinde bu fonksiyonları çağırır.
   ============================================================ */
function renderStars(n){
  let s='';
  for(let i=0;i<3;i++) s += i<n ? '⭐' : '☆';
  return s;
}

function renderLevelPicker(){
  const el = document.getElementById('levelPicker');
  el.innerHTML='';
  LEVELS.forEach((lv,i)=>{
    const card=document.createElement('div');
    card.className='level-card'+(i===currentLevelIdx?' active':'');
    const prog = getLevelProgress(lv.id);
    card.innerHTML = `<div>${lv.name}</div><div class="lc-stars">${renderStars(prog.bestStars)}</div>`;
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

function renderTowerPanel(){
  const t = selectedTower;
  const panel = document.getElementById('towerPanel');
  if(!t){ panel.classList.remove('show'); return; }
  panel.classList.add('show');

  const lvl = t.level||0;
  const st = getTowerStats(t);

  document.getElementById('tpIcon').textContent = t.def.icon;
  document.getElementById('tpName').textContent = t.def.name;
  document.getElementById('tpLevel').textContent = `Yükseltme: ${lvl}/3`;

  let statsHtml = `
    <div class="tp-stat-row"><span>💥 Hasar</span><b>${Math.round(st.dmg)}</b></div>
    <div class="tp-stat-row"><span>🎯 Menzil</span><b>${Math.round(st.range)}</b></div>
    <div class="tp-stat-row"><span>⚡ Atış Hızı</span><b>${(1/st.rate).toFixed(1)}/sn</b></div>
  `;
  if(t.def.splash>0){
    statsHtml += `<div class="tp-stat-row"><span>💫 Alan Yarıçapı</span><b>${Math.round(st.splash)}</b></div>`;
  }
  document.getElementById('tpStats').innerHTML = statsHtml;

  const cost = upgradeCost(t);
  const upBtn = document.getElementById('tpUpgradeBtn');
  if(cost===null){
    upBtn.textContent = 'Maksimum Seviye';
    upBtn.disabled = true;
  } else {
    upBtn.textContent = `Yükselt · 🪙${cost}`;
    upBtn.disabled = gold < cost;
  }

  const sellValue = Math.floor(t.totalSpent/2);
  document.getElementById('tpSellBtn').textContent = `Sat · +🪙${sellValue}`;

  const confirmRow = document.getElementById('tpSellConfirm');
  const mainActions = document.getElementById('tpMainActions');
  if(sellConfirmPending){
    confirmRow.classList.add('show');
    mainActions.style.display='none';
    document.getElementById('tpSellConfirmText').textContent = `Bu kuleyi satmak istediğine emin misin? +${sellValue} altın alacaksın.`;
  } else {
    confirmRow.classList.remove('show');
    mainActions.style.display='flex';
  }
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
