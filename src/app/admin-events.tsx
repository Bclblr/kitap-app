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
import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  image_url: string | null;
  created_by: string | null;
  owner_username: string;
  attendee_count: number;
  featured: boolean;
  priority: number;
  hidden: boolean;
  cancelled: boolean;
  note: string | null;
};

type EventAttendee = {
  user_id: string;
  username: string;
  full_name: string | null;
  profile_image: string | null;
};

export default function AdminEventsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [items, setItems] = useState<EventRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Record<string, EventAttendee[]>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canOpenAdmin) {
        router.replace('/');
        return;
      }

      setCanManage(access.role === 'admin' || access.role === 'super_admin');

      const { data, error } = await supabase.rpc('admin_list_events', {
        p_search: query.trim(),
        p_limit: 150,
      });
      if (error) throw error;

      const rows: EventRow[] = (Array.isArray(data) ? data : []).map((row: any) => ({
        id: String(row.id),
        title: String(row.title ?? 'Etkinlik'),
        description: typeof row.description === 'string' ? row.description : null,
        event_date: String(row.event_date ?? ''),
        location: typeof row.location === 'string' ? row.location : null,
        image_url: typeof row.image_url === 'string' ? row.image_url : null,
        created_by: row.created_by ? String(row.created_by) : null,
        owner_username: String(row.owner_username ?? 'Kitap Okuru'),
        attendee_count: Number(row.attendee_count) || 0,
        featured: row.featured === true,
        priority: Number(row.priority) || 0,
        hidden: row.hidden === true,
        cancelled: row.cancelled === true,
        note: typeof row.note === 'string' ? row.note : null,
      }));

      setItems(rows);
      setNoteDrafts((current) => {
        const next = { ...current };
        rows.forEach((row) => {
          if (!(row.id in next)) next[row.id] = row.note ?? '';
        });
        return next;
      });
    } catch (error) {
      console.error('Etkinlik yönetimi yüklenemedi:', error);
      Alert.alert('Hata', 'Etkinlikler yüklenemedi. SQL migrationını çalıştırdığından emin ol.');
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  const summary = useMemo(() => {
    const now = Date.now();
    return {
      total: items.length,
      upcoming: items.filter((item) => new Date(item.event_date).getTime() >= now).length,
      featured: items.filter((item) => item.featured).length,
      flagged: items.filter((item) => item.hidden || item.cancelled).length,
    };
  }, [items]);

  async function updateControl(
    item: EventRow,
    patch: Partial<Pick<EventRow, 'featured' | 'priority' | 'hidden' | 'cancelled' | 'note'>>
  ) {
    if (!canManage) {
      Alert.alert('Yetki gerekli', 'Bu işlem için admin yetkisi gerekiyor.');
      return;
    }

    const next = { ...item, ...patch };
    setUpdatingId(item.id);
    try {
      const { error } = await supabase.rpc('admin_set_event_control', {
        p_event_id: item.id,
        p_featured: next.featured,
        p_priority: next.priority,
        p_hidden: next.hidden,
        p_cancelled: next.cancelled,
        p_note: next.note,
      });
      if (error) throw error;

      setItems((current) => current.map((row) => (row.id === item.id ? next : row)));
      setNoteDrafts((current) => ({ ...current, [item.id]: next.note ?? '' }));
    } catch (error) {
      console.error('Etkinlik ayarı güncellenemedi:', error);
      Alert.alert('Hata', 'Etkinlik ayarı güncellenemedi.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleAttendees(item: EventRow) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);
    if (attendees[item.id]) return;

    try {
      const { data, error } = await supabase.rpc('admin_list_event_attendees', {
        p_event_id: item.id,
      });
      if (error) throw error;
      setAttendees((current) => ({
        ...current,
        [item.id]: (Array.isArray(data) ? data : []).map((row: any) => ({
          user_id: String(row.user_id),
          username: String(row.username ?? 'Kitap Okuru'),
          full_name: typeof row.full_name === 'string' ? row.full_name : null,
          profile_image: typeof row.profile_image === 'string' ? row.profile_image : null,
        })),
      }));
    } catch (error) {
      console.error('Etkinlik katılımcıları yüklenemedi:', error);
      Alert.alert('Hata', 'Katılımcılar yüklenemedi.');
    }
  }

  function removeAttendee(item: EventRow, attendee: EventAttendee) {
    if (!canManage) return;

    Alert.alert(
      'Katılımcıyı çıkar',
      `@${attendee.username} bu etkinliğin katılımcı listesinden çıkarılsın mı?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const busyKey = `${item.id}:${attendee.user_id}`;
              setUpdatingId(busyKey);
              try {
                const { error } = await supabase.rpc('admin_remove_event_attendee', {
                  p_event_id: item.id,
                  p_user_id: attendee.user_id,
                });
                if (error) throw error;

                setAttendees((current) => ({
                  ...current,
                  [item.id]: (current[item.id] ?? []).filter(
                    (row) => row.user_id !== attendee.user_id
                  ),
                }));
                setItems((current) =>
                  current.map((row) =>
                    row.id === item.id
                      ? { ...row, attendee_count: Math.max(0, row.attendee_count - 1) }
                      : row
                  )
                );
              } catch (error) {
                console.error('Katılımcı çıkarılamadı:', error);
                Alert.alert('Hata', 'Katılımcı çıkarılamadı.');
              } finally {
                setUpdatingId(null);
              }
            })();
          },
        },
      ]
    );
  }

  function formatEventDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Tarih bilinmiyor';
    return `${date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} · ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Etkinlikler yükleniyor...</Text>
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
            <Text style={styles.title}>Etkinlikler</Text>
          </View>
          <Pressable onPress={() => void loadItems()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          {[
            ['Toplam', summary.total],
            ['Yaklaşan', summary.upcoming],
            ['Öne çıkan', summary.featured],
            ['İşaretli', summary.flagged],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{Number(value).toLocaleString('tr-TR')}</Text>
              <Text style={styles.summaryLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Etkinlik, düzenleyen, konum veya UUID ara"
            placeholderTextColor="#747483"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void loadItems()}
          />
          <Pressable onPress={() => void loadItems()} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Ara</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {items.map((item) => {
            const busy = updatingId === item.id;
            const open = expandedId === item.id;
            const isPast = new Date(item.event_date).getTime() < Date.now();

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <Feather name="calendar" size={19} color={colors.primary} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.meta}>@{item.owner_username} · {item.attendee_count} katılımcı</Text>
                    <Text style={styles.meta}>{formatEventDate(item.event_date)}</Text>
                    <Text style={styles.meta}>{item.location?.trim() || 'Konum belirtilmemiş'}</Text>
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
                ) : null}

                <View style={styles.badges}>
                  <Text style={isPast ? styles.neutralBadge : styles.badge}>{isPast ? 'Geçmiş' : 'Yaklaşan'}</Text>
                  {item.featured ? <Text style={styles.badge}>Öne çıkan</Text> : null}
                  {item.hidden ? <Text style={styles.dangerBadge}>Gizli işareti</Text> : null}
                  {item.cancelled ? <Text style={styles.dangerBadge}>İptal işareti</Text> : null}
                  <Text style={styles.neutralBadge}>Öncelik {item.priority}</Text>
                </View>

                <Pressable
                  onPress={() => router.push({ pathname: '/event', params: { id: item.id } })}
                  style={styles.openButton}
                >
                  <Text style={styles.openButtonText}>Etkinliği aç</Text>
                  <Feather name="external-link" size={15} color={colors.textSecondary} />
                </Pressable>

                {canManage ? (
                  <>
                    <View style={styles.actions}>
                      <Pressable disabled={busy} onPress={() => void updateControl(item, { featured: !item.featured })} style={styles.actionButton}>
                        <Text style={styles.actionText}>{item.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => void updateControl(item, { hidden: !item.hidden })} style={[styles.actionButton, item.hidden && styles.dangerAction]}>
                        <Text style={styles.actionText}>{item.hidden ? 'Gizli işaretini kaldır' : 'Gizli işaretle'}</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => void updateControl(item, { cancelled: !item.cancelled })} style={[styles.actionButton, item.cancelled && styles.dangerAction]}>
                        <Text style={styles.actionText}>{item.cancelled ? 'İptal işaretini kaldır' : 'İptal işaretle'}</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => void updateControl(item, { priority: item.priority + 1 })} style={styles.squareButton}>
                        <Feather name="plus" size={16} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable disabled={busy || item.priority <= 0} onPress={() => void updateControl(item, { priority: Math.max(0, item.priority - 1) })} style={styles.squareButton}>
                        <Feather name="minus" size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>

                    <View style={styles.noteBox}>
                      <TextInput
                        value={noteDrafts[item.id] ?? ''}
                        onChangeText={(value) => setNoteDrafts((current) => ({ ...current, [item.id]: value }))}
                        placeholder="Yalnızca yöneticilere görünen not"
                        placeholderTextColor="#747483"
                        style={styles.noteInput}
                        multiline
                      />
                      <Pressable
                        disabled={busy}
                        onPress={() => void updateControl(item, { note: (noteDrafts[item.id] ?? '').trim() || null })}
                        style={styles.noteSaveButton}
                      >
                        <Text style={styles.noteSaveText}>Notu kaydet</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                <Pressable onPress={() => void toggleAttendees(item)} style={styles.membersButton}>
                  <Text style={styles.membersButtonText}>Katılımcıları yönet</Text>
                  <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                </Pressable>

                {open ? (
                  <View style={styles.memberList}>
                    {(attendees[item.id] ?? []).map((attendee) => (
                      <View key={attendee.user_id} style={styles.memberRow}>
                        <Pressable
                          onPress={() => router.push({ pathname: '/profile', params: { userId: attendee.user_id } })}
                          style={styles.memberCopy}
                        >
                          <Text style={styles.memberName}>{attendee.username || 'Kitap Okuru'}</Text>
                          <Text style={styles.memberMeta}>{attendee.full_name || attendee.user_id}</Text>
                        </Pressable>
                        {canManage ? (
                          <Pressable
                            disabled={updatingId === `${item.id}:${attendee.user_id}`}
                            onPress={() => removeAttendee(item, attendee)}
                            style={styles.removeButton}
                          >
                            <Text style={styles.removeButtonText}>Çıkar</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    {(attendees[item.id] ?? []).length === 0 ? (
                      <Text style={styles.emptyText}>Katılımcı bulunamadı.</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="calendar" size={24} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Etkinlik bulunamadı</Text>
            <Text style={styles.emptyText}>Aramayı değiştirip tekrar dene.</Text>
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
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#F5F5F8', fontSize: 25, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 },
  summaryCard: { flexGrow: 1, minWidth: 135, padding: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934' },
  summaryValue: { color: '#F5F5F8', fontSize: 20, fontWeight: '900' },
  summaryLabel: { marginTop: 3, color: '#8E8E9D', fontSize: 11 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 13, paddingVertical: 12 },
  searchButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2B1E3E' },
  searchButtonText: { color: '#C8B8FF', fontSize: 12, fontWeight: '800' },
  list: { gap: 10 },
  card: { padding: 14, backgroundColor: '#15151D', borderRadius: 17, borderWidth: 1, borderColor: '#292934' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  cardTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  meta: { marginTop: 3, color: '#8E8E9D', fontSize: 11, lineHeight: 16 },
  description: { marginTop: 12, color: '#B6B6C3', fontSize: 12, lineHeight: 18 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  badge: { color: '#C8B8FF', backgroundColor: '#21182F', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  neutralBadge: { color: '#A5A5B3', backgroundColor: '#20202A', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  dangerBadge: { color: '#FFB0B0', backgroundColor: '#341D24', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: '800' },
  openButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11, backgroundColor: '#101016', borderWidth: 1, borderColor: '#292934' },
  openButtonText: { color: '#B6B6C3', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#292934' },
  actionButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#30303D' },
  dangerAction: { backgroundColor: '#2A171D', borderColor: '#5A2D38' },
  actionText: { color: '#B6B6C3', fontSize: 10, fontWeight: '700' },
  squareButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#30303D' },
  noteBox: { marginTop: 10, gap: 8 },
  noteInput: { minHeight: 60, color: '#F5F5F8', fontSize: 12, textAlignVertical: 'top', padding: 11, borderRadius: 11, backgroundColor: '#0F0F15', borderWidth: 1, borderColor: '#30303D' },
  noteSaveButton: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: '#2B1E3E' },
  noteSaveText: { color: '#C8B8FF', fontSize: 10, fontWeight: '800' },
  membersButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11, backgroundColor: '#101016' },
  membersButtonText: { color: '#BDA8FF', fontSize: 11, fontWeight: '800' },
  memberList: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#292934' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#24242E' },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: '#F5F5F8', fontSize: 12, fontWeight: '800' },
  memberMeta: { marginTop: 2, color: '#747483', fontSize: 9 },
  removeButton: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: '#2A171D', borderWidth: 1, borderColor: '#5A2D38' },
  removeButtonText: { color: '#FFB0B0', fontSize: 10, fontWeight: '800' },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
