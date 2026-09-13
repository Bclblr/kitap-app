# V1 Kabul Senaryosu

Bu belge, Kitap uygulamasının V1 sürümünü kabul etmek için çalıştırılacak uçtan uca kontrol listesidir. Bir madde başarısız olursa ilgili V1 kabul testi başarısız sayılır ve sorun giderilmeden mağaza yayınına geçilmez.

## Test ön koşulları

- En az iki ayrı gerçek kullanıcı hesabı hazır olmalı: Kullanıcı A ve Kullanıcı B.
- En az bir iPhone ve bir Android cihaz/build kullanılmalı.
- Canlı Supabase migration zinciri güncel olmalı.
- Test hesapları birbirinden bağımsız e-posta adresleri kullanmalı.
- Ağ bağlantısı, zayıf bağlantı ve kısa süreli çevrimdışı senaryoları ayrıca denenmeli.

## 1. Kayıt, doğrulama ve onboarding

- [ ] Yeni Kullanıcı A e-posta ile kayıt olur.
- [ ] Doğrulama e-postası gelir ve callback uygulamaya geri döner.
- [ ] Kullanıcı onboarding ekranına yönlendirilir.
- [ ] Kullanıcı adı, profil bilgisi ve günlük okuma hedefi kaydedilir.
- [ ] Onboarding tamamlandıktan sonra tekrar onboarding'e zorla yönlendirme olmaz.
- [ ] Çıkış yapıp tekrar girişte aynı profil doğru yüklenir.

## 2. Sosyal giriş

- [ ] Google ile giriş Android development/preview build üzerinde tamamlanır.
- [ ] Google ile giriş iPhone development/preview build üzerinde tamamlanır.
- [ ] Apple Sign In gerçek iPhone üzerinde tamamlanır.
- [ ] Sosyal giriş ile ilk kez gelen kullanıcı onboarding'e yönlendirilir.
- [ ] Mevcut sosyal kullanıcı tekrar girişte mevcut hesabına döner; yeni profil çoğalmaz.

## 3. Profil ve hesap izolasyonu

- [ ] Kullanıcı A profil fotoğrafı ve kapak fotoğrafı yükler.
- [ ] Profil değişiklikleri yeniden açılışta korunur.
- [ ] Kullanıcı A çıkış yapar, Kullanıcı B giriş yapar.
- [ ] Kullanıcı B, A'nın rafını, yerel cache'ini, hikâye görülme bilgisini veya kullanıcıya özel ayarlarını görmez.
- [ ] Kullanıcı B çıkış yapıp A tekrar giriş yaptığında A'nın kendi verileri doğru yüklenir.

## 4. Kitap keşfi ve raf akışı

- [ ] Keşfet veya arama üzerinden bir kitap bulunur.
- [ ] Kitap detay ekranı eksik metadata olsa bile kırılmaz.
- [ ] Kitap `Okuyacağım` rafına eklenir.
- [ ] Durum `Okuyorum` olarak değiştirilir.
- [ ] Okuma ilerlemesi girilir/güncellenir.
- [ ] Durum `Okudum` olarak değiştirilir.
- [ ] Raf değişiklikleri uygulama yeniden açıldığında korunur.
- [ ] Aynı kitabı okuyanlar ekranı gerçek sunucu verisini gösterir.

## 5. İçerik oluşturma

- [ ] Kullanıcı A bir gönderi oluşturur.
- [ ] Oluşturulan gönderi ana feed ve profil yüzeylerinde görünür.
- [ ] Gönderi düzenlenir ve değişiklik korunur.
- [ ] Gönderi silinir ve ilgili yüzeylerden kaybolur.
- [ ] Kullanıcı A bir inceleme oluşturur, düzenler ve siler.
- [ ] Kullanıcı A bir alıntı oluşturur, düzenler ve siler.
- [ ] İnceleme ve alıntılar doğru kullanıcı adı ve kitap bilgisiyle görünür.

## 6. Etkileşimler

- [ ] Kullanıcı B, A'nın gönderisini beğenir.
- [ ] Kullanıcı B gönderiye yorum yazar.
- [ ] Kullanıcı B gönderiyi repost eder ve geri alır.
- [ ] Kullanıcı B gönderiyi kaydeder; Kaydedilenler ekranında görünür.
- [ ] İlgili bildirimler Kullanıcı A'ya düşer.
- [ ] Bildirime dokunulduğunda ilgili içerik açılır.

## 7. Takip, gizlilik ve engelleme

- [ ] Kullanıcı B, A'yı takip eder veya özel hesapsa takip isteği gönderir.
- [ ] Takip durumu feed/profil üzerinde tutarlı görünür.
- [ ] Kullanıcı A, B'yi engeller.
- [ ] Engelleme sonrası iki kullanıcı birbirinin engellenmesi gereken içerik ve etkileşim yüzeylerinde görünmez.
- [ ] Engelleme kaldırıldığında izin verilen yüzeyler tekrar çalışır.
- [ ] İçerik şikâyeti gönderilebilir ve tekrar/spam koruması çalışır.

## 8. Feed, arama ve keşfet

- [ ] Ana feed ilk sayfayı yükler.
- [ ] Aşağı kaydırıldığında sonraki sayfa yüklenir ve duplicate içerik oluşmaz.
- [ ] `Takip` feed'i takip edilen hesapların içeriklerini sayfalı getirir.
- [ ] `Senin İçin` alanı veri yokken dürüst fallback gösterir.
- [ ] Arama sonuçları sayfalı yüklenir.
- [ ] Hashtag ekranı sayfalı yüklenir.
- [ ] Keşfet ekranındaki kitaplar, okuyucular, hashtagler, yazarlar, etkinlikler ve topluluk bölümleri erişilebilir kalır.

## 9. Topluluklar

- [ ] Açık topluluğa katılma/ayrılma çalışır.
- [ ] Özel topluluk daveti oluşturulur ve hedef kullanıcı kabul/reddedebilir.
- [ ] Admin üyeyi yönetebilir; yetkisiz üye yönetemez.
- [ ] Owner korumaları çalışır.
- [ ] Topluluk feed'i sayfalı yüklenir.

## 10. Etkinlikler

- [ ] Etkinlik oluşturma ekranında galeri görseli seçilir ve yüklenir.
- [ ] Native tarih ve saat seçiciler çalışır.
- [ ] Geçmiş tarihli etkinlik kaydedilemez.
- [ ] Etkinlik katılımı eklenir/çıkarılır.
- [ ] Katılımcı listesi doğru kullanıcıları gösterir.

## 11. Hikâyeler

- [ ] Hikâye görseli yüklenir ve görüntülenir.
- [ ] Hikâye beğeni/görüldü davranışı doğru kullanıcıya ait kalır.
- [ ] Kullanıcı kendi hikâyesini sildiğinde storage medyası da temizlenir.
- [ ] Süresi geçmiş kullanıcının hikâye medyası bakım akışıyla temizlenebilir.

## 12. Mesajlaşma

- [ ] Kullanıcı A ve B arasında mesaj gönderme/alma çalışır.
- [ ] Eski mesajlar sayfalama ile yüklenir.
- [ ] Zayıf bağlantıda gönderim hatası kullanıcıya anlaşılır gösterilir.
- [ ] Mesajlaşma verileri hesap değişiminde diğer kullanıcıya taşınmaz.

## 13. Ağ ve hata davranışı

- [ ] İnternet kapatıldığında global çevrimdışı durumu görünür.
- [ ] Çevrimdışıyken desteklenmeyen yazma işlemleri sessizce kuyruğa alınmaz.
- [ ] İnternet geri geldiğinde odaktaki ekran sessizce yenilenebilir.
- [ ] API hatasında ortak retry/hata bileşeni çalışır.
- [ ] Uygulama fatal JS/React hatalarında production error monitoring yolunu kullanır.

## 14. Bildirimler

- [ ] Beğeni, yorum, takip ve desteklenen diğer bildirim tercihleri uygulanır.
- [ ] Push bildirim izni ve token akışı gerçek cihazda çalışır.
- [ ] Push bildirime dokunulduğunda uygun uygulama rotası açılır.
- [ ] Bildirim tercihi kapalı event türü için gereksiz push gönderilmez.

## 15. Runtime kontrolleri

- [ ] Maintenance mode açıldığında normal kullanıcı uygulamaya devam edemez ve doğru mesajı görür.
- [ ] Ban/suspension hesabı doğru engellenir.
- [ ] Minimum app version yükseltildiğinde force-update ekranı açılır.
- [ ] Kayıt kapatıldığında yeni hesap oluşturma engellenir.

## 16. Hesap ve veri yönetimi

- [ ] Engellenen kullanıcılar ekranı doğru listeyi gösterir.
- [ ] Gizlilik ve veri yönetimi ekranı erişilebilir.
- [ ] Hesap silme akışı iki aşamalı onay ister.
- [ ] Hesap silindiğinde auth hesabı ve bağlı uygulama verileri beklenen şekilde silinir.
- [ ] Silinen hesap tekrar uygulamaya erişemez.

## 17. Görsel ve erişilebilirlik kabulü

- [ ] Açık ve koyu tema temel ekranlarda okunabilir ve tutarlıdır.
- [ ] Ana etkileşim elemanlarında erişilebilir label/role bulunur.
- [ ] Kritik metinlerde aşırı küçük font kullanılmaz.
- [ ] Formlarda klavye inputları kapatmaz ve iPhone/Android ergonomisi kabul edilebilir.
- [ ] Loading/skeleton/error durumları görsel olarak tutarlıdır.

## 18. V1 dışı özellik sınırı

- [ ] Okur eserleri keşfet ve mevcut eser/taslak görüntüleme korunur.
- [ ] Yeni eser oluşturma/yayınlama V1'de aktif bir geliştirme zorunluluğu değildir.
- [ ] Bu modülün dondurulması çekirdek sosyal okuma akışlarını engellemez.

## 19. Ürün analitiği

- [ ] `app_open` olayı oturumlu uygulama açılışında kaydolur.
- [ ] `onboarding_completed` yalnızca onboarding başarıyla tamamlandığında kaydolur.
- [ ] `book_opened` kitap detay ekranı açıldığında kaydolur.
- [ ] `shelf_updated` raf durumu değiştiğinde kaydolur.
- [ ] `content_created` post/review/quote oluşturulduğunda kaydolur.
- [ ] Analytics metadata içinde e-posta, kullanıcı adı, içerik metni, arama sorgusu veya token bulunmaz.

## V1 kabul kararı

V1 ancak aşağıdaki koşullar birlikte sağlandığında kabul edilir:

1. Bu belgedeki kritik senaryoların tamamı geçer.
2. Acceptance Gate tamamen yeşildir.
3. iPhone ve Android development/preview build kabul testleri geçer.
4. İki gerçek kullanıcı ile güvenlik ve uçtan uca senaryolar tamamlanır.
5. Canlı Supabase migration zinciri release commit'iyle uyumludur.
6. Bloker veya yüksek öncelikli açık hata kalmaz.
