import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EMERGENCY_TYPES } from '../utils/constants';
import { colors, borderRadius, spacing } from '../utils/theme';

/**
 * EmergencyTypeSelector Component
 *
 * Allows users in crisis to rapidly identify and select their emergency category.
 * Each item has an icon, high-contrast label, and distinctive active state.
 *
 * @param {string} selectedType - Currently selected emergency type ID
 * @param {Function} onSelectType - Callback invoked when a type is pressed
 */
export const EmergencyTypeSelector = ({ selectedType, onSelectType }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>SELECT EMERGENCY TYPE *</Text>
      <View style={styles.grid}>
        {EMERGENCY_TYPES.map((type) => {
          const isSelected = selectedType === type.id;

          return (
            <TouchableOpacity
              key={type.id}
              activeOpacity={0.8}
              onPress={() => onSelectType(type.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${type.label}. ${type.description}`}
              style={[
                styles.itemCard,
                isSelected && styles.itemCardSelected,
                isSelected && { borderColor: type.color },
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isSelected ? type.bgColor : colors.surfaceSubtle },
                ]}
              >
                <Text style={styles.itemIcon}>{type.symbol}</Text>
              </View>

              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.itemLabel,
                    isSelected && { color: type.color, fontWeight: '700' },
                  ]}
                >
                  {type.label}
                </Text>
                <Text numberOfLines={2} style={styles.itemDescription}>
                  {type.description}
                </Text>
              </View>

              {/* Radio indicator */}
              <View
                style={[
                  styles.radioOuter,
                  isSelected && { borderColor: type.color },
                ]}
              >
                {isSelected && (
                  <View style={[styles.radioInner, { backgroundColor: type.color }]} />
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
    fontWeight: '700',
    color: colors.textSecondary,
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
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  itemCardSelected: {
    backgroundColor: '#FFFDFD',
    borderWidth: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemIcon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default EmergencyTypeSelector;
