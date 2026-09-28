import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENALEX_BASE = "https://api.openalex.org";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Mode =
  | "works" | "articles" | "theses" | "authors" | "journals" | "institutions"
  | "work_detail" | "author_detail" | "journal_detail" | "institution_detail"
  | "author_works" | "journal_works" | "institution_authors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=60" },
  });
}

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function cleanId(value: unknown, prefix: "W" | "A" | "S" | "I") {
  const raw = clean(value, 100);
  const match = raw.match(new RegExp(`(?:^|/)(${prefix}\\d+)$`, "i"));
  return match?.[1]?.toUpperCase() ?? "";
}

function adminClient() {
  const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secretMap ? JSON.parse(secretMap)?.default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Supabase server secret unavailable");
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function buildRequest(mode: Mode, body: any) {
  const limit = Math.min(50, Math.max(1, Number(body?.limit) || 24));
  const query = clean(body?.query);
  const q = encodeURIComponent(query);
  let url = "";
  let keyPart = "";

  switch (mode) {
    case "works":
      if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
      url = `${OPENALEX_BASE}/works?search=${q}&per-page=${limit}`; keyPart = query.toLocaleLowerCase("tr-TR"); break;
    case "articles":
      if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
      url = `${OPENALEX_BASE}/works?search=${q}&filter=type:article&per-page=${limit}`; keyPart = query.toLocaleLowerCase("tr-TR"); break;
    case "theses":
      if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
      url = `${OPENALEX_BASE}/works?search=${q}&filter=type:dissertation&per-page=${limit}`; keyPart = query.toLocaleLowerCase("tr-TR"); break;
    case "authors":
      if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
      url = `${OPENALEX_BASE}/authors?search=${q}&per-page=${limit}`; keyPart = query.toLocaleLowerCase("tr-TR"); break;
    case "journals":
      if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
      url = `${OPENALEX_BASE}/sources?search=${q}&filter=type:journal&per-page=${limit}`; keyPart = query.toLocaleLowerCase("tr-TR"); break;
    case "institutions":
      if (query.length < 2) throw new Error("QUERY_TOO_SHORT");
      url = `${OPENALEX_BASE}/institutions?search=${q}&per-page=${limit}`; keyPart = query.toLocaleLowerCase("tr-TR"); break;
    case "work_detail": {
      const id = cleanId(body?.id, "W"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/works/${id}`; keyPart = id; break;
    }
    case "author_detail": {
      const id = cleanId(body?.id, "A"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/authors/${id}`; keyPart = id; break;
    }
    case "journal_detail": {
      const id = cleanId(body?.id, "S"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/sources/${id}`; keyPart = id; break;
    }
    case "institution_detail": {
      const id = cleanId(body?.id, "I"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/institutions/${id}`; keyPart = id; break;
    }
    case "author_works": {
      const id = cleanId(body?.id, "A"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/works?filter=authorships.author.id:${id}&sort=publication_date:desc&per-page=${limit}`; keyPart = id; break;
    }
    case "journal_works": {
      const id = cleanId(body?.id, "S"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/works?filter=primary_location.source.id:${id}&sort=publication_date:desc&per-page=${limit}`; keyPart = id; break;
    }
    case "institution_authors": {
      const id = cleanId(body?.id, "I"); if (!id) throw new Error("INVALID_ID");
      url = `${OPENALEX_BASE}/authors?filter=last_known_institutions.id:${id}&sort=cited_by_count:desc&per-page=${limit}`; keyPart = id; break;
    }
  }

  return { url, limit, keyPart };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode as Mode;
    const allowed: Mode[] = ["works","articles","theses","authors","journals","institutions","work_detail","author_detail","journal_detail","institution_detail","author_works","journal_works","institution_authors"];
    if (!allowed.includes(mode)) return json({ error: "Invalid mode" }, 400);

    const { url, limit, keyPart } = buildRequest(mode, body);
    const cacheKey = `${mode}|${limit}|${keyPart}`;
    const supabase = adminClient();

    const { data: cached } = await supabase.from("academic_search_cache")
      .select("results,expires_at,hit_count").eq("cache_key", cacheKey).maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      void supabase.from("academic_search_cache").update({
        hit_count: Number(cached.hit_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      }).eq("cache_key", cacheKey);
      return json({ data: cached.results, cached: true });
    }

    const apiKey = Deno.env.get("OPENALEX_API_KEY");
    const upstreamUrl = apiKey ? `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}` : url;
    const response = await fetch(upstreamUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12_000) });

    if (!response.ok) {
      if (cached?.results) return json({ data: cached.results, cached: true, stale: true });
      return json({ error: "Academic provider temporarily unavailable", upstreamStatus: response.status }, 502);
    }

    const payload = await response.json();
    const data = mode.endsWith("_detail") ? payload : (Array.isArray(payload?.results) ? payload.results : []);

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
    if (message === "QUERY_TOO_SHORT" || message === "INVALID_ID") return json({ error: message }, 400);
    console.error("academic-search error", error);
    return json({ error: "Academic request failed" }, 500);
  }
});
