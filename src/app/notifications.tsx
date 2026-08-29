import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

type NotificationType =
  | 'like'
  | 'comment'
  | 'repost';

type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;

  post_id: string | null;
  review_id: string | null;

  username: string;
  profile_image: string | null;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);

  const [loading, setLoading] =
    useState(true);

  // =====================================================
  // GİRİŞ YAPMIŞ KULLANICIYI AL
  // =====================================================

  async function getCurrentUser() {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error(
        'Kullanıcı alınamadı:',
        error
      );

      return null;
    }

    return data.user;
  }

  // =====================================================
  // BİLDİRİMLERİ YÜKLE
  // =====================================================

  const loadNotifications = useCallback(
    async () => {
      try {
        const user =
          await getCurrentUser();

        if (!user) {
          setNotifications([]);
          return;
        }

        const {
          data,
          error,
        } = await supabase
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
          .eq(
            'user_id',
            user.id
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (error) {
          console.error(
            'Bildirimler yüklenemedi:',
            error
          );

          setNotifications([]);
          return;
        }

        const formattedNotifications:
          AppNotification[] =
          (data ?? []).map(
            (notification: any) => ({
              id:
                notification.id,

              user_id:
                notification.user_id,

              actor_id:
                notification.actor_id ??
                null,

              type:
                notification.type as NotificationType,

              message:
                notification.message,

              read:
                notification.read ??
                false,

              created_at:
                notification.created_at,

              post_id:
                notification.post_id ??
                null,

              review_id:
                notification.review_id ??
                null,

              username:
                notification.profiles
                  ?.username ??
                'Kullanıcı',

              profile_image:
                notification.profiles
                  ?.profile_image ??
                null,
            })
          );

        setNotifications(
          formattedNotifications
        );
      } catch (error) {
        console.error(
          'Bildirimler yüklenemedi:',
          error
        );

        setNotifications([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =====================================================
  // SAYFA AÇILINCA YÜKLE
  // =====================================================

  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      loadNotifications();
    }, [loadNotifications])
  );

  // =====================================================
  // BİLDİRİMİ OKUNDU YAP
  // =====================================================

  async function markAsRead(
    id: string
  ) {
    try {
      const {
        error,
      } = await supabase
        .from('notifications')
        .update({
          read: true,
        })
        .eq(
          'id',
          id
        );

      if (error) {
        console.error(
          'Bildirim okunamadı:',
          error
        );

        Alert.alert(
          'Hata',
          error.message
        );

        return;
      }

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id ===
              id
                ? {
                    ...notification,
                    read: true,
                  }
                : notification
          )
      );
    } catch (error) {
      console.error(
        'Bildirim okundu hatası:',
        error
      );
    }
  }

  // =====================================================
  // TÜMÜNÜ OKUNDU YAP
  // =====================================================

  async function markAllAsRead() {
    try {
      const user =
        await getCurrentUser();

      if (!user) {
        return;
      }

      const {
        error,
      } = await supabase
        .from('notifications')
        .update({
          read: true,
        })
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'read',
          false
        );

      if (error) {
        console.error(
          'Bildirimler okunamadı:',
          error
        );

        Alert.alert(
          'Hata',
          error.message
        );

        return;
      }

      setNotifications(
        (current) =>
          current.map(
            (notification) => ({
              ...notification,
              read: true,
            })
          )
      );
    } catch (error) {
      console.error(
        'Tüm bildirimleri okuma hatası:',
        error
      );
    }
  }

  // =====================================================
  // İKON
  // =====================================================

  function getIcon(
    type: NotificationType
  ) {
    switch (type) {
      case 'like':
        return '♥';

      case 'comment':
        return '●';

      case 'repost':
        return '↻';

      default:
        return '•';
    }
  }

  // =====================================================
  // BİLDİRİM TÜRÜ
  // =====================================================

  function getTypeName(
    type: NotificationType
  ) {
    switch (type) {
      case 'like':
        return 'Beğeni';

      case 'comment':
        return 'Yorum';

      case 'repost':
        return 'Yeniden paylaşım';

      default:
        return 'Bildirim';
    }
  }

  // =====================================================
  // BİLDİRİM MESAJI
  // =====================================================

  function getMessage(
    notification: AppNotification
  ) {
    switch (notification.type) {
      case 'like':
        return 'gönderini beğendi';

      case 'comment':
        return 'gönderine yorum yaptı';

      case 'repost':
        return 'gönderini yeniden paylaştı';

      default:
        return notification.message;
    }
  }

  // =====================================================
  // TARİH
  // =====================================================

  function formatDate(
    value: string
  ) {
    if (!value) {
      return '';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return date.toLocaleDateString(
      'tr-TR',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  }

  // =====================================================
  // BİLDİRİMLERİ TEMİZLE
  // =====================================================

  function clearNotifications() {
    Alert.alert(
      'Bildirimleri temizle',
      'Tüm bildirimler silinsin mi?',
      [
        {
          text: 'Vazgeç',
          style: 'cancel',
        },

        {
          text: 'Sil',
          style: 'destructive',

          onPress:
            async () => {
              try {
                const user =
                  await getCurrentUser();

                if (!user) {
                  return;
                }

                const {
                  error,
                } =
                  await supabase
                    .from(
                      'notifications'
                    )
                    .delete()
                    .eq(
                      'user_id',
                      user.id
                    );

                if (error) {
                  console.error(
                    'Bildirimler silinemedi:',
                    error
                  );

                  Alert.alert(
                    'Hata',
                    error.message
                  );

                  return;
                }

                setNotifications([]);
              } catch (error) {
                console.error(
                  'Bildirim silme hatası:',
                  error
                );
              }
            },
        },
      ]
    );
  }

  // =====================================================
  // OKUNMAMIŞ SAYISI
  // =====================================================

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

  // =====================================================
  // YÜKLENİYOR
  // =====================================================

  if (loading) {
    return (
      <View
        style={
          styles.container
        }
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <Text
            style={
              styles.loadingText
            }
          >
            Bildirimler yükleniyor...
          </Text>
        </View>

        <BottomNav />
      </View>
    );
  }

  // =====================================================
  // EKRAN
  // =====================================================

  return (
    <View
      style={
        styles.container
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* HEADER */}

        <View
          style={
            styles.header
          }
        >
          <View>
            <Text
              style={
                styles.pageTitle
              }
            >
              Bildirimler
            </Text>

            {unreadCount > 0 && (
              <Text
                style={
                  styles.unreadText
                }
              >
                {unreadCount}{' '}
                okunmamış bildirim
              </Text>
            )}
          </View>

          {notifications.length >
            0 && (
            <Pressable
              onPress={
                markAllAsRead
              }
              style={
                styles.readAllButton
              }
            >
              <Text
                style={
                  styles.readAllText
                }
              >
                Tümünü oku
              </Text>
            </Pressable>
          )}
        </View>

        {/* BİLDİRİM YOK */}

        {notifications.length ===
        0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              ♡
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Henüz bildirim yok
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Beğeni, yorum ve yeniden
              paylaşım bildirimlerin
              burada görünecek.
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.list
            }
          >
            {notifications.map(
              (notification) => (
                <Pressable
                  key={
                    notification.id
                  }
                  onPress={() =>
                    markAsRead(
                      notification.id
                    )
                  }
                  style={[
                    styles.card,
                    !notification.read &&
                      styles.unreadCard,
                  ]}
                >
                  {/* PROFİL FOTOĞRAFI */}

                  {notification.profile_image ? (
                    <Image
                      source={{
                        uri: notification.profile_image,
                      }}
                      style={
                        styles.profileImage
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.iconCircle
                      }
                    >
                      <Text
                        style={
                          styles.icon
                        }
                      >
                        {getIcon(
                          notification.type
                        )}
                      </Text>
                    </View>
                  )}

                  {/* İÇERİK */}

                  <View
                    style={
                      styles.cardContent
                    }
                  >
                    <View
                      style={
                        styles.topRow
                      }
                    >
                      <Text
                        style={
                          styles.typeText
                        }
                      >
                        {getTypeName(
                          notification.type
                        )}
                      </Text>

                      {!notification.read && (
                        <View
                          style={
                            styles.dot
                          }
                        />
                      )}
                    </View>

                    {/* KULLANICI + MESAJ */}

                    <Text
                      style={
                        styles.message
                      }
                    >
                      <Text
                        style={
                          styles.username
                        }
                      >
                        {notification.username}
                      </Text>{' '}

                      {getMessage(
                        notification
                      )}
                    </Text>

                    {/* TARİH */}

                    <Text
                      style={
                        styles.date
                      }
                    >
                      {formatDate(
                        notification.created_at
                      )}
                    </Text>
                  </View>
                </Pressable>
              )
            )}

            {/* TEMİZLE */}

            <Pressable
              onPress={
                clearNotifications
              }
              style={
                styles.clearButton
              }
            >
              <Text
                style={
                  styles.clearText
                }
              >
                Tüm bildirimleri temizle
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  scrollContent: {
    paddingBottom: 110,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#777',
    fontSize: 14,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#222',
  },

  unreadText: {
    marginTop: 5,
    fontSize: 13,
    color: '#777',
  },

  readAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#E8E8E3',
  },

  readAllText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '700',
  },

  emptyCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 30,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 46,
    color: '#999',
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },

  emptyText: {
    marginTop: 7,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#777',
  },

  list: {
    marginHorizontal: 20,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 17,
    padding: 15,
    marginBottom: 10,
  },

  unreadCard: {
    backgroundColor: '#EEEEEA',
  },

  // ===================================================
  // PROFİL FOTOĞRAFI
  // ===================================================

  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E8E8E3',
  },

  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E8E8E3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },

  cardContent: {
    flex: 1,
    marginLeft: 12,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#777',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#222',
  },

  message: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },

  username: {
    fontWeight: '700',
    color: '#222',
  },

  date: {
    marginTop: 6,
    fontSize: 11,
    color: '#999',
  },

  clearButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
});