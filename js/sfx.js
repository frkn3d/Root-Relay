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
/* Bir ses dosyası aynı adla YENİDEN üretildiğinde tarayıcı eskisini
   önbellekten servis ediyor. index.html'deki ?v= mantığının aynısı:
   sound/ içindeki bir dosyayı değiştirince bu sayıyı bir artır. */
const SFX_VER = 2;
function sfxUrl(file){ return SFX_DIR + file + '?v=' + SFX_VER; }

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
  // ZIRHLI: plaka ayaktayken metalik/tok, plaka kırıldıktan sonra etli
  hit_armor_shield:{ f:'hit_armor_shield.mp3', v:0.28 },
  hit_armor_body:  { f:'hit_armor_body.mp3',   v:0.26 },
  hit_burn:      { f:'hit_fire_burn.mp3', v:0.02 },   // sürekli cızırdadığı için kütüphanenin en kısığı

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
  walk_armor:        { f:'walk_armor.mp3',        v:0.14 },

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
  bird:          { f:'bird_chirp.mp3',     v:0.022 },  // arada bir ötüyor, çok kısık
};

/* Döngüye giren ortam katmanları ayrı tutulur: bunlar tek atışlık
   değil, sürekli çalan ve birbirine karışan katmanlar.
   Hepsi bilinçli olarak ÇOK KISIK: arka planda durmalılar, oyun
   efektlerinin önüne geçmemeliler. Değerler iki turda %70'er
   kısıldı — artık 0.016-0.021 bandında, yani neredeyse yalnızca
   sessizliği dolduran bir doku. menu_music bunun dışında: o
   ambiyans değil, müzik. */
const AMBIENCE = {
  // --- orman ---
  forest:            { f:'ambience_forest.mp3',                 v:0.020 },
  forest_deep:       { f:'ambience_forest_deep.mp3',            v:0.020 },
  forest_mystic:     { f:'ambience_forest_mystic.mp3',          v:0.019 },
  forest_stream:     { f:'ambience_forest_stream.mp3',          v:0.021 },
  // --- çöl ---
  desert_dunes:      { f:'ambience_desert_dunes.mp3',           v:0.020 },
  desert_oasis:      { f:'ambience_desert_oasis.mp3',           v:0.019 },
  desert_storm:      { f:'ambience_desert_storm.mp3',           v:0.017 },   // gürültülü, en kısığı
  // --- tundra ---
  tundra_calm:       { f:'ambience_tundra_calm.mp3',            v:0.020 },
  tundra_blizzard:   { f:'ambience_tundra_blizzard.mp3',        v:0.017 },
  tundra_glacier:    { f:'ambience_tundra_glacier.mp3',         v:0.019 },
  // --- bataklık ---
  swamp_night:       { f:'ambience_swamp_night.mp3',            v:0.020 },
  swamp_fog:         { f:'ambience_swamp_fog.mp3',              v:0.020 },
  swamp_drizzle:     { f:'ambience_swamp_drizzle.mp3',          v:0.021 },
  // --- volkanik ---
  volcanic_caldera:  { f:'ambience_volcanic_caldera.mp3',       v:0.019 },
  volcanic_ash:      { f:'ambience_volcanic_ash.mp3',           v:0.020 },
  volcanic_rumble:   { f:'ambience_volcanic_rumble.mp3',        v:0.017 },   // bas ağırlıklı
  // --- akdeniz ---
  med_coast:         { f:'ambience_mediterranean_coast.mp3',    v:0.021 },
  med_breeze:        { f:'ambience_mediterranean_breeze.mp3',   v:0.020 },
  med_cicadas:       { f:'ambience_mediterranean_cicadas.mp3',  v:0.018 },   // tiz, kolay yorar
  // --- savan ---
  savanna_wind:      { f:'ambience_savanna_wind.mp3',           v:0.020 },
  savanna_dusk:      { f:'ambience_savanna_dusk.mp3',           v:0.020 },
  savanna_wild:      { f:'ambience_savanna_wild.mp3',           v:0.020 },
  // --- hava durumu katmanı (biyomun ÜSTÜNE biner) ---
  rain:              { f:'ambience_rain.mp3',                   v:0.019 },
  winter:            { f:'ambience_winter_wind.mp3',            v:0.016 },
  // --- dalga gerilimi katmanı ---
  battle:            { f:'ambience_battle_drone.mp3',           v:0.018 },
  /* Ana menü teması. Ambiyans DEĞİL, müzik: menüde tek başına çalıyor
     (biyom/hava/savaş katmanları orada susuyor) ve duyulması gereken
     şey o. Bu yüzden ambiyans bandının (0.016-0.021) çok üstünde,
     efekt seslerinin de üstünde. */
  menu_music:        { f:'music_main_menu.mp3',                 v:0.450 },
};

/* Her biyomun kendi ambiyans havuzu (levelgen.js'teki BIOMES ile aynı
   kimlikler). Bir bölümde havuzdaki parçalar TEK TEK değil, SIRAYLA
   çalınır: bir parça bir süre döndükten sonra yavaşça bir sonrakine
   geçilir (bkz. rotateBiomeAmbience). Böylece aynı 12 saniyelik
   döngüyü bölüm boyunca dinlemek zorunda kalmıyorsun. */
const BIOME_AMBIENCE = {
  forest:        ['forest_deep', 'forest_mystic', 'forest_stream', 'forest'],
  desert:        ['desert_dunes', 'desert_oasis', 'desert_storm'],
  tundra:        ['tundra_calm', 'tundra_glacier', 'tundra_blizzard'],
  swamp:         ['swamp_night', 'swamp_fog', 'swamp_drizzle'],
  volcanic:      ['volcanic_caldera', 'volcanic_ash', 'volcanic_rumble'],
  mediterranean: ['med_coast', 'med_breeze', 'med_cicadas'],
  savanna:       ['savanna_wind', 'savanna_dusk', 'savanna_wild'],
};

/* Bir parçanın ne kadar çalacağı (saniye). Aralık geniş tutuldu ki
   geçişler saat gibi düzenli gelmesin. */
const AMB_HOLD_MIN = 42, AMB_HOLD_MAX = 78;
const AMB_CROSSFADE = 3.5;   // parçalar arası çapraz geçiş süresi

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
  const src = k => sfxUrl(k.startsWith('amb_') ? AMBIENCE[k.slice(4)].f : SFX[k].f);

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

/* name: mantıksal kanal ('biome' / 'weather' / 'battle'),
   key: AMBIENCE anahtarı.
   Aynı kanalda aynı parça zaten çalıyorsa hiçbir şey yapmaz.
   outFade verilirse eski parça o sürede söner — böylece iki parça
   üst üste binerek ÇAPRAZ GEÇİŞ yapar (biyom havuzu bunu kullanır).
   Dönüş: parça gerçekten başlatılabildi mi (tampon henüz yüklenmemiş
   olabilir; o zaman false döner ve çağıran sonra tekrar dener). */
function startAmbience(name, key, fadeSec, outFade){
  if(!soundEnabled){ stopAmbience(name, 0.3); return false; }
  const cur = ambLayers[name];
  if(cur && cur.key === key) return true;
  const def = AMBIENCE[key];
  if(!def) return false;
  // Yeni parçanın tamponu hazır değilse eskisini SUSTURMA — sessizlik
  // yerine çalmaya devam etsin, geçiş bir sonraki denemede olur.
  if(sfxMode === 'buffer' && !sfxBuffers['amb_'+key]) return false;
  if(sfxMode === 'element' && !sfxElements['amb_'+key]) return false;
  if(cur) stopAmbience(name, outFade || 0.6);

  if(sfxMode === 'buffer'){
    const buf = sfxBuffers['amb_'+key];
    if(!buf) return false;                 // henüz yüklenmedi; sonra tekrar denenir
    const c = ensureAudioCtx();
    const master = sfxMaster();
    if(!c || !master) return false;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = c.createGain();
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(def.v, now + (fadeSec || 1.5));
    src.connect(g); g.connect(master);
    src.start(now);
    ambLayers[name] = { src, gain:g, key };
    return true;
  }

  if(sfxMode === 'element'){
    const tpl = sfxElements['amb_'+key];
    if(!tpl) return false;
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
      return true;
    }catch(e){ return false; }
  }
  return false;
}

/* --- biyom havuzunun sırası --- */
let ambPoolId = null;    // hangi biyomun havuzu kurulu
let ambOrder = [];       // karılmış çalma sırası
let ambCursor = 0;
let ambNextAt = 0;       // bir sonraki geçişin zamanı (performance.now())

function shuffled(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}

/* Bölümün biyomuna ait havuzdan sıradaki parçaya geçer. Süresi
   dolmadıysa hiçbir şey yapmaz. Parça henüz yüklenmemişse zamanlayıcı
   ilerletilmez; bir sonraki turda tekrar denenir. */
function rotateBiomeAmbience(poolId){
  if(poolId !== ambPoolId){
    // Biyom değişti (yeni bölüm): havuzu yeniden kur ve HEMEN geç
    ambPoolId = poolId;
    ambOrder = shuffled(BIOME_AMBIENCE[poolId] || BIOME_AMBIENCE.forest);
    ambCursor = 0;
    ambNextAt = 0;
  }
  const now = performance.now();
  if(now < ambNextAt) return;
  const key = ambOrder[ambCursor % ambOrder.length];
  const first = !ambLayers.biome;
  if(!startAmbience('biome', key, first ? 2.0 : AMB_CROSSFADE, AMB_CROSSFADE)) return;
  ambCursor++;
  // Sıranın sonuna gelindiyse bir dahaki tura yeniden karıştır
  if(ambCursor % ambOrder.length === 0) ambOrder = shuffled(ambOrder);
  ambNextAt = now + (AMB_HOLD_MIN + Math.random()*(AMB_HOLD_MAX-AMB_HOLD_MIN))*1000;
}

/* Oyun durumuna bakıp hangi ortam katmanlarının çalması gerektiğine
   karar verir. Üç bağımsız katman var:
     menu    — ana menü teması (yalnızca menüde; diğer üçü susar)
     biome   — haritanın biyomuna ait, birkaç parça arasında dönen
               taban dokusu (orman / çöl / tundra / bataklık /
               volkanik / akdeniz / savan)
     weather — yağmur ya da kış rüzgârı; biyomun ÜSTÜNE biner
     battle  — dalga sürerken giren gerilim uğultusu
   Bölüm yüklenince, dalga başlayınca/bitince ve menüye dönünce
   çağrılır; ayrıca hem kütüphane geç yüklenmiş olabileceği hem de
   biyom parçalarının zamanı gelince değişmesi gerektiği için oyun
   döngüsünden saniyede bir tazelenir (bkz. main.js). */
function updateAmbience(){
  if(!soundEnabled || sfxMode === 'off' || sfxMode === 'idle'){
    stopAmbience('menu', 0.4); stopAmbience('biome', 0.4);
    stopAmbience('weather', 0.4); stopAmbience('battle', 0.4);
    return;
  }
  const inMenu = document.body.classList.contains('in-menu');
  const lv = (typeof level !== 'undefined') ? level : null;
  const theme = (lv && lv.theme) || null;

  /* MENÜDE AMBİYANS YOK. Menünün kendi müziği var (music_main_menu);
     harita ambiyansı oraya ait değil. Biyom/hava/savaş katmanlarının
     üçü de burada susturulur — menü yalnızca müzik duyar. */
  if(inMenu){
    startAmbience('menu', 'menu_music', 2.0);
    stopAmbience('biome', 1.2); stopAmbience('weather', 1.0); stopAmbience('battle', 1.0);
    ambPoolId = null;          // menüden çıkınca havuz sıfırdan kurulsun
    return;
  }
  stopAmbience('menu', 1.5);

  // Klasik bölümlerin (LEVELS) teması yok — orman kabul edilir.
  const biome = (theme && BIOME_AMBIENCE[theme.biome]) ? theme.biome : 'forest';
  rotateBiomeAmbience(biome);

  /* Hava katmanı biyomun yerine geçmez, üstüne biner: yağmur
     twist'inde yağmur, kış mevsiminde rüzgâr. Tundra zaten kendi
     kış dokusunu taşıdığı için orada rüzgâr katmanı eklenmez. */
  let weather = null;
  if(!inMenu && lv){
    if(lv.twist === 'rain') weather = 'rain';
    else if(theme && theme.season === 'winter' && theme.biome !== 'tundra') weather = 'winter';
  }
  if(weather) startAmbience('weather', weather, 2.5);
  else stopAmbience('weather', 1.5);

  const fighting = !inMenu && typeof waveActive !== 'undefined' && waveActive
                   && !paused && !gameOver && !gameWon;
  if(fighting) startAmbience('battle', 'battle', 1.5);
  else stopAmbience('battle', 1.2);
}

/* Ses açma/kapama anahtarı ortam katmanlarını da etkilemeli. */
function syncAmbienceWithSoundPref(){
  if(!soundEnabled){
    stopAmbience('menu', 0.3);
    stopAmbience('biome', 0.3);
    stopAmbience('weather', 0.3);
    stopAmbience('battle', 0.3);
  } else {
    loadSfxLibrary();
    ambNextAt = 0;          // kapalıyken kaçan geçiş hemen yapılsın
    updateAmbience();
  }
}

/* ============================================================
   DÜŞMAN AYAK SESLERİ — HER BİRİM KENDİ ADIMINI ATAR.
   Önceden tür başına tek sayaç vardı: sahadaki bütün sürüngenler
   aynı anda tek bir adım sesi çıkarıyordu, bölük yürüyüşü gibi
   duyuluyordu. Artık her düşmanın kendi sayacı var ve aralığı
   kendi tempo çarpanıyla (e.gait, engine-update.js) ölçekleniyor —
   yani sesler animasyonuyla aynı ritimde ve birbirinden bağımsız.

   Kalabalıkta bu çok fazla örnek demek olurdu; iki fren var:
     walkGate — iki adım sesi arasındaki asgari boşluk (global)
     ses düzeyi — kalabalık arttıkça TEK adım kısılır; toplam
                  gürültü adım sayısından gelsin, tek tek
                  yükseklikten değil.
   Sayaç düşmanın kendi üzerinde (e.stepT) tutuluyor, böylece
   birim ölünce temizlenecek ayrı bir tablo kalmıyor.
   ============================================================ */
let walkGate = 0;             // iki adım arası asgari boşluk (saniye)

function updateWalkSounds(dt){
  if(!soundEnabled || sfxMode === 'off' || sfxMode === 'idle') return;
  if(typeof enemies === 'undefined' || !enemies.length) return;

  walkGate -= dt;

  const n = enemies.length;
  // 1 birim: tam ses, 4 birim: ~0.6, 16 birim: ~0.4
  const vol = Math.max(0.34, Math.min(1, 1.15 / (0.8 + Math.log2(1+n)*0.5)));

  for(let i=0;i<n;i++){
    const e = enemies[i];
    const def = ENEMY_TYPES[e.type];
    if(!def || !SFX['walk_'+e.type]) continue;

    // Hızlı birim sık, ağır birim seyrek adımlar; e.gait bireysel fark
    let interval = Math.max(0.35, Math.min(2.2, 0.9 / Math.max(0.25, def.speed))) * (e.gait || 1);
    // Donmuş birim ağır ağır yürür, adımı da seyrekleşir
    if(e.slowT > 0 && e.slowFactor > 0) interval /= e.slowFactor;

    if(e.stepT === undefined) e.stepT = Math.random()*interval;   // ilk adım rastgele anda
    e.stepT -= dt;
    if(e.stepT > 0) continue;
    e.stepT = interval;
    if(walkGate > 0) continue;   // az önce başkası bastı; bu adım yutulur
    if(playSfx('walk_'+e.type, { vol, rate:(e.stepPitch || 1)*sfxWobble(0.05) }))
      walkGate = 0.085;
  }
}
