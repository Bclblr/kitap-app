import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  View,
} from 'react-native';

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
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function getCurrentUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  }

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const currentUserId = await getCurrentUserId();

      if (!currentUserId) {
        setConversations([]);
        return;
      }

      const { data: conversationData, error } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id, created_at, updated_at')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Konuşmalar yüklenemedi:', error);
        Alert.alert('Hata', 'Mesajlar yüklenemedi.');
        return;
      }

      if (!conversationData) {
        setConversations([]);
        return;
      }

      const items: ConversationItem[] = [];
      const hidden = await supabase.from('conversation_hidden').select('conversation_id,hidden_at').eq('user_id', currentUserId);
      if (hidden.error) throw hidden.error;

      for (const conversation of conversationData as Conversation[]) {
        const otherUserId =
          conversation.user1_id === currentUserId
            ? conversation.user2_id
            : conversation.user1_id;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, full_name, profile_image')
          .eq('id', otherUserId)
          .maybeSingle();

        const { data: lastMessageData } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: unreadCount, error: unreadError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversation.id)
          .eq('is_read', false)
          .neq('sender_id', currentUserId);

        if (unreadError) {
          console.error('Okunmamış mesajlar alınamadı:', unreadError);
        }

        const hiddenAt = hidden.data?.find(row => row.conversation_id === conversation.id)?.hidden_at;
        if (hiddenAt && (!lastMessageData || Date.parse(lastMessageData.created_at) <= Date.parse(hiddenAt))) continue;
        items.push({
          id: conversation.id,
          otherUserId,
          username: [profileData?.full_name, profileData?.username].filter(Boolean).join(' · ') || 'Kitap Okuru',
          profileImage: profileData?.profile_image || null,
          lastMessage: lastMessageData?.content || 'Henüz mesaj yok',
          updatedAt: lastMessageData?.created_at || conversation.updated_at,
          unreadCount: unreadCount ?? 0,
        });
      }

      setConversations(items);
    } catch (error) {
      console.error('Konuşmalar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
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
      <TextInput accessibilityLabel="Sohbet veya okur ara" value={query} onChangeText={setQuery} placeholder="Ad veya kullanıcı adı ara" placeholderTextColor="#999" style={{ color: '#fff', padding: 14, margin: 12, borderWidth: 1, borderColor: '#333', borderRadius: 12 }} />
      {query.trim() ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 12 }}>
        {conversations.filter(item => item.username.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))).map(item => <View key={item.id}>{renderConversation({ item })}</View>)}
        <ReadersList query={query} />
      </ScrollView> : <>

      {loading ? (
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
        />
      )}

      </>}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
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
