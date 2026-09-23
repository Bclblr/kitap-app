import Image from '@/components/SafeImage';
import { useEffect, useState } from 'react';
import { ImageStyle, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

const photoCache = new Map<string, string | null>();

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function cacheKey(name: string, orcid?: string | null) {
  return `${normalizeName(name).toLocaleLowerCase('tr-TR')}|${orcid?.trim() ?? ''}`;
}

function commonsImageUrl(fileName: string, width = 320) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

async function findWikidataPortrait(name: string, orcid?: string | null, signal?: AbortSignal): Promise<string | null> {
  const clean = normalizeName(name);
  if (!clean) return null;

  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    search: clean,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '6',
    format: 'json',
    origin: '*',
  });

  const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`, { signal });
  if (!searchResponse.ok) return null;
  const searchData = await searchResponse.json();
  const ids = Array.isArray(searchData?.search)
    ? searchData.search.map((item: any) => item?.id).filter((id: unknown): id is string => typeof id === 'string').slice(0, 6)
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
  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams.toString()}`, { signal });
  if (!entityResponse.ok) return null;
  const entityData = await entityResponse.json();
  const entities = ids
    .map((id) => entityData?.entities?.[id])
    .filter(Boolean);

  const normalizedOrcid = orcid?.replace(/^https?:\/\/orcid\.org\//i, '').trim() || null;
  const normalizedName = clean.toLocaleLowerCase('tr-TR');

  const ranked = entities
    .map((entity: any) => {
      const claims = entity?.claims ?? {};
      const human = claims?.P31?.some((claim: any) => claim?.mainsnak?.datavalue?.value?.id === 'Q5') ?? false;
      const imageName = claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      const entityOrcid = claims?.P496?.[0]?.mainsnak?.datavalue?.value;
      const labels = [entity?.labels?.tr?.value, entity?.labels?.en?.value]
        .filter((value): value is string => typeof value === 'string');
      const exactName = labels.some((label) => label.toLocaleLowerCase('tr-TR') === normalizedName);
      const orcidMatch = !!normalizedOrcid && typeof entityOrcid === 'string' && entityOrcid === normalizedOrcid;
      return {
        imageName: typeof imageName === 'string' ? imageName : null,
        score: (orcidMatch ? 100 : 0) + (human ? 10 : 0) + (exactName ? 5 : 0),
      };
    })
    .filter((item: { imageName: string | null; score: number }) => !!item.imageName)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const best = ranked[0]?.imageName;
  return best ? commonsImageUrl(best) : null;
}

async function findWikipediaPortrait(name: string, signal?: AbortSignal): Promise<string | null> {
  const clean = normalizeName(name);
  if (!clean) return null;

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
      if (typeof url === 'string' && /^https:\/\//i.test(url)) return url;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
  }

  return null;
}

async function findAcademicPhoto(name: string, orcid?: string | null, signal?: AbortSignal): Promise<string | null> {
  const clean = normalizeName(name);
  if (!clean) return null;

  const key = cacheKey(clean, orcid);
  const cached = photoCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const wikidataPhoto = await findWikidataPortrait(clean, orcid, signal);
    if (wikidataPhoto) {
      photoCache.set(key, wikidataPhoto);
      return wikidataPhoto;
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
  }

  const wikipediaPhoto = await findWikipediaPortrait(clean, signal);
  photoCache.set(key, wikipediaPhoto);
  return wikipediaPhoto;
}

export default function AcademicAuthorAvatar({
  name,
  orcid,
  size = 44,
  style,
  textStyle,
}: {
  name: string;
  orcid?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const clean = normalizeName(name);
  const key = cacheKey(clean, orcid);
  const [photo, setPhoto] = useState<string | null>(photoCache.get(key) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clean) return;
    const controller = new AbortController();
    let active = true;

    void findAcademicPhoto(clean, orcid, controller.signal)
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
  }, [clean, orcid]);

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
