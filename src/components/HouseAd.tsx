import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Image from '@/components/SafeImage';
import type { HouseAdCampaign } from '@/lib/house-ads';

function AdVideo({ uri, variant }: { uri: string; variant: 'banner' | 'feed' }) {
  const player = useVideoPlayer(
    { uri, useCaching: true },
    (instance) => {
      instance.loop = true;
      instance.muted = true;
      instance.play();
    }
  );

  return (
    <VideoView
      player={player}
      style={variant === 'banner' ? styles.bannerMedia : styles.feedMedia}
      contentFit="cover"
      nativeControls={false}
      surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
      allowsVideoFrameAnalysis={false}
    />
  );
}

export default function HouseAd({
  ad,
  variant,
}: {
  ad: HouseAdCampaign;
  variant: 'banner' | 'feed';
}) {
  async function openTarget() {
    try {
      const supported = await Linking.canOpenURL(ad.target_url);
      if (supported) await Linking.openURL(ad.target_url);
    } catch (error) {
      console.warn('Reklam bağlantısı açılamadı:', error);
    }
  }

  if (variant === 'banner') {
    return (
      <View style={styles.bannerOuter}>
        <Pressable
          onPress={() => void openTarget()}
          style={styles.banner}
          accessibilityRole="link"
          accessibilityLabel={`Sponsorlu reklam: ${ad.title}`}
        >
          {ad.media_type === 'video' ? (
            <AdVideo uri={ad.media_url} variant="banner" />
          ) : (
            <Image source={{ uri: ad.media_url }} style={styles.bannerMedia} resizeMode="cover" />
          )}
          <View style={styles.bannerShade} pointerEvents="none" />
          <View style={styles.bannerLabel} pointerEvents="none">
            <Text style={styles.bannerLabelText}>Sponsorlu</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void openTarget()}
      style={styles.feedCard}
      accessibilityRole="link"
      accessibilityLabel={`Sponsorlu reklam: ${ad.title}`}
    >
      <View style={styles.feedHeader}>
        <View style={styles.brandMark}>
          <Feather name="bookmark" size={17} color="#D9CBFF" />
        </View>
        <View style={styles.feedHeaderCopy}>
          <Text style={styles.feedTitle} numberOfLines={1}>{ad.title}</Text>
          <Text style={styles.sponsored}>Sponsorlu</Text>
        </View>
        <Feather name="external-link" size={17} color="#858593" />
      </View>

      <View style={styles.feedMediaWrap}>
        {ad.media_type === 'video' ? (
          <AdVideo uri={ad.media_url} variant="feed" />
        ) : (
          <Image source={{ uri: ad.media_url }} style={styles.feedMedia} resizeMode="cover" />
        )}
      </View>

      <View style={styles.feedFooter}>
        <View style={styles.feedFooterCopy}>
          {ad.subtitle ? <Text style={styles.feedSubtitle} numberOfLines={2}>{ad.subtitle}</Text> : null}
          <Text style={styles.cta}>Daha fazla bilgi</Text>
        </View>
        <View style={styles.ctaButton}>
          <Feather name="arrow-up-right" size={17} color="#FFF" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bannerOuter: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  banner: {
    width: '75%',
    maxWidth: 430,
    minWidth: 240,
    height: 92,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#15121C',
    borderWidth: 1,
    borderColor: 'rgba(169,133,255,0.30)',
  },
  bannerMedia: { width: '100%', height: '100%' },
  bannerShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  bannerLabel: {
    position: 'absolute',
    left: 10,
    top: 9,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,12,0.70)',
  },
  bannerLabelText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  feedCard: {
    marginHorizontal: -14,
    backgroundColor: '#0D0D12',
    borderBottomWidth: 1,
    borderBottomColor: '#202129',
    paddingTop: 14,
    paddingBottom: 16,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 11,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#241A33',
    borderWidth: 1,
    borderColor: '#3B2A52',
  },
  feedHeaderCopy: { flex: 1, minWidth: 0, marginHorizontal: 10 },
  feedTitle: { color: '#F4F4F7', fontSize: 14, fontWeight: '800' },
  sponsored: { color: '#898995', fontSize: 10, marginTop: 2 },
  feedMediaWrap: { width: '100%', height: 360, overflow: 'hidden', backgroundColor: '#111116' },
  feedMedia: { width: '100%', height: '100%' },
  feedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  feedFooterCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  feedSubtitle: { color: '#C7C7CF', fontSize: 12, lineHeight: 17 },
  cta: { color: '#A985FF', fontSize: 12, fontWeight: '800', marginTop: 5 },
  ctaButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6232B5',
  },
});
