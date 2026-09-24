import { ReactNode, useMemo } from 'react';
import { ImageProps } from 'react-native';

import SafeImage from '@/components/SafeImage';

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

export default function BookCover({
  uri,
  style,
  children,
  resizeMode = 'cover',
}: {
  uri: string | null;
  style: ImageProps['style'];
  children: ReactNode;
  resizeMode?: ImageProps['resizeMode'];
}) {
  const safeUri = useMemo(() => normalizeImageUri(uri), [uri]);

  if (!safeUri) return <>{children}</>;

  return (
    <SafeImage
      source={{ uri: safeUri }}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel="Kitap kapağı"
    />
  );
}
