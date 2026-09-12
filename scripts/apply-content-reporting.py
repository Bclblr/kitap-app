from pathlib import Path

p = Path('src/app/index.tsx')
s = p.read_text()

anchor = "  const [postingStory, setPostingStory] = useState(false);\n"
addition = r'''

  async function reportFeedContent(post: Post) {
    const user = await getCurrentUser();
    if (!user) {
      Alert.alert('Giriş gerekli', 'İçeriği şikâyet etmek için giriş yapmalısın.');
      return;
    }
    if (post.user_id === user.id) {
      Alert.alert('Kendi içeriğin', 'Kendi içeriğini şikâyet edemezsin.');
      return;
    }

    const targetType = post.isQuote ? 'quote' : post.isReview ? 'review' : 'post';

    const submit = async (category: string) => {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: String(post.id),
        category,
        description: '',
      });

      if (error) {
        console.error('İçerik şikâyeti gönderilemedi:', error);
        Alert.alert('Hata', 'Şikâyet gönderilemedi.');
        return;
      }

      Alert.alert('Şikâyet alındı', 'Bildirimin moderasyon ekibine gönderildi.');
    };

    Alert.alert('İçeriği şikâyet et', 'Şikâyet nedenini seç.', [
      { text: 'Spam', onPress: () => submit('spam') },
      { text: 'Taciz', onPress: () => submit('harassment') },
      { text: 'Uygunsuz içerik', onPress: () => submit('inappropriate') },
      { text: 'Yanıltıcı içerik', onPress: () => submit('misleading') },
      { text: 'Diğer', onPress: () => submit('other') },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  function openFeedContentMenu(post: Post) {
    if (post.user_id && post.user_id === currentUserId) {
      Alert.alert('İçerik seçenekleri', 'Bu içerik sana ait.', [
        { text: 'Tamam', style: 'cancel' },
      ]);
      return;
    }

    Alert.alert('İçerik seçenekleri', undefined, [
      { text: 'Şikâyet Et', style: 'destructive', onPress: () => reportFeedContent(post) },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }
'''

if 'async function reportFeedContent(post: Post)' not in s:
    if anchor not in s:
        raise SystemExit('state anchor missing')
    s = s.replace(anchor, anchor + addition, 1)

old = '<Text style={styles.moreButton}>•••</Text>'
new = '<Pressable onPress={() => openFeedContentMenu(post)} accessibilityLabel="İçerik seçenekleri"><Text style={styles.moreButton}>•••</Text></Pressable>'

if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('menu anchor missing')

p.write_text(s)
