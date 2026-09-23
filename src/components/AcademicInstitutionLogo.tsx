import Image from '@/components/SafeImage';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

const logoCache = new Map<string, string | null>();

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function commonsFileUrl(fileName: string, width = 256) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

async function findInstitutionLogo(name: string, signal?: AbortSignal): Promise<string | null> {
  const clean = normalizeName(name);
  if (!clean) return null;

  const key = clean.toLocaleLowerCase('tr-TR');
  const cached = logoCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: clean,
      language: 'en',
      uselang: 'en',
      type: 'item',
      limit: '8',
      format: 'json',
      origin: '*',
    });

    const searchResponse = await fetch(
      `https://www.wikidata.org/w/api.php?${searchParams.toString()}`,
      { signal }
    );
    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const ids: string[] = Array.isArray(searchData?.search)
      ? searchData.search
          .map((item: any) => item?.id)
          .filter((id: unknown): id is string => typeof id === 'string')
          .slice(0, 8)
      : [];

    if (!ids.length) return null;

    const entityParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'claims|labels',
      languages: 'en|tr',
      format: 'json',
      origin: '*',
    });

    const entityResponse = await fetch(
      `https://www.wikidata.org/w/api.php?${entityParams.toString()}`,
      { signal }
    );
    if (!entityResponse.ok) return null;

    const entityData = await entityResponse.json();
    const normalizedName = clean.toLocaleLowerCase('tr-TR');

    const candidates = ids
      .map((id: string) => entityData?.entities?.[id])
      .filter(Boolean)
      .map((entity: any) => {
        const labels = [entity?.labels?.tr?.value, entity?.labels?.en?.value]
          .filter((value): value is string => typeof value === 'string');
        const exactName = labels.some((label) => label.toLocaleLowerCase('tr-TR') === normalizedName);
        const logo = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
        const image = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        const fileName = typeof logo === 'string' ? logo : typeof image === 'string' ? image : null;
        return {
          fileName,
          score: (exactName ? 20 : 0) + (typeof logo === 'string' ? 10 : 0),
        };
      })
      .filter((item: { fileName: string | null; score: number }) => !!item.fileName)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    const best = candidates[0]?.fileName;
    const url = best ? commonsFileUrl(best) : null;
    logoCache.set(key, url);
    return url;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    logoCache.set(key, null);
    return null;
  }
}

export default function AcademicInstitutionLogo({
  name,
  size = 44,
  style,
}: {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const clean = normalizeName(name);
  const cacheKey = clean.toLocaleLowerCase('tr-TR');
  const [logo, setLogo] = useState<string | null>(logoCache.get(cacheKey) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clean) return;

    const controller = new AbortController();
    let active = true;

    void findInstitutionLogo(clean, controller.signal)
      .then((url) => {
        if (active) {
          setLogo(url);
          setFailed(false);
        }
      })
      .catch((error) => {
        if ((error as Error)?.name !== 'AbortError' && active) setLogo(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [clean]);

  const frameStyle: StyleProp<ViewStyle> = [
    styles.frame,
    { width: size, height: size, borderRadius: Math.max(10, size * 0.24) },
    style,
  ];

  if (!logo || failed) {
    return (
      <View style={frameStyle}>
        <Feather name="briefcase" size={Math.max(14, size * 0.42)} color="#B79AF2" />
      </View>
    );
  }

  const imageStyle: StyleProp<ImageStyle> = [
    styles.image,
    { width: size, height: size, borderRadius: Math.max(10, size * 0.24) },
    StyleSheet.flatten(style) as ImageStyle | undefined,
  ];

  return (
    <Image
      source={{ uri: logo }}
      style={imageStyle}
      accessibilityLabel={`${clean} logosu`}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#241B36',
    borderWidth: 1,
    borderColor: '#3A2A54',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: '#F4F4F6',
    borderWidth: 1,
    borderColor: '#3A2A54',
  },
});
