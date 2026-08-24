/* ============================================================
   VERİ KATMANI
   Yeni düşman/kule/bölüm eklemek için sadece bu dosya değişir.
   ============================================================ */
/* Not: Aşağıdaki hp değerleri, genel denge güncellemesiyle %20 artırılmıştır. */
const ENEMY_TYPES = {
  spore:    { hp:31,  speed:0.85, radius:15, gold:6,  dmgToLives:1, label:'Spor',    shape:'blob',   body:'#ff8f78', body2:'#c94f42', eyes:1 },
  swarm:    { hp:12,  speed:1.1,  radius:9,  gold:3,  dmgToLives:1, label:'Sürü',    shape:'blob',   body:'#c9e07a', body2:'#7a9c3a', eyes:1 },
  sprinter: { hp:19,  speed:1.6,  radius:12, gold:4,  dmgToLives:1, label:'Koşucu',  shape:'runner', body:'#ffbf6b', body2:'#d98a2e', eyes:2 },
  husk:     { hp:60,  speed:0.62, radius:17, gold:9,  dmgToLives:1, label:'Kabuklu', shape:'brute',  body:'#c9b483', body2:'#8a6f42', eyes:2 },
  brute:    { hp:178, speed:0.48, radius:21, gold:13, dmgToLives:1, label:'Ur',      shape:'brute',  body:'#b25bc9', body2:'#6f2f88', eyes:2 },
  /* KÜP — öldüğünde ikiye bölünür. Çocuklar ebeveynin canının ve
     boyutunun %40'ı kadar olur. splitsLeft tükenene dek bölünmeye
     devam eder. Yolda zikzak çizerek "deli gibi" ilerler. */
  /* Denge güncellemesi: bölünmemiş küp +%10, ilk bölünme (orta boy)
     +%15, en küçüğe bölünenler (2. ve 3. küçülme — ikisi de minRadius'a
     kenetlendiği için ekranda aynı boyda görünür) +%35, sonra bir tur
     daha +%35 (küçükler daha da hızlı olsun istendi — toplamda taban
     çarpanın üstüne ~%82) hızlandırıldı. */
  /* Küp artık her dalgaya karışık düşebildiğinden (bkz. levelgen.js
     buildWaves) toplam bölünme ağacından gelen altın da önceki
     dedike-dalga tasarımına göre çok daha sık kazanılıyordu; bu yüzden
     taban altın %50 düşürüldü (8 -> 4). Çocuklar zaten ebeveynin
     %50'sini aldığından bu, tüm zincirin toplam getirisini orantılı
     olarak yarıya indiriyor. */
  cube:     { hp:130, speed:0.07975, radius:20, gold:4,  dmgToLives:1, label:'Küp',     shape:'cube',   body:'#ff9f43', body2:'#b5541a', eyes:2,
              splits:3, splitHpFactor:0.40, splitSizeFactor:0.40, minRadius:6, wobble:26,
              /* Nesil başına hız çarpanı (taban hıza göre):
                 1. küçülme (orta boy) +%15 ek — değişmedi.
                 2. ve 3. küçülme (küçükler) +%35 ek, sonra +%35 daha ek. */
              splitSpeedMults:[1.725, 3.645, 4.55625] },
  /* KALKAN TAŞIYICI — önünde enerji kalkanı taşır. Önden gelen
     mermiler seker; yalnızca yandan/arkadan hasar alır. Kule
     konumlandırmayı anlamlı hale getirir. */
  shieldbearer:{ hp:95, speed:0.5, radius:17, gold:14, dmgToLives:1, label:'Kalkan', shape:'shield',
                 body:'#8fa6c9', body2:'#3d4f70', eyes:2, blockArc:1.25 },

  /* KULUÇKA — yaşadıkça yol boyunca yavru bırakır. Küp'ün tersi:
     Küp ölünce çoğalır, bu yaşadıkça çoğalır. */
  brooder:  { hp:120, speed:0.42, radius:19, gold:16, dmgToLives:1, label:'Kuluçka', shape:'brooder',
              body:'#c98fd4', body2:'#5e3170', eyes:2,
              broodEvery:3.2, broodType:'swarm', broodMax:8 },

  /* YANSITICI — vurulduğunda hasarın bir kısmını atan kuleye geri
     yansıtır; kule kısa süre aşırı yüklenip ateş edemez. Tek hedefe
     kilitlenmeyi cezalandırır. */
  reflector:{ hp:110, speed:0.52, radius:16, gold:15, dmgToLives:1, label:'Yansıtıcı', shape:'reflector',
              body:'#e8e2a8', body2:'#8a7a3a', eyes:2, overloadSec:1.1, overloadChance:0.55 },

  /* ŞİŞE — öldüğünde kırılır ve yere dökülen sıvı, uzun süre
     çevredeki düşmanları iyileştirir. Öncelik sırası kurmayı
     zorunlu kılar: önce şişeyi mi yoksa etrafındakileri mi? */
  flask:    { hp:64, speed:0.55, radius:15, gold:11, dmgToLives:1, label:'Şişe',    shape:'flask',  body:'#7fe0a8', body2:'#2f7a52', eyes:2,
              healRadius:58, healPerSec:7, healDuration:45 },
  /* BÜYÜK BOSS — çok yavaş, çok dayanıklı. Etrafında bir don fırtınası
     taşır: auraRadius içindeki kulelerin atış hızını auraSlow oranında
     düşürür (0.5 = %50 yavaş). */
  frostlord:{ hp:910, speed:0.26, radius:24, gold:120, dmgToLives:1, label:'Don Efendisi', shape:'boss',
              body:'#7fd4ea', body2:'#2d5f80', eyes:2, boss:true, auraRadius:83, auraSlow:0.5 },

  /* KIVILCIM KOZASI — kamikaze. Öldüğünde geniş bir alana patlayıcı
     polen saçar; patlama yarıçapındaki kuleleri deathBlindDuration
     saniyeliğine kör edip ateş edemez hale getirir (bkz. engine.js'te
     "KIVILCIM PATLAMASI"). Yalnızca bölümün son dalgalarında görülür. */
  cocoon:   { hp:70, speed:0.5, radius:18, gold:15, dmgToLives:1, label:'Kıvılcım Kozası', shape:'cocoon',
              body:'#ff7a3f', body2:'#7a1f0a', eyes:0, deathBlindRadius:100, deathBlindDuration:2.5 },

  /* SÜRÜ ANASI — Don Efendisi'nin tersi: kuleleri değil müttefiklerini
     güçlendirir. Kendisi zayıf; yakınındaki Spor/Sürü'ye hız ve hafif
     hasar direnci verir. Onu öncelikli öldürmek dalgayı belirgin
     şekilde kolaylaştırır (bkz. engine.js "SÜRÜ ANASI AURASI"). */
  swarmqueen:{ hp:38, speed:0.6, radius:19, gold:14, dmgToLives:1, label:'Sürü Anası', shape:'blob',
              body:'#f0c419', body2:'#8a6510', eyes:2,
              auraRadius:120, allyBuffTypes:['spore','swarm'], allySpeedBuff:0.28, allyDmgResist:0.20 },
};

/* maxCount: bölüm başına bu kuleden en fazla kaç tane SATIN ALINABİLİR
   (satılsa bile hak geri gelmez — bkz. engine.js towerPurchaseCounts).
   Zehir ve Ateş alan/süre etkili oldukları için orantısız güçlü
   kalmasınlar diye 2 ile sınırlı; diğerleri 5. */
const TOWER_TYPES = {
  archer: { id:'archer', name:'Yosun Okçusu', cost:40,  range:150, rate:0.8,  dmg:9,  splash:0,  kind:'archer', color:'#7fb377', icon:'🏹', maxCount:7 },
  mage:   { id:'mage',   name:'Işık Kulesi',  cost:80,  range:185, rate:0.85, dmg:15, splash:0,  kind:'mage',   color:'#4fc3a1', icon:'🔮', maxCount:5 },
  mortar: { id:'mortar', name:'Mantar Havanı',cost:130, range:160, rate:1.7,  dmg:18, splash:58, kind:'mortar', color:'#c9793f', icon:'💥', maxCount:3 },
  ice:    { id:'ice',    name:'Don Peykesi',  cost:60,  range:140, rate:0.7,  dmg:0,  splash:0,  kind:'ice',    color:'#8fd9f0', icon:'❄️', slowFactor:0.42, slowDuration:5.6, maxCount:5 },
  /* ZEHİR SARMAŞIĞI — vuruşta az hasar, ardından zamana yayılı hasar.
     Zırhlı/kalabalık dalgalarda birikerek etkili olur. */
  poison: { id:'poison', name:'Zehir Sarmaşığı', cost:85, range:150, rate:1.15, dmg:3, splash:0, kind:'poison', color:'#9fdc5c', icon:'🌿',
            poisonDps:14, poisonDuration:3.5, maxCount:2 },
  /* ŞİMŞEK DİREĞİ — vurduğu hedeften yakındaki düşmanlara sıçrar.
     Her sıçramada hasar azalır. Kalabalığa karşı güçlü. */
  bolt:   { id:'bolt',   name:'Şimşek Direği', cost:155, range:175, rate:1.35, dmg:20, splash:0, kind:'bolt', color:'#ffe066', icon:'⚡',
            chainCount:3, chainFalloff:0.6, chainRange:95, maxCount:5 },
  /* ATEŞ KULESİ — mermi atmaz, nişan açısındaki geniş bir KONİ içindeki
     TÜM düşmanlara birden alev püskürtür (menzili kısa ama tek atışta
     çoklu hedef vurur). Değdiği herkesi 10 saniye boyunca yakar.
     Don Peykesi ile AYNI ANDA çalışmaz: alev üzerindeki donu/yavaşlamayı
     söndürür, don da üzerindeki yanmayı söndürür (bkz. engine.js). */
  fire:   { id:'fire',   name:'Ateş Kulesi', cost:115, range:115, rate:0.9, dmg:4, splash:0, kind:'fire', color:'#ff5a2e', icon:'🔥',
            coneAngle: Math.PI/5, burnDps:9, burnDuration:10, maxCount:2 },
};

// Yapı alanları: her segmentin orta noktası etrafında, birbirinden en az
// ~80-140px uzaklıkta yerleştirildi ki kuleler görsel olarak üst üste binmesin.
/* Kule hedefleme öncelikleri. 'first' varsayılan (çıkışa en yakın). */
const TARGET_MODES = [
  { id:'first',    label:'Öncü',   icon:'🎯', desc:'Çıkışa en yakın' },
  { id:'weakest',  label:'Zayıf',  icon:'🩸', desc:'En az canlı' },
  { id:'strongest',label:'Güçlü',  icon:'💪', desc:'En çok canlı' },
];

const LEVELS = [
  {
    id:'orman-girisi', name:'Orman Girişi', waveCount:10,
    startGold:170, startLives:10,
    path:[
      {x:-20,y:120},{x:460,y:120},{x:460,y:300},{x:140,y:300},{x:140,y:480},
      {x:460,y:480},{x:460,y:660},{x:140,y:660},{x:140,y:840},{x:460,y:840},{x:460,y:1000},
    ],
    spots:[
      {x:130,y:55}, {x:330,y:185}, {x:530,y:210},
      {x:400,y:235}, {x:200,y:365}, {x:60,y:390},
      {x:400,y:415}, {x:200,y:545}, {x:530,y:570},
      {x:400,y:595}, {x:200,y:725}, {x:60,y:750},
      {x:400,y:775}, {x:200,y:905}, {x:530,y:920},
    ],
    difficulty:{ hpGrowth:0.16, speedGrowth:0.025, speedCap:1.5, countBase:7, countGrowth:1.85 },
    waveOverrides:{
      // KÜP artık tek başına değil, diğer birimlerle karışık geliyor
      6:[ {type:'cube', count:14, interval:4.2}, {type:'swarm', count:20, interval:0.5}, {type:'sprinter', count:10, interval:0.6} ],
      9:[ {type:'swarm', count:40, interval:0.42}, {type:'sprinter', count:40, interval:0.5}, {type:'flask', count:4, interval:2.2}, {type:'husk', count:23, interval:1.35}, {type:'brute', count:21, interval:2.0} ],
      // BOSS DALGASI: tek Don Efendisi + maiyeti
      10:[ {type:'frostlord', count:1, interval:1.0}, {type:'flask', count:5, interval:2.4}, {type:'husk', count:10, interval:1.6}, {type:'sprinter', count:16, interval:0.7} ]
    }
  },
  {
    id:'sisli-vadi', name:'Sisli Vadi', waveCount:12,
    startGold:170, startLives:8,
    path:[
      {x:640,y:90},{x:320,y:90},{x:320,y:230},{x:80,y:230},{x:80,y:400},
      {x:520,y:400},{x:520,y:560},{x:200,y:560},{x:200,y:720},{x:520,y:720},
      {x:520,y:880},{x:300,y:880},{x:300,y:1000},
    ],
    spots:[
      {x:400,y:35}, {x:560,y:155}, {x:250,y:160},
      {x:110,y:295}, {x:30,y:320},
      {x:180,y:335}, {x:420,y:465}, {x:575,y:480},
      {x:260,y:495}, {x:460,y:625}, {x:130,y:640},
      {x:260,y:655}, {x:460,y:785}, {x:575,y:800},
      {x:410,y:945}, {x:230,y:940},
    ],
    difficulty:{ hpGrowth:0.21, speedGrowth:0.03, speedCap:1.65, countBase:8, countGrowth:2.15 },
    waveOverrides:{
      // KÜP artık tek başına değil, diğer birimlerle karışık geliyor
      7:[ {type:'cube', count:20, interval:4.0}, {type:'swarm', count:26, interval:0.45}, {type:'sprinter', count:14, interval:0.6}, {type:'husk', count:6, interval:1.3} ],
      11:[ {type:'swarm', count:44, interval:0.39}, {type:'sprinter', count:44, interval:0.42}, {type:'spore', count:35, interval:0.55}, {type:'flask', count:6, interval:2.0}, {type:'husk', count:26, interval:1.25}, {type:'brute', count:22, interval:1.8} ],
      // BOSS DALGASI: iki Don Efendisi + maiyeti
      12:[ {type:'frostlord', count:2, interval:9.0}, {type:'flask', count:7, interval:2.2}, {type:'brute', count:12, interval:1.8}, {type:'husk', count:16, interval:1.3}, {type:'sprinter', count:24, interval:0.6} ]
    }
  },
];

// Zorluk formülü: dalga index'inden düşman kompozisyonu üretir.
// 4 kademe: erken sürü -> hızlılar katılır -> zırhlılar katılır -> ağır tehditler.
/* Dalga bazlı düşman sayısı çarpanı:
   1. dalga normal, 2. dalga +%50, 3. dalga +%100, 4-6. dalga +%150,
   7. ve sonrası ayrıca +%70. Üstüne tüm dalgalara genel +%30 uygulanır.
   WAVE_EXTRA_MULT ile tek tek dalgalara ek ince ayar yapılabilir. */
const GLOBAL_COUNT_BOOST = 1.30;
const WAVE_EXTRA_MULT = { 8: 1.30 };  // 8. dalga ayrıca +%30

// Ek genel yoğunluk artışı (+%30) — düşman sayısını hem klasik
// bölümlerde (waveCountMultiplier) hem de 1000 Bölüm üreticisinde
// (generateWaveForGenerated, levelgen.js) yükseltir.
const EXTRA_DENSITY_BOOST = 1.30;

/* 8. dalgadan sonra dalgalar giderek kalabalıklaşsın diye doğrusal
   ek çarpan: 9. dalga +%10, 10. dalga +%20, 11. dalga +%30, ...
   Klasik bölümler (generateWave) ve 1000 Bölüm üretici
   (generateWaveForGenerated, levelgen.js) ikisi de kullanır. */
function lateWaveBoost(waveIndex){
  return waveIndex > 8 ? 1 + 0.10*(waveIndex-8) : 1;
}

/* Dalga sayısının yarısından itibaren düşmanlar birbirine daha yakın
   (daha sık) gelsin diye spawn aralığı kısaltılır — böylece kuleler
   onları tek tek rahatça temizleyemez, bölümün ikinci yarısı belirgin
   şekilde zorlaşır. (Ör: 13 dalgalı bir bölümde 6. dalgadan itibaren.)
   startWave() (engine.js) hem klasik hem 1000 Bölüm dalgaları için
   spawn zaman çizelgesini kurarken kullanır. */
function bunchIntervalMult(waveIndex, waveCount){
  return waveIndex >= Math.floor(waveCount/2) ? 0.6 : 1;
}

function waveCountMultiplier(waveIndex){
  let m;
  if(waveIndex <= 1) m = 1.0;
  else if(waveIndex === 2) m = 1.5;
  else if(waveIndex === 3) m = 2.0;
  else if(waveIndex <= 6) m = 2.5;
  else m = 2.5 * 1.7;
  return m * GLOBAL_COUNT_BOOST * EXTRA_DENSITY_BOOST * (WAVE_EXTRA_MULT[waveIndex] || 1) * lateWaveBoost(waveIndex);
}

/* Spawn aralıkları: düşman sayısı arttıkça dalganın tek seferde
   üstüne yığılmaması ve oyunun daha uzun sürmesi için araları açılır.
   Artan sayı aynı anda değil, akış halinde gelsin diye SPAWN_GAP
   sayı artışıyla birlikte yükseltildi. */
const SPAWN_GAP = 2.1;   // grup içi aralık çarpanı
const GROUP_GAP = 1.3;   // gruplar arası ek bekleme (saniye)

function generateWave(level, waveIndex){
  if(level.waveOverrides && level.waveOverrides[waveIndex]) return level.waveOverrides[waveIndex];
  const p = level.difficulty;
  const mult = waveCountMultiplier(waveIndex);
  const count = Math.round((p.countBase + Math.floor(waveIndex * p.countGrowth)) * mult);
  const groups = [];
  if(waveIndex < 2){
    groups.push({type:'spore', count:Math.ceil(count*0.7), interval:0.5*SPAWN_GAP});
    groups.push({type:'swarm', count:Math.ceil(count*0.5), interval:0.22*SPAWN_GAP});
  } else if(waveIndex < 4){
    groups.push({type:'spore', count:Math.ceil(count*0.5), interval:0.45*SPAWN_GAP});
    groups.push({type:'swarm', count:Math.ceil(count*0.4), interval:0.2*SPAWN_GAP});
    groups.push({type:'sprinter', count:Math.ceil(count*0.3), interval:0.3*SPAWN_GAP});
  } else if(waveIndex < 7){
    groups.push({type:'spore', count:Math.ceil(count*0.5), interval:0.4*SPAWN_GAP});
    groups.push({type:'swarm', count:Math.ceil(count*0.3), interval:0.2*SPAWN_GAP});
    groups.push({type:'sprinter', count:Math.ceil(count*0.4), interval:0.28*SPAWN_GAP});
    groups.push({type:'husk', count:Math.max(1,Math.floor(waveIndex/2)), interval:0.8*SPAWN_GAP});
  } else {
    groups.push({type:'spore', count:Math.ceil(count*0.45), interval:0.4*SPAWN_GAP});
    groups.push({type:'swarm', count:Math.ceil(count*0.3), interval:0.2*SPAWN_GAP});
    groups.push({type:'sprinter', count:Math.ceil(count*0.4), interval:0.26*SPAWN_GAP});
    // ŞİŞE yalnızca son 3 dalgada
    if(waveIndex > level.waveCount - 3){
      groups.push({type:'flask', count:Math.max(2,Math.floor(waveIndex/3)), interval:1.5*SPAWN_GAP});
    }
    groups.push({type:'husk', count:Math.max(2,Math.floor(waveIndex/2)), interval:0.7*SPAWN_GAP});
    groups.push({type:'brute', count:Math.max(1,Math.floor(waveIndex/3)), interval:1.0*SPAWN_GAP});
  }
  return groups;
}
/* Belirli dalgalara ek can çarpanı. Formülden gelen artışın üstüne biner. */
const WAVE_EXTRA_HP = { 4:1.20, 5:1.30, 6:1.30, 7:1.40, 8:1.50, 9:1.55, 10:1.60, 11:1.65, 12:1.70 };

function statMultipliers(level, waveIndex){
  const p = level.difficulty;
  return {
    hp: (1 + waveIndex*p.hpGrowth + Math.pow(waveIndex,1.3)*0.015) * (WAVE_EXTRA_HP[waveIndex] || 1),
    speed: Math.min(1 + waveIndex*p.speedGrowth, p.speedCap),
  };
}
