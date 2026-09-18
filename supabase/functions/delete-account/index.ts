import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'not_authenticated' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account: required Supabase environment variables are missing');
    return jsonResponse(500, { error: 'server_configuration_error' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: 'not_authenticated' });
  }

  const { data: storageRows, error: storageListError } = await userClient.rpc(
    'get_my_storage_objects'
  );

  if (storageListError) {
    console.error('delete-account: storage inventory failed', storageListError);
    return jsonResponse(500, { error: 'storage_inventory_failed' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const grouped = new Map<string, string[]>();
  for (const row of storageRows ?? []) {
    if (!row?.bucket_id || !row?.object_name) continue;
    const names = grouped.get(row.bucket_id) ?? [];
    names.push(row.object_name);
    grouped.set(row.bucket_id, names);
  }

  // Supabase Auth refuses to delete a user while that user still owns
  // Storage objects. Remove every known object through the Storage API first.
  // If any chunk cannot be removed, leave the Auth identity intact so the
  // deletion can be retried safely.
  for (const [bucketId, names] of grouped) {
    for (let index = 0; index < names.length; index += 100) {
      const chunk = names.slice(index, index + 100);
      let cleaned = false;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const { error: removeError } = await admin.storage.from(bucketId).remove(chunk);

        if (!removeError) {
          cleaned = true;
          break;
        }

        console.error('delete-account: storage cleanup attempt failed', {
          userId: user.id,
          bucketId,
          count: chunk.length,
          attempt,
          error: removeError,
        });

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
      }

      if (!cleaned) {
        return jsonResponse(500, {
          error: 'storage_cleanup_failed',
          account_deleted: false,
        });
      }
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);

  if (deleteError) {
    // Storage has already been removed because Supabase requires that ordering.
    // Surface a hard failure for operator follow-up rather than claiming success.
    console.error('delete-account: auth user deletion failed after storage cleanup', {
      userId: user.id,
      error: deleteError,
    });

    return jsonResponse(500, {
      error: 'account_delete_failed',
      storage_cleanup_completed: true,
    });
  }

  return jsonResponse(200, { ok: true });
});
