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
    btn.textContent = soundEnabled ? '🔊 Ses' : '🔇 Ses';
  });
}

function toggleSound(){
  ensureAudioCtx();
  soundEnabled = !soundEnabled;
  try{ localStorage.setItem('rr_sound', soundEnabled?'1':'0'); }catch(e){}
  syncSoundButtons();
  if(soundEnabled) playMenuTap();
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
  // Zehir: diğer atışlardan bilinçli olarak kısık — sürekli tekrarlayan
  // bir efekt olduğundan yüksek sesli olursa rahatsız edici olurdu.
  else if(kind==='poison') blip(300,0.13,'sawtooth',0.05,150);
  else if(kind==='bolt') blip(1500,0.05,'sawtooth',0.12,2400);
}
function playCoin(){ if(!throttleSound('coin',35)) return; blip(1050,0.09,'square',0.09,1400); }

/* Vuruş sesi — düşmanın yarıçapına göre ölçekleniyor: küçük düşman
   ince/tiz bir "tık", büyük düşman kalın/tok bir "dum". Boss'larda
   ekstra ağırlık için bir oktav altına ikinci, sessiz bir katman
   ekleniyor. Boyut sınıfı başına ayrı throttle var ki aynı anda hem
   küçük hem büyük bir düşmana vurulunca ikisi de duyulsun, ama aynı
   sınıftan art arda gelen vuruşlar makineli tüfek gibi uğuldamasın. */
function playHit(radius, boss){
  const key = boss ? 'boss' : (radius<12 ? 'sm' : radius<18 ? 'md' : 'lg');
  if(!throttleSound('hit_'+key, 42)) return;
  const r = Math.max(8, Math.min(26, radius||14));
  const t = (r-8)/18;   // 0 = en küçük, 1 = en büyük
  const freq = 980 - t*760;
  const dur  = 0.045 + t*0.09;
  const vol  = 0.065 + t*0.045;
  blip(freq, dur, t<0.5?'triangle':'sine', vol, freq*(0.55-t*0.1));
  if(boss) setTimeout(()=>blip(freq*0.55, dur*1.15, 'sine', vol*0.7, freq*0.4), 4);
}

/* Düşman öldüğünde: hızlı, iki notalı yükselen bir "ding-ding" —
   altın toplama hissi versin diye playCoin()'den bilinçli olarak
   farklı ve daha belirgin/keyifli. */
function playKill(){
  if(!throttleSound('kill',55)) return;
  blip(880,0.07,'triangle',0.10,1300);
  setTimeout(()=>blip(1320,0.09,'triangle',0.11,1760), 45);
}

/* Bir düşman röleye ulaşıp can götürdüğünde — önceden yalnızca kamera
   sarsıntısı vardı, sesi yoktu. İki düşük/pes "tok-tok" darbe; kısa
   playError()'dan (menü/inşa reddi) kasıtlı olarak ayrışsın diye daha
   uzun ve iki vuruşlu. */
function playLifeLoss(){
  if(!throttleSound('lifeloss',80)) return;
  blip(150,0.16,'sawtooth',0.13,80);
  setTimeout(()=>blip(110,0.20,'sawtooth',0.11,55), 90);
}
function playPlace(){ blip(300,0.10,'triangle',0.16,520); }
function playError(){ blip(140,0.18,'sawtooth',0.13,90); }
function playWaveStart(){ blip(300,0.35,'sine',0.14,700); }
function playClick(){ blip(700,0.05,'square',0.07,700); }

// Menü/gezinme tuşları için kısık, tok (muted-thud) ses — oyun içi
// efektlerden (playShoot, playCoin vb.) bilinçli olarak farklı: alçak
// perdeli, hızla sönümlenen, parlak olmayan bir "tok" darbe.
function playMenuTap(){
  if(!throttleSound('menutap',60)) return;
  if(!soundEnabled) return;
  const ctx = ensureAudioCtx();
  if(!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type='sine';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime+0.09);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.10, ctx.currentTime+0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.11);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime+0.13);
}

function playVictory(){
  [520,660,780,1040].forEach((f,i)=>setTimeout(()=>blip(f,0.22,'triangle',0.15),i*110));
}
function playDefeat(){
  [400,320,240,160].forEach((f,i)=>setTimeout(()=>blip(f,0.28,'sawtooth',0.11),i*130));
}
