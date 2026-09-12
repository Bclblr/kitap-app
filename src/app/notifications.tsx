import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Image from '@/components/SafeImage';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type InteractionType = 'like' | 'comment' | 'repost';
type SocialType = 'follow_request' | 'follow_accepted' | 'follow_rejected';

type InteractionNotification = {
  source: 'interaction'; id: string; actor_id: string | null; type: InteractionType; message: string;
  read: boolean; created_at: string; post_id: string | null; review_id: string | null;
  username: string; profile_image: string | null;
};
type SocialNotification = {
  source: 'social'; id: string; actor_id: string | null; type: SocialType; message: string;
  read: boolean; created_at: string; username: string; profile_image: string | null;
};
type AdminNotification = {
  source: 'admin'; id: string; title: string; message: string; action_route: string | null;
  created_at: string; read: boolean;
};
type NotificationItem = InteractionNotification | SocialNotification | AdminNotification;

export default function NotificationsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) { setNotifications([]); return; }

      const preferenceResult = await supabase.from('notification_preferences')
        .select('likes_enabled, comments_enabled, reposts_enabled, follows_enabled, system_enabled')
        .eq('user_id', user.id).maybeSingle();
      const prefs = {
        likes: preferenceResult.data?.likes_enabled ?? true,
        comments: preferenceResult.data?.comments_enabled ?? true,
        reposts: preferenceResult.data?.reposts_enabled ?? true,
        follows: preferenceResult.data?.follows_enabled ?? true,
        system: preferenceResult.data?.system_enabled ?? true,
      };

      const [interactionResult, socialResult, adminResult] = await Promise.all([
        supabase.from('notifications').select(`id, actor_id, type, message, read, created_at, post_id, review_id, profiles:actor_id(username, profile_image)`)
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('social_notifications').select(`id, actor_id, type, message, read, created_at, profiles:actor_id(username, profile_image)`)
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.rpc('get_my_admin_notifications', { p_limit: 100 }),
      ]);

      if (interactionResult.error) console.error('Etkileşim bildirimleri:', interactionResult.error);
      if (socialResult.error) console.error('Sosyal bildirimler:', socialResult.error);
      if (adminResult.error) console.error('Yönetim bildirimleri:', adminResult.error);

      const interactions: InteractionNotification[] = (interactionResult.data ?? [])
        .filter((n: any) => n.type === 'like' ? prefs.likes : n.type === 'comment' ? prefs.comments : n.type === 'repost' ? prefs.reposts : true)
        .map((n: any) => ({ source: 'interaction', id: String(n.id), actor_id: n.actor_id ? String(n.actor_id) : null,
          type: n.type as InteractionType, message: String(n.message ?? ''), read: n.read === true,
          created_at: String(n.created_at ?? ''), post_id: n.post_id ? String(n.post_id) : null,
          review_id: n.review_id ? String(n.review_id) : null, username: String(n.profiles?.username ?? 'Kullanıcı'),
          profile_image: typeof n.profiles?.profile_image === 'string' ? n.profiles.profile_image : null }));

      const socials: SocialNotification[] = prefs.follows ? (socialResult.data ?? []).map((n: any) => ({
        source: 'social', id: String(n.id), actor_id: n.actor_id ? String(n.actor_id) : null,
        type: n.type as SocialType, message: String(n.message ?? ''), read: n.read === true,
        created_at: String(n.created_at ?? ''), username: String(n.profiles?.username ?? 'Kullanıcı'),
        profile_image: typeof n.profiles?.profile_image === 'string' ? n.profiles.profile_image : null,
      })) : [];

      const admins: AdminNotification[] = prefs.system ? (adminResult.data ?? []).map((n: any) => ({
        source: 'admin', id: String(n.id), title: String(n.title ?? 'Duyuru'), message: String(n.message ?? ''),
        action_route: typeof n.action_route === 'string' && n.action_route.trim() ? n.action_route.trim() : null,
        created_at: String(n.created_at ?? ''), read: n.read === true,
      })) : [];

      setNotifications([...interactions, ...socials, ...admins].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
      setNotifications([]);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadNotifications(); }, [loadNotifications]));

  function openTarget(item: NotificationItem) {
    if (item.source === 'admin') { if (item.action_route) router.push(item.action_route as never); return; }
    if (item.source === 'social') {
      if (item.type === 'follow_request') router.push('/follow-requests' as never);
      else if (item.actor_id) router.push({ pathname: '/profile', params: { userId: item.actor_id } } as never);
      return;
    }
    if (item.post_id) router.push({ pathname: '/content', params: { type: 'post', id: item.post_id } } as never);
    else if (item.review_id) router.push({ pathname: '/content', params: { type: 'review', id: item.review_id } } as never);
  }

  async function markAsRead(item: NotificationItem) {
    try {
      if (!item.read) {
        if (item.source === 'admin') {
          const { error } = await supabase.rpc('mark_admin_notification_read', { p_notification_id: item.id });
          if (error) throw error;
        } else {
          const table = item.source === 'social' ? 'social_notifications' : 'notifications';
          const { error } = await supabase.from(table).update({ read: true }).eq('id', item.id);
          if (error) throw error;
        }
        setNotifications((current) => current.map((n) => n.source === item.source && n.id === item.id ? { ...n, read: true } : n));
      }
      openTarget(item);
    } catch (error) { console.error(error); Alert.alert('Hata', 'Bildirim güncellenemedi.'); }
  }

  async function markAllAsRead() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    try {
      const [interaction, social] = await Promise.all([
        supabase.from('notifications').update({ read: true }).eq('user_id', data.user.id).eq('read', false),
        supabase.from('social_notifications').update({ read: true }).eq('user_id', data.user.id).eq('read', false),
      ]);
      if (interaction.error) throw interaction.error;
      if (social.error) throw social.error;
      const adminResults = await Promise.all(notifications.filter((n): n is AdminNotification => n.source === 'admin' && !n.read)
        .map((n) => supabase.rpc('mark_admin_notification_read', { p_notification_id: n.id })));
      const adminError = adminResults.find((r: any) => r.error)?.error;
      if (adminError) throw adminError;
      setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    } catch (error) { console.error(error); Alert.alert('Hata', 'Bildirimler güncellenemedi.'); }
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const icon = (item: NotificationItem) => item.source === 'admin' ? 'bell' : item.source === 'social' ? 'user-plus' : item.type === 'like' ? 'heart' : item.type === 'comment' ? 'message-circle' : 'repeat';
  const title = (item: NotificationItem) => item.source === 'admin' ? item.title : item.source === 'social' ? item.type === 'follow_request' ? 'Takip isteği' : item.type === 'follow_accepted' ? 'Takip isteği kabul edildi' : 'Takip isteği reddedildi' : item.type === 'like' ? 'Beğeni' : item.type === 'comment' ? 'Yorum' : 'Yeniden paylaşım';
  const message = (item: NotificationItem) => item.source === 'admin' ? item.message : `${item.username} ${item.message || (item.source === 'interaction' ? 'etkileşimde bulundu' : '')}`;

  return (
    <View style={styles.container}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Bildirimler yükleniyor...</Text></View> :
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View><Text style={styles.pageTitle}>Bildirimler</Text><Text style={styles.muted}>{unreadCount ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimleri okudun'}</Text></View>
          {notifications.length > 0 ? <Pressable onPress={() => void markAllAsRead()} style={styles.readAll}><Text style={styles.readAllText}>Tümünü oku</Text></Pressable> : null}</View>
        {notifications.length === 0 ? <View style={styles.empty}><Feather name="bell" size={30} color={colors.primary} /><Text style={styles.emptyTitle}>Henüz bildirim yok</Text><Text style={styles.muted}>Etkileşimlerin, takip isteklerin ve duyurular burada görünecek.</Text></View> :
          notifications.map((item) => <Pressable key={`${item.source}:${item.id}`} onPress={() => void markAsRead(item)} style={[styles.card, !item.read && styles.unreadCard]}>
            {item.source !== 'admin' && item.profile_image ? <Image source={{ uri: item.profile_image }} style={styles.avatar} /> : <View style={styles.iconCircle}><Feather name={icon(item) as any} size={19} color={colors.primary} /></View>}
            <View style={styles.cardBody}><View style={styles.row}><Text style={styles.type}>{title(item)}</Text>{!item.read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}</View><Text style={styles.message}>{message(item)}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text></View>
          </Pressable>)}
      </ScrollView>}
      <BottomNav />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  pageTitle: { color: '#F5F5F8', fontSize: 28, fontWeight: '900' },
  muted: { color: '#8E8E9D', fontSize: 12, marginTop: 5, textAlign: 'center' },
  readAll: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: '#21182F' },
  readAllText: { color: '#C8B5FF', fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282833' },
  emptyTitle: { color: '#F5F5F8', fontSize: 16, fontWeight: '800', marginTop: 10 },
  card: { flexDirection: 'row', padding: 14, marginBottom: 10, borderRadius: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282833' },
  unreadCard: { borderColor: '#5D438B', backgroundColor: '#191522' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21182F' },
  cardBody: { flex: 1, marginLeft: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  type: { color: '#F5F5F8', fontSize: 13, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  message: { color: '#D5D5DC', fontSize: 14, lineHeight: 20, marginTop: 5 },
  date: { color: '#777783', fontSize: 11, marginTop: 8 },
});
