import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { syncService } from '../services/sync/syncService';
import { AlertRepository, SyncQueueRepository, RelayRepository } from '../database';
import { relayService } from '../services/relay/relayService';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusBadge } from '../components/StatusBadge';
import { SearchInput } from '../components/SearchInput';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

/**
 * EmergencyHistoryScreen (Alert Ledger & Incident Triage)
 *
 * Professional incident history and audit center:
 * - Search by keyword, survivor name, or UUID
 * - Multi-criteria filtering (All, Active, Local, Relayed, Acknowledged, Synced)
 * - Separated badges for Delivery, Acknowledgment, and Cloud Sync
 * - Incident Technical Audit Modal
 * - One-tap Manual Cloud Sync
 */
export const EmergencyHistoryScreen = ({ navigation }) => {
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();

  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'LOCAL' | 'RELAY' | 'ACK' | 'SYNCED'

  // Selected Alert for Detailed Audit Modal
  const [selectedAuditAlert, setSelectedAuditAlert] = useState(null);
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [isResolving, setIsResolving] = useState(false);

  // Load stored alerts from local SQLite WAL database
  const loadAlertsFromSQLite = useCallback(async () => {
    try {
      const rows = await AlertRepository.getAllAlerts(1, 100);
      setAlerts(rows || []);

      const pending = await SyncQueueRepository.getPendingCount();
      setPendingSyncCount(pending);
    } catch (err) {
      console.warn('[EmergencyHistoryScreen] SQLite load error:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlertsFromSQLite();

    const unsubscribeSync = syncService.addSyncListener(() => {
      loadAlertsFromSQLite();
    });

    const unsubscribeFocus = navigation.addListener
      ? navigation.addListener('focus', loadAlertsFromSQLite)
      : null;

    return () => {
      unsubscribeSync();
      if (unsubscribeFocus) unsubscribeFocus();
    };
  }, [navigation, loadAlertsFromSQLite]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAlertsFromSQLite();
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncService.triggerSync();
      await loadAlertsFromSQLite();
    } catch {
      // Ignored
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter alerts according to search and active tab
  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      // 1. Text Search Match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.alertId || item.id || '').toLowerCase().includes(q) ||
        (item.emergencyType || '').toLowerCase().includes(q) ||
        (item.senderName || '').toLowerCase().includes(q) ||
        (item.details || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Tab Filter Match
      switch (activeFilter) {
        case 'ACTIVE':
          return (item.deliveryStatus || '').toLowerCase() !== 'resolved';
        case 'LOCAL':
          return (item.source || '').toLowerCase() === 'local';
        case 'RELAY':
          return (item.source || '').toLowerCase().includes('relay');
        case 'ACK':
          return (item.ackStatus || '').toLowerCase() === 'acknowledged';
        case 'SYNCED':
          return (item.syncStatus || '').toLowerCase() === 'synced';
        case 'ALL':
        default:
          return true;
      }
    });
  }, [alerts, searchQuery, activeFilter]);

  // Resolve Alert Action
  const handleConfirmResolve = async () => {
    if (!resolvingAlert) return;
    const alertId = resolvingAlert.alertId || resolvingAlert.id;
    setIsResolving(true);

    try {
      await AlertRepository.updateAlertStatus(alertId, 'resolved');
      await SyncQueueRepository.enqueue({
        alertId,
        operation: 'RESOLVE',
        payload: { status: 'resolved' },
      });
      setResolvingAlert(null);
      await loadAlertsFromSQLite();
      Alert.alert('✓ Incident Cleared', 'Alert marked as resolved locally and enqueued for cloud sync.');
    } catch (e) {
      Alert.alert('Resolution Error', e.message);
    } finally {
      setIsResolving(false);
    }
  };

  const filterTabs = [
    { key: 'ALL', label: 'All Alerts' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'LOCAL', label: 'Local' },
    { key: 'RELAY', label: 'Mesh Relay' },
    { key: 'ACK', label: 'Confirmed' },
    { key: 'SYNCED', label: 'Synced' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
                Alert Ledger & History
              </Text>
              <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                Durable offline SQLite storage ({alerts.length} records)
              </Text>
            </View>

            {pendingSyncCount > 0 ? (
              <TouchableOpacity
                style={[
                  styles.syncBadgeBtn,
                  {
                    backgroundColor: isDark ? '#451A03' : '#FEF3C7',
                    borderColor: isDark ? '#B45309' : '#FDE68A',
                  },
                ]}
                activeOpacity={0.8}
                onPress={handleManualSync}
                accessibilityRole="button"
                accessibilityLabel={`Sync now. ${pendingSyncCount} pending items in outbox`}
              >
                <Text style={[styles.syncBadgeText, { color: isDark ? '#FBBF24' : '#B45309' }]}>
                  {isSyncing ? 'Syncing...' : `Sync Now (${pendingSyncCount})`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search category, UUID, survivor..."
          />
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsContainer}
        >
          {filterTabs.map((tab) => {
            const isSelected = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isSelected
                      ? colors.navyDark
                      : (isDark ? colors.surfaceSubtle : colors.cardBackground),
                    borderColor: isSelected ? colors.navy : colors.borderDark,
                  },
                ]}
                onPress={() => setActiveFilter(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${tab.label} filter`}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Alert Cards List */}
        {filteredAlerts.length > 0 ? (
          <View style={styles.alertsList}>
            {filteredAlerts.map((item) => {
              const alertId = item.alertId || item.id;
              const isResolved = (item.deliveryStatus || '').toLowerCase() === 'resolved';

              return (
                <View
                  key={alertId}
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                    },
                    shadows.card,
                  ]}
                >
                  {/* Card Header: Category & Timestamp */}
                  <View style={styles.cardHeader}>
                    <StatusBadge type="category" value={item.emergencyType} size="sm" />
                    <Text style={[styles.timestampText, { color: colors.textMuted }]}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>

                  {/* Survivor & Source Information */}
                  <View style={styles.senderRow}>
                    <Text style={[styles.senderName, { color: colors.textPrimary }]}>
                      {item.senderName || 'Anonymous Survivor'}
                    </Text>
                    <StatusBadge
                      type="source"
                      value={item.source || 'local'}
                      size="sm"
                      label={item.source === 'local' ? 'Local' : `Relay (Hop ${item.hopCount || 1})`}
                    />
                  </View>

                  {/* Coordinates & Snippet */}
                  <View style={styles.metaRow}>
                    <Text style={[styles.coordsText, { color: colors.textSecondary }]}>
                      📍{' '}
                      {item.latitude && item.longitude
                        ? `${Number(item.latitude).toFixed(4)}°, ${Number(item.longitude).toFixed(4)}°`
                        : 'No GPS Coordinates Attached'}
                    </Text>
                  </View>

                  {item.details ? (
                    <Text
                      style={[styles.narrativeSnippet, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      "{item.details}"
                    </Text>
                  ) : null}

                  {/* Separated Multi-State Badges */}
                  <View style={styles.statesRow}>
                    <StatusBadge
                      type="delivery"
                      value={item.deliveryStatus || 'pending'}
                      size="sm"
                    />
                    <StatusBadge
                      type="ack"
                      value={item.ackStatus || 'unacknowledged'}
                      size="sm"
                    />
                    <StatusBadge
                      type="sync"
                      value={item.syncStatus || 'pending_sync'}
                      size="sm"
                    />
                  </View>

                  {/* Card Action Footer */}
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.footerActionBtn}
                      onPress={() => setSelectedAuditAlert(item)}
                      accessibilityRole="button"
                      accessibilityLabel="View technical audit modal"
                    >
                      <Text style={[styles.footerActionText, { color: colors.info }]}>
                        🔍 Technical Audit
                      </Text>
                    </TouchableOpacity>

                    {!isResolved ? (
                      <TouchableOpacity
                        style={styles.footerActionBtn}
                        onPress={() => setResolvingAlert(item)}
                        accessibilityRole="button"
                        accessibilityLabel="Resolve emergency alert"
                      >
                        <Text style={[styles.footerActionText, { color: colors.success }]}>
                          ✓ Mark Resolved
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.resolvedPill, { color: colors.textMuted }]}>
                        ✓ Resolved
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="📭"
            title="No Incidents Found"
            description={
              searchQuery
                ? `No alerts match '${searchQuery}'. Try clearing your search or filter.`
                : 'No emergency alerts found for the selected category filter.'
            }
            actionLabel={searchQuery ? 'Clear Search' : null}
            onAction={() => setSearchQuery('')}
            style={{ marginHorizontal: spacing.lg }}
          />
        )}

        {/* Technical Audit Modal */}
        {selectedAuditAlert ? (
          <Modal
            transparent
            animationType="fade"
            visible={!!selectedAuditAlert}
            onRequestClose={() => setSelectedAuditAlert(null)}
          >
            <View style={[styles.modalBackdrop, { backgroundColor: colors.overlayBackground }]}>
              <View
                style={[
                  styles.auditModalCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                  shadows.modal,
                ]}
              >
                <View style={[styles.auditModalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.auditModalTitle, { color: colors.textPrimary }]}>
                    Technical Incident Audit
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedAuditAlert(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close audit modal"
                  >
                    <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.auditModalBody} showsVerticalScrollIndicator={false}>
                  <View style={styles.auditRow}>
                    <Text style={[styles.auditKey, { color: colors.textMuted }]}>Alert UUID</Text>
                    <Text style={[styles.auditVal, { color: colors.textPrimary }]} selectable>
                      {selectedAuditAlert.alertId || selectedAuditAlert.id}
                    </Text>
                  </View>

                  <View style={styles.auditRow}>
                    <Text style={[styles.auditKey, { color: colors.textMuted }]}>Integrity Hash</Text>
                    <Text style={[styles.auditVal, { color: colors.textPrimary }]} selectable>
                      {selectedAuditAlert.integrityHash || 'FNV-1a Computed on Origin'}
                    </Text>
                  </View>

                  <View style={styles.auditRow}>
                    <Text style={[styles.auditKey, { color: colors.textMuted }]}>Hop Depth</Text>
                    <Text style={[styles.auditVal, { color: colors.textPrimary }]}>
                      {selectedAuditAlert.hopCount || 0} / {selectedAuditAlert.maxHops || 3}
                    </Text>
                  </View>

                  <View style={styles.auditRow}>
                    <Text style={[styles.auditKey, { color: colors.textMuted }]}>Forwarder ID</Text>
                    <Text style={[styles.auditVal, { color: colors.textPrimary }]}>
                      {selectedAuditAlert.forwarderId || 'Originator (No forwarder)'}
                    </Text>
                  </View>

                  <View style={styles.auditRow}>
                    <Text style={[styles.auditKey, { color: colors.textMuted }]}>Created Timestamp</Text>
                    <Text style={[styles.auditVal, { color: colors.textPrimary }]}>
                      {selectedAuditAlert.createdAt}
                    </Text>
                  </View>
                </ScrollView>

                <View style={[styles.auditModalFooter, { borderTopColor: colors.border }]}>
                  <PrimaryButton
                    title="Close Audit"
                    onPress={() => setSelectedAuditAlert(null)}
                    variant="secondary"
                  />
                </View>
              </View>
            </View>
          </Modal>
        ) : null}

        {/* Resolution Confirmation Modal */}
        <ConfirmationModal
          visible={!!resolvingAlert}
          title="Resolve Emergency Incident"
          severity="warning"
          message="Marking this alert as resolved clears the active emergency state locally and records a resolution task in the cloud sync outbox."
          confirmLabel="Mark Incident Resolved"
          cancelLabel="Keep Active"
          onConfirm={handleConfirmResolve}
          onCancel={() => setResolvingAlert(null)}
          summaryItems={
            resolvingAlert
              ? [
                  { label: 'Category', value: resolvingAlert.emergencyType },
                  { label: 'Alert UUID', value: resolvingAlert.alertId || resolvingAlert.id },
                ]
              : []
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    ...typography.header,
    fontWeight: '800',
  },
  screenSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  syncBadgeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  syncBadgeText: {
    ...typography.caption,
    fontWeight: '800',
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  filterTabsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterTabText: {
    ...typography.caption,
  },
  alertsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  alertCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  timestampText: {
    ...typography.caption,
  },
  senderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  senderName: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  metaRow: {
    marginVertical: 2,
  },
  coordsText: {
    ...typography.caption,
  },
  narrativeSnippet: {
    ...typography.bodySmall,
    marginVertical: spacing.xs,
    fontStyle: 'italic',
  },
  statesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  footerActionBtn: {
    paddingVertical: spacing.xs,
  },
  footerActionText: {
    ...typography.caption,
    fontWeight: '700',
  },
  resolvedPill: {
    ...typography.caption,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  auditModalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  auditModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  auditModalTitle: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xs,
  },
  auditModalBody: {
    padding: spacing.md,
  },
  auditRow: {
    marginBottom: spacing.sm,
  },
  auditKey: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: 2,
  },
  auditVal: {
    ...typography.bodySmallBold,
  },
  auditModalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
});

export default EmergencyHistoryScreen;
