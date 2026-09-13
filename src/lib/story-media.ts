import { supabase } from '@/lib/supabase';

const STORY_BUCKET = 'story-images';
const PUBLIC_MARKER = `/storage/v1/object/public/${STORY_BUCKET}/`;

export function storyStoragePath(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;

  const markerIndex = imageUrl.indexOf(PUBLIC_MARKER);
  if (markerIndex < 0) return null;

  const encodedPath = imageUrl.slice(markerIndex + PUBLIC_MARKER.length).split('?')[0];
  if (!encodedPath) return null;

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

export async function removeStoryImage(imageUrl: string | null | undefined, ownerId: string) {
  const path = storyStoragePath(imageUrl);
  if (!path) return;

  // Story objects are stored below the owner's auth id. Never remove a path
  // outside that namespace even if a malformed URL reaches the client.
  if (!path.startsWith(`${ownerId}/`)) {
    throw new Error('Hikâye görseli kullanıcı klasörüyle eşleşmiyor.');
  }

  const { error } = await supabase.storage.from(STORY_BUCKET).remove([path]);
  if (error) throw error;
}

export async function deleteStoryWithMedia(storyId: string, ownerId: string, imageUrl: string | null | undefined) {
  await removeStoryImage(imageUrl, ownerId);

  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId)
    .eq('user_id', ownerId);

  if (error) throw error;
}
