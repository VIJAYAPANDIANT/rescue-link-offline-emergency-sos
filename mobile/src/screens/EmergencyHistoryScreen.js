import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api/apiClient';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { EMERGENCY_TYPES } from '../utils/constants';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

/**
 * EmergencyHistoryScreen
 *
 * Displays authenticated user's emergency distress alerts fetched from GET /api/alerts.
 * Supports:
 * - Real-time alert list loading and pull-to-refresh
 * - Filtering by status (All, Pending, Resolved)
 * - Viewing alert details and attached coordinates
 * - Resolving active alerts via PATCH /api/alerts/:id/status
 * - Clear error states when backend is unreachable
 */
export const EmergencyHistoryScreen = ({ navigation }) => {
  const { isAuthenticated } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Resolved'
  const [resolvingId, setResolvingId] = useState(null);

  // Fetch alerts from backend
  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setErrorMessage(null);

    const filter = activeFilter !== 'ALL' ? { status: activeFilter } : {};
    const res = await apiClient.getAlerts(filter);

    setIsLoading(false);

    if (res.success) {
      setAlerts(res.data || []);
    } else {
      setErrorMessage(
        res.error || 'Unable to retrieve alerts from RescueLink server. Please check your connection.'
      );
    }
  }, [isAuthenticated, activeFilter]);

  // Load alerts on mount and when filter changes
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle Mark as Resolved
  const handleResolveAlert = (alertItem) => {
    Alert.alert(
      'Resolve Emergency Alert',
      `Are you sure you want to mark this ${alertItem.emergencyType} alert as Resolved?\n\nThis will update your incident status in the backend registry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Resolved',
          style: 'default',
          onPress: async () => {
            setResolvingId(alertItem.id);
            const res = await apiClient.updateAlertStatus(alertItem.id, 'Resolved');
            setResolvingId(null);

            if (res.success) {
              // Update item in local list
              setAlerts((prev) =>
                prev.map((a) => (a.id === alertItem.id ? res.data : a))
              );
              Alert.alert('Status Updated', 'Alert marked as Resolved successfully.');
            } else {
              Alert.alert('Update Failed', res.error || 'Failed to update alert status.');
            }
          },
        },
      ]
    );
  };

  // Helper to find category icon
  const getCategoryConfig = (typeLabel) => {
    return EMERGENCY_TYPES.find((t) => t.label === typeLabel) || {
      symbol: '🚨',
      color: colors.primary,
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Emergency History</Text>
          <Text style={styles.screenSubtitle}>
            Authenticated ledger of emergency distress dispatches
          </Text>
        </View>

        {/* Guest Mode Check */}
        {!isAuthenticated ? (
          <View style={styles.guestContainer}>
            <EmptyState
              icon="🔒"
              badgeText="Authentication Required"
              title="Sign In to View History"
              description="Emergency alert records are securely bound to authenticated responder accounts. Please sign in to access your distress log."
              actionLabel="Sign In"
              onAction={() => navigation.navigate('Login')}
            />
          </View>
        ) : (
          <>
            {/* Status Filter Tabs & Refresh Bar */}
            <View style={styles.controlsBar}>
              <View style={styles.filterPills}>
                {['ALL', 'Pending', 'Resolved'].map((tab) => {
                  const isActive = activeFilter === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setActiveFilter(tab)}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={fetchAlerts}
                disabled={isLoading}
              >
                <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Backend Connection Error</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchAlerts}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Loading Indicator */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching emergency records...</Text>
              </View>
            ) : null}

            {/* Alert List or Empty State */}
            {!isLoading && !errorMessage && alerts.length === 0 ? (
              <EmptyState
                icon="📋"
                badgeText="Zero Records Found"
                title="No Emergency Alerts Recorded"
                description={
                  activeFilter === 'ALL'
                    ? 'You have not submitted any emergency alerts yet. Active distress dispatches will appear here.'
                    : `No alerts found with status "${activeFilter}".`
                }
                actionLabel="Send an SOS Alert"
                onAction={() => navigation.navigate('SendSOS')}
              />
            ) : null}

            {/* Alerts List */}
            {!isLoading && alerts.length > 0 ? (
              <View style={styles.alertsList}>
                {alerts.map((item) => {
                  const catConfig = getCategoryConfig(item.emergencyType);
                  const isPending = item.status === 'Pending';
                  const isResolving = resolvingId === item.id;

                  return (
                    <View key={item.id} style={[styles.alertCard, shadows.card]}>
                      {/* Card Header */}
                      <View style={styles.cardHeader}>
                        <View style={styles.typeBadgeGroup}>
                          <Text style={styles.cardIcon}>{catConfig.symbol}</Text>
                          <Text
                            style={[
                              styles.cardType,
                              { color: catConfig.color || colors.textPrimary },
                            ]}
                          >
                            {item.emergencyType}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            isPending ? styles.badgePending : styles.badgeResolved,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              isPending
                                ? styles.statusTextPending
                                : styles.statusTextResolved,
                            ]}
                          >
                            {item.status}
                          </Text>
                        </View>
                      </View>

                      {/* Card Details */}
                      <View style={styles.cardBody}>
                        <Text style={styles.detailLabel}>INCIDENT DETAILS</Text>
                        <Text style={styles.detailText}>
                          {item.details || 'No additional situational details provided.'}
                        </Text>

                        {/* Metadata Box */}
                        <View style={styles.metadataBox}>
                          <View style={styles.metaRow}>
                            <Text style={styles.metaKey}>Sender:</Text>
                            <Text style={styles.metaVal}>{item.senderName}</Text>
                          </View>

                          <View style={styles.metaRow}>
                            <Text style={styles.metaKey}>Dispatched:</Text>
                            <Text style={styles.metaVal}>
                              {formatTimestamp(item.createdAt)}
                            </Text>
                          </View>

                          <View style={styles.metaRow}>
                            <Text style={styles.metaKey}>Location:</Text>
                            <Text style={styles.metaVal}>
                              {item.location
                                ? `${item.location.latitude.toFixed(4)}° N, ${item.location.longitude.toFixed(4)}° E`
                                : 'None attached'}
                            </Text>
                          </View>

                          {item.contactDetails ? (
                            <View style={styles.metaRow}>
                              <Text style={styles.metaKey}>Contact:</Text>
                              <Text style={styles.metaVal}>{item.contactDetails}</Text>
                            </View>
                          ) : null}

                          <View style={styles.metaRow}>
                            <Text style={styles.metaKey}>Alert ID:</Text>
                            <Text style={styles.metaValId} numberOfLines={1}>
                              {item.id}
                            </Text>
                          </View>
                        </View>

                        {/* Action: Mark as Resolved (only for pending alerts) */}
                        {isPending ? (
                          <View style={styles.actionRow}>
                            <PrimaryButton
                              title={isResolving ? 'Resolving...' : 'Mark as Resolved'}
                              onPress={() => handleResolveAlert(item)}
                              variant="outline"
                              loading={isResolving}
                              disabled={isResolving}
                              style={styles.resolveButton}
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        )}

        {/* Back to Dashboard Button */}
        <View style={styles.footerAction}>
          <PrimaryButton
            title="Back to Dashboard"
            onPress={() => navigation.navigate('Home')}
            variant="outline"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? spacing.xl : spacing.md,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  guestContainer: {
    marginVertical: spacing.md,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  filterPills: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  refreshBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.info,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  errorIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  errorText: {
    fontSize: 11,
    color: colors.primaryDark,
    lineHeight: 15,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.textSecondary,
  },
  alertsList: {
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  typeBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  cardType: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  badgeResolved: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextPending: {
    color: colors.warningDark,
  },
  statusTextResolved: {
    color: colors.successDark,
  },
  cardBody: {
    paddingTop: spacing.sm,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  metadataBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaKey: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaValId: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxWidth: 180,
  },
  actionRow: {
    marginTop: spacing.sm,
  },
  resolveButton: {
    height: 42,
  },
  footerAction: {
    marginTop: spacing.lg,
  },
});

export default EmergencyHistoryScreen;
