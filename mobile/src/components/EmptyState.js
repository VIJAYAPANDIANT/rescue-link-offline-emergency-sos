import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing, typography } from '../utils/theme';
import PrimaryButton from './PrimaryButton';

/**
 * EmptyState Component
 *
 * Professional empty state display for screens with no items (Nearby Devices, History, Outbox).
 * Avoids dead ends and guides user expectations.
 */
export const EmptyState = ({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  badgeText,
  style,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${description}`}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: isDark ? colors.surfaceSubtle : colors.surfaceSubtle },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {badgeText ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isDark ? '#172554' : colors.infoLight,
              borderColor: isDark ? '#1D4ED8' : colors.infoBorder,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: isDark ? '#60A5FA' : colors.infoDark }]}>
            {badgeText}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>

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
    padding: spacing.xl,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 30,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    ...typography.cardTitle,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  actionButton: {
    marginTop: spacing.md,
    minWidth: 140,
  },
});

export default EmptyState;
