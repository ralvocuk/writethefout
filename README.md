# writetheFout.

Senaryo yazım stüdyosu. Windows masaüstü uygulaması.

Her senaryo bilgisayarında bağımsız bir **`.fountain` dosyasıdır**: Beat, Highland, Slugline ve diğer Fountain
uyumlu programlarda olduğu gibi açılır. Sahne renkleri, durumlar, hikâye günleri, karakter profilleri, notlar,
etiketler, revizyon işaretleri ve sahne kimlikleri dosyanın sonundaki bir yorum bloğunda saklanır; diğer programlar
bu bloğu görmezden gelir. Uygulamanın kendi veritabanında yalnızca son açılanlar, anlık görüntüler ve günlük
sayaç tutulur.

**Sürüm 0.5**

## Kurulum dosyasını üretmek

`KUR-VE-DERLE.bat` dosyasına çift tıkla. Eksik araçları (Node.js, Rust, Visual Studio C++ araçları) kurar,
derler ve klasöre `writetheFout-Kurulum.exe` koyar. Araçlar kuruluysa yalnızca derler (5–10 dk).
Bu yolla derlenen kopya kendini güncellemez.

## Sürüm yayınlamak ve otomatik güncelleme

`YAYINLA.bat` dosyasına çift tıkla. İlk seferde:

1. Git ve GitHub CLI yoksa kurar, tarayıcıda GitHub girişini açar.
2. `imza\writethefout.key` imza anahtarını üretir, genel anahtarı `tauri.conf.json` içine yazar.
   **`imza` klasörünü yedekle**: kaybolursa kurulu kopyalar yeni sürümleri kabul etmez.
3. Hesabında herkese açık `writethefout` deposunu açar, anahtarı depoya gizli değişken olarak ekler.

Her seferinde sürüm numarasını sorar (Enter: bir artır), Not Defteri'nde sürüm notlarını yazdırır, kodu ve
`v0.5.1` gibi bir etiketi gönderir. GitHub (Actions) kurulumu derler, imzalar ve **Releases** sayfasına
koyar (15–25 dk). Kurulu uygulama açılışta yeni sürümü bulur; üst çubukta "0.5.1 hazır" çıkar, tek tıkla
indirip kurar ve yeniden açılır. Elle denetlemek için: Yardım › Güncellemeleri denetle.

İlk yayından sonra kurulumu bir kez Releases sayfasından indirip kur; ondan sonrası kendiliğinden gelir.

## Dosyalar

| İş | Kısayol |
| --- | --- |
| Yeni senaryo / yeni pencere | `Ctrl+N` / `Ctrl+Shift+N` |
| Aç / Son açılanlar | `Ctrl+O` / Dosya menüsü |
| Kaydet / Farklı kaydet | `Ctrl+S` / `Ctrl+Shift+S` |
| Baskı önizleme ve yazdır | `Ctrl+P` |
| Dışa aktar (PDF, Fountain, Final Draft) | `Ctrl+E` |

- **Güvenli kayıt:** önce geçici dosyaya yazılır, sonra asıl dosyanın yerine taşınır; kayıt yarıda kesilse bile dosya bozulmaz.
- **Otomatik kaydetme** (varsayılan açık): değişiklikten birkaç saniye sonra dosyaya yazar. Komut paletinden kapatılabilir.
- **Dış değişiklik algılama:** dosya başka bir programda değiştirildiyse üzerine yazmadan önce sorar.
- **Kapatırken uyarı:** kaydedilmemiş değişiklik varsa Kaydet / Kaydetme / Vazgeç sorulur.
- **Çökme kurtarma:** kaydedilmemiş çalışma sürekli saklanır; uygulama beklenmedik kapanırsa açılışta geri yüklenebilir.
- **Dosya ilişkilendirme:** `.fountain` dosyalarına çift tıklayınca writetheFout. ile açılır.
- **Menü çubuğu:** Dosya, Düzen, Görünüm, Senaryo, Revizyon, Yardım (`F1` tüm kısayollar).

## Yazarken

- **Otomatik biçim:** `Tab` / `Enter` ile sahne başlığı → aksiyon → karakter → diyalog akışı (Final Draft mantığı).
  `İÇ.` / `DIŞ.` / `INT.` yazınca sahne başlığı olur; boş diyalogda `(` parantez açar.
- **Ek elemanlar:** `Ctrl+7` ortalı metin (`>METİN<`), `Ctrl+8` şarkı sözü (`~`), `Ctrl+9` bölüm (`# Perde`, basılmaz),
  `Ctrl+Enter` zorunlu sayfa sonu (`===`).
- **Çift diyalog:** ikinci karakter satırında `Ctrl+D`.
- **Notlar ve kapalı metin:** `Ctrl+Shift+M` → `[[not]]` (sarı, basılmaz), `Ctrl+/` → `/* kapalı */` (üstü çizili, basılmaz).
- **Otomatik tamamlama:** karakter adları, mekanlar, GÜNDÜZ/GECE — `Enter` veya `→` ile kabul.
- **Canlı sayfalama:** sayfa sonları, sayfa numaraları ve iki yanda sahne numaraları yazarken görünür.
- **Sahne numarası kilidi:** kilitledikten sonra araya eklenen sahneler 12A, 12B… olur.
- **Revizyon modu** (`Ctrl+Shift+R`): 8 Hollywood rengi (Mavi, Pembe, Sarı…). Açıkken yeni yazılan metin
  işaretlenir, silinen eski metin üstü çizili "silinmeye aday" kalır. PDF ve önizlemede değişen satırlara `*`,
  üst bilgiye revizyon adı ve tarihi basılır; istenirse yalnızca değişen sayfalar basılır. Final Draft'a
  revizyon kümeleriyle aktarılır. "Revizyonları onayla" silinmeye aday metni siler ve işaretleri temizler;
  "Tüm işaretleri seçili kuşağa taşı" kuşakları birleştirir.
- **Bul ve değiştir:** `Ctrl+F` — Türkçe harfleri doğru eşler (İ/i, I/ı).
- **Prodüksiyon etiketleri:** metni seç, `Ctrl+T` → aksesuar, kostüm, araç, efekt…
- **Odak modu:** `F11`. **Yakınlaştırma:** `Ctrl++` / `Ctrl+-` / `Ctrl+0`.

## Sekmeler

| Sekme | İçerik |
| --- | --- |
| Yaz | Senaryo editörü; solda sahneler (sürükle-bırak ile taşı), sağda sahne bilgisi |
| Mantar Pano | Sahneler fiş kartı olarak; bölümlere göre, sürükle-bırak |
| Anahat | Tüm sahneler tabloda: sayfa, uzunluk, karakterler, özet, renk, durum; süzgeçler |
| Karakterler | Replik/kelime sayıları, geçtiği sahneler, profil notu ve rengi |
| Zaman Çizelgesi | Sahneler uzunluklarıyla yan yana, bölüm ve hikâye günü bantları, karakter şeritleri |
| İstatistik | Sayfa, süre, iç/dış, gündüz/gece, mekanlar, replikler; prodüksiyon dökümü (CSV) |
| Önizleme | Basılacak sayfaların birebir görünümü, başlık sayfası, sistem yazdırma penceresi |

## Yazma hedefleri

Durum çubuğundaki çentiklere tıkla (ya da Senaryo › Yazma hedefleri): günlük kelime hedefi, üst üste kaç gün
hedefi tuttuğun, en uzun seri, son 30 günün grafiği. **Süreli seans:** 10–60 dakika, isteğe bağlı kelime
hedefiyle; geri sayım durum çubuğunda görünür, bitince sonucu yazar ve kaydeder.

## Yazım denetimi

Türkçe sözlükle (Hunspell, ~1,4 milyon kök) yazarken denetler; hatalı kelimelerin altı dalgalı çizilir.
Sağ tık: öneriler (önce Türkçe karakter düzeltmeleri: "cok" → "çok"), **Sözlüğe ekle**, **Yoksay**.
`F7` aç/kapat, `F8` sıradaki hata. Karakter adları doğru sayılır; büyük harfli satırlar Türkçe harf kurallarıyla
denetlenir (İ/ı). Kişisel sözlük: Düzen › Kişisel sözlük.

## Oyuncu sayfaları

Dosya › Oyuncu sayfaları ve replik dökümü. Bir karakter seç:

- **Sahneler (sides):** oynadığı sahneler, senaryodaki numaralarla; istersen her sahne yeni sayfada.
- **Replik dökümü:** yalnızca replikleri, her birinin önünde karşısındakinin son cümlesi (ipucu).

İkisinde de karakterin replikleri fosforlu kalemle vurgulanabilir; sayfa başında karakter adı yazar.

## Dosyalar

- **Başlık sayfası** (Senaryo menüsü): başlık, unvan, yazar, dayanak, taslak tarihi, iletişim, telif, not.
- **Dışa aktar** (`Ctrl+E`): PDF (A4 / US Letter, başlık sayfası, sahne numaraları, (DEVAM)/(DEVAM EDİYOR)),
  Fountain, Final Draft (.fdx). Türkçe veya İngilizce etiketler.
- **İçe aktar** (Dosya menüsü): Final Draft, Highland, Fade In, Celtx — yeni, kaydedilmemiş bir senaryo olarak açılır.
- **Yedek kasası:** değişiklik varsa 5 dakikada bir Fountain yedeği; en yeni 50 tutulur. Komut paletinden açılır.
- **Anlık görüntüler:** `Ctrl+5`; içe aktarma ve geri yüklemeden önce otomatik alınır.

Uygulama verileri: `%APPDATA%\app.writethefout.desktop\` (`writethefout.db`, `yedekler\`). Senaryolar nereye kaydettiysen orada.

## Geliştirme

```bash
npm install
npm run app        # geliştirme modunda masaüstü uygulaması
npm run installer  # kurulum dosyası
npm test           # 68 test: tuş akışı, revizyon, sayfalama, dosya biçimi, içe/dışa aktarma, PDF, yazım, hedefler, oyuncu sayfaları
```
