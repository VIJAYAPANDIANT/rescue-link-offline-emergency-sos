import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shadows, borderRadius, spacing, typography } from '../utils/theme';

/**
 * StatusCard Component
 *
 * Displays a system status item (e.g., Bluetooth, Connectivity, GPS Location, Outbox Sync)
 * with accessible icon glyphs, text status pills, and optional action buttons.
 */
export const StatusCard = ({
  title,
  value,
  icon = '📡',
  variant = 'info', // 'info' | 'success' | 'warning' | 'danger'
  subtitle,
  actionLabel,
  onAction,
  style,
}) => {
  const { colors, isDark } = useTheme();

  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: isDark ? '#052E16' : '#DCFCE7',
          text: isDark ? '#4ADE80' : '#15803D',
          dot: colors.success,
          border: isDark ? '#15803D' : '#86EFAC',
        };
      case 'warning':
        return {
          bg: isDark ? '#451A03' : '#FEF3C7',
          text: isDark ? '#FBBF24' : '#B45309',
          dot: colors.warning,
          border: isDark ? '#B45309' : '#FDE68A',
        };
      case 'danger':
        return {
          bg: isDark ? '#450A0A' : '#FEE2E2',
          text: isDark ? '#F87171' : '#B91C1C',
          dot: colors.primary,
          border: isDark ? '#B91C1C' : '#FCA5A5',
        };
      case 'info':
      default:
        return {
          bg: isDark ? '#172554' : '#EFF6FF',
          text: isDark ? '#60A5FA' : '#1D4ED8',
          dot: colors.info,
          border: isDark ? '#1D4ED8' : '#93C5FD',
        };
    }
  };

  const badgeTheme = getBadgeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
        shadows.card,
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}: ${value}. ${subtitle || ''}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        </View>

        {/* Status Pill Badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: badgeTheme.bg,
              borderColor: badgeTheme.border,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: badgeTheme.dot }]} />
          <Text style={[styles.badgeText, { color: badgeTheme.text }]}>
            {value}
          </Text>
        </View>
      </View>

      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              borderColor: colors.borderDark,
              backgroundColor: isDark ? colors.surfaceSubtle : colors.surfaceSubtle,
            },
          ]}
          activeOpacity={0.8}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionBtnText, { color: colors.infoDark || colors.info }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs - 1,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: 2,
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
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },
});

export default StatusCard;
