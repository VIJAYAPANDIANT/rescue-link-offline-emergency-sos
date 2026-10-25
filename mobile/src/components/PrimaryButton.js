import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, borderRadius, spacing } from '../utils/theme';

/**
 * PrimaryButton Component
 *
 * Versatile accessible action button supporting emergency danger, primary,
 * secondary, and outlined styles.
 *
 * @param {string} title - Button label text
 * @param {Function} onPress - Press callback handler
 * @param {'danger' | 'primary' | 'secondary' | 'outline'} [variant='primary'] - Style variant
 * @param {boolean} [loading=false] - Whether to show loading spinner
 * @param {boolean} [disabled=false] - Whether the button is disabled
 * @param {string} [icon] - Optional leading emoji or icon
 * @param {object} [style] - Custom container style overrides
 */
export const PrimaryButton = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}) => {
  // Compute variant-specific background and text styling
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          container: {
            backgroundColor: colors.primary,
            borderColor: colors.primaryDark,
          },
          text: { color: colors.textLight },
          spinnerColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.border,
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
          text: { color: colors.textLight },
          spinnerColor: '#FFFFFF',
        };
    }
  };

  const currentVariant = getVariantStyles();

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
      ) : (
        <View style={styles.contentRow}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.text, currentVariant.text]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    borderWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  spinner: {
    paddingVertical: 2,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default PrimaryButton;
