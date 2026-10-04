import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';

export default function CroovaLaunchSplash() {
  const opacity = useRef(new Animated.Value(1)).current;
  const eyeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    const runAnimation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (!mounted) return;

      Animated.sequence([
        Animated.delay(250),
        Animated.timing(eyeScale, { toValue: 0.08, duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(eyeScale, { toValue: 1, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(350),
        Animated.timing(eyeScale, { toValue: 0.08, duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(eyeScale, { toValue: 1, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    };

    void runAnimation();

    return () => {
      mounted = false;
    };
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
    position: 'absolute',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  letters: {
    color: '#6232B5',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  o: {
    width: 17,
    height: 22,
    borderWidth: 1.8,
    borderColor: '#6232B5',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  pupil: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#6232B5',
  },
});
