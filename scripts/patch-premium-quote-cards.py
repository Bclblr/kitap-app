from pathlib import Path

# Premium hub link
path = Path('src/app/premium.tsx')
text = path.read_text(encoding='utf-8')
old_sig = "function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals' | '/premium-profile-customization' | '/premium-shelf-customization', message: string)"
new_sig = "function openPremiumFeature(path: '/premium-reading-stats' | '/premium-year-report' | '/premium-reading-goals' | '/premium-profile-customization' | '/premium-shelf-customization' | '/premium-quote-cards', message: string)"
if old_sig in text:
    text = text.replace(old_sig, new_sig, 1)
anchor = '        <Text style={[styles.sectionTitle, { color: colors.text }]}>Planını seç</Text>'
if 'Alıntı ve Paylaşım Kartları</Text>' not in text:
    block = '''        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Premium alıntı kartlarını aç"
          onPress={() => openPremiumFeature('/premium-quote-cards', 'Premium alıntı kartları aktif Premium üyelikle kullanılabilir.')}
          style={[styles.featureAction, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <View style={[styles.featureActionIcon, { backgroundColor: colors.primarySoft }]}> 
            <Feather name="image" size={21} color={colors.primary} />
          </View>
          <View style={styles.featureActionText}>
            <Text style={[styles.featureActionTitle, { color: colors.text }]}>Alıntı ve Paylaşım Kartları</Text>
            <Text style={[styles.featureActionBody, { color: colors.textSecondary }]}> 
              {premium.isPremium ? 'Editoryal, Gece ve Minimal kart şablonlarını kullan.' : 'Premium ile özel alıntı kartı şablonlarını aç.'}
            </Text>
          </View>
          <Feather name={premium.isPremium ? 'chevron-right' : 'lock'} size={19} color={colors.primary} />
        </Pressable>\n\n'''
    if anchor not in text:
        raise SystemExit('premium plan anchor missing')
    text = text.replace(anchor, block + anchor, 1)
path.write_text(text, encoding='utf-8')

# Route
path = Path('src/app/_layout.tsx')
text = path.read_text(encoding='utf-8')
anchor = "              'premium-profile-customization',\n"
if "'premium-quote-cards'" not in text:
    if anchor not in text:
        raise SystemExit('route anchor missing')
    text = text.replace(anchor, anchor + "              'premium-quote-cards',\n", 1)
path.write_text(text, encoding='utf-8')

# Home feed rendering
path = Path('src/app/index.tsx')
text = path.read_text(encoding='utf-8')
import_anchor = "import { BookCoverData, existingBookCover, loadBookCover, openLibraryWorkUrl } from '@/lib/open-library-cover';\n"
import_line = "import { normalizeQuoteCardTemplate, quoteCardPalette, QuoteCardTemplate } from '@/lib/quote-card';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('index import anchor missing')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

post_type_anchor = "  isQuote?: boolean;\n};"
if "card_template_key?: QuoteCardTemplate;" not in text:
    if post_type_anchor not in text:
        raise SystemExit('post type anchor missing')
    text = text.replace(post_type_anchor, "  isQuote?: boolean;\n  card_template_key?: QuoteCardTemplate;\n};", 1)

quote_map_anchor = "          created_at: quote.created_at,\n          isQuote: true,"
if "card_template_key: normalizeQuoteCardTemplate(quote.card_template_key)," not in text:
    if quote_map_anchor not in text:
        raise SystemExit('quote mapping anchor missing')
    text = text.replace(quote_map_anchor, "          created_at: quote.created_at,\n          card_template_key: normalizeQuoteCardTemplate(quote.card_template_key),\n          isQuote: true,", 1)

return_anchor = "            return (\n              <Fragment key={post.id}>"
if "const quoteCard = post.isQuote ? quoteCardPalette" not in text:
    if return_anchor not in text:
        raise SystemExit('feed return anchor missing')
    text = text.replace(return_anchor, "            const quoteCard = post.isQuote ? quoteCardPalette(normalizeQuoteCardTemplate(post.card_template_key), colors) : null;\n\n            return (\n              <Fragment key={post.id}>", 1)

old_view = "                <View key={post.id} style={[styles.postCard, post.isQuote && styles.quotePostCard, post.rating > 0 && styles.reviewPostCard]}>"
new_view = "                <View key={post.id} style={[styles.postCard, post.isQuote && styles.quotePostCard, post.rating > 0 && styles.reviewPostCard, quoteCard ? { backgroundColor: quoteCard.background, borderColor: quoteCard.border } : null]}>"
if old_view in text:
    text = text.replace(old_view, new_view, 1)
elif "quoteCard ? { backgroundColor: quoteCard.background" not in text:
    raise SystemExit('quote card outer style anchor missing')

old_text = "                  {post.text && <HashtagText text={post.isQuote ? `“${post.text}”` : post.text} style={[styles.postText, post.isQuote && styles.quotePostText]} />}"
new_text = "                  {post.text && <HashtagText text={post.isQuote ? `“${post.text}”` : post.text} style={[styles.postText, post.isQuote && styles.quotePostText, quoteCard ? { color: quoteCard.text } : null]} />}"
if old_text in text:
    text = text.replace(old_text, new_text, 1)
elif "quoteCard ? { color: quoteCard.text }" not in text:
    raise SystemExit('quote text style anchor missing')

path.write_text(text, encoding='utf-8')
