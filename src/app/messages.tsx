import { useThemedStyles } from '@/theme/use-themed-styles';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Image from '@/components/SafeImage';

import BottomNav from '@/components/BottomNav';
import ReadersList from '@/components/ReadersList';
import RetryNotice from '@/components/RetryNotice';
import { supabase } from '@/lib/supabase';

type InboxSummaryRow = {
  conversation_id: string;
  other_user_id: string;
  last_message: string | null;
  last_message_at: string | null;
  conversation_updated_at: string;
  unread_count: number | string;
};

type ConversationItem = {
  id: string;
  otherUserId: string;
  username: string;
  profileImage: string | null;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
};

export default function MessagesScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserId = user?.id ?? null;

      if (!currentUserId) {
        setConversations([]);
        return;
      }

      const inboxResult = await supabase.rpc('get_my_inbox', {
        p_limit: 100,
      });

      if (inboxResult.error) {
        throw inboxResult.error;
      }

      const rows = (inboxResult.data ?? []) as InboxSummaryRow[];
      if (!rows.length) {
        setConversations([]);
        return;
      }

      const otherUserIds = [
        ...new Set(rows.map((item) => String(item.other_user_id)).filter(Boolean)),
      ];

      const profilesResult = await supabase
        .from('profiles')
        .select('id, username, full_name, profile_image')
        .in('id', otherUserIds);

      if (profilesResult.error) throw profilesResult.error;

      const profileMap = new Map<string, any>();
      for (const item of profilesResult.data ?? []) {
        profileMap.set(String(item.id), item);
      }

      const items = rows.map((row): ConversationItem => {
        const otherUserId = String(row.other_user_id);
        const profileData = profileMap.get(otherUserId);
        const unreadCount = Number(row.unread_count) || 0;

        return {
          id: String(row.conversation_id),
          otherUserId,
          username:
            [profileData?.full_name, profileData?.username]
              .filter(Boolean)
              .join(' · ') || 'Kitap Okuru',
          profileImage: profileData?.profile_image || null,
          lastMessage: row.last_message || 'Henüz mesaj yok',
          updatedAt: row.last_message_at || row.conversation_updated_at,
          unreadCount,
        };
      });

      setConversations(items);
    } catch (error) {
      console.error('Konuşmalar yüklenirken hata:', error);
      setLoadError('Mesajlar şu anda yenilenemedi. Mevcut konuşmaların korunuyor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  const matchingConversations = useMemo(
    () =>
      normalizedQuery
        ? conversations.filter((item) =>
            item.username.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
          )
        : conversations,
    [conversations, normalizedQuery]
  );

  function openChat(conversation: ConversationItem) {
    router.push({
      pathname: '/chat',
      params: {
        conversationId: conversation.id,
        userId: conversation.otherUserId,
        username: conversation.username,
      },
    });
  }

  function formatMessageDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  function renderConversation({ item }: { item: ConversationItem }) {
    const hasUnread = item.unreadCount > 0;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.username} ile sohbet`}
        onPress={() => openChat(item)}
        style={({ pressed }) => [
          styles.conversationItem,
          hasUnread && styles.unreadConversationItem,
          pressed && styles.pressedItem,
        ]}
      >
        <View style={[styles.avatar, hasUnread && styles.unreadAvatar]}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.avatarImage} />
          ) : (
            <Feather name="user" size={21} color="#A8A8B3" />
          )}
        </View>

        <View style={styles.conversationContent}>
          <Text
            style={[styles.username, hasUnread && styles.unreadUsername]}
            numberOfLines={1}
          >
            {item.username}
          </Text>
          <Text
            style={[styles.lastMessage, hasUnread && styles.unreadLastMessage]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>

        <View style={styles.rightContent}>
          <Text style={[styles.messageDate, hasUnread && styles.unreadMessageDate]}>
            {formatMessageDate(item.updatedAt)}
          </Text>

          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={18} color="#5F5F69" style={styles.chevron} />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SOHBETLER</Text>
          <Text style={styles.title}>Mesajlar</Text>
        </View>
        <View style={styles.headerIconWrap}>
          <Feather name="message-circle" size={21} color="#A985FF" />
        </View>
      </View>

      <View style={styles.divider} />
      <TextInput
        accessibilityLabel="Sohbet veya okur ara"
        value={query}
        onChangeText={setQuery}
        placeholder="Ad veya kullanıcı adı ara"
        placeholderTextColor="#999"
        style={styles.searchInput}
      />

      {loadError ? (
        <View style={styles.noticeWrap}>
          <RetryNotice
            message={loadError}
            busy={loading}
            onRetry={loadConversations}
          />
        </View>
      ) : null}

      {loadError && conversations.length === 0 ? (
        <View style={styles.loadingContainer} />
      ) : normalizedQuery ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.searchContent}
        >
          {matchingConversations.map((item) => (
            <View key={item.id}>{renderConversation({ item })}</View>
          ))}
          <ReadersList query={query} />
        </ScrollView>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#A985FF" />
          <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Feather name="message-circle" size={30} color="#A985FF" />
          </View>
          <Text style={styles.emptyTitle}>Henüz mesajın yok</Text>
          <Text style={styles.emptyText}>
            Bir kullanıcıyla mesajlaşmaya başladığında konuşmaların burada görünecek.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
        />
      )}

      <BottomNav />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#777782',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#F4F4F6',
    letterSpacing: -0.6,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18131F',
    borderWidth: 1,
    borderColor: '#2D223A',
  },
  divider: {
    height: 1,
    backgroundColor: '#1D1D23',
    marginHorizontal: 18,
  },
  searchInput: {
    color: '#fff',
    padding: 14,
    margin: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
  },
  searchContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 110,
  },
  noticeWrap: {
    paddingHorizontal: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#85858F',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 110,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 78,
    backgroundColor: '#111116',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#202027',
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 9,
  },
  unreadConversationItem: {
    backgroundColor: '#15121A',
    borderColor: '#352748',
  },
  pressedItem: {
    opacity: 0.72,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1B1B21',
    borderWidth: 1,
    borderColor: '#292930',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  unreadAvatar: {
    borderColor: '#5A4177',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  conversationContent: {
    minWidth: 0,
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  username: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#E5E5EA',
  },
  unreadUsername: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  lastMessage: {
    marginTop: 5,
    fontSize: 13.5,
    color: '#777782',
  },
  unreadLastMessage: {
    color: '#B6B6C0',
    fontWeight: '600',
  },
  rightContent: {
    minWidth: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  messageDate: {
    fontSize: 10.5,
    color: '#62626C',
  },
  unreadMessageDate: {
    color: '#B695FF',
    fontWeight: '700',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#A985FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#0A0A0E',
    fontSize: 10.5,
    fontWeight: '900',
  },
  chevron: {
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 38,
    paddingBottom: 78,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#18131F',
    borderWidth: 1,
    borderColor: '#302442',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 17,
    fontSize: 19,
    fontWeight: '800',
    color: '#F0F0F3',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13.5,
    lineHeight: 20,
    color: '#777782',
  },
});
