from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)


# Shared badge component
Path("src/components/VerifiedBadge.tsx").write_text(
    """import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

export default function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel="Doğrulanmış hesap"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4C83FF',
        flexShrink: 0,
      }}
    >
      <Feather name="check" size={Math.max(9, Math.round(size * 0.62))} color="#FFFFFF" />
    </View>
  );
}
""",
    encoding="utf-8",
)

# Home feed
p = Path("src/app/index.tsx")
t = p.read_text(encoding="utf-8")
t = replace_once(t, "import Image from '@/components/SafeImage';\n", "import Image from '@/components/SafeImage';\nimport VerifiedBadge from '@/components/VerifiedBadge';\n", "home badge import")
t = replace_once(t, "import { supabase } from '@/lib/supabase';\n", "import { supabase } from '@/lib/supabase';\nimport { loadVerifiedUserIds } from '@/lib/verification';\n", "home verification import")
t = replace_once(t, "  profile_image?: string | null;\n  likes?: number;", "  profile_image?: string | null;\n  is_verified?: boolean;\n  likes?: number;", "review verified type")
t = replace_once(t, "  profile_image?: string | null;\n  text: string | null;", "  profile_image?: string | null;\n  is_verified?: boolean;\n  text: string | null;", "post verified type")
t = replace_once(t, "  profile_image: string | null;\n};\n\ntype FeedProfileResult", "  profile_image: string | null;\n  is_verified: boolean;\n};\n\ntype FeedProfileResult", "feed profile type")
t = replace_once(
    t,
    "      const profiles = (data ?? []) as FeedProfile[];\n      if (!error) {\n        feedProfilesCache = { data: profiles, expiresAt: Date.now() + 30_000 };\n      }\n      return { data: profiles, error };",
    "      const baseProfiles = (data ?? []) as Omit<FeedProfile, 'is_verified'>[];\n      const verifiedIds = !error\n        ? await loadVerifiedUserIds(baseProfiles.map((profile) => profile.id)).catch(() => new Set<string>())\n        : new Set<string>();\n      const profiles: FeedProfile[] = baseProfiles.map((profile) => ({\n        ...profile,\n        is_verified: verifiedIds.has(profile.id),\n      }));\n      if (!error) {\n        feedProfilesCache = { data: profiles, expiresAt: Date.now() + 30_000 };\n      }\n      return { data: profiles, error };",
    "feed profile enrichment",
)
t = replace_once(t, "          profile_image: reviewAuthor?.profile_image ?? null,\n          likes:", "          profile_image: reviewAuthor?.profile_image ?? null,\n          is_verified: reviewAuthor?.is_verified ?? false,\n          likes:", "review mapping")
t = replace_once(t, "          profile_image: postAuthor?.profile_image ?? null,\n          liked:", "          profile_image: postAuthor?.profile_image ?? null,\n          is_verified: postAuthor?.is_verified ?? false,\n          liked:", "post mapping")
post_name = "<View style={styles.userInfo}><Text style={styles.username} numberOfLines={1}>{post.full_name?.trim() || post.username}</Text><Text style={styles.handle} numberOfLines={1}>@{post.username}</Text><Text style={styles.date}>{formatDate(post.created_at)}</Text></View>"
post_name_new = "<View style={styles.userInfo}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={[styles.username, { flexShrink: 1 }]} numberOfLines={1}>{post.full_name?.trim() || post.username}</Text>{post.is_verified ? <VerifiedBadge size={16} /> : null}</View><Text style={styles.handle} numberOfLines={1}>@{post.username}</Text><Text style={styles.date}>{formatDate(post.created_at)}</Text></View>"
if post_name not in t:
    raise SystemExit("post name render anchor not found")
t = t.replace(post_name, post_name_new)
review_name = "<View style={styles.userInfo}><Text style={styles.username} numberOfLines={1}>{review.full_name?.trim() || review.username || CURRENT_USERNAME}</Text><Text style={styles.handle} numberOfLines={1}>@{review.username || CURRENT_USERNAME}</Text><Text style={styles.date}>{formatDate(review.createdAt)}</Text></View>"
review_name_new = "<View style={styles.userInfo}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={[styles.username, { flexShrink: 1 }]} numberOfLines={1}>{review.full_name?.trim() || review.username || CURRENT_USERNAME}</Text>{review.is_verified ? <VerifiedBadge size={16} /> : null}</View><Text style={styles.handle} numberOfLines={1}>@{review.username || CURRENT_USERNAME}</Text><Text style={styles.date}>{formatDate(review.createdAt)}</Text></View>"
if review_name not in t:
    raise SystemExit("review name render anchor not found")
t = t.replace(review_name, review_name_new)
p.write_text(t, encoding="utf-8")

# Profile
p = Path("src/app/profile.tsx")
t = p.read_text(encoding="utf-8")
t = replace_once(t, "import Image from '@/components/SafeImage';\n", "import Image from '@/components/SafeImage';\nimport VerifiedBadge from '@/components/VerifiedBadge';\n", "profile badge import")
t = replace_once(t, "import { supabase } from '@/lib/supabase';\n", "import { supabase } from '@/lib/supabase';\nimport { isUserVerified } from '@/lib/verification';\n", "profile verification import")
t = replace_once(t, "  const [currentUserId, setCurrentUserId] = useState<string | null>(null);\n", "  const [currentUserId, setCurrentUserId] = useState<string | null>(null);\n  const [isVerified, setIsVerified] = useState(false);\n", "profile state")
t = replace_once(
    t,
    "      if (!targetUserId) {\n        setProfile(DEFAULT_PROFILE);\n        return;\n      }\n\n      const { data, error } =",
    "      if (!targetUserId) {\n        setProfile(DEFAULT_PROFILE);\n        setIsVerified(false);\n        return;\n      }\n\n      const verified = await isUserVerified(targetUserId).catch(() => false);\n      setIsVerified(verified);\n\n      const { data, error } =",
    "profile verification load",
)
name_block_pattern = re.compile(r"(?P<indent>\s*)<View style=\{styles\.nameRow\}>\s*<Text style=\{styles\.fullName\} numberOfLines=\{1\}>\s*\{profile\.fullName \|\| 'Ad Soyad'\}\s*</Text>\s*</View>")
match = name_block_pattern.search(t)
if not match:
    raise SystemExit("profile name block not found")
indent = match.group("indent")
replacement = f"{indent}<View style={{styles.nameRow}}>\n{indent}  <Text style={{styles.fullName}} numberOfLines={{1}}>\n{indent}    {{profile.fullName || 'Ad Soyad'}}\n{indent}  </Text>\n{indent}  {{isVerified ? <VerifiedBadge size={{19}} /> : null}}\n{indent}</View>"
t = t[:match.start()] + replacement + t[match.end():]
verified_row_pattern = re.compile(r"\s*<View style=\{styles\.verifiedRow\}>\s*<Text style=\{styles\.verifiedIcon\}>✦</Text>\s*<Text style=\{styles\.verifiedText\}>Okur Profili</Text>\s*</View>")
t, count = verified_row_pattern.subn("", t, count=1)
if count != 1:
    raise SystemExit("profile decorative verified row not found")
p.write_text(t, encoding="utf-8")

# Reader directory
p = Path("src/components/ReadersList.tsx")
t = p.read_text(encoding="utf-8")
t = replace_once(t, "import ReaderSuggestions from './ReaderSuggestions';\n", "import ReaderSuggestions from './ReaderSuggestions';\nimport VerifiedBadge from './VerifiedBadge';\nimport { loadVerifiedUserIds } from '@/lib/verification';\n", "reader imports")
t = replace_once(t, "  request_pending: boolean;\n};", "  request_pending: boolean;\n  is_verified: boolean;\n};", "reader type")
t = replace_once(t, "          const baseReaders = (result.data ?? []) as Omit<Reader, 'is_private' | 'request_pending'>[];\n          const relationshipEntries", "          const baseReaders = (result.data ?? []) as Omit<Reader, 'is_private' | 'request_pending' | 'is_verified'>[];\n          const verifiedIds = await loadVerifiedUserIds(baseReaders.map((reader) => reader.id)).catch(() => new Set<string>());\n          const relationshipEntries", "reader verified load")
t = replace_once(t, "              request_pending: relationship?.request_pending ?? false,\n", "              request_pending: relationship?.request_pending ?? false,\n              is_verified: verifiedIds.has(reader.id),\n", "reader mapping")
old_reader_name = """                    <Text numberOfLines={1} style={ui.text}>
                      {reader.full_name || reader.username}
                      {reader.is_private ? '  🔒' : ''}
                    </Text>"""
new_reader_name = """                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text numberOfLines={1} style={[ui.text, { flexShrink: 1 }]}>
                        {reader.full_name || reader.username}
                        {reader.is_private ? '  🔒' : ''}
                      </Text>
                      {reader.is_verified ? <VerifiedBadge size={16} /> : null}
                    </View>"""
t = replace_once(t, old_reader_name, new_reader_name, "reader render")
p.write_text(t, encoding="utf-8")

# Reader suggestions
p = Path("src/components/ReaderSuggestions.tsx")
t = p.read_text(encoding="utf-8")
t = replace_once(t, "import { useAppTheme } from '@/providers/ThemeProvider';\n", "import { useAppTheme } from '@/providers/ThemeProvider';\nimport VerifiedBadge from './VerifiedBadge';\nimport { loadVerifiedUserIds } from '@/lib/verification';\n", "suggestion imports")
t = replace_once(t, "  const [requestPending, setRequestPending] = useState<Set<string>>(new Set());\n", "  const [requestPending, setRequestPending] = useState<Set<string>>(new Set());\n  const [verifiedUserIds, setVerifiedUserIds] = useState<Set<string>>(new Set());\n", "suggestion state")
t = replace_once(t, "          const readerIds = readers.map((reader) => reader.id);\n          let nextRequestPending = new Set<string>();", "          const readerIds = readers.map((reader) => reader.id);\n          const nextVerifiedUserIds = await loadVerifiedUserIds(readerIds).catch(() => new Set<string>());\n          let nextRequestPending = new Set<string>();", "suggestion verified load")
t = replace_once(t, "            setCandidates(readers);\n            setRequestPending(nextRequestPending);", "            setCandidates(readers);\n            setRequestPending(nextRequestPending);\n            setVerifiedUserIds(nextVerifiedUserIds);", "suggestion verified state")
old_suggestion_name = """                <Text numberOfLines={1} style={[ui.text, { fontWeight: '700' }]}>
                  {reader.full_name || reader.username}
                  {reader.is_private ? '  🔒' : ''}
                </Text>"""
new_suggestion_name = """                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
                  <Text numberOfLines={1} style={[ui.text, { fontWeight: '700', flexShrink: 1 }]}>
                    {reader.full_name || reader.username}
                    {reader.is_private ? '  🔒' : ''}
                  </Text>
                  {verifiedUserIds.has(reader.id) ? <VerifiedBadge size={16} /> : null}
                </View>"""
t = replace_once(t, old_suggestion_name, new_suggestion_name, "suggestion render")
p.write_text(t, encoding="utf-8")
