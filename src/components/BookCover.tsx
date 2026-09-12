import { ReactNode, useState } from 'react';
import { Image, ImageProps } from 'react-native';

export default function BookCover({ uri, style, children }: {
  uri: string | null;
  style: ImageProps['style'];
  children: ReactNode;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || uri === failedUri) return <>{children}</>;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => {
    console.warn('Kitap kapak görseli yüklenemedi:', uri);
    setFailedUri(uri);
  }} />;
}
