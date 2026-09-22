import { ReactNode, useMemo, useState } from 'react';
import { Image, ImageProps } from 'react-native';

function normalizeImageUri(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function BookCover({ uri, style, children }: {
  uri: string | null;
  style: ImageProps['style'];
  children: ReactNode;
}) {
  const safeUri = useMemo(() => normalizeImageUri(uri), [uri]);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (!safeUri || safeUri === failedUri) return <>{children}</>;

  return (
    <Image
      source={{ uri: safeUri }}
      style={style}
      resizeMode="cover"
      onError={(event) => {
        console.warn(
          'Kitap kapak görseli yüklenemedi:',
          safeUri,
          event.nativeEvent?.error ?? ''
        );
        setFailedUri(safeUri);
      }}
    />
  );
}
