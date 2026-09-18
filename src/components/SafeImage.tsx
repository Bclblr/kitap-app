import { useEffect, useState } from 'react';
import { Image as NativeImage, ImageProps, ImageSourcePropType, View } from 'react-native';
import { permanentImageUrl } from '@/lib/image-policy';
import { getSignedImageUrl } from '@/lib/image-cache';

const PRIVATE_STORAGE_BUCKETS = new Set([
  'work-covers',
  'post-images',
  'story-images',
  'avatars',
  'event-images',
]);

type PrivateStorageRef = {
  bucket: string;
  path: string;
};

function normalize(
  source: ImageSourcePropType | undefined,
  preview: boolean
): ImageSourcePropType | undefined {
  if (!source || typeof source === 'number') return source;
  if (Array.isArray(source)) {
    return source
      .map((item) => normalize(item, preview))
      .filter(Boolean) as ImageSourcePropType;
  }

  const uri =
    permanentImageUrl(source.uri) ??
    (preview && /^(blob:|file:|content:|data:image\/)/.test(source.uri ?? '')
      ? source.uri
      : null);

  return uri ? { ...source, uri } : undefined;
}

function parsePrivateStorageUrl(uri: string | undefined): PrivateStorageRef | null {
  if (!uri || uri.includes('/storage/v1/object/sign/')) return null;

  try {
    const url = new URL(uri);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const remainder = url.pathname.slice(markerIndex + marker.length);
    const match = remainder.match(/^(?:public|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;

    const bucket = decodeURIComponent(match[1]);
    if (!PRIVATE_STORAGE_BUCKETS.has(bucket)) return null;

    return {
      bucket,
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function SafeImage({
  source,
  localPreview = false,
  ...props
}: ImageProps & { localPreview?: boolean }) {
  const normalized = normalize(source, localPreview);
  const uri =
    normalized && typeof normalized === 'object' && !Array.isArray(normalized)
      ? normalized.uri
      : undefined;

  const privateRef = parsePrivateStorageUrl(uri);
  const privateBucket = privateRef?.bucket ?? null;
  const privatePath = privateRef?.path ?? null;
  const privateKey = privateBucket && privatePath ? `${privateBucket}/${privatePath}` : null;

  const [signed, setSigned] = useState<{
    original: string;
    key: string;
    url: string;
  } | null>(null);
  const [failed, setFailed] = useState<string | undefined>();

  useEffect(() => {
    if (!privateBucket || !privatePath || !uri || !privateKey) return;

    let alive = true;

    void getSignedImageUrl(privateBucket, privatePath).then((signedUrl) => {
      if (!alive) return;

      if (signedUrl) {
        setSigned({
          original: uri,
          key: privateKey,
          url: signedUrl,
        });
        setFailed(undefined);
      } else {
        setFailed(uri);
      }
    });

    return () => {
      alive = false;
    };
  }, [privateBucket, privateKey, privatePath, uri]);

  const waitingForSigned =
    !!privateRef && (!signed || signed.original !== uri || signed.key !== privateKey);

  if (!normalized || (uri && failed === uri) || waitingForSigned) {
    return (
      <View
        accessibilityLabel={props.accessibilityLabel ?? 'Görsel kullanılamıyor'}
        style={props.style}
      />
    );
  }

  return (
    <NativeImage
      {...props}
      source={privateRef ? { uri: signed!.url } : normalized}
      onError={(event) => {
        setFailed(uri);
        props.onError?.(event);
      }}
    />
  );
}

export default Object.assign(SafeImage, {
  prefetch: async (uri: string) => {
    const safeUri = permanentImageUrl(uri);
    if (!safeUri) return false;

    const privateRef = parsePrivateStorageUrl(safeUri);
    if (!privateRef) return NativeImage.prefetch(safeUri);

    const signedUrl = await getSignedImageUrl(privateRef.bucket, privateRef.path);
    return signedUrl ? NativeImage.prefetch(signedUrl) : false;
  },
});
