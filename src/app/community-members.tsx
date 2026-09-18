import { safeBack } from '@/lib/navigation';
import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type CommunityRole = 'owner' | 'admin' | 'member';

type Member = {
  user_id: string;
  username: string;
  profile_image: string | null;
  joined_at: string | null;
  role: CommunityRole;
};

type InviteCandidate = {
  id: string;
  username: string | null;
  profile_image: string | null;
};

export default function CommunityMembersScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const communityId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<InviteCandidate[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [managingUserId, setManagingUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      if (!communityId) {
        setError('Topluluk bilgisi bulunamadı.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [permission, memberResult] = await Promise.all([
          supabase.rpc('community_admin', { cid: communityId }),
          supabase
            .from('community_members')
            .select('user_id, joined_at, role')
            .eq('community_id', communityId)
            .order('joined_at', { ascending: true }),
        ]);

        if (!active) return;
        setIsAdmin(permission.data === true);

        if (memberResult.error) throw memberResult.error;
        const rows = memberResult.data ?? [];
        const userIds = rows.map((row) => row.user_id).filter(Boolean);
        if (!userIds.length) {
          setMembers([]);
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, profile_image')
          .in('id', userIds);

        if (profileError) throw profileError;
        if (!active) return;

        const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        setMembers(
          rows.map((row) => {
            const profile = profileMap.get(row.user_id);
            const role: CommunityRole = row.role === 'owner' || row.role === 'admin' ? row.role : 'member';
            return {
              user_id: row.user_id,
              username: profile?.username || 'Kullanıcı',
              profile_image: profile?.profile_image ?? null,
              joined_at: row.joined_at ?? null,
              role,
            };
          }),
        );
      } catch (loadError) {
        console.error('Community members load error:', loadError);
        if (active) setError('Üyeler yüklenemedi. Tekrar deneyebilirsin.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMembers();
    return () => {
      active = false;
    };
  }, [communityId]);

  useEffect(() => {
    if (!isAdmin || inviteQuery.trim().length < 2) {
      const resetTimer = setTimeout(() => {
        setInviteResults([]);
        setInviteSearching(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let active = true;
    const timer = setTimeout(async () => {
      setInviteSearching(true);
      try {
        const { data, error: searchError } = await supabase.rpc('search_visible_profiles', {
          p_query: inviteQuery.trim(),
          p_limit: 8,
        });
        if (searchError) throw searchError;
        if (!active) return;
        const memberIds = new Set(members.map((member) => member.user_id));
        setInviteResults(
          ((data ?? []) as InviteCandidate[]).filter((profile) => profile.id && !memberIds.has(profile.id)),
        );
      } catch (searchError) {
        console.error('Community invite search error:', searchError);
        if (active) setInviteResults([]);
      } finally {
        if (active) setInviteSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inviteQuery, isAdmin, members]);

  async function inviteUser(candidate: InviteCandidate) {
    if (!communityId || invitingUserId) return;
    setInvitingUserId(candidate.id);
    try {
      const { error: inviteError } = await supabase.rpc('invite_to_community', {
        p_community_id: communityId,
        p_invitee_id: candidate.id,
      });
      if (inviteError) throw inviteError;
      Alert.alert('Davet gönderildi', `${candidate.username || 'Kullanıcı'} topluluğa davet edildi.`);
      setInviteResults((current) => current.filter((item) => item.id !== candidate.id));
    } catch (inviteError) {
      console.error('Community invite error:', inviteError);
      Alert.alert('Davet gönderilemedi', 'Kullanıcı zaten üye olabilir veya davet işlemi tamamlanamamış olabilir.');
    } finally {
      setInvitingUserId(null);
    }
  }

  async function changeMemberRole(member: Member) {
    if (!communityId || !isAdmin || member.role === 'owner' || managingUserId) return;
    const nextRole: CommunityRole = member.role === 'admin' ? 'member' : 'admin';
    setManagingUserId(member.user_id);
    try {
      const { error: roleError } = await supabase.rpc('set_community_member_role', {
        p_community_id: communityId,
        p_user_id: member.user_id,
        p_role: nextRole,
      });
      if (roleError) throw roleError;
      setMembers((current) =>
        current.map((item) =>
          item.user_id === member.user_id ? { ...item, role: nextRole } : item,
        ),
      );
    } catch (roleError) {
      console.error('Community member role error:', roleError);
      Alert.alert('Yetki güncellenemedi', 'Üyenin topluluk rolü değiştirilemedi.');
    } finally {
      setManagingUserId(null);
    }
  }

  function confirmRemoveMember(member: Member) {
    if (!communityId || !isAdmin || member.role === 'owner' || managingUserId) return;
    Alert.alert(
      'Üyeyi topluluktan çıkar',
      `${member.username} topluluktan çıkarılsın mı?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: () => void removeMember(member) },
      ],
    );
  }

  async function removeMember(member: Member) {
    if (!communityId || !isAdmin || member.role === 'owner' || managingUserId) return;
    setManagingUserId(member.user_id);
    try {
      const { error: removeError } = await supabase.rpc('remove_community_member', {
        p_community_id: communityId,
        p_user_id: member.user_id,
      });
      if (removeError) throw removeError;
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
      Alert.alert('Üye çıkarıldı', `${member.username} artık bu topluluğun üyesi değil.`);
    } catch (removeError) {
      console.error('Community member remove error:', removeError);
      Alert.alert('Üye çıkarılamadı', 'Topluluk üyeliği güncellenemedi.');
    } finally {
      setManagingUserId(null);
    }
  }

  function roleLabel(role: CommunityRole) {
    if (role === 'owner') return 'Topluluk sahibi';
    if (role === 'admin') return 'Topluluk yöneticisi';
    return 'Topluluk üyesi';
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? safeBack(router, '/explore') : router.replace('/explore'))}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Topluluk Üyeleri</Text>
        <Pressable
          onPress={() => router.push('/community-invites')}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Topluluk davetlerimi aç"
        >
          <Feather name="mail" size={20} color={colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {isAdmin ? (
            <View style={styles.inviteBox}>
              <Text style={styles.inviteTitle}>Üye Davet Et</Text>
              <Text style={styles.inviteHint}>Kullanıcı adıyla ara ve topluluğa davet gönder.</Text>
              <View style={styles.searchBox}>
                <Feather name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  value={inviteQuery}
                  onChangeText={setInviteQuery}
                  placeholder="Kullanıcı ara"
                  placeholderTextColor="#777983"
                  style={styles.searchInput}
                  autoCapitalize="none"
                />
                {inviteSearching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              </View>
              {inviteResults.map((candidate) => {
                const name = candidate.username?.trim() || 'Kullanıcı';
                return (
                  <View key={candidate.id} style={styles.inviteResult}>
                    {candidate.profile_image ? (
                      <Image source={{ uri: candidate.profile_image }} style={styles.smallAvatar} />
                    ) : (
                      <View style={styles.smallAvatarFallback}>
                        <Text style={styles.smallAvatarText}>{name.charAt(0).toLocaleUpperCase('tr-TR')}</Text>
                      </View>
                    )}
                    <Text style={styles.inviteUsername}>{name}</Text>
                    <Pressable
                      disabled={invitingUserId === candidate.id}
                      onPress={() => void inviteUser(candidate)}
                      style={styles.inviteButton}
                    >
                      <Text style={styles.inviteButtonText}>{invitingUserId === candidate.id ? '...' : 'Davet Et'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.count}>{members.length} üye</Text>
            <Pressable onPress={() => router.push('/community-invites')}>
              <Text style={styles.invitesLink}>Davetlerim</Text>
            </Pressable>
          </View>

          {members.length === 0 ? (
            <View style={styles.inlineEmpty}>
              <Feather name="users" size={30} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Henüz üye yok.</Text>
            </View>
          ) : (
            members.map((member) => {
              const canManage = isAdmin && member.role !== 'owner';
              const isManaging = managingUserId === member.user_id;
              return (
                <View key={member.user_id} style={styles.memberCard}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/profile', params: { userId: member.user_id } })}
                    style={({ pressed }) => [styles.memberMain, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${member.username} profilini aç`}
                  >
                    {member.profile_image ? (
                      <Image source={{ uri: member.profile_image }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{member.username.charAt(0).toLocaleUpperCase('tr-TR')}</Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={styles.username}>{member.username}</Text>
                      <Text style={[styles.memberLabel, member.role !== 'member' && styles.roleHighlight]}>
                        {roleLabel(member.role)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                  </Pressable>

                  {canManage ? (
                    <View style={styles.manageRow}>
                      <Pressable
                        disabled={isManaging}
                        onPress={() => void changeMemberRole(member)}
                        style={styles.roleButton}
                        accessibilityRole="button"
                        accessibilityLabel={member.role === 'admin' ? 'Yönetici yetkisini kaldır' : 'Yönetici yap'}
                      >
                        <Feather name="shield" size={15} color="#C7B3FF" />
                        <Text style={styles.roleButtonText}>
                          {isManaging ? 'İşleniyor...' : member.role === 'admin' ? 'Admin Yetkisini Kaldır' : 'Admin Yap'}
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={isManaging}
                        onPress={() => confirmRemoveMember(member)}
                        style={styles.removeButton}
                        accessibilityRole="button"
                        accessibilityLabel="Üyeyi topluluktan çıkar"
                      >
                        <Feather name="user-x" size={15} color="#E18B94" />
                        <Text style={styles.removeButtonText}>Çıkar</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08090D' },
  header: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222229' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F7F7F9', fontSize: 18, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  inlineEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  errorText: { color: '#B5B6BE', textAlign: 'center', fontSize: 14, lineHeight: 21 },
  emptyText: { color: '#B5B6BE', fontSize: 14 },
  list: { padding: 18, paddingBottom: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  count: { color: '#B58AF6', fontSize: 13, fontWeight: '800' },
  invitesLink: { color: '#B58AF6', fontSize: 13, fontWeight: '800' },
  inviteBox: { backgroundColor: '#111218', borderWidth: 1, borderColor: '#302F4A', borderRadius: 16, padding: 14, marginBottom: 18 },
  inviteTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '900' },
  inviteHint: { color: '#8E8F98', fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 10 },
  searchBox: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2D2E37', borderRadius: 13, paddingHorizontal: 12, backgroundColor: '#17181F' },
  searchInput: { flex: 1, color: '#F5F5F7', fontSize: 14, paddingVertical: 0 },
  inviteResult: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#25262E', marginTop: 10, paddingTop: 10 },
  smallAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#24253A' },
  smallAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#24253A', alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  inviteUsername: { flex: 1, marginLeft: 10, color: '#F5F5F7', fontSize: 14, fontWeight: '800' },
  inviteButton: { minHeight: 36, borderRadius: 11, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8058D9' },
  inviteButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  memberCard: { backgroundColor: '#111218', borderWidth: 1, borderColor: '#2D2E37', borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  memberMain: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  pressed: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#24253A' },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#24253A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  memberInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  username: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  memberLabel: { color: '#8E8F98', fontSize: 12, marginTop: 3 },
  roleHighlight: { color: '#B58AF6', fontWeight: '800' },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  roleButton: { flex: 1, minHeight: 38, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#1D1728', borderWidth: 1, borderColor: '#4A3569', paddingHorizontal: 10 },
  roleButtonText: { color: '#C7B3FF', fontSize: 11, fontWeight: '900' },
  removeButton: { minHeight: 38, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#201317', borderWidth: 1, borderColor: '#55272D', paddingHorizontal: 12 },
  removeButtonText: { color: '#E18B94', fontSize: 11, fontWeight: '900' },
});
