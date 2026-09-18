begin;

drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable" on public.posts
for select to anon, authenticated using (true);

drop policy if exists "Users can create posts" on public.posts;
create policy "Users can create posts" on public.posts
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own posts" on public.posts;
create policy "Users can update own posts" on public.posts
for update to authenticated using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts" on public.posts
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
for select to anon, authenticated using (true);

drop policy if exists "Users can insert their own reviews" on public.reviews;
create policy "Users can insert their own reviews" on public.reviews
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reviews" on public.reviews;
create policy "Users can update their own reviews" on public.reviews
for update to authenticated using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own reviews" on public.reviews;
create policy "Users can delete their own reviews" on public.reviews
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Post likes are publicly readable" on public.post_likes;
create policy "Post likes are publicly readable" on public.post_likes
for select to anon, authenticated using (true);
drop policy if exists "Users can like posts" on public.post_likes;
create policy "Users can like posts" on public.post_likes
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can remove own post likes" on public.post_likes;
create policy "Users can remove own post likes" on public.post_likes
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Post comments are publicly readable" on public.post_comments;
create policy "Post comments are publicly readable" on public.post_comments
for select to anon, authenticated using (true);
drop policy if exists "Users can create post comments" on public.post_comments;
create policy "Users can create post comments" on public.post_comments
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own post comments" on public.post_comments;
create policy "Users can update own post comments" on public.post_comments
for update to authenticated using (auth.uid() = user_id)
with check (auth.uid() = user_id);
drop policy if exists "Users can delete own post comments" on public.post_comments;
create policy "Users can delete own post comments" on public.post_comments
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Post reposts are publicly readable" on public.post_reposts;
create policy "Post reposts are publicly readable" on public.post_reposts
for select to anon, authenticated using (true);
drop policy if exists "Users can repost posts" on public.post_reposts;
create policy "Users can repost posts" on public.post_reposts
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can remove own reposts" on public.post_reposts;
create policy "Users can remove own reposts" on public.post_reposts
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists saved_posts_select_own on public.saved_posts;
create policy saved_posts_select_own on public.saved_posts
for select to authenticated using (auth.uid() = user_id);
drop policy if exists saved_posts_insert_own on public.saved_posts;
create policy saved_posts_insert_own on public.saved_posts
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists saved_posts_delete_own on public.saved_posts;
create policy saved_posts_delete_own on public.saved_posts
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone" on public.comments
for select to authenticated using (true);
drop policy if exists "Users can create comments" on public.comments;
create policy "Users can create comments" on public.comments
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments" on public.comments
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Likes are viewable by everyone" on public.likes;
create policy "Likes are viewable by everyone" on public.likes
for select to authenticated using (true);
drop policy if exists "Users can like reviews" on public.likes;
create policy "Users can like reviews" on public.likes
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can remove their own likes" on public.likes;
create policy "Users can remove their own likes" on public.likes
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Reposts are viewable by everyone" on public.reposts;
create policy "Reposts are viewable by everyone" on public.reposts
for select to authenticated using (true);
drop policy if exists "Users can repost reviews" on public.reposts;
create policy "Users can repost reviews" on public.reposts
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can remove their own reposts" on public.reposts;
create policy "Users can remove their own reposts" on public.reposts
for delete to authenticated using (auth.uid() = user_id);

grant select on public.posts, public.reviews, public.post_likes, public.post_comments, public.post_reposts to anon, authenticated;
grant insert, update, delete on public.posts, public.reviews, public.post_comments to authenticated;
grant insert, delete on public.post_likes, public.post_reposts, public.saved_posts, public.comments, public.likes, public.reposts to authenticated;
grant select on public.saved_posts, public.comments, public.likes, public.reposts to authenticated;

commit;