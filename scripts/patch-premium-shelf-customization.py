from pathlib import Path

# 1) Premium hub link.
premium = Path('src/app/premium.tsx')
text = premium.read_text(encoding='utf-8')
old_sig = "function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals' | '/premium-profile-customization', message: string)"
new_sig = "function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals' | '/premium-profile-customization' | '/premium-shelf-customization', message: string)"
if old_sig in text:
    text = text.replace(old_sig, new_sig, 1)

anchor = '        <Text style={[styles.sectionTitle, { color: colors.text }]}>Planını seç</Text>'
if 'Raf Kişiselleştirme</Text>' not in text:
    block = '''        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Premium raf kişiselleştirmeyi aç"
          onPress={() => openPremiumFeature('/premium-shelf-customization', 'Raf kişiselleştirme aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="book-open" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Raf Kişiselleştirme</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Raf adlarını, görünümünü ve vurgu rengini yönet.' : 'Premium ile raf görünümünü kişiselleştir.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

'''
    if anchor not in text:
        raise SystemExit('premium plan anchor missing')
    text = text.replace(anchor, block + anchor, 1)
premium.write_text(text, encoding='utf-8')

# 2) Register route.
layout = Path('src/app/_layout.tsx')
text = layout.read_text(encoding='utf-8')
route_anchor = "              'premium-profile-customization',\n"
if "'premium-shelf-customization'" not in text:
    if route_anchor not in text:
        raise SystemExit('premium profile route anchor missing')
    text = text.replace(route_anchor, route_anchor + "              'premium-shelf-customization',\n", 1)
layout.write_text(text, encoding='utf-8')

# 3) Apply customization to canonical shelves without changing shelf source of truth.
shelves = Path('src/app/shelves.tsx')
text = shelves.read_text(encoding='utf-8')

import_anchor = "import { supabase } from '@/lib/supabase';\n"
import_line = "import { DEFAULT_PREMIUM_SHELF_CUSTOMIZATION, loadOwnShelfCustomization, PremiumShelfCustomization, SHELF_ACCENTS } from '@/lib/shelf-customization';\nimport { usePremium } from '@/providers/PremiumProvider';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('shelves import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

router_anchor = "  const router = useRouter();\n"
state_block = """  const premium = usePremium();
  const [shelfCustomization, setShelfCustomization] = useState<PremiumShelfCustomization | null>(null);
"""
if state_block not in text:
    if router_anchor not in text:
        raise SystemExit('shelves router anchor missing')
    text = text.replace(router_anchor, router_anchor + state_block, 1)

old_user_block = """      if (!user) {
        setBooks([]);
        return;
      }

      const { data, error } = await supabase
"""
new_user_block = """      if (!user) {
        setBooks([]);
        setShelfCustomization(null);
        return;
      }

      if (premium.ready && premium.isPremium) {
        const customization = await loadOwnShelfCustomization(user.id).catch(() => null);
        setShelfCustomization(customization);
      } else {
        setShelfCustomization(null);
      }

      const { data, error } = await supabase
"""
if old_user_block in text:
    text = text.replace(old_user_block, new_user_block, 1)
elif 'loadOwnShelfCustomization(user.id)' not in text:
    raise SystemExit('shelves user block missing')

text = text.replace("  }, []);\n", "  }, [premium.isPremium, premium.ready]);\n", 1)

# Add labels/accent derived values before filteredBooks.
filtered_anchor = "  const filteredBooks =\n"
derived = """  const activeCustomization = premium.isPremium ? shelfCustomization : null;
  const shelfLabels = {
    want: activeCustomization?.want_label ?? DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.want_label,
    reading: activeCustomization?.reading_label ?? DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.reading_label,
    read: activeCustomization?.read_label ?? DEFAULT_PREMIUM_SHELF_CUSTOMIZATION.read_label,
  };
  const shelfAccent = SHELF_ACCENTS[activeCustomization?.accent_key ?? 'purple'];
  const shelfCounts = {
    want: books.filter((book) => book.status === 'want').length,
    reading: books.filter((book) => book.status === 'reading').length,
    read: books.filter((book) => book.status === 'read').length,
  };

"""
if derived not in text:
    if filtered_anchor not in text:
        raise SystemExit('filteredBooks anchor missing')
    text = text.replace(filtered_anchor, derived + filtered_anchor, 1)

# Add Premium shelf settings CTA under subtitle.
subtitle_anchor = """        <Text style={styles.subtitle}>
          Kitaplarını ve okuma durumlarını yönet
        </Text>
"""
cta = """
        {premium.isPremium ? (
          <Pressable
            onPress={() => router.push('/premium-shelf-customization')}
            style={[styles.premiumShelfButton, { borderColor: shelfAccent }]}
          >
            <Text style={[styles.premiumShelfButtonText, { color: shelfAccent }]}>✦ Raf görünümünü kişiselleştir</Text>
            <Text style={[styles.premiumShelfButtonArrow, { color: shelfAccent }]}>›</Text>
          </Pressable>
        ) : null}
"""
if 'Raf görünümünü kişiselleştir' not in text:
    if subtitle_anchor not in text:
        raise SystemExit('shelves subtitle anchor missing')
    text = text.replace(subtitle_anchor, subtitle_anchor + cta, 1)

# Make all active filters use chosen accent while preserving theme background.
text = text.replace(
    "filter === 'all' && styles.activeFilter,",
    "filter === 'all' && styles.activeFilter,\n              filter === 'all' && { borderColor: shelfAccent },",
    1,
)
text = text.replace(
    "filter === 'reading' &&\n                styles.activeFilter,",
    "filter === 'reading' &&\n                styles.activeFilter,\n              filter === 'reading' && { borderColor: shelfAccent },",
    1,
)
text = text.replace(
    "filter === 'read' &&\n                styles.activeFilter,",
    "filter === 'read' &&\n                styles.activeFilter,\n              filter === 'read' && { borderColor: shelfAccent },",
    1,
)
text = text.replace(
    "filter === 'want' &&\n                styles.activeFilter,",
    "filter === 'want' &&\n                styles.activeFilter,\n              filter === 'want' && { borderColor: shelfAccent },",
    1,
)

# Personalized labels and optional counts.
text = text.replace("              📖 Okuyorum\n", "              📖 {shelfLabels.reading}{activeCustomization?.show_counts ? ` (${shelfCounts.reading})` : ''}\n", 1)
text = text.replace("              ✅ Okudum\n", "              ✅ {shelfLabels.read}{activeCustomization?.show_counts ? ` (${shelfCounts.read})` : ''}\n", 1)
text = text.replace("              📚 Okuyacağım\n", "              📚 {shelfLabels.want}{activeCustomization?.show_counts ? ` (${shelfCounts.want})` : ''}\n", 1)

# Personalized status text in cards.
old_status_fn = """  function getStatusText(status?: Book['status']) {
    switch (status) {
      case 'reading':
        return '📖 Okuyorum';

      case 'read':
        return '✅ Okudum';

      case 'want':
      default:
        return '📚 Okuyacağım';
    }
  }
"""
new_status_fn = """  function getStatusText(status?: Book['status']) {
    switch (status) {
      case 'reading':
        return `📖 ${shelfLabels.reading}`;

      case 'read':
        return `✅ ${shelfLabels.read}`;

      case 'want':
      default:
        return `📚 ${shelfLabels.want}`;
    }
  }
"""
if old_status_fn in text:
    text = text.replace(old_status_fn, new_status_fn, 1)

# Compact density for book cards.
text = text.replace(
    "                  style={styles.bookCard}\n",
    "                  style={[styles.bookCard, activeCustomization?.layout_key === 'compact' && styles.compactBookCard]}\n",
    1,
)

# Append styles once before StyleSheet closing.
if 'premiumShelfButton:' not in text:
    marker = '\n});\n'
    idx = text.rfind(marker)
    if idx == -1:
        raise SystemExit('styles closing marker missing')
    extra = """

  premiumShelfButton: {
    marginTop: 14,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#15161D',
  },

  premiumShelfButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },

  premiumShelfButtonArrow: {
    fontSize: 25,
    lineHeight: 26,
    fontWeight: '700',
  },

  compactBookCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
"""
    text = text[:idx] + extra + text[idx:]

shelves.write_text(text, encoding='utf-8')
