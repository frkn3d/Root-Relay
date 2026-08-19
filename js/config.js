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
  brute:    { hp:178, speed:0.48, radius:21, gold:13, dmgToLives:2, label:'Ur',      shape:'brute',  body:'#b25bc9', body2:'#6f2f88', eyes:2 },
  /* KÜP — öldüğünde ikiye bölünür. Çocuklar ebeveynin canının ve
     boyutunun %40'ı kadar olur. splitsLeft tükenene dek bölünmeye
     devam eder. Yolda zikzak çizerek "deli gibi" ilerler. */
  cube:     { hp:130, speed:0.72, radius:26, gold:8,  dmgToLives:1, label:'Küp',     shape:'cube',   body:'#ff9f43', body2:'#b5541a', eyes:2,
              splits:3, splitHpFactor:0.40, splitSizeFactor:0.40, minRadius:7, wobble:26 },
  /* BÜYÜK BOSS — çok yavaş, çok dayanıklı. Etrafında bir don fırtınası
     taşır: auraRadius içindeki kulelerin atış hızını auraSlow oranında
     düşürür (0.5 = %50 yavaş). */
  frostlord:{ hp:2600, speed:0.26, radius:38, gold:120, dmgToLives:5, label:'Don Efendisi', shape:'boss',
              body:'#7fd4ea', body2:'#2d5f80', eyes:2, boss:true, auraRadius:165, auraSlow:0.5 },
};

const TOWER_TYPES = {
  archer: { id:'archer', name:'Yosun Okçusu', cost:50,  range:150, rate:0.8,  dmg:9,  splash:0,  kind:'archer', color:'#7fb377', icon:'🏹' },
  mage:   { id:'mage',   name:'Işık Kulesi',  cost:90,  range:185, rate:0.85, dmg:15, splash:0,  kind:'mage',   color:'#4fc3a1', icon:'🔮' },
  mortar: { id:'mortar', name:'Mantar Havanı',cost:130, range:160, rate:1.7,  dmg:18, splash:58, kind:'mortar', color:'#c9793f', icon:'💥' },
  ice:    { id:'ice',    name:'Don Peykesi',  cost:70,  range:140, rate:0.7,  dmg:0,  splash:0,  kind:'ice',    color:'#8fd9f0', icon:'❄️', slowFactor:0.42, slowDuration:2.8 },
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
      // KÜP DALGASI — bölünen kaotik dalga
      6:[ {type:'cube', count:14, interval:1.5}, {type:'swarm', count:20, interval:0.5} ],
      9:[ {type:'swarm', count:40, interval:0.42}, {type:'sprinter', count:40, interval:0.5}, {type:'husk', count:23, interval:1.35}, {type:'brute', count:21, interval:2.0} ],
      // BOSS DALGASI: tek Don Efendisi + maiyeti
      10:[ {type:'frostlord', count:1, interval:1.0}, {type:'husk', count:10, interval:1.6}, {type:'sprinter', count:16, interval:0.7} ]
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
      // KÜP DALGASI — bölünen kaotik dalga
      7:[ {type:'cube', count:20, interval:1.3}, {type:'swarm', count:26, interval:0.45}, {type:'sprinter', count:14, interval:0.6} ],
      11:[ {type:'swarm', count:44, interval:0.39}, {type:'sprinter', count:44, interval:0.42}, {type:'spore', count:35, interval:0.55}, {type:'husk', count:26, interval:1.25}, {type:'brute', count:22, interval:1.8} ],
      // BOSS DALGASI: iki Don Efendisi + maiyeti
      12:[ {type:'frostlord', count:2, interval:9.0}, {type:'brute', count:12, interval:1.8}, {type:'husk', count:16, interval:1.3}, {type:'sprinter', count:24, interval:0.6} ]
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
function waveCountMultiplier(waveIndex){
  let m;
  if(waveIndex <= 1) m = 1.0;
  else if(waveIndex === 2) m = 1.5;
  else if(waveIndex === 3) m = 2.0;
  else if(waveIndex <= 6) m = 2.5;
  else m = 2.5 * 1.7;
  return m * GLOBAL_COUNT_BOOST * (WAVE_EXTRA_MULT[waveIndex] || 1);
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
