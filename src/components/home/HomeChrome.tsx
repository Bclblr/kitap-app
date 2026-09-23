import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Image from '@/components/SafeImage';
import StoryActions from '@/components/StoryActions';
import StoryPlayback from '@/components/StoryPlayback';
import StoryTransition from '@/components/StoryTransition';
import ThemePicker from '@/components/ThemePicker';
import { storyAge } from '@/lib/reader-date';

export type HomeStory = {
  id: string;
  user_id?: string | null;
  username: string;
  profile_image?: string | null;
  image_url: string | null;
  text: string | null;
  created_at: string;
  expires_at: string;
  allow_likes?: boolean;
  allow_replies?: boolean;
};

export type HomeStoryGroup = {
  key: string;
  username: string;
  profile_image: string | null;
  stories: HomeStory[];
  hasUnseen: boolean;
};

export function HomeDrawer({
  visible,
  styles,
  colors,
  topInset,
  bottomInset,
  onClose,
  onSaved,
  onPremium,
  onProfileSettings,
  onSignOut,
}: {
  visible: boolean;
  styles: any;
  colors: any;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  onSaved: () => void;
  onPremium: () => void;
  onProfileSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <ScrollView
          style={{ width: '86%', flexGrow: 0 }}
          contentContainerStyle={[
            styles.drawerPanel,
            {
              width: '100%',
              height: undefined,
              flexGrow: 1,
              paddingTop: Math.max(topInset, 12),
              paddingBottom: bottomInset,
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerBrand}>Kitap</Text>
            <Pressable onPress={onClose} style={styles.drawerCloseButton} accessibilityLabel="Menüyü kapat">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.drawerDivider} />
          <View style={styles.drawerSection}>
            <DrawerItem styles={styles} colors={colors} icon="bookmark" label="Kaydedilenler" onPress={onSaved} />
            <DrawerItem styles={styles} colors={colors} icon="star" label="Kitap Premium" onPress={onPremium} accent />
            <DrawerItem styles={styles} colors={colors} icon="settings" label="Profil ayarları" onPress={onProfileSettings} />
            <DrawerItem styles={styles} colors={colors} icon="log-out" label="Çıkış yap" onPress={onSignOut} />
          </View>
          <ThemePicker />
          <View style={styles.drawerBottomArea}>
            <Text style={styles.drawerBottomText}>Okuma dünyana hoş geldin.</Text>
          </View>
        </ScrollView>
        <Pressable style={styles.drawerDismissArea} onPress={onClose} />
      </View>
    </Modal>
  );
}

function DrawerItem({
  styles,
  colors,
  icon,
  label,
  onPress,
  accent = false,
}: {
  styles: any;
  colors: any;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.drawerItem}>
      <View style={styles.drawerIconWrap}>
        <Feather name={icon} size={22} color={accent ? colors.primary : colors.text} />
      </View>
      <Text style={styles.drawerItemText}>{label}</Text>
    </Pressable>
  );
}

export function HomeStories({
  styles,
  colors,
  profileImage,
  loading,
  groups,
  onCreate,
  onOpenGroup,
}: {
  styles: any;
  colors: any;
  profileImage: string | null;
  loading: boolean;
  groups: HomeStoryGroup[];
  onCreate: () => void;
  onOpenGroup: (index: number) => void;
}) {
  return (
    <View style={styles.storySection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hikâyeler</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyList}>
        <Pressable onPress={onCreate} style={styles.storyItem}>
          <View style={styles.addStoryCircle}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.addStoryAvatar} resizeMode="cover" />
            ) : (
              <Feather name="user" size={28} color={colors.textSecondary} />
            )}
            <View style={styles.addStoryBadge}>
              <Text style={styles.addStoryIcon}>+</Text>
            </View>
          </View>
          <Text style={styles.storyName}>Hikâyen</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator />
        ) : (
          groups.map((group, groupIndex) => {
            const previewStory = group.stories[group.stories.length - 1];
            return (
              <Pressable
                key={group.key}
                onPress={() => onOpenGroup(groupIndex)}
                style={styles.storyItem}
              >
                <View
                  style={[
                    styles.storyRing,
                    group.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen,
                  ]}
                >
                  {group.profile_image || previewStory?.image_url ? (
                    <Image
                      source={{ uri: group.profile_image || previewStory?.image_url || '' }}
                      style={styles.storyCircleInner}
                    />
                  ) : (
                    <View style={[styles.storyCircleInner, styles.storyTextCircle]}>
                      <Text style={styles.storyFallbackIcon}>📖</Text>
                    </View>
                  )}
                  {group.stories.length > 1 ? (
                    <View style={styles.storyCountBadge}>
                      <Text style={styles.storyCountText}>{group.stories.length}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.storyName, !group.hasUnseen && styles.storyNameSeen]}
                >
                  {group.username}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

export function HomeStoryViewer({
  styles,
  visible,
  selectedStory,
  activeGroup,
  storyIndex,
  topInset,
  bottomInset,
  panHandlers,
  onClose,
  onNext,
  onPrevious,
  onDeleted,
}: {
  styles: any;
  visible: boolean;
  selectedStory: HomeStory | null;
  activeGroup: HomeStoryGroup | null;
  storyIndex: number;
  topInset: number;
  bottomInset: number;
  panHandlers: any;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDeleted: (storyId: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.storyModalOverlay, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.storyViewer} {...panHandlers}>
          <View style={[styles.storyProgressRow, { opacity: 0 }]}>
            {(activeGroup?.stories ?? []).map((story, index) => (
              <View
                key={story.id}
                style={[styles.storyProgressTrack, index <= storyIndex && styles.storyProgressActive]}
              />
            ))}
          </View>

          <View style={styles.storyViewerHeader}>
            <View style={styles.storyViewerIdentity}>
              {activeGroup?.profile_image ? (
                <Image source={{ uri: activeGroup.profile_image }} style={styles.storyViewerAvatar} />
              ) : (
                <View style={styles.storyViewerAvatarFallback}>
                  <Text style={styles.storyViewerAvatarText}>
                    {(selectedStory?.username || 'K').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.storyViewerUsername}>{selectedStory?.username}</Text>
                <Text style={styles.storyViewerCounter}>
                  {selectedStory ? storyAge(selectedStory.created_at) : ''} · {storyIndex + 1}/
                  {activeGroup?.stories.length ?? 1}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.storyCloseButton}>
              <Text style={styles.storyCloseText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.storyMediaArea}>
            <StoryTransition key={selectedStory?.id}>
              {selectedStory?.image_url ? (
                <Image source={{ uri: selectedStory.image_url }} style={styles.storyViewerImage} resizeMode="contain" />
              ) : (
                <View style={styles.storyTextOnlyCard}>
                  <Text style={styles.storyTextOnlyIcon}>📚</Text>
                </View>
              )}
              {selectedStory?.text ? (
                <View style={styles.storyTextOverlay}>
                  <Text style={styles.storyViewerText}>{selectedStory.text}</Text>
                </View>
              ) : null}
            </StoryTransition>
          </View>

          <View style={styles.storySwipeHint}>
            <View style={styles.storySwipeHandle} />
            <Text style={styles.storySwipeText}>Aşağı kaydırarak kapat</Text>
          </View>

          {selectedStory ? (
            <StoryPlayback
              key={selectedStory.id}
              storyId={selectedStory.id}
              count={activeGroup?.stories.length ?? 1}
              index={storyIndex}
              onNext={onNext}
              onPrevious={onPrevious}
            />
          ) : null}

          {selectedStory ? (
            <StoryActions
              key={`actions-${selectedStory.id}`}
              storyId={selectedStory.id}
              ownerId={selectedStory.user_id}
              allowLikes={selectedStory.allow_likes !== false}
              allowReplies={selectedStory.allow_replies !== false}
              onClose={onClose}
              onDeleted={() => onDeleted(selectedStory.id)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
