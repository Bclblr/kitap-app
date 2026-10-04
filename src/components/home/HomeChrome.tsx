import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';
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
  text_color?: string | null;
  text_align?: 'left' | 'center' | 'right' | null;
  text_background?: boolean | null;
  text_style?: 'classic' | 'strong' | null;
  image_scale?: number | null;
  image_offset_x?: number | null;
  image_offset_y?: number | null;
  text_offset_x?: number | null;
  text_offset_y?: number | null;
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
            <Text style={styles.drawerBrand}>CROOVA</Text>
            <Pressable onPress={onClose} style={styles.drawerCloseButton} accessibilityLabel="Menüyü kapat">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.drawerDivider} />
          <View style={styles.drawerSection}>
            <DrawerItem styles={styles} colors={colors} icon="bookmark" label="Kaydedilenler" onPress={onSaved} />
            <DrawerItem styles={styles} colors={colors} icon="star" label="Premium" onPress={onPremium} accent />
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
  currentUserId,
  loading,
  groups,
  onCreate,
  onOpenGroup,
}: {
  styles: any;
  colors: any;
  profileImage: string | null;
  currentUserId: string | null;
  loading: boolean;
  groups: HomeStoryGroup[];
  onCreate: () => void;
  onOpenGroup: (index: number) => void;
}) {
  const ownGroupIndex = currentUserId ? groups.findIndex(group => group.key === currentUserId) : -1;
  const ownGroup = ownGroupIndex >= 0 ? groups[ownGroupIndex] : null;
  const otherGroups = groups
    .map((group, index) => ({ group, index }))
    .filter(({ index }) => index !== ownGroupIndex);

  return (
    <View style={styles.storySection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hikâyeler</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyList}>
        <Pressable
          onPress={() => ownGroup ? onOpenGroup(ownGroupIndex) : onCreate()}
          style={styles.storyItem}
        >
          <View
            style={[
              styles.storyRing,
              ownGroup ? (ownGroup.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen) : styles.storyRingSeen,
            ]}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.storyCircleInner} resizeMode="cover" />
            ) : (
              <View style={[styles.storyCircleInner, styles.storyTextCircle]}>
                <Feather name="user" size={25} color={colors.textSecondary} />
              </View>
            )}
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onCreate();
              }}
              hitSlop={7}
              style={styles.addStoryBadge}
              accessibilityLabel="Yeni hikâye ekle"
            >
              <Text style={styles.addStoryIcon}>+</Text>
            </Pressable>
            {ownGroup && ownGroup.stories.length > 1 ? (
              <View style={styles.storyCountBadge}>
                <Text style={styles.storyCountText}>{ownGroup.stories.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.storyName, ownGroup && !ownGroup.hasUnseen && styles.storyNameSeen]}>Hikâyen</Text>
        </Pressable>

        {loading ? (
          <View style={styles.storyItem}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          otherGroups.map(({ group, index: groupIndex }) => {
            const previewStory = group.stories[group.stories.length - 1];
            return (
              <Pressable key={group.key} onPress={() => onOpenGroup(groupIndex)} style={styles.storyItem}>
                <View style={[styles.storyRing, group.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen]}>
                  {group.profile_image || previewStory?.image_url ? (
                    <Image
                      source={{ uri: group.profile_image || previewStory?.image_url || '' }}
                      style={styles.storyCircleInner}
                    />
                  ) : (
                    <View style={[styles.storyCircleInner, styles.storyTextCircle]}>
                      <Feather name="book-open" size={21} color={colors.textSecondary} />
                    </View>
                  )}
                  {group.stories.length > 1 ? (
                    <View style={styles.storyCountBadge}>
                      <Text style={styles.storyCountText}>{group.stories.length}</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={[styles.storyName, !group.hasUnseen && styles.storyNameSeen]}>
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
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.storyModalOverlay, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.storyViewer} {...panHandlers}>
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
            <Pressable onPress={onClose} style={styles.storyCloseButton} accessibilityLabel="Hikâyeyi kapat">
              <Feather name="x" size={22} color="#FFF" />
            </Pressable>
          </View>

          <View
            style={styles.storyMediaArea}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setMediaSize({ width, height });
            }}
          >
            <StoryTransition key={selectedStory?.id}>
              {selectedStory?.image_url ? (
                <Image
                  source={{ uri: selectedStory.image_url }}
                  style={[
                    styles.storyViewerImage,
                    {
                      transform: [
                        { translateX: (selectedStory.image_offset_x ?? 0) * mediaSize.width },
                        { translateY: (selectedStory.image_offset_y ?? 0) * mediaSize.height },
                        { scale: selectedStory.image_scale ?? 1 },
                      ],
                    },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.storyTextOnlyCard}>
                  <View style={styles.storyTextOnlyIcon}><Feather name="book-open" size={34} color="#D8C8FF" /></View>
                </View>
              )}
              {selectedStory?.text ? (
                <View
                  style={[
                    styles.storyTextOverlay,
                    selectedStory.text_background && styles.storyTextOverlayBackground,
                    {
                      transform: [
                        { translateX: (selectedStory.text_offset_x ?? 0) * mediaSize.width },
                        { translateY: (selectedStory.text_offset_y ?? 0) * mediaSize.height },
                      ],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.storyViewerText,
                      selectedStory.text_style === 'strong' && styles.storyViewerTextStrong,
                      {
                        color: selectedStory.text_color || '#FFFFFF',
                        textAlign: selectedStory.text_align || 'center',
                      },
                    ]}
                  >
                    {selectedStory.text}
                  </Text>
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
