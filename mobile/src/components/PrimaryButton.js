import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing, typography } from '../utils/theme';

/**
 * PrimaryButton Component
 *
 * Emergency-grade action button supporting multiple visual variants,
 * loading states, leading icons, and full accessible touch target sizing (min 48dp).
 */
export const PrimaryButton = ({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'danger' | 'success' | 'warning' | 'secondary' | 'outline' | 'navy'
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  size = 'md', // 'sm' | 'md' | 'lg'
}) => {
  const { colors, isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          container: {
            backgroundColor: colors.primary,
            borderColor: colors.primaryDark,
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
      case 'success':
        return {
          container: {
            backgroundColor: colors.success,
            borderColor: colors.successDark,
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
      case 'warning':
        return {
          container: {
            backgroundColor: colors.warning,
            borderColor: colors.warningDark,
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
      case 'navy':
        return {
          container: {
            backgroundColor: colors.navyDark || '#0B1120',
            borderColor: colors.navy || '#1E293B',
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.borderDark,
            borderWidth: 1,
          },
          text: { color: colors.textPrimary },
          spinnerColor: colors.textPrimary,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: colors.borderDark,
            borderWidth: 1.5,
          },
          text: { color: colors.textPrimary },
          spinnerColor: colors.textPrimary,
        };
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: colors.info,
            borderColor: colors.infoDark,
          },
          text: { color: '#FFFFFF' },
          spinnerColor: '#FFFFFF',
        };
    }
  };

  const currentVariant = getVariantStyles();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          minHeight: 40,
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.md,
          fontSize: 13,
        };
      case 'lg':
        return {
          minHeight: 56,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          fontSize: 17,
        };
      case 'md':
      default:
        return {
          minHeight: 48,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          fontSize: 15,
        };
    }
  };

  const sizeStyle = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.button,
        currentVariant.container,
        {
          minHeight: sizeStyle.minHeight,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
        },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={currentVariant.spinnerColor}
          style={styles.spinner}
        />
      ) : null}

      {!loading && icon ? (
        <Text style={styles.icon}>{icon}</Text>
      ) : null}

      <Text
        style={[
          styles.text,
          currentVariant.text,
          { fontSize: sizeStyle.fontSize },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.buttonText,
    textAlign: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  spinner: {
    marginRight: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PrimaryButton;
