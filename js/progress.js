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
