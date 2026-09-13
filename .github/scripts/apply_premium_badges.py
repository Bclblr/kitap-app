from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)

# premium helper
p = Path('src/lib/premium.ts')
t = p.read_text(encoding='utf-8')
if 'loadPremiumUserIds' not in t:
    t += """

export async function loadPremiumUserIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Set<string>();

  const { data, error } = await supabase.rpc('get_premium_badge_user_ids', {
    p_user_ids: uniqueIds,
  });
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row: { user_id?: string | null }) => row.user_id)
      .filter((value: string | null | undefined): value is string => Boolean(value))
  );
}

export async function isUserPremium(userId: string): Promise<boolean> {
  if (!userId) return false;
  const ids = await loadPremiumUserIds([userId]);
  return ids.has(userId);
}
"""
p.write_text(t, encoding='utf-8')

# home feed
p = Path('src/app/index.tsx')
t = p.read_text(encoding='utf-8')
if "PremiumBadge" not in t:
    t = replace_once(t, "import VerifiedBadge from '@/components/VerifiedBadge';\n", "import VerifiedBadge from '@/components/VerifiedBadge';\nimport PremiumBadge from '@/components/PremiumBadge';\n", 'home premium import')
    t = replace_once(t, "import { loadVerifiedUserIds } from '@/lib/verification';\n", "import { loadVerifiedUserIds } from '@/lib/verification';\nimport { loadPremiumUserIds } from '@/lib/premium';\n", 'home premium helper import')
    t = t.replace("  is_verified?: boolean;\n  likes?: number;", "  is_verified?: boolean;\n  is_premium?: boolean;\n  likes?: number;", 1)
    t = t.replace("  is_verified?: boolean;\n  text: string | null;", "  is_verified?: boolean;\n  is_premium?: boolean;\n  text: string | null;", 1)
    t = replace_once(t, "  is_verified: boolean;\n};\n\ntype FeedProfileResult", "  is_verified: boolean;\n  is_premium: boolean;\n};\n\ntype FeedProfileResult", 'home profile premium type')
    old = """      const verifiedIds = !error
        ? await loadVerifiedUserIds(baseProfiles.map((profile) => profile.id)).catch(() => new Set<string>())
        : new Set<string>();
      const profiles: FeedProfile[] = baseProfiles.map((profile) => ({
        ...profile,
        is_verified: verifiedIds.has(profile.id),
      }));"""
    new = """      const profileIds = baseProfiles.map((profile) => profile.id);
      const [verifiedIds, premiumIds] = !error
        ? await Promise.all([
            loadVerifiedUserIds(profileIds).catch(() => new Set<string>()),
            loadPremiumUserIds(profileIds).catch(() => new Set<string>()),
          ])
        : [new Set<string>(), new Set<string>()];
      const profiles: FeedProfile[] = baseProfiles.map((profile) => ({
        ...profile,
        is_verified: verifiedIds.has(profile.id),
        is_premium: premiumIds.has(profile.id),
      }));"""
    t = replace_once(t, old, new, 'home profile enrichment')
    t = t.replace("          is_verified: reviewAuthor?.is_verified ?? false,\n          likes:", "          is_verified: reviewAuthor?.is_verified ?? false,\n          is_premium: reviewAuthor?.is_premium ?? false,\n          likes:", 1)
    t = t.replace("          is_verified: postAuthor?.is_verified ?? false,\n          liked:", "          is_verified: postAuthor?.is_verified ?? false,\n          is_premium: postAuthor?.is_premium ?? false,\n          liked:", 1)
    t = t.replace("{post.is_verified ? <VerifiedBadge size={16} /> : null}</View>", "{post.is_verified ? <VerifiedBadge size={16} /> : null}{post.is_premium ? <PremiumBadge size={16} /> : null}</View>")
    t = t.replace("{review.is_verified ? <VerifiedBadge size={16} /> : null}</View>", "{review.is_verified ? <VerifiedBadge size={16} /> : null}{review.is_premium ? <PremiumBadge size={16} /> : null}</View>")
p.write_text(t, encoding='utf-8')

# profile
p = Path('src/app/profile.tsx')
t = p.read_text(encoding='utf-8')
if "PremiumBadge" not in t:
    t = replace_once(t, "import VerifiedBadge from '@/components/VerifiedBadge';\n", "import VerifiedBadge from '@/components/VerifiedBadge';\nimport PremiumBadge from '@/components/PremiumBadge';\n", 'profile premium import')
    t = replace_once(t, "import { isUserVerified } from '@/lib/verification';\n", "import { isUserVerified } from '@/lib/verification';\nimport { isUserPremium } from '@/lib/premium';\n", 'profile premium helper import')
    t = replace_once(t, "  const [isVerified, setIsVerified] = useState(false);\n", "  const [isVerified, setIsVerified] = useState(false);\n  const [isPremium, setIsPremium] = useState(false);\n", 'profile premium state')
    t = replace_once(t, "        setIsVerified(false);\n        return;", "        setIsVerified(false);\n        setIsPremium(false);\n        return;", 'profile empty premium')
    t = replace_once(t, "      const verified = await isUserVerified(targetUserId).catch(() => false);\n      setIsVerified(verified);", "      const [verified, premium] = await Promise.all([\n        isUserVerified(targetUserId).catch(() => false),\n        isUserPremium(targetUserId).catch(() => false),\n      ]);\n      setIsVerified(verified);\n      setIsPremium(premium);", 'profile premium load')
    t = t.replace("{isVerified ? <VerifiedBadge size={19} /> : null}\n", "{isVerified ? <VerifiedBadge size={19} /> : null}\n              {isPremium ? <PremiumBadge size={19} /> : null}\n", 1)
p.write_text(t, encoding='utf-8')

# reader directory
p = Path('src/components/ReadersList.tsx')
t = p.read_text(encoding='utf-8')
if "PremiumBadge" not in t:
    t = replace_once(t, "import VerifiedBadge from './VerifiedBadge';\n", "import VerifiedBadge from './VerifiedBadge';\nimport PremiumBadge from './PremiumBadge';\n", 'reader premium import')
    t = replace_once(t, "import { loadVerifiedUserIds } from '@/lib/verification';\n", "import { loadVerifiedUserIds } from '@/lib/verification';\nimport { loadPremiumUserIds } from '@/lib/premium';\n", 'reader premium helper')
    t = replace_once(t, "  is_verified: boolean;\n};", "  is_verified: boolean;\n  is_premium: boolean;\n};", 'reader premium type')
    t = replace_once(t, "const baseReaders = (result.data ?? []) as Omit<Reader, 'is_private' | 'request_pending' | 'is_verified'>[];\n          const verifiedIds = await loadVerifiedUserIds(baseReaders.map((reader) => reader.id)).catch(() => new Set<string>());", "const baseReaders = (result.data ?? []) as Omit<Reader, 'is_private' | 'request_pending' | 'is_verified' | 'is_premium'>[];\n          const readerIds = baseReaders.map((reader) => reader.id);\n          const [verifiedIds, premiumIds] = await Promise.all([\n            loadVerifiedUserIds(readerIds).catch(() => new Set<string>()),\n            loadPremiumUserIds(readerIds).catch(() => new Set<string>()),\n          ]);", 'reader premium load')
    t = replace_once(t, "              is_verified: verifiedIds.has(reader.id),\n", "              is_verified: verifiedIds.has(reader.id),\n              is_premium: premiumIds.has(reader.id),\n", 'reader premium mapping')
    t = t.replace("{reader.is_verified ? <VerifiedBadge size={16} /> : null}\n", "{reader.is_verified ? <VerifiedBadge size={16} /> : null}\n                      {reader.is_premium ? <PremiumBadge size={16} /> : null}\n", 1)
p.write_text(t, encoding='utf-8')

# suggestions
p = Path('src/components/ReaderSuggestions.tsx')
t = p.read_text(encoding='utf-8')
if "PremiumBadge" not in t:
    t = replace_once(t, "import VerifiedBadge from './VerifiedBadge';\n", "import VerifiedBadge from './VerifiedBadge';\nimport PremiumBadge from './PremiumBadge';\n", 'suggestions premium import')
    t = replace_once(t, "import { loadVerifiedUserIds } from '@/lib/verification';\n", "import { loadVerifiedUserIds } from '@/lib/verification';\nimport { loadPremiumUserIds } from '@/lib/premium';\n", 'suggestions premium helper')
    t = replace_once(t, "  const [verifiedUserIds, setVerifiedUserIds] = useState<Set<string>>(new Set());\n", "  const [verifiedUserIds, setVerifiedUserIds] = useState<Set<string>>(new Set());\n  const [premiumUserIds, setPremiumUserIds] = useState<Set<string>>(new Set());\n", 'suggestions premium state')
    t = replace_once(t, "          const nextVerifiedUserIds = await loadVerifiedUserIds(readerIds).catch(() => new Set<string>());", "          const [nextVerifiedUserIds, nextPremiumUserIds] = await Promise.all([\n            loadVerifiedUserIds(readerIds).catch(() => new Set<string>()),\n            loadPremiumUserIds(readerIds).catch(() => new Set<string>()),\n          ]);", 'suggestions premium load')
    t = replace_once(t, "            setVerifiedUserIds(nextVerifiedUserIds);", "            setVerifiedUserIds(nextVerifiedUserIds);\n            setPremiumUserIds(nextPremiumUserIds);", 'suggestions premium state set')
    t = t.replace("{verifiedUserIds.has(reader.id) ? <VerifiedBadge size={16} /> : null}\n", "{verifiedUserIds.has(reader.id) ? <VerifiedBadge size={16} /> : null}\n                  {premiumUserIds.has(reader.id) ? <PremiumBadge size={16} /> : null}\n", 1)
p.write_text(t, encoding='utf-8')
