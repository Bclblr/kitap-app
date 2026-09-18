import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { safeBack } from '@/lib/navigation';
import PremiumBadge from '@/components/PremiumBadge';
import {
  loadCurrentPremiumPlan,
  loadSubscriptionManagementUrl,
  purchasePremiumPlan,
  restorePremiumPurchases,
  RevenueCatStorePlan,
} from '@/lib/revenuecat';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

const BENEFITS = [
  ['slash', 'Reklamsız deneyim', 'Premium aktifken uygulamadaki reklam alanları gösterilmez.'],
  ['bar-chart-2', 'Gelişmiş okuma istatistikleri', 'Okuma alışkanlıklarını daha ayrıntılı raporlarla incele.'],
  ['calendar', 'Aylık ve yıllık raporlar', 'Okuma geçmişini dönemsel özetlerle takip et.'],
  ['target', 'Gelişmiş hedefler', 'Daha ayrıntılı ve kişiselleştirilebilir okuma hedefleri oluştur.'],
  ['user', 'Profil kişiselleştirme', 'Premium tema ve profil seçeneklerine eriş.'],
  ['book-open', 'Gelişmiş raflar', 'Raflarını daha ayrıntılı biçimde düzenle ve kişiselleştir.'],
  ['image', 'Alıntı ve paylaşım kartları', 'Paylaşımlar için ek Premium kart şablonlarını kullan.'],
] as const;

function formatDate(value: string | null) {
  if (!value) return 'Süresiz';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function PremiumScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const premium = usePremium();
  const [monthlyPlan, setMonthlyPlan] = useState<RevenueCatStorePlan | null>(null);
  const [annualPlan, setAnnualPlan] = useState<RevenueCatStorePlan | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState(false);
  const [purchasing, setPurchasing] = useState<'monthly' | 'annual' | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      if (!premium.revenueCat.configured) {
        if (!cancelled) {
          setMonthlyPlan(null);
          setAnnualPlan(null);
          setPlansLoading(false);
        }
        return;
      }

      setPlansLoading(true);
      try {
        const [monthly, annual] = await Promise.all([
          loadCurrentPremiumPlan('monthly'),
          loadCurrentPremiumPlan('annual'),
        ]);

        if (!cancelled) {
          setMonthlyPlan(monthly);
          setAnnualPlan(annual);
          setPlansError(!monthly || !annual);
        }
      } catch (error) {
        console.warn('Premium mağaza planları alınamadı:', error);
        if (!cancelled) {
          setMonthlyPlan(null);
          setAnnualPlan(null);
          setPlansError(true);
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    }

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, [premium.revenueCat.configured]);

  async function handlePurchase(period: 'monthly' | 'annual') {
    if (purchasing) return;

    const plan = period === 'monthly' ? monthlyPlan : annualPlan;
    if (!premium.revenueCat.configured || !plan) {
      Alert.alert(
        'Satın alma kullanılamıyor',
        'Bu cihazda mağaza ürünü henüz hazır değil. RevenueCat anahtarlarını ve mağaza Offering yapılandırmasını kontrol et.'
      );
      return;
    }

    setPurchasing(period);
    try {
      const result = await purchasePremiumPlan(period);
      const synced = await premium.reload();

      Alert.alert(
        'Satın alma tamamlandı',
        synced.isPremium
          ? `${result.plan.priceString} tutarındaki ${period === 'monthly' ? 'aylık' : 'yıllık'} Premium planın etkinleştirildi.`
          : 'Satın alma mağaza tarafından tamamlandı. Premium erişimin sunucuyla eşitleniyor; kısa süre içinde otomatik olarak güncellenecek.'
      );
    } catch (error) {
      const purchaseError = error as { userCancelled?: boolean };
      if (purchaseError.userCancelled) return;

      console.warn('Premium satın alma hatası:', error);
      Alert.alert(
        'Satın alma tamamlanamadı',
        'Mağaza işlemi tamamlanamadı. Bağlantını ve mağaza hesabını kontrol edip tekrar deneyebilirsin.'
      );
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestorePurchases() {
    if (restoring || purchasing) return;

    if (!premium.revenueCat.configured) {
      Alert.alert(
        'Geri yükleme kullanılamıyor',
        'RevenueCat bu cihazda henüz hazır değil. Mağaza ve SDK yapılandırmasını kontrol et.'
      );
      return;
    }

    setRestoring(true);
    try {
      const restored = await restorePremiumPurchases();
      await premium.reload();

      if (restored.premiumEntitlementActive) {
        Alert.alert(
          'Satın alımlar geri yüklendi',
          'RevenueCat Premium satın alımını doğruladı. Sunucu senkronizasyonu tamamlandığında Premium erişimin de güncellenecek.'
        );
      } else {
        Alert.alert(
          'Aktif Premium bulunamadı',
          'Bu mağaza hesabında geri yüklenecek aktif Premium aboneliği bulunamadı.'
        );
      }
    } catch (error) {
      console.warn('Premium geri yükleme hatası:', error);
      Alert.alert(
        'Geri yükleme tamamlanamadı',
        'Satın alımlar şu anda geri yüklenemedi. Bağlantını ve mağaza hesabını kontrol edip tekrar dene.'
      );
    } finally {
      setRestoring(false);
    }
  }

  async function handleManageSubscription() {
    if (!premium.revenueCat.configured) {
      Alert.alert(
        'Abonelik yönetimi kullanılamıyor',
        'Bu cihazda mağaza abonelik bilgisi henüz hazır değil.'
      );
      return;
    }

    try {
      const managementUrl = await loadSubscriptionManagementUrl();

      if (!managementUrl) {
        Alert.alert(
          'Aktif mağaza aboneliği bulunamadı',
          premium.hasAdminPremium
            ? 'Bu hesapta admin tarafından verilen Premium erişimi bulunuyor; mağazada yönetilecek aktif bir abonelik yok.'
            : 'Apple App Store veya Google Play üzerinde yönetilecek aktif bir abonelik bulunamadı.'
        );
        return;
      }

      const supported = await Linking.canOpenURL(managementUrl);
      if (!supported) {
        Alert.alert('Abonelik yönetimi açılamadı', 'Mağaza abonelik yönetim sayfası bu cihazda açılamadı.');
        return;
      }

      await Linking.openURL(managementUrl);
    } catch (error) {
      console.warn('Abonelik yönetimi açılamadı:', error);
      Alert.alert(
        'Abonelik yönetimi açılamadı',
        'Mağaza abonelik yönetim sayfası şu anda açılamadı. Daha sonra tekrar deneyebilirsin.'
      );
    }
  }

  function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals' | '/premium-profile-customization' | '/premium-shelf-customization' | '/premium-quote-cards', message: string) {
    if (!premium.isPremium) {
      Alert.alert('Premium özelliği', message);
      return;
    }
    router.push(path);
  }

  const paidLabel = premium.hasPaidPremium && premium.hasAdminPremium
    ? 'Ücretli + admin Premium'
    : premium.paidSources.includes('apple') && premium.paidSources.includes('google')
      ? 'Apple + Google Play üzerinden Premium'
      : premium.paidSources.includes('apple')
        ? 'Apple üzerinden Premium'
        : premium.paidSources.includes('google')
          ? 'Google Play üzerinden Premium'
          : premium.hasAdminPremium
            ? 'Admin tarafından verilen Premium'
            : 'Premium üyelik';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
            onPress={() => safeBack(router, '/profile-settings')}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Kitap Premium</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.heroBadgeRow}>
            <PremiumBadge size={24} />
            <Text style={[styles.heroEyebrow, { color: colors.primary }]}>PREMIUM</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Okuma deneyimini daha kişisel hale getir.</Text>
          <Text style={[styles.heroBody, { color: colors.textSecondary }]}>Temel sosyal özellikler ücretsiz kalır. Premium; reklamsız kullanım, gelişmiş istatistikler ve kişiselleştirme seçenekleri sunar.</Text>

          <View style={[styles.statusBox, { borderColor: colors.border, backgroundColor: colors.background }]}> 
            <View style={styles.statusTopRow}>
              <Text style={[styles.statusTitle, { color: colors.text }]}> 
                {premium.isPremium ? 'Premium aktif' : 'Ücretsiz hesap'}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: premium.isPremium ? colors.primary : colors.border }]}> 
                <Text style={styles.statusPillText}>{premium.isPremium ? 'AKTİF' : 'FREE'}</Text>
              </View>
            </View>
            <Text style={[styles.statusBody, { color: colors.textSecondary }]}> 
              {premium.isPremium
                ? `${paidLabel} · Erişim bitişi: ${formatDate(premium.nextExpirationAt)}`
                : 'İstediğin zaman Premium plana geçebilirsin.'}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Premium avantajları</Text>
        <View style={styles.benefitsList}>
          {BENEFITS.map(([icon, title, description]) => (
            <View key={title} style={[styles.benefitCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={[styles.benefitIcon, { backgroundColor: colors.background }]}> 
                <Feather name={icon} size={19} color={colors.primary} />
              </View>
              <View style={styles.benefitText}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.benefitBody, { color: colors.textSecondary }]}>{description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gelişmiş okuma istatistiklerini aç"
          onPress={() => openPremiumFeature('/premium-reading-stats', 'Gelişmiş okuma istatistikleri aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="bar-chart-2" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Gelişmiş Okuma İstatistikleri</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Son 30 günlük ayrıntılı analizini görüntüle.' : 'Premium ile son 30 günlük ayrıntılı analizini aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yıllık okuma raporunu aç"
          onPress={() => openPremiumFeature('/premium-year-report', 'Yıllık Okuma Raporu aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="calendar" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Yıllık Okuma Raporu</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Bu yılın okuma özetini ve aylık dağılımını görüntüle.' : 'Premium ile yıllık okuma raporunu aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gelişmiş okuma hedeflerini aç"
          onPress={() => openPremiumFeature('/premium-reading-goals', 'Gelişmiş okuma hedefleri aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="target" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Gelişmiş Okuma Hedefleri</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Haftalık, aylık, yıllık ve seri hedeflerini yönet.' : 'Premium ile uzun dönemli okuma hedeflerini aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Premium profil kişiselleştirmeyi aç"
          onPress={() => openPremiumFeature('/premium-profile-customization', 'Profil temaları ve kişiselleştirme aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="user" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Profil Kişiselleştirme</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Tema, düzen, profil vurgusu ve Premium çerçeveni yönet.' : 'Premium ile özel profil temalarını aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Premium raf kişiselleştirmeyi aç"
          onPress={() => openPremiumFeature('/premium-shelf-customization', 'Raf kişiselleştirme aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="book-open" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Raf Kişiselleştirme</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Raf adlarını, görünümünü ve vurgu rengini yönet.' : 'Premium ile raf görünümünü kişiselleştir.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Premium alıntı kartlarını aç"
          onPress={() => openPremiumFeature('/premium-quote-cards', 'Premium alıntı kartları aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="image" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Alıntı ve Paylaşım Kartları</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Editoryal, Gece ve Minimal kart şablonlarını kullan.' : 'Premium ile özel alıntı kartı şablonlarını aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Planını seç</Text>
        {plansError && !plansLoading ? (
          <View style={[styles.planErrorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={18} color={colors.primary} />
            <Text style={[styles.planErrorText, { color: colors.textSecondary }]}>
              Mağaza planları şu anda yüklenemedi. Uygulamayı yeniden açtığında tekrar denenecek.
            </Text>
          </View>
        ) : null}

        <View style={styles.planGrid}>
          <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.planName, { color: colors.text }]}>Aylık</Text>
            <Text style={[styles.pricePlaceholder, { color: colors.primary }]}> 
              {plansLoading ? 'Fiyat yükleniyor…' : monthlyPlan?.priceString ?? 'Mağaza fiyatı'}
            </Text>
            <Text style={[styles.planCaption, { color: colors.textSecondary }]}>Her ay yenilenir. Fiyat mağazadan alınır.</Text>
            <Pressable
              disabled={purchasing !== null || plansLoading || !monthlyPlan}
              onPress={() => void handlePurchase('monthly')}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                (purchasing !== null || plansLoading || !monthlyPlan) && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {purchasing === 'monthly' ? 'İşleniyor…' : 'Aylık Premium'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.planCard, styles.highlightedPlan, { backgroundColor: colors.surface, borderColor: colors.primary }]}> 
            <View style={[styles.recommendedPill, { backgroundColor: colors.primary }]}> 
              <Text style={styles.recommendedText}>ÖNERİLEN</Text>
            </View>
            <Text style={[styles.planName, { color: colors.text }]}>Yıllık</Text>
            <Text style={[styles.pricePlaceholder, { color: colors.primary }]}> 
              {plansLoading ? 'Fiyat yükleniyor…' : annualPlan?.priceString ?? 'Mağaza fiyatı'}
            </Text>
            <Text style={[styles.planCaption, { color: colors.textSecondary }]}>Yıllık plan. Gerçek fiyat ve varsa indirim mağazadan alınır.</Text>
            <Pressable
              disabled={purchasing !== null || plansLoading || !annualPlan}
              onPress={() => void handlePurchase('annual')}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                (purchasing !== null || plansLoading || !annualPlan) && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {purchasing === 'annual' ? 'İşleniyor…' : 'Yıllık Premium'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.actionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Pressable
            disabled={restoring || purchasing !== null}
            onPress={() => void handleRestorePurchases()}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border },
              (restoring || purchasing !== null) && styles.disabledButton,
            ]}
          > 
            <Feather name="refresh-cw" size={17} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {restoring ? 'Geri yükleniyor…' : 'Satın alımları geri yükle'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void handleManageSubscription()} style={[styles.secondaryButton, { borderColor: colors.border }]}> 
            <Feather name="settings" size={17} color={colors.text} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Aboneliği yönet</Text>
          </Pressable>
          <Text style={[styles.legalNote, { color: colors.textSecondary }]}>Satın alma, yenileme ve iptal koşulları Apple App Store veya Google Play tarafından yönetilir. Uygulama içinde sabit fiyat gösterilmez.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 56 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  hero: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroEyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 27, lineHeight: 33, fontWeight: '900' },
  heroBody: { fontSize: 14, lineHeight: 21 },
  statusBox: { marginTop: 4, borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  statusTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  statusBody: { fontSize: 13, lineHeight: 18 },
  sectionTitle: { marginTop: 26, marginBottom: 12, fontSize: 18, fontWeight: '900' },
  benefitsList: { gap: 10 },
  benefitCard: { borderWidth: 1, borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  benefitIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  benefitText: { flex: 1, gap: 3 },
  benefitTitle: { fontSize: 14, fontWeight: '800' },
  benefitBody: { fontSize: 13, lineHeight: 18 },
  featureAction: { marginTop: 12, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureActionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureActionText: { flex: 1, gap: 3 },
  featureActionTitle: { fontSize: 14, fontWeight: '900' },
  featureActionBody: { fontSize: 12, lineHeight: 17 },
  planGrid: { gap: 12 },
  planErrorCard: { marginBottom: 12, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  planErrorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  planCard: { borderWidth: 1, borderRadius: 20, padding: 17, gap: 9, overflow: 'hidden' },
  highlightedPlan: { borderWidth: 2 },
  recommendedPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  recommendedText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  planName: { fontSize: 20, fontWeight: '900' },
  pricePlaceholder: { fontSize: 17, fontWeight: '800' },
  planCaption: { fontSize: 13, lineHeight: 18 },
  primaryButton: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  actionsCard: { marginTop: 18, borderWidth: 1, borderRadius: 20, padding: 14, gap: 10 },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontSize: 14, fontWeight: '800' },
  legalNote: { fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 4, marginTop: 2 },
});