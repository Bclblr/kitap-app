const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'app', 'index.tsx');

if (!fs.existsSync(file)) {
  console.error('HATA: src/app/index.tsx bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');
const original = source;

function replaceOnce(label, matcher, replacement) {
  const next = source.replace(matcher, replacement);
  if (next === source) {
    console.error(`HATA: ${label} için beklenen kod bulunamadı. Dosyada değişiklik yapılmadı.`);
    process.exit(1);
  }
  source = next;
}

// PanResponder ekle.
if (!/\bPanResponder\b/.test(source.split("from 'react-native';")[0])) {
  replaceOnce(
    'PanResponder importu',
    /(\n\s*)Pressable,(\n\s*ScrollView,)/,
    '$1PanResponder,$1Pressable,$2'
  );
}

// Story tipine profil resmi ekle.
if (!/type Story = \{[\s\S]*?profile_image\?: string \| null;[\s\S]*?\};/.test(source)) {
  replaceOnce(
    'Story profile_image alanı',
    /(type Story = \{[\s\S]*?username: string;)/,
    '$1\n  profile_image?: string | null;'
  );
}

// Seen storage key.
if (!source.includes("const STORY_SEEN_KEY = 'story-seen-ids';")) {
  replaceOnce(
    'story seen key',
    "const REVIEWS_KEY = 'reviews';",
    "const REVIEWS_KEY = 'reviews';\nconst STORY_SEEN_KEY = 'story-seen-ids';"
  );
}

// Story state'leri.
if (!source.includes('const [seenStoryIds, setSeenStoryIds]')) {
  replaceOnce(
    'story state alanları',
    /useState<Story \| null>\(null\);/,
    `useState<Story | null>(null);\n  const [storyGroupIndex, setStoryGroupIndex] = useState<number | null>(null);\n  const [storyIndex, setStoryIndex] = useState(0);\n  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);`
  );
}

// Hikayeleri yüklerken profil bilgilerini ve görülme bilgisini hazırla.
replaceOnce(
  'loadStories setStories',
  /\s*setStories\(\s*\(data \|\| \[\]\) as Story\[\]\s*\);/,
  `\n      const rawStories = (data || []) as Story[];\n\n      const storyUserIds = Array.from(\n        new Set(\n          rawStories\n            .map((story) => story.user_id)\n            .filter((id): id is string => !!id)\n        )\n      );\n\n      let storyProfiles = new Map<string, any>();\n\n      if (storyUserIds.length > 0) {\n        const { data: storyProfileData } = await supabase\n          .from('profiles')\n          .select('id, username, profile_image')\n          .in('id', storyUserIds);\n\n        storyProfiles = new Map(\n          (storyProfileData ?? []).map((profile: any) => [\n            profile.id,\n            profile,\n          ])\n        );\n      }\n\n      const preparedStories = rawStories.map((story) => {\n        const profile = story.user_id\n          ? storyProfiles.get(story.user_id)\n          : null;\n\n        return {\n          ...story,\n          username:\n            profile?.username ||\n            story.username ||\n            CURRENT_USERNAME,\n          profile_image: profile?.profile_image ?? null,\n        };\n      });\n\n      setStories(preparedStories);\n\n      try {\n        const savedSeen = await AsyncStorage.getItem(STORY_SEEN_KEY);\n        const parsedSeen: string[] = savedSeen ? JSON.parse(savedSeen) : [];\n        const activeIds = new Set(preparedStories.map((story) => story.id));\n        const cleanSeen = parsedSeen.filter((id) => activeIds.has(id));\n        setSeenStoryIds(cleanSeen);\n\n        if (cleanSeen.length !== parsedSeen.length) {\n          await AsyncStorage.setItem(STORY_SEEN_KEY, JSON.stringify(cleanSeen));\n        }\n      } catch (seenError) {\n        console.error('Hikaye görülme bilgisi okunamadı:', seenError);\n      }`
);

// Eski openStory fonksiyonunu, gruplama + gezinme + swipe sistemiyle değiştir.
replaceOnce(
  'story navigation fonksiyonları',
  /\s*function openStory\(story: Story\) \{[\s\S]*?setSelectedStory\(story\);[\s\S]*?\}/,
  `\n  const storyGroups = (() => {\n    const groups = new Map<string, {\n      key: string;\n      username: string;\n      profile_image: string | null;\n      stories: Story[];\n    }>();\n\n    stories.forEach((story) => {\n      const key = story.user_id || story.username || story.id;\n      const existing = groups.get(key);\n\n      if (existing) {\n        existing.stories.push(story);\n      } else {\n        groups.set(key, {\n          key,\n          username: story.username || CURRENT_USERNAME,\n          profile_image: story.profile_image ?? null,\n          stories: [story],\n        });\n      }\n    });\n\n    return Array.from(groups.values()).map((group) => ({\n      ...group,\n      stories: [...group.stories].sort(\n        (a, b) =>\n          new Date(a.created_at).getTime() -\n          new Date(b.created_at).getTime()\n      ),\n      hasUnseen: group.stories.some(\n        (story) => !seenStoryIds.includes(story.id)\n      ),\n    }));\n  })();\n\n  const activeStoryGroup =\n    storyGroupIndex === null\n      ? null\n      : storyGroups[storyGroupIndex] ?? null;\n\n  function markStorySeen(storyId: string) {\n    setSeenStoryIds((current) => {\n      if (current.includes(storyId)) {\n        return current;\n      }\n\n      const next = [...current, storyId];\n      AsyncStorage.setItem(STORY_SEEN_KEY, JSON.stringify(next)).catch(\n        (error) => console.error('Hikaye görülme bilgisi kaydedilemedi:', error)\n      );\n      return next;\n    });\n  }\n\n  function showStoryAt(groupIndex: number, itemIndex: number) {\n    const group = storyGroups[groupIndex];\n    const story = group?.stories[itemIndex];\n\n    if (!group || !story) {\n      return;\n    }\n\n    setStoryGroupIndex(groupIndex);\n    setStoryIndex(itemIndex);\n    setSelectedStory(story);\n    markStorySeen(story.id);\n  }\n\n  function openStoryGroup(groupIndex: number) {\n    const group = storyGroups[groupIndex];\n    if (!group) return;\n\n    const firstUnseen = group.stories.findIndex(\n      (story) => !seenStoryIds.includes(story.id)\n    );\n\n    showStoryAt(groupIndex, firstUnseen >= 0 ? firstUnseen : 0);\n  }\n\n  function closeStory() {\n    setSelectedStory(null);\n    setStoryGroupIndex(null);\n    setStoryIndex(0);\n  }\n\n  function nextStory() {\n    if (storyGroupIndex === null) return;\n\n    const group = storyGroups[storyGroupIndex];\n    if (!group) return;\n\n    if (storyIndex < group.stories.length - 1) {\n      showStoryAt(storyGroupIndex, storyIndex + 1);\n      return;\n    }\n\n    if (storyGroupIndex < storyGroups.length - 1) {\n      showStoryAt(storyGroupIndex + 1, 0);\n      return;\n    }\n\n    closeStory();\n  }\n\n  function previousStory() {\n    if (storyGroupIndex === null) return;\n\n    if (storyIndex > 0) {\n      showStoryAt(storyGroupIndex, storyIndex - 1);\n      return;\n    }\n\n    if (storyGroupIndex > 0) {\n      const previousGroupIndex = storyGroupIndex - 1;\n      const previousGroup = storyGroups[previousGroupIndex];\n      showStoryAt(\n        previousGroupIndex,\n        Math.max(0, previousGroup.stories.length - 1)\n      );\n    }\n  }\n\n  const storyPanResponder = PanResponder.create({\n    onMoveShouldSetPanResponder: (_event, gesture) =>\n      Math.abs(gesture.dy) > 12 &&\n      Math.abs(gesture.dy) > Math.abs(gesture.dx),\n    onPanResponderRelease: (_event, gesture) => {\n      if (gesture.dy > 70) {\n        closeStory();\n      }\n    },\n  });`
);

// Story listesinde kişi başına tek halka göster.
replaceOnce(
  'story liste renderı',
  /\{loadingStories \? \([\s\S]*?\)\}\s*<\/ScrollView>\s*<\/View>\s*\n\s*\{\/\* POST OLUŞTUR \*\/\}/,
  `{loadingStories ? (\n              <ActivityIndicator />\n            ) : (\n              storyGroups.map((group, groupIndex) => {\n                const previewStory =\n                  group.stories[group.stories.length - 1];\n\n                return (\n                  <Pressable\n                    key={group.key}\n                    onPress={() => openStoryGroup(groupIndex)}\n                    style={styles.storyItem}\n                  >\n                    <View\n                      style={[\n                        styles.storyRing,\n                        group.hasUnseen\n                          ? styles.storyRingUnseen\n                          : styles.storyRingSeen,\n                      ]}\n                    >\n                      {group.profile_image || previewStory?.image_url ? (\n                        <Image\n                          source={{\n                            uri:\n                              group.profile_image ||\n                              previewStory?.image_url ||\n                              '',\n                          }}\n                          style={styles.storyCircleInner}\n                        />\n                      ) : (\n                        <View\n                          style={[\n                            styles.storyCircleInner,\n                            styles.storyTextCircle,\n                          ]}\n                        >\n                          <Text style={styles.storyFallbackIcon}>📖</Text>\n                        </View>\n                      )}\n\n                      {group.stories.length > 1 ? (\n                        <View style={styles.storyCountBadge}>\n                          <Text style={styles.storyCountText}>\n                            {group.stories.length}\n                          </Text>\n                        </View>\n                      ) : null}\n                    </View>\n\n                    <Text\n                      numberOfLines={1}\n                      style={[\n                        styles.storyName,\n                        !group.hasUnseen && styles.storyNameSeen,\n                      ]}\n                    >\n                      {group.username}\n                    </Text>\n                  </Pressable>\n                );\n              })\n            )}\n          </ScrollView>\n        </View>\n\n        {/* POST OLUŞTUR */}`
);

// Story modalini Instagram benzeri viewer ile değiştir.
replaceOnce(
  'story modal',
  /<Modal\s+visible=\{!!selectedStory\}[\s\S]*?<\/Modal>\s*\n\s*\{\/\* TOPLULUK \*\/\}/,
  `<Modal\n          visible={!!selectedStory}\n          transparent\n          animationType="fade"\n          onRequestClose={closeStory}\n        >\n          <View style={styles.storyModalOverlay}>\n            <View\n              style={styles.storyViewer}\n              {...storyPanResponder.panHandlers}\n            >\n              <View style={styles.storyProgressRow}>\n                {(activeStoryGroup?.stories ?? []).map((story, index) => (\n                  <View\n                    key={story.id}\n                    style={[\n                      styles.storyProgressTrack,\n                      index <= storyIndex && styles.storyProgressActive,\n                    ]}\n                  />\n                ))}\n              </View>\n\n              <View style={styles.storyViewerHeader}>\n                <View style={styles.storyViewerIdentity}>\n                  {activeStoryGroup?.profile_image ? (\n                    <Image\n                      source={{ uri: activeStoryGroup.profile_image }}\n                      style={styles.storyViewerAvatar}\n                    />\n                  ) : (\n                    <View style={styles.storyViewerAvatarFallback}>\n                      <Text style={styles.storyViewerAvatarText}>\n                        {(selectedStory?.username || 'K')\n                          .trim()\n                          .charAt(0)\n                          .toUpperCase()}\n                      </Text>\n                    </View>\n                  )}\n\n                  <View>\n                    <Text style={styles.storyViewerUsername}>\n                      {selectedStory?.username}\n                    </Text>\n                    <Text style={styles.storyViewerCounter}>\n                      {storyIndex + 1}/{activeStoryGroup?.stories.length ?? 1}\n                    </Text>\n                  </View>\n                </View>\n\n                <Pressable\n                  onPress={closeStory}\n                  style={styles.storyCloseButton}\n                >\n                  <Text style={styles.storyCloseText}>×</Text>\n                </Pressable>\n              </View>\n\n              <View style={styles.storyMediaArea}>\n                {selectedStory?.image_url ? (\n                  <Image\n                    source={{ uri: selectedStory.image_url }}\n                    style={styles.storyViewerImage}\n                    resizeMode="contain"\n                  />\n                ) : (\n                  <View style={styles.storyTextOnlyCard}>\n                    <Text style={styles.storyTextOnlyIcon}>📚</Text>\n                  </View>\n                )}\n\n                {selectedStory?.text ? (\n                  <View style={styles.storyTextOverlay}>\n                    <Text style={styles.storyViewerText}>\n                      {selectedStory.text}\n                    </Text>\n                  </View>\n                ) : null}\n\n                <Pressable\n                  onPress={previousStory}\n                  style={styles.storyTapLeft}\n                  accessibilityLabel="Önceki hikaye"\n                />\n                <Pressable\n                  onPress={nextStory}\n                  style={styles.storyTapRight}\n                  accessibilityLabel="Sonraki hikaye"\n                />\n              </View>\n\n              <View style={styles.storySwipeHint}>\n                <View style={styles.storySwipeHandle} />\n                <Text style={styles.storySwipeText}>Aşağı kaydırarak kapat</Text>\n              </View>\n            </View>\n          </View>\n        </Modal>\n\n        {/* TOPLULUK */}`
);

// Eski story stillerini yeni viewer stilleriyle değiştir.
replaceOnce(
  'story modal stilleri',
  /storyModalOverlay: \{[\s\S]*?storyViewerText: \{[\s\S]*?\n\s*\},\n\n\s*sectionHeader:/,
  `storyModalOverlay: {\n    flex: 1,\n    backgroundColor: '#000',\n  },\n\n  storyViewer: {\n    flex: 1,\n    backgroundColor: '#050507',\n    paddingTop: 14,\n    paddingBottom: 18,\n  },\n\n  storyProgressRow: {\n    flexDirection: 'row',\n    gap: 4,\n    paddingHorizontal: 10,\n    marginBottom: 10,\n  },\n\n  storyProgressTrack: {\n    flex: 1,\n    height: 3,\n    borderRadius: 3,\n    backgroundColor: 'rgba(255,255,255,0.24)',\n  },\n\n  storyProgressActive: {\n    backgroundColor: '#F5F5F7',\n  },\n\n  storyViewerHeader: {\n    height: 52,\n    paddingHorizontal: 12,\n    flexDirection: 'row',\n    alignItems: 'center',\n    justifyContent: 'space-between',\n    zIndex: 20,\n  },\n\n  storyViewerIdentity: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    flex: 1,\n  },\n\n  storyViewerAvatar: {\n    width: 36,\n    height: 36,\n    borderRadius: 18,\n    marginRight: 10,\n  },\n\n  storyViewerAvatarFallback: {\n    width: 36,\n    height: 36,\n    borderRadius: 18,\n    marginRight: 10,\n    backgroundColor: '#2B2140',\n    alignItems: 'center',\n    justifyContent: 'center',\n  },\n\n  storyViewerAvatarText: {\n    color: '#F4EEFF',\n    fontWeight: '900',\n  },\n\n  storyViewerUsername: {\n    color: '#FFF',\n    fontSize: 14,\n    fontWeight: '800',\n  },\n\n  storyViewerCounter: {\n    color: '#9B9BA4',\n    fontSize: 10,\n    marginTop: 2,\n  },\n\n  storyCloseButton: {\n    width: 38,\n    height: 38,\n    borderRadius: 19,\n    backgroundColor: 'rgba(20,20,26,0.78)',\n    justifyContent: 'center',\n    alignItems: 'center',\n    marginLeft: 10,\n  },\n\n  storyCloseText: {\n    color: '#FFF',\n    fontSize: 27,\n    lineHeight: 29,\n  },\n\n  storyMediaArea: {\n    flex: 1,\n    marginHorizontal: 8,\n    borderRadius: 18,\n    overflow: 'hidden',\n    backgroundColor: '#0D0D12',\n    position: 'relative',\n  },\n\n  storyViewerImage: {\n    width: '100%',\n    height: '100%',\n    backgroundColor: '#0D0D12',\n  },\n\n  storyTextOnlyCard: {\n    flex: 1,\n    alignItems: 'center',\n    justifyContent: 'center',\n    backgroundColor: '#15111E',\n  },\n\n  storyTextOnlyIcon: {\n    fontSize: 58,\n  },\n\n  storyTextOverlay: {\n    position: 'absolute',\n    left: 18,\n    right: 18,\n    bottom: 38,\n    backgroundColor: 'rgba(0,0,0,0.48)',\n    borderRadius: 16,\n    paddingHorizontal: 16,\n    paddingVertical: 13,\n    zIndex: 5,\n  },\n\n  storyViewerText: {\n    color: '#FFF',\n    fontSize: 17,\n    lineHeight: 24,\n    textAlign: 'center',\n    fontWeight: '600',\n  },\n\n  storyTapLeft: {\n    position: 'absolute',\n    left: 0,\n    top: 0,\n    bottom: 0,\n    width: '42%',\n    zIndex: 10,\n  },\n\n  storyTapRight: {\n    position: 'absolute',\n    right: 0,\n    top: 0,\n    bottom: 0,\n    width: '58%',\n    zIndex: 10,\n  },\n\n  storySwipeHint: {\n    height: 34,\n    alignItems: 'center',\n    justifyContent: 'flex-end',\n  },\n\n  storySwipeHandle: {\n    width: 34,\n    height: 4,\n    borderRadius: 3,\n    backgroundColor: '#4A4A52',\n    marginBottom: 4,\n  },\n\n  storySwipeText: {\n    color: '#66666F',\n    fontSize: 9,\n  },\n\n  sectionHeader:`
);

// Hikaye halka stillerini değiştir.
replaceOnce(
  'story circle stilleri',
  /storyItem: \{[\s\S]*?storyName: \{[\s\S]*?\n\s*\},\n\n\s*storyCreateBox:/,
  `storyItem: {\n    width: 74,\n    alignItems: 'center',\n  },\n\n  addStoryCircle: {\n    width: 64,\n    height: 64,\n    borderRadius: 32,\n    borderWidth: 2,\n    borderColor: '#F28A2E',\n    backgroundColor: '#14151C',\n    justifyContent: 'center',\n    alignItems: 'center',\n  },\n\n  addStoryIcon: {\n    fontSize: 26,\n    fontWeight: '300',\n    color: '#F28A2E',\n  },\n\n  storyRing: {\n    width: 66,\n    height: 66,\n    borderRadius: 33,\n    borderWidth: 3,\n    padding: 2,\n    position: 'relative',\n  },\n\n  storyRingUnseen: {\n    borderColor: '#A985FF',\n    backgroundColor: '#17131F',\n  },\n\n  storyRingSeen: {\n    borderColor: 'rgba(145,145,155,0.42)',\n    backgroundColor: 'rgba(40,40,46,0.42)',\n  },\n\n  storyCircleInner: {\n    width: '100%',\n    height: '100%',\n    borderRadius: 29,\n    backgroundColor: '#171820',\n  },\n\n  storyTextCircle: {\n    justifyContent: 'center',\n    alignItems: 'center',\n  },\n\n  storyFallbackIcon: {\n    fontSize: 21,\n  },\n\n  storyCountBadge: {\n    position: 'absolute',\n    right: -5,\n    bottom: -3,\n    minWidth: 20,\n    height: 20,\n    borderRadius: 10,\n    paddingHorizontal: 5,\n    backgroundColor: '#A985FF',\n    borderWidth: 2,\n    borderColor: '#08090D',\n    alignItems: 'center',\n    justifyContent: 'center',\n  },\n\n  storyCountText: {\n    color: '#0C0812',\n    fontSize: 9,\n    fontWeight: '900',\n  },\n\n  storyName: {\n    marginTop: 7,\n    fontSize: 10,\n    color: '#D0D0D6',\n    fontWeight: '700',\n    maxWidth: 72,\n    textAlign: 'center',\n  },\n\n  storyNameSeen: {\n    color: 'rgba(160,160,170,0.58)',\n  },\n\n  storyCreateBox:`
);

// Basit güvenlik kontrolleri.
const forbiddenMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
for (const marker of forbiddenMarkers) {
  if (source.includes(marker)) {
    console.error(`HATA: index.tsx içinde çözülmemiş conflict işareti var: ${marker}`);
    process.exit(1);
  }
}

if (source === original) {
  console.log('Hikaye sistemi zaten güncel görünüyor; değişiklik yapılmadı.');
  process.exit(0);
}

const backup = `${file}.before-instagram-stories.bak`;
fs.writeFileSync(backup, original, 'utf8');
fs.writeFileSync(file, source, 'utf8');

console.log('TAMAM: Instagram tarzı hikaye sistemi index.tsx dosyasına uygulandı.');
console.log('Yedek:', backup);
console.log('Eklenenler: kişi bazlı gruplama, görülmemiş/görülmüş halka, çoklu hikaye sayacı, sağ/sol dokunma, aşağı kaydırarak kapatma, ilerleme çubukları.');
