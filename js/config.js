/* ============================================================
   VERİ KATMANI
   Yeni düşman/kule/bölüm eklemek için sadece bu dosya değişir.
   ============================================================ */
const ENEMY_TYPES = {
  spore:    { hp:26, speed:0.85, radius:15, gold:6,  dmgToLives:1, label:'Spor',   shape:'blob',   body:'#ff8f78', body2:'#c94f42', eyes:1 },
  sprinter: { hp:16, speed:1.6,  radius:12, gold:4,  dmgToLives:1, label:'Koşucu', shape:'runner', body:'#ffbf6b', body2:'#d98a2e', eyes:2 },
  brute:    { hp:82, speed:0.48, radius:21, gold:13, dmgToLives:2, label:'Ur',     shape:'brute',  body:'#b25bc9', body2:'#6f2f88', eyes:2 },
};

const TOWER_TYPES = {
  archer: { id:'archer', name:'Yosun Okçusu', cost:50,  range:150, rate:0.8,  dmg:9,  splash:0,  kind:'archer', color:'#7fb377', icon:'🏹' },
  mage:   { id:'mage',   name:'Işık Kulesi',  cost:90,  range:185, rate:0.85, dmg:15, splash:0,  kind:'mage',   color:'#4fc3a1', icon:'🔮' },
  mortar: { id:'mortar', name:'Mantar Havanı',cost:130, range:160, rate:1.7,  dmg:18, splash:58, kind:'mortar', color:'#c9793f', icon:'💥' },
};

const LEVELS = [
  {
    id:'orman-girisi', name:'Orman Girişi', waveCount:8,
    startGold:170, startLives:10,
    path:[
      {x:-20,y:120},{x:460,y:120},{x:460,y:300},{x:140,y:300},{x:140,y:480},
      {x:460,y:480},{x:460,y:660},{x:140,y:660},{x:140,y:840},{x:460,y:840},{x:460,y:1000},
    ],
    spots:[
      {x:250,y:60},{x:250,y:195},{x:545,y:210},{x:300,y:225},{x:300,y:375},
      {x:55,y:390},{x:300,y:410},{x:300,y:550},{x:545,y:570},{x:300,y:590},
      {x:300,y:730},{x:55,y:750},{x:300,y:775},{x:300,y:915},
    ],
    difficulty:{ hpGrowth:0.16, speedGrowth:0.025, speedCap:1.5, countBase:6, countGrowth:1.6 },
    waveOverrides:{ 8:[ {type:'brute', count:4, interval:1.1}, {type:'sprinter', count:6, interval:0.25} ] }
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
      {x:460,y:35},{x:180,y:35},{x:180,y:165},{x:465,y:170},{x:460,y:315},
      {x:80,y:325},{x:340,y:400},{x:340,y:490},{x:60,y:560},{x:340,y:630},
      {x:340,y:790},{x:465,y:800},{x:170,y:940},{x:420,y:940},
    ],
    difficulty:{ hpGrowth:0.21, speedGrowth:0.03, speedCap:1.65, countBase:7, countGrowth:1.9 },
    waveOverrides:{ 10:[ {type:'brute', count:6, interval:0.9}, {type:'sprinter', count:10, interval:0.2}, {type:'spore', count:8, interval:0.3} ] }
  },
];

function generateWave(level, waveIndex){
  if(level.waveOverrides && level.waveOverrides[waveIndex]) return level.waveOverrides[waveIndex];
  const p = level.difficulty;
  const count = p.countBase + Math.floor(waveIndex * p.countGrowth);
  const groups = [];
  if(waveIndex < 3){
    groups.push({type:'spore', count, interval:0.55});
  } else if(waveIndex < 6){
    groups.push({type:'spore', count:Math.ceil(count*0.7), interval:0.5});
    groups.push({type:'sprinter', count:Math.ceil(count*0.4), interval:0.3});
  } else {
    groups.push({type:'spore', count:Math.ceil(count*0.6), interval:0.45});
    groups.push({type:'sprinter', count:Math.ceil(count*0.4), interval:0.28});
    groups.push({type:'brute', count:Math.max(1,Math.floor(waveIndex/3)), interval:1.0});
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
