import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../utils/theme';

/**
 * InfoBanner Component
 *
 * Prominent contextual banner for safety disclaimers, permission warnings,
 * and offline status notices.
 */
export const InfoBanner = ({
  variant = 'info', // 'info' | 'warning' | 'danger' | 'success'
  icon,
  title,
  message,
  actionLabel,
  onAction,
  style,
}) => {
  const { colors, isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          bg: isDark ? '#450A0A' : '#FEE2E2',
          border: isDark ? '#B91C1C' : '#FCA5A5',
          text: isDark ? '#FCA5A5' : '#B91C1C',
          defaultIcon: '🚨',
        };
      case 'warning':
        return {
          bg: isDark ? '#451A03' : '#FEF3C7',
          border: isDark ? '#B45309' : '#FDE68A',
          text: isDark ? '#FDE68A' : '#B45309',
          defaultIcon: '⚠️',
        };
      case 'success':
        return {
          bg: isDark ? '#052E16' : '#DCFCE7',
          border: isDark ? '#15803D' : '#86EFAC',
          text: isDark ? '#86EFAC' : '#15803D',
          defaultIcon: '✓',
        };
      case 'info':
      default:
        return {
          bg: isDark ? '#172554' : '#EFF6FF',
          border: isDark ? '#1D4ED8' : '#93C5FD',
          text: isDark ? '#93C5FD' : '#1D4ED8',
          defaultIcon: 'ℹ️',
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: vStyle.bg,
          borderColor: vStyle.border,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${title || ''}: ${message || ''}`}
    >
      <View style={styles.contentRow}>
        <Text style={styles.icon}>{icon || vStyle.defaultIcon}</Text>
        <View style={styles.textColumn}>
          {title ? (
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: vStyle.border }]}
          activeOpacity={0.8}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionText, { color: vStyle.text }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.sm,
    marginTop: 1,
  },
  textColumn: {
    flex: 1,
  },
  title: {
    ...typography.cardTitle,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    ...typography.bodySmall,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
  },
});

export default InfoBanner;
