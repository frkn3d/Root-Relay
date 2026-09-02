/* ============================================================
   RENDER / ÇEKİRDEK — bütün çizim dosyalarının paylaştığı
   küçük yardımcılar. Kendi başına hiçbir şey çizmez.
   ============================================================ */
const TOWER_VISUAL_SCALE = 0.78; // kulelerin görsel boyutu (menzil/mantık etkilenmez)

/* Yükseltme her seviyede kuleyi %10 büyütür — oyuncu bakışta
   hangi kulenin geliştiğini anlayabilsin diye. */
function towerLevelScale(t){
  return Math.pow(1.10, (t.level||0));
}

/* Seviye arttıkça renkleri kademeli olarak daha parlak/doygun yapar.
   HSL üzerinden çalışır; hex girdiyi çevirir. */
function brightenColor(hex, level){
  if(!level) return hex;
  const m = hex.replace('#','');
  const r = parseInt(m.substring(0,2),16)/255;
  const g = parseInt(m.substring(2,4),16)/255;
  const b = parseInt(m.substring(4,6),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  const d=max-min;
  if(d!==0){
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) h=((g-b)/d + (g<b?6:0))/6;
    else if(max===g) h=((b-r)/d + 2)/6;
    else h=((r-g)/d + 4)/6;
  }
  const H = h*360;
  const S = Math.min(100, s*100 + level*11);
  const L = Math.min(78, l*100 + level*7);
  return `hsl(${H.toFixed(0)}, ${S.toFixed(0)}%, ${L.toFixed(0)}%)`;
}

function roundedRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
