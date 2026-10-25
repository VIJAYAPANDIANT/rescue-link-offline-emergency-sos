import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { colors, shadows } from '../utils/theme';

/**
 * SOSButton Component
 *
 * Prominent circular emergency trigger button designed with:
 * 1. Animated glowing pulse ring to capture attention in high-stress situations.
 * 2. High-contrast white typography on emergency crimson red.
 * 3. Tactile touch feedback and accessible hit area.
 *
 * @param {Function} onPress - Callback invoked when SOS button is pressed
 * @param {string} title - Label shown inside the button (defaults to 'SOS')
 * @param {string} subtitle - Secondary helper text (defaults to 'TAP FOR EMERGENCY')
 * @param {boolean} disabled - Whether the button is interactable
 */
export const SOSButton = ({
  onPress,
  title = 'SOS',
  subtitle = 'TAP FOR EMERGENCY',
  disabled = false,
}) => {
  // Animated value for pulsing scale and fade ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Continuous breathing/pulsing animation loop
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.15,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.6,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [pulseAnim, pulseOpacity]);

  return (
    <View style={styles.container}>
      {/* Outer pulsing glow ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* Main SOS Circular Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS button. Tap to start emergency report."
        accessibilityHint="Navigates to the Send SOS screen"
        style={[styles.button, shadows.sosGlow]}
      >
        <View style={styles.innerRing}>
          <Text style={styles.icon}>🚨</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    width: 220,
    height: 220,
    alignSelf: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  button: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  icon: {
    fontSize: 28,
    marginBottom: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FEE2E2',
    letterSpacing: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default SOSButton;
