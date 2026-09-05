# KitApp ürün geliştirme turu — 5 Eylül 2026

## A. Uygulanan özellikler

- 18 mevcut + 6 yeni rota tarandı. Ortak üst/yan safe area, BottomNav alt inset, sohbet klavyesi, dar ekranlarda metin küçülmesi/satır kaydırma, profil fotoğrafı ve topluluk tarihi düzenlendi. Ekranlara toplu StyleSheet enjeksiyonu uygulanmadı.
- Hikâyeler: 6 saniye otomatik ilerleme, animasyonlu segmentler, basılı tutunca ve uygulama arka plana geçince duraklatma, 220 ms geçiş, sonraki görseli ön yükleme, mevcut ileri/geri/swipe/X ve AsyncStorage görülme sistemi. Beğeni, sahibinin silmesi, sohbeti yanıt taslağıyla açma.
- Ana akış: gerçek takip filtresi; yenilik, beğeni, yorum ve repost üzerinden sıralama; kendi içeriğine azaltılmış ağırlık; engel filtresi. Supabase alıntıları da akışa katılır; mevcut yerel alıntılar korunur. İncelemelerin ikinci kez listelenmesi engellendi.
- Keşfedilecek okurlar, takip/takipten çıkma, takipçi ve takip edilen listeleri. Yakın zamandaki gönderi etkinliği; veri yoksa kimlik üzerinden kararlı sıra. Ana sayfada en fazla üç öneri.
- Sohbet: klavyede gönder, eşzamanlı gönderme kilidi, realtime/insert çift kayıt önleme, tarih ayırıcıları, tekrar gönderme, sohbet ve okur arama, yeni sohbet, kişisel gizleme, engelleme/engeli kaldırma ve kategorili şikâyet menüsü.
- Topluluk/kitap kulübü oluşturma ve owner/admin düzenleme. Açık/özel görünürlük, kurallar, etiketler, isteğe bağlı mevcut kitap. Kurucu üyeliği trigger ile atomik oluşur. Mevcut katıl/ayrıl akışı korunur; kurucu üyelikten ayrılamaz.
- Profil fotoğrafı 96 px; büyütme modalı; takip listeleri; eser listesi ve yazma bağlantısı.
- `+` menüsü: gönderi, kitap seçerek inceleme, alıntı ve eser yazma.
- OpenLibrary’den ayrı eser/bölüm modeli; taslak/yayın durumları, bölüm düzenleme/sırası, yazarlık kontrolü, okuyucu ve önceki/sonraki bölüm. 800 ms gecikmeli cihaz taslağı yedeği ve geri yükleme. Sunucu kaydı açık Kaydet/Yayınla eylemleriyle yapılır.
- Merkezi test reklamı bileşeni; varsayılan kapalı flag; Expo Go/Web güvenli boş dönüş; native consent akışı ve gizlilik tercihleri; dokuz içerikte bir ve Keşfet yerleşimi.

## B. Değiştirilen mevcut dosyalar

`src/app`: `_layout.tsx`, `index.tsx`, `explore.tsx`, `profile.tsx`, `profile-settings.tsx`, `chat.tsx`, `messages.tsx`, `community.tsx`, `event.tsx`, `event-attendees.tsx`, `hashtag.tsx`, `book.tsx`, `read.tsx`, `review.tsx`, `shelves.tsx`, `notifications.tsx`, `login.tsx`, `register.tsx`.

`src/components`: `BottomNav.tsx`, `animated-icon.tsx`, `app-tabs.web.tsx`, `ui/collapsible.tsx`. Ayrıca `src/hooks/use-theme.ts`, `app.json`, `package.json`, `package-lock.json`, `.gitignore`.

Çalışma öncesindeki staged/unstaged düzenlemeler ve `.bak` dosyaları korundu. Git diff toplamı kullanıcının önceki değişikliklerini de içerir. Mevcut onarım scriptleri çalıştırılmadı/değiştirilmedi. `.env` düzenlenmedi; commit/push/staging veya production işlemi yapılmadı.

## C. Yeni dosyalar

- Rotalar: `readers.tsx`, `quote-create.tsx`, `community-editor.tsx`, `my-works.tsx`, `work-editor.tsx`, `work.tsx`.
- Bileşenler: `ReaderUI`, `ReadersList`, `WorksList`, `StoryPlayback`, `StoryTransition`, `StoryActions`, `ChatActions`, `AdSlot.tsx`, `AdSlot.native.tsx`.
- `src/hooks/use-reader-social.ts`, `src/lib/works.ts`, `src/lib/reader-date.ts`.
- `scripts/audit-reader-routes.cjs`, `scripts/test-reader-security.cjs`, `eslint.config.js`, bu rapor ve `docs/reader-route-audit.md`.

## D. Supabase migration dosyaları

Sırasıyla `supabase/migrations/202609050001_reader_features.sql`, `202609050002_communities.sql`, `202609050003_story_likes.sql`, `202609050004_access_hardening.sql`, `202609050005_quote_writes.sql`.

Migration’lar yeni tablolar, indeksler, grant’ler, RLS ve gerekli trigger’ları ekler. Mevcut izinleri genişletebilecek eski politikaların yanında restrictive guard’lar bulunur. Mevcut topluluk keşif RPC’si varsa caller RLS kullanması için security invoker yapılır. Realtime yayını varsa takip/engel tabloları eklenir.

Canlı şema bu repoda tam bulunmuyor. Testler kodda kullanılan kolonlara göre oluşturulmuş PostgreSQL fixture şemasında çalıştı; gerçek Supabase projesi üzerinde migration uygulanmadı. Önce staging şemasıyla karşılaştır ve uygula:

```powershell
# STAGING_DATABASE_URL değerini kendi güvenli ortamında tanımla.
npx.cmd supabase db push --db-url "$env:STAGING_DATABASE_URL" --dry-run
npx.cmd supabase db push --db-url "$env:STAGING_DATABASE_URL"
```

Yerelde `supabase/config.toml` bulunmuyorsa önce Supabase CLI ile proje başlatma/linkleme kurulumu gerekir. CLI migration geçmişiyle uzak geçmişin uyumunu kontrol et. Mevcut RPC’nin çağırdığı diğer fonksiyonların izinleri staging’de ayrıca denenmeli.

## E. Yeni npm paketleri

- Runtime: `react-native-google-mobile-ads` 16.5.0.
- Geliştirme: `eslint`, Expo 54 uyumlu `eslint-config-expo`, yerel PostgreSQL/RLS testi için `@electric-sql/pglite`.
- Expo 54 / React Native 0.81.5 korundu. Expo 57 belgeleri talimat gereği okundu; SDK yükseltmesi yapılmadı.
- npm kurulum raporu 26 güvenlik bulgusu bildirdi (17 moderate, 9 high); `audit fix --force` çalıştırılmadı.

## F. Kontroller

- Başlangıç TypeScript: 13 hata. login/register provider tipi; profil fullName; absoluteFill; ColorScheme null/undefined ve expo-symbol uyumsuzlukları. Son TypeScript: 0 hata.
- Lint: 0 hata; eski ana sayfa/profil/topluluk kodunda 22 kullanılmayan kod/hook bağımlılığı uyarısı.
- Expo Doctor: 18/18 başarılı.
- Web static export ve Android/iOS Hermes JavaScript export başarılı. Bunlar native binary derlemesi veya cihaz testi değildir.
- Yerel PostgreSQL testleri: migration’ların iki kez uygulanması; eser ve bölüm taslak gizliliği; sahiplik; özel topluluk izolasyonu; owner otomatik üyeliği; katıl/ayrıl; rol yükseltmenin reddi; sohbet katılımcılığı; iki yönlü engel; engel kaldırma; kişisel gizleme; mesaj/sender/katılımcı değiştirme engeli; şikâyet gizliliği; hikâye sahibi silme ve beğeni cascade.
- Rota/bileşen AST taraması: 24 rota, 0 duplicate nesne/StyleSheet alanı. `git diff --check` başarılı; Git yalnızca Windows LF/CRLF bilgilendirmeleri yazabilir.

Tekrar çalıştırma: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:security`, `npm.cmd run audit:routes`.

## G. Gereken kurulum ve sınırlar

- Yeni backend özellikleri için migration’ların staging’de, ardından kendi deployment sürecinle uygulanması gerekir. Engel bilgisi doğrulanamazsa mesaj gönderme ve öneriler güvenli biçimde kapalı kalır.
- Yeni secret/API key gerekmedi. Mevcut Supabase yapılandırması kullanıldı.
- Reklamlar `EXPO_PUBLIC_ADS_ENABLED` tanımsızken kapalıdır. `.env` değiştirilmedi. Test geliştirme build’inde bu değeri `true` yapabilirsin. App ve banner kimlikleri yalnızca Google test kimlikleridir; release build’de bile production reklamına geçmez.
- Gerçek reklama geçiş ayrı bir çalışma: platform başına AdMob app/banner ID’leri, AdMob UMP privacy mesajı ve uygulama gizlilik politikası, gerekiyorsa ATT, mağaza reklam beyanları ve custom native build doğrulaması. Kodda production banner kimliğine yönlendirme bilinçli olarak yoktur.
- Eser ve topluluk kapakları bu sürümde HTTPS görsel adresiyle girilir. Özel topluluk davet/üyelik onayı ve üyeyi yönetim ekranından çıkarma akışı eklenmedi; mevcut üyeler/kurucu erişebilir. Owner/admin düzenleme çalışır.
- Eser düzenleyicisindeki cihaz yedeği sunucuya otomatik yayın yapmaz. Bölüm sıraları benzersizdir; aynı sıra kaydı reddedilir. Listeler sınırlı sonuç getirir (eser 30, okur 100/ilişki 200); sonsuz sayfalama eklenmedi.
- Supabase hesaplarıyla uçtan uca ve fiziksel cihaz doğrulaması bu ortamda yapılmadı. Tüm ekranlarda taşma kalmadığına dair cihaz ölçümü iddia edilmiyor.

Kaynaklar: [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [Google Mobile Ads entegrasyonu](https://docs.page/invertase/react-native-google-mobile-ads), [Consent akışı](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).

## H. Manuel iPhone ve Android kontrolü

320/360/390/430 dp genişliklerde, büyük yazı boyutunda ve Android gesture/üç tuş navigasyonuyla:

- Login/register: klavye, hata metinleri, geri dönüş; mevcut Google/Apple düğmeleri önceden olduğu gibi bilgilendirme gösterir.
- Home: iki feed sekmesi, boş takip listesi, takip sonrası yenilenme, uzun kitap/okur adları, eski kitap kapakları ve post/review/quote eylemleri.
- Hikâye: çoklu kullanıcı, son hikâyede kapanma, ileri/geri, uzun basma, swipe, X, arka plan/geri dönüş, görülme kaydı, beğeni, silme ve yanıt taslağından DM gönderme.
- Profil: büyütme modalı, ayar çarkı, takipçi/takip listeleri, fotoğraf yükleme ve eski profil sekmeleri.
- Sohbet: arama, yeni konuşma, girişsiz durum, klavye açıkken son mesaj, enter ile gönder, hızlı çift dokunma, uçak modunda hata/tekrar, okunma, kişisel silme ve yeni mesajla görünme; iki hesapla engel/engel kaldırma ve üçüncü hesapla yetkisiz erişim.
- Topluluk: açık/özel oluşturma, kurucu üyeliği, katıl/ayrıl, owner düzenleme ve normal üyenin düzenleyememesi; eski post/yorum/beğeni akışları.
- Eser: yeni taslak, kapak adresi, cihaz yedeği, bölüm ekleme/düzenleme/sıra, yayınlama, diğer hesap/anonim okuyucu, gizli taslağın URL ile açılmaması, yazar profili.
- Read/book/review/shelves/notifications/hashtag/event/event-attendees/profile-settings ekranlarında uzun Türkçe metinler ve klavye; Web dar/geniş pencere.
- Test reklamları: Expo Go’da boş slot; custom build’de consent sonrası test banner, red/iptal ve gizlilik tercihlerine geri dönüş.
