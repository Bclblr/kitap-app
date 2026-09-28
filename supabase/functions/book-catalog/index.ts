import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPEN_LIBRARY_BASE = "https://openlibrary.org";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MODES = ["book_search", "book_author_search", "book_author_works", "book_record"] as const;
type Mode = typeof MODES[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=60" },
  });
}

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normalizeRecordKey(value: unknown) {
  const raw = clean(value, 120);
  if (/^OL\d+W$/i.test(raw)) return `/works/${raw.toUpperCase()}`;
  if (/^OL\d+M$/i.test(raw)) return `/books/${raw.toUpperCase()}`;
  if (/^OL\d+A$/i.test(raw)) return `/authors/${raw.toUpperCase()}`;

  const match = raw.match(/^\/(works\/OL\d+W|books\/OL\d+M|authors\/OL\d+A)(?:\.json)?$/i);
  return match ? `/${match[1]}` : "";
}

function adminClient() {
  const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secretMap ? JSON.parse(secretMap)?.default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Supabase server secret unavailable");
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function upstreamHeaders() {
  const contact = clean(Deno.env.get("OPEN_LIBRARY_CONTACT_EMAIL"), 160);
  return {
    accept: "application/json",
    "user-agent": contact
      ? `KitapApp/1.0 (${contact})`
      : "KitapApp/1.0 (Supabase Edge Function)",
  };
}

function buildRequest(mode: Mode, body: any) {
  const limit = Math.min(50, Math.max(1, Number(body?.limit) || (mode === "book_author_search" ? 10 : 20)));

  if (mode === "book_record") {
    const key = normalizeRecordKey(body?.key);
    if (!key) throw new Error("INVALID_KEY");
    return {
      url: `${OPEN_LIBRARY_BASE}${key}.json`,
      keyPart: key.toLowerCase(),
      limit: 1,
    };
  }

  const query = clean(body?.query);
  if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
  const q = encodeURIComponent(query);

  if (mode === "book_author_works") {
    return {
      url: `${OPEN_LIBRARY_BASE}/search.json?author=${q}&limit=${limit}&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year`,
      keyPart: query.toLocaleLowerCase("tr-TR"),
      limit,
    };
  }

  if (mode === "book_author_search") {
    return {
      url: `${OPEN_LIBRARY_BASE}/search/authors.json?q=${q}&limit=${limit}`,
      keyPart: query.toLocaleLowerCase("tr-TR"),
      limit,
    };
  }

  return {
    url: `${OPEN_LIBRARY_BASE}/search.json?q=${q}&limit=${limit}&fields=key,title,author_name,cover_i,edition_key,isbn,first_publish_year`,
    keyPart: query.toLocaleLowerCase("tr-TR"),
    limit,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode as Mode;
    if (!MODES.includes(mode)) return json({ error: "Invalid mode" }, 400);

    const { url, keyPart, limit } = buildRequest(mode, body);
    const cacheKey = `${mode}|${limit}|${keyPart}`;
    const supabase = adminClient();

    const { data: cached } = await supabase
      .from("academic_search_cache")
      .select("results,expires_at,hit_count")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      void supabase.from("academic_search_cache").update({
        hit_count: Number(cached.hit_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      }).eq("cache_key", cacheKey);
      return json({ data: cached.results, cached: true });
    }

    const response = await fetch(url, {
      headers: upstreamHeaders(),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      if (cached?.results) return json({ data: cached.results, cached: true, stale: true });
      return json({ error: "Book provider temporarily unavailable", upstreamStatus: response.status }, 502);
    }

    const payload = await response.json();
    const data = mode === "book_search" || mode === "book_author_works"
      ? (Array.isArray(payload?.docs) ? payload.docs : [])
      : mode === "book_author_search"
        ? (Array.isArray(payload?.docs) ? payload.docs : [])
        : payload;

    await supabase.from("academic_search_cache").upsert({
      cache_key: cacheKey,
      entity_type: mode,
      query_text: keyPart,
      result_limit: limit,
      results: data,
      result_count: Array.isArray(data) ? data.length : 1,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      hit_count: 0,
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "cache_key" });

    return json({ data, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "QUERY_TOO_SHORT" || message === "INVALID_KEY") return json({ error: message }, 400);
    console.error("book-catalog error", error);
    return json({ error: "Book catalog request failed" }, 500);
  }
});
