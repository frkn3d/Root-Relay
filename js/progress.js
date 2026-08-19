/* ============================================================
   PROGRESS — bölüm bazlı yıldız/en-iyi-dalga kaydı.
   Bu artık gerçek bir GitHub Pages sitesi (Claude artifact değil),
   bu yüzden localStorage güvenle kullanılabilir.
   ============================================================ */
const PROGRESS_KEY = 'rr_progress_v1';

function loadProgress(){
  try{
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}
function saveProgress(p){
  try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch(e){ /* depolama kapalı olabilir, sessizce geç */ }
}
function getLevelProgress(levelId){
  const p = loadProgress();
  return p[levelId] || {bestStars:0, bestWave:0};
}
function updateLevelProgress(levelId, stars, waveReached){
  const p = loadProgress();
  const cur = p[levelId] || {bestStars:0, bestWave:0};
  p[levelId] = {
    bestStars: Math.max(cur.bestStars, stars||0),
    bestWave: Math.max(cur.bestWave, waveReached||0),
  };
  saveProgress(p);
  return p[levelId];
}

/* ---- Elmas (premium para birimi) ----
   Şu an sadece kazanılıyor ve gösteriliyor; harcama Market ile gelecek. */
const GEMS_KEY = 'rr_gems_v1';
function getGems(){
  try{ return parseInt(localStorage.getItem(GEMS_KEY)||'0', 10) || 0; }
  catch(e){ return 0; }
}
function addGems(n){
  const total = Math.max(0, getGems() + (n||0));
  try{ localStorage.setItem(GEMS_KEY, String(total)); }catch(e){}
  return total;
}

/* ---- Devam edilebilir oyun kaydı ----
   Hangi bölümün yarıda bırakıldığını hatırlar. Tam bir oyun-durumu
   kaydı değil; bölümü baştan başlatır ama "Devam Et" akışını mümkün kılar. */
const RESUME_KEY = 'rr_resume_v1';
function saveResume(levelIdx, waveIndex){
  try{ localStorage.setItem(RESUME_KEY, JSON.stringify({levelIdx, waveIndex})); }catch(e){}
}
function getResume(){
  try{
    const raw = localStorage.getItem(RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function clearResume(){
  try{ localStorage.removeItem(RESUME_KEY); }catch(e){}
}

/* ---- Market: kalıcı yükseltmeler ----
   Satın alınan seviyeler localStorage'da tutulur ve her bölüm
   başlangıcında oyuna uygulanır. */
const SHOP_KEY = 'rr_shop_v1';

const SHOP_ITEMS = [
  {
    id:'startGold', icon:'🪙', name:'Başlangıç Altını',
    desc:'Her bölüme daha fazla altınla başla.',
    costs:[10, 22, 40], step:50, unit:'altın',
  },
  {
    id:'startLives', icon:'❤️', name:'Başlangıç Canı',
    desc:'Her bölüme daha fazla canla başla.',
    costs:[12, 26, 48], step:2, unit:'can',
  },
  {
    id:'buildSpeed', icon:'⏱️', name:'Hızlı İnşaat',
    desc:'Kule kurma ve yükseltme süreleri kısalır.',
    costs:[15, 32, 55], step:15, unit:'% daha hızlı',
  },
];

function loadShop(){
  try{
    const raw = localStorage.getItem(SHOP_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function getShopLevel(id){
  const s = loadShop();
  return s[id] || 0;
}
function shopItemById(id){ return SHOP_ITEMS.find(i=>i.id===id); }
function shopNextCost(id){
  const item = shopItemById(id);
  const lvl = getShopLevel(id);
  if(!item || lvl >= item.costs.length) return null;  // maks seviye
  return item.costs[lvl];
}
function buyShopItem(id){
  const cost = shopNextCost(id);
  if(cost===null) return {ok:false, reason:'max'};
  if(getGems() < cost) return {ok:false, reason:'gems'};
  addGems(-cost);
  const s = loadShop();
  s[id] = (s[id] || 0) + 1;
  try{ localStorage.setItem(SHOP_KEY, JSON.stringify(s)); }catch(e){}
  return {ok:true};
}

/* Oyuna uygulanacak bonuslar */
function shopBonusGold(){  return getShopLevel('startGold')  * 50; }
function shopBonusLives(){ return getShopLevel('startLives') * 2; }
function shopBuildFactor(){ return Math.max(0.4, 1 - getShopLevel('buildSpeed') * 0.15); }
