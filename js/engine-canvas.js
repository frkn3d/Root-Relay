/* ============================================================
   MOTOR / TUVAL — canvas kurulumu (DPR ölçeği) ve tema değiştikçe
   bir kez pişirilip önbelleğe alınan arka plan dokusu.
   En önce yüklenmeli: LW/LH ve ctx buradan gelir.
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const LW = 600, LH = 1000;
let dpr = 1;

function setupCanvasDPR(){
  dpr = Math.max(1, Math.min(window.devicePixelRatio||1, 2.5));
  canvas.width = LW*dpr; canvas.height = LH*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
setupCanvasDPR();
window.addEventListener('resize', setupCanvasDPR);
window.addEventListener('orientationchange', ()=>setTimeout(setupCanvasDPR,200));

/* ---- Arka plan dokusu ----
   Tema (mevsim + bitki örtüsü) değiştiğinde yeniden pişirilir.
   Her karede yeniden çizmek pahalı olurdu; bir kez üretilip
   önbelleğe alınır. */
const bgCanvas = document.createElement('canvas');
bgCanvas.width = LW; bgCanvas.height = LH;
let bakedThemeKey = null;

function bakeBackground(theme){
  const bctx = bgCanvas.getContext('2d');
  // Varsayılan (klasik bölümler): orman/ilkbahar
  let c1='#2f5233', c2='#213b26', decor='tree', density=1.0, tint=null;

  if(theme && typeof BIOMES!=='undefined' && BIOMES[theme.biome]){
    const b = BIOMES[theme.biome];
    const pair = (b.base[theme.season] || b.base.spring);
    c1 = pair[0]; c2 = pair[1];
    decor = b.decor; density = b.decorDensity;
    tint = (SEASONS[theme.season]||{}).tint;
  }

  const g = bctx.createLinearGradient(0,0,0,LH);
  g.addColorStop(0,c1); g.addColorStop(1,c2);
  bctx.fillStyle = g; bctx.fillRect(0,0,LW,LH);

  // Yumuşak leke katmanı (derinlik hissi)
  for(let i=0;i<160;i++){
    const x=Math.random()*LW, y=Math.random()*LH, r=14+Math.random()*40;
    bctx.beginPath(); bctx.arc(x,y,r,0,Math.PI*2);
    bctx.fillStyle = Math.random()>0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    bctx.fill();
  }

  // Bitki örtüsüne özgü dekor
  const n = Math.round(70*density);
  for(let i=0;i<n;i++){
    const x=Math.random()*LW, y=Math.random()*LH;
    if(decor==='tree'){
      bctx.beginPath(); bctx.ellipse(x,y,3,7,Math.random()*Math.PI,0,Math.PI*2);
      bctx.fillStyle='rgba(20,50,25,0.35)'; bctx.fill();
    } else if(decor==='rock'){
      bctx.beginPath(); bctx.ellipse(x,y,4+Math.random()*4,3+Math.random()*2,0,0,Math.PI*2);
      bctx.fillStyle='rgba(0,0,0,0.18)'; bctx.fill();
    } else if(decor==='bush'){
      bctx.beginPath(); bctx.arc(x,y,3+Math.random()*3,0,Math.PI*2);
      bctx.fillStyle='rgba(30,60,25,0.30)'; bctx.fill();
    } else if(decor==='reed'){
      bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x+ (Math.random()-0.5)*4, y-8-Math.random()*6);
      bctx.strokeStyle='rgba(25,55,35,0.35)'; bctx.lineWidth=1.4; bctx.stroke();
    } else { // grass
      bctx.beginPath(); bctx.moveTo(x,y); bctx.lineTo(x+1.5, y-5);
      bctx.strokeStyle='rgba(80,80,30,0.25)'; bctx.lineWidth=1.2; bctx.stroke();
    }
  }

  // Serpiştirilmiş taşlar
  for(let i=0;i<10;i++){
    const x=Math.random()*LW, y=Math.random()*LH, r=5+Math.random()*6;
    bctx.beginPath(); bctx.ellipse(x,y,r,r*0.6,0,0,Math.PI*2);
    bctx.fillStyle='rgba(140,140,120,0.5)'; bctx.fill();
    bctx.strokeStyle='rgba(0,0,0,0.3)'; bctx.lineWidth=1; bctx.stroke();
  }

  // Mevsim rengi ince bir katman olarak üstüne biner
  if(tint){
    bctx.save();
    bctx.globalAlpha = theme.season==='winter' ? 0.34 : 0.07;
    bctx.fillStyle = tint;
    bctx.fillRect(0,0,LW,LH);
    bctx.restore();
  }

  // Kışın belirgin kar örtüsü: beyaz yamalar + serpme kar
  if(theme && theme.season==='winter'){
    // Zemine oturmuş kar yamaları
    for(let i=0;i<70;i++){
      const x=Math.random()*LW, y=Math.random()*LH;
      const r=18+Math.random()*46;
      bctx.beginPath(); bctx.ellipse(x,y,r,r*0.55,Math.random()*Math.PI,0,Math.PI*2);
      bctx.fillStyle='rgba(255,255,255,0.16)'; bctx.fill();
    }
    // İnce serpme kar
    for(let i=0;i<260;i++){
      const x=Math.random()*LW, y=Math.random()*LH;
      bctx.beginPath(); bctx.arc(x,y,1+Math.random()*1.8,0,Math.PI*2);
      bctx.fillStyle='rgba(255,255,255,0.4)'; bctx.fill();
    }
  }
}

/* Tema değiştiyse arka planı yeniden üret */
function ensureBackground(){
  const key = level && level.theme
    ? (level.theme.season+'|'+level.theme.biome)
    : 'default';
  if(key === bakedThemeKey) return;
  bakedThemeKey = key;
  bakeBackground(level ? level.theme : null);
}
