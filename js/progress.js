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
