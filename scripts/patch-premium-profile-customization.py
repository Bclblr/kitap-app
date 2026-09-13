from pathlib import Path

premium = Path('src/app/premium.tsx')
text = premium.read_text(encoding='utf-8')
old_sig = "function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals', message: string)"
new_sig = "function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals' | '/premium-profile-customization', message: string)"
if old_sig in text:
    text = text.replace(old_sig, new_sig, 1)
anchor = '        <Text style={[styles.sectionTitle, { color: colors.text }]}>Planını seç</Text>'
if 'Profil Kişiselleştirme</Text>' not in text:
    block = '''        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Premium profil kişiselleştirmeyi aç"
          onPress={() => openPremiumFeature('/premium-profile-customization', 'Profil temaları ve kişiselleştirme aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="user" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Profil Kişiselleştirme</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}>
              {premium.isPremium ? 'Tema, düzen, profil vurgusu ve Premium çerçeveni yönet.' : 'Premium ile özel profil temalarını aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>

'''
    if anchor not in text:
        raise SystemExit('premium anchor missing')
    text = text.replace(anchor, block + anchor, 1)
premium.write_text(text, encoding='utf-8')

layout = Path('src/app/_layout.tsx')
text = layout.read_text(encoding='utf-8')
route_anchor = "              'premium',\n"
if "'premium-profile-customization'" not in text:
    if route_anchor not in text:
        raise SystemExit('route anchor missing')
    text = text.replace(route_anchor, route_anchor + "              'premium-profile-customization',\n", 1)
layout.write_text(text, encoding='utf-8')

profile = Path('src/app/profile.tsx')
text = profile.read_text(encoding='utf-8')
import_anchor = "import { isUserPremium } from '@/lib/premium';\n"
import_line = "import { loadProfileCustomization, PROFILE_THEME_ACCENTS, PremiumProfileCustomization } from '@/lib/profile-customization';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('profile import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)
state_anchor = "  const [isPremium, setIsPremium] = useState(false);\n"
state_line = "  const [premiumProfileCustomization, setPremiumProfileCustomization] = useState<PremiumProfileCustomization | null>(null);\n"
if state_line not in text:
    if state_anchor not in text:
        raise SystemExit('profile state anchor missing')
    text = text.replace(state_anchor, state_anchor + state_line, 1)
empty_anchor = "        setIsPremium(false);\n        return;"
if "setPremiumProfileCustomization(null);" not in text:
    if empty_anchor not in text:
        raise SystemExit('empty profile anchor missing')
    text = text.replace(empty_anchor, "        setIsPremium(false);\n        setPremiumProfileCustomization(null);\n        return;", 1)
old = '''      const [verified, premium] = await Promise.all([
        isUserVerified(targetUserId).catch(() => false),
        isUserPremium(targetUserId).catch(() => false),
      ]);
      setIsVerified(verified);
      setIsPremium(premium);'''
new = '''      const [verified, premium, customization] = await Promise.all([
        isUserVerified(targetUserId).catch(() => false),
        isUserPremium(targetUserId).catch(() => false),
        loadProfileCustomization(targetUserId).catch(() => null),
      ]);
      setIsVerified(verified);
      setIsPremium(premium);
      setPremiumProfileCustomization(premium ? customization : null);'''
if old in text:
    text = text.replace(old, new, 1)
elif 'const [verified, premium, customization]' not in text:
    raise SystemExit('premium load anchor missing')
hero = '        <View style={styles.profileHero}>'
if 'premiumProfileCustomization?.show_premium_frame' not in text:
    hero_new = '''        <View
          style={[
            styles.profileHero,
            premiumProfileCustomization?.show_premium_frame
              ? {
                  borderWidth: 2,
                  borderColor: PROFILE_THEME_ACCENTS[premiumProfileCustomization.theme_key],
                  borderRadius: premiumProfileCustomization.layout_key === 'spotlight' ? 22 : 14,
                  overflow: 'hidden',
                }
              : null,
          ]}
        >
          {premiumProfileCustomization?.highlight_text ? (
            <View style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: PROFILE_THEME_ACCENTS[premiumProfileCustomization.theme_key] }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
                {premiumProfileCustomization.highlight_text}
              </Text>
            </View>
          ) : null}'''
    if hero not in text:
        raise SystemExit('profile hero anchor missing')
    text = text.replace(hero, hero_new, 1)
profile.write_text(text, encoding='utf-8')
