/* ============================================================
   SFX — sound/ klasöründeki MP3 örnek kütüphanesinin oynatıcısı.

   audio.js'teki prosedürel sesler SİLİNMEDİ; artık yedek katman.
   Her play* fonksiyonu önce buradaki örneği dener, örnek yoksa
   (dosya yüklenemedi, tarayıcı izin vermedi, ses kapalı değil ama
   ağ yavaş) eski sentezlenmiş sese düşer. Böylece oyun, sound/
   klasörü olmadan da eskisi gibi çalışır.

   İki oynatma kipi var:
     'buffer'  — fetch + decodeAudioData (tercih edilen). Üst üste
                 binebilir, perdesi değiştirilebilir, gecikmesizdir.
     'element' — <audio> havuzu. file:// ile açılan sayfalarda fetch
                 CORS'a takıldığı için gereken yedek.
   Hiçbiri kurulamazsa kip 'off' olur ve her şey sentezlenmiş sese
   düşer.
   ============================================================ */
const SFX_DIR = 'sound/';

/* Anahtar -> {f: dosya adı, v: taban ses düzeyi}
   Ses düzeyleri elle dengelendi: sürekli tekrarlayan efektler (atış,
   isabet, yürüyüş) bilinçli olarak kısık; tek seferlik olaylar
   (dalga, zafer, yenilgi) daha yüksek. */
const SFX = {
  // --- kule atışları ---
  shoot_archer:  { f:'shoot_archer.mp3',  v:0.30 },
  shoot_mage:    { f:'shoot_mage.mp3',    v:0.32 },
  shoot_mortar:  { f:'shoot_mortar.mp3',  v:0.34 },
  shoot_ice:     { f:'shoot_ice.mp3',     v:0.22 },
  shoot_poison:  { f:'shoot_poison.mp3',  v:0.20 },
  shoot_bolt:    { f:'shoot_bolt.mp3',    v:0.30 },
  // Lav huzmesi kesintisiz aktığı için döngüsel çalıyor — en kısığı bu.
  shoot_fire:    { f:'shoot_fire.mp3',    v:0.18 },

  // --- isabet ---
  hit_small:     { f:'hit_small.mp3',     v:0.24 },
  hit_medium:    { f:'hit_medium.mp3',    v:0.28 },
  hit_large:     { f:'hit_large.mp3',     v:0.32 },
  hit_boss:      { f:'hit_boss.mp3',      v:0.38 },
  hit_electric:  { f:'hit_electric.mp3',  v:0.26 },
  hit_shield:    { f:'hit_shield_deflect.mp3', v:0.30 },
  hit_burn:      { f:'hit_fire_burn.mp3', v:0.16 },

  // --- düşman olayları ---
  death_normal:  { f:'enemy_death_normal.mp3', v:0.26 },
  death_boss:    { f:'enemy_death_boss.mp3',   v:0.55 },
  cube_split:    { f:'enemy_split_cube.mp3',   v:0.28 },
  cocoon_burst:  { f:'enemy_cocoon_burst.mp3', v:0.42 },
  brooder_spawn: { f:'enemy_brooder_spawn.mp3',v:0.24 },
  flask_shatter: { f:'enemy_flask_shatter.mp3',v:0.34 },
  reflector_shock:{f:'enemy_reflector_shock.mp3', v:0.32 },
  queen_buff:    { f:'enemy_queen_buff.mp3',   v:0.26 },
  frostlord_aura:{ f:'enemy_frostlord_aura.mp3', v:0.24 },

  // --- düşman yürüyüşleri (kısık) ---
  walk_spore:        { f:'walk_spore.mp3',        v:0.10 },
  walk_swarm:        { f:'walk_swarm.mp3',        v:0.09 },
  walk_sprinter:     { f:'walk_sprinter.mp3',     v:0.10 },
  walk_husk:         { f:'walk_husk.mp3',         v:0.12 },
  walk_brute:        { f:'walk_brute.mp3',        v:0.14 },
  walk_cube:         { f:'walk_cube.mp3',         v:0.11 },
  walk_shieldbearer: { f:'walk_shieldbearer.mp3', v:0.12 },
  walk_brooder:      { f:'walk_brooder.mp3',      v:0.12 },
  walk_reflector:    { f:'walk_reflector.mp3',    v:0.11 },
  walk_flask:        { f:'walk_flask.mp3',        v:0.11 },
  walk_frostlord:    { f:'walk_frostlord.mp3',    v:0.20 },
  walk_cocoon:       { f:'walk_cocoon.mp3',       v:0.12 },
  walk_swarmqueen:   { f:'walk_swarmqueen.mp3',   v:0.12 },

  // --- ekonomi / kule yönetimi ---
  coin:          { f:'coin_pickup.mp3',   v:0.22 },
  gem:           { f:'gem_pickup.mp3',    v:0.40 },
  tower_place:   { f:'tower_place.mp3',   v:0.40 },
  tower_upgrade: { f:'tower_upgrade.mp3', v:0.42 },
  tower_sell:    { f:'tower_sell.mp3',    v:0.38 },
  tower_select:  { f:'tower_select.mp3',  v:0.28 },
  target_mode:   { f:'tower_target_mode.mp3', v:0.30 },

  // --- oyun akışı ---
  wave_start:    { f:'wave_start.mp3',    v:0.50 },
  wave_complete: { f:'wave_complete.mp3', v:0.45 },
  life_lost:     { f:'life_lost.mp3',     v:0.45 },
  victory:       { f:'game_victory.mp3',  v:0.55 },
  defeat:        { f:'game_defeat.mp3',   v:0.50 },
  level_unlock:  { f:'level_unlock.mp3',  v:0.45 },

  // --- arayüz ---
  ui_tap:        { f:'ui_menu_tap.mp3',    v:0.35 },
  ui_click:      { f:'ui_button_click.mp3',v:0.32 },
  ui_error:      { f:'ui_error.mp3',       v:0.38 },
  ui_pause:      { f:'ui_pause.mp3',       v:0.35 },
  ui_resume:     { f:'ui_resume.mp3',      v:0.35 },
  ui_speed:      { f:'ui_speed_toggle.mp3',v:0.30 },

  // --- ortam ---
  bird:          { f:'bird_chirp.mp3',     v:0.22 },
};

/* Döngüye giren ortam katmanları ayrı tutulur: bunlar tek atışlık
   değil, sürekli çalan ve birbirine karışan katmanlar.
   Ses düzeyleri, sürekli çaldıkları için oyun efektlerinin önüne
   geçmesin diye %70 kısıldı (ör. orman 0.22 -> 0.066). */
const AMBIENCE = {
  forest: { f:'ambience_forest.mp3',       v:0.066 },
  rain:   { f:'ambience_rain.mp3',         v:0.084 },
  winter: { f:'ambience_winter_wind.mp3',  v:0.072 },
  battle: { f:'ambience_battle_drone.mp3', v:0.060 },
};

let sfxMode = 'idle';        // idle | buffer | element | off
let sfxLoading = false;
const sfxBuffers = {};       // anahtar -> AudioBuffer   ('buffer' kipi)
const sfxElements = {};      // anahtar -> HTMLAudioElement şablonu ('element' kipi)
let sfxMasterGain = null;

function sfxMaster(){
  const c = ensureAudioCtx();   // audio.js
  if(!c) return null;
  if(!sfxMasterGain || sfxMasterGain.context !== c){
    sfxMasterGain = c.createGain();
    sfxMasterGain.gain.value = 1;
    sfxMasterGain.connect(c.destination);
  }
  return sfxMasterGain;
}

/* Tek bir dosyayı çözer. Başarısız olursa null döner — çağıran,
   o anahtarı sessizce atlayıp sentezlenmiş sese düşer. */
async function decodeSfx(ctx, url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(res.status + ' ' + url);
  const buf = await res.arrayBuffer();
  // Safari hâlâ geri-çağırmalı imzayı istiyor; ikisini de destekle.
  return await new Promise((resolve, reject)=>{
    const p = ctx.decodeAudioData(buf, resolve, reject);
    if(p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

/* Kütüphaneyi bir kez yükler. İlk kullanıcı dokunuşundan sonra
   (ensureAudioCtx bir bağlam üretebildiğinde) çağrılmalı; öncesinde
   tarayıcı zaten ses çalmaya izin vermez. */
function loadSfxLibrary(){
  if(sfxLoading || sfxMode === 'off') return;
  sfxLoading = true;
  /* DİKKAT: burada ensureAudioCtx() ÇAĞIRMA. Bizi zaten o çağırıyor
     (bağlamı kurar kurmaz) ve o da bizi çağırdığı için ikisi sonsuz
     özyinelemeye giriyor. Bağlam hazırsa global audioCtx doludur;
     değilse yükleme bir sonraki dokunuşa ertelenir. */
  const ctx = audioCtx;           // audio.js
  if(!ctx){ sfxLoading = false; return; }

  const keys = Object.keys(SFX).concat(Object.keys(AMBIENCE).map(k=>'amb_'+k));
  const src = k => SFX_DIR + (k.startsWith('amb_') ? AMBIENCE[k.slice(4)].f : SFX[k].f);

  // Önce tek bir dosyayla fetch+decode yolunun çalışıp çalışmadığını
  // sına: file:// ile açılan sayfalarda fetch CORS'a takılır ve tüm
  // kütüphaneyi denemek boşuna 60 hata üretir.
  decodeSfx(ctx, src('ui_tap'))
    .then(buf=>{
      sfxMode = 'buffer';
      sfxBuffers['ui_tap'] = buf;
      keys.forEach(k=>{
        if(sfxBuffers[k]) return;
        decodeSfx(ctx, src(k)).then(b=>{ sfxBuffers[k] = b; }).catch(()=>{});
      });
    })
    .catch(()=>{
      // Yedek: <audio> öğeleri. file:// altında da çalışır, ama üst
      // üste binen sesler için her seferinde klonlamak gerekir.
      sfxMode = 'element';
      keys.forEach(k=>{
        try{
          const a = new Audio(src(k));
          a.preload = 'auto';
          sfxElements[k] = a;
        }catch(e){}
      });
      if(!Object.keys(sfxElements).length) sfxMode = 'off';
    });
}

/* Bir örneği çalar. Örnek hazır değilse false döner — çağıran o
   zaman sentezlenmiş sese düşer.
   opts.vol  : taban ses düzeyi çarpanı (varsayılan 1)
   opts.rate : perde/hız çarpanı; tekrarlayan sesler aynı duyulmasın
   opts.delay: saniye cinsinden gecikme */
function playSfx(key, opts){
  if(!soundEnabled) return true;   // ses kapalı: "çalındı" say, sentez de çalmasın
  const def = SFX[key] || (key.startsWith('amb_') ? AMBIENCE[key.slice(4)] : null);
  if(!def) return false;
  const o = opts || {};
  const vol = def.v * (o.vol !== undefined ? o.vol : 1);

  if(sfxMode === 'buffer'){
    const buf = sfxBuffers[key];
    if(!buf) return false;
    const c = ensureAudioCtx();
    const master = sfxMaster();
    if(!c || !master) return false;
    const srcNode = c.createBufferSource();
    srcNode.buffer = buf;
    if(o.rate) srcNode.playbackRate.value = o.rate;
    const g = c.createGain();
    g.gain.value = vol;
    srcNode.connect(g); g.connect(master);
    srcNode.start(c.currentTime + (o.delay || 0));
    return true;
  }

  if(sfxMode === 'element'){
    const tpl = sfxElements[key];
    if(!tpl) return false;
    const play = ()=>{
      try{
        const a = tpl.cloneNode();
        a.volume = Math.max(0, Math.min(1, vol));
        if(o.rate) a.playbackRate = o.rate;
        const pr = a.play();
        if(pr && pr.catch) pr.catch(()=>{});
      }catch(e){}
    };
    if(o.delay) setTimeout(play, o.delay*1000); else play();
    return true;
  }

  return false;
}

/* Tekrarlayan sesler için küçük perde savrulması — aynı örnek arka
   arkaya çalınca makineli tüfek gibi duyulmasın. */
function sfxWobble(amount){
  const a = amount === undefined ? 0.06 : amount;
  return 1 + (Math.random()*2-1)*a;
}

/* ============================================================
   ORTAM KATMANLARI — mevsim/hava katmanı + dalga sırasındaki
   gerilim katmanı. İkisi bağımsız döngüler; birbirine karışır.
   ============================================================ */
const ambLayers = {};   // ad -> {src, gain, key}

function stopAmbience(name, fadeSec){
  const l = ambLayers[name];
  if(!l) return;
  delete ambLayers[name];
  const c = audioCtx;
  if(l.el){                       // 'element' kipi
    const el = l.el;
    const steps = 10, dur = (fadeSec || 0.8)*1000/steps;
    let i = steps;
    const t = setInterval(()=>{
      i--;
      try{ el.volume = Math.max(0, el.volume * (i/steps)); }catch(e){}
      if(i<=0){ clearInterval(t); try{ el.pause(); }catch(e){} }
    }, dur);
    return;
  }
  if(!c || !l.gain) return;
  const now = c.currentTime;
  try{
    l.gain.gain.cancelScheduledValues(now);
    l.gain.gain.setValueAtTime(l.gain.gain.value, now);
    l.gain.gain.linearRampToValueAtTime(0.0001, now + (fadeSec || 0.8));
    l.src.stop(now + (fadeSec || 0.8) + 0.05);
  }catch(e){}
}

/* name: mantıksal kanal ('weather' / 'battle'), key: AMBIENCE anahtarı.
   Aynı kanalda aynı parça zaten çalıyorsa hiçbir şey yapmaz. */
function startAmbience(name, key, fadeSec){
  if(!soundEnabled){ stopAmbience(name, 0.3); return; }
  const cur = ambLayers[name];
  if(cur && cur.key === key) return;
  if(cur) stopAmbience(name, 0.6);
  const def = AMBIENCE[key];
  if(!def) return;

  if(sfxMode === 'buffer'){
    const buf = sfxBuffers['amb_'+key];
    if(!buf) return;                       // henüz yüklenmedi; sonra tekrar denenir
    const c = ensureAudioCtx();
    const master = sfxMaster();
    if(!c || !master) return;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = c.createGain();
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(def.v, now + (fadeSec || 1.5));
    src.connect(g); g.connect(master);
    src.start(now);
    ambLayers[name] = { src, gain:g, key };
    return;
  }

  if(sfxMode === 'element'){
    const tpl = sfxElements['amb_'+key];
    if(!tpl) return;
    try{
      const el = tpl.cloneNode();
      el.loop = true; el.volume = 0;
      const pr = el.play();
      if(pr && pr.catch) pr.catch(()=>{});
      const steps = 12, dur = (fadeSec || 1.5)*1000/steps;
      let i = 0;
      const t = setInterval(()=>{
        i++;
        try{ el.volume = Math.min(def.v, def.v * (i/steps)); }catch(e){}
        if(i>=steps) clearInterval(t);
      }, dur);
      ambLayers[name] = { el, key };
    }catch(e){}
  }
}

/* Oyun durumuna bakıp hangi ortam katmanlarının çalması gerektiğine
   karar verir. Bölüm yüklenince, dalga başlayınca/bitince ve menüye
   dönünce çağrılır; ayrıca kütüphane geç yüklendiyse diye oyun
   döngüsünden saniyede bir tazelenir (bkz. main.js). */
function updateAmbience(){
  if(!soundEnabled || sfxMode === 'off' || sfxMode === 'idle'){
    stopAmbience('weather', 0.4); stopAmbience('battle', 0.4);
    return;
  }
  // Menüdeyken yalnızca sakin orman katmanı
  const inMenu = document.body.classList.contains('in-menu');
  const theme = (typeof level !== 'undefined' && level && level.theme) || null;

  let weather = 'forest';
  if(!inMenu && typeof level !== 'undefined' && level){
    if(level.twist === 'rain') weather = 'rain';
    else if(theme && theme.season === 'winter') weather = 'winter';
  }
  startAmbience('weather', weather);

  const fighting = !inMenu && typeof waveActive !== 'undefined' && waveActive
                   && !paused && !gameOver && !gameWon;
  if(fighting) startAmbience('battle', 'battle');
  else stopAmbience('battle', 1.2);
}

/* Ses açma/kapama anahtarı ortam katmanlarını da etkilemeli. */
function syncAmbienceWithSoundPref(){
  if(!soundEnabled){
    stopAmbience('weather', 0.3);
    stopAmbience('battle', 0.3);
  } else {
    loadSfxLibrary();
    updateAmbience();
  }
}

/* ============================================================
   DÜŞMAN AYAK SESLERİ — her düşman için ayrı ayrı çalmak kakofoni
   olurdu (bir dalgada 100+ birim olabiliyor). Bunun yerine sahada
   BULUNAN HER TÜR için, o türün hızına göre belirlenen aralıklarla
   tek bir adım sesi çalınır; üstüne genel bir hız sınırı konur.
   ============================================================ */
const walkTimers = {};
let walkGate = 0;             // türler arası asgari boşluk (saniye)

function updateWalkSounds(dt){
  if(!soundEnabled || sfxMode === 'off' || sfxMode === 'idle') return;
  if(typeof enemies === 'undefined' || !enemies.length) return;

  walkGate -= dt;

  // Sahadaki türleri say — kalabalık tür biraz daha yüksek duyulsun.
  const counts = {};
  for(let i=0;i<enemies.length;i++){
    const ty = enemies[i].type;
    if(ty) counts[ty] = (counts[ty]||0) + 1;
  }

  Object.keys(walkTimers).forEach(ty=>{ if(!counts[ty]) delete walkTimers[ty]; });

  Object.keys(counts).forEach(ty=>{
    const def = ENEMY_TYPES[ty];
    if(!def || !SFX['walk_'+ty]) return;
    // Hızlı birim sık, ağır birim seyrek adımlar
    const interval = Math.max(0.35, Math.min(2.2, 0.9 / Math.max(0.25, def.speed)));
    if(walkTimers[ty] === undefined) walkTimers[ty] = Math.random()*interval;
    walkTimers[ty] -= dt;
    if(walkTimers[ty] > 0) return;
    walkTimers[ty] = interval;
    if(walkGate > 0) return;             // başka bir tür az önce çaldı
    const crowd = Math.min(1.6, 0.7 + Math.log2(1 + counts[ty])*0.25);
    if(playSfx('walk_'+ty, { vol:crowd, rate:sfxWobble(0.08) })) walkGate = 0.07;
  });
}
