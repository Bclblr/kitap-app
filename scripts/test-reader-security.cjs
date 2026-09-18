const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003';
(async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create publication supabase_realtime; create schema auth;
 create table auth.users(id uuid primary key, created_at timestamptz not null default now());
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb default '{}'::jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),last_accessed_at timestamptz default now());
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 grant usage on schema storage to authenticated,anon;
 grant select,insert,update,delete on storage.objects to authenticated,anon;
 create policy legacy_storage on storage.objects for all using(true) with check(true);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values('${A}'),('${B}'),('${C}');
 create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,username text,full_name text,bio text default '',profile_image text,cover_image text,created_at timestamptz default now(),updated_at timestamptz default now());
 insert into public.profiles(id,username,full_name) values('${A}','reader_a','Reader A'),('${B}','reader_b','Reader B'),('${C}','reader_c','Reader C');
 create table public.posts(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,username text,text text,image_url text,book_key text,book_title text,rating integer default 0,created_at timestamptz default now());
 create table public.reviews(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,book_key text,book_title text,rating integer default 0,text text,created_at timestamptz default now());
 create table public.comments(id uuid primary key default gen_random_uuid(),review_id uuid references public.reviews(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,text text,created_at timestamptz default now());
 create table public.post_comments(id uuid primary key default gen_random_uuid(),post_id uuid references public.posts(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,text text,created_at timestamptz default now());
 create table public.follows(id uuid primary key default gen_random_uuid(),follower_id uuid references auth.users(id) on delete cascade,following_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now(),unique(follower_id,following_id));
 create table public.events(id uuid primary key default gen_random_uuid(),title text not null,description text default '',event_date timestamptz not null default now(),location text default '',image_url text,created_by uuid not null references auth.users(id) on delete cascade,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.event_attendees(event_id uuid references public.events(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now(),primary key(event_id,user_id));
  create table public.conversations(id uuid primary key default gen_random_uuid(),user1_id uuid references auth.users(id),user2_id uuid references auth.users(id),updated_at timestamptz default now(),created_at timestamptz default now());
 create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations(id),sender_id uuid references auth.users(id),content text,created_at timestamptz default now(),is_read boolean default false);
 create table public.stories(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),username text not null default 'Kitap Okuru',text text,image_url text,created_at timestamptz default now(),expires_at timestamptz default now()+interval '1 day');
 grant select,insert,update,delete on all tables in schema public to authenticated;`);
 const files=fs.readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort();
 function pgliteCompatibleMigration(sql) {
  return sql
   .replace(/create extension if not exists pgcrypto with schema extensions;?/gi, '')
   .replace(/create extension if not exists pg_cron;?/gi, '')
   .replace(/create extension if not exists pg_net with schema extensions;?/gi, '')
   .replace(/create schema if not exists extensions;?/gi, '')
   .replace(/do \$([a-zA-Z0-9_]*)\$[\s\S]*?cron\.(?:job|schedule|unschedule)[\s\S]*?end\s*\$\1\$;?/gi, '')
   .replace(/select cron\.schedule\([\s\S]*?\n\);/gi, '')
   .replace(/perform cron\.(?:schedule|unschedule)\([\s\S]*?\);/gi, '');
 }
 for(let run=0;run<2;run++) {
  for(const file of files) {
   const sql=pgliteCompatibleMigration(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));
   await db.exec(sql);
  }
 }
 await db.exec(`grant select on table
  public.posts,
  public.stories,
  public.events,
  public.follows,
  public.profile_privacy_settings,
  public.user_blocks
 to anon, authenticated;`);
 console.log('PASS: migrations apply twice on fixture schema');
 async function as(id) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`); }
 async function denied(sql) { await assert.rejects(db.query(sql)); }
 async function count(table) { return Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n); }
 await as(A);
 const work=(await db.query("insert into works(author_id,title) values(auth.uid(),'Private draft') returning id")).rows[0].id;
 await db.query(`insert into work_chapters(work_id,title,content) values('${work}','Draft chapter','Private text')`);
 await as(B); assert.equal(await count('works'),0); assert.equal(await count('work_chapters'),0);
 await denied(`insert into work_chapters(work_id,title) values('${work}','Intrusion')`);
 await as(A); await db.query(`update works set status='published' where id='${work}'`);
 await as(B); assert.equal(await count('works'),1); assert.equal(await count('work_chapters'),0);
 assert.equal((await db.query(`update works set title='Intrusion' where id='${work}' returning id`)).rows.length,0);
 await as(A); await db.query(`update work_chapters set status='published' where work_id='${work}'`);
 await as(B); assert.equal(await count('work_chapters'),1);
 console.log('PASS: work/chapter draft privacy and author ownership');
 await as(A);
 const firstChapter=(await db.query(`select id from work_chapters where work_id='${work}'`)).rows[0].id;
 const secondChapter=(await db.query(`insert into work_chapters(work_id,title,position) values('${work}','Second chapter',2) returning id`)).rows[0].id;
 const reordered=(await db.query(`select * from swap_work_chapters('${firstChapter}','${secondChapter}')`)).rows;
 assert.equal(reordered[0].id,secondChapter); assert.equal(reordered[1].id,firstChapter);
 await as(B); await denied(`select * from swap_work_chapters('${firstChapter}','${secondChapter}')`);
 console.log('PASS: chapter reorder is atomic and author-only');
 await as(A);
 const privateWork=(await db.query("insert into works(author_id,title,cover_url,language,audience,completed) values(auth.uid(),'Cover draft','https://example.supabase.co/storage/v1/object/authenticated/work-covers/"+A+"/cover.jpg','tr','general',true) returning id")).rows[0].id;
 await db.query(`insert into storage.objects(bucket_id,name) values('work-covers','${A}/cover.jpg')`);
 await denied(`insert into works(author_id,title,cover_url) values(auth.uid(),'Bad image','blob:http://localhost/image')`);
 for(const uri of ['file:///tmp/image.jpg','content://gallery/1','http://example.com/image.jpg','https://user:password@example.com/image.jpg']) await denied(`update works set cover_url='${uri}' where id='${privateWork}'`);
 await as(B); assert.equal(await count('storage.objects'),0);
 const forgedWork=(await db.query(`insert into works(author_id,title,status,cover_url) values(auth.uid(),'Forged cover','published','https://example.supabase.co/storage/v1/object/authenticated/work-covers/${A}/cover.jpg') returning id`)).rows[0].id;
 assert.equal(await count('storage.objects'),0);
 await db.query(`delete from works where id='${forgedWork}'`);
 await denied(`insert into storage.objects(bucket_id,name) values('work-covers','${A}/forged.jpg')`);
 await denied(`insert into saved_works(user_id,work_id) values(auth.uid(),'${privateWork}')`);
 await db.query(`insert into saved_works(user_id,work_id) values(auth.uid(),'${work}')`);
 await db.query(`insert into reader_suggestion_feedback(user_id,candidate_id) values(auth.uid(),'${A}')`);
 await denied(`insert into reader_suggestion_feedback(user_id,candidate_id) values('${A}','${C}')`);
 await as(A); assert.equal(await count('saved_works'),0); assert.equal(await count('reader_suggestion_feedback'),0);
 const popularity=(await db.query("select * from work_popularity('')")).rows;
 assert.deepEqual(popularity.map(row=>row.work_id),[work]); assert.equal(Number(popularity[0].saves),1);
 assert.equal((await db.query("select * from work_popularity('no matching genre')")).rows.length,0);
 await db.query(`update works set status='published' where id='${privateWork}'`);
 await as(B); assert.equal(await count('storage.objects'),1);
 assert.equal((await db.query(`update storage.objects set name='hijack.jpg' where bucket_id='work-covers' returning id`)).rows.length,0);
 assert.equal((await db.query(`delete from storage.objects where bucket_id='work-covers' returning id`)).rows.length,0);
 await as(A); await db.query(`update works set status='draft' where id='${privateWork}'`);
 await as(B); assert.equal(await count('storage.objects'),0);
 await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)");
 await denied("select * from work_popularity('')"); assert.equal(await count('storage.objects'),0);
 console.log('PASS: cover privacy despite permissive legacy policies, permanent images, private feedback/saves, published-only popularity');
 await as(A);
 const privateClub=(await db.query("insert into communities(name,created_by,visibility) values('Private club',auth.uid(),'private') returning id")).rows[0].id;
 const publicClub=(await db.query("insert into communities(name,created_by) values('Public club',auth.uid()) returning id")).rows[0].id;
 assert.equal(Number((await db.query(`select count(*) as n from community_members where community_id='${privateClub}' and role='owner'`)).rows[0].n),1);
 await db.query(`insert into community_posts(community_id,user_id,text) values('${privateClub}',auth.uid(),'Private content')`);
 await as(B); assert.equal(await count('communities'),1); assert.equal(await count('community_posts'),0);
 await denied(`insert into community_members(community_id,user_id) values('${privateClub}',auth.uid())`);
 await denied(`insert into community_members(community_id,user_id,role) values('${publicClub}',auth.uid(),'admin')`);
 await db.query(`insert into community_members(community_id,user_id) values('${publicClub}',auth.uid())`);
 assert.equal((await db.query(`update communities set name='Intrusion' where id='${publicClub}' returning id`)).rows.length,0);
 await db.query(`delete from community_members where community_id='${publicClub}' and user_id=auth.uid()`);
 console.log('PASS: private community isolation, owner auto-membership, public join/leave, role escalation denied');
 await as(A);
 const conversation=(await db.query(`insert into conversations(user1_id,user2_id) values(auth.uid(),'${B}') returning id`)).rows[0].id;
 await db.query(`insert into messages(conversation_id,sender_id,content) values('${conversation}',auth.uid(),'Hello')`);
 await as(C); assert.equal(await count('conversations'),0); assert.equal(await count('messages'),0);
 await denied(`insert into messages(conversation_id,sender_id,content) values('${conversation}',auth.uid(),'Intrusion')`);
 await as(A); await db.query(`insert into user_blocks(blocker_id,blocked_id) values(auth.uid(),'${B}')`);
 await denied(`insert into messages(conversation_id,sender_id,content) values('${conversation}',auth.uid(),'Blocked')`);
 await as(B); await denied(`insert into messages(conversation_id,sender_id,content) values('${conversation}',auth.uid(),'Blocked')`);
 await db.query(`insert into conversation_hidden(user_id,conversation_id) values(auth.uid(),'${conversation}')`);
 await as(A); assert.equal(await count('conversation_hidden'),0); assert.equal(await count('messages'),1);
 await db.query(`delete from user_blocks where blocker_id=auth.uid()`);
 await as(B); await db.query(`insert into messages(conversation_id,sender_id,content) values('${conversation}',auth.uid(),'Unblocked')`);
 await denied(`update messages set content='Forged' where sender_id='${A}'`);
 await denied(`update conversations set user1_id='${C}' where id='${conversation}'`);
 await db.query(`update messages set is_read=true where sender_id='${A}'`);
 console.log('PASS: chat membership, bilateral block, unblock and per-user hiding');
 await db.query(`insert into user_reports(reporter_id,reported_id,category) values(auth.uid(),'${A}','spam')`);
 await as(A); assert.equal(await count('user_reports'),0);
 console.log('PASS: report privacy');
 await as(A);
 const story=(await db.query(`insert into stories(user_id) values(auth.uid()) returning id`)).rows[0].id;
 await as(B); await db.query(`insert into story_likes(story_id,user_id) values('${story}',auth.uid())`);
 assert.equal((await db.query(`delete from stories where id='${story}' returning id`)).rows.length,0);
 await as(A); assert.equal(await count('story_likes'),1);
 await db.query(`delete from stories where id='${story}'`);
 assert.equal(await count('story_likes'),0);
 console.log('PASS: story owner deletion and like cascade');
 await db.query("insert into quotes(user_id,book_title,text) values(auth.uid(),'Book','Quote')");
 await as(B); assert.equal(await count('quotes'),1);
 await denied(`insert into quotes(user_id,text) values('${A}','Spoofed quote')`);
 console.log('PASS: public quotes and authenticated author insertion');
 await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)");
 assert.equal(await count('works'),1); assert.equal(await count('work_chapters'),1);
 assert.equal(await count('communities'),1);
 await denied('select * from messages');
 await denied('select * from user_reports');
 console.log('PASS: anonymous published reading and private data denial');
 } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
