/* ============================================================
   AUDIO — oyunun ses arayüzü. Her play* fonksiyonu ÖNCE sound/
   klasöründeki MP3 örneğini çalmayı dener (playSfx, sfx.js);
   örnek yoksa buradaki prosedürel Web Audio sentezine düşer.
   Böylece ses dosyaları olmadan da oyun eskisi gibi çalışır.

   Tarayıcı politikası gereği AudioContext ilk kullanıcı
   dokunuşunda başlatılır (ensureAudioCtx) — örnek kütüphanesi de
   o anda yüklenmeye başlar.
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
  // Bağlam ilk kez kurulduğunda örnek kütüphanesini yüklemeye başla.
  // loadSfxLibrary kendini bir kereye kilitler, tekrar çağrılması zararsız.
  if(audioCtx && typeof loadSfxLibrary === 'function') loadSfxLibrary();
  return audioCtx;
}

/* Örnek çalınamadıysa false döner; her play* fonksiyonu bu sonuca
   bakıp sentezlenmiş yedeğine düşer. sfx.js yüklenmemişse de
   (dosya eksik) sessizce false döner. */
function sfx(key, opts){
  return (typeof playSfx === 'function') ? playSfx(key, opts) : false;
}
function sfxRnd(a){ return (typeof sfxWobble === 'function') ? sfxWobble(a) : 1; }

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
  if(typeof syncAmbienceWithSoundPref === 'function') syncAmbienceWithSoundPref();
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

/* Ortak "elektrik çıtırtısı" üretici — şimşek atışı ve şimşek isabeti
   ikisi de bunu kullanır (sadece perde/süre/ses düzeyi değişir). Düz
   bir glide yerine birkaç düzensiz frekans sıçraması + hafif detune'lu
   ikinci bir katman gerçek bir "cızırtı" hissi veriyor. */
function zapSound(baseFreq, dur, vol){
  if(!soundEnabled) return;
  const c = ensureAudioCtx();
  if(!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator(), gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(baseFreq*1.7, t0);
  osc.frequency.setValueAtTime(baseFreq*0.6, t0+dur*0.14);
  osc.frequency.setValueAtTime(baseFreq*1.4, t0+dur*0.28);
  osc.frequency.setValueAtTime(baseFreq*0.5, t0+dur*0.42);
  osc.frequency.exponentialRampToValueAtTime(baseFreq*0.22, t0+dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0+0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(); osc.stop(t0+dur+0.02);

  // Hafif detune'lu ikinci katman — vızıltı/buzz hissi katıyor.
  const osc2 = c.createOscillator(), gain2 = c.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(baseFreq*1.05, t0);
  osc2.frequency.exponentialRampToValueAtTime(baseFreq*0.3, t0+dur*0.7);
  gain2.gain.setValueAtTime(0.0001, t0);
  gain2.gain.exponentialRampToValueAtTime(vol*0.35, t0+0.006);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0+dur*0.7);
  osc2.connect(gain2); gain2.connect(c.destination);
  osc2.start(); osc2.stop(t0+dur*0.7+0.02);
}

function playShoot(kind){
  if(!throttleSound('shoot_'+kind, 45)) return;
  if(sfx('shoot_'+kind, { rate:sfxRnd(0.05) })) return;
  if(kind==='archer') blip(520,0.08,'triangle',0.11,420);
  else if(kind==='mage') blip(780,0.14,'sine',0.13,1100);
  else if(kind==='mortar') blip(140,0.16,'square',0.15,90);
  // Don Peykesi: eskisinden daha kısık ve kalın — parlak bir "ping"
  // yerine alçak, hafif boğuk bir "vuum".
  else if(kind==='ice') blip(260,0.20,'sine',0.065,150);
  // Zehir: diğer atışlardan bilinçli olarak kısık — sürekli tekrarlayan
  // bir efekt olduğundan yüksek sesli olursa rahatsız edici olurdu.
  else if(kind==='poison') blip(300,0.13,'sawtooth',0.05,150);
  else if(kind==='bolt') zapSound(1400,0.09,0.13);
  // Ateş Kulesi: alçak, dokulu bir "fışş" — bir alev püskürtmesinin
  // gürleyişine yakın dursun diye testere dalga + kısa süre.
  else if(kind==='fire') blip(190,0.22,'sawtooth',0.09,120);
}
function playCoin(){
  if(!throttleSound('coin',35)) return;
  if(sfx('coin', { rate:sfxRnd(0.07) })) return;
  blip(1050,0.09,'square',0.09,1400);
}
/* Elmas kazanma — altından ayrı, kristal arpejli ödül sesi. */
function playGem(){
  if(!throttleSound('gem',120)) return;
  if(sfx('gem')) return;
  [880,1174,1568].forEach((f,i)=>setTimeout(()=>blip(f,0.16,'triangle',0.11,f*1.05), i*70));
}

/* Vuruş sesi — düşmanın yarıçapına göre ölçekleniyor: küçük düşman
   ince/tiz bir "tık", büyük düşman kalın/tok bir "dum". Boss'larda
   ekstra ağırlık için bir oktav altına ikinci, sessiz bir katman
   ekleniyor. Boyut sınıfı başına ayrı throttle var ki aynı anda hem
   küçük hem büyük bir düşmana vurulunca ikisi de duyulsun, ama aynı
   sınıftan art arda gelen vuruşlar makineli tüfek gibi uğuldamasın. */
function playHit(radius, boss){
  const key = boss ? 'boss' : (radius<12 ? 'sm' : radius<18 ? 'md' : 'lg');
  if(!throttleSound('hit_'+key, 42)) return;
  const sample = { boss:'hit_boss', sm:'hit_small', md:'hit_medium', lg:'hit_large' }[key];
  if(sfx(sample, { rate:sfxRnd(0.08) })) return;
  const r = Math.max(8, Math.min(26, radius||14));
  const t = (r-8)/18;   // 0 = en küçük, 1 = en büyük
  const freq = 980 - t*760;
  const dur  = 0.045 + t*0.09;
  const vol  = 0.065 + t*0.045;
  blip(freq, dur, t<0.5?'triangle':'sine', vol, freq*(0.55-t*0.1));
  if(boss) setTimeout(()=>blip(freq*0.55, dur*1.15, 'sine', vol*0.7, freq*0.4), 4);
}

/* Kıvılcım Kozası öldüğünde patlayıp yakındaki kuleleri kör edince —
   derin, kısa bir "whump" + hemen ardından hafif bir toz/polen tıslaması. */
function playBlindBurst(){
  if(!throttleSound('blindburst', 100)) return;
  if(sfx('cocoon_burst')) return;
  blip(90, 0.28, 'sawtooth', 0.16, 45);
  setTimeout(()=>blip(1600, 0.12, 'sawtooth', 0.06, 400), 20);
}

/* Şimşek isabeti — Şimşek Direği'nin ilk vuruşu ve zincirin sıçradığı
   her hedef için: genel playHit() yerine zapSound() tabanlı, gerçekten
   elektriksel bir çıtırtı. Boyuta göre ölçekleniyor (playHit ile aynı
   mantık): küçük düşman tiz bir çıtırtı, büyük/boss kalın ve boss'ta
   ekstra bir alt katman. */
function playElectricHit(radius, boss){
  const key = boss ? 'boss' : (radius<12 ? 'sm' : radius<18 ? 'md' : 'lg');
  if(!throttleSound('ehit_'+key, 40)) return;
  // Boyut farkı örnekte perde ile veriliyor: küçük hedef tiz, boss kalın.
  if(sfx('hit_electric', { rate: boss ? 0.72 : (key==='sm' ? 1.18 : key==='md' ? 1.0 : 0.88),
                           vol:  boss ? 1.35 : 1 })) return;
  const r = Math.max(8, Math.min(26, radius||14));
  const t = (r-8)/18;
  const baseFreq = 1100 - t*550;
  const dur = 0.055 + t*0.05;
  const vol = 0.09 + t*0.04;
  zapSound(baseFreq, dur, vol);
  if(boss) setTimeout(()=>zapSound(baseFreq*0.5, dur*1.1, vol*0.6), 4);
}

/* Düşman öldüğünde: hızlı, iki notalı yükselen bir "ding-ding" —
   altın toplama hissi versin diye playCoin()'den bilinçli olarak
   farklı ve daha belirgin/keyifli. */
function playKill(boss){
  if(boss){
    // Boss ölümü kalabalıkta kaybolmasın: kendi örneği, throttle'sız.
    if(sfx('death_boss')) return;
    blip(160,0.5,'sawtooth',0.18,60);
    setTimeout(()=>blip(90,0.8,'sine',0.16,45), 120);
    return;
  }
  if(!throttleSound('kill',55)) return;
  if(sfx('death_normal', { rate:sfxRnd(0.1) })) return;
  blip(880,0.07,'triangle',0.10,1300);
  setTimeout(()=>blip(1320,0.09,'triangle',0.11,1760), 45);
}

/* Kalkan Taşıyıcı önden gelen mermiyi sektirdiğinde */
function playShieldDeflect(){
  if(!throttleSound('deflect',60)) return;
  if(sfx('hit_shield', { rate:sfxRnd(0.08) })) return;
  blip(1200,0.09,'square',0.08,1900);
}

/* Yanan (DoT altındaki) düşmanların kavrulma cızırtısı — sahada
   yanan biri olduğu sürece seyrek aralıklarla tekrarlanır. */
function playBurnTick(){
  if(!throttleSound('burn',420)) return;
  if(sfx('hit_burn', { rate:sfxRnd(0.1) })) return;
}

/* Küp ikiye bölündüğünde */
function playCubeSplit(){
  if(!throttleSound('cubesplit',70)) return;
  if(sfx('cube_split', { rate:sfxRnd(0.1) })) return;
  blip(320,0.12,'square',0.09,180);
}

/* Kuluçka yolda yavru bıraktığında */
function playBrooderSpawn(){
  if(!throttleSound('brood',150)) return;
  if(sfx('brooder_spawn', { rate:sfxRnd(0.1) })) return;
  blip(420,0.10,'sine',0.07,260);
}

/* Şişe kırılıp şifa birikintisi bıraktığında */
function playFlaskShatter(){
  if(!throttleSound('flask',120)) return;
  if(sfx('flask_shatter')) return;
  blip(1500,0.14,'triangle',0.10,600);
}

/* Yansıtıcı hasarı kuleye geri yansıtıp kuleyi kilitlediğinde */
function playReflectorShock(){
  if(!throttleSound('reflect',120)) return;
  if(sfx('reflector_shock')) return;
  zapSound(700,0.14,0.11);
}

/* Sürü Anası aurası bir müttefiki güçlendirdiğinde (seyrek hatırlatma) */
function playQueenBuff(){
  if(!throttleSound('queenbuff',2500)) return;
  if(sfx('queen_buff')) return;
}

/* Don Efendisi aurası bir kuleyi dondurduğunda (seyrek hatırlatma) */
function playFrostlordAura(){
  if(!throttleSound('frostaura',3000)) return;
  if(sfx('frostlord_aura')) return;
}

/* Sahneden geçen kuş sürüsü */
function playBirdChirp(){
  if(!throttleSound('bird',900)) return;
  if(sfx('bird', { rate:sfxRnd(0.12) })) return;
}

/* Yeni bir bölüm kilidi açıldığında */
function playLevelUnlock(){
  if(!throttleSound('unlock',800)) return;
  if(sfx('level_unlock')) return;
  [660,880,1320].forEach((f,i)=>setTimeout(()=>blip(f,0.2,'triangle',0.13,f*1.1), i*130));
}

/* Kule paneli açıldığında (sahadaki kuleye odaklanma) */
function playTowerSelect(){
  if(!throttleSound('towersel',80)) return;
  if(sfx('tower_select')) return;
  blip(660,0.06,'triangle',0.07,880);
}

/* Yükseltme satın alındığında */
function playTowerUpgrade(){
  if(sfx('tower_upgrade')) return;
  [520,660,880].forEach((f,i)=>setTimeout(()=>blip(f,0.18,'triangle',0.12,f*1.1), i*80));
}

/* Kule satıldığında */
function playTowerSell(){
  if(sfx('tower_sell')) return;
  playCoin();
}

/* Atış önceliği (Öncü/Zayıf/Güçlü) değiştirildiğinde */
function playTargetMode(){
  if(!throttleSound('targetmode',60)) return;
  if(sfx('target_mode')) return;
  blip(900,0.05,'square',0.07,1100);
}

/* Duraklat / devam et / hız değiştir */
function playPauseSfx(){ if(sfx('ui_pause')) return; blip(420,0.20,'sine',0.10,160); }
function playResumeSfx(){ if(sfx('ui_resume')) return; blip(160,0.20,'sine',0.10,420); }
function playSpeedToggle(){
  if(!throttleSound('speed',60)) return;
  if(sfx('ui_speed')) return;
  blip(800,0.05,'square',0.08,1000);
}

/* Bir düşman röleye ulaşıp can götürdüğünde — önceden yalnızca kamera
   sarsıntısı vardı, sesi yoktu. İki düşük/pes "tok-tok" darbe; kısa
   playError()'dan (menü/inşa reddi) kasıtlı olarak ayrışsın diye daha
   uzun ve iki vuruşlu. */
function playLifeLoss(){
  if(!throttleSound('lifeloss',80)) return;
  if(sfx('life_lost')) return;
  blip(150,0.16,'sawtooth',0.13,80);
  setTimeout(()=>blip(110,0.20,'sawtooth',0.11,55), 90);
}
function playPlace(){ if(sfx('tower_place')) return; blip(300,0.10,'triangle',0.16,520); }
function playError(){ if(sfx('ui_error')) return; blip(140,0.18,'sawtooth',0.13,90); }
function playWaveStart(){ if(sfx('wave_start')) return; blip(300,0.35,'sine',0.14,700); }
function playClick(){ if(sfx('ui_click')) return; blip(700,0.05,'square',0.07,700); }

// Menü/gezinme tuşları için kısık, tok (muted-thud) ses — oyun içi
// efektlerden (playShoot, playCoin vb.) bilinçli olarak farklı: alçak
// perdeli, hızla sönümlenen, parlak olmayan bir "tok" darbe.
function playMenuTap(){
  if(!throttleSound('menutap',60)) return;
  if(!soundEnabled) return;
  if(sfx('ui_tap')) return;
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
  if(sfx('victory')) return;
  [520,660,780,1040].forEach((f,i)=>setTimeout(()=>blip(f,0.22,'triangle',0.15),i*110));
}

/* Bölüm tamamlanamadan biterse (röle düşünce) — playVictory()'nin tam
   tersi: inişli, ~3 saniyelik bir "başarısız oldun" teması. Yalnızca
   endGame(false)'da bir kez çalındığı için throttle uzun tutulabilir. */
function playDefeat(){
  if(!throttleSound('defeat', 1000)) return;
  if(sfx('defeat')) return;
  const notes = [392, 349.2, 311.1, 261.6, 220, 174.6];
  notes.forEach((f,i)=>setTimeout(()=>blip(f, i===notes.length-1?0.9:0.42, 'sawtooth', 0.12, f*0.65), i*430));
}

/* Bir dalga (bölümün tamamı değil) başarıyla bitince — kısa, yükselen
   bir "başarı" ezgisi. playVictory()'den (bölüm sonu) kasıtlı olarak
   daha hafif/kısa tutuldu çünkü bu her dalgada tekrar çalınacak. */
function playWaveComplete(){
  if(!throttleSound('wavecomplete', 400)) return;
  if(sfx('wave_complete')) return;
  const notes = [523.25, 659.25, 784.0, 1046.5, 1318.5];
  notes.forEach((f,i)=>setTimeout(()=>blip(f, i===notes.length-1?0.5:0.16, 'triangle', 0.12, f*1.1), i*150));
}
