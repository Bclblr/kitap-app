const fs = require('fs');

const homePath = 'src/app/index.tsx';
const messagesPath = 'src/app/messages.tsx';

if (!fs.existsSync(homePath)) throw new Error('src/app/index.tsx bulunamadı.');
if (!fs.existsSync(messagesPath)) throw new Error('src/app/messages.tsx bulunamadı.');

let home = fs.readFileSync(homePath, 'utf8');

function removeContainingBlock(source, markerText) {
  const marker = source.indexOf(markerText);
  if (marker === -1) return { source, changed: false };

  const candidates = [
    { tag: 'Pressable', start: source.lastIndexOf('<Pressable', marker) },
    { tag: 'View', start: source.lastIndexOf('<View', marker) },
  ].filter((x) => x.start >= 0);

  if (!candidates.length) return { source, changed: false };
  const target = candidates.sort((a, b) => b.start - a.start)[0];
  const openToken = '<' + target.tag;
  const closeToken = '</' + target.tag + '>';
  let pos = target.start;
  let depth = 0;

  while (pos < source.length) {
    const nextOpen = source.indexOf(openToken, pos);
    const nextClose = source.indexOf(closeToken, pos);
    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openToken.length;
    } else {
      depth--;
      pos = nextClose + closeToken.length;
      if (depth === 0) {
        return {
          source: source.slice(0, target.start) + source.slice(pos),
          changed: true,
        };
      }
    }
  }

  return { source, changed: false };
}

const homeResult = removeContainingBlock(home, 'Kitap, yazar veya kullanıcı ara');
home = homeResult.source;
fs.writeFileSync(homePath, home, 'utf8');

const messagesContent = `import { Feather } from '@expo/vector-icons';
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
  View,
} from 'react-native';

import BottomNav from '@/components/BottomNav';
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
        .or(\`user1_id.eq.\${currentUserId},user2_id.eq.\${currentUserId}\`)
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

      for (const conversation of conversationData as Conversation[]) {
        const otherUserId =
          conversation.user1_id === currentUserId
            ? conversation.user2_id
            : conversation.user1_id;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, profile_image')
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

        items.push({
          id: conversation.id,
          otherUserId,
          username: profileData?.username || 'Kitap Okuru',
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
`;

fs.writeFileSync(messagesPath, messagesContent, 'utf8');

console.log(homeResult.changed
  ? 'Ana sayfadaki "Kitap, yazar veya kullanıcı ara" alanı kaldırıldı.'
  : 'Ana sayfadaki arama alanı bulunamadı; mesajlar sayfası yine güncellendi.');
console.log('Mesajlar sayfası mevcut koyu/premium tasarıma uyarlandı.');
