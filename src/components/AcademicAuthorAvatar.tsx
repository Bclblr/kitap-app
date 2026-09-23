import Image from '@/components/SafeImage';
import { useEffect, useState } from 'react';
import { ImageStyle, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

const photoCache = new Map<string, string | null>();

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

async function findAcademicPhoto(name: string, signal?: AbortSignal): Promise<string | null> {
  const clean = normalizeName(name);
  if (!clean) return null;

  const cached = photoCache.get(clean);
  if (cached !== undefined) return cached;

  for (const language of ['tr', 'en']) {
    try {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: `"${clean}"`,
        gsrnamespace: '0',
        gsrlimit: '1',
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: '320',
        format: 'json',
        origin: '*',
      });
      const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`, { signal });
      if (!response.ok) continue;
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) as { thumbnail?: { source?: string } }[] : [];
      const url = pages[0]?.thumbnail?.source;
      if (typeof url === 'string' && /^https:\/\//i.test(url)) {
        photoCache.set(clean, url);
        return url;
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
  }

  photoCache.set(clean, null);
  return null;
}

export default function AcademicAuthorAvatar({
  name,
  size = 44,
  style,
  textStyle,
}: {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const clean = normalizeName(name);
  const [photo, setPhoto] = useState<string | null>(photoCache.get(clean) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clean) return;
    const controller = new AbortController();
    let active = true;

    void findAcademicPhoto(clean, controller.signal)
      .then((url) => {
        if (active) {
          setPhoto(url);
          setFailed(false);
        }
      })
      .catch((error) => {
        if ((error as Error)?.name !== 'AbortError' && active) setPhoto(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [clean]);

  const frame = [
    styles.frame,
    { width: size, height: size, borderRadius: size / 2 },
    style,
  ];

  const imageFrame: StyleProp<ImageStyle> = [
    styles.frame,
    { width: size, height: size, borderRadius: size / 2 },
    StyleSheet.flatten(style) as ImageStyle | undefined,
  ];

  if (!photo || failed) {
    return (
      <View style={frame}>
        <Text style={[styles.fallbackText, { fontSize: Math.max(14, size * 0.34) }, textStyle]}>
          {(clean.charAt(0) || 'A').toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: photo }}
      style={imageFrame}
      accessibilityLabel={`${clean} profil fotoğrafı`}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#2B1D42',
    borderWidth: 1,
    borderColor: '#5B3A86',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackText: {
    color: '#E5D8FF',
    fontWeight: '900',
  },
});
