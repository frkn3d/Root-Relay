/* ============================================================
   MACERA — 1000 bölümün üstüne oturan ilerleme katmanı

   Eskiden ana menüde iki ayrı giriş vardı: elle yazılmış iki bölümü
   listeleyen "Bölüm Seç" ve numara girip doğrudan oynatan
   "1000 Bölüm". İkincisi bir ARAÇ (istediğin bölüme atla), birincisi
   ise sadece iki bölümlük bir çıkmazdı. Ortada oyuncuyu baştan sona
   taşıyan bir yolculuk yoktu.

   "Maceraya Başla" o yolculuk. Aynı 1000 bölümü kullanır — yeni bölüm
   üretmez, üzerlerine bir GEZİNME ve KİLİT katmanı koyar:

     Dünya Haritası  ->  Bölge (ilerleme yolu)  ->  Bölüm

   1000 Bölüm menüsü olduğu gibi duruyor: orası hâlâ "347'yi aç" diyen
   araç. Macera ise sıradan ilerleyen, kilitli ve ödüllü olan yol.

   İLERLEME NEREDE TUTULUYOR: hiçbir yerde — yeni bir kayıt açmadık.
   Kilitler zaten var olan yıldız kaydından (progress.js) türetiliyor.
   Bir bölüm "geçilmiş" sayılır ancak ve ancak en az 1 yıldızı varsa.
   Böylece oyuncunun 1000 Bölüm menüsünden oynadığı bölümler de
   macerada geçilmiş görünür; iki menü aynı ilerlemeyi paylaşır.
   ============================================================ */

/* Macerada en son nerede kalındığı — yalnızca haritayı doğru yere
   açmak için. Kaybolursa oyun ilerlemeyi yine yıldızlardan bulur. */
const ADV_KEY = 'rr_adventure_v1';

function advLoad(){
  try{
    const raw = localStorage.getItem(ADV_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function advSave(o){
  try{ localStorage.setItem(ADV_KEY, JSON.stringify(o)); }catch(e){}
}
/* Oyuncunun son açtığı bölge (dünya haritası oraya odaklansın diye) */
function advLastRegion(){
  const o = advLoad();
  return (typeof o.region === 'string') ? o.region : null;
}
function advSetLastRegion(id){
  const o = advLoad(); o.region = id; advSave(o);
}

/* ---- Bölüm durumu ---------------------------------------------- */

/* Üretilmiş bölümün progress.js'teki anahtarı (bkz. generateLevel) */
function advLevelId(n){ return 'gen-' + WORLD_SEED + '-' + n; }

function advStars(n){ return getLevelProgress(advLevelId(n)).bestStars || 0; }
function advIsDone(n){ return advStars(n) > 0; }

/* BÖLGELER NASIL AÇILIR — iki mod

   'chain'  (varsayılan): tek bir zincir. 121. bölüm ancak 120 geçilince
            açılır, dolayısıyla Kavak Kıyısı da o zaman açılır. Klasik
            ilerleme; oyuncu yolculuğu baştan sona sırayla yaşar.

   'open'   : her bölgenin İLK bölümü baştan açıktır, bölge içi zincir
            aynen işler. Oyuncu gerçekten "tema seçerek" başlar; çölden
            de bataklıktan da girebilir. Bölgeler zorluk sırasına göre
            dizili olduğu için 7. bölgeden başlayan biri duvara toslar —
            bu modda bölge kartlarındaki zorluk göstergesi önem kazanır.

   İkisi de destekleniyor; değiştirmek için tek satır. */
const ADV_UNLOCK_MODE = 'chain';

function advIsUnlocked(n){
  if(n < 1 || n > GEN.TOTAL_LEVELS) return false;
  if(n === 1) return true;
  // 'open' modunda her bölgenin ilk bölümü baştan açık
  if(ADV_UNLOCK_MODE === 'open' && n === regionOf(n).from) return true;
  if(advIsDone(n-1)) return true;
  /* Patron bölümleri ilerlemeyi TIKAMAZ. Patron dövüşü henüz
     tasarlanmadı ve tasarlandığında da yolculuğu durduran bir duvar
     değil, isteğe bağlı bir meydan okuma olacak — atlayan oyuncu
     yoluna devam edebilmeli. */
  if(isBossLevel(n-1)) return (n-2 < 1) || advIsDone(n-2);
  return false;
}

/* Bölümün macera içindeki durumu — arayüzün tek bakacağı yer. */
function advLevelState(n){
  if(!advIsUnlocked(n)) return 'locked';
  if(advIsDone(n)) return 'done';
  return 'open';
}

/* ---- Bölge durumu ---------------------------------------------- */

/* Bölge, ilk bölümü açıldığında açılır. Bölümler tek bir zincir
   olduğu için ayrı bir bölge kilidi kuralına gerek yok: 121. bölüm
   açıldıysa Kavak Kıyısı da açılmıştır. */
function advIsRegionUnlocked(r){ return advIsUnlocked(r.from); }

/* Bir bölgenin özeti: kaç bölüm geçildi, kaç yıldız toplandı,
   sıradaki oynanacak bölüm hangisi. */
function advRegionStats(r){
  const total = regionLevelCount(r);
  let done = 0, stars = 0, next = null, bossTotal = 0, bossDone = 0;
  for(let n = r.from; n <= r.to; n++){
    const s = advStars(n);
    if(isBossLevel(n)){ bossTotal++; if(s > 0) bossDone++; }
    if(s > 0){ done++; stars += s; }
    else if(next === null && advIsUnlocked(n)) next = n;
  }
  // Hepsi bitmişse "sıradaki" olarak son bölümü göster (tekrar oynanabilir)
  if(next === null) next = advIsRegionUnlocked(r) ? r.to : r.from;
  return {
    total, done, stars, maxStars: total*3, next,
    bossTotal, bossDone,
    unlocked: advIsRegionUnlocked(r),
    complete: done >= total,
    pct: total ? done/total : 0,
  };
}

/* Oyuncunun genel olarak geldiği yer: açık olan en yüksek bölüm.
   Dünya haritası açılışta bu bölgeye odaklanır. */
function advFrontierLevel(){
  let n = 1;
  for(let i = 1; i <= GEN.TOTAL_LEVELS; i++){
    if(advIsUnlocked(i)) n = i; else break;
  }
  return n;
}
function advFrontierRegion(){
  const last = advLastRegion();
  if(last){
    const r = regionById(last);
    if(r && advIsRegionUnlocked(r)) return r;
  }
  return regionOf(advFrontierLevel());
}

/* Tüm maceranın özeti (dünya haritası başlığı için) */
function advTotals(){
  let done = 0, stars = 0;
  for(let i = 1; i <= GEN.TOTAL_LEVELS; i++){
    const s = advStars(i);
    if(s > 0){ done++; stars += s; }
  }
  return { done, total: GEN.TOTAL_LEVELS, stars, maxStars: GEN.TOTAL_LEVELS*3 };
}

/* ---- Bölüme giriş ---------------------------------------------- */

/* Macera akışından bir bölümü başlatır. 1000 Bölüm menüsündeki
   startGeneratedLevel ile aynı yolu kullanır — macera ayrı bir oyun
   modu değil, aynı bölümlere açılan başka bir kapı. */
/* Oyuncu bu bölüme Macera akışından mı girdi? Bölüm bitince nereye
   döneceğini bu belirliyor (bkz. goToMainMenu, engine-flow.js).
   1000 Bölüm menüsünden girilen bölüm bayrağı düşürüyor. */
let advInSession = false;
function advClearSession(){ advInSession = false; }

/* force=true yalnızca TEST kilidi içindir (bkz. adventure-ui.js,
   "GEÇİCİ TEST KİLİDİ"). Normal akışta hiçbir yerden true gelmez. */
function advPlay(n, force){
  if(!force && !advIsUnlocked(n)) return false;
  if(n < 1 || n > GEN.TOTAL_LEVELS) return false;
  advInSession = true;
  advSetLastRegion(regionOf(n).id);
  startGeneratedLevel(WORLD_SEED, n);   // engine-flow.js
  return true;
}
