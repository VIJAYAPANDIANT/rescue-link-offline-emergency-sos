import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, borderRadius, spacing } from '../utils/theme';
import PrimaryButton from './PrimaryButton';

/**
 * EmptyState Component
 *
 * Friendly empty state display for screens with no items (Nearby Devices, History).
 * Avoids dead ends and guides user expectations.
 *
 * @param {string} icon - Symbol / emoji illustration
 * @param {string} title - Main heading for the empty state
 * @param {string} description - Explanation of why the state is empty
 * @param {string} [actionLabel] - Optional button label
 * @param {Function} [onAction] - Optional button press callback
 * @param {string} [badgeText] - Optional status badge (e.g. "Step 3 Planned")
 */
export const EmptyState = ({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  badgeText,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {badgeText ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      ) : null}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {actionLabel && onAction ? (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.actionButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginVertical: spacing.lg,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  badge: {
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.infoDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
  actionButton: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
});

export default EmptyState;
