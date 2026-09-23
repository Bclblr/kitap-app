# Aydınlık mod tema incelemesi

23 Eylül 2026. Karşılaştırma tabanı: `47cd42f`.

Aydınlık görünüm; açık mor zemin, beyaz kartlar, belirgin form sınırları ve `#6232B5` ana vurgu etrafında düzenlendi. Mevcut ThemeProvider sistem/açık/koyu seçimi ve kalıcı tercih davranışı korundu. ThemeProvider incelendi; değişiklik gerektirmedi. Koddan önce [Expo SDK 57 sürüm belgeleri](https://docs.expo.dev/versions/v57.0.0/) okundu.

## Bulunan ve düzeltilen sorunlar

- Eski renk dönüştürücü dolu mor butonları da açık vurgu zeminine çeviriyordu. Buton zemini ve üzerindeki yazı birlikte primary/onPrimary olarak çözümleniyor.
- Kart, ikincil yüzey ve input renkleri fazla koyu/gri-mor görünüyordu. Beyaz kartlar ve daha açık ikincil yüzeylerle hiyerarşi netleştirildi.
- Bazı giriş butonlarında pasif durum yazısı mor zemin üzerinde koyu kalıyordu. Aydınlık modda beyaz yazı korunuyor; ortak disabled stillerinin aşırı düşük opaklığı yükseltildi.
- İkonların ve placeholder'ların bir kısmı StyleSheet dönüşümünden geçmiyordu. Bunlar görsel görevlerine göre primary, textPrimary, textSecondary, textMuted, danger, success ve onPrimary tokenlarına bağlandı.
- Hikâye adları ve görülen hikâye halkaları, tüm story stillerini hariç tutan kural yüzünden soluk/koyu mod renklerinde kalıyordu. Akış arayüzü ile medya gösteriminin renkleri ayrıldı.
- Alıntı bilgileri, spoiler kartları, hata ekranı ve reklam gizlilik kartı sabit koyu renkler kullanıyordu. Açık moda özel semantik stiller eklendi.
- İnceleme oluşturma ekranının alt çubuğundaki sabit koyu rgba zemin düzeltildi.
- Mesaj tarihleri, gönderim hataları, kendi mesaj balonları, okunma bilgileri ve okunmamış mesaj rozetleri ele alındı.
- BottomNav beyaz yüzey kullanıyor; pasif ikonlar textSecondary, aktif ikonlar primary, seçili alan primarySoft, klavye odağı focusRing ile ayrılıyor. Rozet yazısı onPrimary olarak korunuyor.
- Hikâye ayarları alt penceresi ve gizlilik/bildirim/admin anahtarları mor kimliğe bağlandı.
- Premium ekranındaki ücretsiz hesap rozetinin beyaz yazı/gri zemin eşleşmesi, textSecondary/surfaceSecondary olarak düzeltildi.
- Eski alternatif tema sabitlerinin aydınlık bölümü ana palete bağlandı; hashtag ve Premium rozetindeki farklı morlar birleştirildi.

## Token değişiklikleri

| Token | Önce | Sonra |
| --- | --- | --- |
| background | #ECE8F2 | #F6F3FA |
| surfaceElevated | #DDD6E8 | #EEE8F5 |
| surfaceSecondary | #E4DDEB | #F0ECF5 |
| input | #E2DCE9 | #F8F6FC |
| border | #B7ABBE | #91859F |
| divider | #CCC2D2 | #C4BACF |
| primarySoft / accentSoft | #CDB8EB | #EDE3FA |
| secondaryAccent | #6F46BE | #6232B5 |
| warning | Yeni | #865000 |
| warningSoft | Yeni | #FFF2DB |
| dangerSoft | Yeni | #FCE9EF |
| successSoft | Yeni | #E5F3EA |

primary/accent/focusRing zaten #6232B5 idi; değerleri korundu ve atlanan kullanımlar bu tokenlara bağlandı. surface/onPrimary beyaz; text/textPrimary #17121F, textSecondary #453B54, textMuted #5F556C değerleri korundu. Yeni tokenların koyu palet karşılıkları eklendi; mevcut koyu token değerleri değiştirilmedi.

## Sabit renklerin semantik karşılıkları

| Görsel görev ve örnekler | Aydınlık karşılığı |
| --- | --- |
| Başlık/metin/ikon: #F4F5F7, #F5F5F8 | text / textPrimary |
| İkincil bilgi ve ikon: #8F96A3, #A9AFBB, #777983 | textSecondary |
| Placeholder: #747483, #686873, #999 | textMuted |
| Kart: #15151D, #111318 | surface |
| İkincil yüzey | surfaceElevated / surfaceSecondary |
| Form: #17171F, #0A0B10 | input |
| Sınırlar: #292934, #30303D | border |
| Ayırıcılar: #23262E, #292932 | divider |
| Dolu vurgu: #8058D9, #6F4ED8, #A985FF | primary |
| Seçili/yumuşak vurgu: #21182F, #302246 | primarySoft |
| Dolu butondaki #FFF veya #0B0C0F yazı | onPrimary |
| Beğeni/silme/hata: #FF6B7A, #FFB2B2 | danger |
| Repost/başarı: #66D19E, #B8F3D1 | success |
| Spoiler uyarısı: #F2B36C | warning / warningSoft |

Sabit değerler körlemesine silinmedi. Eski StyleSheet değerleri koyu modun kaynağı olarak duruyor; aydınlık modda merkezi çözümleyici semantik karşılıklarını kullanıyor. Doğrudan JSX renklerinde useLightColor(token, eskiKoyuRenk), daha önce temaya bağlı olmayan bileşenlerde açık token eşlemeli useLightStyles kullanıldı.

Medya üstü kontroller, fotoğraf/hikâye önizlemeleri, doğrulama rozeti ve kullanıcının seçtiği dışa aktarılabilir Premium kart tasarımları kendi görsel anlamlarıyla korundu. Bunların sabit renkleri uygulama yüzeyi olarak değerlendirilmedi.

## İnceleme kapsamı ve beklenen en belirgin kazanımlar

Ana Sayfa, Raflarım, Oku, Kitap Detayı, Keşfet, Profil, Mesajlar/sohbet, Bildirimler, Premium alt ekranları, ayarlar, kimlik/form ekranları, admin ekranları, oluşturma ekranları ve ortak modal/alt pencere bileşenleri kaynak kod üzerinden tarandı. Zaten semantik renkleri kullanan ekranlar palet değişikliğini doğrudan alıyor; bu dosyalarda gereksiz düzenleme yapılmadı.

En belirgin kazanımların Ana Sayfa hikâye adları ve yorum penceresi, Kitap Detayı kaydet/rafa ekle kontrolleri, Keşfet arama/filtreleri, sohbet ve mesaj rozetleri, inceleme oluşturma alt çubuğu, spoiler kartları ve admin formlarında olması bekleniyor. Bu değerlendirme kod/stil incelemesine dayanıyor; cihaz veya tarayıcı ekran görüntüsüyle doğrulanmış bir görsel karşılaştırma değildir.

## Doğrulama

- `npm run typecheck`: başarılı, sıfır TypeScript hatası. PowerShell npm.ps1 yürütme politikası nedeniyle eşdeğer `npm.cmd run typecheck` kullanıldı.
- `npm run test:theme`: başarılı. 28 metin/zemin eşleşmesi AA eşiğini karşılıyor. Kontrol edilen normal metin/primary eşleşmelerinde en düşük kontrast 5,65:1; beyaz/primary 7,95:1. Input sınırı/zemin kontrastı en az 3:1.
- `node scripts/test-light-theme.cjs --compare-head`: 47cd42f tabanıyla 56 ortak stil tablosu / 2.435 statik stilin koyu mod çıktısı aynı. Yeni bağlanan 7 bileşenin özgün koyu stilleri de aynı. Mevcut koyu palet tokenlarının tamamı aynı.
- Testler ayrıca tema değişimi, sabit koyu değerleri koruyan yardımcılar, hikâye/medya ayrımı, buton yazıları, mesaj rozetleri, disabled giriş butonları ve inceleme alt çubuğunu kapsıyor.
- Statik metin/ebeveyn zemin taramasında ek düşük kontrast uyarısı çıkmadı. Bu tarama dinamik durumların tamamını veya gerçek cihaz render sonucunu kapsamaz.
- Tema dosyalarına yönelik ESLint ve `git diff --check`: başarılı.
- Görsel cihaz/tarayıcı testi yapılmadı; ortamda kullanılabilir tarayıcı otomasyon aracı bulunmadı. Bu nedenle tüm ekranlar için ölçülmüş WCAG uyumluluğu veya piksel düzeyinde koyu mod eşitliği iddia edilmiyor.

`--compare-head` inceleme sırasında mevcut HEAD ile kıyaslama içindir; değişiklikler commit edildikten sonra eski tabanla aynı karşılaştırmayı ifade etmez. Normal `test:theme` testleri bağımsız çalışır.

## Değişen dosyalar

Aşağıdaki liste ekranlardaki küçük ikon/placeholder uyarlamalarını da içerir. ThemeProvider.tsx incelendi, değiştirilmedi.

- [docs/light-theme-audit.md](../docs/light-theme-audit.md)
- [package.json](../package.json)
- [scripts/test-light-theme.cjs](../scripts/test-light-theme.cjs)
- [src/app/account-deletion.tsx](../src/app/account-deletion.tsx)
- [src/app/admin-admins.tsx](../src/app/admin-admins.tsx)
- [src/app/admin-announcements.tsx](../src/app/admin-announcements.tsx)
- [src/app/admin-audit.tsx](../src/app/admin-audit.tsx)
- [src/app/admin-authors.tsx](../src/app/admin-authors.tsx)
- [src/app/admin-books.tsx](../src/app/admin-books.tsx)
- [src/app/admin-communities.tsx](../src/app/admin-communities.tsx)
- [src/app/admin-content.tsx](../src/app/admin-content.tsx)
- [src/app/admin-control-center.tsx](../src/app/admin-control-center.tsx)
- [src/app/admin-events.tsx](../src/app/admin-events.tsx)
- [src/app/admin-explore.tsx](../src/app/admin-explore.tsx)
- [src/app/admin-hashtags.tsx](../src/app/admin-hashtags.tsx)
- [src/app/admin-moderation.tsx](../src/app/admin-moderation.tsx)
- [src/app/admin-notifications.tsx](../src/app/admin-notifications.tsx)
- [src/app/admin-premium-history.tsx](../src/app/admin-premium-history.tsx)
- [src/app/admin-premium.tsx](../src/app/admin-premium.tsx)
- [src/app/admin-storage.tsx](../src/app/admin-storage.tsx)
- [src/app/admin-system.tsx](../src/app/admin-system.tsx)
- [src/app/admin-trash.tsx](../src/app/admin-trash.tsx)
- [src/app/admin-users.tsx](../src/app/admin-users.tsx)
- [src/app/admin-verification-history.tsx](../src/app/admin-verification-history.tsx)
- [src/app/admin.tsx](../src/app/admin.tsx)
- [src/app/author.tsx](../src/app/author.tsx)
- [src/app/book.tsx](../src/app/book.tsx)
- [src/app/chat.tsx](../src/app/chat.tsx)
- [src/app/community-members.tsx](../src/app/community-members.tsx)
- [src/app/community.tsx](../src/app/community.tsx)
- [src/app/event.tsx](../src/app/event.tsx)
- [src/app/explore.tsx](../src/app/explore.tsx)
- [src/app/forgot-password.tsx](../src/app/forgot-password.tsx)
- [src/app/hashtag.tsx](../src/app/hashtag.tsx)
- [src/app/index.tsx](../src/app/index.tsx)
- [src/app/login.tsx](../src/app/login.tsx)
- [src/app/messages.tsx](../src/app/messages.tsx)
- [src/app/notification-settings.tsx](../src/app/notification-settings.tsx)
- [src/app/onboarding.tsx](../src/app/onboarding.tsx)
- [src/app/post-create.tsx](../src/app/post-create.tsx)
- [src/app/premium.tsx](../src/app/premium.tsx)
- [src/app/privacy-settings.tsx](../src/app/privacy-settings.tsx)
- [src/app/profile-settings.tsx](../src/app/profile-settings.tsx)
- [src/app/profile.tsx](../src/app/profile.tsx)
- [src/app/quote-create.tsx](../src/app/quote-create.tsx)
- [src/app/read.tsx](../src/app/read.tsx)
- [src/app/register.tsx](../src/app/register.tsx)
- [src/app/reset-password.tsx](../src/app/reset-password.tsx)
- [src/app/review.tsx](../src/app/review.tsx)
- [src/app/shelves.tsx](../src/app/shelves.tsx)
- [src/app/story-create.tsx](../src/app/story-create.tsx)
- [src/app/verify-email.tsx](../src/app/verify-email.tsx)
- [src/components/AdPrivacyPreferences.native.tsx](../src/components/AdPrivacyPreferences.native.tsx)
- [src/components/AppErrorState.tsx](../src/components/AppErrorState.tsx)
- [src/components/BookPickerModal.tsx](../src/components/BookPickerModal.tsx)
- [src/components/BottomNav.tsx](../src/components/BottomNav.tsx)
- [src/components/HashtagText.tsx](../src/components/HashtagText.tsx)
- [src/components/PremiumBadge.tsx](../src/components/PremiumBadge.tsx)
- [src/components/QuoteMetadata.tsx](../src/components/QuoteMetadata.tsx)
- [src/components/ReaderUI.tsx](../src/components/ReaderUI.tsx)
- [src/components/ReviewSpoilerText.tsx](../src/components/ReviewSpoilerText.tsx)
- [src/components/RuntimeGate.tsx](../src/components/RuntimeGate.tsx)
- [src/components/themed-text.tsx](../src/components/themed-text.tsx)
- [src/constants/theme.ts](../src/constants/theme.ts)
- [src/theme/light-styles.ts](../src/theme/light-styles.ts)
- [src/theme/palette.ts](../src/theme/palette.ts)
- [src/theme/use-themed-styles.ts](../src/theme/use-themed-styles.ts)
