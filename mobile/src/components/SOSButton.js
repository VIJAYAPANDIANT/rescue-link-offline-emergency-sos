import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shadows, borderRadius } from '../utils/theme';

/**
 * SOSButton Component
 *
 * Prominent circular emergency trigger button designed with:
 * 1. Animated glowing pulse ring to capture attention in high-stress situations.
 * 2. High-contrast typography on emergency crimson red (or cobalt blue for test mode).
 * 3. Clearly labeled TEST MODE distinction so drills are never confused with real emergencies.
 * 4. Screen-reader accessible with large touch target.
 */
export const SOSButton = ({
  onPress,
  title = 'SOS',
  subtitle = 'TAP FOR EMERGENCY',
  disabled = false,
  testMode = false,
  size = 200,
}) => {
  const { colors, isDark } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
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

  const buttonBg = testMode ? colors.info : colors.primary;
  const ringBg = testMode ? (isDark ? '#172554' : '#EFF6FF') : (isDark ? '#450A0A' : '#FEE2E2');
  const ringBorder = testMode ? colors.infoBorder : colors.primaryBorder;

  return (
    <View style={styles.container}>
      {/* Outer pulsing glow ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            backgroundColor: buttonBg,
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
        accessibilityLabel={
          testMode
            ? 'Test Mode SOS button. Tap to start simulation drill.'
            : 'Emergency SOS button. Tap to start emergency report.'
        }
        accessibilityHint="Navigates to emergency confirmation screen"
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: buttonBg,
          },
          shadows.sosGlow,
        ]}
      >
        <View
          style={[
            styles.innerRing,
            {
              width: size - 24,
              height: size - 24,
              borderRadius: (size - 24) / 2,
              backgroundColor: ringBg,
              borderColor: ringBorder,
            },
          ]}
        >
          {testMode ? (
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>DRILL MODE</Text>
            </View>
          ) : null}

          <Text style={styles.icon}>{testMode ? '🧪' : '🚨'}</Text>
          <Text style={[styles.title, { color: testMode ? colors.infoDark : colors.primaryDark }]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: testMode ? colors.infoDark : colors.primaryDark }]}>
            {subtitle}
          </Text>
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
    height: 250,
  },
  pulseRing: {
    position: 'absolute',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    padding: 12,
  },
  testBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  testBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 32,
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default SOSButton;
