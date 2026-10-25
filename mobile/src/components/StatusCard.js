import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../utils/theme';

/**
 * StatusCard Component
 *
 * Displays a system status item (e.g., Bluetooth, Cellular/Internet, GPS Location)
 * with color-coded visual indicators.
 *
 * @param {string} title - Label for the subsystem (e.g. "Bluetooth Mesh")
 * @param {string} value - Current status text (e.g. "BLE Standby")
 * @param {string} icon - Symbol or emoji representing the status
 * @param {'info' | 'success' | 'warning' | 'danger'} variant - Color scheme variant
 * @param {string} [subtitle] - Optional descriptive note
 */
export const StatusCard = ({
  title,
  value,
  icon = '📡',
  variant = 'info',
  subtitle,
}) => {
  // Determine color palette based on variant
  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: colors.successLight,
          text: colors.successDark,
          dot: colors.success,
          border: colors.successBorder,
        };
      case 'warning':
        return {
          bg: colors.warningLight,
          text: colors.warningDark,
          dot: colors.warning,
          border: colors.warningBorder,
        };
      case 'danger':
        return {
          bg: colors.primaryLight,
          text: colors.primaryDark,
          dot: colors.primary,
          border: colors.primaryBorder,
        };
      case 'info':
      default:
        return {
          bg: colors.infoLight,
          text: colors.infoDark,
          dot: colors.info,
          border: colors.infoBorder,
        };
    }
  };

  const badgeTheme = getBadgeColors();

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
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
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});

export default StatusCard;
