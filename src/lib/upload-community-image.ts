import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { requirePermanentImage } from './image-policy';
import { supabase } from './supabase';

type CommunityImageKind = 'cover' | 'post';

export async function pickCommunityImage(kind: CommunityImageKind): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw Error('Görsel seçmek için galeri izni gerekli.');

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset?.uri) throw Error('Görsel okunamadı.');

  const normalized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: kind === 'cover' ? 1400 : 1200 } }],
    { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Error('Görsel yüklemek için giriş yapmalısın.');

  const bytes = await (await fetch(normalized.uri)).arrayBuffer();
  if (!bytes.byteLength) throw Error('Görsel hazırlanamadı.');
  if (bytes.byteLength > 8 * 1024 * 1024) throw Error('Görsel 8 MB sınırını aşıyor.');

  const path = `${user.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const upload = await supabase.storage.from('community-images').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (upload.error) throw Error('Görsel yüklenemedi. Tekrar deneyebilirsin.');

  const url = supabase.storage
    .from('community-images')
    .getPublicUrl(path)
    .data.publicUrl
    .replace('/object/public/', '/object/authenticated/');

  return requirePermanentImage(url);
}
