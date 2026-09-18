import { supabase } from './supabase';

export type ManagedMediaBucket =
  | 'post-images'
  | 'story-images'
  | 'avatars'
  | 'event-images'
  | 'work-covers';

export async function cleanupUploadedMedia(
  bucket: ManagedMediaBucket,
  objectPath: string,
  reason = 'client_rollback_failed'
) {
  const path = objectPath.trim();
  if (!path) return true;

  const removal = await supabase.storage.from(bucket).remove([path]);
  if (!removal.error) return true;

  console.warn('Media rollback remove failed; queuing cleanup:', {
    bucket,
    path,
    error: removal.error.message,
  });

  const queued = await supabase.rpc('queue_my_storage_cleanup', {
    p_bucket: bucket,
    p_object_name: path,
    p_reason: reason,
  });

  if (queued.error) {
    console.error('Media cleanup could not be queued:', queued.error);
  }

  return false;
}
