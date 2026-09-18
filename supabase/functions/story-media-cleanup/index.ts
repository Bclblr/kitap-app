import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ExpiredStory = {
  id: string;
  user_id: string;
  media_path: string | null;
};

type StorageCleanupCandidate = {
  id: string;
  bucket_id: string;
  object_name: string;
};

const AUTO_CLEANUP_BUCKETS = new Set([
  'post-images',
  'story-images',
  'avatars',
  'event-images',
  'work-covers',
]);

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('story-media-cleanup: required Supabase environment variables are missing');
    return jsonResponse(500, { error: 'server_configuration_error' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cleanupSecret = request.headers.get('x-story-cleanup-secret')?.trim() || null;
  const { data: tokenIsValid, error: tokenError } = await admin.rpc(
    'validate_story_cleanup_token',
    { p_token: cleanupSecret }
  );

  if (tokenError) {
    console.error('story-media-cleanup: scheduler token validation failed', tokenError);
    return jsonResponse(500, { error: 'scheduler_auth_validation_failed' });
  }

  if (tokenIsValid !== true) {
    return jsonResponse(401, { error: 'unauthorized' });
  }

  const cutoff = new Date().toISOString();
  let deletedStories = 0;
  let deletedMedia = 0;
  let skippedUnsafeMedia = 0;

  for (let batch = 0; batch < 5; batch += 1) {
    const { data, error } = await admin.rpc('get_expired_story_cleanup_candidates', {
      p_cutoff: cutoff,
      p_limit: 200,
    });

    if (error) {
      console.error('story-media-cleanup: expired story query failed', error);
      return jsonResponse(500, { error: 'expired_story_query_failed' });
    }

    const stories = (data ?? []) as ExpiredStory[];
    if (!stories.length) break;

    const paths = Array.from(
      new Set(
        stories
          .map((story) => story.media_path)
          .filter((path): path is string => !!path)
      )
    );

    skippedUnsafeMedia += stories.filter((story) => !story.media_path).length;

    for (let index = 0; index < paths.length; index += 100) {
      const chunk = paths.slice(index, index + 100);
      const { error: removeError } = await admin.storage.from('story-images').remove(chunk);

      if (removeError) {
        console.error('story-media-cleanup: storage delete failed', {
          count: chunk.length,
          error: removeError,
        });
        return jsonResponse(500, { error: 'story_media_delete_failed' });
      }

      deletedMedia += chunk.length;
    }

    const ids = stories.map((story) => story.id);
    const { error: deleteError } = await admin
      .from('stories')
      .delete()
      .in('id', ids)
      .lte('expires_at', cutoff);

    if (deleteError) {
      console.error('story-media-cleanup: story delete failed', deleteError);
      return jsonResponse(500, { error: 'expired_story_delete_failed' });
    }

    deletedStories += ids.length;
    if (stories.length < 200) break;
  }

  const orphanResult = await admin.rpc('get_orphan_story_storage_paths', {
    p_limit: 500,
  });

  if (orphanResult.error) {
    console.error('story-media-cleanup: orphan inventory failed', orphanResult.error);
    return jsonResponse(500, { error: 'orphan_inventory_failed' });
  }

  const orphanRows = (orphanResult.data ?? []) as { storage_path?: string | null }[];
  const orphanPaths: string[] = Array.from(
    new Set<string>(
      orphanRows
        .map((row) => row.storage_path)
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
    )
  );

  for (let index = 0; index < orphanPaths.length; index += 100) {
    const chunk = orphanPaths.slice(index, index + 100);
    const { error: removeError } = await admin.storage.from('story-images').remove(chunk);

    if (removeError) {
      console.error('story-media-cleanup: orphan media delete failed', {
        count: chunk.length,
        error: removeError,
      });
      return jsonResponse(500, { error: 'orphan_media_delete_failed' });
    }

    deletedMedia += chunk.length;
  }

  let queuedCleanupDeleted = 0;
  let queuedCleanupFailed = 0;

  const { data: cleanupRows, error: cleanupLoadError } = await admin.rpc(
    'get_automatic_storage_cleanup_candidates',
    { p_limit: 200 }
  );

  if (cleanupLoadError) {
    console.error('story-media-cleanup: cleanup queue load failed', cleanupLoadError);
    return jsonResponse(500, { error: 'cleanup_queue_load_failed' });
  }

  const cleanupCandidates = (cleanupRows ?? []) as StorageCleanupCandidate[];
  const groupedCleanup = new Map<string, StorageCleanupCandidate[]>();

  for (const candidate of cleanupCandidates) {
    if (
      !candidate?.id ||
      !candidate.bucket_id ||
      !candidate.object_name ||
      !AUTO_CLEANUP_BUCKETS.has(candidate.bucket_id) ||
      candidate.object_name.includes('..')
    ) {
      continue;
    }

    const group = groupedCleanup.get(candidate.bucket_id) ?? [];
    group.push(candidate);
    groupedCleanup.set(candidate.bucket_id, group);
  }

  for (const [bucketId, candidates] of groupedCleanup) {
    for (let index = 0; index < candidates.length; index += 100) {
      const chunk = candidates.slice(index, index + 100);
      const ids = chunk.map((candidate) => candidate.id);
      const paths = chunk.map((candidate) => candidate.object_name);

      const { error: removeError } = await admin.storage
        .from(bucketId)
        .remove(paths);

      const { error: recordError } = await admin.rpc(
        'record_automatic_storage_cleanup_result',
        {
          p_ids: ids,
          p_success: !removeError,
          p_error: removeError?.message ?? null,
        }
      );

      if (recordError) {
        console.error('story-media-cleanup: cleanup queue result update failed', {
          bucketId,
          count: chunk.length,
          error: recordError,
        });
        return jsonResponse(500, { error: 'cleanup_queue_result_update_failed' });
      }

      if (removeError) {
        queuedCleanupFailed += chunk.length;
        console.error('story-media-cleanup: queued storage cleanup failed', {
          bucketId,
          count: chunk.length,
          error: removeError,
        });
      } else {
        queuedCleanupDeleted += chunk.length;
        deletedMedia += chunk.length;
      }
    }
  }

  return jsonResponse(200, {
    ok: true,
    deleted_stories: deletedStories,
    deleted_media: deletedMedia,
    deleted_orphans: orphanPaths.length,
    skipped_unsafe_media: skippedUnsafeMedia,
    queued_cleanup_deleted: queuedCleanupDeleted,
    queued_cleanup_failed: queuedCleanupFailed,
  });
});
