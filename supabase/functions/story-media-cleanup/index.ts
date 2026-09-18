import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ExpiredStory = {
  id: string;
  storage_path: string | null;
  image_url: string | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function legacyStoragePath(imageUrl: string | null) {
  if (!imageUrl) return null;
  const marker = '/storage/v1/object/public/story-images/';
  const index = imageUrl.indexOf(marker);
  if (index < 0) return null;
  const value = imageUrl.slice(index + marker.length).split('?')[0];
  return value || null;
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

  const cutoff = new Date().toISOString();
  let deletedStories = 0;
  let deletedMedia = 0;

  for (let batch = 0; batch < 5; batch += 1) {
    const { data, error } = await admin
      .from('stories')
      .select('id, storage_path, image_url')
      .lte('expires_at', cutoff)
      .order('expires_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('story-media-cleanup: expired story query failed', error);
      return jsonResponse(500, { error: 'expired_story_query_failed' });
    }

    const stories = (data ?? []) as ExpiredStory[];
    if (!stories.length) break;

    const paths = Array.from(
      new Set(
        stories
          .map((story) => story.storage_path || legacyStoragePath(story.image_url))
          .filter((path): path is string => !!path)
      )
    );

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

  const orphanPaths = Array.from(
    new Set(
      (orphanResult.data ?? [])
        .map((row: { storage_path?: string | null }) => row.storage_path)
        .filter((path: string | null | undefined): path is string => !!path)
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

  return jsonResponse(200, {
    ok: true,
    deleted_stories: deletedStories,
    deleted_media: deletedMedia,
    deleted_orphans: orphanPaths.length,
  });
});
