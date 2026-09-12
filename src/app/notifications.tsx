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
  View,
} from 'react-native';
import Image from '@/components/SafeImage';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type InteractionType = 'like' | 'comment' | 'repost';

type InteractionNotification = {
  source: 'interaction';
  id: string;
  user_id: string;
  actor_id: string | null;
  type: InteractionType;
  message: string;
  read: boolean;
  created_at: string;
  post_id: string | null;
  review_id: string | null;
  username: string;
  profile_image: string | null;
};

type AdminNotification = {
  source: 'admin';
  id: string;
  title: string;
  message: string;
  action_route: string | null;
  created_at: string;
  read: boolean;
};

type NotificationItem = InteractionNotification | AdminNotification;

export default function NotificationsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Kullanıcı alınamadı:', error);
      return null;
    }
    return data.user;
  }

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        setNotifications([]);
        return;
      }

      const [interactionResult, adminResult] = await Promise.all([
        supabase
          .from('notifications')
          .select(`
            id,
            user_id,
            actor_id,
            type,
            message,
            read,
            created_at,
            post_id,
            review_id,
            profiles:actor_id (
              username,
              profile_image
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_my_admin_notifications', { p_limit: 100 }),
      ]);

      if (interactionResult.error) {
        console.error('Etkileşim bildirimleri yüklenemedi:', interactionResult.error);
      }
      if (adminResult.error) {
        console.error('Yönetim bildirimleri yüklenemedi:', adminResult.error);
      }

      const interactions: InteractionNotification[] = (interactionResult.data ?? []).map(
        (notification: any) => ({
          source: 'interaction',
          id: String(notification.id),
          user_id: String(notification.user_id),
          actor_id: notification.actor_id ? String(notification.actor_id) : null,
          type: notification.type as InteractionType,
          message: String(notification.message ?? ''),
          read: notification.read === true,
          created_at: String(notification.created_at ?? ''),
          post_id: notification.post_id ? String(notification.post_id) : null,
          review_id: notification.review_id ? String(notification.review_id) : null,
          username: String(notification.profiles?.username ?? 'Kullanıcı'),
          profile_image:
            typeof notification.profiles?.profile_image === 'string'
              ? notification.profiles.profile_image
              : null,
        })
      );

      const adminNotifications: AdminNotification[] = (adminResult.data ?? []).map(
        (notification: any) => ({
          source: 'admin',
          id: String(notification.id),
          title: String(notification.title ?? 'Duyuru'),
          message: String(notification.message ?? ''),
          action_route:
            typeof notification.action_route === 'string' && notification.action_route.trim()
              ? notification.action_route.trim()
              : null,
          created_at: String(notification.created_at ?? ''),
          read: notification.read === true,
        })
      );

      setNotifications(
        [...interactions, ...adminNotifications].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  async function markAsRead(notification: NotificationItem) {
    if (notification.read) {
      if (notification.source === 'admin' && notification.action_route) {
        router.push(notification.action_route as never);
      }
      return;
    }

    try {
      if (notification.source === 'admin') {
        const { error } = await supabase.rpc('mark_admin_notification_read', {
          p_notification_id: notification.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id);
        if (error) throw error;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.source === notification.source && item.id === notification.id
            ? { ...item, read: true }
            : item
        )
      );

      if (notification.source === 'admin' && notification.action_route) {
        router.push(notification.action_route as never);
      }
    } catch (error) {
      console.error('Bildirim okundu hatası:', error);
      Alert.alert('Hata', 'Bildirim güncellenemedi.');
    }
  }

  async function markAllAsRead() {
    const user = await getCurrentUser();
    if (!user) return;

    try {
      const interactionPromise = supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      const adminPromises = notifications
        .filter((item): item is AdminNotification => item.source === 'admin' && !item.read)
        .map((item) =>
          supabase.rpc('mark_admin_notification_read', {
            p_notification_id: item.id,
          })
        );

      const [interactionResult, ...adminResults] = await Promise.all([
        interactionPromise,
        ...adminPromises,
      ]);

      if (interactionResult.error) throw interactionResult.error;
      const adminError = adminResults.find((result: any) => result.error)?.error;
      if (adminError) throw adminError;

      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error('Tüm bildirimleri okuma hatası:', error);
      Alert.alert('Hata', 'Bildirimlerin tamamı güncellenemedi.');
    }
  }

  function clearInteractionNotifications() {
    Alert.alert(
      'Etkileşim bildirimlerini temizle',
      'Beğeni, yorum ve yeniden paylaşım bildirimlerin silinsin mi? Yönetim bildirimleri korunur.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const user = await getCurrentUser();
            if (!user) return;

            const { error } = await supabase
              .from('notifications')
              .delete()
              .eq('user_id', user.id);

            if (error) {
              console.error('Bildirimler silinemedi:', error);
              Alert.alert('Hata', error.message);
              return;
            }

            setNotifications((current) => current.filter((item) => item.source === 'admin'));
          },
        },
      ]
    );
  }

  function interactionIcon(type: InteractionType) {
    if (type === 'like') return 'heart' as const;
    if (type === 'comment') return 'message-circle' as const;
    return 'repeat' as const;
  }

  function interactionTitle(type: InteractionType) {
    if (type === 'like') return 'Beğeni';
    if (type === 'comment') return 'Yorum';
    return 'Yeniden paylaşım';
  }

  function interactionMessage(notification: InteractionNotification) {
    if (notification.type === 'like') return 'gönderini beğendi';
    if (notification.type === 'comment') return 'gönderine yorum yaptı';
    if (notification.type === 'repost') return 'gönderini yeniden paylaştı';
    return notification.message;
  }

  function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );
  const interactionCount = useMemo(
    () => notifications.filter((notification) => notification.source === 'interaction').length,
    [notifications]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Bildirimler</Text>
            {unreadCount > 0 ? (
              <Text style={styles.unreadText}>{unreadCount} okunmamış bildirim</Text>
            ) : (
              <Text style={styles.unreadText}>Tüm bildirimleri okudun</Text>
            )}
          </View>

          {notifications.length > 0 ? (
            <Pressable onPress={() => void markAllAsRead()} style={styles.readAllButton}>
              <Text style={styles.readAllText}>Tümünü oku</Text>
            </Pressable>
          ) : null}
        </View>

        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="bell" size={30} color={colors.primary} />
            <Text style={styles.emptyTitle}>Henüz bildirim yok</Text>
            <Text style={styles.emptyText}>
              Etkileşimlerin ve uygulama duyuruları burada görünecek.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((notification) => {
              const isAdmin = notification.source === 'admin';
              return (
                <Pressable
                  key={`${notification.source}:${notification.id}`}
                  onPress={() => void markAsRead(notification)}
                  style={[styles.card, !notification.read && styles.unreadCard]}
                >
                  {isAdmin ? (
                    <View style={[styles.iconCircle, styles.adminIconCircle]}>
                      <Feather name="bell" size={20} color={colors.primary} />
                    </View>
                  ) : notification.profile_image ? (
                    <Image source={{ uri: notification.profile_image }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.iconCircle}>
                      <Feather
                        name={interactionIcon(notification.type)}
                        size={19}
                        color={colors.primary}
                      />
                    </View>
                  )}

                  <View style={styles.cardContent}>
                    <View style={styles.topRow}>
                      <Text style={[styles.typeText, isAdmin && styles.adminTypeText]}>
                        {isAdmin ? notification.title : interactionTitle(notification.type)}
                      </Text>
                      {!notification.read ? <View style={styles.dot} /> : null}
                    </View>

                    <Text style={styles.message}>
                      {isAdmin ? (
                        notification.message
                      ) : (
                        <>
                          <Text style={styles.username}>{notification.username}</Text>{' '}
                          {interactionMessage(notification)}
                        </>
                      )}
                    </Text>

                    <View style={styles.bottomRow}>
                      <Text style={styles.date}>{formatDate(notification.created_at)}</Text>
                      {isAdmin && notification.action_route ? (
                        <Text style={styles.actionHint}>Aç ›</Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {interactionCount > 0 ? (
              <Pressable onPress={clearInteractionNotifications} style={styles.clearButton}>
                <Text style={styles.clearText}>Etkileşim bildirimlerini temizle</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 110,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#8E8E9D',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageTitle: {
    color: '#F5F5F8',
    fontSize: 28,
    fontWeight: '900',
  },
  unreadText: {
    marginTop: 5,
    color: '#8E8E9D',
    fontSize: 12,
  },
  readAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#21182F',
    borderWidth: 1,
    borderColor: '#38284D',
  },
  readAllText: {
    color: '#A985FF',
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    gap: 9,
  },
  card: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
  },
  unreadCard: {
    backgroundColor: '#191421',
    borderColor: '#45315F',
  },
  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#211F2B',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21182F',
  },
  adminIconCircle: {
    borderWidth: 1,
    borderColor: '#493465',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    flex: 1,
    color: '#D8D8E0',
    fontSize: 12,
    fontWeight: '800',
  },
  adminTypeText: {
    color: '#A985FF',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#A985FF',
    marginLeft: 8,
  },
  message: {
    marginTop: 5,
    color: '#B5B5C1',
    fontSize: 13,
    lineHeight: 19,
  },
  username: {
    color: '#F5F5F8',
    fontWeight: '800',
  },
  bottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    color: '#747483',
    fontSize: 10,
  },
  actionHint: {
    color: '#A985FF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 42,
    borderRadius: 20,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
  },
  emptyTitle: {
    marginTop: 14,
    color: '#F5F5F8',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 7,
    color: '#8E8E9D',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  clearButton: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearText: {
    color: '#8E8E9D',
    fontSize: 12,
    fontWeight: '700',
  },
});
