import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

type Profile = {
  id: string;
  username: string | null;
  profile_image: string | null;
};

type ConversationItem = {
  id: string;
  otherUserId: string;
  username: string;
  profileImage: string | null;
  lastMessage: string;
  updatedAt: string;
};

export default function MessagesScreen() {
  const router = useRouter();

    const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [conversations, setConversations] =
    useState<ConversationItem[]>([]);

  const [loading, setLoading] = useState(true);

  async function getCurrentUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  }

    async function loadConversations() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setConversations([]);
        return;
      }

        useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at,
          updated_at
        `)
        .or(
          `user1_id.eq.${user.id},user2_id.eq.${user.id}`
        )
        .order('updated_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Konuşmalar yüklenemedi:',
          error
        );

        Alert.alert(
          'Hata',
          'Konuşmalar yüklenemedi.'
        );

        return;
      }

      setConversations(data ?? []);
    } catch (error) {
      console.error(
        'Konuşmalar yüklenirken hata:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);

      const currentUserId =
        await getCurrentUserId();

      if (!currentUserId) {
        setConversations([]);
        return;
      }

      /*
       * Kullanıcının dahil olduğu konuşmaları getir.
       */
      const { data: conversationData, error } =
        await supabase
          .from('conversations')
          .select(
            'id, user1_id, user2_id, created_at, updated_at'
          )
          .or(
            `user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`
          )
          .order('updated_at', {
            ascending: false,
          });

      if (error) {
        console.error(
          'Konuşmalar yüklenemedi:',
          error
        );

        Alert.alert(
          'Hata',
          'Mesajlar yüklenemedi.'
        );

        return;
      }

      if (!conversationData) {
        setConversations([]);
        return;
      }

      const typedConversations =
        conversationData as Conversation[];

      const items: ConversationItem[] = [];

      for (const conversation of typedConversations) {
        const otherUserId =
          conversation.user1_id === currentUserId
            ? conversation.user2_id
            : conversation.user1_id;

        /*
         * Karşı kullanıcının profilini getir.
         */
        const { data: profileData } =
          await supabase
            .from('profiles')
            .select(
              'id, username, profile_image'
            )
            .eq('id', otherUserId)
            .maybeSingle();

        /*
         * Konuşmadaki son mesajı getir.
         */
        const { data: lastMessageData } =
          await supabase
            .from('messages')
            .select(
              'content, created_at'
            )
            .eq(
              'conversation_id',
              conversation.id
            )
            .order('created_at', {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        items.push({
          id: conversation.id,

          otherUserId,

          username:
            profileData?.username ||
            'Kitap Okuru',

          profileImage:
            profileData?.profile_image ||
            null,

          lastMessage:
            lastMessageData?.content ||
            'Henüz mesaj yok',

          updatedAt:
            lastMessageData?.created_at ||
            conversation.updated_at,
        });
      }

      setConversations(items);
    } catch (error) {
      console.error(
        'Konuşmalar yüklenirken hata:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  function openChat(
    conversation: ConversationItem
  ) {
    router.push({
      pathname: '/chat',
      params: {
        conversationId:
          conversation.id,

        userId:
          conversation.otherUserId,

        username:
          conversation.username,
      },
    });
  }

  function renderConversation({
    item,
  }: {
    item: ConversationItem;
  }) {
    return (
      <Pressable
        onPress={() =>
          openChat(item)
        }
        style={
          styles.conversationItem
        }
      >
        <View
          style={
            styles.avatar
          }
        >
          <Text
            style={
              styles.avatarText
            }
          >
            👤
          </Text>
        </View>

        <View
          style={
            styles.conversationContent
          }
        >
          <Text
            style={
              styles.username
            }
            numberOfLines={1}
          >
            {item.username}
          </Text>

          <Text
            style={
              styles.lastMessage
            }
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>

        <Text
          style={
            styles.arrow
          }
        >
          ›
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.header}
      >
        <Text
          style={styles.title}
        >
          Mesajlar
        </Text>
      </View>

      {loading ? (
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator />

          <Text
            style={
              styles.loadingText
            }
          >
            Mesajlar yükleniyor...
          </Text>
        </View>
      ) : conversations.length === 0 ? (
        <View
          style={
            styles.emptyContainer
          }
        >
          <Text
            style={
              styles.emptyIcon
            }
          >
            💬
          </Text>

          <Text
            style={
              styles.emptyTitle
            }
          >
            Henüz mesajın yok
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Başka bir kullanıcıyla
            mesajlaşmaya başladığında
            konuşmaların burada
            görünecek.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) =>
            item.id
          }
          renderItem={
            renderConversation
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
        />
      )}

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },

  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#222',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#777',
    fontSize: 14,
  },

  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 110,
  },

  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E5E0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 25,
  },

  conversationContent: {
    flex: 1,
    marginLeft: 13,
  },

  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },

  lastMessage: {
    marginTop: 5,
    fontSize: 14,
    color: '#777',
  },

  arrow: {
    fontSize: 28,
    color: '#999',
    marginLeft: 8,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
    paddingBottom: 80,
  },

  emptyIcon: {
    fontSize: 48,
  },

  emptyTitle: {
    marginTop: 15,
    fontSize: 19,
    fontWeight: '700',
    color: '#222',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#777',
  },
});