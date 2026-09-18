import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { safeBack } from '@/lib/navigation';
import Image from '@/components/SafeImage';
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type AuthorRow = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  pen_name: string | null;
  verified: boolean;
  featured: boolean;
  priority: number;
  work_count: number;
  published_work_count: number;
  draft_work_count: number;
  last_work_updated_at: string | null;
};

export default function AdminAuthorsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [penNames, setPenNames] = useState<Record<string, string>>({});

  const loadAuthors = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canManageUsers) {
        router.replace('/admin');
        return;
      }

      const { data, error } = await supabase.rpc('admin_list_authors', {
        p_search: '',
        p_limit: 200,
      });
      if (error) throw error;

      const rows: AuthorRow[] = (Array.isArray(data) ? data : []).map((row: any) => ({
        user_id: String(row.user_id ?? ''),
        username: typeof row.username === 'string' ? row.username : null,
        full_name: typeof row.full_name === 'string' ? row.full_name : null,
        profile_image: typeof row.profile_image === 'string' ? row.profile_image : null,
        pen_name: typeof row.pen_name === 'string' ? row.pen_name : null,
        verified: row.verified === true,
        featured: row.featured === true,
        priority: Number(row.priority) || 0,
        work_count: Number(row.work_count) || 0,
        published_work_count: Number(row.published_work_count) || 0,
        draft_work_count: Number(row.draft_work_count) || 0,
        last_work_updated_at: typeof row.last_work_updated_at === 'string' ? row.last_work_updated_at : null,
      }));

      setAuthors(rows);
      setPenNames(Object.fromEntries(rows.map((row) => [row.user_id, row.pen_name ?? ''])));
    } catch (error) {
      console.error('Yazarlar yüklenemedi:', error);
      Alert.alert('Hata', 'Yazarlar yüklenemedi. SQL migration dosyasının çalıştırıldığından emin ol.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadAuthors();
    }, [loadAuthors])
  );

  const filteredAuthors = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return authors;
    return authors.filter((author) =>
      [author.username, author.full_name, author.pen_name, author.user_id]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(needle))
    );
  }, [authors, query]);

  async function saveAuthor(author: AuthorRow, patch: Partial<Pick<AuthorRow, 'verified' | 'featured' | 'priority'>>) {
    setSavingId(author.user_id);
    try {
      const next = { ...author, ...patch };
      const { error } = await supabase.rpc('admin_set_author_profile', {
        p_user_id: author.user_id,
        p_pen_name: penNames[author.user_id] ?? '',
        p_verified: next.verified,
        p_featured: next.featured,
        p_priority: next.priority,
      });
      if (error) throw error;

      setAuthors((current) =>
        current.map((item) =>
          item.user_id === author.user_id
            ? { ...next, pen_name: (penNames[author.user_id] ?? '').trim() || null }
            : item
        )
      );
    } catch (error) {
      console.error('Yazar güncellenemedi:', error);
      Alert.alert('Hata', 'Yazar bilgileri güncellenemedi.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Yazarlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => safeBack(router, '/admin')} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>Yazarlar</Text>
          </View>
          <Pressable onPress={() => void loadAuthors()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{authors.length.toLocaleString('tr-TR')}</Text>
          <Text style={styles.summaryLabel}>Eser yayımlamış kullanıcı</Text>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kullanıcı adı, yazar adı veya UUID ara"
            placeholderTextColor="#747483"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.list}>
          {filteredAuthors.map((author) => {
            const disabled = savingId === author.user_id;
            return (
              <View key={author.user_id} style={styles.card}>
                <View style={styles.authorHeader}>
                  {author.profile_image ? (
                    <Image source={{ uri: author.profile_image }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Feather name="edit-3" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.authorCopy}>
                    <Text style={styles.authorName}>{author.pen_name || author.full_name || author.username || 'Yazar'}</Text>
                    <Text style={styles.username}>@{author.username || 'kullanici'}</Text>
                  </View>
                  {author.verified ? (
                    <View style={styles.verifiedBadge}>
                      <Feather name="check" size={12} color="#D9CCFF" />
                      <Text style={styles.verifiedText}>Doğrulandı</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.statsRow}>
                  <Text style={styles.statText}>{author.work_count} eser</Text>
                  <Text style={styles.statText}>{author.published_work_count} yayında</Text>
                  <Text style={styles.statText}>{author.draft_work_count} taslak</Text>
                </View>

                <TextInput
                  value={penNames[author.user_id] ?? ''}
                  onChangeText={(value) => setPenNames((current) => ({ ...current, [author.user_id]: value }))}
                  placeholder="Yazar / mahlas adı"
                  placeholderTextColor="#747483"
                  style={styles.penInput}
                />

                <View style={styles.actionsRow}>
                  <Pressable
                    disabled={disabled}
                    onPress={() => void saveAuthor(author, { verified: !author.verified })}
                    style={[styles.actionButton, author.verified && styles.actionButtonActive]}
                  >
                    <Text style={[styles.actionText, author.verified && styles.actionTextActive]}>
                      {author.verified ? 'Doğrulamayı kaldır' : 'Doğrula'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={disabled}
                    onPress={() => void saveAuthor(author, { featured: !author.featured })}
                    style={[styles.actionButton, author.featured && styles.actionButtonActive]}
                  >
                    <Text style={[styles.actionText, author.featured && styles.actionTextActive]}>
                      {author.featured ? 'Öne çıkıyor' : 'Öne çıkar'}
                    </Text>
                  </Pressable>

                  <Pressable disabled={disabled} onPress={() => void saveAuthor(author, {})} style={styles.saveButton}>
                    <Text style={styles.saveText}>Adı kaydet</Text>
                  </Pressable>
                </View>

                <View style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>Öncelik: {author.priority}</Text>
                  <View style={styles.priorityActions}>
                    <Pressable disabled={disabled} onPress={() => void saveAuthor(author, { priority: author.priority - 1 })} style={styles.iconButton}>
                      <Feather name="minus" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable disabled={disabled} onPress={() => void saveAuthor(author, { priority: author.priority + 1 })} style={styles.iconButton}>
                      <Feather name="plus" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {filteredAuthors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="edit-3" size={24} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Yazar bulunamadı</Text>
            <Text style={styles.emptyText}>Henüz eser yayımlamış kullanıcı olmayabilir.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0E' },
  loadingText: { marginTop: 12, color: '#A5A5B3', fontSize: 14 },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  summaryCard: { padding: 16, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  summaryValue: { color: '#F5F5F8', fontSize: 22, fontWeight: '900' },
  summaryLabel: { marginTop: 3, color: '#8E8E9D', fontSize: 12 },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934', marginBottom: 12 },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  list: { gap: 10 },
  card: { padding: 14, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934' },
  authorHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20202A' },
  authorCopy: { flex: 1, marginLeft: 11 },
  authorName: { color: '#F5F5F8', fontSize: 15, fontWeight: '800' },
  username: { marginTop: 2, color: '#8E8E9D', fontSize: 12 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2B1E3E', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  verifiedText: { color: '#D9CCFF', fontSize: 10, fontWeight: '800' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statText: { color: '#A5A5B3', fontSize: 11, backgroundColor: '#101017', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  penInput: { marginTop: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#30303D', backgroundColor: '#0F0F15', paddingHorizontal: 12, color: '#F5F5F8' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#30303D', backgroundColor: '#101017' },
  actionButtonActive: { borderColor: '#60458A', backgroundColor: '#2B1E3E' },
  actionText: { color: '#A5A5B3', fontSize: 11, fontWeight: '700' },
  actionTextActive: { color: '#D9CCFF' },
  saveButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#6C3CC5' },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  priorityRow: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#292934', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityLabel: { color: '#8E8E9D', fontSize: 11 },
  priorityActions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#30303D', backgroundColor: '#101017' },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
