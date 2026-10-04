import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const sections = [
  {
    title: '1. Kapsam',
    body:
      'Bu Gizlilik Politikası, CROOVA mobil uygulaması ve CROOVA’nın web sürümü için geçerlidir. CROOVA bir kitap keşif, okuma takibi ve sosyal paylaşım platformudur. Bu politika; hangi verilerin işlendiğini, neden işlendiğini, kimlerle paylaşılabileceğini, nasıl korunduğunu ve kullanıcıların verileri üzerindeki haklarını açıklar.',
  },
  {
    title: '2. İşlenen veriler',
    body:
      'Hesap oluştururken e-posta adresi, kullanıcı adı ve hesap kimliği gibi hesap bilgileri işlenebilir. Profil fotoğrafı, biyografi, raflar, okuma durumları, kitap değerlendirmeleri, alıntılar, notlar, gönderiler, hikâyeler, yorumlar, beğeniler, takip ilişkileri ve topluluk/event içerikleri gibi kullanıcının kendi oluşturduğu içerikler de işlenebilir. Kullanıcı tarafından yüklenen fotoğraf, kapak veya diğer medya dosyaları da ilgili özelliğin çalışması için işlenebilir.',
  },
  {
    title: '3. Kitap ve akademik çalışma verileri',
    body:
      'Kullanıcının aradığı, görüntülediği veya rafına eklediği kitaplara ilişkin kitap kimliği, başlık, yazar, kapak ve benzeri katalog bilgileri işlenebilir. Akademik çalışma özelliklerinde çalışma, yazar ve kurum bilgileri ile kullanıcının okuma durumu, notları ve ilgili etkileşimleri işlenebilir. Harici kitap/katalog servislerinden alınan veriler, ilgili özelliğin sunulması amacıyla kullanılabilir.',
  },
  {
    title: '4. Cihaz, teknik ve kullanım verileri',
    body:
      'Uygulamanın güvenli ve düzgün çalışması için cihaz türü, işletim sistemi, uygulama sürümü, hata ve performans bilgileri, ağ bağlantısı durumu, bildirim belirteci ve benzeri teknik veriler işlenebilir. Ürün analitiği ve performans ölçümü için uygulama açılışı, sayfa/özellik kullanımı ve benzeri olaylar işlenebilir. Bu veriler hizmetin geliştirilmesi, güvenliğinin sağlanması ve teknik sorunların giderilmesi amacıyla kullanılır.',
  },
  {
    title: '5. Reklam ve Premium hizmetleri',
    body:
      'CROOVA reklam gösterimi için Google Mobile Ads gibi üçüncü taraf reklam teknolojilerini kullanabilir. Bu teknolojiler kendi politikaları kapsamında reklam ölçümü, dolandırıcılık önleme ve kişiselleştirme amacıyla cihaz veya reklam tanımlayıcıları gibi verileri işleyebilir. Premium aboneliklerde satın alma ve abonelik durumunun doğrulanması için uygulama mağazaları ve abonelik yönetimi sağlayıcıları kullanılabilir. Ödeme kartı bilgileriniz CROOVA tarafından saklanmaz.',
  },
  {
    title: '6. Verilerin paylaşılması',
    body:
      'CROOVA, verileri satmaz. Hizmetin çalışması için gerekli olduğunda veriler; bulut veritabanı ve depolama altyapısı sağlayıcıları, kimlik doğrulama ve bildirim hizmetleri, reklam sağlayıcıları, abonelik yönetimi ve uygulama mağazası sağlayıcıları gibi hizmet sağlayıcılarla paylaşılabilir. Kullanıcının herkese açık olarak yayınladığı içerikler, CROOVA üzerindeki diğer kullanıcılar tarafından görülebilir. Yasal bir zorunluluk bulunması veya güvenlik ve kötüye kullanımın önlenmesi gerektiğinde yetkili makamlarla gerekli bilgiler paylaşılabilir.',
  },
  {
    title: '7. Veri güvenliği',
    body:
      'CROOVA, verilerin yetkisiz erişime, kayba ve kötüye kullanıma karşı korunması için erişim kontrolleri, güvenli bağlantılar, kimlik doğrulama ve sunucu tarafı güvenlik kuralları gibi uygun teknik ve idari önlemler kullanır. Buna rağmen internet üzerinden yapılan hiçbir veri aktarımının mutlak olarak risksiz olduğu garanti edilemez.',
  },
  {
    title: '8. Saklama ve silme',
    body:
      'Hesap ve hesapla bağlantılı veriler, hizmetin sunulması için gerekli olduğu sürece saklanır. Kullanıcı hesabını sildiğinde, hesabına bağlı kişisel veriler ve kullanıcı içerikleri uygulanabilir silme süreçleri kapsamında kalıcı olarak silinir veya anonimleştirilir. Yasal olarak saklanması gereken kayıtlar ilgili yasal süre boyunca tutulabilir. Bazı teknik yedeklerin tamamen temizlenmesi makul bir süre alabilir.',
  },
  {
    title: '9. Hesap silme',
    body:
      'Hesap oluşturabilen kullanıcılar hesaplarını web üzerinden de silebilir. Hesap silme sayfasına aşağıdaki bağlantıdan ulaşabilirsiniz. Silme işlemi kimlik doğrulaması gerektirir ve geri alınamaz.',
  },
  {
    title: '10. Çocukların gizliliği',
    body:
      'CROOVA çocukları hedefleyen bir uygulama değildir. Uygulamanın hedef kitlesi ve Google Play’deki yaş beyanları, uygulamanın gerçek özellikleri ve yürürlükteki mağaza politikalarıyla uyumlu şekilde yönetilir. Bir çocuğa ait verinin uygun olmayan şekilde işlendiğini düşünüyorsanız, uygulama içindeki gizlilik ve destek kanallarından bildirimde bulunabilirsiniz.',
  },
  {
    title: '11. Kullanıcı hakları',
    body:
      'Kullanıcılar, yürürlükteki mevzuat kapsamında kendileriyle ilgili kişisel verilere ilişkin bilgi isteme, düzeltme, silme, işlemeye itiraz etme ve kanunun izin verdiği diğer haklarını kullanabilir. Talebin doğrulanması ve yerine getirilmesi için ek bilgi istenebilir.',
  },
  {
    title: '12. Politika değişiklikleri',
    body:
      'CROOVA’nın özellikleri veya veri işleme yöntemleri değiştikçe bu Gizlilik Politikası güncellenebilir. Güncel sürüm bu sayfada yayımlanır ve önemli değişikliklerde uygun uygulama içi bildirimler yapılabilir.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>CROOVA</Text>
        <Text style={styles.title}>Gizlilik Politikası</Text>
        <Text style={styles.updated}>Son güncelleme: 4 Ekim 2026</Text>

        <Text style={styles.intro}>
          CROOVA, kullanıcıların kitap keşfetmesine, okuma süreçlerini takip etmesine
          ve topluluk içinde içerik paylaşmasına olanak sağlayan bir platformdur.
          Gizliliğinizi korumak ve verilerinizin nasıl işlendiğini açıkça anlatmak
          bizim için önemlidir.
        </Text>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.heading}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.deletionBox}>
          <Text style={styles.deletionTitle}>Hesabınızı ve verilerinizi silin</Text>
          <Text style={styles.deletionText}>
            Hesap oluşturduysanız hesabınızı ve hesabınıza bağlı verileri web üzerinden
            silme talebi oluşturabilirsiniz.
          </Text>
          <Link href="/account-deletion" style={styles.link}>
            Hesap ve Veri Silme Sayfası
          </Link>
        </View>

        <Text style={styles.footer}>
          Bu sayfa CROOVA’nın Google Play mağaza girişi ve uygulama içi gizlilik
          bilgilendirmesi için kullanılan resmi gizlilik politikasıdır.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#09090D',
  },
  card: {
    width: '100%',
    maxWidth: 820,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#111116',
    borderWidth: 1,
    borderColor: '#2B2B35',
  },
  eyebrow: {
    color: '#A985FF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    marginTop: 6,
    color: '#F7F7FA',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  updated: {
    marginTop: 8,
    color: '#8E8E98',
    fontSize: 13,
  },
  intro: {
    marginTop: 22,
    color: '#D5D5DC',
    fontSize: 15,
    lineHeight: 24,
  },
  section: {
    marginTop: 24,
  },
  heading: {
    color: '#F1F1F5',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  body: {
    color: '#C4C4CC',
    fontSize: 14,
    lineHeight: 23,
  },
  deletionBox: {
    marginTop: 28,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6232B5',
    backgroundColor: '#17121F',
  },
  deletionTitle: {
    color: '#F4F0FF',
    fontSize: 17,
    fontWeight: '900',
  },
  deletionText: {
    marginTop: 8,
    color: '#C8C0D8',
    fontSize: 14,
    lineHeight: 22,
  },
  link: {
    display: 'inline-block',
    marginTop: 12,
    color: '#B999FF',
    fontSize: 14,
    fontWeight: '900',
  },
  footer: {
    marginTop: 28,
    color: '#777781',
    fontSize: 12,
    lineHeight: 19,
  },
});
