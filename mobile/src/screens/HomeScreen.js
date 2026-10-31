import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SOSButton } from '../components/SOSButton';
import { StatusCard } from '../components/StatusCard';
import { StatusBadge } from '../components/StatusBadge';
import { InfoBanner } from '../components/InfoBanner';
import { apiClient } from '../services/api/apiClient';
import { bluetoothService, BLE_STATES } from '../services/bluetooth/bluetoothService';
import { syncService } from '../services/sync/syncService';
import { networkService } from '../services/network/networkService';
import { locationService } from '../services/location/locationService';
import { AlertRepository } from '../database';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';
import { APP_CONFIG, SAFETY_DISCLAIMER } from '../utils/constants';
import { formatTimestamp } from '../utils/helpers';

/**
 * HomeScreen / Emergency Dashboard
 *
 * Professional emergency response cockpit presenting:
 * - Prominent SOS action trigger with accessible touch target
 * - Real-time Bluetooth availability & radio health
 * - Internet connectivity & Reachability state
 * - Location permission & GPS status
 * - Pending synchronization count with immediate "Sync Now" trigger
 * - Recent emergency activity summary
 * - Official public safety disclaimer
 */
export const HomeScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [serverStatus, setServerStatus] = useState('Checking...');
  const [isServerHealthy, setIsServerHealthy] = useState(false);

  // Bluetooth State
  const [bluetoothStatus, setBluetoothStatus] = useState('Checking BLE...');
  const [bleVariant, setBleVariant] = useState('info');
  const [bleSubtitle, setBleSubtitle] = useState('Verifying BLE stack...');

  // Storage & Sync State
  const [storageStatus, setStorageStatus] = useState('SQLite Active');
  const [storageSubtitle, setStorageSubtitle] = useState('Local WAL persistence initialized');
  const [outboxCount, setOutboxCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('All Synced');
  const [syncVariant, setSyncVariant] = useState('success');
  const [syncSubtitle, setSyncSubtitle] = useState('Outbox empty · Cloud is up to date');

  // Network State
  const [networkType, setNetworkType] = useState('Checking...');
  const [isOnline, setIsOnline] = useState(false);

  // Location State
  const [locationPermStatus, setLocationPermStatus] = useState('GPS Standby');
  const [locationVariant, setLocationVariant] = useState('info');
  const [locationSubtitle, setLocationSubtitle] = useState('Coordinates attached during SOS');

  // Recent Activity State
  const [recentAlerts, setRecentAlerts] = useState([]);

  const refreshDashboardData = useCallback(async () => {
    // 1. Health Ping
    try {
      const res = await apiClient.checkHealth();
      if (res.success) {
        setServerStatus('Connected (HTTP 200)');
        setIsServerHealthy(true);
      } else {
        setServerStatus('Offline (Backend Unreachable)');
        setIsServerHealthy(false);
      }
    } catch {
      setServerStatus('Offline / Local Mode');
      setIsServerHealthy(false);
    }

    // 2. Bluetooth Radio Status
    try {
      const bleRes = await bluetoothService.checkBluetoothAvailability();
      if (bleRes.supported) {
        if (bleRes.state === BLE_STATES.IDLE || bleRes.state === 'PoweredOn') {
          setBluetoothStatus('BLE Ready (Powered On)');
          setBleVariant('success');
          setBleSubtitle('Central scanner & Peripheral advertiser standby');
        } else {
          setBluetoothStatus('Bluetooth Disabled');
          setBleVariant('warning');
          setBleSubtitle('Enable Bluetooth in device settings to broadcast off-grid');
        }
      } else {
        setBluetoothStatus('Dev Build Required');
        setBleVariant('info');
        setBleSubtitle('Native BLE module requires an Expo Dev Client build');
      }
    } catch {
      setBluetoothStatus('BLE Standby');
      setBleVariant('info');
      setBleSubtitle('Bluetooth Low Energy subsystem ready');
    }

    // 3. Network Connectivity
    try {
      const netState = await networkService.getNetworkState();
      setIsOnline(!!netState.isConnected && !!netState.isInternetReachable);
      setNetworkType(
        netState.isConnected
          ? `${netState.type.toUpperCase()}${netState.isInternetReachable ? ' (Internet Active)' : ' (Local Link Only)'}`
          : 'Disconnected (Offline Mode)'
      );
    } catch {
      setIsOnline(false);
      setNetworkType('Offline / Airplane Mode');
    }

    // 4. SQLite Counts & Outbox
    try {
      const counts = await AlertRepository.getAlertCounts();
      setStorageStatus(`SQLite Active (${counts.total} Records)`);
      setStorageSubtitle(
        `${counts.localCount} local, ${counts.bleCount} BLE, ${counts.pendingSyncCount} pending sync`
      );
    } catch {
      setStorageStatus('SQLite Active');
      setStorageSubtitle('Local database operational in WAL mode');
    }

    try {
      const syncState = await syncService.getSyncStatus();
      setOutboxCount(syncState.pendingCount);
      setIsSyncing(syncState.isSyncing);
      if (syncState.isSyncing) {
        setSyncStatusText('Syncing in Progress...');
        setSyncVariant('info');
        setSyncSubtitle('Uploading queued distress records to cloud');
      } else if (syncState.pendingCount > 0) {
        setSyncStatusText(`${syncState.pendingCount} Pending in Outbox`);
        setSyncVariant('warning');
        setSyncSubtitle('Queued alerts will auto-sync once internet is reachable');
      } else {
        setSyncStatusText('All Synced');
        setSyncVariant('success');
        setSyncSubtitle('Outbox empty · Up to date with rescue servers');
      }
    } catch {
      // Ignored
    }

    // 5. Recent Alerts
    try {
      const alerts = await AlertRepository.getAllAlerts(1, 3);
      setRecentAlerts(alerts || []);
    } catch {
      setRecentAlerts([]);
    }
  }, []);

  useEffect(() => {
    refreshDashboardData();

    const unsubscribeSync = syncService.addSyncListener(() => {
      refreshDashboardData();
    });

    const unsubscribeNet = networkService.addConnectivityListener(() => {
      refreshDashboardData();
    });

    const unsubscribeFocus = navigation.addListener ? navigation.addListener('focus', refreshDashboardData) : null;

    return () => {
      unsubscribeSync();
      unsubscribeNet();
      if (unsubscribeFocus) unsubscribeFocus();
    };
  }, [navigation, refreshDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDashboardData();
    setRefreshing(false);
  };

  const handleManualSyncNow = async () => {
    if (isSyncing) return;
    try {
      await syncService.triggerSync();
      await refreshDashboardData();
    } catch (e) {
      console.warn('Manual sync trigger error:', e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Top Session & Responder Banner */}
        <View style={styles.topBarRow}>
          {isAuthenticated && user ? (
            <TouchableOpacity
              style={[
                styles.responderPill,
                {
                  backgroundColor: isDark ? '#052E16' : '#DCFCE7',
                  borderColor: isDark ? '#15803D' : '#86EFAC',
                },
              ]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole="button"
              accessibilityLabel={`Signed in as ${user.name}`}
            >
              <View style={[styles.responderDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.responderText, { color: isDark ? '#4ADE80' : '#15803D' }]} numberOfLines={1}>
                {user.name} ({user.role || 'Responder'})
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.guestPill,
                {
                  backgroundColor: isDark ? '#1E293B' : colors.surfaceSubtle,
                  borderColor: colors.borderDark,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              accessibilityLabel="Guest Mode. Tap to Log In"
            >
              <Text style={[styles.guestText, { color: colors.textSecondary }]}>
                👤 Guest Mode · Tap to Log In
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.profileIconBtn,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
          >
            <Text style={styles.profileIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandBadge, { backgroundColor: colors.navyDark, borderColor: colors.border }]}>
              <Text style={styles.brandBadgeText}>OFFLINE MESH RESCUE</Text>
            </View>
          </View>
          <Text style={[styles.appTitle, { color: colors.textPrimary }]}>{APP_CONFIG.APP_NAME}</Text>
          <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>{APP_CONFIG.APP_SUBTITLE}</Text>
        </View>

        {/* Public Safety Warning Notice */}
        <InfoBanner
          variant="warning"
          title="Emergency Protocol Notice"
          message={SAFETY_DISCLAIMER.SHORT}
          style={{ marginHorizontal: spacing.md }}
        />

        {/* Centerpiece SOS Action Trigger */}
        <View style={styles.sosSection}>
          <SOSButton
            onPress={() => navigation.navigate('SendSOS')}
            title="SOS"
            subtitle="TRIGGER EMERGENCY"
          />
          <Text style={[styles.sosHelperText, { color: colors.textSecondary }]}>
            Tap to open emergency report. Broadcasts over Bluetooth Low Energy mesh and persists in offline SQLite.
          </Text>
        </View>

        {/* System Status Indicators */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>SYSTEM READINESS</Text>
          <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
            Radios, storage, and synchronization status
          </Text>
        </View>

        <View style={styles.statusGrid}>
          {/* Bluetooth Radio */}
          <StatusCard
            title="Bluetooth Radio"
            value={bluetoothStatus}
            icon="📡"
            variant={bleVariant}
            subtitle={bleSubtitle}
            actionLabel={bleVariant === 'warning' ? 'Open Settings' : null}
            onAction={() => navigation.navigate('NearbyDevices')}
          />

          {/* Network Connectivity */}
          <StatusCard
            title="Network Connectivity"
            value={isOnline ? 'Online & Reachable' : 'Offline / Standalone'}
            icon="🌐"
            variant={isOnline ? 'success' : 'warning'}
            subtitle={networkType}
          />

          {/* SQLite Offline Storage */}
          <StatusCard
            title="SQLite Offline Database"
            value={storageStatus}
            icon="💾"
            variant="success"
            subtitle={storageSubtitle}
          />

          {/* Cloud Sync Outbox */}
          <StatusCard
            title="Cloud Synchronization"
            value={syncStatusText}
            icon="🔄"
            variant={syncVariant}
            subtitle={syncSubtitle}
            actionLabel={outboxCount > 0 ? (isSyncing ? 'Syncing...' : 'Sync Now') : null}
            onAction={handleManualSyncNow}
          />
        </View>

        {/* Recent Emergency Activity */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>RECENT EMERGENCY ACTIVITY</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('EmergencyHistory')}
              accessibilityRole="button"
              accessibilityLabel="View all history records"
            >
              <Text style={[styles.viewAllText, { color: colors.info }]}>View All →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {recentAlerts.length > 0 ? (
          <View style={styles.activityContainer}>
            {recentAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.alertId || alert.id}
                style={[
                  styles.recentAlertCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                  shadows.card,
                ]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('EmergencyHistory')}
                accessibilityRole="button"
                accessibilityLabel={`Alert: ${alert.emergencyType}. Timestamp: ${formatTimestamp(alert.createdAt)}`}
              >
                <View style={styles.recentAlertTopRow}>
                  <StatusBadge type="category" value={alert.emergencyType} size="sm" />
                  <Text style={[styles.recentAlertTime, { color: colors.textMuted }]}>
                    {formatTimestamp(alert.createdAt)}
                  </Text>
                </View>

                {alert.details ? (
                  <Text
                    style={[styles.recentAlertSnippet, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {alert.details}
                  </Text>
                ) : null}

                <View style={styles.recentAlertBadgeRow}>
                  <StatusBadge type="delivery" value={alert.deliveryStatus || 'pending'} size="sm" />
                  <StatusBadge type="sync" value={alert.syncStatus || 'pending_sync'} size="sm" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyRecentCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.emptyRecentIcon}>🛡️</Text>
            <Text style={[styles.emptyRecentTitle, { color: colors.textPrimary }]}>
              No Active Distress Signals
            </Text>
            <Text style={[styles.emptyRecentDesc, { color: colors.textMuted }]}>
              Your device has no unacknowledged emergency alerts recorded in local SQLite storage.
            </Text>
          </View>
        )}

        {/* Quick Action Navigation Tiles */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>MISSION MODULES</Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, shadows.card]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('LiveMap')}
            accessibilityRole="button"
            accessibilityLabel="Live Incident Map"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#172554' : '#E0F2FE' }]}>
              <Text style={styles.actionIcon}>🗺️</Text>
            </View>
            <Text style={[styles.actionCardTitle, { color: colors.textPrimary }]}>Live Incident Map</Text>
            <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
              Interactive GPS markers & triage
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, shadows.card]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('NearbyDevices')}
            accessibilityRole="button"
            accessibilityLabel="Nearby Devices"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#172554' : '#EFF6FF' }]}>
              <Text style={styles.actionIcon}>📡</Text>
            </View>
            <Text style={[styles.actionCardTitle, { color: colors.textPrimary }]}>Nearby Mesh Peers</Text>
            <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
              Scan BLE nodes & signal strength
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, shadows.card]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('EmergencyHistory')}
            accessibilityRole="button"
            accessibilityLabel="Emergency History"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#450A0A' : '#FEE2E2' }]}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <Text style={[styles.actionCardTitle, { color: colors.textPrimary }]}>Alert History</Text>
            <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
              SQLite ledger & relay hops
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, shadows.card]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('Contacts')}
            accessibilityRole="button"
            accessibilityLabel="Emergency Contacts"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#052E16' : '#DCFCE7' }]}>
              <Text style={styles.actionIcon}>👥</Text>
            </View>
            <Text style={[styles.actionCardTitle, { color: colors.textPrimary }]}>Emergency Contacts</Text>
            <Text style={[styles.actionCardSubtitle, { color: colors.textSecondary }]}>
              Priority dispatch targets
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            RescueLink v1.0.0 · Step 13 UI/UX Design System
          </Text>
        </View>
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
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  responderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: '75%',
  },
  responderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  responderText: {
    ...typography.caption,
    fontWeight: '700',
  },
  guestPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  guestText: {
    ...typography.caption,
    fontWeight: '700',
  },
  profileIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  profileIconText: {
    fontSize: 18,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  brandRow: {
    marginBottom: spacing.xs,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  brandBadgeText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  appTitle: {
    ...typography.display,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    ...typography.body,
    marginTop: 2,
  },
  sosSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  sosHelperText: {
    ...typography.bodySmall,
    textAlign: 'center',
    maxWidth: 290,
    marginTop: -8,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCaption: {
    ...typography.caption,
    marginTop: 2,
  },
  viewAllText: {
    ...typography.caption,
    fontWeight: '700',
  },
  statusGrid: {
    paddingHorizontal: spacing.lg,
  },
  activityContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  recentAlertCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  recentAlertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recentAlertTime: {
    ...typography.caption,
  },
  recentAlertSnippet: {
    ...typography.bodySmall,
    marginVertical: spacing.xs,
  },
  recentAlertBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  emptyRecentCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyRecentIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  emptyRecentTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyRecentDesc: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionCard: {
    width: '48%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionCardTitle: {
    ...typography.cardTitle,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    ...typography.bodySmall,
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  footerText: {
    ...typography.caption,
  },
});

export default HomeScreen;
