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
import { AlertRepository } from '../database/alertRepository';
import { apiClient } from '../services/api/apiClient';
import { locationService } from '../services/location/locationService';
import { EmergencyMapView } from '../components/EmergencyMapView';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

export const LiveEmergencyMapScreen = ({ navigation, route }) => {
  const { user, isAuthenticated } = useAuth();
  const focusAlertId = route?.params?.focusAlertId;

  // Incidents State
  const [incidents, setIncidents] = useState([]);
  const [unmappedIncidents, setUnmappedIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Resolved'

  // Live Stream & Reachability State ('live' | 'polling' | 'offline')
  const [liveStreamStatus, setLiveStreamStatus] = useState('polling');

  // User Current Location State
  const [userLocation, setUserLocation] = useState(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Unmapped Incidents Modal State
  const [unmappedModalVisible, setUnmappedModalVisible] = useState(false);

  // Subscription reference
  const unsubscribeRef = useRef(null);

  /**
   * Load incidents from local SQLite first, then refresh from Cloud if available
   */
  const loadIncidents = useCallback(async () => {
    try {
      // 1. Immediately load mapped incidents from local SQLite (Offline-first guarantee)
      const localMapped = await AlertRepository.getMappedAlerts({
        deliveryStatus: statusFilter !== 'ALL' ? statusFilter : null,
      });
      const localUnmapped = await AlertRepository.getUnmappedAlerts();

      setIncidents(localMapped);
      setUnmappedIncidents(localUnmapped);

      // 2. If authenticated & online, fetch confirmed mapped incidents from backend
      if (isAuthenticated) {
        const cloudRes = await apiClient.getMappedAlerts({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        });

        if (cloudRes.success && Array.isArray(cloudRes.data)) {
          // Merge into local SQLite to ensure offline persistence
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

          // Reload merged dataset from SQLite
          const refreshedMapped = await AlertRepository.getMappedAlerts({
            deliveryStatus: statusFilter !== 'ALL' ? statusFilter : null,
          });
          const refreshedUnmapped = await AlertRepository.getUnmappedAlerts();
          setIncidents(refreshedMapped);
          setUnmappedIncidents(refreshedUnmapped);
        }
      }
    } catch (err) {
      console.warn('[LiveMapScreen] Load incidents error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, statusFilter]);

  // Initial mount & incident stream listener setup
  useEffect(() => {
    setIsLoading(true);
    loadIncidents();

    // Subscribe to live incident stream / adaptive polling
    if (isAuthenticated) {
      unsubscribeRef.current = apiClient.subscribeToIncidents({
        onIncidentUpdate: async (updatedAlert) => {
          // Persist to local SQLite
          await AlertRepository.saveOrUpdateAlert({
            ...updatedAlert,
            alertId: updatedAlert.id,
            latitude: updatedAlert.location?.latitude,
            longitude: updatedAlert.location?.longitude,
            syncStatus: 'synced',
          });

          // Refresh map state
          const updatedMapped = await AlertRepository.getMappedAlerts();
          const updatedUnmapped = await AlertRepository.getUnmappedAlerts();
          setIncidents(updatedMapped);
          setUnmappedIncidents(updatedUnmapped);
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

  // Focus specific incident when navigated with focusAlertId param
  useEffect(() => {
    if (focusAlertId && incidents.length > 0) {
      const match = incidents.find(
        (i) => (i.alertId || i.id) === focusAlertId
      );
      if (match) {
        setSelectedIncident(match);
      }
    }
  }, [focusAlertId, incidents]);

  /**
   * Acquire user location ONLY after explicit button press
   */
  const handleAcquireUserLocation = async () => {
    setIsLocatingUser(true);
    try {
      const result = await locationService.acquireLocation();
      if (result.success && result.coords) {
        setUserLocation(result.coords);
        Alert.alert(
          '📍 GPS Location Acquired',
          `Your position (${result.coords.latitude.toFixed(4)}°, ${result.coords.longitude.toFixed(4)}°) is now shown on the tactical map.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'GPS Unavailable',
          result.error || 'Location permission denied. Map remains centered on emergency incidents.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert('Location Error', e.message);
    } finally {
      setIsLocatingUser(false);
    }
  };

  /**
   * Open external Maps directions
   */
  const handleNavigateWithExternalMaps = async (incident) => {
    if (!incident || typeof incident.latitude !== 'number' || typeof incident.longitude !== 'number') {
      Alert.alert('Missing Coordinates', 'Cannot navigate: this incident does not have GPS coordinates.');
      return;
    }

    const { latitude, longitude } = incident;
    const label = encodeURIComponent(`SOS: ${incident.emergencyType}`);

    // Standard cross-platform Google Maps / Apple Maps deep link
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
        // Fallback to browser Google Maps URL
        await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
      }
    } catch (err) {
      Alert.alert('Navigation Error', 'Unable to launch map application: ' + err.message);
    }
  };

  // Filtered incidents for display
  const displayedIncidents = incidents.filter((incident) => {
    if (selectedCategory !== 'ALL' && incident.emergencyType !== selectedCategory) {
      return false;
    }
    return true;
  });

  const getStatusBadgeMeta = () => {
    switch (liveStreamStatus) {
      case 'live':
        return {
          icon: '🟢',
          label: 'Live (Real-Time SSE)',
          bg: '#DCFCE7',
          color: '#15803D',
        };
      case 'polling':
        return {
          icon: '🟡',
          label: 'Periodic Polling (15s)',
          bg: '#FEF3C7',
          color: '#B45309',
        };
      case 'offline':
      default:
        return {
          icon: '⚪',
          label: 'Offline (SQLite Cache)',
          bg: '#F1F5F9',
          color: '#475569',
        };
    }
  };

  const statusMeta = getStatusBadgeMeta();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Live Incident Map</Text>
            <Text style={styles.screenSubtitle}>
              Situational awareness & spatial emergency triage
            </Text>
          </View>

          {/* Real-time Status Badge */}
          <View style={[styles.streamStatusBadge, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.streamStatusText, { color: statusMeta.color }]}>
              {statusMeta.icon} {statusMeta.label}
            </Text>
          </View>
        </View>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {[
            { id: 'ALL', label: 'All Incidents' },
            { id: 'Medical Emergency', label: '🚑 Medical' },
            { id: 'Fire', label: '🔥 Fire' },
            { id: 'Accident', label: '⚠️ Accident' },
            { id: 'Personal Safety', label: '🛡️ Safety' },
            { id: 'Test / Drill', label: '🧪 Drill' },
          ].map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Unmapped Incidents Alert Banner */}
      {unmappedIncidents.length > 0 && (
        <TouchableOpacity
          style={styles.unmappedBanner}
          onPress={() => setUnmappedModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.unmappedBannerIcon}>⚠️</Text>
          <Text style={styles.unmappedBannerText}>
            {unmappedIncidents.length} alert{unmappedIncidents.length > 1 ? 's' : ''} reported without GPS coordinates. Tap to review.
          </Text>
          <Text style={styles.unmappedBannerAction}>View →</Text>
        </TouchableOpacity>
      )}

      {/* Interactive Map View */}
      <View style={styles.mapWrapper}>
        <EmergencyMapView
          incidents={displayedIncidents}
          userLocation={userLocation}
          selectedIncident={selectedIncident}
          onSelectIncident={(incident) => setSelectedIncident(incident)}
          onMapPress={() => setSelectedIncident(null)}
        />

        {/* GPS Location Button */}
        <TouchableOpacity
          style={[styles.gpsFloatingBtn, shadows.cardElevated]}
          onPress={handleAcquireUserLocation}
          disabled={isLocatingUser}
        >
          {isLocatingUser ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.gpsFloatingIcon}>🎯</Text>
          )}
        </TouchableOpacity>

        {/* Map Incident Counter Pill */}
        <View style={styles.mapCountPill}>
          <Text style={styles.mapCountText}>
            📍 {displayedIncidents.length} Active Incident{displayedIncidents.length === 1 ? '' : 's'} Plotted
          </Text>
        </View>
      </View>

      {/* Selected Incident Bottom Details Sheet */}
      {selectedIncident && (
        <View style={[styles.detailSheet, shadows.cardElevated]}>
          <View style={styles.detailSheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.typeBadgeRow}>
                <Text style={styles.detailEmergencyType}>
                  {selectedIncident.emergencyType}
                </Text>
                <View
                  style={[
                    styles.stateBadge,
                    selectedIncident.deliveryStatus === 'Resolved'
                      ? styles.resolvedBadge
                      : styles.activeBadge,
                  ]}
                >
                  <Text style={styles.stateBadgeText}>
                    {selectedIncident.deliveryStatus || 'Pending'}
                  </Text>
                </View>
              </View>
              <Text style={styles.detailAlertId}>
                ID: {selectedIncident.alertId || selectedIncident.id}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeSheetBtn}
              onPress={() => setSelectedIncident(null)}
            >
              <Text style={styles.closeSheetIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Coordinates & Timestamps */}
          <View style={styles.detailMetaGrid}>
            <View style={styles.detailMetaItem}>
              <Text style={styles.detailMetaLabel}>COORDINATES</Text>
              <Text style={styles.detailMetaValue}>
                {selectedIncident.latitude.toFixed(4)}°, {selectedIncident.longitude.toFixed(4)}°
              </Text>
            </View>
            <View style={styles.detailMetaItem}>
              <Text style={styles.detailMetaLabel}>REPORTED</Text>
              <Text style={styles.detailMetaValue}>
                {formatTimestamp(selectedIncident.createdAt)}
              </Text>
            </View>
          </View>

          {/* Details Narrative */}
          {selectedIncident.details ? (
            <Text style={styles.detailDescription} numberOfLines={2}>
              "{selectedIncident.details}"
            </Text>
          ) : null}

          {/* Distinct Separated Lifecycle States */}
          <View style={styles.statesRow}>
            <Text style={styles.statePill}>
              Origin: {selectedIncident.source || 'local'}
            </Text>
            <Text style={styles.statePill}>
              ACK: {selectedIncident.ackStatus || 'unacknowledged'}
            </Text>
            <Text style={styles.statePill}>
              Sync: {selectedIncident.syncStatus || 'pending_sync'}
            </Text>
            {selectedIncident.hopCount > 0 ? (
              <Text style={styles.statePill}>
                Relay: Hop {selectedIncident.hopCount}
              </Text>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => handleNavigateWithExternalMaps(selectedIncident)}
            >
              <Text style={styles.navigateBtnText}>🧭 Navigate with Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => navigation.navigate('EmergencyHistory')}
            >
              <Text style={styles.historyBtnText}>📋 View History</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Unmapped Incidents Modal */}
      <Modal
        visible={unmappedModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUnmappedModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.cardElevated]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Incidents Without GPS Coordinates</Text>
              <TouchableOpacity onPress={() => setUnmappedModalVisible(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              These distress signals were created offline or with location omitted by the survivor. They cannot be plotted at an exact map coordinate.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {unmappedIncidents.map((item) => (
                <View key={item.alertId || item.id} style={styles.unmappedItemCard}>
                  <View style={styles.unmappedItemHeader}>
                    <Text style={styles.unmappedItemType}>{item.emergencyType}</Text>
                    <Text style={styles.unmappedItemTime}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.unmappedItemSender}>
                    Sender: {item.senderName || 'Anonymous Responder'}
                  </Text>
                  {item.details ? (
                    <Text style={styles.unmappedItemDetails}>"{item.details}"</Text>
                  ) : null}
                  <View style={styles.unmappedItemBadgeRow}>
                    <Text style={styles.locationOmittedBadge}>
                      📍 Location: Omitted or Unavailable
                    </Text>
                    <Text style={styles.unmappedSourceBadge}>
                      Source: {item.source}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.cardBackground,
    paddingTop: Platform.OS === 'android' ? spacing.xl : spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  streamStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streamStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChipsScroll: {
    paddingVertical: spacing.xs,
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  unmappedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  unmappedBannerIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  unmappedBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  unmappedBannerAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  gpsFloatingBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsFloatingIcon: {
    fontSize: 22,
  },
  mapCountPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mapCountText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  detailSheet: {
    backgroundColor: colors.cardBackground,
    padding: spacing.md,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: 280,
  },
  detailSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailEmergencyType: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  stateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadge: {
    backgroundColor: '#FEE2E2',
  },
  resolvedBadge: {
    backgroundColor: '#DCFCE7',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailAlertId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textMuted,
    marginTop: 2,
  },
  closeSheetBtn: {
    padding: 4,
  },
  closeSheetIcon: {
    fontSize: 18,
    color: colors.textMuted,
  },
  detailMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  detailMetaItem: {
    flex: 1,
  },
  detailMetaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  detailMetaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  detailDescription: {
    fontSize: 13,
    color: colors.textPrimary,
    fontStyle: 'italic',
    marginVertical: 4,
  },
  statesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: spacing.xs,
  },
  statePill: {
    fontSize: 10,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  navigateBtn: {
    flex: 1.2,
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  historyBtn: {
    flex: 0.8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseIcon: {
    fontSize: 18,
    color: colors.textMuted,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginVertical: spacing.sm,
  },
  unmappedItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unmappedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unmappedItemType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  unmappedItemTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  unmappedItemSender: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unmappedItemDetails: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textPrimary,
    marginTop: 2,
  },
  unmappedItemBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  locationOmittedBadge: {
    fontSize: 10,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  unmappedSourceBadge: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
