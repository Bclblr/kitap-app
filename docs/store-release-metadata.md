# Store Release Metadata

This file is the canonical checklist for App Store Connect and Google Play Console.
Do not publish with placeholder domains or test payment/ad identifiers.

## Identity

- App name: Kitap
- iOS bundle identifier: com.burukancelebiler.kitapapp
- Android package: com.burukancelebiler.kitapapp
- URL scheme: kitapapp
- Suggested primary store category: Books
- Suggested secondary App Store category: Social Networking

## Short listing copy

### App Store subtitle

Kitaplarını keşfet, paylaş

### Google Play short description

Kitaplarını keşfet, oku; inceleme, alıntı ve okuma deneyimini toplulukla paylaş.

## Full description

Kitap, okuma deneyimini tek yerde toplamak için tasarlanmış bir kitap ve okur topluluğu uygulamasıdır.

Kitapları keşfedebilir, okuma durumunu ve raflarını düzenleyebilir, inceleme ve alıntı paylaşabilir, diğer okurları takip edebilir ve kitaplar etrafında topluluklara katılabilirsin.

Öne çıkan özellikler:

- Kitap keşfetme ve kişiselleştirilmiş öneriler
- Okuma rafları ve okuma durumu takibi
- İnceleme ve alıntı paylaşımı
- Gönderiler, yorumlar, beğeniler ve yeniden paylaşım
- Hikâyeler
- Okur profilleri ve takip sistemi
- Topluluklar ve etkinlikler
- Mesajlaşma
- Gizlilik, engelleme ve hesap silme kontrolleri
- İsteğe bağlı Premium özellikler

Premium, temel okuma ve topluluk özelliklerini kaldırmaz. Premium avantajları uygulama içinde açıkça gösterilir ve desteklenen mağaza abonelikleri üzerinden yönetilir.

## Premium listing copy

### Monthly Premium

Kitap Premium aylık abonelik. Premium kişiselleştirme, gelişmiş okuma istatistikleri, özel raf ve profil seçenekleri ve desteklenen diğer Premium özelliklere erişim sağlar.

### Annual Premium

Kitap Premium yıllık abonelik. Premium kişiselleştirme, gelişmiş okuma istatistikleri, özel raf ve profil seçenekleri ve desteklenen diğer Premium özelliklere erişim sağlar.

Store product names, prices, renewal terms and trial text must come from App Store Connect / Google Play Console and must match the RevenueCat offering shown in the app.

## Required public URLs

Production EAS configuration must define both of these real HTTPS URLs:

- EXPO_PUBLIC_PRIVACY_POLICY_URL
- EXPO_PUBLIC_SUPPORT_URL

The privacy policy must describe the app's actual collection, use, sharing, retention and deletion of user/device data, including relevant third-party SDKs and services.

The support URL must be publicly accessible and provide a usable support/contact path.

## Privacy and account controls

Before submission verify that:

- Privacy Policy is reachable from the store listing.
- Privacy Policy is reachable inside the app from Gizlilik ve Verilerim.
- Support URL is reachable from the store listing and the app.
- Account deletion works from the app.
- Store privacy/Data Safety answers match the production app and third-party SDKs.
- Advertising disclosures match the production AdMob configuration.
- Subscription disclosures match the production RevenueCat products.

## Age / content rating

Do not hard-code or guess an age rating in this repository.

- Google Play: complete the official IARC content-rating questionnaire and publish the resulting rating.
- Apple: complete the App Store Connect age-rating questionnaire using the app's actual user-generated content, messaging, community, web access, purchase and advertising behavior.
- Re-run the questionnaires if features or content exposure materially change.

## Screenshots

Capture final screenshots only from release-candidate builds. At minimum cover:

- Home/feed
- Explore/book discovery
- Book detail
- Review or quote
- Shelves
- Profile
- Community
- Premium screen

Do not use mock payment states or test-ad screenshots as production store imagery.

## External setup still required

The following cannot be completed only from source control:

- Publish the real Privacy Policy page.
- Publish the real Support page.
- Enter URLs in App Store Connect and Play Console.
- Complete Apple App Privacy answers.
- Complete Google Play Data Safety.
- Complete store content/age-rating questionnaires.
- Upload final screenshots and store imagery.
- Configure final subscription products/prices.
- Verify store text against the release candidate before submission.
