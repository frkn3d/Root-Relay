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

/* ---- Elmasla bölge satın alma -----------------------------------

   Zincir tek yönlü bir yolculuk: 121. bölüm için 120'yi geçmen
   gerekiyor. Bu, oyuncuyu bir temaya hapsedebiliyor — ormandan
   sıkıldıysa çöle geçmek için 120 orman bölümü oynaman gerekiyordu.

   Elmas o kapıyı açıyor. Bir bölgeyi satın almak zinciri BOZMAZ,
   yalnızca o bölgenin ilk bölümünü açar; bölge içi ilerleme aynen
   sırayla işler. Yani satın alma "oyunu atlamak" değil, "nereden
   devam edeceğini seçmek".

   Fiyat her bölgede ikiye katlanıyor: 200 / 400 / 800 / 1600 /
   3200 / 6400. Yıldız başına 5 elmas kazanıldığı için 200 elmas
   ~14 bölümlük üç yıldızlı oyun demek; ilk birkaç bölge gerçekten
   satın alınabilir, sonrakiler zaten oynayarak açılıyor olacak. */
const REGION_PRICE_BASE = 200;

/* Bölgenin sırası (0 = ilk bölge, bedava) */
function advRegionPrice(r){
  const i = regionIndexOf(r.from);
  if(i <= 0) return 0;
  return REGION_PRICE_BASE * Math.pow(2, i-1);
}

function advBoughtRegions(){
  const o = advLoad();
  return Array.isArray(o.bought) ? o.bought : [];
}
function advIsRegionBought(r){ return advBoughtRegions().indexOf(r.id) >= 0; }

/* Satın alma. Elmas yetmiyorsa ya da bölge zaten açıksa false döner —
   çağıran taraf sebebi ayrıca sorabilsin diye elmas DÜŞÜLMEDEN önce
   her koşul kontrol ediliyor. */
function advBuyRegion(id){
  const r = regionById(id);
  if(!r) return false;
  if(advIsRegionUnlocked(r)) return false;      // zaten açık
  const price = advRegionPrice(r);
  if(price <= 0) return false;
  if(getGems() < price) return false;           // parası yetmiyor
  addGems(-price);                              // progress.js
  const o = advLoad();
  o.bought = advBoughtRegions().concat([id]);
  advSave(o);
  if(typeof invalidateWorldBake === 'function') invalidateWorldBake();
  return true;
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
  const r = regionOf(n);
  // 'open' modunda her bölgenin ilk bölümü baştan açık
  if(ADV_UNLOCK_MODE === 'open' && n === r.from) return true;
  /* Elmasla satın alınan bölgenin ilk bölümü açıktır; gerisi yine
     sırayla. Burada advIsRegionBought çağrılıyor, advIsRegionUnlocked
     DEĞİL — o ikisi birbirini çağırıp sonsuz döngüye girerdi. */
  if(n === r.from && advIsRegionBought(r)) return true;
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

/* Bölge iki yoldan açılır: zincirle (önceki bölümü geçerek) ya da
   elmasla satın alınarak. İkisi de aynı kapıyı açar. */
function advIsRegionUnlocked(r){
  return advIsUnlocked(r.from) || advIsRegionBought(r);
}

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
