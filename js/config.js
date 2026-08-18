/* ============================================================
   VERİ KATMANI
   Yeni düşman/kule/bölüm eklemek için sadece bu dosya değişir.
   ============================================================ */
const ENEMY_TYPES = {
  spore:    { hp:26, speed:0.85, radius:15, gold:6,  dmgToLives:1, label:'Spor',    shape:'blob',   body:'#ff8f78', body2:'#c94f42', eyes:1 },
  swarm:    { hp:10, speed:1.1,  radius:9,  gold:3,  dmgToLives:1, label:'Sürü',    shape:'blob',   body:'#c9e07a', body2:'#7a9c3a', eyes:1 },
  sprinter: { hp:16, speed:1.6,  radius:12, gold:4,  dmgToLives:1, label:'Koşucu',  shape:'runner', body:'#ffbf6b', body2:'#d98a2e', eyes:2 },
  husk:     { hp:50, speed:0.62, radius:17, gold:9,  dmgToLives:1, label:'Kabuklu', shape:'brute',  body:'#c9b483', body2:'#8a6f42', eyes:2 },
  brute:    { hp:82, speed:0.48, radius:21, gold:13, dmgToLives:2, label:'Ur',      shape:'brute',  body:'#b25bc9', body2:'#6f2f88', eyes:2 },
};

const TOWER_TYPES = {
  archer: { id:'archer', name:'Yosun Okçusu', cost:50,  range:150, rate:0.8,  dmg:9,  splash:0,  kind:'archer', color:'#7fb377', icon:'🏹' },
  mage:   { id:'mage',   name:'Işık Kulesi',  cost:90,  range:185, rate:0.85, dmg:15, splash:0,  kind:'mage',   color:'#4fc3a1', icon:'🔮' },
  mortar: { id:'mortar', name:'Mantar Havanı',cost:130, range:160, rate:1.7,  dmg:18, splash:58, kind:'mortar', color:'#c9793f', icon:'💥' },
  ice:    { id:'ice',    name:'Don Peykesi',  cost:70,  range:140, rate:0.7,  dmg:4,  splash:0,  kind:'ice',    color:'#8fd9f0', icon:'❄️', slowFactor:0.42, slowDuration:1.4 },
};

// Yapı alanları: her segmentin orta noktası etrafında, birbirinden en az
// ~80-140px uzaklıkta yerleştirildi ki kuleler görsel olarak üst üste binmesin.
const LEVELS = [
  {
    id:'orman-girisi', name:'Orman Girişi', waveCount:8,
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
      8:[ {type:'swarm', count:14, interval:0.3}, {type:'sprinter', count:14, interval:0.35}, {type:'husk', count:8, interval:1.0}, {type:'brute', count:7, interval:1.5} ]
    }
  },
  {
    id:'sisli-vadi', name:'Sisli Vadi', waveCount:10,
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
      10:[ {type:'swarm', count:20, interval:0.28}, {type:'sprinter', count:20, interval:0.3}, {type:'spore', count:16, interval:0.4}, {type:'husk', count:12, interval:0.9}, {type:'brute', count:10, interval:1.3} ]
    }
  },
];

// Zorluk formülü: dalga index'inden düşman kompozisyonu üretir.
// 4 kademe: erken sürü -> hızlılar katılır -> zırhlılar katılır -> ağır tehditler.
/* Dalga bazlı düşman sayısı çarpanı:
   1. dalga normal, 2. dalga +%50, 3. dalga +%100, 4+ dalga +%150 */
function waveCountMultiplier(waveIndex){
  if(waveIndex <= 1) return 1.0;
  if(waveIndex === 2) return 1.5;
  if(waveIndex === 3) return 2.0;
  return 2.5;
}

/* Spawn aralıkları: düşman sayısı arttıkça dalganın tek seferde
   üstüne yığılmaması ve oyunun daha uzun sürmesi için araları açılır. */
const SPAWN_GAP = 1.6;   // grup türü aralık çarpanı
const GROUP_GAP = 1.1;   // gruplar arası ek bekleme (saniye)

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
function statMultipliers(level, waveIndex){
  const p = level.difficulty;
  return {
    hp: 1 + waveIndex*p.hpGrowth + Math.pow(waveIndex,1.3)*0.015,
    speed: Math.min(1 + waveIndex*p.speedGrowth, p.speedCap),
  };
}
