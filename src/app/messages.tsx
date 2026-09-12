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
import { supabase } from '@/lib/supabase';

type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
};

type InboxMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
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

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserId = user?.id ?? null;

      if (!currentUserId) {
        setConversations([]);
        return;
      }

      const { data: conversationData, error } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id, created_at, updated_at')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Konuşmalar yüklenemedi:', error);
        Alert.alert('Hata', 'Mesajlar yüklenemedi.');
        return;
      }

      const rows = (conversationData ?? []) as Conversation[];
      if (!rows.length) {
        setConversations([]);
        return;
      }

      const conversationIds = rows.map((item) => item.id);
      const otherUserIds = [
        ...new Set(
          rows.map((item) =>
            item.user1_id === currentUserId ? item.user2_id : item.user1_id
          )
        ),
      ];

      const [hiddenResult, profilesResult, messagesResult] = await Promise.all([
        supabase
          .from('conversation_hidden')
          .select('conversation_id, hidden_at')
          .eq('user_id', currentUserId)
          .in('conversation_id', conversationIds),
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_image')
          .in('id', otherUserIds),
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at, is_read')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      if (hiddenResult.error) throw hiddenResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (messagesResult.error) throw messagesResult.error;

      const hiddenMap = new Map<string, string>();
      for (const item of hiddenResult.data ?? []) {
        hiddenMap.set(String(item.conversation_id), String(item.hidden_at));
      }

      const profileMap = new Map<string, any>();
      for (const item of profilesResult.data ?? []) {
        profileMap.set(String(item.id), item);
      }

      const latestMessageMap = new Map<string, InboxMessage>();
      const unreadMap = new Map<string, number>();

      for (const raw of (messagesResult.data ?? []) as InboxMessage[]) {
        const hiddenAt = hiddenMap.get(raw.conversation_id);
        if (hiddenAt && Date.parse(raw.created_at) <= Date.parse(hiddenAt)) continue;

        if (!latestMessageMap.has(raw.conversation_id)) {
          latestMessageMap.set(raw.conversation_id, raw);
        }

        if (!raw.is_read && raw.sender_id !== currentUserId) {
          unreadMap.set(
            raw.conversation_id,
            (unreadMap.get(raw.conversation_id) ?? 0) + 1
          );
        }
      }

      const items = rows
        .map((conversation): ConversationItem | null => {
          const otherUserId =
            conversation.user1_id === currentUserId
              ? conversation.user2_id
              : conversation.user1_id;
          const profileData = profileMap.get(otherUserId);
          const lastMessage = latestMessageMap.get(conversation.id);
          const hiddenAt = hiddenMap.get(conversation.id);

          if (hiddenAt && !lastMessage) return null;

          return {
            id: conversation.id,
            otherUserId,
            username:
              [profileData?.full_name, profileData?.username]
                .filter(Boolean)
                .join(' · ') || 'Kitap Okuru',
            profileImage: profileData?.profile_image || null,
            lastMessage: lastMessage?.content || 'Henüz mesaj yok',
            updatedAt: lastMessage?.created_at || conversation.updated_at,
            unreadCount: unreadMap.get(conversation.id) ?? 0,
          };
        })
        .filter((item): item is ConversationItem => item !== null)
        .sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        );

      setConversations(items);
    } catch (error) {
      console.error('Konuşmalar yüklenirken hata:', error);
      Alert.alert('Hata', 'Mesajlar yüklenemedi. Tekrar deneyebilirsin.');
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

      {normalizedQuery ? (
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
