# KitApp ürün yol haritası

6 Eylül 2026. Bu liste planlama içindir; aşağıdaki büyük özellikler bu turda kendiliğinden uygulanmadı. Mevcut takip/engel, okuma, topluluk, bildirim ve eser modelleri genişletilmeli; paralel veri modelleri kurulmamalı.

P0: yayından önce güvenlik, veri tutarlılığı ve temel kullanılabilirlik. P1: bir sonraki ürün turu. P2: kullanım verisiyle önceliklendirilecek büyüme özellikleri.

| Özellik | Neden gerekli / mevcut durum | Zorluk | Backend ihtiyacı | Öncelik |
| --- | --- | --- | --- | --- |
| Onboarding: tür, yazar, kitap seçimi | Yeni okurun önerilerini ilk günden anlamlı yapar | Orta | Kullanıcı ilgi tablosu, kitap/yazar kimlikleri, RLS | P1 |
| Kişiselleştirilmiş Senin İçin feed’i | Takip dışı içerikte kitap odağını ve çeşitliliği korur | Büyük | Aday üretimi, sıralama, gösterim/feedback, cursor | P2 |
| İçerikte İlgilenmiyorum | Feed tercihini kullanıcı kontrolüne verir | Orta | İçerik ve konu bazlı feedback, saklama süresi | P1 |
| Kaydedilen gönderiler | Okunacak içerik tekrar bulunabilir | Küçük | Kullanıcıya özel saved_posts ve RLS | P1 |
| Bölüm içi yer imleri | Uzun metinde kesin konuma dönülür | Orta | Bölüm/metin sürümü ve konum, kullanıcı RLS | P1 |
| Okuma hedefleri ve ilerleme | Mevcut reading_progress üstüne tutarlı hedef deneyimi | Orta | Günlük kayıt, hedef ve tekrar yazma idempotency | P1 |
| Yıllık okuma özeti | Kitap odaklı geri dönüş ve paylaşım | Orta | Zaman dilimli özet sorguları, paylaşım gizliliği | P2 |
| Kitap listeleri/koleksiyonları | Mevcut rafların kürasyon yeteneğini artırır | Orta | Sıralama, liste görünürlüğü ve üyelik modeli | P1 |
| Takip edilen yazarlar | Gerçek ortak yazar öneri sinyali sağlar | Orta | OpenLibrary author key normalizasyonu ve author_follows | P1 |
| Trend hashtagler | Mevcut keşif altyapısında spam dayanıklılığı gerekir | Orta | Zaman penceresi, benzersiz kullanıcı sayımı, limit | P1 |
| Gelişmiş arama | Kitap/okur/yazar/topluluk ayrımını netleştirir | Büyük | İndeksler, tip bazlı filtreler, pagination | P1 |
| Arama geçmişi | Tekrarlanan sorguları hızlandırır | Küçük | İlk aşamada cihazda sınırlı liste, isteğe bağlı senkronizasyon | P2 |
| Bildirim tercihleri | Gereksiz bildirimleri azaltır | Orta | Tür bazlı tercihler ve gönderim katmanında kontrol | P1 |
| Mute / block | Mevcut çift yönlü engeli sessize alma ile tamamlar | Orta | Mute tablosu, tüm feed/RPC filtrelerinin ortak denetimi | P0 |
| Spam ve moderasyon | Raporların işleme alınması ve tekrar spam önleme | Büyük | Rate limit, rapor kuyruğu, moderatör yetkisi, audit log | P0 |
| Topluluk üyelik onayı/davet | Mevcut özel topluluğa güvenli katılım yolu | Orta | Süreli davet, onay durumu, rol geçiş politikaları | P1 |
| Sonsuz pagination | Büyük feed/profil listelerinde bellek ve ağ sınırı | Orta | Kararlı cursor, eşit tarih için ID, uygun indeksler | P1 |
| Pull-to-refresh | Güncel veri alma davranışını ekranlar arasında birleştirir | Küçük | Mevcut sorgular; istemcide iptal ve eski yanıt koruması | P1 |
| Optimistic UI | Takip/beğeni/kaydet gecikmesini azaltır | Orta | İdempotent unique anahtarlar ve hata halinde geri alma | P1 |
| Offline cache | Bağlantı kaybında okunabilirlik ve taslak güvenliği | Büyük | Kullanıcıya göre ayrılmış cache, TTL, logout temizliği | P2 |
| Accessibility | VoiceOver/TalkBack, büyük yazı ve kontrast | Orta | Backend yok; gerçek cihaz ve font ölçeği testleri | P0 |
| Profil gizlilik seçenekleri | Kişisel içerik görünürlüğünü kontrol ettirir | Büyük | Gizli profil/takip onayı, tüm ilişki ve içerik RLS audit’i | P1 |
| Kullanıcı öneri feedback’i | Bu turdaki 14 günlük gizlemeyi ölçülebilir tercihe dönüştürür | Orta | Mevcut reader_suggestion_feedback, gösterim/etki ölçümü | P1 |
| Güvenli UGC moderasyonu | Görsel ve uzun metinde yayın güvenliği | Büyük | Upload doğrulama, moderasyon kuyruğu, itiraz, rate limit | P0 |
| Eser okuma ilerlemesi | Bu turdaki cihazda son bölüm kaydını cihazlar arası taşır | Orta | work_reading_progress, bölüm sürümü ve kullanıcı RLS | P1 |
| Eser kütüphanesi | Mevcut saved_works kayıtlarına ayrı liste ve filtre ekranı | Küçük | saved_works + works; gerçek kitap raflarına karıştırılmaz | P1 |
| Eser yorumları | Yazar-okur iletişimi | Orta | RLS, block filtreleri, rapor ve silme kuralları | P2 |
| Bölüm yorumları | Bölüme özgü tartışma ve spoiler kontrolü | Büyük | Bölüm ilişkisi, pagination ve moderasyon | P2 |
| Okuma istatistikleri | Hedef ve önerilere güvenilir veri sağlar | Orta | Tekrarlı sayımı engelleyen olay modeli, toplu özet | P2 |
| Eser kapakları için artık dosya temizliği | Değiştirilen kapaklar Storage’da sahipsiz kalmamalı | Orta | Sunucu retention görevi; aktif referans kontrolü ve bekleme süresi | P1 |

## Önerilen sonraki 10 adım

1. Gerçek iOS/Android cihazlarda auth, tema, klavye ve erişilebilirlik kabul turu.
2. UGC moderasyon kuyruğu ve yazma/upload rate limitleri.
3. Mute ve mevcut block kurallarının bütün feed sorgularına tutarlı uygulanması.
4. Kitap/yazar/tür seçimiyle kısa onboarding.
5. Kaydedilen gönderiler.
6. Cursor pagination ve tutarlı pull-to-refresh.
7. Bildirim tercihleri.
8. Topluluk davet ve üyelik onayı.
9. Ayrı eser kütüphanesi ve cihazlar arası bölüm ilerlemesi.
10. Mevcut reading_progress üzerinde okuma hedefleri.

## Bu turun sınırları

Öneriler mevcut RLS ile okunabilen takip, inceleme/okuma, topluluk, hashtag ve etkinlik verilerini kullanır. Ortak yazar sinyali için kalıcı bir author-follow modeli henüz yok; gerekçe uydurulmaz. Sorgular 50–500 satırlık sınırlar taşır; büyük veri ölçeğinde sunucu aday üretimi/pagination gerekir. Popüler eserler kayıt sayısına göre sunucuda sıralanır, sonuç 50 eserle sınırlıdır. Eser yorumları ve gerçek kitaplar için yeni bir veri modeli eklenmedi.
