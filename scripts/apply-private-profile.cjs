const fs = require('fs');
const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

function mustReplace(search, replace, label) {
  const before = s;
  s = s.replace(search, replace);
  if (s === before) throw new Error(`Patch failed: ${label}`);
}

mustReplace(
  "  const [isFollowing, setIsFollowing] = useState(false);\n  const [followLoading, setFollowLoading] = useState(false);",
  "  const [isFollowing, setIsFollowing] = useState(false);\n  const [followRequestPending, setFollowRequestPending] = useState(false);\n  const [isPrivateProfile, setIsPrivateProfile] = useState(false);\n  const [canViewProfileContent, setCanViewProfileContent] = useState(true);\n  const [followLoading, setFollowLoading] = useState(false);",
  'follow states'
);

mustReplace(
  "  const visibleFeed = feed.filter(item => profileTab === 'repost' ? item.reposted : !item.reposted && item.type === profileTab);",
  "  const visibleFeed = canViewProfileContent\n    ? feed.filter(item => profileTab === 'repost' ? item.reposted : !item.reposted && item.type === profileTab)\n    : [];",
  'visible feed'
);

const loadStart = s.indexOf('  const loadFollowData = useCallback(async () => {');
const loadEndMarker = '  }, [userId]);';
const loadEnd = s.indexOf(loadEndMarker, loadStart);
if (loadStart < 0 || loadEnd < 0) throw new Error('Patch failed: loadFollowData bounds');
const loadReplacement = `  const loadFollowData = useCallback(async () => {
    try {
      const loggedInUserId = await getCurrentUserId();
      const targetUserId = typeof userId === 'string' && userId ? userId : loggedInUserId;

      if (!targetUserId) {
        setFollowerCount(0);
        setFollowingCount(0);
        setIsFollowing(false);
        setFollowRequestPending(false);
        setIsPrivateProfile(false);
        setCanViewProfileContent(true);
        return;
      }

      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId),
      ]);

      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      if (loggedInUserId && loggedInUserId !== targetUserId) {
        const { data, error } = await supabase.rpc('get_follow_relationship', { p_target: targetUserId });
        if (error) throw error;
        const relationship = Array.isArray(data) ? data[0] : data;
        setIsFollowing(relationship?.is_following === true);
        setFollowRequestPending(relationship?.request_pending === true);
        setIsPrivateProfile(relationship?.is_private === true);
        setCanViewProfileContent(relationship?.can_view_content !== false);
      } else {
        setIsFollowing(false);
        setFollowRequestPending(false);
        setCanViewProfileContent(true);
        const { data } = await supabase
          .from('profile_privacy_settings')
          .select('is_private')
          .eq('user_id', targetUserId)
          .maybeSingle();
        setIsPrivateProfile(data?.is_private === true);
      }
    } catch (error) {
      console.error('Takip bilgileri yüklenemedi:', error);
    }
  }, [userId]);`;
s = s.slice(0, loadStart) + loadReplacement + s.slice(loadEnd + loadEndMarker.length);

const toggleStart = s.indexOf('  async function toggleFollow() {');
const reportMarker = '  async function reportProfile() {';
const toggleEnd = s.indexOf(reportMarker, toggleStart);
if (toggleStart < 0 || toggleEnd < 0) throw new Error('Patch failed: toggleFollow bounds');
const toggleReplacement = `  async function toggleFollow() {
    try {
      const loggedInUserId = await getCurrentUserId();
      const targetUserId = typeof userId === 'string' && userId ? userId : null;

      if (!loggedInUserId) {
        Alert.alert('Giriş gerekli', 'Takip etmek için giriş yapmalısın.');
        return;
      }
      if (!targetUserId || loggedInUserId === targetUserId) return;

      setFollowLoading(true);

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', loggedInUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
        setCanViewProfileContent(!isPrivateProfile);
        return;
      }

      if (followRequestPending) {
        const { error } = await supabase.rpc('cancel_follow_request', { p_target: targetUserId });
        if (error) throw error;
        setFollowRequestPending(false);
        return;
      }

      const { data, error } = await supabase.rpc('request_follow', { p_target: targetUserId });
      if (error) throw error;
      const result = String(data ?? '');
      if (result === 'requested') {
        setFollowRequestPending(true);
      } else {
        setIsFollowing(true);
        setFollowRequestPending(false);
        setFollowerCount((count) => count + 1);
        setCanViewProfileContent(true);
      }
    } catch (error) {
      console.error('Takip işlemi başarısız:', error);
      Alert.alert('Hata', 'Takip işlemi tamamlanamadı.');
    } finally {
      setFollowLoading(false);
    }
  }

`;
s = s.slice(0, toggleStart) + toggleReplacement + s.slice(toggleEnd);

mustReplace(
  "<Pressable onPress={toggleFollow} disabled={followLoading} style={[styles.followButton, isFollowing && styles.followingButton]}>\n                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>{followLoading ? '...' : isFollowing ? 'Takiptesin' : 'Takip Et'}</Text>\n              </Pressable>",
  "<Pressable onPress={toggleFollow} disabled={followLoading} style={[styles.followButton, (isFollowing || followRequestPending) && styles.followingButton]}>\n                <Text style={[styles.followButtonText, (isFollowing || followRequestPending) && styles.followingButtonText]}>\n                  {followLoading ? '...' : isFollowing ? 'Takiptesin' : followRequestPending ? 'İstek Gönderildi' : isPrivateProfile ? 'Takip İsteği Gönder' : 'Takip Et'}\n                </Text>\n              </Pressable>",
  'follow button'
);

fs.writeFileSync(path, s);
