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

/* ---- Bölüm içi market ----
   Elmas global para birimidir (yıldızlardan kazanılır), ancak satın
   alınan takviyeler YALNIZCA içinde bulunulan bölüm için geçerlidir.
   Bölüm yeniden başlarsa alımlar sıfırlanır. */
const SHOP_ITEMS = [
  {
    id:'goldPack', icon:'🪙', name:'Altın Kesesi',
    desc:'Anında altın kazan.',
    effect:'+200 altın',
    baseCost:6, costStep:3, maxBuys:5,
  },
  {
    id:'lifePack', icon:'❤️', name:'Can Takviyesi',
    desc:'Rölenin canını onar.',
    effect:'+3 can',
    baseCost:10, costStep:6, maxBuys:3,
  },
  {
    id:'buildBoost', icon:'⏱️', name:'Hızlı İnşaat',
    desc:'Bu bölümde kule kurma ve yükseltme süreleri kısalır.',
    effect:'%30 daha hızlı',
    baseCost:12, costStep:8, maxBuys:2,
  },
];

function shopItemById(id){ return SHOP_ITEMS.find(i=>i.id===id); }

/* Bölüm içi alım sayacı — engine.js her bölüm başında sıfırlar. */
let sessionShop = {};
function resetSessionShop(){ sessionShop = {}; }
function getSessionBuys(id){ return sessionShop[id] || 0; }
function shopNextCost(id){
  const item = shopItemById(id);
  if(!item) return null;
  const n = getSessionBuys(id);
  if(n >= item.maxBuys) return null;          // bu bölümde limit doldu
  return item.baseCost + item.costStep * n;   // her alımda pahalanır
}
function markSessionBuy(id){
  sessionShop[id] = getSessionBuys(id) + 1;
}

/* Bu bölümde alınan "Hızlı İnşaat" takviyelerinin inşa süresi çarpanı */
function sessionBuildFactor(){
  return Math.pow(0.7, getSessionBuys('buildBoost'));
}

/* Fabrika ayarlarına dön — uygulamanın kaydettiği HER ŞEYİ siler.
   Anahtarları tek tek silmek yerine 'rr_' önekli tüm kayıtları
   tarar; ileride yeni bir anahtar eklendiğinde burayı güncellemeyi
   unutmak diye bir risk kalmaz. */
function factoryReset(){
  try{
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.indexOf('rr_')===0) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
  resetSessionShop();
}
