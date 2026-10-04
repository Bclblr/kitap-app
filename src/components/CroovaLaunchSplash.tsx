import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export default function CroovaLaunchSplash() {
  const opacity = useRef(new Animated.Value(1)).current;
  const eyeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.sequence([
      Animated.delay(420),
      Animated.timing(eyeScale, { toValue: 0.08, duration: 110, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(eyeScale, { toValue: 1, duration: 130, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(260),
      Animated.timing(eyeScale, { toValue: 0.08, duration: 100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(eyeScale, { toValue: 1, duration: 120, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]);

    const exit = Animated.sequence([
      Animated.delay(1150),
      Animated.timing(opacity, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]);

    Animated.parallel([blink, exit]).start();
  }, [eyeScale, opacity]);

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { opacity }]}>
      <View style={styles.logo} accessibilityLabel="CROOVA">
        <Text style={styles.letters}>CR</Text>
        <View style={styles.o}>
          <Animated.View style={[styles.pupil, { transform: [{ scaleY: eyeScale }] }]} />
        </View>
        <View style={styles.o}>
          <Animated.View style={[styles.pupil, { transform: [{ scaleY: eyeScale }] }]} />
        </View>
        <Text style={styles.letters}>VA</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#6232B5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  letters: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  o: {
    width: 28,
    height: 34,
    borderWidth: 1.8,
    borderColor: '#FFFFFF',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  pupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
