
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function ChatScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
    username?: string;
  }>();

  const conversationIdParam =
    typeof params.conversationId === 'string'
      ? params.conversationId
      : null;

  const otherUserId =
    typeof params.userId === 'string'
      ? params.userId
      : null;

  const username =
    typeof params.username === 'string'
      ? params.username
      : 'Kitap Okuru';

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [conversationId, setConversationId] =
    useState<string | null>(
      conversationIdParam
    );

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [text, setText] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  /*
   * =====================================================
   * KULLANICI
   * =====================================================
   */

  async function getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error(
        'Kullanıcı alınamadı:',
        error
      );
      return null;
    }

    return user;
  }

  /*
   * =====================================================
   * KONUŞMA BUL / OLUŞTUR
   * =====================================================
   */

  const getOrCreateConversation =
    useCallback(
      async (
        currentId: string,
        otherId: string
      ) => {
        try {
          /*
           * Önce mevcut konuşmayı bul.
           */
          const { data: existing1, error: error1 } =
            await supabase
              .from('conversations')
              .select(
                'id, user1_id, user2_id'
              )
              .eq(
                'user1_id',
                currentId
              )
              .eq(
                'user2_id',
                otherId
              )
              .maybeSingle();

          if (error1) {
            console.error(
              'Konuşma aranırken hata:',
              error1
            );
          }

          if (existing1) {
            return existing1.id;
          }

          /*
           * Ters sırayla oluşturulmuş konuşmayı ara.
           */
          const { data: existing2, error: error2 } =
            await supabase
              .from('conversations')
              .select(
                'id, user1_id, user2_id'
              )
              .eq(
                'user1_id',
                otherId
              )
              .eq(
                'user2_id',
                currentId
              )
              .maybeSingle();

          if (error2) {
            console.error(
              'Ters konuşma aranırken hata:',
              error2
            );
          }

          if (existing2) {
            return existing2.id;
          }

          /*
           * Konuşma yoksa oluştur.
           */
          const { data: newConversation, error } =
            await supabase
              .from('conversations')
              .insert({
                user1_id: currentId,
                user2_id: otherId,
              })
              .select(
                'id'
              )
              .single();

          if (error) {
            console.error(
              'Konuşma oluşturulamadı:',
              error
            );

            Alert.alert(
              'Hata',
              'Konuşma oluşturulamadı.'
            );

            return null;
          }

          return newConversation.id;
        } catch (error) {
          console.error(
            'Konuşma işleminde hata:',
            error
          );

          return null;
        }
      },
      []
    );

  /*
   * =====================================================
   * MESAJLARI YÜKLE
   * =====================================================
   */

  const loadMessages =
    useCallback(
      async (
        activeConversationId: string
      ) => {
        const { data, error } =
          await supabase
            .from('messages')
            .select(
              'id, conversation_id, sender_id, content, created_at'
            )
            .eq(
              'conversation_id',
              activeConversationId
            )
            .order(
              'created_at',
              {
                ascending: true,
              }
            );

        if (error) {
          console.error(
            'Mesajlar yüklenemedi:',
            error
          );

          Alert.alert(
            'Hata',
            'Mesajlar yüklenemedi.'
          );

          return;
        }

        setMessages(
          (data as Message[]) || []
        );
      },
      []
    );

  /*
   * =====================================================
   * SAYFA AÇILDIĞINDA
   * =====================================================
   */

  const initializeChat =
    useCallback(async () => {
      try {
        setLoading(true);

        const user =
          await getCurrentUser();

        if (!user) {
          Alert.alert(
            'Giriş gerekli',
            'Mesaj göndermek için giriş yapmalısın.',
            [
              {
                text: 'Tamam',
                onPress: () =>
                  router.push('/login'),
              },
            ]
          );

          return;
        }

        setCurrentUserId(
          user.id
        );

        /*
         * Eğer conversationId zaten varsa
         * doğrudan onu kullan.
         */
        if (conversationIdParam) {
          setConversationId(
            conversationIdParam
          );

          await loadMessages(
            conversationIdParam
          );

          return;
        }

        /*
         * conversationId yoksa karşı kullanıcı
         * ile konuşma oluştur/bul.
         */
        if (!otherUserId) {
          Alert.alert(
            'Hata',
            'Mesaj gönderilecek kullanıcı bulunamadı.'
          );

          return;
        }

        /*
         * Kendine mesaj göndermeyi engelle.
         */
        if (
          user.id ===
          otherUserId
        ) {
          Alert.alert(
            'Hata',
            'Kendine mesaj gönderemezsin.'
          );

          return;
        }

        const id =
          await getOrCreateConversation(
            user.id,
            otherUserId
          );

        if (!id) {
          return;
        }

        setConversationId(id);

        await loadMessages(id);
      } catch (error) {
        console.error(
          'Chat başlatılırken hata:',
          error
        );
      } finally {
        setLoading(false);
      }
    }, [
      conversationIdParam,
      otherUserId,
      getOrCreateConversation,
      loadMessages,
      router,
    ]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  /*
   * =====================================================
   * MESAJ GÖNDER
   * =====================================================
   */

  async function sendMessage() {
    const cleanText =
      text.trim();

    if (!cleanText) {
      return;
    }

    if (
      !currentUserId ||
      !conversationId
    ) {
      Alert.alert(
        'Hata',
        'Konuşma hazır değil.'
      );

      return;
    }

    try {
      setSending(true);

      const { data, error } =
        await supabase
          .from('messages')
          .insert({
            conversation_id:
              conversationId,

            sender_id:
              currentUserId,

            content:
              cleanText,
          })
          .select(
            'id, conversation_id, sender_id, content, created_at'
          )
          .single();

      if (error) {
        console.error(
          'Mesaj gönderilemedi:',
          error
        );

        Alert.alert(
          'Hata',
          'Mesaj gönderilemedi.'
        );

        return;
      }

      /*
       * Mesajı ekrana hemen ekle.
       */
      if (data) {
        setMessages(
          previous => [
            ...previous,
            data as Message,
          ]
        );
      }

      setText('');

      /*
       * Konuşmanın güncellenme zamanını yenile.
       */
      await supabase
        .from('conversations')
        .update({
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          conversationId
        );
    } catch (error) {
      console.error(
        'Mesaj gönderme hatası:',
        error
      );

      Alert.alert(
        'Hata',
        'Mesaj gönderilemedi.'
      );
    } finally {
      setSending(false);
    }
  }

  /*
   * =====================================================
   * GERİ DÖNÜŞ
   * =====================================================
   */

  function goBack() {
    router.back();
  }

  /*
   * =====================================================
   * MESAJ RENDER
   * =====================================================
   */

  function renderMessage({
    item,
  }: {
    item: Message;
  }) {
    const isMine =
      item.sender_id ===
      currentUserId;

    return (
      <View
        style={[
          styles.messageRow,
          isMine
            ? styles.myMessageRow
            : styles.otherMessageRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine
              ? styles.myMessageBubble
              : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMine
                ? styles.myMessageText
                : styles.otherMessageText,
            ]}
          >
            {item.content}
          </Text>

          <Text
            style={[
              styles.messageTime,
              isMine
                ? styles.myMessageTime
                : styles.otherMessageTime,
            ]}
          >
            {new Date(
              item.created_at
            ).toLocaleTimeString(
              'tr-TR',
              {
                hour: '2-digit',
                minute: '2-digit',
              }
            )}
          </Text>
        </View>
      </View>
    );
  }

  /*
   * =====================================================
   * EKRAN
   * =====================================================
   */

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? 10
          : 0
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={goBack}
          style={
            styles.backButton
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerAvatar
          }
        >
          <Text
            style={
              styles.headerAvatarText
            }
          >
            👤
          </Text>
        </View>

        <View
          style={
            styles.headerInfo
          }
        >
          <Text
            style={
              styles.headerUsername
            }
            numberOfLines={1}
          >
            {username}
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Mesajlar
          </Text>
        </View>
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
            Konuşma yükleniyor...
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item =>
            item.id
          }
          renderItem={
            renderMessage
          }
          contentContainerStyle={
            messages.length === 0
              ? styles.emptyList
              : styles.messageList
          }
          showsVerticalScrollIndicator={
            false
        }
          ListEmptyComponent={
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
                Henüz mesaj yok
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                İlk mesajı sen gönder.
              </Text>
            </View>
          }
        />
      )}

      <View
        style={
          styles.inputContainer
        }
      >
        <TextInput
          value={text}
          onChangeText={
            setText
          }
          placeholder="Mesaj yaz..."
          placeholderTextColor="#999"
          multiline
          maxLength={2000}
          style={
            styles.input
          }
        />

        <Pressable
          onPress={
            sendMessage
          }
          disabled={
            sending ||
            !text.trim()
          }
          style={[
            styles.sendButton,
            (!text.trim() ||
              sending) &&
              styles.sendButtonDisabled,
          ]}
        >
          <Text
            style={
              styles.sendButtonText
            }
          >
            {sending
              ? '...'
              : '➤'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/*
 * =====================================================
 * STYLES
 * =====================================================
 */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F7F7F5',
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingTop: 18,
      paddingHorizontal: 15,
      paddingBottom: 14,
      backgroundColor:
        '#FFF',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E5E5E5',
    },

    backButton: {
      width: 40,
      height: 40,
      justifyContent:
        'center',
      alignItems:
        'center',
      marginRight: 5,
    },

    backText: {
      fontSize: 38,
      lineHeight: 40,
      color: '#222',
      fontWeight: '300',
    },

    headerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#EEEEEA',
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    headerAvatarText: {
      fontSize: 20,
    },

    headerInfo: {
      flex: 1,
      marginLeft: 10,
    },

    headerUsername: {
      fontSize: 16,
      fontWeight:
        '700',
      color: '#222',
    },

    headerSubtitle: {
      marginTop: 2,
      fontSize: 11,
      color: '#999',
    },

    loadingContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    loadingText: {
      marginTop: 10,
      color: '#777',
      fontSize: 14,
    },

    messageList: {
      paddingHorizontal: 15,
      paddingVertical: 15,
    },

    emptyList: {
      flexGrow: 1,
      justifyContent:
        'center',
      paddingHorizontal: 30,
    },

    emptyContainer: {
      alignItems:
        'center',
    },

    emptyIcon: {
      fontSize: 45,
    },

    emptyTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight:
        '700',
      color: '#222',
    },

    emptyText: {
      marginTop: 6,
      color: '#777',
      fontSize: 14,
    },

    messageRow: {
      width: '100%',
      marginBottom: 8,
    },

    myMessageRow: {
      alignItems:
        'flex-end',
    },

    otherMessageRow: {
      alignItems:
        'flex-start',
    },

    messageBubble: {
      maxWidth: '78%',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 17,
    },

    myMessageBubble: {
      backgroundColor:
        '#222',
      borderBottomRightRadius:
        5,
    },

    otherMessageBubble: {
      backgroundColor:
        '#FFF',
      borderBottomLeftRadius:
        5,
      borderWidth: 1,
      borderColor:
        '#E5E5E5',
    },

    messageText: {
      fontSize: 14,
      lineHeight: 20,
    },

    myMessageText: {
      color: '#FFF',
    },

    otherMessageText: {
      color: '#333',
    },

    messageTime: {
      marginTop: 4,
      fontSize: 9,
    },

    myMessageTime: {
      color: '#BBB',
      textAlign:
        'right',
    },

    otherMessageTime: {
      color: '#999',
    },

    inputContainer: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor:
        '#FFF',
      borderTopWidth: 1,
      borderTopColor:
        '#E5E5E5',
    },

    input: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      backgroundColor:
        '#F7F7F5',
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 11,
      fontSize: 14,
      color: '#333',
      borderWidth: 1,
      borderColor:
        '#E5E5E5',
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        '#222',
      justifyContent:
        'center',
      alignItems:
        'center',
      marginLeft: 8,
    },

    sendButtonDisabled: {
      opacity: 0.4,
    },

    sendButtonText: {
      color: '#FFF',
      fontSize: 20,
      fontWeight:
        '700',
    },
  });

