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

import { getCurrentAdminAccess } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type CommunityRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  kind: string;
  visibility: string;
  created_by: string | null;
  owner_username: string;
  member_count: number;
  admin_count: number;
  verified: boolean;
  featured: boolean;
  priority: number;
  restricted: boolean;
  created_at: string;
};

type CommunityMember = {
  user_id: string;
  username: string;
  full_name: string | null;
  role: string;
  joined_at: string;
};

export default function AdminCommunitiesScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [items, setItems] = useState<CommunityRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, CommunityMember[]>>({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const access = await getCurrentAdminAccess();
      if (!access.canOpenAdmin) {
        router.replace('/');
        return;
      }
      setCanManage(access.role === 'admin' || access.role === 'super_admin');

      const { data, error } = await supabase.rpc('admin_list_communities', {
        p_search: query.trim(),
        p_limit: 150,
      });
      if (error) throw error;

      setItems(
        (Array.isArray(data) ? data : []).map((row: any) => ({
          id: String(row.id),
          name: String(row.name ?? 'Topluluk'),
          description: typeof row.description === 'string' ? row.description : null,
          image_url: typeof row.image_url === 'string' ? row.image_url : null,
          kind: String(row.kind ?? 'community'),
          visibility: String(row.visibility ?? 'public'),
          created_by: row.created_by ? String(row.created_by) : null,
          owner_username: String(row.owner_username ?? 'Kitap Okuru'),
          member_count: Number(row.member_count) || 0,
          admin_count: Number(row.admin_count) || 0,
          verified: row.verified === true,
          featured: row.featured === true,
          priority: Number(row.priority) || 0,
          restricted: row.restricted === true,
          created_at: String(row.created_at ?? ''),
        }))
      );
    } catch (error) {
      console.error('Topluluk yönetimi yüklenemedi:', error);
      Alert.alert('Hata', 'Topluluklar yüklenemedi. SQL migrationını çalıştırdığından emin ol.');
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems])
  );

  const summary = useMemo(() => ({
    total: items.length,
    featured: items.filter((item) => item.featured).length,
    verified: items.filter((item) => item.verified).length,
    restricted: items.filter((item) => item.restricted).length,
  }), [items]);

  async function updateControl(item: CommunityRow, patch: Partial<Pick<CommunityRow, 'verified' | 'featured' | 'priority' | 'restricted'>>) {
    if (!canManage) {
      Alert.alert('Yetki gerekli', 'Bu işlem için admin yetkisi gerekiyor.');
      return;
    }

    const next = { ...item, ...patch };
    setUpdatingId(item.id);
    try {
      const { error } = await supabase.rpc('admin_set_community_control', {
        p_community_id: item.id,
        p_verified: next.verified,
        p_featured: next.featured,
        p_priority: next.priority,
        p_restricted: next.restricted,
      });
      if (error) throw error;
      setItems((current) => current.map((row) => row.id === item.id ? next : row));
    } catch (error) {
      console.error('Topluluk ayarı güncellenemedi:', error);
      Alert.alert('Hata', 'Topluluk ayarı güncellenemedi.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleMembers(item: CommunityRow) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);
    if (members[item.id]) return;

    try {
      const { data, error } = await supabase.rpc('admin_list_community_members', {
        p_community_id: item.id,
      });
      if (error) throw error;
      setMembers((current) => ({ ...current, [item.id]: (data ?? []) as CommunityMember[] }));
    } catch (error) {
      console.error('Topluluk üyeleri yüklenemedi:', error);
      Alert.alert('Hata', 'Topluluk üyeleri yüklenemedi.');
    }
  }

  async function setMemberRole(communityId: string, member: CommunityMember, role: 'member' | 'admin') {
    if (!canManage || member.role === 'owner' || member.role === role) return;
    setUpdatingId(`${communityId}:${member.user_id}`);
    try {
      const { error } = await supabase.rpc('admin_set_community_member_role', {
        p_community_id: communityId,
        p_user_id: member.user_id,
        p_role: role,
      });
      if (error) throw error;
      setMembers((current) => ({
        ...current,
        [communityId]: (current[communityId] ?? []).map((row) =>
          row.user_id === member.user_id ? { ...row, role } : row
        ),
      }));
    } catch (error) {
      console.error('Topluluk rolü güncellenemedi:', error);
      Alert.alert('Hata', 'Üye rolü güncellenemedi.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Topluluklar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YÖNETİM</Text>
            <Text style={styles.title}>Topluluklar</Text>
          </View>
          <Pressable onPress={() => void loadItems()} style={styles.headerButton}>
            <Feather name="refresh-cw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          {[
            ['Toplam', summary.total],
            ['Öne çıkan', summary.featured],
            ['Doğrulanmış', summary.verified],
            ['Kısıtlı', summary.restricted],
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
            placeholder="Topluluk, sahip veya UUID ara"
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
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <Feather name={item.kind === 'book_club' ? 'book-open' : 'users'} size={19} color={colors.primary} />
                  </View>
                  <View style={styles.cardCopy}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      {item.verified ? <Feather name="check-circle" size={15} color={colors.primary} /> : null}
                    </View>
                    <Text style={styles.meta}>@{item.owner_username} · {item.member_count} üye · {item.admin_count} yönetici</Text>
                    <Text style={styles.meta}>{item.kind === 'book_club' ? 'Kitap kulübü' : 'Topluluk'} · {item.visibility === 'private' ? 'Özel' : 'Herkese açık'}</Text>
                  </View>
                </View>

                {item.description ? <Text style={styles.description} numberOfLines={3}>{item.description}</Text> : null}

                <View style={styles.badges}>
                  {item.featured ? <Text style={styles.badge}>Öne çıkan</Text> : null}
                  {item.restricted ? <Text style={styles.dangerBadge}>Kısıtlı</Text> : null}
                  <Text style={styles.badge}>Öncelik {item.priority}</Text>
                </View>

                {canManage ? (
                  <View style={styles.actions}>
                    <Pressable disabled={busy} onPress={() => void updateControl(item, { verified: !item.verified })} style={styles.actionButton}>
                      <Text style={styles.actionText}>{item.verified ? 'Doğrulamayı kaldır' : 'Doğrula'}</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => void updateControl(item, { featured: !item.featured })} style={styles.actionButton}>
                      <Text style={styles.actionText}>{item.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => void updateControl(item, { restricted: !item.restricted })} style={[styles.actionButton, item.restricted && styles.dangerAction]}>
                      <Text style={styles.actionText}>{item.restricted ? 'Kısıtı kaldır' : 'Kısıtla'}</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => void updateControl(item, { priority: item.priority + 1 })} style={styles.squareButton}>
                      <Feather name="plus" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable disabled={busy || item.priority <= 0} onPress={() => void updateControl(item, { priority: Math.max(0, item.priority - 1) })} style={styles.squareButton}>
                      <Feather name="minus" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ) : null}

                <Pressable onPress={() => void toggleMembers(item)} style={styles.membersButton}>
                  <Text style={styles.membersButtonText}>Üyeleri yönet</Text>
                  <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                </Pressable>

                {open ? (
                  <View style={styles.memberList}>
                    {(members[item.id] ?? []).map((member) => (
                      <View key={member.user_id} style={styles.memberRow}>
                        <View style={styles.memberCopy}>
                          <Text style={styles.memberName}>{member.username || 'Kitap Okuru'}</Text>
                          <Text style={styles.memberMeta}>{member.full_name || member.user_id}</Text>
                        </View>
                        <Text style={styles.roleText}>{member.role === 'owner' ? 'Sahip' : member.role === 'admin' ? 'Yönetici' : 'Üye'}</Text>
                        {canManage && member.role !== 'owner' ? (
                          <Pressable
                            disabled={updatingId === `${item.id}:${member.user_id}`}
                            onPress={() => void setMemberRole(item.id, member, member.role === 'admin' ? 'member' : 'admin')}
                            style={styles.roleButton}
                          >
                            <Text style={styles.roleButtonText}>{member.role === 'admin' ? 'Üye yap' : 'Yönetici yap'}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    {(members[item.id] ?? []).length === 0 ? <Text style={styles.emptyText}>Üye bulunamadı.</Text> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="users" size={24} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Topluluk bulunamadı</Text>
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
  summaryLabel: { color: '#8E8E9D', fontSize: 11, marginTop: 3 },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, backgroundColor: '#15151D', borderRadius: 15, borderWidth: 1, borderColor: '#292934', marginBottom: 14 },
  searchInput: { flex: 1, color: '#F5F5F8', fontSize: 14 },
  searchButton: { height: '100%', justifyContent: 'center', paddingHorizontal: 16, borderLeftWidth: 1, borderLeftColor: '#292934' },
  searchButtonText: { color: '#BDA8FF', fontWeight: '800' },
  list: { gap: 10 },
  card: { padding: 15, backgroundColor: '#15151D', borderRadius: 18, borderWidth: 1, borderColor: '#292934' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  cardCopy: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '850', flexShrink: 1 },
  meta: { color: '#8E8E9D', fontSize: 11, marginTop: 3 },
  description: { color: '#A5A5B3', fontSize: 13, lineHeight: 19, marginTop: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  badge: { color: '#C7B6FF', backgroundColor: '#241A34', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '800' },
  dangerBadge: { color: '#FFB7BE', backgroundColor: '#3A2026', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#101016', borderWidth: 1, borderColor: '#30303D' },
  dangerAction: { borderColor: '#6C343D' },
  actionText: { color: '#C3C3CF', fontSize: 11, fontWeight: '700' },
  squareButton: { width: 35, height: 35, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101016', borderWidth: 1, borderColor: '#30303D' },
  membersButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 13, marginTop: 13, borderTopWidth: 1, borderTopColor: '#292934' },
  membersButtonText: { color: '#BDA8FF', fontSize: 12, fontWeight: '800' },
  memberList: { marginTop: 10, gap: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, backgroundColor: '#101016', borderRadius: 12 },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { color: '#F5F5F8', fontSize: 12, fontWeight: '800' },
  memberMeta: { color: '#747483', fontSize: 10, marginTop: 2 },
  roleText: { color: '#A5A5B3', fontSize: 10 },
  roleButton: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: '#241A34' },
  roleButtonText: { color: '#C7B6FF', fontSize: 10, fontWeight: '800' },
  emptyCard: { marginTop: 24, alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#292934' },
  emptyTitle: { marginTop: 10, color: '#F5F5F8', fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 5, color: '#8E8E9D', fontSize: 12, textAlign: 'center' },
});
