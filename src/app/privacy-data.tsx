import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AdPrivacyPreferences from '@/components/AdPrivacyPreferences';
import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type DataSummary = {
  email: string;
  userId: string;
  username: string;
  posts: number;
  reviews: number;
  quotes: number;
  comments: number;
  savedPosts: number;
  savedWorks: number;
  blockedUsers: number;
  readingBooks: number;
};

const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || null;
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || null;

const EMPTY_SUMMARY: DataSummary = {
  email: '',
  userId: '',
  username: 'Kitap Okuru',
  posts: 0,
  reviews: 0,
  quotes: 0,
  comments: 0,
  savedPosts: 0,
  savedWorks: 0,
  blockedUsers: 0,
  readingBooks: 0,
};

type CountTable = 'posts' | 'reviews' | 'quotes' | 'comments' | 'saved_posts' | 'saved_works' | 'user_blocks' | 'user_book_status';

async function countRows(table: CountTable, column: string, userId: string) {
  const { count, error } = await (supabase
    .from(table) as any)
    .select('id', { count: 'exact', head: true })
    .eq(column, userId);

  if (error) {
    console.warn(`${table} sayımı alınamadı:`, error.message);
    return 0;
  }

  return count ?? 0;
}

export default function PrivacyDataScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [summary, setSummary] = useState<DataSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const [
        profileResult,
        posts,
        reviews,
        quotes,
        comments,
        savedPosts,
        savedWorks,
        blockedUsers,
        readingBooks,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle(),
        countRows('posts', 'user_id', user.id),
        countRows('reviews', 'user_id', user.id),
        countRows('quotes', 'user_id', user.id),
        countRows('comments', 'user_id', user.id),
        countRows('saved_posts', 'user_id', user.id),
        countRows('saved_works', 'user_id', user.id),
        countRows('user_blocks', 'blocker_id', user.id),
        countRows('user_book_status', 'user_id', user.id),
      ]);

      setSummary({
        email: user.email ?? '',
        userId: user.id,
        username: profileResult.data?.username ?? 'Kitap Okuru',
        posts,
        reviews,
        quotes,
        comments,
        savedPosts,
        savedWorks,
        blockedUsers,
        readingBooks,
      });
    } catch (error) {
      console.error('Gizlilik ve veri özeti yüklenemedi:', error);
      Alert.alert('Hata', 'Hesap verilerin yüklenemedi. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  const exportPayload = useMemo(
    () => ({
      exported_at: new Date().toISOString(),
      account: {
        user_id: summary.userId,
        email: summary.email,
        username: summary.username,
      },
      data_summary: {
        posts: summary.posts,
        reviews: summary.reviews,
        quotes: summary.quotes,
        comments: summary.comments,
        saved_posts: summary.savedPosts,
        saved_works: summary.savedWorks,
        blocked_users: summary.blockedUsers,
        shelf_books: summary.readingBooks,
      },
    }),
    [summary]
  );

  async function exportDataSummary() {
    setExporting(true);
    try {
      await Share.share({
        title: 'Hesap veri özetim',
        message: JSON.stringify(exportPayload, null, 2),
      });
    } catch (error) {
      console.error('Veri özeti paylaşılamadı:', error);
      Alert.alert('Hata', 'Veri özeti dışa aktarılamadı.');
    } finally {
      setExporting(false);
    }
  }

  function stat(label: string, value: number) {
    return (
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => safeBack(router, '/privacy-settings')}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
          >
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Gizlilik ve Verilerim</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.description}>
          Hesabınla ilişkili temel veri özetini gör, bildirim ve engelleme ayarlarını yönet veya veri özetini dışa aktar.
        </Text>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Hesap verileri yükleniyor...</Text>
          </View>
        ) : (
          <>
            <View style={styles.accountCard}>
              <View style={styles.accountIcon}>
                <Feather name="shield" size={22} color={colors.primary} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{summary.username}</Text>
                <Text style={styles.accountEmail}>{summary.email || 'E-posta bilgisi yok'}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Veri özeti</Text>
            <View style={styles.statsGrid}>
              {stat('Gönderi', summary.posts)}
              {stat('İnceleme', summary.reviews)}
              {stat('Alıntı', summary.quotes)}
              {stat('Yorum', summary.comments)}
              {stat('Kaydedilen gönderi', summary.savedPosts)}
              {stat('Kaydedilen eser', summary.savedWorks)}
              {stat('Engellenen hesap', summary.blockedUsers)}
              {stat('Rafındaki kitap', summary.readingBooks)}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Gizlilik ve destek</Text>

        {PRIVACY_POLICY_URL ? (
          <Pressable
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            style={styles.actionCard}
            accessibilityRole="link"
            accessibilityLabel="Gizlilik Politikasını aç"
          >
            <View style={styles.actionIcon}>
              <Feather name="shield" size={20} color={colors.primary} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Gizlilik Politikası</Text>
              <Text style={styles.actionDescription}>
                Verilerin nasıl işlendiğini ve gizlilik haklarını görüntüle.
              </Text>
            </View>
            <Feather name="external-link" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        {SUPPORT_URL ? (
          <Pressable
            onPress={() => void Linking.openURL(SUPPORT_URL)}
            style={styles.actionCard}
            accessibilityRole="link"
            accessibilityLabel="Destek sayfasını aç"
          >
            <View style={styles.actionIcon}>
              <Feather name="help-circle" size={20} color={colors.primary} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Destek</Text>
              <Text style={styles.actionDescription}>
                Yardım, iletişim ve hesap desteği sayfasını aç.
              </Text>
            </View>
            <Feather name="external-link" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        <AdPrivacyPreferences />

        <Text style={styles.sectionTitle}>Kontroller</Text>

        <Pressable
          onPress={() => router.push('/blocked-users')}
          style={styles.actionCard}
          accessibilityRole="button"
        >
          <View style={styles.actionIcon}>
            <Feather name="user-x" size={20} color={colors.primary} />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Engellenen kullanıcılar</Text>
            <Text style={styles.actionDescription}>Engellediğin hesapları gör ve engelleri kaldır.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/notification-settings')}
          style={styles.actionCard}
          accessibilityRole="button"
        >
          <View style={styles.actionIcon}>
            <Feather name="bell" size={20} color={colors.primary} />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Bildirim tercihleri</Text>
            <Text style={styles.actionDescription}>Hangi bildirim türlerini almak istediğini seç.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={() => void exportDataSummary()}
          disabled={loading || exporting}
          style={[styles.exportButton, (loading || exporting) && styles.disabledButton]}
          accessibilityRole="button"
          accessibilityLabel="Hesap veri özetini dışa aktar"
        >
          <Feather name="share-2" size={18} color={colors.primary} />
          <Text style={styles.exportText}>{exporting ? 'Hazırlanıyor...' : 'Veri Özetimi Dışa Aktar'}</Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Feather name="info" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            Bu ekran tam bir yasal veri arşivi yerine uygulamadaki temel hesap veri özetini sunar. Hesabı kalıcı silme işlemi Profil Ayarları ekranında bulunur.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 48,
  },
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171F',
  },
  headerSpacer: {
    width: 42,
  },
  title: {
    color: '#F5F5F8',
    fontSize: 19,
    fontWeight: '800',
  },
  description: {
    color: '#9A9AAA',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  loadingCard: {
    minHeight: 120,
    borderRadius: 18,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#8E8E9D',
    fontSize: 13,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21182F',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    color: '#F5F5F8',
    fontSize: 16,
    fontWeight: '800',
  },
  accountEmail: {
    color: '#8E8E9D',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#F5F5F8',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    minHeight: 84,
    borderRadius: 16,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
    padding: 14,
    justifyContent: 'center',
  },
  statValue: {
    color: '#A985FF',
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: '#9A9AAA',
    fontSize: 12,
    marginTop: 5,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    borderRadius: 17,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
    padding: 14,
    marginBottom: 10,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21182F',
  },
  actionTextWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  actionTitle: {
    color: '#F5F5F8',
    fontSize: 14,
    fontWeight: '800',
  },
  actionDescription: {
    color: '#8E8E9D',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  exportButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#21182F',
    borderWidth: 1,
    borderColor: '#3B2B50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.55,
  },
  exportText: {
    color: '#A985FF',
    fontSize: 13,
    fontWeight: '800',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#292934',
    backgroundColor: '#111118',
    padding: 14,
    marginTop: 18,
  },
  infoText: {
    flex: 1,
    color: '#8E8E9D',
    fontSize: 12,
    lineHeight: 18,
  },
});
