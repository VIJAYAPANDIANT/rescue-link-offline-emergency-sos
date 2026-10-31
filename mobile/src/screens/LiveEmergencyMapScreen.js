import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AlertRepository } from '../database/alertRepository';
import { apiClient } from '../services/api/apiClient';
import { locationService } from '../services/location/locationService';
import { EmergencyMapView } from '../components/EmergencyMapView';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

/**
 * LiveEmergencyMapScreen
 *
 * Professional situational awareness map & triage tracker:
 * - Segmented toggle between Map View and Structured List View
 * - Dual-engine map (react-native-maps + Tactical Radar fallback)
 * - Incident details bottom sheet with turn-by-turn navigation deep links
 * - Quarantined unmapped incidents drawer (prevents false 0,0 pins)
 * - Live SSE vs Periodic Polling vs SQLite Cache indicators
 */
export const LiveEmergencyMapScreen = ({ navigation, route }) => {
  const { user, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const focusAlertId = route?.params?.focusAlertId;

  // View Mode: 'map' | 'list'
  const [viewMode, setViewMode] = useState('map');

  // Incidents State
  const [incidents, setIncidents] = useState([]);
  const [unmappedIncidents, setUnmappedIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Resolved'

  // Live Stream Status ('live' | 'polling' | 'offline')
  const [liveStreamStatus, setLiveStreamStatus] = useState('polling');

  // User Location
  const [userLocation, setUserLocation] = useState(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Unmapped Modal
  const [unmappedModalVisible, setUnmappedModalVisible] = useState(false);

  const unsubscribeRef = useRef(null);

  const loadIncidents = useCallback(async () => {
    try {
      const localMapped = await AlertRepository.getMappedAlerts({
        deliveryStatus: statusFilter !== 'ALL' ? statusFilter : null,
      });
      const localUnmapped = await AlertRepository.getUnmappedAlerts();

      setIncidents(localMapped || []);
      setUnmappedIncidents(localUnmapped || []);

      if (isAuthenticated) {
        const cloudRes = await apiClient.getMappedAlerts({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        });

        if (cloudRes.success && Array.isArray(cloudRes.data)) {
          for (const serverAlert of cloudRes.data) {
            await AlertRepository.saveOrUpdateAlert({
              ...serverAlert,
              alertId: serverAlert.id,
              latitude: serverAlert.location?.latitude,
              longitude: serverAlert.location?.longitude,
              source: serverAlert.source || 'server',
              syncStatus: 'synced',
            });
          }

          const refreshedMapped = await AlertRepository.getMappedAlerts({
            deliveryStatus: statusFilter !== 'ALL' ? statusFilter : null,
          });
          const refreshedUnmapped = await AlertRepository.getUnmappedAlerts();
          setIncidents(refreshedMapped || []);
          setUnmappedIncidents(refreshedUnmapped || []);
        }
      }
    } catch (err) {
      console.warn('[LiveMapScreen] Load incidents error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    loadIncidents();

    if (isAuthenticated) {
      unsubscribeRef.current = apiClient.subscribeToIncidents({
        onIncidentUpdate: async (updatedAlert) => {
          await AlertRepository.saveOrUpdateAlert({
            ...updatedAlert,
            alertId: updatedAlert.id,
            latitude: updatedAlert.location?.latitude,
            longitude: updatedAlert.location?.longitude,
            syncStatus: 'synced',
          });

          const updatedMapped = await AlertRepository.getMappedAlerts();
          const updatedUnmapped = await AlertRepository.getUnmappedAlerts();
          setIncidents(updatedMapped || []);
          setUnmappedIncidents(updatedUnmapped || []);
        },
        onStatusChange: (status) => {
          setLiveStreamStatus(status);
        },
        pollIntervalMs: 15000,
      });
    } else {
      setLiveStreamStatus('offline');
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [isAuthenticated, loadIncidents]);

  // Focus specific incident when navigated with param
  useEffect(() => {
    if (focusAlertId && incidents.length > 0) {
      const match = incidents.find((i) => (i.alertId || i.id) === focusAlertId);
      if (match) setSelectedIncident(match);
    }
  }, [focusAlertId, incidents]);

  // Acquire User GPS
  const handleAcquireUserLocation = async () => {
    setIsLocatingUser(true);
    try {
      const result = await locationService.acquireLocation();
      if (result.success && result.coords) {
        setUserLocation(result.coords);
        Alert.alert(
          '📍 GPS Location Acquired',
          `Your position (${result.coords.latitude.toFixed(4)}°, ${result.coords.longitude.toFixed(4)}°) is now pinned on the emergency map.`
        );
      } else {
        Alert.alert(
          'GPS Unavailable',
          result.error || 'Location permission denied. Map remains centered on emergency incidents.'
        );
      }
    } catch (e) {
      Alert.alert('Location Error', e.message);
    } finally {
      setIsLocatingUser(false);
    }
  };

  // External Maps Deep Link
  const handleNavigateWithExternalMaps = async (incident) => {
    if (!incident || typeof incident.latitude !== 'number' || typeof incident.longitude !== 'number') {
      Alert.alert('Missing Coordinates', 'Cannot navigate: this incident does not have GPS coordinates.');
      return;
    }

    const { latitude, longitude } = incident;
    const label = encodeURIComponent(`SOS: ${incident.emergencyType}`);

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
      }
    } catch {
      await Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`);
    }
  };

  const getTelemetryPill = () => {
    switch (liveStreamStatus) {
      case 'live':
        return {
          icon: '🟢',
          text: 'SSE Stream Active',
          bg: isDark ? '#052E16' : '#DCFCE7',
          color: isDark ? '#4ADE80' : '#15803D',
        };
      case 'polling':
        return {
          icon: '🟡',
          text: 'Periodic Polling (15s)',
          bg: isDark ? '#451A03' : '#FEF3C7',
          color: isDark ? '#FBBF24' : '#B45309',
        };
      case 'offline':
      default:
        return {
          icon: '⚪',
          text: 'SQLite Offline Cache',
          bg: isDark ? '#1E293B' : '#F1F5F9',
          color: isDark ? '#CBD5E1' : '#475569',
        };
    }
  };

  const telePill = getTelemetryPill();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
              Live Incident Map
            </Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {incidents.length} geocoded incidents · {unmappedIncidents.length} unmapped
            </Text>
          </View>

          {/* Telemetry Indicator */}
          <View style={[styles.telemetryBadge, { backgroundColor: telePill.bg }]}>
            <Text style={[styles.telemetryText, { color: telePill.color }]}>
              {telePill.icon} {telePill.text}
            </Text>
          </View>
        </View>

        {/* View Mode Toggle & Location Center Button */}
        <View style={styles.controlRow}>
          <View style={[styles.segmentedSwitch, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderDark }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                viewMode === 'map' && [styles.segmentBtnActive, { backgroundColor: colors.navyDark }],
              ]}
              onPress={() => setViewMode('map')}
              accessibilityRole="tab"
              accessibilityState={{ selected: viewMode === 'map' }}
              accessibilityLabel="Map View"
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  { color: viewMode === 'map' ? '#FFFFFF' : colors.textSecondary },
                  viewMode === 'map' && { fontWeight: '800' },
                ]}
              >
                🗺️ Map View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                viewMode === 'list' && [styles.segmentBtnActive, { backgroundColor: colors.navyDark }],
              ]}
              onPress={() => setViewMode('list')}
              accessibilityRole="tab"
              accessibilityState={{ selected: viewMode === 'list' }}
              accessibilityLabel="List View"
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  { color: viewMode === 'list' ? '#FFFFFF' : colors.textSecondary },
                  viewMode === 'list' && { fontWeight: '800' },
                ]}
              >
                📋 List View ({incidents.length})
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.myLocationBtn,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
              shadows.card,
            ]}
            onPress={handleAcquireUserLocation}
            accessibilityRole="button"
            accessibilityLabel="Acquire GPS position"
          >
            {isLocatingUser ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <Text style={styles.myLocationIcon}>📍 My GPS</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main View Area */}
      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <EmergencyMapView
            incidents={incidents}
            userLocation={userLocation}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
          />

          {/* Unmapped Incidents Floating Drawer Button */}
          {unmappedIncidents.length > 0 ? (
            <TouchableOpacity
              style={[
                styles.unmappedDrawerBtn,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.warningBorder,
                },
                shadows.cardElevated,
              ]}
              activeOpacity={0.85}
              onPress={() => setUnmappedModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`${unmappedIncidents.length} unmapped incidents`}
            >
              <Text style={styles.unmappedDrawerIcon}>⚠️</Text>
              <Text style={[styles.unmappedDrawerText, { color: colors.warningDark }]}>
                {unmappedIncidents.length} Incident(s) Missing GPS
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        /* Structured List View */
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {incidents.length > 0 ? (
            incidents.map((incident) => {
              const incId = incident.alertId || incident.id;
              const isSelected = selectedIncident && (selectedIncident.alertId || selectedIncident.id) === incId;

              return (
                <TouchableOpacity
                  key={incId}
                  style={[
                    styles.incidentListCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: isSelected ? colors.info : colors.border,
                    },
                    shadows.card,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedIncident(incident)}
                  accessibilityRole="button"
                  accessibilityLabel={`Incident ${incident.emergencyType}`}
                >
                  <View style={styles.listCardTopRow}>
                    <StatusBadge type="category" value={incident.emergencyType} size="sm" />
                    <Text style={[styles.listCardTime, { color: colors.textMuted }]}>
                      {formatTimestamp(incident.createdAt)}
                    </Text>
                  </View>

                  <Text style={[styles.listCardSender, { color: colors.textPrimary }]}>
                    {incident.senderName || 'Anonymous Survivor'}
                  </Text>

                  <Text style={[styles.listCardCoords, { color: colors.textSecondary }]}>
                    📍 {Number(incident.latitude).toFixed(4)}°, {Number(incident.longitude).toFixed(4)}°
                  </Text>

                  {incident.details ? (
                    <Text style={[styles.listCardDetails, { color: colors.textSecondary }]} numberOfLines={2}>
                      "{incident.details}"
                    </Text>
                  ) : null}

                  <View style={styles.listCardBadgeRow}>
                    <StatusBadge type="delivery" value={incident.deliveryStatus || 'pending'} size="sm" />
                    <StatusBadge type="sync" value={incident.syncStatus || 'pending_sync'} size="sm" />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState
              icon="🗺️"
              title="No Geocoded Incidents"
              description="No active emergency alerts currently contain valid GPS coordinates."
              style={{ marginHorizontal: spacing.lg }}
            />
          )}
        </ScrollView>
      )}

      {/* Selected Incident Bottom Sheet */}
      {selectedIncident ? (
        <View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.cardBackground,
              borderTopColor: colors.border,
            },
            shadows.cardElevated,
          ]}
        >
          <View style={styles.bottomSheetHeader}>
            <View style={{ flex: 1 }}>
              <StatusBadge type="category" value={selectedIncident.emergencyType} size="sm" />
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {selectedIncident.senderName || 'Anonymous Survivor'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSelectedIncident(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss incident details"
            >
              <Text style={[styles.sheetCloseIcon, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetCoords, { color: colors.textSecondary }]}>
            Coordinates: {Number(selectedIncident.latitude).toFixed(4)}°, {Number(selectedIncident.longitude).toFixed(4)}°
          </Text>

          {selectedIncident.details ? (
            <Text style={[styles.sheetDetails, { color: colors.textPrimary }]} numberOfLines={2}>
              "{selectedIncident.details}"
            </Text>
          ) : null}

          <View style={styles.sheetActionRow}>
            <PrimaryButton
              title="Navigate in Maps"
              onPress={() => handleNavigateWithExternalMaps(selectedIncident)}
              variant="primary"
              icon="🧭"
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <PrimaryButton
              title="View History"
              onPress={() => navigation.navigate('EmergencyHistory')}
              variant="outline"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      {/* Unmapped Incidents Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={unmappedModalVisible}
        onRequestClose={() => setUnmappedModalVisible(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlayBackground }]}>
          <View
            style={[
              styles.unmappedModalCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
              shadows.modal,
            ]}
          >
            <View style={[styles.unmappedModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.unmappedModalTitle, { color: colors.textPrimary }]}>
                Unmapped Emergency Incidents ({unmappedIncidents.length})
              </Text>
              <TouchableOpacity onPress={() => setUnmappedModalVisible(false)}>
                <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.unmappedModalBody}>
              <Text style={[styles.unmappedModalDesc, { color: colors.textSecondary }]}>
                These distress alerts were created without GPS sensors or with coordinates omitted by the user. They are quarantined here to prevent false (0,0) map placements.
              </Text>

              {unmappedIncidents.map((inc) => (
                <View
                  key={inc.alertId || inc.id}
                  style={[styles.unmappedItem, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                >
                  <StatusBadge type="category" value={inc.emergencyType} size="sm" />
                  <Text style={[styles.unmappedItemSender, { color: colors.textPrimary }]}>
                    {inc.senderName || 'Anonymous Responder'} · {formatTimestamp(inc.createdAt)}
                  </Text>
                  {inc.details ? (
                    <Text style={[styles.unmappedItemDetails, { color: colors.textSecondary }]}>
                      "{inc.details}"
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <View style={[styles.unmappedModalFooter, { borderTopColor: colors.border }]}>
              <PrimaryButton
                title="Close"
                onPress={() => setUnmappedModalVisible(false)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    ...typography.header,
    fontWeight: '800',
  },
  screenSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  telemetryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  telemetryText: {
    ...typography.caption,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  segmentedSwitch: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 2,
    flex: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    elevation: 1,
  },
  segmentBtnText: {
    ...typography.caption,
  },
  myLocationBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
  },
  myLocationIcon: {
    ...typography.caption,
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  listContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  incidentListCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  listCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  listCardTime: {
    ...typography.caption,
  },
  listCardSender: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  listCardCoords: {
    ...typography.caption,
    marginVertical: 2,
  },
  listCardDetails: {
    ...typography.bodySmall,
    marginVertical: spacing.xs,
    fontStyle: 'italic',
  },
  listCardBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  unmappedDrawerBtn: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  unmappedDrawerIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  unmappedDrawerText: {
    ...typography.caption,
    fontWeight: '800',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    ...typography.cardTitle,
    fontWeight: '800',
    marginTop: 2,
  },
  sheetCloseIcon: {
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xs,
  },
  sheetCoords: {
    ...typography.caption,
    marginBottom: 4,
  },
  sheetDetails: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  sheetActionRow: {
    flexDirection: 'row',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  unmappedModalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  unmappedModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  unmappedModalTitle: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xs,
  },
  unmappedModalBody: {
    padding: spacing.md,
  },
  unmappedModalDesc: {
    ...typography.caption,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  unmappedItem: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  unmappedItemSender: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: 4,
  },
  unmappedItemDetails: {
    ...typography.bodySmall,
    marginTop: 2,
    fontStyle: 'italic',
  },
  unmappedModalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
});

export default LiveEmergencyMapScreen;
