import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { requirePermanentImage } from './image-policy';
export async function pickWorkCover(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw Error('Kapak seçmek için galeri izni gerekli.');
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2,3], quality: .85 });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw Error('Kapak yüklemek için oturum açmalısın.');
  const mime = asset.mimeType ?? 'image/jpeg';
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string,string>)[mime];
  if (!ext) throw Error('Lütfen JPEG, PNG veya WebP görsel seç.');
  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw Error('Kapak 10 MB’dan küçük olmalı.');
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const result = await supabase.storage.from('work-covers').upload(path, bytes, { contentType: mime, upsert: false });
  if (result.error) throw Error('Kapak yüklenemedi. Lütfen yeniden dene.');
  const url = supabase.storage.from('work-covers').getPublicUrl(path).data.publicUrl.replace('/object/public/', '/object/authenticated/');
  return requirePermanentImage(url);
}
