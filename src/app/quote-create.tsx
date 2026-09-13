import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Action, Field, ReaderScreen, useReaderStyles } from '@/components/ReaderUI';
import { QUOTE_CARD_LABELS, QuoteCardTemplate } from '@/lib/quote-card';
import { supabase } from '@/lib/supabase';
import { usePremium } from '@/providers/PremiumProvider';
import { useAppTheme } from '@/providers/ThemeProvider';

const TEMPLATES: QuoteCardTemplate[] = ['classic', 'editorial', 'noir', 'minimal'];

export default function QuoteCreate() {
  const ui = useReaderStyles();
  const router = useRouter();
  const premium = usePremium();
  const { colors } = useAppTheme();
  const lock = useRef(false);
  const [book, setBook] = useState('');
  const [text, setText] = useState('');
  const [template, setTemplate] = useState<QuoteCardTemplate>('classic');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (lock.current || !text.trim() || !book.trim()) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setError('Paylaşmak için giriş yapmalısın.');
        return;
      }

      const safeTemplate = template !== 'classic' && !premium.isPremium ? 'classic' : template;
      const result = await supabase.from('quotes').insert({
        user_id: data.user.id,
        book_title: book.trim(),
        book_key: '',
        text: text.trim(),
        card_template_key: safeTemplate,
      });

      if (result.error) throw result.error;
      router.replace('/');
    } catch {
      setError('Alıntı paylaşılamadı. Metnin korunuyor; yeniden deneyebilirsin.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <ReaderScreen title="Alıntı paylaş">
      <Field label="Kitap adı" value={book} onChangeText={setBook} maxLength={200} />
      <Field label="Alıntı" multiline value={text} onChangeText={setText} maxLength={4000} />

      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Kart şablonu</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {TEMPLATES.map((key) => {
          const locked = key !== 'classic' && !premium.isPremium;
          const selected = template === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (locked) {
                  router.push('/premium');
                  return;
                }
                setTemplate(key);
              }}
              style={{
                minWidth: 92,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                opacity: locked ? 0.55 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{QUOTE_CARD_LABELS[key]}</Text>
              <Text style={{ color: locked ? colors.textMuted : colors.primary, fontSize: 10, marginTop: 3 }}>{locked ? 'Premium' : selected ? 'Seçili' : 'Seç'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/premium-quote-cards', params: { text, book, template } })}
        style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginBottom: 12 }}
      >
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Kart önizlemesini aç</Text>
      </Pressable>

      <Text style={ui.error}>{error}</Text>
      <Action label={busy ? 'Paylaşılıyor…' : 'Paylaş'} disabled={busy || !text.trim() || !book.trim()} onPress={() => void save()} />
    </ReaderScreen>
  );
}
