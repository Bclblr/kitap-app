import Image from '@/components/SafeImage';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Member = {
  user_id: string;
  username: string;
  profile_image: string | null;
  joined_at: string | null;
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

        const { data: rows, error: memberError } = await supabase
          .from('community_members')
          .select('user_id, joined_at')
          .eq('community_id', communityId)
          .order('joined_at', { ascending: true });

        if (memberError) throw memberError;
        if (!active) return;

        const userIds = (rows ?? []).map((row) => row.user_id).filter(Boolean);
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
          (rows ?? []).map((row) => {
            const profile = profileMap.get(row.user_id);
            return {
              user_id: row.user_id,
              username: profile?.username || 'Kullanıcı',
              profile_image: profile?.profile_image ?? null,
              joined_at: row.joined_at ?? null,
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

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Topluluk Üyeleri</Text>
        <View style={styles.iconButton} />
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
      ) : members.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={30} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Henüz üye yok.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.count}>{members.length} üye</Text>
          {members.map((member) => (
            <Pressable
              key={member.user_id}
              onPress={() =>
                router.push({ pathname: '/profile', params: { userId: member.user_id } })
              }
              style={({ pressed }) => [styles.member, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${member.username} profilini aç`}
            >
              {member.profile_image ? (
                <Image source={{ uri: member.profile_image }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>
                    {member.username.charAt(0).toLocaleUpperCase('tr-TR')}
                  </Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.username}>{member.username}</Text>
                <Text style={styles.memberLabel}>Topluluk üyesi</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08090D' },
  header: {
    minHeight: 60,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#222229',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#F7F7F9', fontSize: 18, fontWeight: '900' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  errorText: { color: '#B5B6BE', textAlign: 'center', fontSize: 14, lineHeight: 21 },
  emptyText: { color: '#B5B6BE', fontSize: 14 },
  list: { padding: 18, paddingBottom: 36 },
  count: { color: '#B58AF6', fontSize: 13, fontWeight: '800', marginBottom: 12 },
  member: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111218',
    borderWidth: 1,
    borderColor: '#2D2E37',
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  pressed: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#24253A' },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#24253A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  memberInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  username: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  memberLabel: { color: '#8E8F98', fontSize: 12, marginTop: 3 },
});
