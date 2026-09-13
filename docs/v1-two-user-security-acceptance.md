# V1 İki Kullanıcı Güvenlik Kabul Testi

Bu kontrol gerçek cihazlarda iki ayrı gerçek test hesabıyla yapılmalıdır. Otomatik reader security testleri bu kontrolün yerine geçmez.

## Hazırlık

- Hesap A ve Hesap B ayrı e-posta adresleriyle giriş yapmış olmalı.
- Mümkünse iki farklı cihaz kullanılmalı; değilse çıkış/giriş sırasında yerel verilerin hesaplar arasında taşınmadığı ayrıca kontrol edilmeli.
- Canlı Supabase migration zinciri güncel olmalı.
- Production/preview build tercih edilmeli.

## 1. Profil gizliliği

1. Hesap A profilini gizli yapar.
2. Hesap B, A'nın profilini takip etmeden açar.
3. Beklenen: gizli içerikler görünmez.
4. B takip isteği yollar.
5. Beklenen: A onaylamadan içerikler görünmez.
6. A isteği kabul eder.
7. Beklenen: B izin verilen profil içeriklerini görebilir.

## 2. Engelleme izolasyonu

1. Hesap A, Hesap B'yi engeller.
2. B, A'nın profilini, gönderisini veya doğrudan içerik bağlantısını açmayı dener.
3. Beklenen: içerik/profil erişimi engellenir veya güvenli boş durum gösterilir.
4. A'nın ana akışında B'nin içerikleri görünmemelidir.
5. B'nin ana akışında A'nın içerikleri görünmemelidir.
6. Mesajlaşma yüzeyinde yeni etkileşim başlatılamamalıdır.
7. A engeli kaldırır.
8. Beklenen: normal erişim, diğer gizlilik kurallarına bağlı olarak geri gelir.

## 3. Hesaplar arası yerel veri izolasyonu

1. Hesap A'da raf, profil ve geçici uygulama verileri oluşturulur.
2. A çıkış yapar; Hesap B giriş yapar.
3. Beklenen: A'ya ait raf/profil/kişisel durum B hesabında görünmez.
4. B çıkış yapar; A tekrar giriş yapar.
5. Beklenen: A'nın sunucu tarafındaki verileri doğru hesaba geri gelir; B'nin verileri karışmaz.

## 4. İçerik sahipliği

1. A bir gönderi/inceleme/alıntı oluşturur.
2. B içeriği açar.
3. Beklenen: B'de düzenleme/silme sahibi kontrolleri görünmez ve doğrudan yazma işlemi reddedilir.
4. A aynı içeriği açar.
5. Beklenen: sahip düzenleme/silme kontrolleri çalışır.

## 5. Topluluk izinleri

1. A bir topluluk yöneticisi, B normal üye olacak şekilde test edilir.
2. Beklenen: B admin üye yönetimi işlemlerini yapamaz.
3. A'nın üye rolü değiştirme/çıkarma işlemleri çalışır.
4. Özel toplulukta davetsiz hesap erişimi ve davet kabul/red akışı ayrıca doğrulanır.

## 6. Bildirim ve yönlendirme

1. B, A'nın içeriğiyle izin verilen bir etkileşim yapar.
2. A ilgili bildirimi açar.
3. Beklenen: bildirim doğru içeriğe/profil yüzeyine gider.
4. Engel veya gizlilik durumu sonradan değişmişse eski bildirim yetkiyi aşarak içerik göstermemelidir.

## 7. Hata ve ağ davranışı

1. Cihazlardan birinde ağ kısa süre kapatılır.
2. Beklenen: uygulama çökmez, global ağ durumu görünür ve yeniden deneme çalışır.
3. Ağ geri geldiğinde ekranlar tekrar veri çekebilir.

## Geçme kriteri

60/80 yalnızca yukarıdaki senaryolar iki gerçek hesapla tamamlandığında ve yetkisiz veri görünümü/yazımı tespit edilmediğinde tamamlanmış sayılır. Herhangi bir erişim sızıntısı, hesaplar arası veri karışması veya sahiplik ihlali release blocker'dır.
