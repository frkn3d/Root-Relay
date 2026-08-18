/* ============================================================
   AUDIO — Web Audio API ile prosedürel, dosyasız ses efektleri.
   Tarayıcı politikası gereği AudioContext ilk kullanıcı
   dokunuşunda başlatılır (ensureAudioCtx).
   ============================================================ */
let audioCtx = null;
let soundEnabled = true;
(function initSoundPref(){
  try{
    const v = localStorage.getItem('rr_sound');
    if(v!==null) soundEnabled = v==='1';
  }catch(e){}
})();

function ensureAudioCtx(){
  if(!audioCtx){
    try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
    catch(e){ audioCtx = null; }
  }
  if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}

function syncSoundButtons(){
  document.querySelectorAll('.sound-toggle-btn').forEach(btn=>{
    const isStart = btn.id==='soundBtn';
    btn.textContent = soundEnabled ? (isStart?'🔊 Ses':'🔊') : (isStart?'🔇 Ses':'🔇');
  });
}

function toggleSound(){
  ensureAudioCtx();
  soundEnabled = !soundEnabled;
  try{ localStorage.setItem('rr_sound', soundEnabled?'1':'0'); }catch(e){}
  syncSoundButtons();
  if(soundEnabled) playClick();
}

const lastSoundAt = {};
function throttleSound(key, ms){
  const now = performance.now();
  if(lastSoundAt[key] && now-lastSoundAt[key]<ms) return false;
  lastSoundAt[key]=now;
  return true;
}

function blip(freq, dur, type, vol, glideTo){
  if(!soundEnabled) return;
  const ctx = ensureAudioCtx();
  if(!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type||'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if(glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime+dur);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(vol||0.15, ctx.currentTime+0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime+dur+0.02);
}

function playShoot(kind){
  if(!throttleSound('shoot_'+kind, 45)) return;
  if(kind==='archer') blip(520,0.08,'triangle',0.11,420);
  else if(kind==='mage') blip(780,0.14,'sine',0.13,1100);
  else if(kind==='mortar') blip(140,0.16,'square',0.15,90);
  else if(kind==='ice') blip(900,0.10,'sine',0.11,1300);
}
function playCoin(){ if(!throttleSound('coin',35)) return; blip(1050,0.09,'square',0.09,1400); }
function playPlace(){ blip(300,0.10,'triangle',0.16,520); }
function playError(){ blip(140,0.18,'sawtooth',0.13,90); }
function playWaveStart(){ blip(300,0.35,'sine',0.14,700); }
function playClick(){ blip(700,0.05,'square',0.07,700); }
function playVictory(){
  [520,660,780,1040].forEach((f,i)=>setTimeout(()=>blip(f,0.22,'triangle',0.15),i*110));
}
function playDefeat(){
  [400,320,240,160].forEach((f,i)=>setTimeout(()=>blip(f,0.28,'sawtooth',0.11),i*130));
}
