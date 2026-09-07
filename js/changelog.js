/* ============================================================
   SÜRÜM NOTLARI

   Ayarlar > Sürüm Notları ekranının içeriği. Burası bir DEĞİŞİKLİK
   GÜNLÜĞÜ değil, oyuncuya "ne değişti" diyen bir liste: her madde
   oyunda hissedilen bir şeyi anlatır, dosya adı ya da iç mimari
   geçmez. Teknik ayrıntı git geçmişinde duruyor.

   Yeni sürüm eklerken diziye BAŞA ekle — ekran sırayı olduğu gibi
   çiziyor, en yeni sürüm üstte görünsün.
   ============================================================ */
const GAME_VERSION = '0.4.2';

const CHANGELOG = [
  {
    version: '0.4.2',
    title: 'Zırhlı dengesi',
    note: 'Erken bölümlerde zırhlı düşman aşılmaz bir duvara dönüşüyordu.',
    groups: [
      { head: '🛡️ Zırhlı', items: [
        "Zırhlının plakası <b>ilk 50 bölümde yarım kapasiteyle</b> geliyor. Plaka 220 birime çıkarıldığında zırhlı yalnızca geç bölümlerde sahneye çıkıyordu; keşif kolu onu 23. bölümden itibaren sahaya sokunca o plakayı sökecek hasar henüz olmadığı için zırhlı pratikte ölmüyor, savunmanın önünde durup arkasından geleni geçiriyordu.",
        'Sızdırma oranına dokunulmadı: yarım plakada da "plaka parçalandı" aşaması korunuyor, hatta gövdeye daha çok ömür kalıyor.',
      ]},
    ],
  },
  {
    version: '0.4.1',
    title: 'Değişken kadro',
    note: 'Her bölümün kendi kule kadrosu var; dünya haritasının tepesi düzeltildi.',
    groups: [
      { head: '⚖️ Bölüme özel kule kadrosu', items: [
        'Bir kuleden bölüm başına en fazla kaç tane alabileceğin artık <b>bölümden bölüme değişiyor</b>: her bölümde bir türün kotası 1 artıyor, başka bir türünki 1 azalıyor.',
        "Toplam kota hep 24 kalıyor — bölümün savunma kapasitesi değişmiyor, yalnızca <b>şekli</b> değişiyor. Zehir Sarmaşığı 3'e çıktığı bölümde Lazer 2'ye düşebilir; o bölümü zehir ağırlıklı kurmak gerekir.",
        'Değişen iki kule, kule kartının köşesinde <b>▲</b> / <b>▼</b> rozetiyle işaretleniyor; duraklatma ekranındaki bölüm bilgisinde de yazıyor.',
        'Kadro <b>bölüm numarasına</b> bağlı, oturuma değil: aynı bölüm her açılışta aynı kadroyu verir ve her oyuncuda aynıdır. 42 bölümde bütün artan-azalan çiftleri bir kez görülüp döngü başa dönüyor.',
      ]},
      { head: '🗺️ Düzeltmeler', items: [
        'Dünya haritasının en üstündeki bölgenin (Kül Dağları) tabelası ekranın dışında kalıyordu — haritanın tepesine boşluk eklendi, artık adı görünüyor.',
      ]},
    ],
  },
  {
    version: '0.4',
    title: 'Macera, ekonomi ve cila',
    note: 'Oyunun bugüne kadarki tüm gelişimi. Sürüm notları bu ekranla başlıyor.',
    groups: [
      { head: '🧭 Macera', items: [
        'Ana menüdeki "Bölüm Seç" kaldırıldı, yerine <b>Maceraya Başla</b> geldi: 1000 bölümü yedi bölgeye ayıran, izometrik ve elle çizilmiş bir dünya haritası.',
        'Her bölgenin kendi biyomu, mevsimi ve ilerleme patikası var. Bölgeye girince bölümler aşağıdan yukarıya kıvrılan bir yolda diziliyor.',
        'Bölgeler <b>elmasla açılabiliyor</b> — 200 / 400 / 800 / 1600 / 3200 / 6400 💎. Satın almak oyunu atlamaz, yalnızca o bölgenin ilk bölümünü açar.',
        'Her 20 bölümde bir patron bölümü işaretleniyor. Patron dövüşü henüz tasarlanmadı; şimdilik yolu tıkamıyor.',
        '1000 Bölüm menüsü duruyor — iki menü aynı ilerlemeyi paylaşıyor.',
      ]},
      { head: '⚔️ Denge', items: [
        'Yükseltme fiyatları tek bir kurala bağlandı: her yükseltme kurulum fiyatının sabit bir katı (<b>2× / 4.5× / 10×</b>, okçu 2× / 3× / 4×). Üç ayrı zam tablosu kaldırıldı.',
        'Yükseltme süreleri uzadı: kurulum 4 sn, sonra <b>8 / 13 / 18 sn</b>. Kule o süre boyunca ateş etmiyor, yani büyütmeyi ne zaman yaptığın önemli.',
        'Kurulum ücretleri düştü: Şimşek 155→100, Lazer 80→75, Ateş 115→95.',
        'Lazer\'in kurulum menzili %15, Ateş\'in %20 büyüdü.',
        'Zırhlı düşmanın hızı %30 azaldı — asıl tehlikesi kendisi değil, kuleleri üzerine kilitlerken yanından geçenler.',
        'Haritanın büyüklüğü artık dalga baskısını belirliyor: bol kule alanı olan bölümlerde düşmanlar daha dayanıklı ve kalabalık geliyor. Amaç zorluğun haritanın çekilişine değil kuleyi nereye koyduğuna bağlı olması.',
        'Erken bölümlerin son iki dalgasına <b>keşif kolu</b> eklendi: 11. bölümden itibaren havuzda olmayan türlerden birkaç tane geliyor, ileride ne olacağını gösteriyor.',
      ]},
      { head: '🎯 Kuleler', items: [
        'Yeni atış önceliği: <b>Kaçak</b> — çıkışa kalan mesafesi en kısa olan düşmanı vurur. Yolun ikiye ayrıldığı bölümlerde "Öncü"den farklı bir hedef seçiyor.',
        '"Öncü"nün açıklaması düzeltildi: aslında yolda en çok mesafe katetmiş olanı vuruyor, çıkışa en yakını değil.',
        'Mermiler kule merkezinden değil <b>namlu ucundan</b> çıkıyor.',
        'Kule satışı, o tür için bölüm içi satın alma hakkını geri veriyor.',
        'Don Peykesi geçici olarak kapatılabiliyor — ateşle donun birbirini söndürdüğü yerlerde işe yarıyor.',
      ]},
      { head: '👾 Düşmanlar', items: [
        'Düşmanlar bölük hâlinde yürümüyor: her birim kendi doğuş gecikmesi, kendi yürüyüş temposu ve kendi adım sesiyle geliyor. Kolon değil kalabalık görüyorsun.',
        'Canı %20\'nin altına inen düşman <b>%30 yavaşlıyor</b> ve can çubuğu kırmızıya dönüyor.',
        'Bölünen küp yavruları her küçülmede belirgin şekilde hızlanıyor.',
        'Boss dalgasında tek Don Efendisi değil, aralıklarla <b>beş tane</b> geliyor.',
        'Şişe birikintisi güçlendi (saniyede 28 can, 65 sn) ve şişeler 1x/2x/3x canla geliyor — irisi gözle görülüyor.',
      ]},
      { head: '💎 Ekonomi', items: [
        'Bölüm sonunda kazanılan elmas artık <b>kendi kutusunda</b> yazıyor: kaç elmas aldığın, almadıysan neden almadığın ve o bölümden kaç elmas daha alınabileceği.',
        'Ana menüye İstatistikler ekranı ve günlük elmas ödülü eklendi.',
        'Bölüm içi market: altın, can ve inşa hızı takviyesi (yalnızca o bölüm için).',
      ]},
      { head: '✨ Görsel ve ses', items: [
        'Ölen düşmandan <b>sikke saçılıyor</b>: havaya sıçrayıp yere düşüyor, birkaç saniye yerde durup soluyor.',
        'Bölüm sonu düğmeleri gerçek gövde kazandı; sıradaki adım (kazanınca "Sonraki Bölüm", kaybedince "Tekrar Dene") altın renkte öne çıkıyor.',
        'Hızlı atışlarda aynı ses üst üste yığılmasın diye <b>perde savrulması</b> eklendi — 4× hızda lazer sesi artık rahatsız etmiyor.',
        'Atış ve vuruş sesleri hedefin uzaklığına göre zayıflıyor.',
        'Biyoma göre değişen ambiyans ve menü müziği.',
      ]},
      { head: '⚡ Performans ve düzeltmeler', items: [
        'Statik sahne katmanı önbelleğe alındı, gölge bulanıklığı %85 azaldı, kalabalıkta parçacık bütçesi kendiliğinden kısılıyor.',
        'Macera haritasında dikey kaydırma çalışmıyordu — düzeltildi. Kaydırırken kazara bölüm başlatma da engellendi.',
        'Duraklatılmışken kule dikilebiliyor; inşaat süresi duraklıyken ilerlemiyor.',
        'Nasıl Oynanır bölümündeki bütün sayılar kodla karşılaştırıldı; eskimiş iki madde düzeltildi.',
      ]},
    ],
  },
];
