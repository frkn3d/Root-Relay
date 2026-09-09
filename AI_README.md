# AI_README — yapay zekâ asistanları için not defteri

Bu dosya oyuncuya değil, bu depoda çalışan **yapay zekâ asistanlarına** hitap eder.
Amacı iki şey: (1) kodu okuyarak anlaşılmayan, sessizce bozulabilecek kuralları yazmak,
(2) **bilinen eksikleri** kayıt altında tutmak ki her oturumda yeniden keşfedilmesin.

Son güncelleme: 2026-09-09 · Oyun sürümü: `GAME_VERSION` (bkz. `js/changelog.js`)

---

## 1. AÇIK EKSİKLER

### 1.1 🔴 Dördüz'e boşa atış yapınca oyun oyuncuya yalan söylüyor

**Durum: açık.** Kullanıcı kararı bekliyor.

Kapalı (birleşik) Dördüz'e ateş edildiğinde hasar doğru şekilde engelleniyor —
`applyDamage` `'fused'` döndürüyor ([js/engine-update.js](js/engine-update.js)) — ama
geri bildirim yanlış:

| Kanal | Şu an ne oluyor | Ne olmalı |
| :-- | :-- | :-- |
| Ses | `playImpact`'te `'fused'` dalı yok → `playHit()` çalıyor, yani **hasar girmiş gibi** ses | Ayrı bir "geçmedi" sesi (zırh plakasındaki `playArmorHit('shield')` gibi) |
| Hasar yazısı | `'-85'` gibi **gerçek bir hasar sayısı** uçuyor | `BLOKE` benzeri bir yazı (Kalkan Taşıyıcı'da bu doğru yapılmış) |
| Renk | `dmgTextColor` `'fused'` tanımıyor → **normal renk** | Zırhtaki `'shield'` gibi soluk/gri |
| Görsel | `fusedFlash` halkası ✔ | — (tek doğru sinyal bu) |

Dört hasar yolunun (huzme, mermi, patlama, zincir) hepsinde aynı.

Oyunda bunun **doğru yapılmış iki örneği** zaten var, düzeltirken onları örnek al:
zırh plakası (`'shield'` → gri sayı + tok ses) ve Kalkan Taşıyıcı (`BLOKE` yazısı + blok sesi).

### 1.2 Yayına çıkmadan önce

`js/adventure-ui.js` → `ADV_TEST_UNLOCK` şu an `true`. Kilitli bölümlere çift dokunuşla
girmeyi açan **geçici test kilidi**; yayında `false` olmalı. Dosyada "GEÇİCİ" diye
işaretli ama gözden kaçmaya çok müsait.

---

## 2. SES SİSTEMİ

### 2.1 Biçim — istisnasız

Tüm dosyalar `sound/` altında ve **hepsi MP3**:

```
MPEG1 Layer III · 44100 Hz · CBR 160 kbps · MONO
```

Efektler mono, ambiyans/müzik katmanları stereo. Efekt süreleri 0.13–1.23s.
Yeni ses eklerken bu biçimden **sapma**; oyun tek bir kod yolundan yüklüyor.

### 2.2 İki katmanlı çalma — ve sessiz başarısızlık tuzağı

Her `play*()` fonksiyonu önce dosyayı dener, olmazsa sentezlenmiş yedeğine düşer:

```js
if(sfx('balloon_pop', { rate: ... })) return;   // dosya çaldıysa bitti
blip(150, 0.20, 'sine', 0.18, 60);              // yedek: sentez
```

`playSfx` tanımsız anahtarda `return false` verir. **Tuzak burada:** anahtar `SFX`
tablosunda kayıtlı değilse hiçbir hata çıkmaz — ses "çalışır" görünür, ama sentezlenmiş
bip duyulur. Yeni bir `play*` fonksiyonu yazarken `js/sfx.js`'teki `SFX` tablosuna
kaydı eklemeyi unutma.

**Yürüyüş seslerinde tuzak daha sinsi:** yürüyüş zamanlayıcısı
`if(!def || !SFX['walk_'+e.type]) continue;` diyor — yani kaydı olmayan düşman türü
sessizce atlanır ve **hiç ses çıkarmadan** yürür. Yedek sentez bile devreye girmez.
Yeni bir düşman türü eklerken `walk_<tür>` kaydını mutlaka ekle.

### 2.3 Ses düzeyi nasıl hesaplanıyor

```
efektif düzey = SFX[key].v  ×  çağrıdaki opts.vol
```

Yani `SFX.quad_open.v = 0.36` ve `audio.js`'te `sfx('quad_open', {vol:0.5})` →
efektif 0.18. Bir sesi kısmak isterken hangi ucu değiştirdiğine dikkat et: `v` dosyanın
taban düzeyi, `opts.vol` o çağrıya özel bağlam.

Kaba ölçek: sürekli tekrarlayanlar kısık (yanma 0.02, yürüyüşler 0.09–0.20, atışlar
0.18–0.34), tek seferlik olaylar yüksek (koza patlaması 0.42, patron ölümü 0.55).

### 2.4 Önbellek

`js/sfx.js` → `SFX_VER`. Mevcut bir dosyayı **aynı adla yeniden üretirsen** bu sayıyı
bir artır, yoksa tarayıcı eskisini önbellekten servis eder. Yeni dosya eklerken
artırmak gerekmez.

### 2.5 Yeni ses üretme — çalışan boru hattı

Depoda ses üretme aracı yok ve sistemde `ffmpeg` de yok. 2026-09-09'da kullanılan yol:

```
python -m pip install --target <scratch>/pylibs lameenc    # LAME bağlaması, hazır wheel
```

sonra `numpy` + `scipy.signal` ile sentez, `lameenc` ile CBR 160 mono MP3 kodlama.
Kütüphanenin geri kalanıyla aynı teknikler: **FM sentezi, Butterworth filtreleme,
ADSR zarfları** (bkz. `sound/README.md`).

Dikkat edilecek iki nokta:

- **FM oranı tam sayı olsun.** `ratio=1.4` gibi bir oran yan bantları taşıyıcının
  *altına* katlıyor (`f − 1.4f = −0.4f`) ve düşen perde duyulmaz hale geliyor.
  Gaz Balonu'nun gövdesinde tam olarak bu oldu; `ratio=2.0` ile düzeldi.
- **Sesi duyamıyorsan ölç.** Üretilen dalga formunun tasarım iddiasını taşıdığı
  ölçülebilir: vuruşun ilk 25 ms'te olması, perdenin düşmesi/yükselmesi, dört ayrı
  transient'in varlığı, kırpılma/DC ofset/klik olmaması. Tahmin etme, ölç.

---

## 3. SES KÜTÜPHANESİNDE SON DEĞİŞİKLİK (2026-09-09)

v0.5'te eklenen üç düşmanın (Gaz Balonu, Dördüz, Salyalı Böcek) **hiç ses dosyası yoktu**:
olay sesleri sentezlenmiş bipe düşüyordu, yürüyüşleri ise tamamen sessizdi. Altı dosya
üretilip tabloya kaydedildi:

| Dosya | Anahtar | `v` | Süre | Tasarım |
| :-- | :-- | :-- | :-- | :-- |
| `enemy_balloon_pop.mp3` | `balloon_pop` | 0.44 | 0.55s | Zar patlaması + basınç boşalması (190→55 Hz) + kaçan gaz + 45 Hz kesik kesik "kule sustu" cızırtısı |
| `enemy_quad_open.mp3` | `quad_open` | 0.36 | 0.24s | Dört prizmanın 11 ms arayla ayrılması + 660→880 Hz yükselen ton |
| `enemy_beetle_slick.mp3` | `slick_drop` | 0.32 | 0.30s | 250→110 Hz inen ıslak damla + alçak "splat" + sıvı rezonansı |
| `walk_balloon.mp3` | `walk_balloon` | 0.09 | 0.28s | Süzülüyor: sert transient yok, havai akım + zar gıcırtısı |
| `walk_quad.mp3` | `walk_quad` | 0.13 | 0.30s | Ağır taş: kuru sürtünme + pes tok darbe |
| `walk_beetle.mp3` | `walk_beetle` | 0.11 | 0.20s | Kuru kitin bacak tıkırtıları (salya ıslaklığıyla karışmasın diye bilinçli olarak kuru) |

Olay seslerinin tasarımı `js/audio.js`'teki sentezlenmiş yedeklerin **şeklini izler** —
dosya olsa da olmasa da oyuncu aynı olayı duysun diye.

---

## 4. KODA DOKUNURKEN BOZULABİLECEK KURALLAR

- **Tek global kapsam.** Modül yok, klasik `<script>` etiketleri. `index.html`'deki
  yükleme sırası zorunludur; yeni dosya eklerken sırayı bozma.
- **`?v=N` önbellek kırma.** Her `<script>`/`<link>` etiketinde ayrı numara var.
  Dokunduğun dosyanınkini artır, yoksa tarayıcı eski JS/CSS servis eder.
- **RNG çekiliş sayısı kutsal.** Bölümler `makeRng(hashSeed(...))` ile üretiliyor;
  zincirin ortasına bir `rng()` çağrısı eklersen **sonraki her sonuç kayar** (tema,
  dekor, dalga bileşimi). Bölüme/dalgaya özel yeni rastgelelik `rng()`'den değil,
  `hashSeed(anahtar + '#' + levelNo + '#' + waveIndex)`'ten türetilmeli.
- **`waveIndex` 1 tabanlıdır.**
- **Hasar tek kapıdan geçer.** Mermi, huzme, patlama alanı, zincir sıçraması ve
  zehir/yanma tikleri hepsi `applyDamage`'e uğrar. Yeni bir muafiyet/direnç kuralı
  silah başına değil oraya yazılır.
- Kod yorumları Türkçe ve **"neden"i** anlatır, "ne"yi değil. Bu üslubu sürdür.

---

## 5. TESTLER

Regresyon paketleri **bilinçli olarak bu depoda değil** (kullanıcı tercihi); depo
dışında bir çalışma klasöründe duruyorlar ve oyun kökünü `process.argv[2]`'den alırlar.
Node `vm` bağlamında elle yazılmış DOM/canvas/audio saplamalarıyla gerçek oyun
dosyalarını yükleyip çalıştırırlar.

Test yazarken üç tuzak (üçü de bu projede yaşandı):

1. **Sürüm numarasını teste gömme** — değişiklik kaydını sürüme göre *arat*, indekse güvenme.
2. **Geçmişi değil kuralı test et** — "fiyat 740'tır" değil, "fiyat kuruluşun 4.5 katıdır".
3. **Rastgelelik içereni tek örnekle ölçme** — dağılım ölç, tek örnek kendiliğinden kırılır.
