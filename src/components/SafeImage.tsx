import { useEffect, useState } from 'react';
import { Image as NativeImage, ImageProps, ImageSourcePropType, View } from 'react-native';
import { permanentImageUrl } from '@/lib/image-policy';
import { supabase } from '@/lib/supabase';
function normalize(source: ImageSourcePropType | undefined, preview: boolean): ImageSourcePropType | undefined {
  if (!source || typeof source === 'number') return source;
  if (Array.isArray(source)) return source.map(item => normalize(item, preview)).filter(Boolean) as ImageSourcePropType;
  const uri = permanentImageUrl(source.uri) ?? (preview && /^(blob:|file:|content:|data:image\/)/.test(source.uri ?? '') ? source.uri : null);
  return uri ? { ...source, uri } : undefined;
}
function SafeImage({ source, localPreview = false, ...props }: ImageProps & { localPreview?: boolean }) {
  const normalized = normalize(source, localPreview);
  const uri = normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized.uri : undefined;
  const [signed, setSigned] = useState<{ original: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | undefined>();
  const privateCover = uri?.includes('/storage/v1/object/authenticated/work-covers/');
  useEffect(() => {
    if (!privateCover || !uri) return;
    let alive = true;
    let path: string;
    try { path = decodeURIComponent(uri.split('/work-covers/')[1].split('?')[0]); }
    catch { return; }
    void supabase.storage.from('work-covers').createSignedUrl(path, 3600).then(({ data, error }) => {
      if (alive) { if (!error && data) setSigned({ original: uri, url: data.signedUrl }); else setFailed(uri); }
    }).catch(() => { if (alive) setFailed(uri); });
    return () => { alive = false; };
  }, [privateCover, uri]);
  if (!normalized || (uri && failed === uri) || (privateCover && signed?.original !== uri)) return <View accessibilityLabel={props.accessibilityLabel ?? 'Görsel kullanılamıyor'} style={props.style} />;
  return <NativeImage {...props} source={privateCover ? { uri: signed!.url } : normalized} onError={event => { setFailed(uri); props.onError?.(event); }} />;
}
export default Object.assign(SafeImage, {
  prefetch: (uri: string) => permanentImageUrl(uri) ? NativeImage.prefetch(uri) : Promise.resolve(false),
});
