


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_add_sanction"("p_user_id" "uuid", "p_type" "text", "p_reason" "text" DEFAULT ''::"text", "p_ends_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
begin

  if not public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if p_type not in (
    'warning',
    'suspension',
    'ban',
    'comment_restriction',
    'post_restriction',
    'message_restriction',
    'community_restriction'
  ) then
    raise exception 'invalid sanction type';
  end if;

  if not exists(
    select 1
    from auth.users u
    where u.id=p_user_id
  ) then
    raise exception 'user not found';
  end if;

  if p_ends_at is not null
     and p_ends_at<=now() then
    raise exception
      'end time must be in the future';
  end if;

  insert into public.user_sanctions(
    user_id,
    sanction_type,
    reason,
    ends_at,
    created_by
  )
  values(
    p_user_id,
    p_type,
    coalesce(p_reason,''),
    p_ends_at,
    auth.uid()
  )
  returning id into v_id;

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    new_value
  )
  values(
    auth.uid(),
    'sanction_added',
    'user',
    p_user_id::text,
    coalesce(p_reason,''),
    jsonb_build_object(
      'sanction_id',v_id,
      'type',p_type,
      'ends_at',p_ends_at
    )
  );

  return v_id;

end;
$$;


ALTER FUNCTION "public"."admin_add_sanction"("p_user_id" "uuid", "p_type" "text", "p_reason" "text", "p_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_analytics_daily"("p_days" integer DEFAULT 14) RETURNS TABLE("day" "date", "new_users" bigint, "posts" bigint, "reviews" bigint, "quotes" bigint, "comments" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with days as (
    select generate_series(
      current_date -
        (
          greatest(
            1,
            least(
              coalesce(p_days, 14),
              90
            )
          ) - 1
        ),
      current_date,
      interval '1 day'
    )::date as day
  )

  select
    d.day,

    (
      select count(*)
      from auth.users u
      where
        u.created_at >= d.day
        and u.created_at < d.day + 1
    ),

    (
      select count(*)
      from public.posts p
      where
        p.created_at >= d.day
        and p.created_at < d.day + 1
    ),

    (
      select count(*)
      from public.reviews r
      where
        r.created_at >= d.day
        and r.created_at < d.day + 1
    ),

    (
      select count(*)
      from public.quotes q
      where
        q.created_at >= d.day
        and q.created_at < d.day + 1
    ),

    (
      (
        select count(*)
        from public.post_comments pc
        where
          pc.created_at >= d.day
          and pc.created_at < d.day + 1
      )
      +
      (
        select count(*)
        from public.comments c
        where
          c.created_at >= d.day
          and c.created_at < d.day + 1
      )
    )

  from days d

  where public.has_admin_role(
    array['admin','super_admin']
  )

  order by d.day;
$$;


ALTER FUNCTION "public"."admin_analytics_daily"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_analytics_overview"() RETURNS TABLE("total_users" bigint, "users_7d" bigint, "users_30d" bigint, "total_posts" bigint, "posts_7d" bigint, "total_reviews" bigint, "reviews_7d" bigint, "total_quotes" bigint, "quotes_7d" bigint, "total_comments" bigint, "comments_7d" bigint, "total_communities" bigint, "total_events" bigint, "pending_reports" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    (select count(*) from auth.users),

    (select count(*)
     from auth.users
     where created_at >= now() - interval '7 days'),

    (select count(*)
     from auth.users
     where created_at >= now() - interval '30 days'),

    (select count(*) from public.posts),

    (select count(*)
     from public.posts
     where created_at >= now() - interval '7 days'),

    (select count(*) from public.reviews),

    (select count(*)
     from public.reviews
     where created_at >= now() - interval '7 days'),

    (select count(*) from public.quotes),

    (select count(*)
     from public.quotes
     where created_at >= now() - interval '7 days'),

    (
      (select count(*) from public.post_comments)
      +
      (select count(*) from public.comments)
    ),

    (
      (select count(*)
       from public.post_comments
       where created_at >= now() - interval '7 days')
      +
      (select count(*)
       from public.comments
       where created_at >= now() - interval '7 days')
    ),

    (select count(*) from public.communities),

    (select count(*) from public.events),

    (select count(*)
     from public.reports
     where status = 'pending')

  where public.has_admin_role(
    array['admin','super_admin']
  );
$$;


ALTER FUNCTION "public"."admin_analytics_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_audit_filter_options"() RETURNS TABLE("actions" "text"[], "target_types" "text"[])
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    coalesce(
      array_agg(
        distinct l.action
        order by l.action
      )
      filter (
        where l.action is not null
      ),
      '{}'::text[]
    ),
    coalesce(
      array_agg(
        distinct l.target_type
        order by l.target_type
      )
      filter (
        where l.target_type is not null
      ),
      '{}'::text[]
    )
  from public.admin_audit_logs l
  where public.has_admin_role(
    array['admin','super_admin']
  );
$$;


ALTER FUNCTION "public"."admin_audit_filter_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_create_config_snapshot"("p_label" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_snapshot jsonb;
begin

  if not public.has_admin_role(
    array['super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'app_settings',
    (
      select coalesce(
        jsonb_agg(to_jsonb(s)),
        '[]'::jsonb
      )
      from public.app_settings s
    ),

    'feature_flags',
    (
      select coalesce(
        jsonb_agg(to_jsonb(f)),
        '[]'::jsonb
      )
      from public.feature_flags f
    ),

    'profile_controls',
    (
      select coalesce(
        jsonb_agg(to_jsonb(c)),
        '[]'::jsonb
      )
      from public.profile_admin_controls c
    ),

    'user_roles',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id',u.user_id,
            'role',u.role
          )
        ),
        '[]'::jsonb
      )
      from public.user_roles u
    )
  )
  into v_snapshot;

  insert into public.admin_config_snapshots(
    created_by,
    label,
    snapshot
  )
  values(
    auth.uid(),
    left(coalesce(p_label,''),200),
    v_snapshot
  )
  returning id into v_id;

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    new_value
  )
  values(
    auth.uid(),
    'config_snapshot_created',
    'system',
    v_id::text,
    jsonb_build_object(
      'label',
      left(coalesce(p_label,''),200)
    )
  );

  return v_id;

end;
$$;


ALTER FUNCTION "public"."admin_create_config_snapshot"("p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_announcement"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
begin

  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  select to_jsonb(a)
  into v_old
  from public.announcements a
  where a.id = p_id;

  if v_old is null then
    raise exception 'announcement not found';
  end if;

  delete from public.announcements
  where id = p_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value
  )
  values (
    auth.uid(),
    'announcement_deleted',
    'announcement',
    p_id::text,
    v_old
  );

end;
$$;


ALTER FUNCTION "public"."admin_delete_announcement"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_content"("p_target_type" "text", "p_target_id" "uuid", "p_reason" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_admin_id uuid := auth.uid();
  v_snapshot jsonb;
  v_deleted boolean := false;
begin

  if v_admin_id is null
     or not public.has_admin_role(
       array['moderator','admin','super_admin']
     ) then
    raise exception 'Yetkisiz erişim';
  end if;

  case p_target_type
    when 'post' then
      select to_jsonb(t)
      into v_snapshot
      from public.posts t
      where id = p_target_id;

    when 'review' then
      select to_jsonb(t)
      into v_snapshot
      from public.reviews t
      where id = p_target_id;

    when 'quote' then
      select to_jsonb(t)
      into v_snapshot
      from public.quotes t
      where id = p_target_id;

    when 'comment' then
      select to_jsonb(t)
      into v_snapshot
      from public.comments t
      where id = p_target_id;

    when 'post_comment' then
      select to_jsonb(t)
      into v_snapshot
      from public.post_comments t
      where id = p_target_id;

    else
      raise exception
        'Desteklenmeyen içerik türü: %',
        p_target_type;
  end case;

  if v_snapshot is null then
    raise exception 'İçerik bulunamadı';
  end if;

  insert into public.admin_trash_items(
    target_type,
    target_id,
    snapshot,
    reason,
    deleted_by
  )
  values(
    p_target_type,
    p_target_id,
    v_snapshot,
    coalesce(p_reason,''),
    v_admin_id
  )
  on conflict (target_type,target_id)
    where restored_at is null
  do update set
    snapshot = excluded.snapshot,
    reason = excluded.reason,
    deleted_by = excluded.deleted_by,
    deleted_at = now();

  case p_target_type
    when 'post' then
      delete from public.posts
      where id = p_target_id;
      v_deleted := found;

    when 'review' then
      delete from public.reviews
      where id = p_target_id;
      v_deleted := found;

    when 'quote' then
      delete from public.quotes
      where id = p_target_id;
      v_deleted := found;

    when 'comment' then
      delete from public.comments
      where id = p_target_id;
      v_deleted := found;

    when 'post_comment' then
      delete from public.post_comments
      where id = p_target_id;
      v_deleted := found;
  end case;

  if not v_deleted then
    raise exception 'İçerik silinemedi';
  end if;

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value
  )
  values(
    v_admin_id,
    'content_moved_to_trash',
    p_target_type,
    p_target_id::text,
    coalesce(p_reason,''),
    v_snapshot,
    jsonb_build_object('trashed',true)
  );

  return jsonb_build_object(
    'ok',true,
    'target_type',p_target_type,
    'target_id',p_target_id,
    'trashed',true
  );
end;
$$;


ALTER FUNCTION "public"."admin_delete_content"("p_target_type" "text", "p_target_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_explore_item"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
begin
  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  select to_jsonb(e)
  into v_old
  from public.explore_featured_items e
  where e.id = p_id;

  if v_old is null then
    return;
  end if;

  delete from public.explore_featured_items
  where id = p_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value
  )
  values (
    auth.uid(),
    'explore_feature_delete',
    'explore_item',
    p_id::text,
    v_old
  );
end;
$$;


ALTER FUNCTION "public"."admin_delete_explore_item"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_feature_flag"("p_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  select to_jsonb(f)
  into v_old
  from public.feature_flags f
  where f.key = trim(p_key);

  if v_old is null then
    raise exception 'feature flag not found';
  end if;

  delete from public.feature_flags
  where key = trim(p_key);

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    old_value
  )
  values(
    auth.uid(),
    'feature_flag_deleted',
    'feature_flag',
    trim(p_key),
    v_old
  );

end;
$$;


ALTER FUNCTION "public"."admin_delete_feature_flag"("p_key" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."premium_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "product_id" "text",
    "entitlement_id" "text" DEFAULT 'premium'::"text" NOT NULL,
    "source_reference" "text",
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_event_at" timestamp with time zone,
    "provider_event_id" "text",
    "provider_event_type" "text",
    "will_renew" boolean,
    CONSTRAINT "premium_entitlements_dates_check" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "starts_at"))),
    CONSTRAINT "premium_entitlements_entitlement_id_check" CHECK (("entitlement_id" = 'premium'::"text")),
    CONSTRAINT "premium_entitlements_revoked_check" CHECK ((("status" <> 'revoked'::"text") OR ("revoked_at" IS NOT NULL))),
    CONSTRAINT "premium_entitlements_source_boundary_check" CHECK (((("source" = 'admin_grant'::"text") AND ("source_reference" = 'admin'::"text") AND ("product_id" IS NULL) AND ("provider_event_at" IS NULL) AND ("provider_event_id" IS NULL) AND ("provider_event_type" IS NULL) AND ("will_renew" IS NULL)) OR (("source" = ANY (ARRAY['apple'::"text", 'google'::"text"])) AND (NULLIF(TRIM(BOTH FROM COALESCE("source_reference", ''::"text")), ''::"text") IS NOT NULL) AND ("revoked_at" IS NULL) AND ("status" <> 'revoked'::"text")))),
    CONSTRAINT "premium_entitlements_source_check" CHECK (("source" = ANY (ARRAY['apple'::"text", 'google'::"text", 'admin_grant'::"text"]))),
    CONSTRAINT "premium_entitlements_status_check" CHECK (("status" = ANY (ARRAY['inactive'::"text", 'active'::"text", 'trialing'::"text", 'grace_period'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."premium_entitlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."premium_entitlements" IS 'Premium access records. Multiple rows per user allow paid and admin-granted access to coexist safely.';



COMMENT ON COLUMN "public"."premium_entitlements"."source" IS 'Origin of premium access: Apple purchase, Google Play purchase, or an admin grant.';



COMMENT ON COLUMN "public"."premium_entitlements"."source_reference" IS 'Provider transaction/subscription identifier or an admin-grant identifier. Never trust values supplied directly by the client.';



CREATE OR REPLACE FUNCTION "public"."admin_grant_premium"("p_user_id" "uuid", "p_duration" "text" DEFAULT 'unlimited'::"text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."premium_entitlements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_admin_id uuid := auth.uid();
  v_row public.premium_entitlements;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_expires_at timestamptz;
  v_duration text := lower(trim(coalesce(p_duration, 'unlimited')));
begin
  if v_admin_id is null
     or not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'Admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
     ) then
    raise exception 'Target user not found'
      using errcode = 'P0002';
  end if;

  v_expires_at := case v_duration
    when '7_days' then now() + interval '7 days'
    when '30_days' then now() + interval '30 days'
    when '1_year' then now() + interval '1 year'
    when 'unlimited' then null
    else null
  end;

  if v_duration not in (
    '7_days',
    '30_days',
    '1_year',
    'unlimited'
  ) then
    raise exception 'Invalid Premium duration'
      using errcode = '22023';
  end if;

  select pe.*
  into v_row
  from public.premium_entitlements pe
  where pe.user_id = p_user_id
    and pe.source = 'admin_grant'
    and coalesce(pe.source_reference, '') = 'admin'
  order by pe.created_at desc
  limit 1
  for update;

  if found then
    update public.premium_entitlements
    set
      status = 'active',
      product_id = null,
      entitlement_id = 'premium',
      starts_at = now(),
      expires_at = v_expires_at,
      revoked_at = null,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.premium_entitlements (
      user_id,
      source,
      status,
      product_id,
      entitlement_id,
      source_reference,
      starts_at,
      expires_at,
      revoked_at
    )
    values (
      p_user_id,
      'admin_grant',
      'active',
      null,
      'premium',
      'admin',
      now(),
      v_expires_at,
      null
    )
    returning * into v_row;
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'premium_admin_granted',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'entitlement_id', v_row.id,
      'source', v_row.source,
      'status', v_row.status,
      'starts_at', v_row.starts_at,
      'expires_at', v_row.expires_at
    ),
    jsonb_build_object(
      'grant_type', 'free_admin_grant',
      'duration', v_duration
    )
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_grant_premium"("p_user_id" "uuid", "p_duration" "text", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verified_accounts" (
    "user_id" "uuid" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "verified_accounts_state_check" CHECK (((("is_verified" = true) AND ("verified_at" IS NOT NULL) AND ("revoked_at" IS NULL)) OR ("is_verified" = false)))
);


ALTER TABLE "public"."verified_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."verified_accounts" IS 'Independent verified-account status. This is not a Premium entitlement and must never be derived from purchases.';



COMMENT ON COLUMN "public"."verified_accounts"."is_verified" IS 'Whether the account currently has the platform verification badge.';



CREATE OR REPLACE FUNCTION "public"."admin_grant_verification"("p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."verified_accounts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_admin_id uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_previous public.verified_accounts;
  v_row public.verified_accounts;
begin
  if v_admin_id is null
     or not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'Admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
     ) then
    raise exception 'Target user not found'
      using errcode = 'P0002';
  end if;

  select va.*
  into v_previous
  from public.verified_accounts va
  where va.user_id = p_user_id
  for update;

  insert into public.verified_accounts (
    user_id,
    is_verified,
    verified_at,
    verified_by,
    revoked_at,
    revoked_by,
    reason
  )
  values (
    p_user_id,
    true,
    now(),
    v_admin_id,
    null,
    null,
    v_reason
  )
  on conflict (user_id) do update
  set
    is_verified = true,
    verified_at = now(),
    verified_by = v_admin_id,
    revoked_at = null,
    revoked_by = null,
    reason = v_reason,
    updated_at = now()
  returning * into v_row;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'verification_granted',
    'user',
    p_user_id::text,
    v_reason,
    case
      when v_previous.user_id is null then null
      else jsonb_build_object(
        'is_verified', v_previous.is_verified,
        'verified_at', v_previous.verified_at,
        'verified_by', v_previous.verified_by,
        'revoked_at', v_previous.revoked_at,
        'revoked_by', v_previous.revoked_by
      )
    end,
    jsonb_build_object(
      'is_verified', v_row.is_verified,
      'verified_at', v_row.verified_at,
      'verified_by', v_row.verified_by
    ),
    jsonb_build_object(
      'source', 'admin_panel',
      'independent_from_premium', true
    )
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_grant_verification"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_admin_accounts"() RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "profile_image" "text", "role" "text", "updated_at" timestamp with time zone, "updated_by" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    ur.user_id,
    p.username,
    p.full_name,
    p.profile_image,
    ur.role,
    ur.updated_at,
    ur.updated_by
  from public.user_roles ur
  left join public.profiles p
    on p.id = ur.user_id
  where public.has_admin_role(array['super_admin'])
    and ur.role in (
      'moderator',
      'admin',
      'super_admin'
    )
  order by
    case ur.role
      when 'super_admin' then 1
      when 'admin' then 2
      else 3
    end,
    lower(coalesce(p.username,'')),
    ur.user_id;
$$;


ALTER FUNCTION "public"."admin_list_admin_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_announcements"("p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "title" "text", "body" "text", "kind" "text", "action_route" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "active" boolean, "created_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    a.id,
    a.title,
    a.body,
    a.kind,
    a.action_route,
    a.starts_at,
    a.ends_at,
    a.active,
    a.created_by,
    a.created_at,
    a.updated_at
  from public.announcements a
  where public.has_admin_role(array['admin','super_admin'])
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;


ALTER FUNCTION "public"."admin_list_announcements"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_audit_logs"("p_search" "text" DEFAULT ''::"text", "p_action" "text" DEFAULT NULL::"text", "p_target_type" "text" DEFAULT NULL::"text", "p_admin_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "admin_id" "uuid", "admin_username" "text", "admin_full_name" "text", "action" "text", "target_type" "text", "target_id" "text", "reason" "text", "old_value" "jsonb", "new_value" "jsonb", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    l.id,
    l.admin_id,
    p.username,
    p.full_name,
    l.action,
    l.target_type,
    l.target_id,
    l.reason,
    l.old_value,
    l.new_value,
    l.metadata,
    l.created_at
  from public.admin_audit_logs l
  left join public.profiles p
    on p.id = l.admin_id
  where public.has_admin_role(
    array['admin','super_admin']
  )
    and (
      p_admin_id is null
      or l.admin_id = p_admin_id
    )
    and (
      coalesce(trim(p_action),'') = ''
      or l.action = trim(p_action)
    )
    and (
      coalesce(trim(p_target_type),'') = ''
      or l.target_type = trim(p_target_type)
    )
    and (
      coalesce(trim(p_search),'') = ''
      or lower(coalesce(p.username,''))
        like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(p.full_name,''))
        like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(l.action,''))
        like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(l.target_type,''))
        like '%' || lower(left(trim(p_search),200)) || '%'
      or lower(coalesce(l.target_id,''))
        like '%' || lower(left(trim(p_search),200)) || '%'
      or l.admin_id::text
        like '%' || lower(left(trim(p_search),200)) || '%'
    )
  order by l.created_at desc
  limit greatest(
    1,
    least(
      coalesce(p_limit,100),
      250
    )
  )
  offset greatest(
    0,
    coalesce(p_offset,0)
  );
$$;


ALTER FUNCTION "public"."admin_list_audit_logs"("p_search" "text", "p_action" "text", "p_target_type" "text", "p_admin_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_authors"("p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "profile_image" "text", "pen_name" "text", "verified" boolean, "featured" boolean, "priority" integer, "work_count" bigint, "published_work_count" bigint, "draft_work_count" bigint, "last_work_updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  return query

  select
    p.id as user_id,
    p.username::text,
    p.full_name::text,
    p.profile_image::text,
    ap.pen_name::text,

    coalesce(
      ap.verified,
      false
    ) as verified,

    coalesce(
      ap.featured,
      false
    ) as featured,

    coalesce(
      ap.priority,
      0
    ) as priority,

    count(w.id)::bigint
      as work_count,

    count(w.id)
      filter (
        where w.status = 'published'
      )::bigint
      as published_work_count,

    count(w.id)
      filter (
        where w.status = 'draft'
      )::bigint
      as draft_work_count,

    max(w.updated_at)
      as last_work_updated_at

  from public.profiles p

  join public.works w
    on w.author_id = p.id

  left join public.author_profiles ap
    on ap.user_id = p.id

  where
    coalesce(
      trim(p_search),
      ''
    ) = ''

    or coalesce(
      p.username,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      p.full_name,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      ap.pen_name,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or p.id::text ilike
      '%' || trim(p_search) || '%'

  group by
    p.id,
    p.username,
    p.full_name,
    p.profile_image,
    ap.pen_name,
    ap.verified,
    ap.featured,
    ap.priority

  order by
    coalesce(
      ap.featured,
      false
    ) desc,

    coalesce(
      ap.priority,
      0
    ) desc,

    count(w.id) desc,

    max(w.updated_at)
      desc nulls last

  limit greatest(
    1,
    least(
      coalesce(
        p_limit,
        100
      ),
      200
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_list_authors"("p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_communities"("p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "image_url" "text", "kind" "text", "visibility" "text", "created_by" "uuid", "owner_username" "text", "member_count" bigint, "admin_count" bigint, "verified" boolean, "featured" boolean, "priority" integer, "restricted" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  return query

  select
    c.id,
    c.name::text,
    c.description::text,
    c.image_url::text,
    c.kind::text,
    c.visibility::text,
    c.created_by,

    coalesce(
      p.username,
      'Kitap Okuru'
    )::text as owner_username,

    count(m.user_id)::bigint
      as member_count,

    count(m.user_id)
      filter (
        where m.role in ('owner','admin')
      )::bigint
      as admin_count,

    coalesce(
      ac.verified,
      false
    ) as verified,

    coalesce(
      ac.featured,
      false
    ) as featured,

    coalesce(
      ac.priority,
      0
    ) as priority,

    coalesce(
      ac.restricted,
      false
    ) as restricted,

    c.created_at

  from public.communities c

  left join public.profiles p
    on p.id = c.created_by

  left join public.community_members m
    on m.community_id = c.id

  left join public.community_admin_controls ac
    on ac.community_id = c.id

  where
    coalesce(trim(p_search), '') = ''

    or c.name ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      c.description,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      p.username,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or c.id::text ilike
      '%' || trim(p_search) || '%'

  group by
    c.id,
    p.username,
    ac.verified,
    ac.featured,
    ac.priority,
    ac.restricted

  order by
    coalesce(ac.featured, false) desc,
    coalesce(ac.priority, 0) desc,
    count(m.user_id) desc,
    c.created_at desc

  limit greatest(
    1,
    least(
      coalesce(p_limit, 100),
      200
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_list_communities"("p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_community_members"("p_community_id" "uuid") RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "role" "text", "joined_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  return query

  select
    m.user_id,

    coalesce(
      p.username,
      'Kitap Okuru'
    )::text,

    p.full_name::text,
    m.role::text,
    m.joined_at

  from public.community_members m

  left join public.profiles p
    on p.id = m.user_id

  where m.community_id = p_community_id

  order by
    case m.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    m.joined_at asc;

end;
$$;


ALTER FUNCTION "public"."admin_list_community_members"("p_community_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_event_attendees"("p_event_id" "uuid") RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "profile_image" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  return query

  select
    a.user_id,

    coalesce(
      p.username,
      'Kitap Okuru'
    )::text,

    p.full_name::text,
    p.profile_image::text

  from public.event_attendees a

  left join public.profiles p
    on p.id = a.user_id

  where a.event_id = p_event_id

  order by
    coalesce(
      p.username,
      'Kitap Okuru'
    ) asc;

end;
$$;


ALTER FUNCTION "public"."admin_list_event_attendees"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_events"("p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "title" "text", "description" "text", "event_date" timestamp with time zone, "location" "text", "image_url" "text", "created_by" "uuid", "owner_username" "text", "attendee_count" bigint, "featured" boolean, "priority" integer, "hidden" boolean, "cancelled" boolean, "note" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  return query

  select
    e.id,
    e.title::text,
    e.description::text,
    e.event_date,
    e.location::text,
    e.image_url::text,
    e.created_by,

    coalesce(
      p.username,
      'Kitap Okuru'
    )::text as owner_username,

    count(a.user_id)::bigint
      as attendee_count,

    coalesce(
      c.featured,
      false
    ) as featured,

    coalesce(
      c.priority,
      0
    ) as priority,

    coalesce(
      c.hidden,
      false
    ) as hidden,

    coalesce(
      c.cancelled,
      false
    ) as cancelled,

    c.note::text

  from public.events e

  left join public.profiles p
    on p.id = e.created_by

  left join public.event_attendees a
    on a.event_id = e.id

  left join public.event_admin_controls c
    on c.event_id = e.id

  where
    coalesce(trim(p_search), '') = ''

    or e.title ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      e.description,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      e.location,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or coalesce(
      p.username,
      ''
    ) ilike
      '%' || trim(p_search) || '%'

    or e.id::text ilike
      '%' || trim(p_search) || '%'

  group by
    e.id,
    e.title,
    e.description,
    e.event_date,
    e.location,
    e.image_url,
    e.created_by,
    p.username,
    c.featured,
    c.priority,
    c.hidden,
    c.cancelled,
    c.note

  order by
    coalesce(c.featured, false) desc,
    coalesce(c.priority, 0) desc,
    e.event_date asc

  limit greatest(
    1,
    least(
      coalesce(p_limit, 100),
      200
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_list_events"("p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_feature_flags"() RETURNS TABLE("key" "text", "enabled" boolean, "description" "text", "allowed_roles" "text"[], "allowed_user_ids" "uuid"[], "updated_at" timestamp with time zone, "updated_by" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    f.key,
    f.enabled,
    f.description,
    f.allowed_roles,
    f.allowed_user_ids,
    f.updated_at,
    f.updated_by
  from public.feature_flags f
  where public.has_admin_role(
    array['admin','super_admin']
  )
  order by f.key;
$$;


ALTER FUNCTION "public"."admin_list_feature_flags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_hashtags"() RETURNS TABLE("tag" "text", "usage_count" bigint, "post_count" bigint, "review_count" bigint, "blocked" boolean, "featured" boolean, "priority" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.has_admin_role(array['moderator','admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  return query
  with extracted as (
    select lower(m[1]) as tag, 'post'::text as source_type
    from public.posts p
    cross join lateral regexp_matches(
      coalesce(p.text, ''),
      '#([[:alnum:]_çğıöşüÇĞİÖŞÜ]+)',
      'g'
    ) as m

    union all

    select lower(m[1]) as tag, 'review'::text as source_type
    from public.reviews r
    cross join lateral regexp_matches(
      coalesce(r.text, ''),
      '#([[:alnum:]_çğıöşüÇĞİÖŞÜ]+)',
      'g'
    ) as m
  ),
  aggregated as (
    select
      e.tag,
      count(*)::bigint as usage_count,
      count(*) filter (where e.source_type = 'post')::bigint as post_count,
      count(*) filter (where e.source_type = 'review')::bigint as review_count
    from extracted e
    where e.tag <> ''
    group by e.tag
  )
  select
    coalesce(a.tag, hc.tag) as tag,
    coalesce(a.usage_count, 0)::bigint as usage_count,
    coalesce(a.post_count, 0)::bigint as post_count,
    coalesce(a.review_count, 0)::bigint as review_count,
    coalesce(hc.blocked, false) as blocked,
    coalesce(hc.featured, false) as featured,
    coalesce(hc.priority, 0) as priority,
    hc.updated_at
  from aggregated a
  full outer join public.hashtag_controls hc
    on hc.tag = a.tag
  order by
    coalesce(hc.featured, false) desc,
    coalesce(hc.priority, 0) desc,
    coalesce(a.usage_count, 0) desc,
    coalesce(a.tag, hc.tag) asc;
end;
$$;


ALTER FUNCTION "public"."admin_list_hashtags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_profile_controls"("p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "verified" boolean, "follow_restricted" boolean, "content_filter_level" "text", "note" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    p.id,
    p.username,
    p.full_name,
    coalesce(c.verified,false),
    coalesce(c.follow_restricted,false),
    coalesce(
      c.content_filter_level,
      'standard'
    ),
    coalesce(c.note,'')
  from public.profiles p
  left join public.profile_admin_controls c
    on c.user_id=p.id
  where public.has_admin_role(
    array['admin','super_admin']
  )
    and (
      coalesce(trim(p_search),'')=''
      or coalesce(p.username,'')
        ilike '%'||trim(p_search)||'%'
      or coalesce(p.full_name,'')
        ilike '%'||trim(p_search)||'%'
      or p.id::text
        ilike '%'||trim(p_search)||'%'
    )
  order by
    coalesce(c.verified,false) desc,
    lower(coalesce(p.username,''))
  limit greatest(
    1,
    least(
      coalesce(p_limit,100),
      200
    )
  );
$$;


ALTER FUNCTION "public"."admin_list_profile_controls"("p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_sanctions"("p_search" "text" DEFAULT ''::"text", "p_active_only" boolean DEFAULT true, "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "user_id" "uuid", "username" "text", "sanction_type" "text", "reason" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "active" boolean, "created_by" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    s.id,
    s.user_id,
    p.username,
    s.sanction_type,
    s.reason,
    s.starts_at,
    s.ends_at,
    (
      s.active
      and s.starts_at<=now()
      and (
        s.ends_at is null
        or s.ends_at>now()
      )
    ) as active,
    s.created_by,
    s.created_at
  from public.user_sanctions s
  left join public.profiles p
    on p.id=s.user_id
  where public.has_admin_role(
    array['moderator','admin','super_admin']
  )
    and (
      not coalesce(p_active_only,true)
      or (
        s.active
        and (
          s.ends_at is null
          or s.ends_at>now()
        )
      )
    )
    and (
      coalesce(trim(p_search),'')=''
      or coalesce(p.username,'')
        ilike '%'||trim(p_search)||'%'
      or s.user_id::text
        ilike '%'||trim(p_search)||'%'
      or s.reason
        ilike '%'||trim(p_search)||'%'
    )
  order by s.created_at desc
  limit greatest(
    1,
    least(
      coalesce(p_limit,100),
      250
    )
  );
$$;


ALTER FUNCTION "public"."admin_list_sanctions"("p_search" "text", "p_active_only" boolean, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_storage_objects"("p_bucket" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 200) RETURNS TABLE("id" "uuid", "bucket_id" "text", "object_name" "text", "owner_id" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "size_bytes" bigint, "mimetype" "text", "referenced" boolean, "cleanup_status" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    o.id,
    o.bucket_id::text,
    o.name::text,
    o.owner_id::text,
    o.created_at,
    o.updated_at,
    o.last_accessed_at,

    coalesce(
      nullif(
        o.metadata->>'size',
        ''
      )::bigint,
      0
    ),

    o.metadata->>'mimetype',

    case
      when o.bucket_id = 'work-covers' then
        exists (
          select 1
          from public.works w
          where
            w.cover_url is not null
            and position(
              '/work-covers/' in w.cover_url
            ) > 0
            and position(
              o.name in w.cover_url
            ) > 0
        )
      else true
    end as referenced,

    c.status

  from storage.objects o

  left join public.storage_cleanup_candidates c
    on c.bucket_id = o.bucket_id
    and c.object_name = o.name

  where
    public.has_admin_role(
      array['admin','super_admin']
    )

    and (
      p_bucket is null
      or p_bucket = ''
      or o.bucket_id = p_bucket
    )

    and (
      coalesce(trim(p_search),'') = ''

      or lower(o.name)
        like '%' ||
        lower(
          left(
            trim(p_search),
            200
          )
        ) ||
        '%'

      or lower(o.bucket_id)
        like '%' ||
        lower(
          left(
            trim(p_search),
            200
          )
        ) ||
        '%'
    )

  order by o.created_at desc

  limit greatest(
    1,
    least(
      coalesce(p_limit,200),
      500
    )
  );
$$;


ALTER FUNCTION "public"."admin_list_storage_objects"("p_bucket" "text", "p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_system_settings"() RETURNS TABLE("key" "text", "value" "jsonb", "description" "text", "public_read" boolean, "updated_at" timestamp with time zone, "updated_by" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    s.key,
    s.value,
    s.description,
    s.public_read,
    s.updated_at,
    s.updated_by
  from public.app_settings s
  where public.has_admin_role(
    array['admin','super_admin']
  )
  order by s.key;
$$;


ALTER FUNCTION "public"."admin_list_system_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_trash"("p_target_type" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "target_type" "text", "target_id" "uuid", "snapshot" "jsonb", "reason" "text", "deleted_by" "uuid", "deleted_username" "text", "deleted_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    t.id,
    t.target_type,
    t.target_id,
    t.snapshot,
    t.reason,
    t.deleted_by,
    p.username,
    t.deleted_at
  from public.admin_trash_items t
  left join public.profiles p
    on p.id = t.deleted_by
  where public.has_admin_role(
    array['moderator','admin','super_admin']
  )
    and t.restored_at is null
    and (
      coalesce(trim(p_target_type),'') = ''
      or t.target_type = trim(p_target_type)
    )
  order by t.deleted_at desc
  limit greatest(
    1,
    least(coalesce(p_limit,100),250)
  )
  offset greatest(
    0,
    coalesce(p_offset,0)
  );
$$;


ALTER FUNCTION "public"."admin_list_trash"("p_target_type" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_works"("p_search" "text" DEFAULT ''::"text", "p_status" "text" DEFAULT 'all'::"text", "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "author_id" "uuid", "author_username" "text", "title" "text", "description" "text", "cover_url" "text", "genre" "text", "tags" "text"[], "status" "text", "language" "text", "audience" "text", "completed" boolean, "chapter_count" bigint, "published_chapter_count" bigint, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "published_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  return query

  select
    w.id,
    w.author_id,
    coalesce(
      p.username,
      'Kitap Okuru'
    )::text,
    w.title,
    w.description,
    w.cover_url,
    w.genre,
    w.tags,
    w.status,
    w.language,
    w.audience,
    w.completed,

    count(c.id)::bigint
      as chapter_count,

    count(c.id)
      filter (
        where c.status = 'published'
      )::bigint
      as published_chapter_count,

    w.created_at,
    w.updated_at,
    w.published_at

  from public.works w

  left join public.profiles p
    on p.id = w.author_id

  left join public.work_chapters c
    on c.work_id = w.id

  where
    (
      coalesce(
        trim(p_search),
        ''
      ) = ''

      or w.title ilike
        '%' || trim(p_search) || '%'

      or coalesce(
        p.username,
        ''
      ) ilike
        '%' || trim(p_search) || '%'

      or coalesce(
        w.genre,
        ''
      ) ilike
        '%' || trim(p_search) || '%'
    )

    and (
      p_status = 'all'
      or w.status = p_status
    )

  group by
    w.id,
    p.username

  order by
    w.updated_at desc

  limit greatest(
    1,
    least(
      coalesce(p_limit, 100),
      200
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_list_works"("p_search" "text", "p_status" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_mark_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_reason" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_referenced boolean := false;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where
      o.bucket_id = p_bucket
      and o.name = p_object_name
  ) then
    raise exception 'storage object not found';
  end if;

  if p_bucket = 'work-covers' then

    select exists (
      select 1
      from public.works w
      where
        w.cover_url is not null
        and position(
          '/work-covers/' in w.cover_url
        ) > 0
        and position(
          p_object_name in w.cover_url
        ) > 0
    )
    into v_referenced;

    if v_referenced then
      raise exception
        'referenced work cover cannot be marked for cleanup';
    end if;

  end if;

  insert into public.storage_cleanup_candidates (
    bucket_id,
    object_name,
    reason,
    status,
    created_by,
    reviewed_by,
    reviewed_at
  )
  values (
    p_bucket,
    p_object_name,
    trim(coalesce(p_reason,'')),
    'pending',
    auth.uid(),
    null,
    null
  )

  on conflict (
    bucket_id,
    object_name
  )
  do update set
    reason = excluded.reason,
    status = 'pending',
    created_by = auth.uid(),
    reviewed_by = null,
    reviewed_at = null

  returning id into v_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    new_value
  )
  values (
    auth.uid(),
    'storage_cleanup_marked',
    'storage_object',
    p_bucket || '/' || p_object_name,
    jsonb_build_object(
      'bucket_id',
      p_bucket,
      'object_name',
      p_object_name,
      'reason',
      trim(coalesce(p_reason,''))
    )
  );

  return v_id;
end;
$$;


ALTER FUNCTION "public"."admin_mark_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_premium_analytics_daily"("p_days" integer DEFAULT 30) RETURNS TABLE("day" "date", "entitlement_created" bigint, "status_changed" bigint, "expiration_changed" bigint, "renewal_state_changed" bigint, "source_state_changed" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$

  with days as (
    select generate_series(
      current_date -
      (
        greatest(
          1,
          least(
            coalesce(p_days,30),
            180
          )
        ) - 1
      ),

      current_date,
      interval '1 day'
    )::date as day
  )

  select
    d.day,

    count(*) filter (
      where e.event_type =
        'entitlement_created'
    ),

    count(*) filter (
      where e.event_type =
        'status_changed'
    ),

    count(*) filter (
      where e.event_type =
        'expiration_changed'
    ),

    count(*) filter (
      where e.event_type =
        'renewal_state_changed'
    ),

    count(*) filter (
      where e.event_type =
        'source_state_changed'
    )

  from days d

  left join public.premium_analytics_events e
    on e.created_at >= d.day
   and e.created_at <
       d.day + interval '1 day'

  where public.has_admin_role(
    array['admin','super_admin']
  )

  group by d.day
  order by d.day;

$$;


ALTER FUNCTION "public"."admin_premium_analytics_daily"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_premium_analytics_overview"() RETURNS TABLE("active_premium_users" bigint, "active_paid_users" bigint, "active_admin_grant_users" bigint, "apple_active_users" bigint, "google_active_users" bigint, "trialing_users" bigint, "grace_period_users" bigint, "expiring_7d_users" bigint, "non_renewing_paid_users" bigint, "premium_events_7d" bigint, "premium_events_30d" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with active as (
    select pe.*
    from public.premium_entitlements pe
    where pe.status in (
      'active',
      'trialing',
      'grace_period'
    )
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (
        pe.expires_at is null
        or pe.expires_at > now()
      )
  )
  select

    (
      select count(distinct user_id)
      from active
    ),

    (
      select count(distinct user_id)
      from active
      where source in ('apple','google')
    ),

    (
      select count(distinct user_id)
      from active
      where source = 'admin_grant'
    ),

    (
      select count(distinct user_id)
      from active
      where source = 'apple'
    ),

    (
      select count(distinct user_id)
      from active
      where source = 'google'
    ),

    (
      select count(distinct user_id)
      from active
      where status = 'trialing'
    ),

    (
      select count(distinct user_id)
      from active
      where status = 'grace_period'
    ),

    (
      select count(distinct user_id)
      from active
      where expires_at is not null
        and expires_at <=
          now() + interval '7 days'
    ),

    (
      select count(distinct user_id)
      from active
      where source in ('apple','google')
        and will_renew is false
    ),

    (
      select count(*)
      from public.premium_analytics_events
      where created_at >=
        now() - interval '7 days'
    ),

    (
      select count(*)
      from public.premium_analytics_events
      where created_at >=
        now() - interval '30 days'
    )

  where public.has_admin_role(
    array['admin','super_admin']
  );
$$;


ALTER FUNCTION "public"."admin_premium_analytics_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_remove_event_attendee"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.event_attendees a
    where
      a.event_id = p_event_id
      and a.user_id = p_user_id
  ) then
    raise exception 'attendee not found';
  end if;

  delete from public.event_attendees
  where
    event_id = p_event_id
    and user_id = p_user_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'event_attendee_removed',
    'event_attendee',
    p_event_id::text || ':' || p_user_id::text,

    jsonb_build_object(
      'event_id',
      p_event_id,
      'user_id',
      p_user_id
    ),

    null
  );

end;
$$;


ALTER FUNCTION "public"."admin_remove_event_attendee"("p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reported_message_context"("p_report_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_report public.reports%rowtype;
  v_message jsonb;
begin

  if not public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  select *
  into v_report
  from public.reports
  where id=p_report_id
    and target_type='message';

  if not found then
    raise exception
      'reported message not found';
  end if;

  if to_regclass('public.messages')
     is not null then

    execute
      'select to_jsonb(m)
       from public.messages m
       where m.id::text=$1
       limit 1'
    into v_message
    using v_report.target_id;

  end if;

  return jsonb_build_object(
    'report',
    to_jsonb(v_report),
    'message',
    v_message
  );

end;
$_$;


ALTER FUNCTION "public"."admin_reported_message_context"("p_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_restore_trash"("p_trash_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_item public.admin_trash_items%rowtype;
  v_admin_id uuid := auth.uid();
begin

  if v_admin_id is null
     or not public.has_admin_role(
       array['moderator','admin','super_admin']
     ) then
    raise exception 'Yetkisiz erişim';
  end if;

  select *
  into v_item
  from public.admin_trash_items
  where id = p_trash_id
    and restored_at is null
  for update;

  if not found then
    raise exception 'Çöp kutusu kaydı bulunamadı';
  end if;

  case v_item.target_type
    when 'post' then
      if exists(
        select 1
        from public.posts
        where id = v_item.target_id
      ) then
        raise exception 'İçerik zaten mevcut';
      end if;

      insert into public.posts
      select *
      from jsonb_populate_record(
        null::public.posts,
        v_item.snapshot
      );

    when 'review' then
      if exists(
        select 1
        from public.reviews
        where id = v_item.target_id
      ) then
        raise exception 'İçerik zaten mevcut';
      end if;

      insert into public.reviews
      select *
      from jsonb_populate_record(
        null::public.reviews,
        v_item.snapshot
      );

    when 'quote' then
      if exists(
        select 1
        from public.quotes
        where id = v_item.target_id
      ) then
        raise exception 'İçerik zaten mevcut';
      end if;

      insert into public.quotes
      select *
      from jsonb_populate_record(
        null::public.quotes,
        v_item.snapshot
      );

    when 'comment' then
      if exists(
        select 1
        from public.comments
        where id = v_item.target_id
      ) then
        raise exception 'İçerik zaten mevcut';
      end if;

      insert into public.comments
      select *
      from jsonb_populate_record(
        null::public.comments,
        v_item.snapshot
      );

    when 'post_comment' then
      if exists(
        select 1
        from public.post_comments
        where id = v_item.target_id
      ) then
        raise exception 'İçerik zaten mevcut';
      end if;

      insert into public.post_comments
      select *
      from jsonb_populate_record(
        null::public.post_comments,
        v_item.snapshot
      );

    else
      raise exception 'Desteklenmeyen içerik türü';
  end case;

  update public.admin_trash_items
  set
    restored_at = now(),
    restored_by = v_admin_id
  where id = v_item.id;

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values(
    v_admin_id,
    'content_restored_from_trash',
    v_item.target_type,
    v_item.target_id::text,
    jsonb_build_object('trashed',true),
    v_item.snapshot
  );

  return jsonb_build_object(
    'ok',true,
    'target_type',v_item.target_type,
    'target_id',v_item.target_id
  );
end;
$$;


ALTER FUNCTION "public"."admin_restore_trash"("p_trash_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if p_status not in (
    'approved',
    'rejected'
  ) then
    raise exception 'invalid cleanup status';
  end if;

  update public.storage_cleanup_candidates
  set
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where
    bucket_id = p_bucket
    and object_name = p_object_name;

  if not found then
    raise exception 'cleanup candidate not found';
  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    new_value
  )
  values (
    auth.uid(),
    'storage_cleanup_reviewed',
    'storage_object',
    p_bucket || '/' || p_object_name,
    jsonb_build_object(
      'status',
      p_status
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_review_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_revoke_premium"("p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."premium_entitlements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_admin_id uuid := auth.uid();
  v_row public.premium_entitlements;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_admin_id is null
     or not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'Admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
     ) then
    raise exception 'Target user not found'
      using errcode = 'P0002';
  end if;

  select pe.*
  into v_row
  from public.premium_entitlements pe
  where pe.user_id = p_user_id
    and pe.source = 'admin_grant'
    and coalesce(pe.source_reference, '') = 'admin'
    and pe.status in ('active','trialing','grace_period')
    and (pe.expires_at is null or pe.expires_at > now())
  order by pe.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Active admin Premium grant not found'
      using errcode = 'P0002';
  end if;

  update public.premium_entitlements
  set
    status = 'revoked',
    revoked_at = now(),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'premium_admin_revoked',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'entitlement_id', v_row.id,
      'source', 'admin_grant',
      'status', 'active'
    ),
    jsonb_build_object(
      'entitlement_id', v_row.id,
      'source', v_row.source,
      'status', v_row.status,
      'revoked_at', v_row.revoked_at
    ),
    jsonb_build_object(
      'revoke_scope', 'admin_grant_only'
    )
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_revoke_premium"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_revoke_sanction"("p_sanction_id" "uuid", "p_reason" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_user uuid;
begin

  if not public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  select
    to_jsonb(s),
    s.user_id
  into
    v_old,
    v_user
  from public.user_sanctions s
  where s.id=p_sanction_id
    and s.active=true;

  if v_old is null then
    raise exception 'active sanction not found';
  end if;

  update public.user_sanctions
  set
    active=false,
    revoked_at=now(),
    revoked_by=auth.uid()
  where id=p_sanction_id;

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value
  )
  values(
    auth.uid(),
    'sanction_revoked',
    'user',
    v_user::text,
    coalesce(p_reason,''),
    v_old,
    jsonb_build_object(
      'active',false
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_revoke_sanction"("p_sanction_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_revoke_verification"("p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."verified_accounts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_admin_id uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_previous public.verified_accounts;
  v_row public.verified_accounts;
begin
  if v_admin_id is null
     or not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'Admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
     ) then
    raise exception 'Target user not found'
      using errcode = 'P0002';
  end if;

  select va.*
  into v_previous
  from public.verified_accounts va
  where va.user_id = p_user_id
  for update;

  if not found or v_previous.is_verified is not true then
    raise exception 'Active verification not found'
      using errcode = 'P0002';
  end if;

  update public.verified_accounts
  set
    is_verified = false,
    revoked_at = now(),
    revoked_by = v_admin_id,
    reason = v_reason,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    reason,
    old_value,
    new_value,
    metadata
  )
  values (
    v_admin_id,
    'verification_revoked',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'is_verified', v_previous.is_verified,
      'verified_at', v_previous.verified_at,
      'verified_by', v_previous.verified_by,
      'revoked_at', v_previous.revoked_at,
      'revoked_by', v_previous.revoked_by
    ),
    jsonb_build_object(
      'is_verified', v_row.is_verified,
      'verified_at', v_row.verified_at,
      'verified_by', v_row.verified_by,
      'revoked_at', v_row.revoked_at,
      'revoked_by', v_row.revoked_by
    ),
    jsonb_build_object(
      'source', 'admin_panel',
      'independent_from_premium', true
    )
  );

  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_revoke_verification"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_announcement"("p_id" "uuid" DEFAULT NULL::"uuid", "p_title" "text" DEFAULT ''::"text", "p_body" "text" DEFAULT ''::"text", "p_kind" "text" DEFAULT 'info'::"text", "p_action_route" "text" DEFAULT NULL::"text", "p_starts_at" timestamp with time zone DEFAULT "now"(), "p_ends_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_active" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if coalesce(trim(p_title), '') = ''
     or coalesce(trim(p_body), '') = '' then
    raise exception 'title and body are required';
  end if;

  if p_kind not in (
    'info',
    'warning',
    'maintenance',
    'feature',
    'event'
  ) then
    raise exception 'invalid announcement kind';
  end if;

  if p_ends_at is not null
     and p_ends_at <= p_starts_at then
    raise exception 'ends_at must be after starts_at';
  end if;

  if p_id is null then

    insert into public.announcements (
      title,
      body,
      kind,
      action_route,
      starts_at,
      ends_at,
      active,
      created_by
    )
    values (
      trim(p_title),
      trim(p_body),
      p_kind,
      nullif(
        trim(coalesce(p_action_route, '')),
        ''
      ),
      coalesce(p_starts_at, now()),
      p_ends_at,
      coalesce(p_active, true),
      auth.uid()
    )
    returning id into v_id;

    select to_jsonb(a)
    into v_new
    from public.announcements a
    where a.id = v_id;

    insert into public.admin_audit_logs (
      admin_id,
      action,
      target_type,
      target_id,
      new_value
    )
    values (
      auth.uid(),
      'announcement_created',
      'announcement',
      v_id::text,
      v_new
    );

  else

    select to_jsonb(a)
    into v_old
    from public.announcements a
    where a.id = p_id;

    if v_old is null then
      raise exception 'announcement not found';
    end if;

    update public.announcements
    set
      title = trim(p_title),
      body = trim(p_body),
      kind = p_kind,
      action_route =
        nullif(
          trim(coalesce(p_action_route, '')),
          ''
        ),
      starts_at =
        coalesce(p_starts_at, starts_at),
      ends_at = p_ends_at,
      active =
        coalesce(p_active, active),
      updated_at = now()
    where id = p_id
    returning id into v_id;

    select to_jsonb(a)
    into v_new
    from public.announcements a
    where a.id = v_id;

    insert into public.admin_audit_logs (
      admin_id,
      action,
      target_type,
      target_id,
      old_value,
      new_value
    )
    values (
      auth.uid(),
      'announcement_updated',
      'announcement',
      v_id::text,
      v_old,
      v_new
    );

  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."admin_save_announcement"("p_id" "uuid", "p_title" "text", "p_body" "text", "p_kind" "text", "p_action_route" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_save_feature_flag"("p_key" "text", "p_enabled" boolean DEFAULT false, "p_description" "text" DEFAULT ''::"text", "p_allowed_roles" "text"[] DEFAULT '{}'::"text"[], "p_allowed_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
  v_role text;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if coalesce(trim(p_key),'') = '' then
    raise exception 'flag key is required';
  end if;

  foreach v_role
  in array coalesce(
    p_allowed_roles,
    '{}'::text[]
  )
  loop

    if v_role not in (
      'user',
      'moderator',
      'admin',
      'super_admin'
    ) then
      raise exception
        'invalid allowed role: %',
        v_role;
    end if;

  end loop;

  select to_jsonb(f)
  into v_old
  from public.feature_flags f
  where f.key = trim(p_key);

  insert into public.feature_flags(
    key,
    enabled,
    description,
    allowed_roles,
    allowed_user_ids,
    updated_at,
    updated_by
  )
  values(
    trim(p_key),
    coalesce(p_enabled,false),
    trim(coalesce(p_description,'')),
    coalesce(
      p_allowed_roles,
      '{}'::text[]
    ),
    coalesce(
      p_allowed_user_ids,
      '{}'::uuid[]
    ),
    now(),
    auth.uid()
  )

  on conflict(key) do update set
    enabled = excluded.enabled,
    description = excluded.description,
    allowed_roles = excluded.allowed_roles,
    allowed_user_ids = excluded.allowed_user_ids,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(f)
  into v_new
  from public.feature_flags f
  where f.key = trim(p_key);

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values(
    auth.uid(),
    'feature_flag_saved',
    'feature_flag',
    trim(p_key),
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_save_feature_flag"("p_key" "text", "p_enabled" boolean, "p_description" "text", "p_allowed_roles" "text"[], "p_allowed_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_search_analytics"("p_days" integer DEFAULT 30, "p_limit" integer DEFAULT 30) RETURNS TABLE("query" "text", "search_count" bigint, "unique_users" bigint, "avg_results" numeric, "last_searched_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    lower(trim(s.query)),
    count(*)::bigint,
    count(distinct s.user_id)::bigint,
    round(avg(s.result_count)::numeric,2),
    max(s.created_at)
  from public.search_events s
  where public.has_admin_role(
    array['admin','super_admin']
  )
    and s.created_at >=
      now() -
      (
        greatest(
          1,
          least(
            coalesce(p_days,30),
            365
          )
        )
        || ' days'
      )::interval
  group by lower(trim(s.query))
  order by
    count(*) desc,
    max(s.created_at) desc
  limit greatest(
    1,
    least(
      coalesce(p_limit,30),
      100
    )
  );
$$;


ALTER FUNCTION "public"."admin_search_analytics"("p_days" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_search_role_candidates"("p_search" "text" DEFAULT ''::"text", "p_limit" integer DEFAULT 50) RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "profile_image" "text", "role" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    p.id,
    p.username,
    p.full_name,
    p.profile_image,
    coalesce(ur.role,'user')
  from public.profiles p
  left join public.user_roles ur
    on ur.user_id = p.id
  where public.has_admin_role(array['super_admin'])
    and (
      coalesce(trim(p_search),'') = ''
      or lower(coalesce(p.username,''))
        like '%' ||
        lower(left(trim(p_search),200)) ||
        '%'
      or lower(coalesce(p.full_name,''))
        like '%' ||
        lower(left(trim(p_search),200)) ||
        '%'
      or p.id::text
        like '%' ||
        lower(left(trim(p_search),200)) ||
        '%'
    )
  order by
    lower(coalesce(p.username,'')),
    p.id
  limit greatest(
    1,
    least(
      coalesce(p_limit,50),
      100
    )
  );
$$;


ALTER FUNCTION "public"."admin_search_role_candidates"("p_search" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_security_health"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'active_sanctions',
    (
      select count(*)
      from public.user_sanctions s
      where s.active=true
        and (
          s.ends_at is null
          or s.ends_at>now()
        )
    ),

    'pending_reports',
    (
      select count(*)
      from public.reports r
      where r.status='pending'
    ),

    'super_admins',
    (
      select count(*)
      from public.user_roles u
      where u.role='super_admin'
    ),

    'admins',
    (
      select count(*)
      from public.user_roles u
      where u.role='admin'
    ),

    'moderators',
    (
      select count(*)
      from public.user_roles u
      where u.role='moderator'
    ),

    'audit_24h',
    (
      select count(*)
      from public.admin_audit_logs a
      where a.created_at >=
        now()-interval '24 hours'
    ),

    'searches_24h',
    (
      select count(*)
      from public.search_events s
      where s.created_at >=
        now()-interval '24 hours'
    ),

    'database_size_bytes',
    pg_database_size(current_database()),

    'server_time',
    now()
  )
  into v;

  return v;

end;
$$;


ALTER FUNCTION "public"."admin_security_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_send_notification"("p_title" "text", "p_message" "text", "p_target_type" "text" DEFAULT 'all'::"text", "p_target_value" "text" DEFAULT NULL::"text", "p_action_route" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  if coalesce(trim(p_title), '') = ''
     or coalesce(trim(p_message), '') = '' then
    raise exception 'title and message are required';
  end if;

  if p_target_type not in ('all','user','role') then
    raise exception 'invalid target type';
  end if;

  if p_target_type = 'user' then

    if p_target_value is null
       or not exists (
         select 1
         from public.profiles p
         where p.id::text = p_target_value
       ) then
      raise exception 'target user not found';
    end if;

  elsif p_target_type = 'role' then

    if p_target_value not in (
      'user',
      'moderator',
      'admin',
      'super_admin'
    ) then
      raise exception 'invalid target role';
    end if;

  else
    p_target_value := null;
  end if;

  insert into public.admin_notifications (
    title,
    message,
    target_type,
    target_value,
    action_route,
    created_by
  )
  values (
    trim(p_title),
    trim(p_message),
    p_target_type,
    p_target_value,
    nullif(
      trim(
        coalesce(
          p_action_route,
          ''
        )
      ),
      ''
    ),
    auth.uid()
  )
  returning id into v_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    new_value
  )
  values (
    auth.uid(),
    'admin_notification_sent',
    'admin_notification',
    v_id::text,
    jsonb_build_object(
      'title',
      trim(p_title),
      'target_type',
      p_target_type,
      'target_value',
      p_target_value
    )
  );

  return v_id;
end;
$$;


ALTER FUNCTION "public"."admin_send_notification"("p_title" "text", "p_message" "text", "p_target_type" "text", "p_target_value" "text", "p_action_route" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_author_profile"("p_user_id" "uuid", "p_pen_name" "text" DEFAULT NULL::"text", "p_verified" boolean DEFAULT false, "p_featured" boolean DEFAULT false, "p_priority" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.works w
    where w.author_id = p_user_id
  ) then
    raise exception 'author has no works';
  end if;

  select to_jsonb(ap)
  into v_old
  from public.author_profiles ap
  where ap.user_id = p_user_id;

  insert into public.author_profiles (
    user_id,
    pen_name,
    verified,
    featured,
    priority,
    updated_at,
    updated_by
  )
  values (
    p_user_id,

    nullif(
      trim(
        coalesce(
          p_pen_name,
          ''
        )
      ),
      ''
    ),

    coalesce(
      p_verified,
      false
    ),

    coalesce(
      p_featured,
      false
    ),

    coalesce(
      p_priority,
      0
    ),

    now(),

    auth.uid()
  )

  on conflict(user_id)
  do update set
    pen_name = excluded.pen_name,
    verified = excluded.verified,
    featured = excluded.featured,
    priority = excluded.priority,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(ap)
  into v_new
  from public.author_profiles ap
  where ap.user_id = p_user_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'author_profile_update',
    'author',
    p_user_id::text,
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_set_author_profile"("p_user_id" "uuid", "p_pen_name" "text", "p_verified" boolean, "p_featured" boolean, "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_community_control"("p_community_id" "uuid", "p_verified" boolean DEFAULT false, "p_featured" boolean DEFAULT false, "p_priority" integer DEFAULT 0, "p_restricted" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.communities c
    where c.id = p_community_id
  ) then
    raise exception 'community not found';
  end if;

  select to_jsonb(ac)
  into v_old
  from public.community_admin_controls ac
  where ac.community_id = p_community_id;

  insert into public.community_admin_controls (
    community_id,
    verified,
    featured,
    priority,
    restricted,
    updated_at,
    updated_by
  )
  values (
    p_community_id,
    coalesce(p_verified, false),
    coalesce(p_featured, false),
    coalesce(p_priority, 0),
    coalesce(p_restricted, false),
    now(),
    auth.uid()
  )

  on conflict(community_id)
  do update set
    verified = excluded.verified,
    featured = excluded.featured,
    priority = excluded.priority,
    restricted = excluded.restricted,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(ac)
  into v_new
  from public.community_admin_controls ac
  where ac.community_id = p_community_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'community_control_update',
    'community',
    p_community_id::text,
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_set_community_control"("p_community_id" "uuid", "p_verified" boolean, "p_featured" boolean, "p_priority" integer, "p_restricted" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_community_member_role"("p_community_id" "uuid", "p_user_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old_role text;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if p_role not in ('member','admin') then
    raise exception 'invalid role';
  end if;

  select m.role
  into v_old_role
  from public.community_members m
  where
    m.community_id = p_community_id
    and m.user_id = p_user_id;

  if v_old_role is null then
    raise exception 'member not found';
  end if;

  if v_old_role = 'owner' then
    raise exception 'owner role cannot be changed here';
  end if;

  update public.community_members
  set role = p_role
  where
    community_id = p_community_id
    and user_id = p_user_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'community_member_role_update',
    'community_member',
    p_community_id::text || ':' || p_user_id::text,
    jsonb_build_object(
      'role',
      v_old_role
    ),
    jsonb_build_object(
      'role',
      p_role
    )
  );

end;
$$;


ALTER FUNCTION "public"."admin_set_community_member_role"("p_community_id" "uuid", "p_user_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_event_control"("p_event_id" "uuid", "p_featured" boolean DEFAULT false, "p_priority" integer DEFAULT 0, "p_hidden" boolean DEFAULT false, "p_cancelled" boolean DEFAULT false, "p_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
  ) then
    raise exception 'event not found';
  end if;

  select to_jsonb(c)
  into v_old
  from public.event_admin_controls c
  where c.event_id = p_event_id;

  insert into public.event_admin_controls (
    event_id,
    featured,
    priority,
    hidden,
    cancelled,
    note,
    updated_at,
    updated_by
  )
  values (
    p_event_id,
    coalesce(p_featured, false),
    coalesce(p_priority, 0),
    coalesce(p_hidden, false),
    coalesce(p_cancelled, false),
    nullif(
      trim(
        coalesce(
          p_note,
          ''
        )
      ),
      ''
    ),
    now(),
    auth.uid()
  )

  on conflict(event_id)
  do update set
    featured = excluded.featured,
    priority = excluded.priority,
    hidden = excluded.hidden,
    cancelled = excluded.cancelled,
    note = excluded.note,
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(c)
  into v_new
  from public.event_admin_controls c
  where c.event_id = p_event_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'event_control_update',
    'event',
    p_event_id::text,
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_set_event_control"("p_event_id" "uuid", "p_featured" boolean, "p_priority" integer, "p_hidden" boolean, "p_cancelled" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_hashtag_control"("p_tag" "text", "p_blocked" boolean DEFAULT false, "p_featured" boolean DEFAULT false, "p_priority" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tag text;
  v_old jsonb;
begin
  if not public.has_admin_role(array['admin','super_admin']) then
    raise exception 'not authorized';
  end if;

  v_tag := lower(trim(both '#' from trim(coalesce(p_tag, ''))));

  if v_tag = '' then
    raise exception 'invalid hashtag';
  end if;

  select to_jsonb(hc)
  into v_old
  from public.hashtag_controls hc
  where hc.tag = v_tag;

  insert into public.hashtag_controls(
    tag,
    blocked,
    featured,
    priority,
    updated_at,
    updated_by
  )
  values (
    v_tag,
    coalesce(p_blocked, false),
    coalesce(p_featured, false),
    coalesce(p_priority, 0),
    now(),
    auth.uid()
  )
  on conflict(tag) do update set
    blocked = excluded.blocked,
    featured = excluded.featured,
    priority = excluded.priority,
    updated_at = now(),
    updated_by = auth.uid();

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'hashtag_control_update',
    'hashtag',
    v_tag,
    v_old,
    jsonb_build_object(
      'blocked', coalesce(p_blocked, false),
      'featured', coalesce(p_featured, false),
      'priority', coalesce(p_priority, 0)
    )
  );
end;
$$;


ALTER FUNCTION "public"."admin_set_hashtag_control"("p_tag" "text", "p_blocked" boolean, "p_featured" boolean, "p_priority" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_profile_control"("p_user_id" "uuid", "p_verified" boolean, "p_follow_restricted" boolean, "p_content_filter_level" "text" DEFAULT 'standard'::"text", "p_note" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if p_content_filter_level not in (
    'standard',
    'strict',
    'off'
  ) then
    raise exception 'invalid filter level';
  end if;

  select to_jsonb(c)
  into v_old
  from public.profile_admin_controls c
  where c.user_id=p_user_id;

  insert into public.profile_admin_controls(
    user_id,
    verified,
    follow_restricted,
    content_filter_level,
    note,
    updated_at,
    updated_by
  )
  values(
    p_user_id,
    coalesce(p_verified,false),
    coalesce(p_follow_restricted,false),
    p_content_filter_level,
    left(coalesce(p_note,''),1000),
    now(),
    auth.uid()
  )
  on conflict(user_id)
  do update set
    verified=excluded.verified,
    follow_restricted=excluded.follow_restricted,
    content_filter_level=excluded.content_filter_level,
    note=excluded.note,
    updated_at=now(),
    updated_by=auth.uid();

  select to_jsonb(c)
  into v_new
  from public.profile_admin_controls c
  where c.user_id=p_user_id;

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values(
    auth.uid(),
    'profile_control_updated',
    'user',
    p_user_id::text,
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_set_profile_control"("p_user_id" "uuid", "p_verified" boolean, "p_follow_restricted" boolean, "p_content_filter_level" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_system_setting"("p_key" "text", "p_value" "jsonb", "p_description" "text" DEFAULT NULL::"text", "p_public_read" boolean DEFAULT NULL::boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if coalesce(trim(p_key),'') = '' then
    raise exception 'setting key is required';
  end if;

  if p_value is null then
    raise exception 'setting value is required';
  end if;

  select to_jsonb(s)
  into v_old
  from public.app_settings s
  where s.key = trim(p_key);

  insert into public.app_settings(
    key,
    value,
    description,
    public_read,
    updated_at,
    updated_by
  )
  values(
    trim(p_key),
    p_value,
    coalesce(p_description,''),
    coalesce(p_public_read,false),
    now(),
    auth.uid()
  )

  on conflict(key) do update set
    value = excluded.value,
    description = coalesce(
      p_description,
      public.app_settings.description
    ),
    public_read = coalesce(
      p_public_read,
      public.app_settings.public_read
    ),
    updated_at = now(),
    updated_by = auth.uid();

  select to_jsonb(s)
  into v_new
  from public.app_settings s
  where s.key = trim(p_key);

  insert into public.admin_audit_logs(
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values(
    auth.uid(),
    'system_setting_updated',
    'app_setting',
    trim(p_key),
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_set_system_setting"("p_key" "text", "p_value" "jsonb", "p_description" "text", "p_public_read" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_old_role text;
  v_super_admin_count bigint;
begin
  if v_actor_id is null
     or not public.has_admin_role(array['super_admin']) then
    raise exception 'Super admin permission required'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'User id is required'
      using errcode = '22023';
  end if;

  if p_role not in ('user','moderator','admin','super_admin') then
    raise exception 'Invalid role'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
  ) then
    raise exception 'User not found'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kitap-app:user_roles:super_admin')
  );

  select coalesce(ur.role, 'user')
  into v_old_role
  from (select p_user_id as user_id) target
  left join public.user_roles ur
    on ur.user_id = target.user_id;

  if p_user_id = v_actor_id
     and p_role is distinct from v_old_role then
    raise exception 'You cannot change your own role'
      using errcode = '42501';
  end if;

  if v_old_role = 'super_admin'
     and p_role <> 'super_admin' then

    select count(*)
    into v_super_admin_count
    from public.user_roles
    where role = 'super_admin';

    if v_super_admin_count <= 1 then
      raise exception 'At least one super admin must remain'
        using errcode = '23514';
    end if;
  end if;

  if p_role is not distinct from v_old_role then
    return;
  end if;

  insert into public.user_roles (
    user_id,
    role,
    updated_at,
    updated_by
  )
  values (
    p_user_id,
    p_role,
    now(),
    v_actor_id
  )
  on conflict (user_id) do update
  set
    role = excluded.role,
    updated_at = now(),
    updated_by = v_actor_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value,
    metadata
  )
  values (
    v_actor_id,
    'admin_role_changed',
    'user',
    p_user_id::text,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role),
    jsonb_build_object(
      'authorization', 'super_admin_rpc',
      'direct_role_table_writes', false
    )
  );
end;
$$;


ALTER FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_storage_bucket_stats"() RETURNS TABLE("bucket_id" "text", "bucket_name" "text", "is_public" boolean, "file_size_limit" bigint, "object_count" bigint, "total_bytes" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    b.id::text,
    b.name::text,
    b.public,
    b.file_size_limit,
    count(o.id)::bigint,
    coalesce(
      sum(
        nullif(
          o.metadata->>'size',
          ''
        )::bigint
      ),
      0
    )::bigint
  from storage.buckets b
  left join storage.objects o
    on o.bucket_id = b.id
  where public.has_admin_role(
    array['admin','super_admin']
  )
  group by
    b.id,
    b.name,
    b.public,
    b.file_size_limit
  order by b.name;
$$;


ALTER FUNCTION "public"."admin_storage_bucket_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_work_state"("p_work_id" "uuid", "p_status" "text", "p_completed" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
begin

  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if p_status not in (
    'draft',
    'published'
  ) then
    raise exception 'invalid status';
  end if;

  select to_jsonb(w)
  into v_old
  from public.works w
  where w.id = p_work_id;

  if v_old is null then
    raise exception 'work not found';
  end if;

  update public.works
  set
    status = p_status,

    completed =
      coalesce(
        p_completed,
        false
      ),

    published_at =
      case
        when p_status = 'published'
          then coalesce(
            published_at,
            now()
          )
        else published_at
      end,

    updated_at = now()

  where id = p_work_id;

  select to_jsonb(w)
  into v_new
  from public.works w
  where w.id = p_work_id;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'work_state_update',
    'work',
    p_work_id::text,
    v_old,
    v_new
  );

end;
$$;


ALTER FUNCTION "public"."admin_update_work_state"("p_work_id" "uuid", "p_status" "text", "p_completed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_explore_item"("p_target_type" "text", "p_target_id" "text", "p_title" "text" DEFAULT NULL::"text", "p_subtitle" "text" DEFAULT NULL::"text", "p_priority" integer DEFAULT 0, "p_active" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_old jsonb;
begin
  if not public.has_admin_role(
    array['admin','super_admin']
  ) then
    raise exception 'not authorized';
  end if;

  if p_target_type not in (
    'post',
    'review',
    'book',
    'author',
    'community',
    'event',
    'hashtag'
  ) then
    raise exception 'invalid target type';
  end if;

  if trim(coalesce(p_target_id, '')) = '' then
    raise exception 'target id required';
  end if;

  select
    to_jsonb(e),
    e.id
  into
    v_old,
    v_id
  from public.explore_featured_items e
  where e.target_type = p_target_type
    and e.target_id = trim(p_target_id);

  if v_id is null then

    insert into public.explore_featured_items (
      target_type,
      target_id,
      title,
      subtitle,
      priority,
      active,
      created_by
    )
    values (
      p_target_type,
      trim(p_target_id),
      nullif(trim(coalesce(p_title, '')), ''),
      nullif(trim(coalesce(p_subtitle, '')), ''),
      coalesce(p_priority, 0),
      coalesce(p_active, true),
      auth.uid()
    )
    returning id
    into v_id;

  else

    update public.explore_featured_items
    set
      title =
        nullif(
          trim(coalesce(p_title, '')),
          ''
        ),
      subtitle =
        nullif(
          trim(coalesce(p_subtitle, '')),
          ''
        ),
      priority =
        coalesce(p_priority, 0),
      active =
        coalesce(p_active, true),
      updated_at = now()
    where id = v_id;

  end if;

  insert into public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    old_value,
    new_value
  )
  values (
    auth.uid(),
    'explore_feature_update',
    'explore_item',
    v_id::text,
    v_old,
    jsonb_build_object(
      'target_type',
      p_target_type,
      'target_id',
      trim(p_target_id),
      'title',
      p_title,
      'subtitle',
      p_subtitle,
      'priority',
      coalesce(p_priority, 0),
      'active',
      coalesce(p_active, true)
    )
  );

  return v_id;
end;
$$;


ALTER FUNCTION "public"."admin_upsert_explore_item"("p_target_type" "text", "p_target_id" "text", "p_title" "text", "p_subtitle" "text", "p_priority" integer, "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_visible_hashtags"() RETURNS TABLE("tag" "text", "blocked" boolean, "featured" boolean, "priority" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    h.tag,
    h.blocked,
    h.featured,
    h.priority
  from public.hashtag_controls h
  where public.has_admin_role()
     or not h.blocked
  order by
    h.featured desc,
    h.priority desc,
    h.tag;
$$;


ALTER FUNCTION "public"."admin_visible_hashtags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_follow_user"("p_target_user" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    auth.uid() is not null
    and coalesce(
      (
        select
          (value#>>'{}')::boolean
        from public.app_settings
        where key='follow_enabled'
      ),
      true
    )
    and not coalesce(
      (
        select c.follow_restricted
        from public.profile_admin_controls c
        where c.user_id=p_target_user
      ),
      false
    )
    and not exists(
      select 1
      from public.user_sanctions s
      where s.user_id=auth.uid()
        and s.active=true
        and s.sanction_type in (
          'ban',
          'suspension'
        )
        and (
          s.ends_at is null
          or s.ends_at>now()
        )
    );
$$;


ALTER FUNCTION "public"."can_follow_user"("p_target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_message_user"("p_sender" "uuid", "p_target" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    case

      when p_sender is null
        or p_target is null
        then false

      when p_sender = p_target
        then false

      when exists (
        select 1
        from public.user_blocks
        where
          (
            blocker_id = p_sender
            and blocked_id = p_target
          )
          or
          (
            blocker_id = p_target
            and blocked_id = p_sender
          )
      )
        then false

      else
        case coalesce(
          (
            select message_permission
            from public.profile_privacy_settings
            where user_id = p_target
          ),
          'everyone'
        )

          when 'everyone'
            then true

          when 'followers'
            then exists (
              select 1
              from public.follows
              where
                follower_id = p_sender
                and following_id = p_target
            )

          when 'nobody'
            then false

          else true
        end
    end;
$$;


ALTER FUNCTION "public"."can_message_user"("p_sender" "uuid", "p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_profile_content"("p_owner" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p_owner = auth.uid()

    or not coalesce(
      (
        select s.is_private
        from public.profile_privacy_settings s
        where s.user_id = p_owner
      ),
      false
    )

    or exists (
      select 1
      from public.follows f
      where
        f.follower_id = auth.uid()
        and f.following_id = p_owner
    );
$$;


ALTER FUNCTION "public"."can_view_profile_content"("p_owner" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_user_content"("p_owner" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p_owner is not null
    and (
      p_owner = auth.uid()
      or (
        not exists (
          select 1
          from public.user_blocks b
          where
            (b.blocker_id = auth.uid() and b.blocked_id = p_owner)
            or
            (b.blocker_id = p_owner and b.blocked_id = auth.uid())
        )
        and public.can_view_profile_content(p_owner)
      )
    );
$$;


ALTER FUNCTION "public"."can_view_user_content"("p_owner" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_follow_request"("p_target" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.follow_requests
  where
    requester_id = auth.uid()
    and target_id = p_target;
$$;


ALTER FUNCTION "public"."cancel_follow_request"("p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_premium_analytics_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_event_type text;
begin

  if tg_op = 'INSERT' then
    v_event_type := 'entitlement_created';

  elsif new.status
        is distinct from old.status then
    v_event_type := 'status_changed';

  elsif new.expires_at
        is distinct from old.expires_at then
    v_event_type := 'expiration_changed';

  elsif new.will_renew
        is distinct from old.will_renew then
    v_event_type := 'renewal_state_changed';

  elsif new.provider_event_type
        is distinct from old.provider_event_type then
    v_event_type := 'source_state_changed';

  else
    return new;
  end if;

  insert into public.premium_analytics_events (
    user_id,
    entitlement_id,
    event_type,
    source,
    status,
    previous_status,
    product_id,
    will_renew,
    expires_at,
    provider_event_type
  )
  values (
    new.user_id,
    new.id,
    v_event_type,
    new.source,
    new.status,
    case
      when tg_op = 'UPDATE'
      then old.status
      else null
    end,
    new.product_id,
    new.will_renew,
    new.expires_at,
    new.provider_event_type
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."capture_premium_analytics_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_access"("cid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.communities c
    where c.id = cid
      and (
        c.visibility = 'public'
        or c.created_by = auth.uid()
        or exists (
          select 1
          from public.community_members m
          where m.community_id = cid
            and m.user_id = auth.uid()
        )
      )
  );
$$;


ALTER FUNCTION "public"."community_access"("cid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_admin"("cid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    exists (
      select 1
      from public.communities c
      where c.id = cid
        and c.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.community_members m
      where m.community_id = cid
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    );
$$;


ALTER FUNCTION "public"."community_admin"("cid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_owner_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Community owner cannot change';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."community_owner_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_owner_join"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.community_members (
    community_id,
    user_id,
    role
  )
  values (
    new.id,
    new.created_by,
    'owner'
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."community_owner_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(
    (
      select ur.role
      from public.user_roles ur
      where ur.user_id = auth.uid()
    ),
    'user'
  );
$$;


ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_creation_setting"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_key text := coalesce(TG_ARGV[0],'');
  v_enabled boolean := true;
  v_restriction text := coalesce(TG_ARGV[1],'');
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    return new;
  end if;

  if v_key<>'' then

    select coalesce(
      (s.value#>>'{}')::boolean,
      true
    )
    into v_enabled
    from public.app_settings s
    where s.key=v_key;

    if not coalesce(v_enabled,true) then
      raise exception
        'Bu özellik geçici olarak kapalı';
    end if;

  end if;

  if exists(
    select 1
    from public.user_sanctions s
    where s.user_id=auth.uid()
      and s.active=true
      and s.starts_at<=now()
      and (
        s.ends_at is null
        or s.ends_at>now()
      )
      and (
        s.sanction_type in (
          'ban',
          'suspension'
        )
        or (
          v_restriction<>''
          and
          s.sanction_type=v_restriction
        )
      )
  ) then
    raise exception
      'Bu işlem hesabın için kısıtlandı';
  end if;

  return new;

end;
$$;


ALTER FUNCTION "public"."enforce_creation_setting"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_follow_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_enabled boolean := true;
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    return new;
  end if;

  select coalesce(
    (s.value#>>'{}')::boolean,
    true
  )
  into v_enabled
  from public.app_settings s
  where s.key='follow_enabled';

  if not coalesce(v_enabled,true) then
    raise exception
      'Takip özelliği geçici olarak kapalı';
  end if;

  if exists(
    select 1
    from public.profile_admin_controls c
    where c.user_id=new.following_id
      and c.follow_restricted=true
  ) then
    raise exception
      'Bu kullanıcı için takip geçici olarak kısıtlı';
  end if;

  if exists(
    select 1
    from public.user_sanctions s
    where s.user_id=auth.uid()
      and s.active=true
      and s.starts_at<=now()
      and (
        s.ends_at is null
        or s.ends_at>now()
      )
      and s.sanction_type in (
        'ban',
        'suspension'
      )
  ) then
    raise exception
      'Takip işlemi hesabın için kısıtlandı';
  end if;

  return new;

end;
$$;


ALTER FUNCTION "public"."enforce_follow_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_private_follow_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.follower_id = new.following_id then
    raise exception 'cannot follow self';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where
      (b.blocker_id = new.follower_id and b.blocked_id = new.following_id)
      or
      (b.blocker_id = new.following_id and b.blocked_id = new.follower_id)
  ) then
    raise exception 'follow blocked';
  end if;

  if not coalesce(
    (
      select s.is_private
      from public.profile_privacy_settings s
      where s.user_id = new.following_id
    ),
    false
  ) then
    return new;
  end if;

  if
    auth.uid() = new.following_id
    and exists (
      select 1
      from public.follow_requests r
      where
        r.requester_id = new.follower_id
        and r.target_id = new.following_id
    )
  then
    return new;
  end if;

  raise exception
    'private account requires approved follow request';
end;
$$;


ALTER FUNCTION "public"."enforce_private_follow_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_quote_card_template_access"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_is_premium boolean := false;
begin
  if new.card_template_key is null
     or btrim(new.card_template_key) = '' then
    new.card_template_key := 'classic';
  end if;

  new.card_template_key :=
    lower(btrim(new.card_template_key));

  if new.card_template_key not in (
    'classic',
    'editorial',
    'noir',
    'minimal'
  ) then
    raise exception 'Invalid quote card template'
      using errcode = '22023';
  end if;

  if new.card_template_key = 'classic' then
    return new;
  end if;

  if auth.uid() is null
     or new.user_id <> auth.uid() then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = auth.uid()
      and pe.status in (
        'active',
        'trialing',
        'grace_period'
      )
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (
        pe.expires_at is null
        or pe.expires_at > now()
      )
  )
  into v_is_premium;

  if not v_is_premium then
    raise exception
      'Premium required for this quote card template'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_quote_card_template_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_sanction_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_type text := coalesce(TG_ARGV[0],'');
begin

  if auth.uid() is null then
    return new;
  end if;

  if public.has_admin_role(
    array['moderator','admin','super_admin']
  ) then
    return new;
  end if;

  if exists(
    select 1
    from public.user_sanctions s
    where s.user_id=auth.uid()
      and s.active=true
      and s.starts_at<=now()
      and (
        s.ends_at is null
        or s.ends_at>now()
      )
      and s.sanction_type in (
        'ban',
        'suspension',
        v_type
      )
  ) then
    raise exception
      'Bu işlem hesabın için kısıtlandı';
  end if;

  return new;

end;
$$;


ALTER FUNCTION "public"."enforce_sanction_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."filter_discoverable_reader_candidates"("p_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "is_private" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    coalesce(s.is_private, false) as is_private
  from public.profiles p
  left join public.profile_privacy_settings s
    on s.user_id = p.id
  where p.id = any(coalesce(p_ids, array[]::uuid[]))
    and coalesce(s.discoverable, true)
    and p.id <> auth.uid()
    and not exists (
      select 1
      from public.user_blocks b
      where
        (b.blocker_id = auth.uid() and b.blocked_id = p.id)
        or
        (b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;


ALTER FUNCTION "public"."filter_discoverable_reader_candidates"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_readers"() RETURNS TABLE("user_id" "uuid", "username" "text", "profile_image" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select distinct on (ubs.user_id)
    p.id as user_id,
    p.username,
    p.profile_image
  from public.user_book_status ubs
  join public.profiles p
    on p.id = ubs.user_id
  where ubs.status = 'reading'
    and ubs.user_id <> v_user_id
  order by
    ubs.user_id,
    ubs.updated_at desc
  limit 20;
end;
$$;


ALTER FUNCTION "public"."get_active_readers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_discover_communities"("p_limit" integer DEFAULT 6) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "image_url" "text", "member_count" bigint, "is_member" boolean, "created_at" timestamp with time zone)
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select
    c.id,
    c.name,
    c.description,
    c.image_url,

    count(cm.user_id)::bigint as member_count,

    exists (
      select 1
      from public.community_members my_membership
      where my_membership.community_id = c.id
        and my_membership.user_id = auth.uid()
    ) as is_member,

    c.created_at

  from public.communities c

  left join public.community_members cm
    on cm.community_id = c.id

  where auth.uid() is not null

  group by
    c.id,
    c.name,
    c.description,
    c.image_url,
    c.created_at

  order by
    count(cm.user_id) desc,
    c.created_at desc

  limit greatest(
    1,
    least(coalesce(p_limit, 6), 20)
  );
$$;


ALTER FUNCTION "public"."get_discover_communities"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_attendees"("p_event_id" "uuid") RETURNS TABLE("user_id" "uuid", "username" "text", "profile_image" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    ea.user_id,
    coalesce(p.username, 'Kitap Okuru') as username,
    p.profile_image
  from public.event_attendees ea
  left join public.profiles p
    on p.id = ea.user_id
  where ea.event_id = p_event_id
  order by ea.created_at asc;
$$;


ALTER FUNCTION "public"."get_event_attendees"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_follow_relationship"("p_target" "uuid") RETURNS TABLE("is_following" boolean, "request_pending" boolean, "is_private" boolean, "can_view_content" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.follows f
      where
        f.follower_id = auth.uid()
        and f.following_id = p_target
    ) as is_following,

    exists (
      select 1
      from public.follow_requests r
      where
        r.requester_id = auth.uid()
        and r.target_id = p_target
    ) as request_pending,

    coalesce(
      (
        select s.is_private
        from public.profile_privacy_settings s
        where s.user_id = p_target
      ),
      false
    ) as is_private,

    (
      p_target = auth.uid()
      or not coalesce(
        (
          select s.is_private
          from public.profile_privacy_settings s
          where s.user_id = p_target
        ),
        false
      )
      or exists (
        select 1
        from public.follows f
        where
          f.follower_id = auth.uid()
          and f.following_id = p_target
      )
    ) as can_view_content;
$$;


ALTER FUNCTION "public"."get_follow_relationship"("p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hashtag_content"("p_hashtag" "text", "p_limit" integer DEFAULT 20, "p_before" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("content_id" "uuid", "content_type" "text", "user_id" "uuid", "username" "text", "profile_image" "text", "text" "text", "image_url" "text", "book_key" "text", "book_title" "text", "rating" numeric, "created_at" timestamp with time zone, "likes_count" bigint, "comments_count" bigint, "reposts_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_hashtag text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_hashtag :=
    lower(
      translate(
        regexp_replace(trim(p_hashtag), '^#', ''),
        'ÇĞİIÖŞÜ',
        'çğiıöşü'
      )
    );

  return query

  with post_hashtags as (
    select distinct on (p.id)
      p.id as content_id,
      'post'::text as content_type,
      p.user_id,
      coalesce(pr.username, 'Kullanıcı')::text as username,
      pr.profile_image::text as profile_image,
      coalesce(p.text, '')::text as text,
      p.image_url::text as image_url,
      p.book_key::text as book_key,
      p.book_title::text as book_title,
      p.rating::numeric as rating,
      p.created_at
    from public.posts p
    left join public.profiles pr
      on pr.id = p.user_id
    cross join lateral regexp_matches(
      coalesce(p.text, ''),
      '(^|[^A-Za-z0-9_çÇğĞıİöÖşŞüÜ])#([A-Za-z0-9_çÇğĞıİöÖşŞüÜ]{2,50})',
      'g'
    ) as m
    where
      lower(
        translate(
          m[2],
          'ÇĞİIÖŞÜ',
          'çğiıöşü'
        )
      ) = v_hashtag
      and (
        p_before is null
        or p.created_at < p_before
      )
  ),

  review_hashtags as (
    select distinct on (r.id)
      r.id as content_id,
      'review'::text as content_type,
      r.user_id,
      coalesce(pr.username, 'Kullanıcı')::text as username,
      pr.profile_image::text as profile_image,
      coalesce(r.text, '')::text as text,
      null::text as image_url,
      r.book_key::text as book_key,
      r.book_title::text as book_title,
      r.rating::numeric as rating,
      r.created_at
    from public.reviews r
    left join public.profiles pr
      on pr.id = r.user_id
    cross join lateral regexp_matches(
      coalesce(r.text, ''),
      '(^|[^A-Za-z0-9_çÇğĞıİöÖşŞüÜ])#([A-Za-z0-9_çÇğĞıİöÖşŞüÜ]{2,50})',
      'g'
    ) as m
    where
      lower(
        translate(
          m[2],
          'ÇĞİIÖŞÜ',
          'çğiıöşü'
        )
      ) = v_hashtag
      and (
        p_before is null
        or r.created_at < p_before
      )
  ),

  combined as (
    select * from post_hashtags
    union all
    select * from review_hashtags
  )

  select
    c.content_id,
    c.content_type,
    c.user_id,
    c.username,
    c.profile_image,
    c.text,
    c.image_url,
    c.book_key,
    c.book_title,
    c.rating,
    c.created_at,

    case
      when c.content_type = 'post' then (
        select count(*)
        from public.post_likes pl
        where pl.post_id = c.content_id
      )
      else (
        select count(*)
        from public.likes l
        where l.review_id = c.content_id
      )
    end::bigint as likes_count,

    case
      when c.content_type = 'post' then (
        select count(*)
        from public.post_comments pc
        where pc.post_id = c.content_id
      )
      else (
        select count(*)
        from public.comments cm
        where cm.review_id = c.content_id
      )
    end::bigint as comments_count,

    case
      when c.content_type = 'post' then (
        select count(*)
        from public.post_reposts prp
        where prp.post_id = c.content_id
      )
      else (
        select count(*)
        from public.reposts rp
        where rp.review_id = c.content_id
      )
    end::bigint as reposts_count

  from combined c
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));

end;
$$;


ALTER FUNCTION "public"."get_hashtag_content"("p_hashtag" "text", "p_limit" integer, "p_before" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_admin_notifications"("p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "title" "text", "message" "text", "action_route" "text", "created_at" timestamp with time zone, "read" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    n.id,
    n.title,
    n.message,
    n.action_route,
    n.created_at,
    (r.user_id is not null) as read

  from public.admin_notifications n

  left join public.admin_notification_reads r
    on r.notification_id = n.id
    and r.user_id = auth.uid()

  where
    auth.uid() is not null
    and n.active = true
    and (
      n.target_type = 'all'

      or (
        n.target_type = 'user'
        and n.target_value = auth.uid()::text
      )

      or (
        n.target_type = 'role'
        and n.target_value = public.current_app_role()
      )
    )

  order by n.created_at desc

  limit greatest(
    1,
    least(
      coalesce(p_limit, 100),
      200
    )
  );
$$;


ALTER FUNCTION "public"."get_my_admin_notifications"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_community_invites"() RETURNS TABLE("invite_id" "uuid", "community_id" "uuid", "community_name" "text", "community_image_url" "text", "inviter_id" "uuid", "inviter_username" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    i.id,
    i.community_id,
    c.name,
    c.image_url,
    i.inviter_id,
    coalesce(p.username, 'Kullanıcı'),
    i.created_at
  from public.community_invites i
  join public.communities c
    on c.id = i.community_id
  left join public.profiles p
    on p.id = i.inviter_id
  where i.invitee_id = auth.uid()
    and i.status = 'pending'
  order by i.created_at desc;
$$;


ALTER FUNCTION "public"."get_my_community_invites"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_premium_access"() RETURNS TABLE("is_premium" boolean, "has_paid_premium" boolean, "has_admin_premium" boolean, "paid_sources" "text"[], "active_entitlements" "jsonb", "all_entitlements" "jsonb", "next_expiration_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with mine as (
    select pe.*
    from public.premium_entitlements pe
    where pe.user_id = auth.uid()
  ),
  active as (
    select m.*
    from mine m
    where m.status in (
      'active',
      'trialing',
      'grace_period'
    )
      and m.revoked_at is null
      and m.starts_at <= now()
      and (
        m.expires_at is null
        or m.expires_at > now()
      )
  )
  select
    exists(
      select 1
      from active
    ) as is_premium,

    exists(
      select 1
      from active
      where source in ('apple', 'google')
    ) as has_paid_premium,

    exists(
      select 1
      from active
      where source = 'admin_grant'
    ) as has_admin_premium,

    coalesce(
      (
        select array_agg(
          distinct source
          order by source
        )
        from active
        where source in ('apple', 'google')
      ),
      array[]::text[]
    ) as paid_sources,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'user_id', user_id,
            'source', source,
            'status', status,
            'product_id', product_id,
            'entitlement_id', entitlement_id,
            'source_reference', source_reference,
            'starts_at', starts_at,
            'expires_at', expires_at,
            'revoked_at', revoked_at,
            'created_at', created_at,
            'updated_at', updated_at
          )
          order by created_at desc
        )
        from active
      ),
      '[]'::jsonb
    ) as active_entitlements,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'user_id', user_id,
            'source', source,
            'status', status,
            'product_id', product_id,
            'entitlement_id', entitlement_id,
            'source_reference', source_reference,
            'starts_at', starts_at,
            'expires_at', expires_at,
            'revoked_at', revoked_at,
            'created_at', created_at,
            'updated_at', updated_at
          )
          order by created_at desc
        )
        from mine
      ),
      '[]'::jsonb
    ) as all_entitlements,

    case
      when exists(
        select 1
        from active
        where expires_at is null
      )
      then null

      else (
        select max(expires_at)
        from active
      )
    end as next_expiration_at;
$$;


ALTER FUNCTION "public"."get_my_premium_access"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_premium_access"() IS 'Effective Premium access for the current user. Paid and admin entitlements coexist independently. Access is indefinite when any active entitlement has no expiry; otherwise effective access ends at the latest active entitlement expiration.';



CREATE OR REPLACE FUNCTION "public"."get_popular_books"() RETURNS TABLE("book_key" "text", "book_title" "text", "reading_count" bigint, "read_count" bigint, "want_count" bigint, "total_users" bigint, "popularity_score" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    ubs.book_key,
    max(ubs.book_title) as book_title,

    count(*) filter (
      where ubs.status = 'reading'
    ) as reading_count,

    count(*) filter (
      where ubs.status = 'read'
    ) as read_count,

    count(*) filter (
      where ubs.status = 'want'
    ) as want_count,

    count(*) as total_users,

    (
      count(*) filter (
        where ubs.status = 'reading'
      ) * 3
      +
      count(*) filter (
        where ubs.status = 'want'
      ) * 2
      +
      count(*) filter (
        where ubs.status = 'read'
      )
    ) as popularity_score

  from public.user_book_status ubs

  group by
    ubs.book_key

  order by
    popularity_score desc,
    total_users desc,
    max(ubs.updated_at) desc

  limit 10;
end;
$$;


ALTER FUNCTION "public"."get_popular_books"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_premium_badge_user_ids"("p_user_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select distinct pe.user_id
  from public.premium_entitlements pe
  where auth.uid() is not null
    and pe.user_id = any(
      coalesce(
        p_user_ids,
        array[]::uuid[]
      )
    )
    and pe.status in (
      'active',
      'trialing',
      'grace_period'
    )
    and pe.revoked_at is null
    and pe.starts_at <= now()
    and (
      pe.expires_at is null
      or pe.expires_at > now()
    );
$$;


ALTER FUNCTION "public"."get_premium_badge_user_ids"("p_user_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_premium_badge_user_ids"("p_user_ids" "uuid"[]) IS 'Returns only the user IDs that currently have Premium access, without exposing purchase source, product, transaction, or subscription metadata.';



CREATE OR REPLACE FUNCTION "public"."get_premium_goal_dashboard"() RETURNS TABLE("weekly_page_goal" integer, "weekly_pages_read" bigint, "monthly_page_goal" integer, "monthly_pages_read" bigint, "yearly_book_goal" integer, "yearly_books_completed" bigint, "streak_goal_days" integer, "current_streak" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_today date;
  v_week_start date;
  v_month_start date;
  v_year_start date;
  v_weekly integer := 140;
  v_monthly integer := 600;
  v_yearly integer := 24;
  v_streak_goal integer := 7;
  v_current_streak integer := 0;
  v_check_date date;
  v_start_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in (
        'active',
        'trialing',
        'grace_period'
      )
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (
        pe.expires_at is null
        or pe.expires_at > now()
      )
  ) then
    raise exception 'Premium required'
      using errcode = '42501';
  end if;

  select rp.timezone
  into v_timezone
  from public.reading_preferences rp
  where rp.user_id = v_user_id;

  v_timezone :=
    coalesce(nullif(btrim(v_timezone), ''), 'UTC');

  begin
    v_today :=
      (now() at time zone v_timezone)::date;
  exception when others then
    v_today :=
      (now() at time zone 'UTC')::date;
  end;

  select
    prg.weekly_page_goal,
    prg.monthly_page_goal,
    prg.yearly_book_goal,
    prg.streak_goal_days
  into
    v_weekly,
    v_monthly,
    v_yearly,
    v_streak_goal
  from public.premium_reading_goals prg
  where prg.user_id = v_user_id;

  v_weekly := coalesce(v_weekly, 140);
  v_monthly := coalesce(v_monthly, 600);
  v_yearly := coalesce(v_yearly, 24);
  v_streak_goal := coalesce(v_streak_goal, 7);

  v_week_start :=
    date_trunc('week', v_today::timestamp)::date;

  v_month_start :=
    date_trunc('month', v_today::timestamp)::date;

  v_year_start :=
    make_date(
      extract(year from v_today)::integer,
      1,
      1
    );

  if exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today
      and ds.pages_read > 0
  ) then
    v_start_date := v_today;

  elsif exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today - 1
      and ds.pages_read > 0
  ) then
    v_start_date := v_today - 1;
  end if;

  if v_start_date is not null then
    v_check_date := v_start_date;

    loop
      exit when not exists (
        select 1
        from public.reading_daily_stats ds
        where ds.user_id = v_user_id
          and ds.reading_date = v_check_date
          and ds.pages_read > 0
      );

      v_current_streak :=
        v_current_streak + 1;

      v_check_date :=
        v_check_date - 1;
    end loop;
  end if;

  return query
  select
    v_weekly,
    coalesce((
      select sum(ds.pages_read)::bigint
      from public.reading_daily_stats ds
      where ds.user_id = v_user_id
        and ds.reading_date
          between v_week_start and v_today
    ), 0),

    v_monthly,
    coalesce((
      select sum(ds.pages_read)::bigint
      from public.reading_daily_stats ds
      where ds.user_id = v_user_id
        and ds.reading_date
          between v_month_start and v_today
    ), 0),

    v_yearly,
    coalesce((
      select count(*)::bigint
      from public.user_book_status ubs
      where ubs.user_id = v_user_id
        and ubs.status = 'read'
        and ubs.updated_at >=
          v_year_start::timestamptz
        and ubs.updated_at <
          (v_year_start + interval '1 year')
    ), 0),

    v_streak_goal,
    v_current_streak;
end;
$$;


ALTER FUNCTION "public"."get_premium_goal_dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_premium_reading_stats"() RETURNS TABLE("period_start" "date", "period_end" "date", "total_pages_30d" bigint, "active_days_30d" bigint, "average_pages_active_day" numeric, "best_day_pages" integer, "best_day" "date", "goal_hit_days" bigint, "pages_last_7d" bigint, "pages_previous_7d" bigint, "current_streak" integer, "daily_page_goal" integer, "daily_series" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_goal integer := 20;
  v_today date;
  v_period_start date;
  v_total_pages bigint := 0;
  v_active_days bigint := 0;
  v_average numeric := 0;
  v_best_pages integer := 0;
  v_best_day date := null;
  v_goal_hit_days bigint := 0;
  v_last_7d bigint := 0;
  v_previous_7d bigint := 0;
  v_streak integer := 0;
  v_start_date date;
  v_check_date date;
  v_series jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active', 'trialing', 'grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
    raise exception 'Premium required'
      using errcode = '42501';
  end if;

  select rp.daily_page_goal, rp.timezone
  into v_goal, v_timezone
  from public.reading_preferences rp
  where rp.user_id = v_user_id;

  v_goal := coalesce(v_goal, 20);
  v_timezone := coalesce(nullif(btrim(v_timezone), ''), 'UTC');

  begin
    v_today := (now() at time zone v_timezone)::date;
  exception when others then
    v_timezone := 'UTC';
    v_today := (now() at time zone 'UTC')::date;
  end;

  v_period_start := v_today - 29;

  select
    coalesce(sum(ds.pages_read), 0)::bigint,
    count(*) filter (where ds.pages_read > 0)::bigint,
    coalesce(
      round(
        avg(ds.pages_read) filter (where ds.pages_read > 0),
        1
      ),
      0
    ),
    count(*) filter (where ds.pages_read >= v_goal)::bigint
  into
    v_total_pages,
    v_active_days,
    v_average,
    v_goal_hit_days
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_period_start and v_today;

  select ds.reading_date, ds.pages_read
  into v_best_day, v_best_pages
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between v_period_start and v_today
    and ds.pages_read > 0
  order by ds.pages_read desc, ds.reading_date desc
  limit 1;

  v_best_pages := coalesce(v_best_pages, 0);

  select coalesce(sum(ds.pages_read), 0)::bigint
  into v_last_7d
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between (v_today - 6) and v_today;

  select coalesce(sum(ds.pages_read), 0)::bigint
  into v_previous_7d
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date between (v_today - 13) and (v_today - 7);

  if exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today
      and ds.pages_read > 0
  ) then
    v_start_date := v_today;

  elsif exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today - 1
      and ds.pages_read > 0
  ) then
    v_start_date := v_today - 1;

  else
    v_start_date := null;
  end if;

  if v_start_date is not null then
    v_check_date := v_start_date;

    loop
      exit when not exists (
        select 1
        from public.reading_daily_stats ds
        where ds.user_id = v_user_id
          and ds.reading_date = v_check_date
          and ds.pages_read > 0
      );

      v_streak := v_streak + 1;
      v_check_date := v_check_date - 1;
    end loop;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', days.day::date,
        'pages', coalesce(ds.pages_read, 0)
      )
      order by days.day
    ),
    '[]'::jsonb
  )
  into v_series
  from generate_series(
    v_period_start::timestamp,
    v_today::timestamp,
    interval '1 day'
  ) as days(day)
  left join public.reading_daily_stats ds
    on ds.user_id = v_user_id
   and ds.reading_date = days.day::date;

  return query
  select
    v_period_start,
    v_today,
    v_total_pages,
    v_active_days,
    v_average,
    v_best_pages,
    v_best_day,
    v_goal_hit_days,
    v_last_7d,
    v_previous_7d,
    v_streak,
    v_goal,
    v_series;
end;
$$;


ALTER FUNCTION "public"."get_premium_reading_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_premium_reading_stats"() IS 'Premium-only 30-day reading analytics. Premium authorization is enforced server-side.';



CREATE OR REPLACE FUNCTION "public"."get_premium_year_report"("p_year" integer DEFAULT NULL::integer) RETURNS TABLE("report_year" integer, "total_pages" bigint, "active_days" bigint, "books_completed" bigint, "goal_hit_days" bigint, "best_day" "date", "best_day_pages" integer, "best_month" integer, "best_month_pages" bigint, "average_pages_active_day" numeric, "monthly_series" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_goal integer := 20;
  v_today date;
  v_year integer;
  v_year_start date;
  v_year_end date;
  v_total_pages bigint := 0;
  v_active_days bigint := 0;
  v_books_completed bigint := 0;
  v_goal_hit_days bigint := 0;
  v_best_day date := null;
  v_best_day_pages integer := 0;
  v_best_month integer := null;
  v_best_month_pages bigint := 0;
  v_average numeric := 0;
  v_monthly_series jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in ('active', 'trialing', 'grace_period')
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (pe.expires_at is null or pe.expires_at > now())
  ) then
    raise exception 'Premium required'
      using errcode = '42501';
  end if;

  select
    rp.daily_page_goal,
    rp.timezone
  into
    v_goal,
    v_timezone
  from public.reading_preferences rp
  where rp.user_id = v_user_id;

  v_goal := coalesce(v_goal, 20);
  v_timezone := coalesce(
    nullif(btrim(v_timezone), ''),
    'UTC'
  );

  begin
    v_today := (now() at time zone v_timezone)::date;
  exception when others then
    v_timezone := 'UTC';
    v_today := (now() at time zone 'UTC')::date;
  end;

  v_year := coalesce(
    p_year,
    extract(year from v_today)::integer
  );

  if v_year < 2000
     or v_year > extract(year from v_today)::integer then
    raise exception 'Invalid report year'
      using errcode = '22023';
  end if;

  v_year_start := make_date(v_year, 1, 1);
  v_year_end := make_date(v_year, 12, 31);

  select
    coalesce(sum(ds.pages_read), 0)::bigint,
    count(*) filter (
      where ds.pages_read > 0
    )::bigint,
    count(*) filter (
      where ds.pages_read >= v_goal
    )::bigint,
    coalesce(
      round(
        avg(ds.pages_read)
          filter (where ds.pages_read > 0),
        1
      ),
      0
    )
  into
    v_total_pages,
    v_active_days,
    v_goal_hit_days,
    v_average
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date
      between v_year_start and v_year_end;

  select count(*)::bigint
  into v_books_completed
  from public.user_book_status ubs
  where ubs.user_id = v_user_id
    and ubs.status = 'read'
    and ubs.updated_at >= v_year_start::timestamptz
    and ubs.updated_at < (v_year_end + 1)::timestamptz;

  select
    ds.reading_date,
    ds.pages_read
  into
    v_best_day,
    v_best_day_pages
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date
      between v_year_start and v_year_end
    and ds.pages_read > 0
  order by
    ds.pages_read desc,
    ds.reading_date desc
  limit 1;

  v_best_day_pages :=
    coalesce(v_best_day_pages, 0);

  select
    extract(month from ds.reading_date)::integer,
    sum(ds.pages_read)::bigint
  into
    v_best_month,
    v_best_month_pages
  from public.reading_daily_stats ds
  where ds.user_id = v_user_id
    and ds.reading_date
      between v_year_start and v_year_end
  group by extract(month from ds.reading_date)
  having sum(ds.pages_read) > 0
  order by
    sum(ds.pages_read) desc,
    extract(month from ds.reading_date) desc
  limit 1;

  v_best_month_pages :=
    coalesce(v_best_month_pages, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', months.month_number,
        'pages', coalesce(month_totals.pages, 0),
        'active_days',
          coalesce(month_totals.active_days, 0)
      )
      order by months.month_number
    ),
    '[]'::jsonb
  )
  into v_monthly_series
  from generate_series(1, 12)
    as months(month_number)
  left join (
    select
      extract(
        month from ds.reading_date
      )::integer as month_number,
      sum(ds.pages_read)::bigint as pages,
      count(*) filter (
        where ds.pages_read > 0
      )::bigint as active_days
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date
        between v_year_start and v_year_end
    group by extract(month from ds.reading_date)
  ) month_totals
    on month_totals.month_number =
       months.month_number;

  return query
  select
    v_year,
    v_total_pages,
    v_active_days,
    v_books_completed,
    v_goal_hit_days,
    v_best_day,
    v_best_day_pages,
    v_best_month,
    v_best_month_pages,
    v_average,
    v_monthly_series;
end;
$$;


ALTER FUNCTION "public"."get_premium_year_report"("p_year" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_premium_year_report"("p_year" integer) IS 'Premium-only annual reading report with monthly page totals and completed-book count.';



CREATE OR REPLACE FUNCTION "public"."get_reading_dashboard"() RETURNS TABLE("today_pages_read" integer, "daily_page_goal" integer, "current_streak" integer, "timezone" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_timezone text := 'UTC';
  v_goal integer := 20;
  v_today date;
  v_start_date date;
  v_check_date date;
  v_streak integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    rp.daily_page_goal,
    rp.timezone
  into
    v_goal,
    v_timezone
  from public.reading_preferences rp
  where rp.user_id = v_user_id;

  v_goal := coalesce(v_goal, 20);
  v_timezone := coalesce(nullif(btrim(v_timezone), ''), 'UTC');

  begin
    v_today := (now() at time zone v_timezone)::date;
  exception
    when others then
      v_timezone := 'UTC';
      v_today := (now() at time zone 'UTC')::date;
  end;

  if exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today
      and ds.pages_read > 0
  ) then
    v_start_date := v_today;

  elsif exists (
    select 1
    from public.reading_daily_stats ds
    where ds.user_id = v_user_id
      and ds.reading_date = v_today - 1
      and ds.pages_read > 0
  ) then
    v_start_date := v_today - 1;

  else
    v_start_date := null;
  end if;

  if v_start_date is not null then
    v_check_date := v_start_date;

    loop
      exit when not exists (
        select 1
        from public.reading_daily_stats ds
        where ds.user_id = v_user_id
          and ds.reading_date = v_check_date
          and ds.pages_read > 0
      );

      v_streak := v_streak + 1;
      v_check_date := v_check_date - 1;
    end loop;
  end if;

  return query
  select
    coalesce(
      (
        select ds.pages_read
        from public.reading_daily_stats ds
        where ds.user_id = v_user_id
          and ds.reading_date = v_today
      ),
      0
    ),
    v_goal,
    v_streak,
    v_timezone;
end;
$$;


ALTER FUNCTION "public"."get_reading_dashboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_same_book_readers"("p_book_key" "text") RETURNS TABLE("user_id" "uuid", "username" "text", "profile_image" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_book_key is null or btrim(p_book_key) = '' then
    raise exception 'Book key is required';
  end if;

  return query
  select
    p.id as user_id,
    p.username,
    p.profile_image
  from public.user_book_status ubs
  join public.profiles p
    on p.id = ubs.user_id
  where ubs.book_key = p_book_key
    and ubs.status = 'reading'
    and ubs.user_id <> v_user_id
  order by ubs.updated_at desc
  limit 10;
end;
$$;


ALTER FUNCTION "public"."get_same_book_readers"("p_book_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_content"() RETURNS TABLE("content_id" "uuid", "content_type" "text", "user_id" "uuid", "username" "text", "text" "text", "image_url" "text", "book_key" "text", "book_title" "text", "rating" numeric, "created_at" timestamp with time zone, "likes_count" bigint, "comments_count" bigint, "reposts_count" bigint, "trend_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with
  post_like_counts as (
    select
      pl.post_id,
      count(*)::bigint as likes_count
    from public.post_likes pl
    group by pl.post_id
  ),

  post_comment_counts as (
    select
      pc.post_id,
      count(*)::bigint as comments_count
    from public.post_comments pc
    group by pc.post_id
  ),

  post_repost_counts as (
    select
      pr.post_id,
      count(*)::bigint as reposts_count
    from public.post_reposts pr
    group by pr.post_id
  ),

  review_like_counts as (
    select
      l.review_id,
      count(*)::bigint as likes_count
    from public.likes l
    group by l.review_id
  ),

  review_comment_counts as (
    select
      c.review_id,
      count(*)::bigint as comments_count
    from public.comments c
    group by c.review_id
  ),

  review_repost_counts as (
    select
      r.review_id,
      count(*)::bigint as reposts_count
    from public.reposts r
    group by r.review_id
  ),

  post_metrics as (
    select
      p.id as content_id,
      'post'::text as content_type,
      p.user_id,
      coalesce(prof.username, p.username, 'Kullanıcı') as username,
      coalesce(p.text, '') as text,
      p.image_url,
      p.book_key,
      p.book_title,
      p.rating::numeric as rating,
      p.created_at,

      coalesce(plc.likes_count, 0)::bigint as likes_count,
      coalesce(pcc.comments_count, 0)::bigint as comments_count,
      coalesce(prc.reposts_count, 0)::bigint as reposts_count

    from public.posts p

    left join public.profiles prof
      on prof.id = p.user_id

    left join post_like_counts plc
      on plc.post_id = p.id

    left join post_comment_counts pcc
      on pcc.post_id = p.id

    left join post_repost_counts prc
      on prc.post_id = p.id

    where p.created_at >= now() - interval '7 days'
  ),

  review_metrics as (
    select
      rv.id as content_id,
      'review'::text as content_type,
      rv.user_id,
      coalesce(prof.username, 'Kullanıcı') as username,
      coalesce(rv.text, '') as text,
      null::text as image_url,
      rv.book_key,
      rv.book_title,
      rv.rating::numeric as rating,
      rv.created_at,

      coalesce(rlc.likes_count, 0)::bigint as likes_count,
      coalesce(rcc.comments_count, 0)::bigint as comments_count,
      coalesce(rrc.reposts_count, 0)::bigint as reposts_count

    from public.reviews rv

    left join public.profiles prof
      on prof.id = rv.user_id

    left join review_like_counts rlc
      on rlc.review_id = rv.id

    left join review_comment_counts rcc
      on rcc.review_id = rv.id

    left join review_repost_counts rrc
      on rrc.review_id = rv.id

    where rv.created_at >= now() - interval '7 days'
  ),

  combined as (
    select * from post_metrics
    union all
    select * from review_metrics
  ),

  scored as (
    select
      c.*,

      (
        (
          1
          + c.likes_count
          + c.comments_count * 2
          + c.reposts_count * 3
        )::numeric
        /
        (
          1
          +
          greatest(
            extract(
              epoch from (now() - c.created_at)
            ) / 3600.0,
            0
          ) / 24.0
        )
      )::numeric as trend_score

    from combined c
  )

  select
    s.content_id,
    s.content_type,
    s.user_id,
    s.username,
    s.text,
    s.image_url,
    s.book_key,
    s.book_title,
    s.rating,
    s.created_at,
    s.likes_count,
    s.comments_count,
    s.reposts_count,
    s.trend_score

  from scored s

  order by
    s.trend_score desc,
    s.created_at desc

  limit 5;
end;
$$;


ALTER FUNCTION "public"."get_trending_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_hashtags"() RETURNS TABLE("hashtag" "text", "display_hashtag" "text", "mention_count" bigint, "unique_users" bigint, "post_count" bigint, "review_count" bigint, "trend_score" numeric, "latest_mention_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with
  source_content as (
    select
      'post'::text as content_type,
      p.id as content_id,
      p.user_id,
      p.text,
      p.created_at
    from public.posts p
    where
      p.created_at >= now() - interval '7 days'
      and p.text is not null
      and btrim(p.text) <> ''

    union all

    select
      'review'::text as content_type,
      r.id as content_id,
      r.user_id,
      r.text,
      r.created_at
    from public.reviews r
    where
      r.created_at >= now() - interval '7 days'
      and r.text is not null
      and btrim(r.text) <> ''
  ),

  extracted as (
    select
      sc.content_type,
      sc.content_id,
      sc.user_id,
      sc.created_at,

      m.match_array[2] as original_tag,

      lower(
        translate(
          m.match_array[2],
          'ÇĞİIÖŞÜ',
          'çğiıöşü'
        )
      ) as normalized_tag

    from source_content sc

    cross join lateral (
      select
        regexp_matches(
          sc.text,
          '(^|[^A-Za-z0-9_çÇğĞıİöÖşŞüÜ])#([A-Za-z0-9_çÇğĞıİöÖşŞüÜ]{2,50})',
          'g'
        ) as match_array
    ) m
  ),

  content_distinct as (
    select distinct
      e.content_type,
      e.content_id,
      e.user_id,
      e.created_at,
      e.normalized_tag,
      e.original_tag

    from extracted e
    where
      e.normalized_tag is not null
      and e.normalized_tag <> ''
  ),

  user_ranked as (
    select
      cd.*,

      row_number() over (
        partition by
          cd.user_id,
          cd.normalized_tag
        order by
          cd.created_at desc
      ) as user_tag_rank

    from content_distinct cd
  ),

  scored_mentions as (
    select
      ur.*,

      case
        when ur.created_at >= now() - interval '1 hour'
          then 4.0

        when ur.created_at >= now() - interval '6 hours'
          then 2.5

        when ur.created_at >= now() - interval '24 hours'
          then 1.5

        else 0.25
      end::numeric as time_weight

    from user_ranked ur

    where
      ur.user_tag_rank <= 3
      or ur.created_at < now() - interval '24 hours'
  ),

  base_stats as (
    select
      cd.normalized_tag as hashtag,

      count(*)::bigint as mention_count,

      count(
        distinct cd.user_id
      )::bigint as unique_users,

      count(*) filter (
        where cd.content_type = 'post'
      )::bigint as post_count,

      count(*) filter (
        where cd.content_type = 'review'
      )::bigint as review_count,

      max(cd.created_at) as latest_mention_at

    from content_distinct cd

    group by
      cd.normalized_tag
  ),

  weighted_stats as (
    select
      sm.normalized_tag as hashtag,

      sum(sm.time_weight)::numeric
        as weighted_mentions,

      count(
        distinct sm.user_id
      ) filter (
        where sm.created_at >= now() - interval '24 hours'
      )::bigint as unique_users_24h,

      count(
        distinct sm.user_id
      )::bigint as unique_users_7d

    from scored_mentions sm

    group by
      sm.normalized_tag
  ),

  display_variants as (
    select
      x.normalized_tag as hashtag,
      x.original_tag as display_hashtag

    from (
      select
        cd.normalized_tag,
        cd.original_tag,

        count(*) as variant_count,

        row_number() over (
          partition by cd.normalized_tag
          order by
            count(*) desc,
            max(cd.created_at) desc
        ) as variant_rank

      from content_distinct cd

      group by
        cd.normalized_tag,
        cd.original_tag
    ) x

    where
      x.variant_rank = 1
  )

  select
    bs.hashtag,

    coalesce(
      dv.display_hashtag,
      bs.hashtag
    ) as display_hashtag,

    bs.mention_count,
    bs.unique_users,
    bs.post_count,
    bs.review_count,

    (
      coalesce(ws.weighted_mentions, 0)
      +
      coalesce(ws.unique_users_24h, 0) * 2
      +
      coalesce(ws.unique_users_7d, 0) * 0.5
    )::numeric as trend_score,

    bs.latest_mention_at

  from base_stats bs

  left join weighted_stats ws
    on ws.hashtag = bs.hashtag

  left join display_variants dv
    on dv.hashtag = bs.hashtag

  order by
    trend_score desc,
    bs.unique_users desc,
    bs.mention_count desc,
    bs.latest_mention_at desc

  limit 10;
end;
$$;


ALTER FUNCTION "public"."get_trending_hashtags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_admin_audit_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  raise exception 'Admin audit logs are append-only'
    using errcode = '42501';
end;
$$;


ALTER FUNCTION "public"."guard_admin_audit_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_blocked_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if auth.uid() is null or new.follower_id <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  if new.follower_id = new.following_id then
    raise exception 'cannot_follow_self';
  end if;

  if public.readers_blocked(new.follower_id, new.following_id) then
    raise exception 'blocked_relationship';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_blocked_follow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_notification_preference"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_recipient uuid;
begin

  /*
    Mevcut notifications yapısında alıcı sütunu user_id ise
    onu kullanır.
  */
  v_recipient := new.user_id;

  if v_recipient is null then
    return new;
  end if;

  if not public.notification_type_enabled(
    v_recipient,
    new.type
  ) then
    return null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_notification_preference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_premium_entitlement_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Premium entitlement user_id is immutable'
      using errcode = '42501';
  end if;

  if new.source is distinct from old.source then
    raise exception 'Premium entitlement source is immutable'
      using errcode = '42501';
  end if;

  if coalesce(new.source_reference, '')
     is distinct from coalesce(old.source_reference, '') then
    raise exception 'Premium entitlement source_reference is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_premium_entitlement_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_report_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_recent_count integer;
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  select count(*)
    into v_recent_count
  from public.reports
  where reporter_id = auth.uid()
    and created_at >= now() - interval '10 minutes';

  if v_recent_count >= 30 then
    raise exception 'report_rate_limited';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_report_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_user_report_repeat"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if auth.uid() is null or new.reporter_id <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  if exists (
    select 1
    from public.user_reports
    where reporter_id = auth.uid()
      and reported_id = new.reported_id
      and created_at >= now() - interval '24 hours'
  ) then
    raise exception 'report_already_submitted_recently';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_user_report_repeat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_admin_role"("required_roles" "text"[] DEFAULT ARRAY['moderator'::"text", 'admin'::"text", 'super_admin'::"text"]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    auth.uid() is not null
    and public.current_app_role() = any(required_roles);
$$;


ALTER FUNCTION "public"."has_admin_role"("required_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_to_community"("p_community_id" "uuid", "p_invitee_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.community_admin(p_community_id) then
    raise exception 'Not allowed to invite to this community';
  end if;

  if p_invitee_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;

  if exists (
    select 1
    from public.community_members
    where community_id = p_community_id
      and user_id = p_invitee_id
  ) then
    raise exception 'User is already a member';
  end if;

  insert into public.community_invites (
    community_id,
    inviter_id,
    invitee_id,
    status,
    created_at,
    responded_at
  )
  values (
    p_community_id,
    auth.uid(),
    p_invitee_id,
    'pending',
    now(),
    null
  )
  on conflict (community_id, invitee_id)
  do update set
    inviter_id = excluded.inviter_id,
    status = 'pending',
    created_at = now(),
    responded_at = null
  returning id into invite_id;

  return invite_id;
end;
$$;


ALTER FUNCTION "public"."invite_to_community"("p_community_id" "uuid", "p_invitee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_search_event"("p_query" "text", "p_scope" "text" DEFAULT 'all'::"text", "p_result_count" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_q text :=
    left(
      trim(coalesce(p_query,'')),
      200
    );
begin

  if auth.uid() is null
     or length(v_q)<2 then
    return;
  end if;

  insert into public.search_events(
    user_id,
    query,
    scope,
    result_count
  )
  values(
    auth.uid(),
    v_q,
    left(
      coalesce(
        nullif(trim(p_scope),''),
        'all'
      ),
      40
    ),
    greatest(
      coalesce(p_result_count,0),
      0
    )
  );

end;
$$;


ALTER FUNCTION "public"."log_search_event"("p_query" "text", "p_scope" "text", "p_result_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_admin_notification_read"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.get_my_admin_notifications(200) n
    where n.id = p_notification_id
  ) then
    raise exception 'notification not available';
  end if;

  insert into public.admin_notification_reads (
    notification_id,
    user_id
  )
  values (
    p_notification_id,
    auth.uid()
  )
  on conflict (
    notification_id,
    user_id
  ) do nothing;

end;
$$;


ALTER FUNCTION "public"."mark_admin_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notification_type_enabled"("p_user_id" "uuid", "p_type" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    case lower(coalesce(p_type, ''))
      when 'like'
        then coalesce(np.likes_enabled, true)

      when 'comment'
        then coalesce(np.comments_enabled, true)

      when 'repost'
        then coalesce(np.reposts_enabled, true)

      when 'follow'
        then coalesce(np.follows_enabled, true)

      when 'message'
        then coalesce(np.messages_enabled, true)

      when 'system'
        then coalesce(np.system_enabled, true)

      when 'announcement'
        then coalesce(np.system_enabled, true)

      else true
    end
  from (select 1) as base
  left join public.notification_preferences np
    on np.user_id = p_user_id;
$$;


ALTER FUNCTION "public"."notification_type_enabled"("p_user_id" "uuid", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_follow_request_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if public.should_deliver_notification(
    new.target_id,
    'follow'
  ) then

    delete from public.social_notifications
    where
      user_id = new.target_id
      and actor_id = new.requester_id
      and type = 'follow_request';

    insert into public.social_notifications(
      user_id,
      actor_id,
      type,
      message
    )
    values (
      new.target_id,
      new.requester_id,
      'follow_request',
      'sana takip isteği gönderdi'
    );

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_follow_request_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_revenuecat_premium_event"("p_event_id" "text", "p_event_type" "text", "p_user_id" "uuid", "p_source" "text", "p_product_id" "text", "p_source_reference" "text", "p_status" "text", "p_started_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_provider_event_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_inserted integer := 0;
  v_existing public.premium_entitlements;
  v_started_at timestamptz := coalesce(p_started_at, p_provider_event_at, now());
  v_effective_status text;
  v_will_renew boolean;
begin
  if coalesce(trim(p_event_id), '') = '' then
    raise exception 'RevenueCat event id is required' using errcode = '22023';
  end if;

  if coalesce(trim(p_event_type), '') = '' then
    raise exception 'RevenueCat event type is required' using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'RevenueCat user id is required' using errcode = '22023';
  end if;

  if p_source not in ('apple', 'google') then
    raise exception 'Invalid RevenueCat source' using errcode = '22023';
  end if;

  if coalesce(trim(p_source_reference), '') = '' then
    raise exception 'RevenueCat source reference is required' using errcode = '22023';
  end if;

  if p_provider_event_at is null then
    raise exception 'RevenueCat provider event time is required' using errcode = '22023';
  end if;

  if p_event_type not in (
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'CANCELLATION',
    'UNCANCELLATION',
    'BILLING_ISSUE',
    'EXPIRATION',
    'SUBSCRIPTION_PAUSED',
    'SUBSCRIPTION_EXTENDED'
  ) then
    raise exception 'Unsupported RevenueCat event type' using errcode = '22023';
  end if;

  v_effective_status := case
    when p_event_type = 'EXPIRATION' then 'expired'
    when p_event_type = 'SUBSCRIPTION_PAUSED' then 'inactive'

    when p_event_type = 'BILLING_ISSUE' then
      case
        when p_expires_at is not null
          and p_expires_at > p_provider_event_at
        then 'grace_period'
        else 'inactive'
      end

    when p_event_type = 'CANCELLATION' then
      case
        when p_expires_at is null then 'inactive'
        when p_expires_at <= p_provider_event_at then 'expired'
        when p_status = 'trialing' then 'trialing'
        else 'active'
      end

    when p_status = 'trialing' then 'trialing'
    else 'active'
  end;

  if p_expires_at is not null
     and p_expires_at <= v_started_at then
    v_started_at := p_expires_at - interval '1 second';
  end if;

  insert into public.revenuecat_webhook_events (
    event_id,
    event_type,
    app_user_id,
    source,
    product_id,
    source_reference,
    provider_event_at
  )
  values (
    trim(p_event_id),
    trim(p_event_type),
    p_user_id,
    p_source,
    nullif(trim(coalesce(p_product_id, '')), ''),
    trim(p_source_reference),
    p_provider_event_at
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  select pe.*
  into v_existing
  from public.premium_entitlements pe
  where pe.user_id = p_user_id
    and pe.source = p_source
    and pe.source_reference = trim(p_source_reference)
  order by pe.created_at asc
  limit 1
  for update;

  v_will_renew := case
    when p_event_type in (
      'CANCELLATION',
      'EXPIRATION',
      'SUBSCRIPTION_PAUSED'
    ) then false

    when p_event_type in (
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION'
    ) then true

    when found then v_existing.will_renew
    else null
  end;

  if found then
    if v_existing.provider_event_at is null
       or p_provider_event_at >= v_existing.provider_event_at then

      update public.premium_entitlements
      set
        status = v_effective_status,
        product_id = nullif(trim(coalesce(p_product_id, '')), ''),
        entitlement_id = 'premium',
        starts_at = least(v_existing.starts_at, v_started_at),
        expires_at = p_expires_at,
        revoked_at = null,
        provider_event_at = p_provider_event_at,
        provider_event_id = trim(p_event_id),
        provider_event_type = trim(p_event_type),
        will_renew = v_will_renew,
        updated_at = now()
      where id = v_existing.id;

    end if;
  else

    insert into public.premium_entitlements (
      user_id,
      source,
      status,
      product_id,
      entitlement_id,
      source_reference,
      starts_at,
      expires_at,
      revoked_at,
      provider_event_at,
      provider_event_id,
      provider_event_type,
      will_renew
    )
    values (
      p_user_id,
      p_source,
      v_effective_status,
      nullif(trim(coalesce(p_product_id, '')), ''),
      'premium',
      trim(p_source_reference),
      v_started_at,
      p_expires_at,
      null,
      p_provider_event_at,
      trim(p_event_id),
      trim(p_event_type),
      v_will_renew
    );

  end if;

  update public.revenuecat_webhook_events
  set
    processed = true,
    processed_at = now()
  where event_id = trim(p_event_id);

  return true;
end;
$$;


ALTER FUNCTION "public"."process_revenuecat_premium_event"("p_event_id" "text", "p_event_type" "text", "p_user_id" "uuid", "p_source" "text", "p_product_id" "text", "p_source_reference" "text", "p_status" "text", "p_started_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_provider_event_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_revenuecat_premium_event"("p_event_id" "text", "p_event_type" "text", "p_user_id" "uuid", "p_source" "text", "p_product_id" "text", "p_source_reference" "text", "p_status" "text", "p_started_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_provider_event_at" timestamp with time zone) IS 'Service-role-only RevenueCat paid Premium sync. Idempotent by event id and ignores older provider events so delayed webhooks cannot overwrite newer state.';



CREATE OR REPLACE FUNCTION "public"."public_profile_verifications"("p_user_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid", "verified" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    p.id,
    coalesce(c.verified,false)
  from public.profiles p
  left join public.profile_admin_controls c
    on c.user_id = p.id
  where p.id = any(
    coalesce(
      p_user_ids,
      '{}'::uuid[]
    )
  );
$$;


ALTER FUNCTION "public"."public_profile_verifications"("p_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reader_conversation_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.id is distinct from old.id
     or new.user1_id is distinct from old.user1_id
     or new.user2_id is distinct from old.user2_id then
    raise exception 'Conversation participants cannot change';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."reader_conversation_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reader_message_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.content is distinct from old.content then
    raise exception 'Message identity and content cannot be changed';
  end if;

  if auth.uid() = old.sender_id
     and new.is_read is distinct from old.is_read then
    raise exception 'Only recipient can mark messages read';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."reader_message_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reader_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();

  if new.status = 'published'
     and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."reader_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."readers_blocked"("a" "uuid", "b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when auth.uid() is null then false
    when auth.uid() <> a and auth.uid() <> b then false
    else exists (
      select 1
      from public.user_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$$;


ALTER FUNCTION "public"."readers_blocked"("a" "uuid", "b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_follow"("p_target" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_private boolean := false;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_target is null or p_target = v_user then
    raise exception 'invalid follow target';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where
      (b.blocker_id = v_user and b.blocked_id = p_target)
      or
      (b.blocker_id = p_target and b.blocked_id = v_user)
  ) then
    raise exception 'follow blocked';
  end if;

  if exists (
    select 1
    from public.follows f
    where
      f.follower_id = v_user
      and f.following_id = p_target
  ) then
    delete from public.follow_requests
    where
      requester_id = v_user
      and target_id = p_target;

    return 'following';
  end if;

  select coalesce(s.is_private, false)
  into v_private
  from public.profile_privacy_settings s
  where s.user_id = p_target;

  v_private := coalesce(v_private, false);

  if v_private then
    insert into public.follow_requests (
      requester_id,
      target_id
    )
    values (
      v_user,
      p_target
    )
    on conflict (requester_id, target_id)
    do nothing;

    return 'requested';
  end if;

  insert into public.follows (
    follower_id,
    following_id
  )
  values (
    v_user,
    p_target
  )
  on conflict do nothing;

  delete from public.follow_requests
  where
    requester_id = v_user
    and target_id = p_target;

  return 'following';
end;
$$;


ALTER FUNCTION "public"."request_follow"("p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_permanent_images"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
declare
  field_name text;
  value text;
begin
  foreach field_name in array TG_ARGV loop
    value := to_jsonb(new)->>field_name;

    if TG_OP = 'UPDATE'
       and value is not distinct from (to_jsonb(old)->>field_name) then
      continue;
    end if;

    if value is not null
       and value <> ''
       and (
         value !~ '^https://[^/@[:space:]]+(/|$)'
         or value ~ '^https://[^/]*@'
       ) then
      raise exception 'Only permanent HTTPS image URLs are allowed'
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$_$;


ALTER FUNCTION "public"."require_permanent_images"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_follow_request"("p_requester" "uuid", "p_accept" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_target uuid := auth.uid();
begin
  if v_target is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.follow_requests
    where
      requester_id = p_requester
      and target_id = v_target
  ) then
    raise exception 'follow request not found';
  end if;

  if coalesce(p_accept, false) then
    insert into public.follows(
      follower_id,
      following_id
    )
    values (
      p_requester,
      v_target
    )
    on conflict do nothing;
  end if;

  delete from public.follow_requests
  where
    requester_id = p_requester
    and target_id = v_target;

  delete from public.social_notifications
  where
    user_id = v_target
    and actor_id = p_requester
    and type = 'follow_request';

  if public.should_deliver_notification(
    p_requester,
    'follow'
  ) then

    insert into public.social_notifications(
      user_id,
      actor_id,
      type,
      message
    )
    values (
      p_requester,
      v_target,
      case
        when coalesce(p_accept, false)
          then 'follow_accepted'
        else 'follow_rejected'
      end,
      case
        when coalesce(p_accept, false)
          then 'takip isteğini kabul etti'
        else 'takip isteğini reddetti'
      end
    );

  end if;
end;
$$;


ALTER FUNCTION "public"."respond_follow_request"("p_requester" "uuid", "p_accept" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_to_community_invite"("p_invite_id" "uuid", "p_accept" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  invite_row public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_row
  from public.community_invites
  where id = p_invite_id
    and invitee_id = auth.uid()
    and status = 'pending'
  for update;

  if invite_row.id is null then
    raise exception 'Pending invitation not found';
  end if;

  if p_accept then
    insert into public.community_members (
      community_id,
      user_id,
      role
    )
    values (
      invite_row.community_id,
      auth.uid(),
      'member'
    )
    on conflict (community_id, user_id)
    do nothing;

    update public.community_invites
    set
      status = 'accepted',
      responded_at = now()
    where id = p_invite_id;
  else
    update public.community_invites
    set
      status = 'declined',
      responded_at = now()
    where id = p_invite_id;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."respond_to_community_invite"("p_invite_id" "uuid", "p_accept" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."runtime_controls"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_settings jsonb;
  v_announcement jsonb;
  v_restrictions jsonb := '[]'::jsonb;
  v_flags jsonb := '[]'::jsonb;
  v_role text := 'user';
begin

  select coalesce(
    jsonb_object_agg(s.key,s.value),
    '{}'::jsonb
  )
  into v_settings
  from public.app_settings s
  where s.public_read=true;

  select to_jsonb(a)
  into v_announcement
  from public.announcements a
  where a.active=true
    and a.starts_at<=now()
    and (
      a.ends_at is null
      or a.ends_at>now()
    )
  order by a.starts_at desc
  limit 1;

  if auth.uid() is not null then

    v_role := public.current_app_role();

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',s.id,
          'type',s.sanction_type,
          'reason',s.reason,
          'starts_at',s.starts_at,
          'ends_at',s.ends_at
        )
        order by s.created_at desc
      ),
      '[]'::jsonb
    )
    into v_restrictions
    from public.user_sanctions s
    where s.user_id=auth.uid()
      and s.active=true
      and s.starts_at<=now()
      and (
        s.ends_at is null
        or s.ends_at>now()
      );

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',f.key,
          'enabled',f.enabled
        )
      ),
      '[]'::jsonb
    )
    into v_flags
    from public.feature_flags f
    where f.enabled=true
      and (
        (
          coalesce(array_length(f.allowed_roles,1),0)=0
          and
          coalesce(array_length(f.allowed_user_ids,1),0)=0
        )
        or v_role=any(f.allowed_roles)
        or auth.uid()=any(f.allowed_user_ids)
      );

  end if;

  return jsonb_build_object(
    'settings',
    coalesce(v_settings,'{}'::jsonb),
    'announcement',
    v_announcement,
    'restrictions',
    v_restrictions,
    'feature_flags',
    v_flags,
    'role',
    v_role,
    'profile_control',
    case
      when auth.uid() is null then null
      else (
        select to_jsonb(pc)
        from public.profile_admin_controls pc
        where pc.user_id=auth.uid()
      )
    end
  );

end;
$$;


ALTER FUNCTION "public"."runtime_controls"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_visible_profiles"("p_query" "text", "p_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "username" "text", "profile_image" "text", "bio" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    p.username,
    p.profile_image,
    p.bio

  from public.profiles p

  left join public.profile_privacy_settings s
    on s.user_id = p.id

  where
    (
      coalesce(s.discoverable, true)
      or p.id = auth.uid()
    )

    and p.username ilike
      '%' || coalesce(p_query, '') || '%'

    and not exists (
      select 1
      from public.user_blocks b
      where
        (
          b.blocker_id = auth.uid()
          and b.blocked_id = p.id
        )
        or
        (
          b.blocker_id = p.id
          and b.blocked_id = auth.uid()
        )
    )

  order by
    case
      when lower(p.username) =
           lower(coalesce(p_query, ''))
      then 0
      else 1
    end,
    p.username

  limit greatest(
    1,
    least(
      coalesce(p_limit, 10),
      50
    )
  );
$$;


ALTER FUNCTION "public"."search_visible_profiles"("p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_premium_entitlements_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_premium_entitlements_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_profile_customizations" (
    "user_id" "uuid" NOT NULL,
    "theme_key" "text" DEFAULT 'purple'::"text" NOT NULL,
    "layout_key" "text" DEFAULT 'classic'::"text" NOT NULL,
    "highlight_text" "text" DEFAULT ''::"text" NOT NULL,
    "show_premium_frame" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "premium_profile_customizations_highlight_text_check" CHECK (("char_length"("highlight_text") <= 80)),
    CONSTRAINT "premium_profile_customizations_layout_key_check" CHECK (("layout_key" = ANY (ARRAY['classic'::"text", 'spotlight'::"text"]))),
    CONSTRAINT "premium_profile_customizations_theme_key_check" CHECK (("theme_key" = ANY (ARRAY['purple'::"text", 'gold'::"text", 'midnight'::"text", 'forest'::"text"])))
);


ALTER TABLE "public"."premium_profile_customizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."premium_profile_customizations" IS 'Public-facing Premium profile presentation preferences. Writes are Premium-gated through a security-definer RPC.';



CREATE OR REPLACE FUNCTION "public"."set_premium_profile_customization"("p_theme_key" "text", "p_layout_key" "text", "p_highlight_text" "text", "p_show_premium_frame" boolean) RETURNS "public"."premium_profile_customizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();

  v_theme text :=
    lower(
      trim(
        coalesce(
          p_theme_key,
          ''
        )
      )
    );

  v_layout text :=
    lower(
      trim(
        coalesce(
          p_layout_key,
          ''
        )
      )
    );

  v_highlight text :=
    trim(
      coalesce(
        p_highlight_text,
        ''
      )
    );

  v_row
    public.premium_profile_customizations;
begin

  if v_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in (
        'active',
        'trialing',
        'grace_period'
      )
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (
        pe.expires_at is null
        or pe.expires_at > now()
      )
  ) then
    raise exception
      'Premium required'
      using errcode = '42501';
  end if;

  if v_theme not in (
    'purple',
    'gold',
    'midnight',
    'forest'
  ) then
    raise exception
      'Invalid Premium profile theme'
      using errcode = '22023';
  end if;

  if v_layout not in (
    'classic',
    'spotlight'
  ) then
    raise exception
      'Invalid Premium profile layout'
      using errcode = '22023';
  end if;

  if char_length(v_highlight) > 80 then
    raise exception
      'Highlight text is too long'
      using errcode = '22023';
  end if;

  insert into
    public.premium_profile_customizations (
      user_id,
      theme_key,
      layout_key,
      highlight_text,
      show_premium_frame
    )
  values (
    v_user_id,
    v_theme,
    v_layout,
    v_highlight,
    coalesce(
      p_show_premium_frame,
      true
    )
  )
  on conflict (user_id)
  do update
  set
    theme_key =
      excluded.theme_key,

    layout_key =
      excluded.layout_key,

    highlight_text =
      excluded.highlight_text,

    show_premium_frame =
      excluded.show_premium_frame,

    updated_at =
      now()

  returning *
  into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."set_premium_profile_customization"("p_theme_key" "text", "p_layout_key" "text", "p_highlight_text" "text", "p_show_premium_frame" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_reading_goals" (
    "user_id" "uuid" NOT NULL,
    "weekly_page_goal" integer DEFAULT 140 NOT NULL,
    "monthly_page_goal" integer DEFAULT 600 NOT NULL,
    "yearly_book_goal" integer DEFAULT 24 NOT NULL,
    "streak_goal_days" integer DEFAULT 7 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "premium_reading_goals_monthly_page_goal_check" CHECK ((("monthly_page_goal" >= 1) AND ("monthly_page_goal" <= 300000))),
    CONSTRAINT "premium_reading_goals_streak_goal_days_check" CHECK ((("streak_goal_days" >= 1) AND ("streak_goal_days" <= 365))),
    CONSTRAINT "premium_reading_goals_weekly_page_goal_check" CHECK ((("weekly_page_goal" >= 1) AND ("weekly_page_goal" <= 70000))),
    CONSTRAINT "premium_reading_goals_yearly_book_goal_check" CHECK ((("yearly_book_goal" >= 1) AND ("yearly_book_goal" <= 1000)))
);


ALTER TABLE "public"."premium_reading_goals" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_premium_reading_goals"("p_weekly_page_goal" integer, "p_monthly_page_goal" integer, "p_yearly_book_goal" integer, "p_streak_goal_days" integer) RETURNS "public"."premium_reading_goals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_row public.premium_reading_goals;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in (
        'active',
        'trialing',
        'grace_period'
      )
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (
        pe.expires_at is null
        or pe.expires_at > now()
      )
  ) then
    raise exception 'Premium required'
      using errcode = '42501';
  end if;

  if p_weekly_page_goal is null
     or p_weekly_page_goal not between 1 and 70000 then
    raise exception
      'Weekly page goal must be between 1 and 70000'
      using errcode = '22023';
  end if;

  if p_monthly_page_goal is null
     or p_monthly_page_goal not between 1 and 300000 then
    raise exception
      'Monthly page goal must be between 1 and 300000'
      using errcode = '22023';
  end if;

  if p_yearly_book_goal is null
     or p_yearly_book_goal not between 1 and 1000 then
    raise exception
      'Yearly book goal must be between 1 and 1000'
      using errcode = '22023';
  end if;

  if p_streak_goal_days is null
     or p_streak_goal_days not between 1 and 365 then
    raise exception
      'Streak goal must be between 1 and 365'
      using errcode = '22023';
  end if;

  insert into public.premium_reading_goals (
    user_id,
    weekly_page_goal,
    monthly_page_goal,
    yearly_book_goal,
    streak_goal_days
  )
  values (
    v_user_id,
    p_weekly_page_goal,
    p_monthly_page_goal,
    p_yearly_book_goal,
    p_streak_goal_days
  )
  on conflict (user_id) do update
  set
    weekly_page_goal = excluded.weekly_page_goal,
    monthly_page_goal = excluded.monthly_page_goal,
    yearly_book_goal = excluded.yearly_book_goal,
    streak_goal_days = excluded.streak_goal_days,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."set_premium_reading_goals"("p_weekly_page_goal" integer, "p_monthly_page_goal" integer, "p_yearly_book_goal" integer, "p_streak_goal_days" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_shelf_customizations" (
    "user_id" "uuid" NOT NULL,
    "want_label" "text" DEFAULT 'Okuyacağım'::"text" NOT NULL,
    "reading_label" "text" DEFAULT 'Okuyorum'::"text" NOT NULL,
    "read_label" "text" DEFAULT 'Okudum'::"text" NOT NULL,
    "layout_key" "text" DEFAULT 'cozy'::"text" NOT NULL,
    "accent_key" "text" DEFAULT 'purple'::"text" NOT NULL,
    "show_counts" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "premium_shelf_customizations_accent_key_check" CHECK (("accent_key" = ANY (ARRAY['purple'::"text", 'gold'::"text", 'midnight'::"text", 'forest'::"text"]))),
    CONSTRAINT "premium_shelf_customizations_layout_key_check" CHECK (("layout_key" = ANY (ARRAY['cozy'::"text", 'compact'::"text"]))),
    CONSTRAINT "premium_shelf_customizations_read_label_check" CHECK ((("char_length"("read_label") >= 1) AND ("char_length"("read_label") <= 24))),
    CONSTRAINT "premium_shelf_customizations_reading_label_check" CHECK ((("char_length"("reading_label") >= 1) AND ("char_length"("reading_label") <= 24))),
    CONSTRAINT "premium_shelf_customizations_want_label_check" CHECK ((("char_length"("want_label") >= 1) AND ("char_length"("want_label") <= 24)))
);


ALTER TABLE "public"."premium_shelf_customizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."premium_shelf_customizations" IS 'Premium-only presentation preferences for the three canonical reading-status shelves.';



CREATE OR REPLACE FUNCTION "public"."set_premium_shelf_customization"("p_want_label" "text", "p_reading_label" "text", "p_read_label" "text", "p_layout_key" "text", "p_accent_key" "text", "p_show_counts" boolean) RETURNS "public"."premium_shelf_customizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();

  v_want text :=
    trim(
      coalesce(
        p_want_label,
        ''
      )
    );

  v_reading text :=
    trim(
      coalesce(
        p_reading_label,
        ''
      )
    );

  v_read text :=
    trim(
      coalesce(
        p_read_label,
        ''
      )
    );

  v_layout text :=
    lower(
      trim(
        coalesce(
          p_layout_key,
          ''
        )
      )
    );

  v_accent text :=
    lower(
      trim(
        coalesce(
          p_accent_key,
          ''
        )
      )
    );

  v_row
    public.premium_shelf_customizations;
begin

  if v_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements pe
    where pe.user_id = v_user_id
      and pe.status in (
        'active',
        'trialing',
        'grace_period'
      )
      and pe.revoked_at is null
      and pe.starts_at <= now()
      and (
        pe.expires_at is null
        or pe.expires_at > now()
      )
  ) then
    raise exception
      'Premium required'
      using errcode = '42501';
  end if;

  if char_length(v_want)
       not between 1 and 24
     or char_length(v_reading)
       not between 1 and 24
     or char_length(v_read)
       not between 1 and 24 then

    raise exception
      'Shelf labels must be between 1 and 24 characters'
      using errcode = '22023';
  end if;

  if v_layout not in (
    'cozy',
    'compact'
  ) then
    raise exception
      'Invalid shelf layout'
      using errcode = '22023';
  end if;

  if v_accent not in (
    'purple',
    'gold',
    'midnight',
    'forest'
  ) then
    raise exception
      'Invalid shelf accent'
      using errcode = '22023';
  end if;

  insert into
    public.premium_shelf_customizations (
      user_id,
      want_label,
      reading_label,
      read_label,
      layout_key,
      accent_key,
      show_counts
    )
  values (
    v_user_id,
    v_want,
    v_reading,
    v_read,
    v_layout,
    v_accent,
    coalesce(
      p_show_counts,
      true
    )
  )
  on conflict (user_id)
  do update
  set
    want_label =
      excluded.want_label,

    reading_label =
      excluded.reading_label,

    read_label =
      excluded.read_label,

    layout_key =
      excluded.layout_key,

    accent_key =
      excluded.accent_key,

    show_counts =
      excluded.show_counts,

    updated_at =
      now()

  returning *
  into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."set_premium_shelf_customization"("p_want_label" "text", "p_reading_label" "text", "p_read_label" "text", "p_layout_key" "text", "p_accent_key" "text", "p_show_counts" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_reading_progress_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_reading_progress_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_reading_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_reading_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_book_status" (
    "user_id" "uuid" NOT NULL,
    "book_key" "text" NOT NULL,
    "book_title" "text",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_book_status_status_check" CHECK (("status" = ANY (ARRAY['reading'::"text", 'read'::"text", 'want'::"text"])))
);


ALTER TABLE "public"."user_book_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_book_status"("p_book_key" "text", "p_book_title" "text", "p_status" "text") RETURNS "public"."user_book_status"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_result public.user_book_status;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_book_key is null or btrim(p_book_key) = '' then
    raise exception 'Book key is required';
  end if;

  if p_status not in ('reading', 'read', 'want') then
    raise exception 'Invalid book status';
  end if;

  insert into public.user_book_status (
    user_id,
    book_key,
    book_title,
    status
  )
  values (
    v_user_id,
    p_book_key,
    p_book_title,
    p_status
  )
  on conflict (user_id, book_key)
  do update set
    book_title = excluded.book_title,
    status = excluded.status
  returning *
  into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."set_user_book_status"("p_book_key" "text", "p_book_title" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_verified_accounts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_verified_accounts_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    CONSTRAINT "work_chapters_position_check" CHECK (("position" > 0)),
    CONSTRAINT "work_chapters_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"]))),
    CONSTRAINT "work_chapters_title_check" CHECK ((("length"(TRIM(BOTH FROM "title")) >= 1) AND ("length"(TRIM(BOTH FROM "title")) <= 160)))
);


ALTER TABLE "public"."work_chapters" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."swap_work_chapters"("first_id" "uuid", "second_id" "uuid") RETURNS SETOF "public"."work_chapters"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  wid uuid;
  first_position integer;
  second_position integer;
  temporary_position integer;
begin
  select c.work_id
  into wid
  from public.work_chapters c
  where c.id = first_id;

  perform 1
  from public.works w
  where w.id = wid
    and w.author_id = auth.uid()
  for update;

  if not found or first_id = second_id then
    raise exception 'Chapter edit not allowed'
      using errcode = '42501';
  end if;

  select c.position
  into first_position
  from public.work_chapters c
  where c.id = first_id
    and c.work_id = wid
  for update;

  select c.position
  into second_position
  from public.work_chapters c
  where c.id = second_id
    and c.work_id = wid
  for update;

  if first_position is null
     or second_position is null then
    raise exception 'Chapters must belong to the same work';
  end if;

  select max(c.position) + 1
  into temporary_position
  from public.work_chapters c
  where c.work_id = wid;

  update public.work_chapters
  set position = temporary_position
  where id = first_id;

  update public.work_chapters
  set position = first_position
  where id = second_id;

  update public.work_chapters
  set position = second_position
  where id = first_id;

  return query
  select c.*
  from public.work_chapters c
  where c.work_id = wid
  order by c.position;
end;
$$;


ALTER FUNCTION "public"."swap_work_chapters"("first_id" "uuid", "second_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_profile_privacy_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_profile_privacy_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_content_created_analytics_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_content_type text;
begin
  if tg_table_name = 'posts' then
    v_user_id := new.user_id;
    v_content_type := 'post';

  elsif tg_table_name = 'reviews' then
    v_user_id := new.user_id;
    v_content_type := 'review';

  elsif tg_table_name = 'quotes' then
    v_user_id := new.user_id;
    v_content_type := 'quote';

  else
    return new;
  end if;

  if v_user_id is not null then
    insert into public.product_analytics_events(
      user_id,
      event_name,
      metadata
    )
    values (
      v_user_id,
      'content_created',
      jsonb_build_object(
        'content_type', v_content_type
      )
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."track_content_created_analytics_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_product_event"("p_event_name" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_user_id is null then
    return;
  end if;

  if p_event_name not in (
    'app_open',
    'onboarding_completed',
    'book_opened',
    'shelf_updated',
    'content_created'
  ) then
    raise exception 'Unsupported analytics event';
  end if;

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Analytics metadata must be an object';
  end if;

  v_metadata :=
    v_metadata
    - 'email'
    - 'username'
    - 'text'
    - 'title'
    - 'query'
    - 'message'
    - 'description'
    - 'token';

  insert into public.product_analytics_events(
    user_id,
    event_name,
    metadata
  )
  values (
    v_user_id,
    p_event_name,
    v_metadata
  );
end;
$$;


ALTER FUNCTION "public"."track_product_event"("p_event_name" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_shelf_analytics_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.user_id is not null then
    insert into public.product_analytics_events(
      user_id,
      event_name,
      metadata
    )
    values (
      new.user_id,
      'shelf_updated',
      jsonb_build_object(
        'status', new.status
      )
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."track_shelf_analytics_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reading_progress"("p_book_key" "text", "p_book_title" "text", "p_current_page" integer, "p_total_pages" integer) RETURNS TABLE("current_page" integer, "total_pages" integer, "furthest_page" integer, "added_pages" integer, "today_pages_read" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_old_furthest integer := 0;
  v_new_furthest integer := 0;
  v_added integer := 0;
  v_timezone text := 'UTC';
  v_today date;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_book_key is null or btrim(p_book_key) = '' then
    raise exception 'Book key is required';
  end if;

  if p_current_page is null or p_current_page < 0 then
    raise exception 'Current page must be zero or greater';
  end if;

  if p_total_pages is null or p_total_pages <= 0 then
    raise exception 'Total pages must be greater than zero';
  end if;

  if p_current_page > p_total_pages then
    raise exception 'Current page cannot exceed total pages';
  end if;

  select rp.furthest_page
  into v_old_furthest
  from public.reading_progress rp
  where rp.user_id = v_user_id
    and rp.book_key = p_book_key
  for update;

  if not found then
    v_old_furthest := 0;
  end if;

  v_new_furthest :=
    greatest(v_old_furthest, p_current_page);

  v_added :=
    greatest(p_current_page - v_old_furthest, 0);

  insert into public.reading_progress (
    user_id,
    book_key,
    book_title,
    current_page,
    total_pages,
    furthest_page
  )
  values (
    v_user_id,
    p_book_key,
    p_book_title,
    p_current_page,
    p_total_pages,
    v_new_furthest
  )
  on conflict (user_id, book_key)
  do update set
    book_title = excluded.book_title,
    current_page = excluded.current_page,
    total_pages = excluded.total_pages,
    furthest_page = greatest(
      public.reading_progress.furthest_page,
      excluded.current_page
    );

  select rprefs.timezone
  into v_timezone
  from public.reading_preferences rprefs
  where rprefs.user_id = v_user_id;

  if v_timezone is null or btrim(v_timezone) = '' then
    v_timezone := 'UTC';
  end if;

  begin
    v_today := (now() at time zone v_timezone)::date;
  exception
    when others then
      v_timezone := 'UTC';
      v_today := (now() at time zone 'UTC')::date;
  end;

  if v_added > 0 then
    insert into public.reading_daily_stats (
      user_id,
      reading_date,
      pages_read
    )
    values (
      v_user_id,
      v_today,
      v_added
    )
    on conflict (user_id, reading_date)
    do update set
      pages_read =
        public.reading_daily_stats.pages_read
        + excluded.pages_read;
  end if;

  return query
  select
    rp.current_page,
    rp.total_pages,
    rp.furthest_page,
    v_added,
    coalesce(ds.pages_read, 0),
    rp.updated_at
  from public.reading_progress rp
  left join public.reading_daily_stats ds
    on ds.user_id = v_user_id
   and ds.reading_date = v_today
  where rp.user_id = v_user_id
    and rp.book_key = p_book_key;
end;
$$;


ALTER FUNCTION "public"."update_reading_progress"("p_book_key" "text", "p_book_title" "text", "p_current_page" integer, "p_total_pages" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."work_popularity"("genre_filter" "text" DEFAULT ''::"text") RETURNS TABLE("work_id" "uuid", "saves" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    w.id,
    count(s.user_id)
  from public.works w
  left join public.saved_works s
    on s.work_id = w.id
  where auth.uid() is not null
    and w.status = 'published'
    and (
      genre_filter = ''
      or strpos(
        lower(coalesce(w.genre,'')),
        lower(left(genre_filter,100))
      ) > 0
    )
  group by w.id
  order by
    count(s.user_id) desc,
    w.published_at desc nulls last,
    w.id
  limit 50;
$$;


ALTER FUNCTION "public"."work_popularity"("genre_filter" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text",
    "reason" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_audit_logs" IS 'Append-only privileged action history. Application clients cannot insert, update or delete rows directly; privileged server-side RPCs write audit records transactionally.';



CREATE TABLE IF NOT EXISTS "public"."admin_config_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_config_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notification_reads" (
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_notification_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "target_type" "text" DEFAULT 'all'::"text" NOT NULL,
    "target_value" "text",
    "action_route" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_notifications_check" CHECK (((("target_type" = 'all'::"text") AND ("target_value" IS NULL)) OR (("target_type" = 'user'::"text") AND ("target_value" IS NOT NULL)) OR (("target_type" = 'role'::"text") AND ("target_value" = ANY (ARRAY['user'::"text", 'moderator'::"text", 'admin'::"text", 'super_admin'::"text"]))))),
    CONSTRAINT "admin_notifications_message_check" CHECK ((("length"(TRIM(BOTH FROM "message")) >= 1) AND ("length"(TRIM(BOTH FROM "message")) <= 1000))),
    CONSTRAINT "admin_notifications_target_type_check" CHECK (("target_type" = ANY (ARRAY['all'::"text", 'user'::"text", 'role'::"text"]))),
    CONSTRAINT "admin_notifications_title_check" CHECK ((("length"(TRIM(BOTH FROM "title")) >= 1) AND ("length"(TRIM(BOTH FROM "title")) <= 120)))
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_trash_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "reason" "text",
    "deleted_by" "uuid",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "restored_by" "uuid",
    "restored_at" timestamp with time zone,
    CONSTRAINT "admin_trash_items_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'review'::"text", 'quote'::"text", 'post_comment'::"text", 'comment'::"text"])))
);


ALTER TABLE "public"."admin_trash_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "kind" "text" DEFAULT 'info'::"text" NOT NULL,
    "action_route" "text",
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "announcements_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "announcements_kind_check" CHECK (("kind" = ANY (ARRAY['info'::"text", 'warning'::"text", 'maintenance'::"text", 'feature'::"text", 'event'::"text"])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "public_read" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."author_profiles" (
    "user_id" "uuid" NOT NULL,
    "pen_name" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "author_profiles_pen_name_check" CHECK ((("pen_name" IS NULL) OR (("length"(TRIM(BOTH FROM "pen_name")) >= 1) AND ("length"(TRIM(BOTH FROM "pen_name")) <= 120))))
);


ALTER TABLE "public"."author_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" DEFAULT 'community'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "rules" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "current_book" "text"
);


ALTER TABLE "public"."communities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_admin_controls" (
    "community_id" "uuid" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "restricted" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."community_admin_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "inviter_id" "uuid" NOT NULL,
    "invitee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "community_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."community_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_members" (
    "community_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL
);


ALTER TABLE "public"."community_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_post_likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_hidden" (
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "hidden_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversation_hidden" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_pair_key" "text" GENERATED ALWAYS AS (((LEAST(("user1_id")::"text", ("user2_id")::"text") || '_'::"text") || GREATEST(("user1_id")::"text", ("user2_id")::"text"))) STORED,
    CONSTRAINT "conversations_no_self_chat" CHECK (("user1_id" <> "user2_id"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_admin_controls" (
    "event_id" "uuid" NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "hidden" boolean DEFAULT false NOT NULL,
    "cancelled" boolean DEFAULT false NOT NULL,
    "note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."event_admin_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_attendees" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_date" timestamp with time zone NOT NULL,
    "location" "text",
    "image_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."explore_featured_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "title" "text",
    "subtitle" "text",
    "priority" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "explore_featured_items_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "explore_featured_items_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'review'::"text", 'book'::"text", 'author'::"text", 'community'::"text", 'event'::"text", 'hashtag'::"text"])))
);


ALTER TABLE "public"."explore_featured_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "allowed_roles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "allowed_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follow_requests" (
    "requester_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "follow_requests_check" CHECK (("requester_id" <> "target_id"))
);


ALTER TABLE "public"."follow_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "follows_check" CHECK (("follower_id" <> "following_id"))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hashtag_controls" (
    "tag" "text" NOT NULL,
    "blocked" boolean DEFAULT false NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "hashtag_controls_tag_check" CHECK (("tag" = "lower"("tag"))),
    CONSTRAINT "hashtag_controls_tag_check1" CHECK (("tag" !~ '^#'::"text"))
);


ALTER TABLE "public"."hashtag_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    CONSTRAINT "messages_content_not_empty" CHECK (("length"(TRIM(BOTH FROM "content")) > 0))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "likes_enabled" boolean DEFAULT true NOT NULL,
    "comments_enabled" boolean DEFAULT true NOT NULL,
    "reposts_enabled" boolean DEFAULT true NOT NULL,
    "follows_enabled" boolean DEFAULT true NOT NULL,
    "messages_enabled" boolean DEFAULT true NOT NULL,
    "system_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "review_id" "uuid",
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "post_id" "uuid",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['like'::"text", 'comment'::"text", 'repost'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reposts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_reposts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "text" "text",
    "image_url" "text",
    "book_key" "text",
    "book_title" "text",
    "rating" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_analytics_events" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entitlement_id" "uuid",
    "event_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" NOT NULL,
    "previous_status" "text",
    "product_id" "text",
    "will_renew" boolean,
    "expires_at" timestamp with time zone,
    "provider_event_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "premium_analytics_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['entitlement_created'::"text", 'status_changed'::"text", 'expiration_changed'::"text", 'renewal_state_changed'::"text", 'source_state_changed'::"text"]))),
    CONSTRAINT "premium_analytics_events_source_check" CHECK (("source" = ANY (ARRAY['apple'::"text", 'google'::"text", 'admin_grant'::"text"]))),
    CONSTRAINT "premium_analytics_events_status_check" CHECK (("status" = ANY (ARRAY['inactive'::"text", 'active'::"text", 'trialing'::"text", 'grace_period'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."premium_analytics_events" OWNER TO "postgres";


ALTER TABLE "public"."premium_analytics_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."premium_analytics_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_analytics_events" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_analytics_event_name_check" CHECK (("event_name" = ANY (ARRAY['app_open'::"text", 'onboarding_completed'::"text", 'book_opened'::"text", 'shelf_updated'::"text", 'content_created'::"text"]))),
    CONSTRAINT "product_analytics_metadata_object_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text"))
);


ALTER TABLE "public"."product_analytics_events" OWNER TO "postgres";


ALTER TABLE "public"."product_analytics_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_analytics_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profile_admin_controls" (
    "user_id" "uuid" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "follow_restricted" boolean DEFAULT false NOT NULL,
    "content_filter_level" "text" DEFAULT 'standard'::"text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "profile_admin_controls_content_filter_level_check" CHECK (("content_filter_level" = ANY (ARRAY['standard'::"text", 'strict'::"text", 'off'::"text"])))
);


ALTER TABLE "public"."profile_admin_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_privacy_settings" (
    "user_id" "uuid" NOT NULL,
    "discoverable" boolean DEFAULT true NOT NULL,
    "message_permission" "text" DEFAULT 'everyone'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profile_privacy_settings_message_permission_check" CHECK (("message_permission" = ANY (ARRAY['everyone'::"text", 'followers'::"text", 'nobody'::"text"])))
);


ALTER TABLE "public"."profile_privacy_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" DEFAULT 'Kitap Okuru'::"text" NOT NULL,
    "bio" "text" DEFAULT ''::"text",
    "profile_image" "text",
    "cover_image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_key" "text" NOT NULL,
    "book_title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "card_template_key" "text" DEFAULT 'classic'::"text" NOT NULL,
    "title" "text",
    "topic" "text",
    "page_number" integer,
    "note" "text",
    CONSTRAINT "quotes_card_template_key_check" CHECK (("card_template_key" = ANY (ARRAY['classic'::"text", 'editorial'::"text", 'noir'::"text", 'minimal'::"text"]))),
    CONSTRAINT "quotes_note_length_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 300))),
    CONSTRAINT "quotes_page_number_check" CHECK ((("page_number" IS NULL) OR (("page_number" >= 1) AND ("page_number" <= 100000)))),
    CONSTRAINT "quotes_title_length_check" CHECK ((("title" IS NULL) OR ("char_length"("title") <= 120))),
    CONSTRAINT "quotes_topic_length_check" CHECK ((("topic" IS NULL) OR ("char_length"("topic") <= 60)))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotes"."card_template_key" IS 'Visual quote-card template. classic is free; editorial, noir and minimal require active Premium access at write time.';



CREATE TABLE IF NOT EXISTS "public"."reader_suggestion_feedback" (
    "user_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "reason" "text" DEFAULT 'dismissed'::"text" NOT NULL,
    "hidden_until" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reader_suggestion_feedback_check" CHECK (("user_id" <> "candidate_id"))
);


ALTER TABLE "public"."reader_suggestion_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_daily_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reading_date" "date" NOT NULL,
    "pages_read" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reading_daily_stats_pages_read_check" CHECK (("pages_read" >= 0))
);


ALTER TABLE "public"."reading_daily_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "daily_page_goal" integer DEFAULT 20 NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reading_preferences_goal_check" CHECK ((("daily_page_goal" >= 1) AND ("daily_page_goal" <= 10000)))
);


ALTER TABLE "public"."reading_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reading_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_key" "text" NOT NULL,
    "book_title" "text",
    "current_page" integer DEFAULT 0 NOT NULL,
    "total_pages" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "furthest_page" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "reading_progress_current_page_check" CHECK (("current_page" >= 0)),
    CONSTRAINT "reading_progress_furthest_page_check" CHECK (("furthest_page" >= 0)),
    CONSTRAINT "reading_progress_page_range_check" CHECK ((("total_pages" IS NULL) OR ("current_page" <= "total_pages"))),
    CONSTRAINT "reading_progress_total_pages_check" CHECK ((("total_pages" IS NULL) OR ("total_pages" > 0)))
);


ALTER TABLE "public"."reading_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assigned_to" "uuid",
    "resolution" "text",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'actioned'::"text", 'rejected'::"text"]))),
    CONSTRAINT "reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['user'::"text", 'post'::"text", 'review'::"text", 'quote'::"text", 'comment'::"text", 'message'::"text", 'community'::"text", 'event'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reposts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reposts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenuecat_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "app_user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "product_id" "text",
    "source_reference" "text" NOT NULL,
    "provider_event_at" timestamp with time zone NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "revenuecat_webhook_events_source_check" CHECK (("source" = ANY (ARRAY['apple'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."revenuecat_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."revenuecat_webhook_events" IS 'Idempotency and audit metadata for authenticated RevenueCat webhook deliveries. No client role can read or write this table.';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_key" "text" NOT NULL,
    "book_title" "text" NOT NULL,
    "rating" integer NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "topic" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "contains_spoiler" boolean DEFAULT false NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "reviews_tags_count_check" CHECK (("cardinality"("tags") <= 8)),
    CONSTRAINT "reviews_title_length_check" CHECK ((("title" IS NULL) OR ("char_length"("title") <= 120))),
    CONSTRAINT "reviews_topic_length_check" CHECK ((("topic" IS NULL) OR ("char_length"("topic") <= 60)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reviews"."title" IS 'Optional review headline shown above the review body.';



COMMENT ON COLUMN "public"."reviews"."topic" IS 'Optional discovery topic selected while composing a review.';



COMMENT ON COLUMN "public"."reviews"."tags" IS 'Optional lightweight labels attached to the review.';



COMMENT ON COLUMN "public"."reviews"."contains_spoiler" IS 'True when the author marks the review as containing spoilers.';



CREATE TABLE IF NOT EXISTS "public"."saved_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."saved_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_works" (
    "user_id" "uuid" NOT NULL,
    "work_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_works" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "query" "text" NOT NULL,
    "scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "result_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."search_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "message" "text" DEFAULT ''::"text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_notifications_type_check" CHECK (("type" = ANY (ARRAY['follow_request'::"text", 'follow_accepted'::"text", 'follow_rejected'::"text"])))
);


ALTER TABLE "public"."social_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."storage_cleanup_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text" NOT NULL,
    "object_name" "text" NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "storage_cleanup_candidates_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."storage_cleanup_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "text" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_likes" (
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_blocks_check" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_reports_category_check" CHECK (("category" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'inappropriate'::"text", 'impersonation'::"text", 'other'::"text"]))),
    CONSTRAINT "user_reports_check" CHECK (("reporter_id" <> "reported_id")),
    CONSTRAINT "user_reports_description_check" CHECK (("length"("description") <= 2000))
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'moderator'::"text", 'admin'::"text", 'super_admin'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sanctions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sanction_type" "text" NOT NULL,
    "reason" "text" DEFAULT ''::"text" NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_sanctions_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "user_sanctions_sanction_type_check" CHECK (("sanction_type" = ANY (ARRAY['warning'::"text", 'suspension'::"text", 'ban'::"text", 'comment_restriction'::"text", 'post_restriction'::"text", 'message_restriction'::"text", 'community_restriction'::"text"])))
);


ALTER TABLE "public"."user_sanctions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."works" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "cover_url" "text",
    "genre" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "language" "text" DEFAULT 'tr'::"text" NOT NULL,
    "audience" "text" DEFAULT 'general'::"text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "works_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"]))),
    CONSTRAINT "works_title_check" CHECK ((("length"(TRIM(BOTH FROM "title")) >= 1) AND ("length"(TRIM(BOTH FROM "title")) <= 160)))
);


ALTER TABLE "public"."works" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_config_snapshots"
    ADD CONSTRAINT "admin_config_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notification_reads"
    ADD CONSTRAINT "admin_notification_reads_pkey" PRIMARY KEY ("notification_id", "user_id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_trash_items"
    ADD CONSTRAINT "admin_trash_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."author_profiles"
    ADD CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communities"
    ADD CONSTRAINT "communities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_admin_controls"
    ADD CONSTRAINT "community_admin_controls_pkey" PRIMARY KEY ("community_id");



ALTER TABLE ONLY "public"."community_invites"
    ADD CONSTRAINT "community_invites_community_id_invitee_id_key" UNIQUE ("community_id", "invitee_id");



ALTER TABLE ONLY "public"."community_invites"
    ADD CONSTRAINT "community_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "community_members_pkey" PRIMARY KEY ("community_id", "user_id");



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_hidden"
    ADD CONSTRAINT "conversation_hidden_pkey" PRIMARY KEY ("user_id", "conversation_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_unique_user_pair" UNIQUE ("user_pair_key");



ALTER TABLE ONLY "public"."event_admin_controls"
    ADD CONSTRAINT "event_admin_controls_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."explore_featured_items"
    ADD CONSTRAINT "explore_featured_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."explore_featured_items"
    ADD CONSTRAINT "explore_featured_items_target_type_target_id_key" UNIQUE ("target_type", "target_id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("requester_id", "target_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hashtag_controls"
    ADD CONSTRAINT "hashtag_controls_pkey" PRIMARY KEY ("tag");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_review_id_user_id_key" UNIQUE ("review_id", "user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premium_analytics_events"
    ADD CONSTRAINT "premium_analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premium_entitlements"
    ADD CONSTRAINT "premium_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premium_profile_customizations"
    ADD CONSTRAINT "premium_profile_customizations_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."premium_reading_goals"
    ADD CONSTRAINT "premium_reading_goals_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."premium_shelf_customizations"
    ADD CONSTRAINT "premium_shelf_customizations_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."product_analytics_events"
    ADD CONSTRAINT "product_analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_admin_controls"
    ADD CONSTRAINT "profile_admin_controls_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profile_privacy_settings"
    ADD CONSTRAINT "profile_privacy_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reader_suggestion_feedback"
    ADD CONSTRAINT "reader_suggestion_feedback_pkey" PRIMARY KEY ("user_id", "candidate_id");



ALTER TABLE ONLY "public"."reading_daily_stats"
    ADD CONSTRAINT "reading_daily_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_daily_stats"
    ADD CONSTRAINT "reading_daily_stats_user_date_unique" UNIQUE ("user_id", "reading_date");



ALTER TABLE ONLY "public"."reading_preferences"
    ADD CONSTRAINT "reading_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_preferences"
    ADD CONSTRAINT "reading_preferences_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."reading_progress"
    ADD CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reading_progress"
    ADD CONSTRAINT "reading_progress_user_book_unique" UNIQUE ("user_id", "book_key");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_review_id_user_id_key" UNIQUE ("review_id", "user_id");



ALTER TABLE ONLY "public"."revenuecat_webhook_events"
    ADD CONSTRAINT "revenuecat_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_post_id_username_key" UNIQUE ("post_id", "username");



ALTER TABLE ONLY "public"."saved_works"
    ADD CONSTRAINT "saved_works_pkey" PRIMARY KEY ("user_id", "work_id");



ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_notifications"
    ADD CONSTRAINT "social_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."storage_cleanup_candidates"
    ADD CONSTRAINT "storage_cleanup_candidates_bucket_id_object_name_key" UNIQUE ("bucket_id", "object_name");



ALTER TABLE ONLY "public"."storage_cleanup_candidates"
    ADD CONSTRAINT "storage_cleanup_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_pkey" PRIMARY KEY ("story_id", "user_id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_book_status"
    ADD CONSTRAINT "user_book_status_pkey" PRIMARY KEY ("user_id", "book_key");



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_sanctions"
    ADD CONSTRAINT "user_sanctions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verified_accounts"
    ADD CONSTRAINT "verified_accounts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."work_chapters"
    ADD CONSTRAINT "work_chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_chapters"
    ADD CONSTRAINT "work_chapters_work_id_position_key" UNIQUE ("work_id", "position");



ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_audit_logs_action_created_idx" ON "public"."admin_audit_logs" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "admin_audit_logs_admin_idx" ON "public"."admin_audit_logs" USING "btree" ("admin_id", "created_at" DESC);



CREATE INDEX "admin_audit_logs_created_idx" ON "public"."admin_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_audit_logs_target_created_idx" ON "public"."admin_audit_logs" USING "btree" ("target_type", "target_id", "created_at" DESC);



CREATE UNIQUE INDEX "admin_trash_items_active_target_uidx" ON "public"."admin_trash_items" USING "btree" ("target_type", "target_id") WHERE ("restored_at" IS NULL);



CREATE INDEX "admin_trash_items_deleted_at_idx" ON "public"."admin_trash_items" USING "btree" ("deleted_at" DESC);



CREATE INDEX "comments_user_id_idx" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "community_invites_community_idx" ON "public"."community_invites" USING "btree" ("community_id", "status", "created_at" DESC);



CREATE INDEX "community_invites_invitee_idx" ON "public"."community_invites" USING "btree" ("invitee_id", "status", "created_at" DESC);



CREATE INDEX "community_member_user_idx" ON "public"."community_members" USING "btree" ("user_id", "community_id");



CREATE INDEX "conversations_updated_at_idx" ON "public"."conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "conversations_user1_idx" ON "public"."conversations" USING "btree" ("user1_id");



CREATE INDEX "conversations_user2_idx" ON "public"."conversations" USING "btree" ("user2_id");



CREATE INDEX "explore_featured_items_sort_idx" ON "public"."explore_featured_items" USING "btree" ("active", "priority" DESC, "created_at" DESC);



CREATE INDEX "follow_requests_target_created_idx" ON "public"."follow_requests" USING "btree" ("target_id", "created_at" DESC);



CREATE INDEX "follows_follower_id_idx" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "follows_following_id_idx" ON "public"."follows" USING "btree" ("following_id");



CREATE UNIQUE INDEX "likes_review_user_unique" ON "public"."likes" USING "btree" ("review_id", "user_id");



CREATE INDEX "likes_user_id_idx" ON "public"."likes" USING "btree" ("user_id");



CREATE INDEX "messages_conversation_idx" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "messages_created_at_idx" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "messages_sender_idx" ON "public"."messages" USING "btree" ("sender_id");



CREATE UNIQUE INDEX "notifications_like_unique" ON "public"."notifications" USING "btree" ("user_id", "actor_id", "type", "post_id") WHERE (("type" = 'like'::"text") AND ("post_id" IS NOT NULL));



CREATE INDEX "notifications_like_unique_idx" ON "public"."notifications" USING "btree" ("user_id", "actor_id", "type", "post_id") WHERE ("type" = 'like'::"text");



CREATE INDEX "notifications_post_id_idx" ON "public"."notifications" USING "btree" ("post_id");



CREATE UNIQUE INDEX "notifications_repost_unique" ON "public"."notifications" USING "btree" ("user_id", "actor_id", "type", "post_id") WHERE (("type" = 'repost'::"text") AND ("post_id" IS NOT NULL));



CREATE INDEX "post_comments_post_id_idx" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "post_likes_post_id_idx" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "post_reposts_post_id_idx" ON "public"."post_reposts" USING "btree" ("post_id");



CREATE INDEX "posts_user_id_idx" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "premium_analytics_events_created_idx" ON "public"."premium_analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "premium_analytics_events_source_status_idx" ON "public"."premium_analytics_events" USING "btree" ("source", "status", "created_at" DESC);



CREATE INDEX "premium_analytics_events_user_created_idx" ON "public"."premium_analytics_events" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "premium_entitlements_source_unique" ON "public"."premium_entitlements" USING "btree" ("user_id", "source", COALESCE("source_reference", ''::"text"));



CREATE INDEX "premium_entitlements_user_status_idx" ON "public"."premium_entitlements" USING "btree" ("user_id", "status", "expires_at");



CREATE INDEX "product_analytics_events_name_created_idx" ON "public"."product_analytics_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "product_analytics_events_user_created_idx" ON "public"."product_analytics_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "quote_author_created_idx" ON "public"."quotes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "reading_daily_stats_user_date_idx" ON "public"."reading_daily_stats" USING "btree" ("user_id", "reading_date" DESC);



CREATE UNIQUE INDEX "reports_one_open_per_target_idx" ON "public"."reports" USING "btree" ("reporter_id", "target_type", "target_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text"]));



CREATE INDEX "reports_status_idx" ON "public"."reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "reports_target_idx" ON "public"."reports" USING "btree" ("target_type", "target_id");



CREATE UNIQUE INDEX "reposts_review_user_unique" ON "public"."reposts" USING "btree" ("review_id", "user_id");



CREATE INDEX "reposts_user_id_idx" ON "public"."reposts" USING "btree" ("user_id");



CREATE INDEX "revenuecat_webhook_events_user_idx" ON "public"."revenuecat_webhook_events" USING "btree" ("app_user_id", "provider_event_at" DESC);



CREATE UNIQUE INDEX "saved_posts_post_user_unique" ON "public"."saved_posts" USING "btree" ("post_id", "user_id");



CREATE INDEX "saved_posts_user_id_idx" ON "public"."saved_posts" USING "btree" ("user_id");



CREATE INDEX "search_events_created_idx" ON "public"."search_events" USING "btree" ("created_at" DESC);



CREATE INDEX "search_events_query_idx" ON "public"."search_events" USING "btree" ("lower"("query"));



CREATE INDEX "social_notifications_user_created_idx" ON "public"."social_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "stories_created_at_idx" ON "public"."stories" USING "btree" ("created_at" DESC);



CREATE INDEX "stories_expires_at_idx" ON "public"."stories" USING "btree" ("expires_at");



CREATE INDEX "stories_user_id_idx" ON "public"."stories" USING "btree" ("user_id");



CREATE INDEX "user_book_status_book_status_updated_idx" ON "public"."user_book_status" USING "btree" ("book_key", "status", "updated_at" DESC);



CREATE INDEX "user_sanctions_user_idx" ON "public"."user_sanctions" USING "btree" ("user_id", "active", "created_at" DESC);



CREATE INDEX "verified_accounts_active_idx" ON "public"."verified_accounts" USING "btree" ("is_verified", "updated_at" DESC);



CREATE INDEX "works_author_idx" ON "public"."works" USING "btree" ("author_id", "updated_at" DESC);



CREATE INDEX "works_published_idx" ON "public"."works" USING "btree" ("status", "published_at" DESC);



CREATE OR REPLACE TRIGGER "admin_audit_logs_immutable" BEFORE DELETE OR UPDATE ON "public"."admin_audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."guard_admin_audit_immutability"();



CREATE OR REPLACE TRIGGER "chapters_updated" BEFORE INSERT OR UPDATE ON "public"."work_chapters" FOR EACH ROW EXECUTE FUNCTION "public"."reader_updated_at"();



CREATE OR REPLACE TRIGGER "community_owner_immutable" BEFORE UPDATE ON "public"."communities" FOR EACH ROW EXECUTE FUNCTION "public"."community_owner_immutable"();



CREATE OR REPLACE TRIGGER "community_owner_join" AFTER INSERT ON "public"."communities" FOR EACH ROW EXECUTE FUNCTION "public"."community_owner_join"();



CREATE OR REPLACE TRIGGER "enforce_comment_restriction" BEFORE INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sanction_insert"('comment_restriction');



CREATE OR REPLACE TRIGGER "enforce_community_creation" BEFORE INSERT ON "public"."communities" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_creation_setting"('community_creation_enabled', 'community_restriction');



CREATE OR REPLACE TRIGGER "enforce_event_creation" BEFORE INSERT ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_creation_setting"('event_creation_enabled', 'community_restriction');



CREATE OR REPLACE TRIGGER "enforce_follow_control" BEFORE INSERT OR UPDATE OF "following_id" ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_follow_insert"();



CREATE OR REPLACE TRIGGER "enforce_message_restriction" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sanction_insert"('message_restriction');



CREATE OR REPLACE TRIGGER "enforce_post_comment_restriction" BEFORE INSERT ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sanction_insert"('comment_restriction');



CREATE OR REPLACE TRIGGER "enforce_post_restriction" BEFORE INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sanction_insert"('post_restriction');



CREATE OR REPLACE TRIGGER "enforce_private_follow_insert_trigger" BEFORE INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_private_follow_insert"();



CREATE OR REPLACE TRIGGER "enforce_quote_restriction" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sanction_insert"('post_restriction');



CREATE OR REPLACE TRIGGER "enforce_review_restriction" BEFORE INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_sanction_insert"('post_restriction');



CREATE OR REPLACE TRIGGER "follow_request_notification_trigger" AFTER INSERT ON "public"."follow_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_follow_request_created"();



CREATE OR REPLACE TRIGGER "follows_block_guard" BEFORE INSERT OR UPDATE ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."guard_blocked_follow"();



CREATE OR REPLACE TRIGGER "notification_preferences_set_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_notification_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "notifications_preference_guard" BEFORE INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."guard_notification_preference"();



CREATE OR REPLACE TRIGGER "premium_entitlements_capture_analytics" AFTER INSERT OR UPDATE ON "public"."premium_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."capture_premium_analytics_event"();



CREATE OR REPLACE TRIGGER "premium_entitlements_guard_identity" BEFORE UPDATE ON "public"."premium_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."guard_premium_entitlement_identity"();



CREATE OR REPLACE TRIGGER "premium_entitlements_set_updated_at" BEFORE UPDATE ON "public"."premium_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."set_premium_entitlements_updated_at"();



CREATE OR REPLACE TRIGGER "profile_privacy_touch_updated_at" BEFORE UPDATE ON "public"."profile_privacy_settings" FOR EACH ROW EXECUTE FUNCTION "public"."touch_profile_privacy_updated_at"();



CREATE OR REPLACE TRIGGER "quotes_premium_card_guard" BEFORE INSERT OR UPDATE OF "card_template_key", "user_id" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_quote_card_template_access"();



CREATE OR REPLACE TRIGGER "reader_conversation_immutable" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."reader_conversation_immutable"();



CREATE OR REPLACE TRIGGER "reader_message_immutable" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."reader_message_immutable"();



CREATE OR REPLACE TRIGGER "reports_rate_limit_guard" BEFORE INSERT ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."guard_report_rate_limit"();



CREATE OR REPLACE TRIGGER "set_reading_daily_stats_updated_at" BEFORE UPDATE ON "public"."reading_daily_stats" FOR EACH ROW EXECUTE FUNCTION "public"."set_reading_updated_at"();



CREATE OR REPLACE TRIGGER "set_reading_preferences_updated_at" BEFORE UPDATE ON "public"."reading_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_reading_updated_at"();



CREATE OR REPLACE TRIGGER "set_reading_progress_updated_at" BEFORE UPDATE ON "public"."reading_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_reading_progress_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_book_status_updated_at" BEFORE UPDATE ON "public"."user_book_status" FOR EACH ROW EXECUTE FUNCTION "public"."set_reading_updated_at"();



CREATE OR REPLACE TRIGGER "trg_track_post_created" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."track_content_created_analytics_event"();



CREATE OR REPLACE TRIGGER "trg_track_quote_created" AFTER INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."track_content_created_analytics_event"();



CREATE OR REPLACE TRIGGER "trg_track_review_created" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."track_content_created_analytics_event"();



CREATE OR REPLACE TRIGGER "trg_track_shelf_analytics" AFTER INSERT OR UPDATE OF "status" ON "public"."user_book_status" FOR EACH ROW EXECUTE FUNCTION "public"."track_shelf_analytics_event"();



CREATE OR REPLACE TRIGGER "user_reports_repeat_guard" BEFORE INSERT ON "public"."user_reports" FOR EACH ROW EXECUTE FUNCTION "public"."guard_user_report_repeat"();



CREATE OR REPLACE TRIGGER "verified_accounts_set_updated_at" BEFORE UPDATE ON "public"."verified_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_verified_accounts_updated_at"();



CREATE OR REPLACE TRIGGER "works_updated" BEFORE INSERT OR UPDATE ON "public"."works" FOR EACH ROW EXECUTE FUNCTION "public"."reader_updated_at"();



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_config_snapshots"
    ADD CONSTRAINT "admin_config_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_notification_reads"
    ADD CONSTRAINT "admin_notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."admin_notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_notification_reads"
    ADD CONSTRAINT "admin_notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_trash_items"
    ADD CONSTRAINT "admin_trash_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_trash_items"
    ADD CONSTRAINT "admin_trash_items_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."author_profiles"
    ADD CONSTRAINT "author_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."author_profiles"
    ADD CONSTRAINT "author_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communities"
    ADD CONSTRAINT "communities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_admin_controls"
    ADD CONSTRAINT "community_admin_controls_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_admin_controls"
    ADD CONSTRAINT "community_admin_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_invites"
    ADD CONSTRAINT "community_invites_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_invites"
    ADD CONSTRAINT "community_invites_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_invites"
    ADD CONSTRAINT "community_invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_hidden"
    ADD CONSTRAINT "conversation_hidden_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_hidden"
    ADD CONSTRAINT "conversation_hidden_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_admin_controls"
    ADD CONSTRAINT "event_admin_controls_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_admin_controls"
    ADD CONSTRAINT "event_admin_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."explore_featured_items"
    ADD CONSTRAINT "explore_featured_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follow_requests"
    ADD CONSTRAINT "follow_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hashtag_controls"
    ADD CONSTRAINT "hashtag_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reposts"
    ADD CONSTRAINT "post_reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_analytics_events"
    ADD CONSTRAINT "premium_analytics_events_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "public"."premium_entitlements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."premium_analytics_events"
    ADD CONSTRAINT "premium_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_entitlements"
    ADD CONSTRAINT "premium_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_profile_customizations"
    ADD CONSTRAINT "premium_profile_customizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_reading_goals"
    ADD CONSTRAINT "premium_reading_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_shelf_customizations"
    ADD CONSTRAINT "premium_shelf_customizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_analytics_events"
    ADD CONSTRAINT "product_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_admin_controls"
    ADD CONSTRAINT "profile_admin_controls_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_admin_controls"
    ADD CONSTRAINT "profile_admin_controls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_privacy_settings"
    ADD CONSTRAINT "profile_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_suggestion_feedback"
    ADD CONSTRAINT "reader_suggestion_feedback_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reader_suggestion_feedback"
    ADD CONSTRAINT "reader_suggestion_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_daily_stats"
    ADD CONSTRAINT "reading_daily_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_preferences"
    ADD CONSTRAINT "reading_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reading_progress"
    ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revenuecat_webhook_events"
    ADD CONSTRAINT "revenuecat_webhook_events_app_user_id_fkey" FOREIGN KEY ("app_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_works"
    ADD CONSTRAINT "saved_works_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_works"
    ADD CONSTRAINT "saved_works_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."search_events"
    ADD CONSTRAINT "search_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."social_notifications"
    ADD CONSTRAINT "social_notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_notifications"
    ADD CONSTRAINT "social_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."storage_cleanup_candidates"
    ADD CONSTRAINT "storage_cleanup_candidates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."storage_cleanup_candidates"
    ADD CONSTRAINT "storage_cleanup_candidates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_likes"
    ADD CONSTRAINT "story_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_book_status"
    ADD CONSTRAINT "user_book_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sanctions"
    ADD CONSTRAINT "user_sanctions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_sanctions"
    ADD CONSTRAINT "user_sanctions_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_sanctions"
    ADD CONSTRAINT "user_sanctions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verified_accounts"
    ADD CONSTRAINT "verified_accounts_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."verified_accounts"
    ADD CONSTRAINT "verified_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verified_accounts"
    ADD CONSTRAINT "verified_accounts_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_chapters"
    ADD CONSTRAINT "work_chapters_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."works"
    ADD CONSTRAINT "works_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can read Premium profile customization" ON "public"."premium_profile_customizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view communities" ON "public"."communities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view community members" ON "public"."community_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view community post comments" ON "public"."community_post_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view community post likes" ON "public"."community_post_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view community posts" ON "public"."community_posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view event attendees" ON "public"."event_attendees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view events" ON "public"."events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Comments are viewable by everyone" ON "public"."comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Community members can create posts" ON "public"."community_posts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."community_members" "cm"
  WHERE (("cm"."community_id" = "community_posts"."community_id") AND ("cm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Likes are viewable by everyone" ON "public"."likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Post comments are publicly readable" ON "public"."post_comments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Post likes are publicly readable" ON "public"."post_likes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Post reposts are publicly readable" ON "public"."post_reposts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Posts are publicly readable" ON "public"."posts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Profiles are publicly readable" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Profiles are viewable by everyone" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Quotes are viewable by everyone" ON "public"."quotes" FOR SELECT USING (true);



CREATE POLICY "Reposts are viewable by everyone" ON "public"."reposts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Reviews are viewable by everyone" ON "public"."reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Stories are publicly readable" ON "public"."stories" FOR SELECT TO "authenticated", "anon" USING (("expires_at" > "now"()));



CREATE POLICY "Users can comment on community posts" ON "public"."community_post_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create conversations" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can create notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "actor_id"));



CREATE POLICY "Users can create post comments" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create stories" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own follows" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can create their own reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own stories" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own book status" ON "public"."user_book_status" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own community post comments" ON "public"."community_post_comments" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own community posts" ON "public"."community_posts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own notification preferences" ON "public"."notification_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own post comments" ON "public"."post_comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own posts" ON "public"."posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own reading preferences" ON "public"."reading_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own reading progress" ON "public"."reading_progress" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own stories" ON "public"."stories" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own follows" ON "public"."follows" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own quotes" ON "public"."quotes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own reviews" ON "public"."reviews" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own stories" ON "public"."stories" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("actor_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own book status" ON "public"."user_book_status" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own notification preferences" ON "public"."notification_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own reading preferences" ON "public"."reading_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own reading progress" ON "public"."reading_progress" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own quotes" ON "public"."quotes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join communities" ON "public"."community_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can join events" ON "public"."event_attendees" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can leave communities" ON "public"."community_members" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can leave events" ON "public"."event_attendees" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can like community posts" ON "public"."community_post_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can like posts" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like reviews" ON "public"."likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark messages as read" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user1_id" = "auth"."uid"()) OR ("c"."user2_id" = "auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user1_id" = "auth"."uid"()) OR ("c"."user2_id" = "auth"."uid"()))))));



CREATE POLICY "Users can read own Premium goals" ON "public"."premium_reading_goals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own Premium shelf customization" ON "public"."premium_shelf_customizations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own book status" ON "public"."user_book_status" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own daily stats" ON "public"."reading_daily_stats" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own reading preferences" ON "public"."reading_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own reading progress" ON "public"."reading_progress" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove own community post likes" ON "public"."community_post_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can remove own post likes" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove own reposts" ON "public"."post_reposts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove their own likes" ON "public"."likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove their own reposts" ON "public"."reposts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can repost posts" ON "public"."post_reposts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can repost reviews" ON "public"."reposts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user1_id" = "auth"."uid"()) OR ("c"."user2_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update own book status" ON "public"."user_book_status" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notification preferences" ON "public"."notification_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own post comments" ON "public"."post_comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own posts" ON "public"."posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own reading preferences" ON "public"."reading_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own reading progress" ON "public"."reading_progress" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own stories" ON "public"."stories" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their conversations" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id"))) WITH CHECK ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own quotes" ON "public"."quotes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own reviews" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own stories" ON "public"."stories" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view follows" ON "public"."follows" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user1_id" = "auth"."uid"()) OR ("c"."user2_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own notification preferences" ON "public"."notification_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_audit_read" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "admin_community_visibility_restrictive" ON "public"."communities" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (("public"."has_admin_role"() OR (NOT (EXISTS ( SELECT 1
   FROM "public"."community_admin_controls" "c"
  WHERE (("c"."community_id" = "communities"."id") AND "c"."restricted"))))));



ALTER TABLE "public"."admin_config_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_config_snapshots_read" ON "public"."admin_config_snapshots" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "admin_event_visibility_restrictive" ON "public"."events" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (("public"."has_admin_role"() OR (NOT (EXISTS ( SELECT 1
   FROM "public"."event_admin_controls" "c"
  WHERE (("c"."event_id" = "events"."id") AND ("c"."hidden" OR "c"."cancelled")))))));



ALTER TABLE "public"."admin_notification_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_notification_reads_own" ON "public"."admin_notification_reads" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_notifications_admin_read" ON "public"."admin_notifications" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "admin_notifications_admin_write" ON "public"."admin_notifications" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



ALTER TABLE "public"."admin_trash_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins can read trash" ON "public"."admin_trash_items" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['moderator'::"text", 'admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "admins_read_premium_entitlements" ON "public"."premium_entitlements" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_admin_write" ON "public"."announcements" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK (("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "announcements_read" ON "public"."announcements" FOR SELECT USING ((("active" AND ("starts_at" <= "now"()) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))) OR "public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_admin_write" ON "public"."app_settings" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "app_settings_public_read" ON "public"."app_settings" FOR SELECT USING (("public_read" OR "public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])));



CREATE POLICY "authenticated users can create comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated users can create likes" ON "public"."likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated users can create posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can create reposts" ON "public"."reposts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated users can delete comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated users can delete likes" ON "public"."likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated users can delete reposts" ON "public"."reposts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated users can save posts" ON "public"."saved_posts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can view comments" ON "public"."comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can view likes" ON "public"."likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can view posts" ON "public"."posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can view reposts" ON "public"."reposts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can view saved posts" ON "public"."saved_posts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."author_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "author_profiles_admin_write" ON "public"."author_profiles" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "author_profiles_read" ON "public"."author_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "blocks_read" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "blocker_id") OR ("auth"."uid"() = "blocked_id")));



CREATE POLICY "blocks_write" ON "public"."user_blocks" TO "authenticated" USING (("auth"."uid"() = "blocker_id")) WITH CHECK (("auth"."uid"() = "blocker_id"));



CREATE POLICY "chapters_admin_read" ON "public"."work_chapters" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "chapters_owner" ON "public"."work_chapters" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "work_chapters"."work_id") AND ("w"."author_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "work_chapters"."work_id") AND ("w"."author_id" = "auth"."uid"())))));



CREATE POLICY "chapters_read" ON "public"."work_chapters" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE (("w"."id" = "work_chapters"."work_id") AND (("w"."author_id" = "auth"."uid"()) OR (("w"."status" = 'published'::"text") AND ("work_chapters"."status" = 'published'::"text")))))));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_admin_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_admin_controls_read" ON "public"."community_admin_controls" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "community_admin_controls_write" ON "public"."community_admin_controls" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "community_comment_access_guard" ON "public"."community_post_comments" AS RESTRICTIVE USING ((EXISTS ( SELECT 1
   FROM "public"."community_posts" "p"
  WHERE (("p"."id" = "community_post_comments"."post_id") AND "public"."community_access"("p"."community_id"))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."community_posts" "p"
  WHERE (("p"."id" = "community_post_comments"."post_id") AND "public"."community_access"("p"."community_id"))))));



CREATE POLICY "community_comment_delete_guard" ON "public"."community_post_comments" AS RESTRICTIVE FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."community_posts" "p"
  WHERE (("p"."id" = "community_post_comments"."post_id") AND "public"."community_admin"("p"."community_id"))))));



CREATE POLICY "community_comment_update_guard" ON "public"."community_post_comments" AS RESTRICTIVE FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "community_create" ON "public"."communities" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])) AND ("kind" = ANY (ARRAY['community'::"text", 'book_club'::"text"]))));



CREATE POLICY "community_create_guard" ON "public"."communities" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])) AND ("kind" = ANY (ARRAY['community'::"text", 'book_club'::"text"]))));



CREATE POLICY "community_delete_guard" ON "public"."communities" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "community_edit" ON "public"."communities" FOR UPDATE TO "authenticated" USING ("public"."community_admin"("id")) WITH CHECK ("public"."community_admin"("id"));



CREATE POLICY "community_edit_guard" ON "public"."communities" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING ("public"."community_admin"("id")) WITH CHECK ("public"."community_admin"("id"));



ALTER TABLE "public"."community_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_invites_read" ON "public"."community_invites" FOR SELECT TO "authenticated" USING ((("invitee_id" = "auth"."uid"()) OR "public"."community_admin"("community_id")));



CREATE POLICY "community_like_access_guard" ON "public"."community_post_likes" AS RESTRICTIVE USING ((EXISTS ( SELECT 1
   FROM "public"."community_posts" "p"
  WHERE (("p"."id" = "community_post_likes"."post_id") AND "public"."community_access"("p"."community_id"))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."community_posts" "p"
  WHERE (("p"."id" = "community_post_likes"."post_id") AND "public"."community_access"("p"."community_id"))))));



CREATE POLICY "community_like_delete_guard" ON "public"."community_post_likes" AS RESTRICTIVE FOR DELETE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."community_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_post_access_guard" ON "public"."community_posts" AS RESTRICTIVE USING ("public"."community_access"("community_id")) WITH CHECK (("public"."community_access"("community_id") AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."community_members" "m"
  WHERE (("m"."community_id" = "community_posts"."community_id") AND ("m"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."community_post_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_post_delete_guard" ON "public"."community_posts" AS RESTRICTIVE FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."community_admin"("community_id")));



ALTER TABLE "public"."community_post_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_post_update_guard" ON "public"."community_posts" AS RESTRICTIVE FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."community_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "community_read" ON "public"."communities" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR "public"."community_access"("id")));



CREATE POLICY "community_visibility_guard" ON "public"."communities" AS RESTRICTIVE FOR SELECT USING ((("created_by" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR "public"."community_access"("id")));



CREATE POLICY "content_access_guard" ON "public"."posts" AS RESTRICTIVE FOR SELECT USING ("public"."can_view_user_content"("user_id"));



CREATE POLICY "content_access_guard" ON "public"."quotes" AS RESTRICTIVE FOR SELECT USING ("public"."can_view_user_content"("user_id"));



CREATE POLICY "content_access_guard" ON "public"."reviews" AS RESTRICTIVE FOR SELECT USING ("public"."can_view_user_content"("user_id"));



CREATE POLICY "content_access_guard" ON "public"."stories" AS RESTRICTIVE FOR SELECT USING ("public"."can_view_user_content"("user_id"));



ALTER TABLE "public"."conversation_hidden" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participant_guard" ON "public"."conversations" AS RESTRICTIVE TO "authenticated" USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id"))) WITH CHECK ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_admin_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_admin_controls_read" ON "public"."event_admin_controls" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "event_admin_controls_write" ON "public"."event_admin_controls" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



ALTER TABLE "public"."event_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."explore_featured_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "explore_featured_items_admin_write" ON "public"."explore_featured_items" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "explore_featured_items_read" ON "public"."explore_featured_items" FOR SELECT TO "authenticated" USING ((("active" AND ("starts_at" <= "now"()) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))) OR "public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])));



ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_flags_admin_write" ON "public"."feature_flags" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "feature_flags_read" ON "public"."feature_flags" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follow_requests_participants_delete" ON "public"."follow_requests" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "target_id")));



CREATE POLICY "follow_requests_participants_read" ON "public"."follow_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "target_id")));



CREATE POLICY "follow_requests_requester_insert" ON "public"."follow_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = "auth"."uid"()) AND ("requester_id" <> "target_id") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."user_blocks" "b"
  WHERE ((("b"."blocker_id" = "follow_requests"."requester_id") AND ("b"."blocked_id" = "follow_requests"."target_id")) OR (("b"."blocker_id" = "follow_requests"."target_id") AND ("b"."blocked_id" = "follow_requests"."requester_id"))))))));



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hashtag_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hashtag_controls_admin_write" ON "public"."hashtag_controls" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "hashtag_controls_read" ON "public"."hashtag_controls" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "hidden_own" ON "public"."conversation_hidden" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "conversation_hidden"."conversation_id") AND (("auth"."uid"() = "c"."user1_id") OR ("auth"."uid"() = "c"."user2_id")))))));



ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_join" ON "public"."community_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'member'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."communities" "c"
  WHERE (("c"."id" = "community_members"."community_id") AND ("c"."visibility" = 'public'::"text"))))));



CREATE POLICY "member_join_guard" ON "public"."community_members" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'member'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."communities" "c"
  WHERE (("c"."id" = "community_members"."community_id") AND ("c"."visibility" = 'public'::"text"))))));



CREATE POLICY "member_leave" ON "public"."community_members" FOR DELETE TO "authenticated" USING (((("user_id" = "auth"."uid"()) OR "public"."community_admin"("community_id")) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."communities" "c"
  WHERE (("c"."id" = "community_members"."community_id") AND ("c"."created_by" = "community_members"."user_id")))))));



CREATE POLICY "member_leave_guard" ON "public"."community_members" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (((("user_id" = "auth"."uid"()) OR "public"."community_admin"("community_id")) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."communities" "c"
  WHERE (("c"."id" = "community_members"."community_id") AND ("c"."created_by" = "community_members"."user_id")))))));



CREATE POLICY "member_read" ON "public"."community_members" FOR SELECT USING ("public"."community_access"("community_id"));



CREATE POLICY "member_read_guard" ON "public"."community_members" AS RESTRICTIVE FOR SELECT USING ("public"."community_access"("community_id"));



CREATE POLICY "member_role_guard" ON "public"."community_members" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "message_participant_guard" ON "public"."messages" AS RESTRICTIVE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("auth"."uid"() = "c"."user1_id") OR ("auth"."uid"() = "c"."user2_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("auth"."uid"() = "c"."user1_id") OR ("auth"."uid"() = "c"."user2_id"))))));



CREATE POLICY "message_privacy_guard" ON "public"."messages" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("auth"."uid"() = "c"."user1_id") OR ("auth"."uid"() = "c"."user2_id")) AND "public"."can_message_user"("auth"."uid"(),
        CASE
            WHEN ("c"."user1_id" = "auth"."uid"()) THEN "c"."user2_id"
            ELSE "c"."user1_id"
        END))))));



CREATE POLICY "message_send_guard" ON "public"."messages" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (NOT "public"."readers_blocked"("c"."user1_id", "c"."user2_id")))))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_comments_delete" ON "public"."post_comments" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "post_comments_delete_own" ON "public"."post_comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_comments_insert" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "post_comments_insert_authenticated" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "post_comments_select" ON "public"."post_comments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "post_comments_select_authenticated" ON "public"."post_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "post_comments_update" ON "public"."post_comments" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_likes_delete" ON "public"."post_likes" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "post_likes_delete_own" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_likes_insert" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "post_likes_insert_own" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "post_likes_select" ON "public"."post_likes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "post_likes_select_authenticated" ON "public"."post_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "post_likes_update" ON "public"."post_likes" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."post_reposts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_reposts_delete" ON "public"."post_reposts" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "post_reposts_delete_own" ON "public"."post_reposts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_reposts_insert" ON "public"."post_reposts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "post_reposts_insert_own" ON "public"."post_reposts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "post_reposts_select" ON "public"."post_reposts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "post_reposts_select_authenticated" ON "public"."post_reposts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "post_reposts_update" ON "public"."post_reposts" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete" ON "public"."posts" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "posts_insert" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "posts_select" ON "public"."posts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "posts_update" ON "public"."posts" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."premium_analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_entitlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_profile_customizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_reading_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_shelf_customizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_admin_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_admin_controls_read" ON "public"."profile_admin_controls" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])));



CREATE POLICY "profile_admin_controls_write" ON "public"."profile_admin_controls" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "profile_privacy_insert_own" ON "public"."profile_privacy_settings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profile_privacy_select_own" ON "public"."profile_privacy_settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profile_privacy_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_privacy_update_own" ON "public"."profile_privacy_settings" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotes_delete_authenticated" ON "public"."quotes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "quotes_insert_authenticated" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "quotes_select_authenticated" ON "public"."quotes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "quotes_update_authenticated" ON "public"."quotes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "reader_quote_delete_guard" ON "public"."quotes" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "reader_quote_insert" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reader_quote_insert_guard" ON "public"."quotes" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reader_quote_read" ON "public"."quotes" FOR SELECT USING (true);



CREATE POLICY "reader_quote_update_guard" ON "public"."quotes" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."reader_suggestion_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_daily_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reading_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_admin_update" ON "public"."reports" FOR UPDATE TO "authenticated" USING ("public"."has_admin_role"()) WITH CHECK ("public"."has_admin_role"());



CREATE POLICY "reports_insert" ON "public"."user_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "reports_own" ON "public"."user_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



CREATE POLICY "reports_read_own_or_admin" ON "public"."reports" FOR SELECT TO "authenticated" USING ((("reporter_id" = "auth"."uid"()) OR "public"."has_admin_role"()));



CREATE POLICY "reports_submit" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."reposts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."revenuecat_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_delete" ON "public"."reviews" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "reviews_insert" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "reviews_select" ON "public"."reviews" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "reviews_update" ON "public"."reviews" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "sanctions_admin_all" ON "public"."user_sanctions" TO "authenticated" USING ("public"."has_admin_role"()) WITH CHECK (("public"."has_admin_role"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "sanctions_user_read_own" ON "public"."user_sanctions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."saved_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_posts_delete_own" ON "public"."saved_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "saved_posts_insert_own" ON "public"."saved_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "saved_posts_select_own" ON "public"."saved_posts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."saved_works" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_works_owner" ON "public"."saved_works" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."works" "w"
  WHERE ("w"."id" = "saved_works"."work_id")))));



ALTER TABLE "public"."search_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "social_notifications_delete_own" ON "public"."social_notifications" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "social_notifications_select_own" ON "public"."social_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "social_notifications_update_own" ON "public"."social_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "storage_cleanup_admin_all" ON "public"."storage_cleanup_candidates" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



ALTER TABLE "public"."storage_cleanup_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stories_delete" ON "public"."stories" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "stories_insert" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "stories_select" ON "public"."stories" FOR SELECT TO "authenticated", "anon" USING (("expires_at" > "now"()));



CREATE POLICY "stories_update" ON "public"."stories" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "story_like_delete" ON "public"."story_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "story_like_insert" ON "public"."story_likes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."stories" "s"
  WHERE (("s"."id" = "story_likes"."story_id") AND ("s"."expires_at" > "now"()) AND (NOT "public"."readers_blocked"("auth"."uid"(), "s"."user_id")))))));



CREATE POLICY "story_like_read" ON "public"."story_likes" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."stories" "s"
  WHERE (("s"."id" = "story_likes"."story_id") AND ("s"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."story_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "story_owner_delete" ON "public"."stories" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "story_owner_delete_guard" ON "public"."stories" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "suggestion_feedback_owner" ON "public"."reader_suggestion_feedback" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_book_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_manage_super_admin" ON "public"."user_roles" TO "authenticated" USING ("public"."has_admin_role"(ARRAY['super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['super_admin'::"text"]));



CREATE POLICY "user_roles_read_own_or_admin" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])));



ALTER TABLE "public"."user_sanctions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_read_own_premium_entitlements" ON "public"."premium_entitlements" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."verified_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "verified_accounts_read_authenticated" ON "public"."verified_accounts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."work_chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."works" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "works_admin_read" ON "public"."works" FOR SELECT TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "works_admin_update" ON "public"."works" FOR UPDATE TO "authenticated" USING ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"])) WITH CHECK ("public"."has_admin_role"(ARRAY['admin'::"text", 'super_admin'::"text"]));



CREATE POLICY "works_owner" ON "public"."works" TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "works_read" ON "public"."works" FOR SELECT USING ((("status" = 'published'::"text") OR ("author_id" = "auth"."uid"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."announcements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."app_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."feature_flags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."follows";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profile_admin_controls";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_blocks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_roles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_sanctions";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."admin_add_sanction"("p_user_id" "uuid", "p_type" "text", "p_reason" "text", "p_ends_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_add_sanction"("p_user_id" "uuid", "p_type" "text", "p_reason" "text", "p_ends_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_analytics_daily"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_analytics_daily"("p_days" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_analytics_overview"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_analytics_overview"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_audit_filter_options"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_audit_filter_options"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_create_config_snapshot"("p_label" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_create_config_snapshot"("p_label" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_delete_announcement"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_announcement"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_delete_content"("p_target_type" "text", "p_target_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_content"("p_target_type" "text", "p_target_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_delete_explore_item"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_explore_item"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_delete_feature_flag"("p_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_feature_flag"("p_key" "text") TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_entitlements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_entitlements" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_grant_premium"("p_user_id" "uuid", "p_duration" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_grant_premium"("p_user_id" "uuid", "p_duration" "text", "p_reason" "text") TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."verified_accounts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."verified_accounts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_grant_verification"("p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_grant_verification"("p_user_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_admin_accounts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_admin_accounts"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_announcements"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_announcements"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_audit_logs"("p_search" "text", "p_action" "text", "p_target_type" "text", "p_admin_id" "uuid", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_audit_logs"("p_search" "text", "p_action" "text", "p_target_type" "text", "p_admin_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_authors"("p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_authors"("p_search" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_communities"("p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_communities"("p_search" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_community_members"("p_community_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_community_members"("p_community_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_event_attendees"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_event_attendees"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_events"("p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_events"("p_search" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_feature_flags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_feature_flags"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_hashtags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_hashtags"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_profile_controls"("p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_profile_controls"("p_search" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_sanctions"("p_search" "text", "p_active_only" boolean, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_sanctions"("p_search" "text", "p_active_only" boolean, "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_storage_objects"("p_bucket" "text", "p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_storage_objects"("p_bucket" "text", "p_search" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_system_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_system_settings"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_trash"("p_target_type" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_trash"("p_target_type" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_works"("p_search" "text", "p_status" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_works"("p_search" "text", "p_status" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_mark_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_mark_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_premium_analytics_daily"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_premium_analytics_daily"("p_days" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_premium_analytics_overview"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_premium_analytics_overview"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_remove_event_attendee"("p_event_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_remove_event_attendee"("p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_reported_message_context"("p_report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_reported_message_context"("p_report_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_restore_trash"("p_trash_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_restore_trash"("p_trash_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_review_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_review_storage_cleanup"("p_bucket" "text", "p_object_name" "text", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_revoke_premium"("p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_revoke_premium"("p_user_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_revoke_sanction"("p_sanction_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_revoke_sanction"("p_sanction_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_revoke_verification"("p_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_revoke_verification"("p_user_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_save_announcement"("p_id" "uuid", "p_title" "text", "p_body" "text", "p_kind" "text", "p_action_route" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_announcement"("p_id" "uuid", "p_title" "text", "p_body" "text", "p_kind" "text", "p_action_route" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_active" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_save_feature_flag"("p_key" "text", "p_enabled" boolean, "p_description" "text", "p_allowed_roles" "text"[], "p_allowed_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_feature_flag"("p_key" "text", "p_enabled" boolean, "p_description" "text", "p_allowed_roles" "text"[], "p_allowed_user_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_search_analytics"("p_days" integer, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_search_analytics"("p_days" integer, "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_search_role_candidates"("p_search" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_search_role_candidates"("p_search" "text", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_security_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_security_health"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_send_notification"("p_title" "text", "p_message" "text", "p_target_type" "text", "p_target_value" "text", "p_action_route" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_send_notification"("p_title" "text", "p_message" "text", "p_target_type" "text", "p_target_value" "text", "p_action_route" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_author_profile"("p_user_id" "uuid", "p_pen_name" "text", "p_verified" boolean, "p_featured" boolean, "p_priority" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_author_profile"("p_user_id" "uuid", "p_pen_name" "text", "p_verified" boolean, "p_featured" boolean, "p_priority" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_community_control"("p_community_id" "uuid", "p_verified" boolean, "p_featured" boolean, "p_priority" integer, "p_restricted" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_community_control"("p_community_id" "uuid", "p_verified" boolean, "p_featured" boolean, "p_priority" integer, "p_restricted" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_community_member_role"("p_community_id" "uuid", "p_user_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_community_member_role"("p_community_id" "uuid", "p_user_id" "uuid", "p_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_event_control"("p_event_id" "uuid", "p_featured" boolean, "p_priority" integer, "p_hidden" boolean, "p_cancelled" boolean, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_event_control"("p_event_id" "uuid", "p_featured" boolean, "p_priority" integer, "p_hidden" boolean, "p_cancelled" boolean, "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_hashtag_control"("p_tag" "text", "p_blocked" boolean, "p_featured" boolean, "p_priority" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_hashtag_control"("p_tag" "text", "p_blocked" boolean, "p_featured" boolean, "p_priority" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_profile_control"("p_user_id" "uuid", "p_verified" boolean, "p_follow_restricted" boolean, "p_content_filter_level" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_profile_control"("p_user_id" "uuid", "p_verified" boolean, "p_follow_restricted" boolean, "p_content_filter_level" "text", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_system_setting"("p_key" "text", "p_value" "jsonb", "p_description" "text", "p_public_read" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_system_setting"("p_key" "text", "p_value" "jsonb", "p_description" "text", "p_public_read" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_user_role"("p_user_id" "uuid", "p_role" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_storage_bucket_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_storage_bucket_stats"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_update_work_state"("p_work_id" "uuid", "p_status" "text", "p_completed" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_work_state"("p_work_id" "uuid", "p_status" "text", "p_completed" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_upsert_explore_item"("p_target_type" "text", "p_target_id" "text", "p_title" "text", "p_subtitle" "text", "p_priority" integer, "p_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_upsert_explore_item"("p_target_type" "text", "p_target_id" "text", "p_title" "text", "p_subtitle" "text", "p_priority" integer, "p_active" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_visible_hashtags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_visible_hashtags"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_follow_user"("p_target_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_follow_user"("p_target_user" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_message_user"("p_sender" "uuid", "p_target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_message_user"("p_sender" "uuid", "p_target" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_view_profile_content"("p_owner" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_profile_content"("p_owner" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_profile_content"("p_owner" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_view_user_content"("p_owner" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_user_content"("p_owner" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_user_content"("p_owner" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cancel_follow_request"("p_target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_follow_request"("p_target" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."capture_premium_analytics_event"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."community_access"("cid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_access"("cid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."community_access"("cid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."community_admin"("cid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."community_admin"("cid" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."community_owner_immutable"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."community_owner_join"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."current_app_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."filter_discoverable_reader_candidates"("p_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."filter_discoverable_reader_candidates"("p_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_active_readers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_active_readers"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_discover_communities"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_discover_communities"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_discover_communities"("p_limit" integer) TO "anon";



REVOKE ALL ON FUNCTION "public"."get_event_attendees"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_event_attendees"("p_event_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_follow_relationship"("p_target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_follow_relationship"("p_target" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_hashtag_content"("p_hashtag" "text", "p_limit" integer, "p_before" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_hashtag_content"("p_hashtag" "text", "p_limit" integer, "p_before" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_admin_notifications"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_admin_notifications"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_community_invites"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_community_invites"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_premium_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_premium_access"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_popular_books"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_popular_books"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_premium_badge_user_ids"("p_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_premium_badge_user_ids"("p_user_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_premium_goal_dashboard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_premium_goal_dashboard"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_premium_reading_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_premium_reading_stats"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_premium_year_report"("p_year" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_premium_year_report"("p_year" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_reading_dashboard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_reading_dashboard"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_same_book_readers"("p_book_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_same_book_readers"("p_book_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_trending_content"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_trending_content"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_trending_hashtags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_trending_hashtags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_hashtags"() TO "anon";



REVOKE ALL ON FUNCTION "public"."guard_admin_audit_immutability"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."guard_blocked_follow"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."guard_premium_entitlement_identity"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."guard_report_rate_limit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."guard_user_report_repeat"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."has_admin_role"("required_roles" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_admin_role"("required_roles" "text"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."invite_to_community"("p_community_id" "uuid", "p_invitee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_to_community"("p_community_id" "uuid", "p_invitee_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_search_event"("p_query" "text", "p_scope" "text", "p_result_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_search_event"("p_query" "text", "p_scope" "text", "p_result_count" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mark_admin_notification_read"("p_notification_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_admin_notification_read"("p_notification_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."notification_type_enabled"("p_user_id" "uuid", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notification_type_enabled"("p_user_id" "uuid", "p_type" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."process_revenuecat_premium_event"("p_event_id" "text", "p_event_type" "text", "p_user_id" "uuid", "p_source" "text", "p_product_id" "text", "p_source_reference" "text", "p_status" "text", "p_started_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_provider_event_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_revenuecat_premium_event"("p_event_id" "text", "p_event_type" "text", "p_user_id" "uuid", "p_source" "text", "p_product_id" "text", "p_source_reference" "text", "p_status" "text", "p_started_at" timestamp with time zone, "p_expires_at" timestamp with time zone, "p_provider_event_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_profile_verifications"("p_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_profile_verifications"("p_user_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."readers_blocked"("a" "uuid", "b" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."readers_blocked"("a" "uuid", "b" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."request_follow"("p_target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_follow"("p_target" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."respond_follow_request"("p_requester" "uuid", "p_accept" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respond_follow_request"("p_requester" "uuid", "p_accept" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."respond_to_community_invite"("p_invite_id" "uuid", "p_accept" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respond_to_community_invite"("p_invite_id" "uuid", "p_accept" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."runtime_controls"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."runtime_controls"() TO "anon";
GRANT ALL ON FUNCTION "public"."runtime_controls"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_visible_profiles"("p_query" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_visible_profiles"("p_query" "text", "p_limit" integer) TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_profile_customizations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_profile_customizations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_premium_profile_customization"("p_theme_key" "text", "p_layout_key" "text", "p_highlight_text" "text", "p_show_premium_frame" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_premium_profile_customization"("p_theme_key" "text", "p_layout_key" "text", "p_highlight_text" "text", "p_show_premium_frame" boolean) TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_reading_goals" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_reading_goals" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_premium_reading_goals"("p_weekly_page_goal" integer, "p_monthly_page_goal" integer, "p_yearly_book_goal" integer, "p_streak_goal_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_premium_reading_goals"("p_weekly_page_goal" integer, "p_monthly_page_goal" integer, "p_yearly_book_goal" integer, "p_streak_goal_days" integer) TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_shelf_customizations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_shelf_customizations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_premium_shelf_customization"("p_want_label" "text", "p_reading_label" "text", "p_read_label" "text", "p_layout_key" "text", "p_accent_key" "text", "p_show_counts" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_premium_shelf_customization"("p_want_label" "text", "p_reading_label" "text", "p_read_label" "text", "p_layout_key" "text", "p_accent_key" "text", "p_show_counts" boolean) TO "authenticated";



GRANT ALL ON TABLE "public"."user_book_status" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_book_status" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_user_book_status"("p_book_key" "text", "p_book_title" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_book_status"("p_book_key" "text", "p_book_title" "text", "p_status" "text") TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_chapters" TO "anon";
GRANT ALL ON TABLE "public"."work_chapters" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_chapters" TO "service_role";



REVOKE ALL ON FUNCTION "public"."swap_work_chapters"("first_id" "uuid", "second_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."swap_work_chapters"("first_id" "uuid", "second_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."track_product_event"("p_event_name" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_product_event"("p_event_name" "text", "p_metadata" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_reading_progress"("p_book_key" "text", "p_book_title" "text", "p_current_page" integer, "p_total_pages" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_reading_progress"("p_book_key" "text", "p_book_title" "text", "p_current_page" integer, "p_total_pages" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."work_popularity"("genre_filter" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."work_popularity"("genre_filter" "text") TO "authenticated";


















GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_config_snapshots" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_config_snapshots" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_notification_reads" TO "anon";
GRANT ALL ON TABLE "public"."admin_notification_reads" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_notification_reads" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_notifications" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_trash_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admin_trash_items" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."announcements" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_settings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."author_profiles" TO "anon";
GRANT ALL ON TABLE "public"."author_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."author_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."communities" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."communities" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."communities" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_admin_controls" TO "anon";
GRANT ALL ON TABLE "public"."community_admin_controls" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_admin_controls" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_invites" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_invites" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_post_comments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_post_comments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_post_comments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_post_likes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_post_likes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_post_likes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_posts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."conversation_hidden" TO "anon";
GRANT ALL ON TABLE "public"."conversation_hidden" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."conversation_hidden" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."conversations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."conversations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_admin_controls" TO "anon";
GRANT ALL ON TABLE "public"."event_admin_controls" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_admin_controls" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_attendees" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_attendees" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_attendees" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."explore_featured_items" TO "anon";
GRANT ALL ON TABLE "public"."explore_featured_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."explore_featured_items" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."feature_flags" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."follow_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."follow_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."follow_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."follows" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."follows" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."follows" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hashtag_controls" TO "anon";
GRANT ALL ON TABLE "public"."hashtag_controls" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."hashtag_controls" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."likes" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."messages" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."messages" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_comments" TO "service_role";
GRANT SELECT ON TABLE "public"."post_comments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_comments" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_likes" TO "service_role";
GRANT SELECT ON TABLE "public"."post_likes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_likes" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."post_reposts" TO "service_role";
GRANT SELECT ON TABLE "public"."post_reposts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_reposts" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."posts" TO "service_role";
GRANT SELECT ON TABLE "public"."posts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."posts" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."premium_analytics_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."product_analytics_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_admin_controls" TO "anon";
GRANT ALL ON TABLE "public"."profile_admin_controls" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_admin_controls" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_privacy_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profile_privacy_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_privacy_settings" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quotes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reader_suggestion_feedback" TO "anon";
GRANT ALL ON TABLE "public"."reader_suggestion_feedback" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reader_suggestion_feedback" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reading_daily_stats" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reading_daily_stats" TO "service_role";



GRANT ALL ON TABLE "public"."reading_preferences" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reading_preferences" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reading_progress" TO "anon";
GRANT ALL ON TABLE "public"."reading_progress" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reading_progress" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reposts" TO "anon";
GRANT ALL ON TABLE "public"."reposts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reposts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."revenuecat_webhook_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."reviews" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."reviews" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."saved_posts" TO "anon";
GRANT ALL ON TABLE "public"."saved_posts" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."saved_posts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."saved_works" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."saved_works" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."saved_works" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."search_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."social_notifications" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."social_notifications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."social_notifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."storage_cleanup_candidates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."storage_cleanup_candidates" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."storage_cleanup_candidates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stories" TO "service_role";
GRANT SELECT ON TABLE "public"."stories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stories" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."story_likes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."story_likes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_blocks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_blocks" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_blocks" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_reports" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_sanctions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."user_sanctions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_sanctions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."works" TO "anon";
GRANT ALL ON TABLE "public"."works" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."works" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































