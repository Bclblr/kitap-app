from pathlib import Path

path = Path('src/app/index.tsx')
s = path.read_text(encoding='utf-8')

state_anchor = "  const [loadingStories, setLoadingStories] = useState(false);\n"
if "const [feedLimit, setFeedLimit]" not in s:
    if state_anchor not in s:
        raise SystemExit('feed state anchor missing')
    s = s.replace(
        state_anchor,
        state_anchor + "  const [feedLimit, setFeedLimit] = useState(30);\n",
        1,
    )

reviews_start = s.index("  const loadReviews = useCallback(async () => {")
posts_start = s.index("\n  const loadPosts = useCallback(async () => {", reviews_start)
reviews_block = s[reviews_start:posts_start]
reviews_block = reviews_block.replace(".limit(30);", ".limit(feedLimit);", 1)
reviews_block = reviews_block.replace("  }, []);", "  }, [feedLimit]);", 1)
s = s[:reviews_start] + reviews_block + s[posts_start:]

posts_start = s.index("  const loadPosts = useCallback(async () => {")
stories_start = s.index("\n  const loadStories = useCallback(async () => {", posts_start)
posts_block = s[posts_start:stories_start]
posts_block = posts_block.replace(".limit(30);", ".limit(feedLimit);")
posts_block = posts_block.replace(".slice(0, 60);", ".slice(0, feedLimit * 2);")
posts_block = posts_block.replace("  }, []);", "  }, [feedLimit]);", 1)
s = s[:posts_start] + posts_block + s[stories_start:]

render_anchor = """          })\n        )}\n\n        {visiblePosts.length < 6 && <ReadersList limit={10} />}\n"""
load_more = """          })\n        )}\n\n        {visiblePosts.length >= feedLimit ? (\n          <Pressable\n            onPress={() => setFeedLimit((current) => current + 30)}\n            style={styles.loadMoreButton}\n            accessibilityRole=\"button\"\n            accessibilityLabel=\"Daha fazla içerik yükle\"\n          >\n            <Text style={styles.loadMoreText}>Daha fazla göster</Text>\n          </Pressable>\n        ) : null}\n\n        {visiblePosts.length < 6 && <ReadersList limit={10} />}\n"""
if "styles.loadMoreButton" not in s:
    if render_anchor not in s:
        raise SystemExit('feed render anchor missing')
    s = s.replace(render_anchor, load_more, 1)

style_anchor = "  sectionHeader: { marginTop: 25, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: '100%', minWidth: 0 },\n"
if "loadMoreButton:" not in s:
    if style_anchor not in s:
        raise SystemExit('style anchor missing')
    addition = (
        "  loadMoreButton: { alignSelf: 'center', marginTop: 8, marginBottom: 18, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: '#21182F', borderWidth: 1, borderColor: '#38284D' },\n"
        "  loadMoreText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },\n"
    )
    s = s.replace(style_anchor, addition + style_anchor, 1)

path.write_text(s, encoding='utf-8')
