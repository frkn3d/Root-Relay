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

/* ============================================================
   MESAFEYE GÖRE SES ZAYIFLAMASI
   Bir kule menzilinin dibindeki bir düşmana ateş ettiğinde atış ve
   vuruş sesi tam güçte duyulur; hedef menzilin ucuna doğru gittikçe
   ses kademe kademe zayıflar. Böylece uzaktaki çarpışmalar arka
   planda kalır, kulenin burnunun dibindeki olay öne çıkar.

   Ölçü mutlak piksel değil, MENZİLE ORAN: 240 menzilli havanın 150
   birimlik atışı ile 120 menzilli okçunun 75 birimlik atışı aynı
   oranda "uzak" sayılır. Aksi hâlde uzun menzilli kuleler sürekli
   kısık, kısa menzilliler sürekli tam sesle çalardı.

   Kademeler (mesafe / menzil):
     <= %50   -> 1.00   (istenen)
       %50-60 -> 0.80   (istenen)
       %60-70 -> 0.60   (istenen)
       %70-80 -> 0.45
       %80-90 -> 0.35
       > %90  -> 0.30   (taban)
   İlk üç kademe birebir istendiği gibi. Devamında -0,20'lik adımı
   aynen sürdürmek menzil ucunda çarpanı 0'a indirir, yani en uzak
   atışlar tamamen sessiz kalırdı; "zayıflasın" isteğini karşılamak
   için adım yumuşatılıp 0.30'luk bir taban bırakıldı. */
const RANGE_VOLUME_BANDS = [
  [0.50, 1.00],
  [0.60, 0.80],
  [0.70, 0.60],
  [0.80, 0.45],
  [0.90, 0.35]
];
const RANGE_VOLUME_FLOOR = 0.30;

/* dist: kule merkezi ile hedef arasındaki mesafe, range: kulenin o
   seviyedeki menzili. Menzil bilinmiyorsa (0/undefined) 1 döner,
   yani ses eskisi gibi tam güçte çalar. */
function rangeVolume(dist, range){
  if(!(range > 0) || !(dist >= 0)) return 1;
  const f = dist / range;
  for(let i=0;i<RANGE_VOLUME_BANDS.length;i++)
    if(f <= RANGE_VOLUME_BANDS[i][0]) return RANGE_VOLUME_BANDS[i][1];
  return RANGE_VOLUME_FLOOR;
}

/* play* fonksiyonlarına gelen çarpanı güvene alır: verilmemişse 1. */
function volScale(m){
  return (typeof m === 'number' && m >= 0) ? Math.min(1, m) : 1;
}

/* throttleSound'un ses düzeyine duyarlı hâli. Düz throttle'da aynı
   anahtardan ilk gelen sesi çalar, penceredeki gerisini atardı; bu,
   mesafe zayıflatmasıyla birlikte ters teper: menzilin ucundan atan
   bir okçu, aynı anda burnumuzun dibinde ateş eden okçuyu susturur
   ve yakın çarpışma sessiz kalırdı. Burada pencere içinde belirgin
   şekilde daha YÜKSEK (yani daha yakın) bir olay gelirse ona yol
   veriliyor; benzer düzeydekiler eskisi gibi eleniyor. */
const lastSoundVol = {};
function throttleByVolume(key, ms, v){
  if(throttleSound(key, ms)){ lastSoundVol[key] = v; return true; }
  if(v > (lastSoundVol[key] || 0) + 0.15){
    lastSoundAt[key] = performance.now();
    lastSoundVol[key] = v;
    return true;
  }
  return false;
}

function playShoot(kind, volMult){
  const V = volScale(volMult);
  if(!throttleByVolume('shoot_'+kind, 45, V)) return;
  // Mantar Havanı artık bir TOP: örneği biraz pes çalıp yükselterek
  // diğer atışlardan ayrılan tok bir gümbürtü hâline getiriyoruz.
  const shotOpts = (kind==='mortar')
    ? { rate:0.86*sfxRnd(0.03), vol:1.3*V }
    : { rate:sfxRnd(0.05), vol:V };
  if(sfx('shoot_'+kind, shotOpts)) return;
  if(kind==='archer') blip(520,0.08,'triangle',0.11*V,420);
  else if(kind==='mage') blip(780,0.14,'sine',0.104*V,1100);   // örnekle aynı %20 kısma
  // Sentezlenmiş yedek de top gibi: daha pes, daha uzun bir gümbürtü.
  else if(kind==='mortar'){ blip(95,0.34,'square',0.17*V,42); setTimeout(()=>blip(210,0.10,'sawtooth',0.08*V,70), 15); }
  // Don Peykesi: eskisinden daha kısık ve kalın — parlak bir "ping"
  // yerine alçak, hafif boğuk bir "vuum".
  else if(kind==='ice') blip(260,0.20,'sine',0.065*V,150);
  // Zehir: diğer atışlardan bilinçli olarak kısık — sürekli tekrarlayan
  // bir efekt olduğundan yüksek sesli olursa rahatsız edici olurdu.
  else if(kind==='poison') blip(300,0.13,'sawtooth',0.05*V,150);
  else if(kind==='bolt') zapSound(1400,0.09,0.13*V);
  // Ateş Kulesi: alçak, dokulu bir "fışş" — bir alev püskürtmesinin
  // gürleyişine yakın dursun diye testere dalga + kısa süre.
  else if(kind==='fire') blip(190,0.22,'sawtooth',0.09*V,120);
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
function playHit(radius, boss, volMult){
  const key = boss ? 'boss' : (radius<12 ? 'sm' : radius<18 ? 'md' : 'lg');
  // volMult: atışı yapan kuleye olan uzaklıktan gelen zayıflama
  // (rangeVolume). Atış sesiyle AYNI çarpan kullanılır ki tek bir
  // vuruş olayı baştan sona aynı uzaklıkta duyulsun.
  const V = volScale(volMult);
  if(!throttleByVolume('hit_'+key, 42, V)) return;
  const sample = { boss:'hit_boss', sm:'hit_small', md:'hit_medium', lg:'hit_large' }[key];
  if(sfx(sample, { rate:sfxRnd(0.08), vol:V })) return;
  const r = Math.max(8, Math.min(26, radius||14));
  const t = (r-8)/18;   // 0 = en küçük, 1 = en büyük
  const freq = 980 - t*760;
  const dur  = 0.045 + t*0.09;
  const vol  = (0.065 + t*0.045) * V;
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
function playElectricHit(radius, boss, volMult){
  const key = boss ? 'boss' : (radius<12 ? 'sm' : radius<18 ? 'md' : 'lg');
  const V = volScale(volMult);
  if(!throttleByVolume('ehit_'+key, 40, V)) return;
  // Boyut farkı örnekte perde ile veriliyor: küçük hedef tiz, boss kalın.
  if(sfx('hit_electric', { rate: boss ? 0.72 : (key==='sm' ? 1.18 : key==='md' ? 1.0 : 0.88),
                           vol:  (boss ? 1.35 : 1) * V })) return;
  const r = Math.max(8, Math.min(26, radius||14));
  const t = (r-8)/18;
  const baseFreq = 1100 - t*550;
  const dur = 0.055 + t*0.05;
  const vol = (0.09 + t*0.04) * V;
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

/* ZIRHLI düşmanın isabet sesi üç durumda farklı:
     'shield' — plaka ayakta: metalik, tok bir çınlama
     'break'  — plaka bu vuruşla koptu: aynı metal örnek, pes ve yüksek
     'body'   — plaka gitti: normal, etli bir darbe
   Kırılma tek seferlik bir olay olduğu için throttle'a takılmaz;
   oyuncunun o anı kaçırmaması gerekiyor. */
function playArmorHit(state, volMult){
  const V = volScale(volMult);
  if(state === 'break'){
    if(sfx('hit_armor_shield', { rate:0.66, vol:1.5*V })) return;
    blip(150, 0.30, 'square', 0.17*V, 58);
    setTimeout(()=>blip(420, 0.14, 'sawtooth', 0.08*V, 180), 25);
    return;
  }
  const shielded = state === 'shield';
  if(!throttleByVolume(shielded ? 'hit_armor_s' : 'hit_armor_b', 42, V)) return;
  if(sfx(shielded ? 'hit_armor_shield' : 'hit_armor_body', { rate:sfxRnd(0.07), vol:V })) return;
  if(shielded) blip(720, 0.09, 'square', 0.080*V, 540);
  else         blip(300, 0.09, 'sine',   0.075*V, 175);
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
