import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { requirePermanentImage } from './image-policy';
import { supabase } from './supabase';

export const WORK_COVER_WIDTH = 1200;
export const WORK_COVER_HEIGHT = 1800;
export const WORK_COVER_ASPECT = [2, 3] as const;

export async function pickWorkCover(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw Error('Kapak seçmek için galeri izni gerekli.');

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: WORK_COVER_ASPECT,
    quality: 1,
  });

  if (picked.canceled) return null;

  const asset = picked.assets[0];
  if (!asset?.uri) throw Error('Kapak görseli okunamadı.');

  const normalized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [
      {
        resize: {
          width: WORK_COVER_WIDTH,
          height: WORK_COVER_HEIGHT,
        },
      },
    ],
    {
      compress: 0.88,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw Error('Kapak yüklemek için oturum açmalısın.');

  const bytes = await (await fetch(normalized.uri)).arrayBuffer();
  if (!bytes.byteLength) throw Error('Kapak görseli hazırlanamadı.');
  if (bytes.byteLength > 5 * 1024 * 1024) {
    throw Error('İşlenen kapak görseli 5 MB sınırını aşıyor.');
  }

  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const result = await supabase.storage
    .from('work-covers')
    .upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (result.error) throw Error('Kapak yüklenemedi. Lütfen yeniden dene.');

  const url = supabase.storage
    .from('work-covers')
    .getPublicUrl(path)
    .data.publicUrl
    .replace('/object/public/', '/object/authenticated/');

  return requirePermanentImage(url);
}
