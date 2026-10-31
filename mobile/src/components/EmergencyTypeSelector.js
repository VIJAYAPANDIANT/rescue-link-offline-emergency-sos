import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EMERGENCY_TYPES } from '../utils/constants';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing, typography } from '../utils/theme';

/**
 * EmergencyTypeSelector Component
 *
 * Allows users in crisis to rapidly identify and select their emergency category.
 * Each item has an icon, high-contrast label, distinctive active state,
 * and a prominent notice when selecting Test / Drill mode.
 */
export const EmergencyTypeSelector = ({ selectedType, onSelectType }) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        SELECT EMERGENCY CATEGORY *
      </Text>
      <View style={styles.grid}>
        {EMERGENCY_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          const isDrill = type.id === 'test' || type.label.toLowerCase().includes('drill');

          const activeBorder = isDrill ? colors.info : (type.color || colors.primary);
          const activeBg = isDrill
            ? (isDark ? '#172554' : '#EFF6FF')
            : (isDark ? '#1E293B' : colors.cardBackground);

          return (
            <TouchableOpacity
              key={type.id}
              activeOpacity={0.8}
              onPress={() => onSelectType(type.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${type.label}. ${type.description}${isDrill ? '. Non-emergency simulation drill.' : ''}`}
              style={[
                styles.itemCard,
                {
                  backgroundColor: isSelected ? activeBg : colors.cardBackground,
                  borderColor: isSelected ? activeBorder : colors.border,
                },
                isSelected && styles.itemCardSelected,
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isSelected
                      ? (isDrill ? '#3B82F6' : (type.color || colors.primary))
                      : colors.surfaceSubtle,
                  },
                ]}
              >
                <Text style={styles.itemIcon}>{type.symbol}</Text>
              </View>

              <View style={styles.textContainer}>
                <View style={styles.labelRow}>
                  <Text
                    style={[
                      styles.itemLabel,
                      { color: isSelected ? activeBorder : colors.textPrimary },
                      isSelected && { fontWeight: '800' },
                    ]}
                  >
                    {type.label}
                  </Text>
                  {isDrill ? (
                    <View style={[styles.drillBadge, { backgroundColor: colors.infoLight, borderColor: colors.infoBorder }]}>
                      <Text style={[styles.drillBadgeText, { color: colors.infoDark }]}>DRILL</Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  numberOfLines={2}
                  style={[styles.itemDescription, { color: colors.textSecondary }]}
                >
                  {type.description}
                </Text>
              </View>

              {/* Radio indicator */}
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: isSelected ? activeBorder : colors.borderDark },
                ]}
              >
                {isSelected && (
                  <View style={[styles.radioInner, { backgroundColor: activeBorder }]} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    minHeight: 64,
  },
  itemCardSelected: {
    borderWidth: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemIcon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  itemLabel: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  drillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  drillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemDescription: {
    ...typography.bodySmall,
    lineHeight: 16,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default EmergencyTypeSelector;
