import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../utils/theme';

/**
 * StatusBadge Component
 *
 * Emergency-grade visual status badge.
 * RULE: Never use color alone to convey state. Every badge contains:
 * 1. An explicit glyph/icon
 * 2. A clear textual label
 * 3. High-contrast WCAG 2.1 AA background/border/text
 *
 * @param {string} type - 'delivery' | 'ack' | 'sync' | 'source' | 'category' | 'generic'
 * @param {string} value - Status string (e.g. 'synced', 'acknowledged', 'medical', etc.)
 * @param {string} [label] - Optional custom label
 * @param {string} [size] - 'sm' | 'md'
 */
export const StatusBadge = ({
  type = 'generic',
  value = '',
  label,
  size = 'md',
  style,
}) => {
  const { colors, isDark } = useTheme();

  const getBadgeConfig = () => {
    const val = (value || '').toLowerCase();

    // 1. Sync Status
    if (type === 'sync' || val.includes('sync')) {
      if (val === 'synced' || val === 'cloud_synced') {
        return {
          icon: '☁️',
          text: label || 'Cloud Synced',
          bg: isDark ? '#052E16' : '#DCFCE7',
          border: isDark ? '#15803D' : '#86EFAC',
          color: isDark ? '#4ADE80' : '#15803D',
        };
      }
      if (val === 'pending_sync' || val === 'queued' || val === 'outbox') {
        return {
          icon: '⏳',
          text: label || 'Pending Sync',
          bg: isDark ? '#451A03' : '#FEF3C7',
          border: isDark ? '#B45309' : '#FDE68A',
          color: isDark ? '#FBBF24' : '#B45309',
        };
      }
      if (val === 'failed') {
        return {
          icon: '✕',
          text: label || 'Sync Failed',
          bg: isDark ? '#450A0A' : '#FEE2E2',
          border: isDark ? '#B91C1C' : '#FCA5A5',
          color: isDark ? '#F87171' : '#B91C1C',
        };
      }
    }

    // 2. Acknowledgment Status
    if (type === 'ack' || val.includes('ack')) {
      if (val === 'acknowledged') {
        return {
          icon: '🤝',
          text: label || 'Peer Confirmed',
          bg: isDark ? '#172554' : '#EFF6FF',
          border: isDark ? '#1D4ED8' : '#93C5FD',
          color: isDark ? '#60A5FA' : '#1D4ED8',
        };
      }
      return {
        icon: '○',
        text: label || 'Unconfirmed',
        bg: isDark ? '#1E293B' : '#F1F5F9',
        border: isDark ? '#334155' : '#CBD5E1',
        color: isDark ? '#94A3B8' : '#64748B',
      };
    }

    // 3. Delivery / Broadcast Status
    if (type === 'delivery') {
      if (val === 'sent' || val === 'delivered' || val === 'confirmed') {
        return {
          icon: '✓',
          text: label || 'Delivered',
          bg: isDark ? '#052E16' : '#DCFCE7',
          border: isDark ? '#15803D' : '#86EFAC',
          color: isDark ? '#4ADE80' : '#15803D',
        };
      }
      if (val === 'broadcasting' || val === 'advertising') {
        return {
          icon: '📡',
          text: label || 'BLE Broadcasting',
          bg: isDark ? '#172554' : '#EFF6FF',
          border: isDark ? '#1D4ED8' : '#93C5FD',
          color: isDark ? '#60A5FA' : '#1D4ED8',
        };
      }
      if (val === 'pending') {
        return {
          icon: '⏳',
          text: label || 'Saved Locally',
          bg: isDark ? '#1E293B' : '#F1F5F9',
          border: isDark ? '#334155' : '#CBD5E1',
          color: isDark ? '#CBD5E1' : '#475569',
        };
      }
    }

    // 4. Source (Local vs Relay vs Server)
    if (type === 'source') {
      if (val === 'local') {
        return {
          icon: '📱',
          text: label || 'Originator (This Device)',
          bg: isDark ? '#1E293B' : '#F8FAFC',
          border: isDark ? '#334155' : '#CBD5E1',
          color: isDark ? '#F1F5F9' : '#1E293B',
        };
      }
      if (val === 'bluetooth_relay' || val === 'relayed') {
        return {
          icon: '📡',
          text: label || 'Mesh Relay Hop',
          bg: isDark ? '#3B0764' : '#FAF5FF',
          border: isDark ? '#7E22CE' : '#E9D5FF',
          color: isDark ? '#C084FC' : '#7E22CE',
        };
      }
    }

    // 5. Emergency Category
    if (type === 'category') {
      if (val.includes('medical')) {
        return {
          icon: '🏥',
          text: label || 'Medical Emergency',
          bg: isDark ? '#450A0A' : '#FEE2E2',
          border: isDark ? '#B91C1C' : '#FCA5A5',
          color: isDark ? '#F87171' : '#B91C1C',
        };
      }
      if (val.includes('fire')) {
        return {
          icon: '🔥',
          text: label || 'Fire Danger',
          bg: isDark ? '#451A03' : '#FFEDD5',
          border: isDark ? '#C2410C' : '#FDBA74',
          color: isDark ? '#FB923C' : '#C2410C',
        };
      }
      if (val.includes('accident')) {
        return {
          icon: '⚠️',
          text: label || 'Accident',
          bg: isDark ? '#451A03' : '#FEF3C7',
          border: isDark ? '#B45309' : '#FDE68A',
          color: isDark ? '#FBBF24' : '#B45309',
        };
      }
      if (val.includes('safety') || val.includes('personal')) {
        return {
          icon: '🛡️',
          text: label || 'Personal Safety',
          bg: isDark ? '#3B0764' : '#F3E8FF',
          border: isDark ? '#7E22CE' : '#D8B4FE',
          color: isDark ? '#C084FC' : '#7E22CE',
        };
      }
      if (val.includes('drill') || val.includes('test')) {
        return {
          icon: '🧪',
          text: label || 'Test / Drill',
          bg: isDark ? '#172554' : '#EFF6FF',
          border: isDark ? '#1D4ED8' : '#93C5FD',
          color: isDark ? '#60A5FA' : '#1D4ED8',
        };
      }
    }

    // Fallback Generic Badge
    return {
      icon: '•',
      text: label || value || 'Unknown',
      bg: isDark ? '#1E293B' : '#F1F5F9',
      border: isDark ? '#334155' : '#E2E8F0',
      color: isDark ? '#CBD5E1' : '#475569',
    };
  };

  const config = getBadgeConfig();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 2 : spacing.xs,
          paddingHorizontal: isSmall ? spacing.xs + 2 : spacing.sm,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${type} status: ${config.text}`}
    >
      <Text style={[styles.icon, isSmall && styles.iconSmall]}>{config.icon}</Text>
      <Text
        style={[
          styles.label,
          { color: config.color },
          isSmall && styles.labelSmall,
        ]}
        numberOfLines={1}
      >
        {config.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 12,
    marginRight: 4,
  },
  iconSmall: {
    fontSize: 10,
    marginRight: 3,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
  labelSmall: {
    fontSize: 10,
    lineHeight: 12,
  },
});

export default StatusBadge;
