import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Pressable, StyleSheet, View } from 'react-native';

/** Playback lives outside the feed: animation never rerenders feed cards. */
export default function StoryPlayback({ storyId, count, index, onNext, onPrevious }: {
  storyId: string; count: number; index: number; onNext: () => void; onPrevious: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const elapsed = useRef(0);
  const next = useRef(onNext);
  next.current = onNext;
  const [held, setHeld] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const longPress = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    elapsed.current = 0;
    progress.setValue(0);
    setHeld(false);
  }, [storyId, progress]);
  useEffect(() => {
    if (held || !active) return;
    const started = Date.now();
    const animation = Animated.timing(progress, {
      toValue: 1, duration: Math.max(0, 6000 - elapsed.current), easing: Easing.linear, useNativeDriver: false,
    });
    animation.start(({ finished }) => { if (finished) next.current(); });
    return () => { elapsed.current += Date.now() - started; animation.stop(); };
  }, [storyId, held, active, progress]);
  const pressProps = {
    onPressIn: () => { longPress.current = false; setHeld(true); },
    onLongPress: () => { longPress.current = true; },
    onPressOut: () => setHeld(false),
    delayLongPress: 200,
  };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View pointerEvents="none" style={styles.segments}>
      {Array.from({ length: count }, (_, segment) => <View key={segment} style={styles.track}>
        <Animated.View style={[styles.fill, { width: segment < index ? '100%' : segment > index ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>)}
    </View>
    <View style={styles.touch}>
      <Pressable {...pressProps} accessibilityLabel="Önceki hikaye; basılı tutarak duraklat" style={{ flex: 1 }} onPress={() => { if (!longPress.current) onPrevious(); }} />
      <Pressable {...pressProps} accessibilityLabel="Sonraki hikaye; basılı tutarak duraklat" style={{ flex: 2 }} onPress={() => { if (!longPress.current) onNext(); }} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  segments: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', gap: 4 },
  track: { flex: 1, minWidth: 0, height: 3, borderRadius: 2, backgroundColor: '#555', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#fff' },
  touch: { position: 'absolute', top: 90, bottom: 48, left: 0, right: 0, flexDirection: 'row' },
});
