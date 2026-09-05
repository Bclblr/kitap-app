import { PropsWithChildren, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
export default function StoryTransition({ children }: PropsWithChildren) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { const animation = Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [fade]);
  return <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateX: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}
