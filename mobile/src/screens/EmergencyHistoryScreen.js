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
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api/apiClient';
import { AlertRepository, SyncQueueRepository } from '../database';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusCard } from '../components/StatusCard';
import { EMERGENCY_TYPES } from '../utils/constants';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatTimestamp, formatCoordinates } from '../utils/helpers';

/**
 * EmergencyHistoryScreen (Step 5 SQLite Integration)
 *
 * Single source of truth: SQLite database (`alerts` table).
 * Features:
 * - Immediate offline loading of all stored distress records.
 * - Displays source (Local, Bluetooth, Server), sync state, and ack state.
 * - Background synchronization when authenticated and online.
 * - Pull-to-refresh and filtering by source and status.
 * - Database error handling and resilient empty states.
 * - Resolving alerts locally in SQLite and queuing sync items.
 */
export const EmergencyHistoryScreen = ({ navigation }) => {
  const { isAuthenticated } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [serverNotice, setServerNotice] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'local' | 'bluetooth' | 'server'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Resolved'

  // Load alerts directly from local SQLite database
  const loadAlertsFromSQLite = useCallback(async () => {
    try {
      setDbError(null);
      const rows = await AlertRepository.getAlerts({
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        deliveryStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setAlerts(rows || []);
    } catch (err) {
      console.error('[EmergencyHistoryScreen] SQLite load error:', err.message);
      setDbError(`Database Error: ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sourceFilter, statusFilter]);

  // Sync with server if online & authenticated, then refresh SQLite
  const syncWithServerIfPossible = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await apiClient.getAlerts();
      if (res.success && Array.isArray(res.data)) {
        setServerNotice(null);
        // Upsert all fetched server alerts into SQLite
        for (const serverAlert of res.data) {
          await AlertRepository.saveOrUpdateAlert({
            alertId: serverAlert.id,
            senderId: serverAlert.senderId,
            senderName: serverAlert.senderName,
            emergencyType: serverAlert.emergencyType,
            details: serverAlert.details,
            contactDetails: serverAlert.contactDetails,
            latitude: serverAlert.location?.latitude || null,
            longitude: serverAlert.location?.longitude || null,
            source: 'server',
            deliveryStatus: serverAlert.status || 'Pending',
            syncStatus: 'synced',
            createdAt: serverAlert.createdAt,
            updatedAt: serverAlert.updatedAt,
          });
        }
        // Reload from SQLite after sync
        await loadAlertsFromSQLite();
      } else {
        setServerNotice('Viewing local SQLite records (Server unreachable or offline).');
      }
    } catch (err) {
      setServerNotice('Viewing local SQLite records (Network disconnected).');
    }
  }, [isAuthenticated, loadAlertsFromSQLite]);

  // Initial load and filter change trigger
  useEffect(() => {
    loadAlertsFromSQLite();
    syncWithServerIfPossible();
  }, [loadAlertsFromSQLite, syncWithServerIfPossible]);

  // Pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlertsFromSQLite();
    if (isAuthenticated) {
      await syncWithServerIfPossible();
    }
    setIsRefreshing(false);
  };

  // Handle Mark as Resolved
  const handleResolveAlert = (alertItem) => {
    const alertId = alertItem.alertId || alertItem.id;
    Alert.alert(
      'Resolve Emergency Alert',
      `Are you sure you want to mark this ${alertItem.emergencyType} alert as Resolved?\n\nThis will update your local SQLite record and queue a sync update for the server.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Resolved',
          style: 'default',
          onPress: async () => {
            setResolvingId(alertId);

            // 1. Update SQLite locally first
            try {
              await AlertRepository.updateAlertStatus(alertId, 'Resolved');
            } catch (dbErr) {
              console.warn('[History] SQLite update status error:', dbErr.message);
            }

            // 2. Dispatch to server if authenticated or queue in sync outbox
            if (isAuthenticated && alertItem.source !== 'local') {
              try {
                const res = await apiClient.updateAlertStatus(alertId, 'Resolved');
                if (!res.success) {
                  await SyncQueueRepository.enqueue({
                    alertId,
                    operation: 'RESOLVE',
                    payload: { status: 'Resolved' },
                  });
                }
              } catch (e) {
                await SyncQueueRepository.enqueue({
                  alertId,
                  operation: 'RESOLVE',
                  payload: { status: 'Resolved' },
                });
              }
            } else {
              await SyncQueueRepository.enqueue({
                alertId,
                operation: 'RESOLVE',
                payload: { status: 'Resolved' },
              });
            }

            setResolvingId(null);
            await loadAlertsFromSQLite();
            Alert.alert('Status Updated', 'Alert marked as Resolved in SQLite database.');
          },
        },
      ]
    );
  };

  const getCategoryConfig = (typeLabel) => {
    return (
      EMERGENCY_TYPES.find((t) => t.label === typeLabel) || {
        symbol: '🚨',
        color: colors.primary,
      }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Emergency History</Text>
          <Text style={styles.screenSubtitle}>
            Offline SQLite Persistent Emergency Ledger
          </Text>
        </View>

        {/* Database Error State */}
        {dbError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>❌</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>SQLite Database Error</Text>
              <Text style={styles.errorText}>{dbError}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={loadAlertsFromSQLite}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Server Notice (Non-blocking) */}
        {serverNotice ? (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeIcon}>ℹ️</Text>
            <Text style={styles.noticeText}>{serverNotice}</Text>
          </View>
        ) : null}

        {/* Guest Mode Informational Banner */}
        {!isAuthenticated ? (
          <View style={styles.guestNotice}>
            <Text style={styles.guestNoticeText}>
              👤 Guest Mode · Viewing local SQLite storage. Sign in to synchronize with cloud servers.
            </Text>
          </View>
        ) : null}

        {/* Filter Controls */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>FILTER BY SOURCE:</Text>
          <View style={styles.filterRow}>
            {[
              { id: 'ALL', label: 'All Sources' },
              { id: 'local', label: '📱 Local' },
              { id: 'bluetooth', label: '📡 BLE' },
              { id: 'server', label: '☁️ Server' },
            ].map((tab) => {
              const active = sourceFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setSourceFilter(tab.id)}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>STATUS:</Text>
          <View style={styles.filterRow}>
            {['ALL', 'Pending', 'Resolved'].map((st) => {
              const active = statusFilter === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setStatusFilter(st)}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Loading Indicator */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Reading SQLite records...</Text>
          </View>
        ) : null}

        {/* Empty State */}
        {!isLoading && alerts.length === 0 && !dbError ? (
          <EmptyState
            icon="📋"
            badgeText="Zero SQLite Records"
            title="No Emergency Alerts Found"
            description={
              sourceFilter === 'ALL' && statusFilter === 'ALL'
                ? 'No emergency alerts have been stored in local SQLite database yet. Broadcast an SOS or receive alerts over Bluetooth to populate the ledger.'
                : 'No alerts match the selected filter criteria.'
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
              const isResolved = item.deliveryStatus === 'Resolved';
              const isPending = !isResolved;
              const isAcked = item.ackStatus === 'acknowledged';
              const isSynced = item.syncStatus === 'synced';
              const isResolving = resolvingId === (item.alertId || item.id);

              return (
                <View key={item.alertId || item.id} style={[styles.alertCard, shadows.card]}>
                  {/* Card Top: Category and Status Badges */}
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
                        isResolved ? styles.badgeResolved : styles.badgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isResolved ? styles.statusTextResolved : styles.statusTextPending,
                        ]}
                      >
                        {item.deliveryStatus || 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {/* Badges Bar: Source, Ack State, Sync State */}
                  <View style={styles.badgesRow}>
                    {/* Source Badge */}
                    <View
                      style={[
                        styles.tagBadge,
                        item.source === 'local' && styles.tagLocal,
                        item.source === 'bluetooth' && styles.tagBle,
                        item.source === 'server' && styles.tagServer,
                      ]}
                    >
                      <Text style={styles.tagBadgeText}>
                        {item.source === 'local' && '📱 LOCAL DRAFT'}
                        {item.source === 'bluetooth' && '📡 BLE DIRECT'}
                        {item.source === 'server' && '☁️ SERVER SYNCED'}
                      </Text>
                    </View>

                    {/* Ack Badge */}
                    <View
                      style={[
                        styles.tagBadge,
                        isAcked ? styles.tagAcked : styles.tagUnacked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagBadgeText,
                          isAcked ? styles.tagAckedText : styles.tagUnackedText,
                        ]}
                      >
                        {isAcked ? '✅ ACK CONFIRMED' : '⏳ UNACKNOWLEDGED'}
                      </Text>
                    </View>

                    {/* Sync Badge */}
                    <View
                      style={[
                        styles.tagBadge,
                        isSynced ? styles.tagSynced : styles.tagPendingSync,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagBadgeText,
                          isSynced ? styles.tagSyncedText : styles.tagPendingSyncText,
                        ]}
                      >
                        {isSynced ? '🟢 SYNCED' : '🟡 PENDING SYNC'}
                      </Text>
                    </View>
                  </View>

                  {/* Card Body Details */}
                  <View style={styles.cardBody}>
                    {item.details ? (
                      <View style={styles.detailsBlock}>
                        <Text style={styles.detailLabel}>INCIDENT DETAILS</Text>
                        <Text style={styles.detailText}>{item.details}</Text>
                      </View>
                    ) : null}

                    {/* Metadata Table */}
                    <View style={styles.metadataBox}>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaKey}>Sender:</Text>
                        <Text style={styles.metaVal}>{item.senderName || 'Anonymous'}</Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaKey}>Timestamp:</Text>
                        <Text style={styles.metaVal}>{formatTimestamp(item.createdAt)}</Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaKey}>Location:</Text>
                        <Text style={styles.metaVal}>
                          {typeof item.latitude === 'number' && typeof item.longitude === 'number'
                            ? formatCoordinates(item.latitude, item.longitude)
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
                          {item.alertId || item.id}
                        </Text>
                      </View>
                    </View>

                    {/* Action: Mark as Resolved */}
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

        {/* Back to Dashboard */}
        <View style={styles.footerAction}>
          <PrimaryButton
            title="Return to Dashboard"
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  errorText: {
    fontSize: 12,
    color: colors.primaryDark,
    marginTop: 2,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  retryBtnText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: 6,
  },
  noticeIcon: {
    fontSize: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.infoDark,
    fontWeight: '500',
  },
  guestNotice: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  guestNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  filterSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.textInverse,
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
    marginBottom: spacing.xs,
  },
  typeBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardIcon: {
    fontSize: 18,
  },
  cardType: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  badgePending: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  badgeResolved: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: colors.warningDark,
  },
  statusTextResolved: {
    color: colors.successDark,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 6,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  tagLocal: {
    backgroundColor: colors.infoLight,
    borderColor: colors.infoBorder,
  },
  tagBle: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  tagServer: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tagAcked: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  tagAckedText: {
    color: colors.successDark,
  },
  tagUnacked: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  tagUnackedText: {
    color: colors.textTertiary,
  },
  tagSynced: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  tagSyncedText: {
    color: colors.successDark,
  },
  tagPendingSync: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  tagPendingSyncText: {
    color: colors.warningDark,
  },
  cardBody: {
    marginTop: spacing.xs,
  },
  detailsBlock: {
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  detailText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 18,
  },
  metadataBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaKey: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metaVal: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  metaValId: {
    fontSize: 10,
    color: colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxWidth: 200,
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  resolveButton: {
    marginTop: 2,
  },
  footerAction: {
    marginTop: spacing.xl,
  },
});

export default EmergencyHistoryScreen;
