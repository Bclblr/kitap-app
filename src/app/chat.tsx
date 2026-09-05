
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import ChatActions from '@/components/ChatActions';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
    is_read: boolean;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Message>>(null);
  const sendLock = useRef(false);
  const [blocked, setBlocked] = useState(true);
  const [sendError, setSendError] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { setKeyboardVisible(true); list.current?.scrollToEnd({ animated: true }); });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const router = useRouter();

  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
    username?: string;
    reply?: string;
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
    useState(params.reply ?? '');

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
  'id, conversation_id, sender_id, content, created_at, is_read'
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

        if (currentUserId) {
  const { error: readError } = await supabase
    .from('messages')
    .update({
      is_read: true,
    })
    .eq(
      'conversation_id',
      activeConversationId
    )
    .neq(
      'sender_id',
      currentUserId
    )
    .eq(
      'is_read',
      false
    );

  if (readError) {
    console.error(
      'Mesajlar okundu olarak işaretlenemedi:',
      readError
    );
  }
}

        setMessages(
          (data as Message[]) || []
        );
      },
      [currentUserId]
    );
      useEffect(() => {
    if (
      !conversationId ||
      !currentUserId
    ) {
      return;
    }

    const channel = supabase
      .channel(
        `conversation-${conversationId}`
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage =
            payload.new as Message;

          setMessages((previous) => {
            if (
              previous.some(
                (message) =>
                  message.id ===
                  newMessage.id
              )
            ) {
              return previous;
            }

            return [
              ...previous,
              newMessage,
            ];
          });

          if (
            newMessage.sender_id !==
            currentUserId
          ) {
            supabase
              .from('messages')
              .update({
                is_read: true,
              })
              .eq(
                'id',
                newMessage.id
              )
              .then(({ error }) => {
                if (error) {
                  console.error(
                    'Yeni mesaj okundu olarak işaretlenemedi:',
                    error
                  );
                }
              });
          }
        }
      )
      .on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  },
  (payload) => {
    const updatedMessage =
      payload.new as Message;

    setMessages((previous) =>
      previous.map((message) =>
        message.id === updatedMessage.id
          ? updatedMessage
          : message
      )
    );
  }
)

      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    conversationId,
    currentUserId,
  ]);

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

    if (!cleanText || sendLock.current || blocked) {
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
      sendLock.current = true;
      setSending(true);
      setSendError(false);

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
        setSendError(true);
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
            previous => previous.some(message => message.id === data.id) ? previous : [
            ...previous,
            data as Message,
          ]
        );
      }

      setText(current => current === text ? '' : current);

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
      setSendError(true);
      console.error(
        'Mesaj gönderme hatası:',
        error
      );

      Alert.alert(
        'Hata',
        'Mesaj gönderilemedi.'
      );
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  /*
   * =====================================================
   * GERİ DÖNÜŞ
   * =====================================================
   */

 function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/messages');
  }
}
  /*
   * =====================================================
   * MESAJ RENDER
   * =====================================================
   */

  function renderMessage({
    item,
    index,
  }: {
    item: Message;
    index: number;
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
        {(index === 0 || new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString()) && <Text style={{ color: '#999', alignSelf: 'center', marginVertical: 12 }}>{new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>}
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

          <View style={styles.messageMeta}>
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

  {isMine && (
    <Text
      style={[
        styles.readStatus,
        item.is_read &&
          styles.readStatusRead,
      ]}
    >
      {item.is_read ? '✓✓' : '✓'}
    </Text>
  )}
</View>
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
        [styles.container, { paddingBottom: keyboardVisible ? 0 : insets.bottom }]
      }
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios'
          ? insets.top
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
        <ChatActions conversationId={conversationId} onBlocked={setBlocked} />
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
          ref={list}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          onLayout={() => list.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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

      {sendError && <Pressable accessibilityRole="button" onPress={sendMessage} disabled={sending || blocked} style={{ padding: 12 }}><Text style={{ color: '#FFB2B2' }}>Mesaj gönderilemedi. Yeniden göndermek için dokun.</Text></Pressable>}
      <View style={styles.inputContainer}>
        <TextInput
          value={text}
          onChangeText={
            setText
          }
          editable={!blocked}
          placeholder={blocked ? 'Mesaj gönderme kapalı' : 'Mesaj yaz...'}
          placeholderTextColor="#777782"
          multiline
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={sendMessage}
          keyboardAppearance="dark"
          maxLength={2000}
          style={
            styles.input
          }
        />

        <Pressable disabled={blocked || sending || !text.trim()} accessibilityLabel="Mesaj gönder" onPress={sendMessage} style={styles.sendButton} >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090D',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 13,
    backgroundColor: '#0D0D12',
    borderBottomWidth: 1,
    borderBottomColor: '#202028',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
    backgroundColor: '#15151C',
    borderWidth: 1,
    borderColor: '#24242D',
  },

  backText: {
    fontSize: 34,
    lineHeight: 36,
    color: '#F1F1F5',
    fontWeight: '300',
  },

  headerAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#1D1728',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#34264B',
  },

  headerAvatarText: {
    fontSize: 20,
  },

  headerInfo: {
    minWidth: 0,
    flex: 1,
    marginLeft: 11,
  },

  headerUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F6',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#85858F',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#8A8A94',
    fontSize: 14,
  },

  messageList: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyContainer: {
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 42,
    opacity: 0.8,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F1F4',
  },

  emptyText: {
    marginTop: 6,
    color: '#85858F',
    fontSize: 14,
  },

  messageRow: {
    width: '100%',
    marginBottom: 9,
  },

  myMessageRow: {
    alignItems: 'flex-end',
  },

  otherMessageRow: {
    alignItems: 'flex-start',
  },

  messageBubble: {
    maxWidth: '79%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },

  myMessageBubble: {
    backgroundColor: '#6F4ED8',
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: '#8062DD',
  },

  otherMessageBubble: {
    backgroundColor: '#15151B',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#26262F',
  },

  messageText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  myMessageText: {
    color: '#FFFFFF',
  },

  otherMessageText: {
    color: '#E7E7EB',
  },

  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },

  messageTime: {
    fontSize: 9,
  },

  myMessageTime: {
    color: '#D9D0F7',
    textAlign: 'right',
  },

  otherMessageTime: {
    color: '#777782',
  },

  readStatus: {
    marginLeft: 4,
    fontSize: 12,
    color: '#D0C7ED',
    fontWeight: '700',
  },

  readStatusRead: {
    color: '#D9CFFF',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#0D0D12',
    borderTopWidth: 1,
    borderTopColor: '#202028',
  },

  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: 110,
    minHeight: 46,
    backgroundColor: '#15151B',
    borderRadius: 23,
    paddingHorizontal: 17,
    paddingVertical: 11,
    fontSize: 14,
    color: '#F2F2F5',
    borderWidth: 1,
    borderColor: '#292932',
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#6F4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#8062DD',
  },

  sendButtonDisabled: {
    opacity: 0.4,
  },

  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
