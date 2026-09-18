import { Pressable, Text, View } from 'react-native';

import PremiumBadge from '@/components/PremiumBadge';
import Image from '@/components/SafeImage';
import VerifiedBadge from '@/components/VerifiedBadge';
import {
  PROFILE_THEME_ACCENTS,
  type PremiumProfileCustomization,
} from '@/lib/profile-customization';

type ProfileHeaderData = {
  id: string;
  fullName?: string;
  username: string;
  bio: string;
  profileImage: string | null;
  coverImage: string | null;
};

type Props = {
  profile: ProfileHeaderData;
  customization: PremiumProfileCustomization | null;
  isVerified: boolean;
  isPremium: boolean;
  editing: boolean;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followRequestPending: boolean;
  isPrivateProfile: boolean;
  followLoading: boolean;
  safetyLoading: boolean;
  bookCount: number;
  followerCount: number;
  followingCount: number;
  quoteCount: number;
  reviewCount: number;
  styles: any;
  onAvatarPress: () => void;
  onOpenSettings: () => void;
  onToggleFollow: () => void;
  onMessage: () => void;
  onSafety: () => void;
  onFollowers: () => void;
  onFollowing: () => void;
};

export default function ProfileHeader({
  profile,
  customization,
  isVerified,
  isPremium,
  editing,
  isOwnProfile,
  isFollowing,
  followRequestPending,
  isPrivateProfile,
  followLoading,
  safetyLoading,
  bookCount,
  followerCount,
  followingCount,
  quoteCount,
  reviewCount,
  styles,
  onAvatarPress,
  onOpenSettings,
  onToggleFollow,
  onMessage,
  onSafety,
  onFollowers,
  onFollowing,
}: Props) {
  return (
    <>
      <View
        style={[
          styles.profileHero,
          customization?.show_premium_frame
            ? {
                borderWidth: 2,
                borderColor: PROFILE_THEME_ACCENTS[customization.theme_key],
                borderRadius: customization.layout_key === 'spotlight' ? 22 : 14,
                overflow: 'hidden',
              }
            : null,
        ]}
      >
        {customization?.highlight_text ? (
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              backgroundColor: PROFILE_THEME_ACCENTS[customization.theme_key],
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '800',
                textAlign: 'center',
              }}
            >
              {customization.highlight_text}
            </Text>
          </View>
        ) : null}

        <View style={styles.coverContainer}>
          {profile.coverImage ? (
            <Image source={{ uri: profile.coverImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverIcon}>🖼️</Text>
              {isOwnProfile ? <Text style={styles.coverText}>Kapak fotoğrafı ekle</Text> : null}
            </View>
          )}
        </View>

        <View style={styles.identityRow}>
          <Pressable onPress={onAvatarPress} style={styles.profileImageContainer}>
            {profile.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileIcon}>👤</Text>
              </View>
            )}
          </Pressable>

          {!editing ? (
            <View style={styles.identityInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.fullName} numberOfLines={1}>
                  {profile.fullName || 'Ad Soyad'}
                </Text>
                {isVerified ? <VerifiedBadge size={19} /> : null}
                {isPremium ? <PremiumBadge size={19} /> : null}
              </View>
              <Text style={styles.handle}>
                @{profile.username.toLowerCase().replace(/\s+/g, '')}
              </Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          ) : null}
        </View>

        {editing ? null : isOwnProfile ? (
          <Pressable
            onPress={onOpenSettings}
            style={styles.settingsButton}
            accessibilityLabel="Profil ayarları"
          >
            <Text style={styles.settingsButtonText}>⚙</Text>
          </Pressable>
        ) : (
          <View style={styles.profileActions}>
            <Pressable
              onPress={onToggleFollow}
              disabled={followLoading}
              style={[
                styles.followButton,
                (isFollowing || followRequestPending) && styles.followingButton,
              ]}
            >
              <Text
                style={[
                  styles.followButtonText,
                  (isFollowing || followRequestPending) && styles.followingButtonText,
                ]}
              >
                {followLoading
                  ? '...'
                  : isFollowing
                    ? 'Takiptesin'
                    : followRequestPending
                      ? 'İstek Gönderildi'
                      : isPrivateProfile
                        ? 'Takip İsteği Gönder'
                        : 'Takip Et'}
              </Text>
            </Pressable>
            <Pressable onPress={onMessage} style={styles.messageButton}>
              <Text style={styles.messageButtonText}>💬 Mesaj</Text>
            </Pressable>
            <Pressable
              onPress={onSafety}
              disabled={safetyLoading}
              style={styles.messageButton}
              accessibilityLabel="Profil seçenekleri"
            >
              <Text style={styles.messageButtonText}>{safetyLoading ? '...' : '⋯'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.stats}>
        <View
          style={styles.stat}
          accessibilityLabel={`${bookCount} farklı kitap hakkında paylaşım`}
        >
          <Text style={styles.statNumber}>{bookCount}</Text>
          <Text style={styles.statLabel}>Kitap</Text>
        </View>
        <View style={styles.statDivider} />
        <Pressable onPress={onFollowers} style={styles.stat}>
          <Text style={styles.statNumber}>{followerCount}</Text>
          <Text style={styles.statLabel}>Takipçi</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable onPress={onFollowing} style={styles.stat}>
          <Text style={styles.statNumber}>{followingCount}</Text>
          <Text style={styles.statLabel}>Takip</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{quoteCount}</Text>
          <Text style={styles.statLabel}>Alıntı</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{reviewCount}</Text>
          <Text style={styles.statLabel}>İnceleme</Text>
        </View>
      </View>
    </>
  );
}
