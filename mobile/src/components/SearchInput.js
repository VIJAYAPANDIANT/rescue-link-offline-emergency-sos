import React from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../utils/theme';

/**
 * SearchInput Component
 *
 * Accessible search bar with filter glyph and tap-to-clear button.
 */
export const SearchInput = ({
  value = '',
  onChangeText,
  onClear,
  placeholder = 'Search incidents, UUID, or survivor...',
  style,
  autoCapitalize = 'none',
  autoCorrect = false,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surfaceSubtle : colors.cardBackground,
          borderColor: colors.borderDark,
        },
        style,
      ]}
      accessibilityRole="search"
    >
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={[
          styles.input,
          { color: colors.textPrimary },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        accessibilityLabel={placeholder}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            if (onClear) onClear();
            else if (onChangeText) onChangeText('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
        >
          <Text style={[styles.clearIcon, { color: colors.textMuted }]}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default SearchInput;
