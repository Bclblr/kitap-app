
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function ReviewScreen() {
  const router = useRouter();

  const { key, title } =
    useLocalSearchParams<{
      key?: string;
      title?: string;
    }>();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveReview() {
    const cleanText = reviewText.trim();

    if (!key) {
      Alert.alert(
        'Hata',
        'Kitap bilgisi bulunamadı.'
      );
      return;
    }

    if (rating === 0) {
      Alert.alert(
        'Puan gerekli',
        'Lütfen kitaba 1 ile 5 arasında bir puan ver.'
      );
      return;
    }

    if (!cleanText) {
      Alert.alert(
        'İnceleme gerekli',
        'Lütfen incelemeni yaz.'
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          'Kullanıcı bilgisi alınamadı:',
          userError
        );

        Alert.alert(
          'Hata',
          'Kullanıcı bilgilerin alınamadı.'
        );

        return;
      }

      if (!user) {
        Alert.alert(
          'Giriş gerekli',
          'İnceleme yazmak için önce hesabına giriş yapmalısın.'
        );

        return;
      }

      const { error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          book_key: key,
          book_title:
            title || 'Bilinmeyen kitap',
          rating,
          text: cleanText,
        });

      if (error) {
        console.error(
          'İnceleme kaydetme hatası:',
          error
        );

        Alert.alert(
          'Hata',
          `İnceleme kaydedilemedi.\n\n${error.message}`
        );

        return;
      }

      Alert.alert(
        'İnceleme kaydedildi',
        'İncelemen başarıyla kaydedildi.',
        [
          {
            text: 'Tamam',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        'İnceleme kaydetme hatası:',
        error
      );

      Alert.alert(
        'Hata',
        'İnceleme kaydedilirken bir hata oluştu.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>
            ← Geri
          </Text>
        </Pressable>

        <Text style={styles.pageTitle}>
          İnceleme Yaz
        </Text>

        <View style={styles.bookCard}>
          <Text style={styles.bookLabel}>
            Kitap
          </Text>

          <Text style={styles.bookTitle}>
            {title || 'Bilinmeyen kitap'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Puanın
        </Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(
            (star) => (
              <Pressable
                key={star}
                onPress={() =>
                  setRating(star)
                }
                style={styles.starButton}
              >
                <Text
                  style={[
                    styles.star,
                    star <= rating &&
                      styles.selectedStar,
                  ]}
                >
                  ★
                </Text>
              </Pressable>
            )
          )}
        </View>

        <Text style={styles.ratingLabel}>
          {rating === 0
            ? 'Henüz puan vermedin'
            : `${rating}/5`}
        </Text>

        <Text style={styles.sectionTitle}>
          İncelemen
        </Text>

        <TextInput
          value={reviewText}
          onChangeText={setReviewText}
          placeholder="Bu kitap hakkındaki düşüncelerini yaz..."
          placeholderTextColor="#999"
          multiline
          maxLength={2000}
          textAlignVertical="top"
          style={styles.reviewInput}
        />

        <Text style={styles.characterCount}>
          {reviewText.length}/2000
        </Text>

        <Pressable
          onPress={saveReview}
          disabled={saving}
          style={[
            styles.saveButton,
            saving &&
              styles.disabledButton,
          ]}
        >
          <Text style={styles.saveButtonText}>
            {saving
              ? 'Kaydediliyor...'
              : '📝 İncelemeyi Kaydet'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0E',
  },

  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 50,
  },

  backButton: {
    marginBottom: 20,
  },

  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C8B0F8',
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#F5F5F7',
    marginBottom: 22,
  },

  bookCard: {
    backgroundColor: '#17171F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#30303B',
  },

  bookLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 6,
  },

  bookTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F5F5F7',
    lineHeight: 25,
  },

  sectionTitle: {
    marginTop: 25,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F7',
  },

  starsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  starButton: {
    paddingRight: 8,
  },

  star: {
    fontSize: 42,
    color: '#D5D5D0',
  },

  selectedStar: {
    color: '#A985FF',
  },

  ratingLabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#777',
    fontWeight: '600',
  },

  reviewInput: {
    minHeight: 190,
    backgroundColor: '#17171F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30303B',
    padding: 15,
    fontSize: 15,
    lineHeight: 23,
    color: '#F5F5F7',
  },

  characterCount: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 11,
    color: '#999',
  },

  saveButton: {
    marginTop: 20,
    height: 55,
    borderRadius: 14,
    backgroundColor: '#7157DD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.5,
  },

  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

