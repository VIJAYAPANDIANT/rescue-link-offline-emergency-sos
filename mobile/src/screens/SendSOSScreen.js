import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/api/apiClient';
import { locationService } from '../services/location/locationService';
import { bluetoothService, BLE_STATES } from '../services/bluetooth/bluetoothService';
import { AlertRepository, ReceiptRepository, SyncQueueRepository, ContactRepository } from '../database';
import { notificationQueueService } from '../services/notification/notificationQueueService';
import { EmergencyTypeSelector } from '../components/EmergencyTypeSelector';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { InfoBanner } from '../components/InfoBanner';
import { EMERGENCY_TYPES } from '../utils/constants';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';
import { generateDraftId, formatTimestamp } from '../utils/helpers';

/**
 * SendSOSScreen (Sender Workflow & Emergency Composition)
 *
 * Professional emergency dispatch flow:
 * 1. Category selection with prominent Test / Drill indicator
 * 2. Optional narrative description with 180-char counter (BLE MTU bounded)
 * 3. Location acquisition and explicit sharing consent
 * 4. High-urgency confirmation dialog guard before recording alert
 * 5. Multi-stage visual progression:
 *    [Saved Locally] -> [BLE Broadcasting] -> [Peer ACK] -> [Cloud Synced]
 */
export const SendSOSScreen = ({ navigation, route }) => {
  const onDraftCreated = route.params?.onDraftCreated;
  const { user, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();

  // Form State
  const [selectedType, setSelectedType] = useState('medical');
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [createdAlert, setCreatedAlert] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Location State
  const [includeLocation, setIncludeLocation] = useState(false);
  const [locationConsent, setLocationConsent] = useState(true);
  const [locationStatus, setLocationStatus] = useState('Location omitted by user');
  const [acquiredCoords, setAcquiredCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [enabledContactsCount, setEnabledContactsCount] = useState(0);

  // BLE Broadcast State
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [bleStatusText, setBleStatusText] = useState(null);
  const [bleAckInfo, setBleAckInfo] = useState(null);
  const [bleError, setBleError] = useState(null);

  // Stop advertising when unmounting
  useEffect(() => {
    return () => {
      bluetoothService.stopAdvertisingSOS();
    };
  }, []);

  // Refresh enabled contacts count
  useEffect(() => {
    ContactRepository.getEnabledContacts(user?.id)
      .then((contacts) => setEnabledContactsCount(contacts.length))
      .catch(() => setEnabledContactsCount(0));
  }, [user]);

  // Update contactName when user logs in
  useEffect(() => {
    if (user?.name && !contactName) {
      setContactName(user.name);
    }
  }, [user]);

  const selectedTypeConfig =
    EMERGENCY_TYPES.find((t) => t.id === selectedType) || EMERGENCY_TYPES[0];
  const isDrill = selectedType === 'test' || selectedTypeConfig.label.toLowerCase().includes('drill');

  // Handle location toggle
  const handleToggleLocation = async (enabled) => {
    setIncludeLocation(enabled);
    if (!enabled) {
      setLocationStatus('Location omitted by user');
      setAcquiredCoords(null);
      return;
    }

    setIsLocating(true);
    setLocationStatus('Acquiring GPS location...');

    const locResult = await locationService.acquireLocation();
    setIsLocating(false);

    if (locResult.success && locResult.coords) {
      setAcquiredCoords(locResult.coords);
      setLocationStatus('Location acquired');
    } else {
      setAcquiredCoords(null);
      setLocationStatus(locResult.status || 'Location unavailable');
    }
  };

  // Open Confirmation Modal
  const handleReviewAndSubmit = () => {
    setErrorMessage(null);
    setShowConfirmModal(true);
  };

  // Submit Alert to Backend API or fallback to Offline Local Draft
  const executeAlertSubmission = async () => {
    setShowConfirmModal(false);
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const contactStr = [contactName.trim(), contactPhone.trim()]
      .filter(Boolean)
      .join(' · ');

    const payload = {
      emergencyType: selectedTypeConfig.label,
      details: details.trim() || undefined,
      contactDetails: contactStr || undefined,
      location: includeLocation && acquiredCoords ? acquiredCoords : null,
      locationConsent: includeLocation && locationConsent,
    };

    const localAlertId = generateDraftId();
    const baseAlertRecord = {
      alertId: localAlertId,
      senderId: user?.id || null,
      senderName: contactName.trim() || user?.name || 'Anonymous Responder',
      emergencyType: payload.emergencyType,
      details: payload.details || '',
      contactDetails: payload.contactDetails || '',
      latitude: payload.location ? payload.location.latitude : null,
      longitude: payload.location ? payload.location.longitude : null,
      source: 'local',
      deliveryStatus: 'pending',
      ackStatus: 'unacknowledged',
      syncStatus: 'pending_sync',
      hopCount: 0,
      maxHops: 3,
      originalSenderId: user?.id || null,
      forwarderId: null,
      relayStatus: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediately persist to SQLite database (Offline-first guarantee)
    try {
      await AlertRepository.saveOrUpdateAlert(baseAlertRecord);
      await notificationQueueService.queueLocalNotificationTasks(baseAlertRecord, user);
    } catch (dbErr) {
      console.warn('[SendSOSScreen] SQLite initial save warning:', dbErr.message);
    }

    if (isAuthenticated) {
      // 2. Online / Authenticated Path
      const response = await apiClient.createAlert(payload);
      setIsSubmitting(false);

      if (response.success && response.data) {
        const serverAlert = response.data;
        const syncedAlert = {
          ...serverAlert,
          alertId: serverAlert.id,
          source: 'local',
          syncStatus: 'synced',
        };

        try {
          if (localAlertId !== serverAlert.id) {
            await AlertRepository.deleteAlert(localAlertId);
          }
          await AlertRepository.saveOrUpdateAlert(syncedAlert);
        } catch (e) {
          console.warn('[SendSOSScreen] SQLite sync update warning:', e.message);
        }

        setCreatedAlert(syncedAlert);
        if (typeof onDraftCreated === 'function') {
          onDraftCreated(syncedAlert);
        }
      } else {
        // Backend unavailable -> Enqueue in offline sync outbox
        try {
          await SyncQueueRepository.enqueue({
            alertId: localAlertId,
            operation: 'CREATE',
            payload,
          });
        } catch (qErr) {
          console.warn('[SendSOSScreen] Failed to enqueue sync item:', qErr.message);
        }

        const offlineRecord = {
          ...baseAlertRecord,
          id: localAlertId,
          status: 'Offline (Local Only)',
          isOffline: true,
        };

        setCreatedAlert(offlineRecord);
        if (typeof onDraftCreated === 'function') {
          onDraftCreated(offlineRecord);
        }
      }
    } else {
      // Guest path -> Local persistence & outbox queue
      setIsSubmitting(false);
      try {
        await SyncQueueRepository.enqueue({
          alertId: localAlertId,
          operation: 'CREATE',
          payload,
        });
      } catch (qErr) {
        console.warn('[SendSOSScreen] Failed to enqueue sync item:', qErr.message);
      }

      const guestAlert = {
        ...baseAlertRecord,
        id: localAlertId,
        status: 'Offline (Local Only)',
        isOffline: true,
      };

      setCreatedAlert(guestAlert);
      if (typeof onDraftCreated === 'function') {
        onDraftCreated(guestAlert);
      }
    }
  };

  // Start BLE Advertising
  const handleStartBLEBroadcast = async () => {
    if (!createdAlert) return;

    setBleError(null);
    setBleStatusText('Starting Bluetooth Low Energy advertisement...');

    const result = await bluetoothService.startAdvertisingSOS(
      createdAlert,
      async (ack) => {
        setBleAckInfo(ack);
        setBleStatusText('Peer acknowledgment confirmed over BLE!');

        try {
          const targetAlertId = createdAlert.alertId || createdAlert.id;
          await ReceiptRepository.recordReceipt({
            alertId: targetAlertId,
            receiptType: 'BLE_ACK_RECEIVED',
            senderOrDeviceId: ack.receiverId,
            metadata: ack,
          });
        } catch (dbErr) {
          console.warn('[SendSOSScreen] SQLite receipt recording warning:', dbErr.message);
        }
      }
    );

    if (result.success) {
      setIsAdvertising(true);
      setBleStatusText('Broadcasting SOS packet over BLE (GATT Active)...');
    } else {
      setIsAdvertising(false);
      setBleError(result.error || 'Failed to initialize Bluetooth radio.');
      setBleStatusText(null);
    }
  };

  // Stop BLE Advertising
  const handleStopBLEBroadcast = async () => {
    await bluetoothService.stopAdvertisingSOS();
    setIsAdvertising(false);
    setBleStatusText('Bluetooth broadcast stopped.');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
                {isDrill ? 'Simulation Drill Composer' : 'Emergency SOS Composer'}
              </Text>
              {isDrill ? (
                <View style={[styles.drillPill, { backgroundColor: colors.infoLight, borderColor: colors.infoBorder }]}>
                  <Text style={[styles.drillPillText, { color: colors.infoDark }]}>DRILL MODE</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              Persists to local SQLite database and broadcasts over BLE mesh
            </Text>
          </View>

          {/* Drill Mode Banner */}
          {isDrill ? (
            <InfoBanner
              variant="info"
              icon="🧪"
              title="Simulation Drill Active"
              message="This alert will be explicitly marked as 'Test / Drill' and will NOT alert official emergency response networks."
              style={{ marginHorizontal: spacing.lg }}
            />
          ) : null}

          {/* Guest / Offline Warning Banner */}
          {!isAuthenticated ? (
            <InfoBanner
              variant="warning"
              icon="👤"
              title="Guest Mode Active"
              message="Alert will be saved locally with unique UUID and broadcast over BLE. Cloud sync requires signing in."
              actionLabel="Sign In"
              onAction={() => navigation.navigate('Login')}
              style={{ marginHorizontal: spacing.lg }}
            />
          ) : null}

          {/* Error Banner */}
          {errorMessage ? (
            <InfoBanner
              variant="danger"
              icon="❌"
              title="Submission Failed"
              message={errorMessage}
              style={{ marginHorizontal: spacing.lg }}
            />
          ) : null}

          {/* Result State (Alert Created & Ready) */}
          {createdAlert ? (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: isDrill ? colors.infoBorder : colors.primaryBorder,
                },
                shadows.cardElevated,
              ]}
            >
              {/* Step Progression Indicators */}
              <View style={styles.progressionHeader}>
                <Text style={[styles.progressionTitle, { color: colors.textPrimary }]}>
                  EMERGENCY TRANSMISSION PIPELINE
                </Text>
              </View>

              <View style={styles.progressionGrid}>
                {/* Stage 1: SQLite Persistence */}
                <View style={[styles.progressionStep, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={styles.progressionIcon}>💾</Text>
                  <View style={styles.progressionTextCol}>
                    <Text style={[styles.progressionStepTitle, { color: colors.textPrimary }]}>1. SQLite Storage</Text>
                    <Text style={[styles.progressionStepSub, { color: colors.success }]}>✓ Saved Locally (WAL)</Text>
                  </View>
                </View>

                {/* Stage 2: BLE Transmission */}
                <View style={[styles.progressionStep, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={styles.progressionIcon}>📡</Text>
                  <View style={styles.progressionTextCol}>
                    <Text style={[styles.progressionStepTitle, { color: colors.textPrimary }]}>2. Bluetooth LE</Text>
                    <Text style={[styles.progressionStepSub, { color: isAdvertising ? colors.info : colors.textMuted }]}>
                      {isAdvertising ? 'Broadcasting Beacon' : 'Standby'}
                    </Text>
                  </View>
                </View>

                {/* Stage 3: Peer Acknowledgment */}
                <View style={[styles.progressionStep, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={styles.progressionIcon}>🤝</Text>
                  <View style={styles.progressionTextCol}>
                    <Text style={[styles.progressionStepTitle, { color: colors.textPrimary }]}>3. Peer Confirmed</Text>
                    <Text style={[styles.progressionStepSub, { color: bleAckInfo ? colors.success : colors.textMuted }]}>
                      {bleAckInfo ? 'ACK Received' : 'Waiting for Peer'}
                    </Text>
                  </View>
                </View>

                {/* Stage 4: Cloud Sync */}
                <View style={[styles.progressionStep, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={styles.progressionIcon}>☁️</Text>
                  <View style={styles.progressionTextCol}>
                    <Text style={[styles.progressionStepTitle, { color: colors.textPrimary }]}>4. Cloud Sync</Text>
                    <Text style={[styles.progressionStepSub, { color: createdAlert.isOffline ? colors.warning : colors.success }]}>
                      {createdAlert.isOffline ? 'Queued in Outbox' : 'Synced to Server'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Alert Details Summary */}
              <View style={[styles.summaryBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textMuted }]}>Alert UUID</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]} numberOfLines={1}>
                    {createdAlert.id || createdAlert.alertId}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textMuted }]}>Category</Text>
                  <StatusBadge type="category" value={createdAlert.emergencyType} size="sm" />
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textMuted }]}>Location</Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                    {createdAlert.location
                      ? `${createdAlert.location.latitude.toFixed(4)}°, ${createdAlert.location.longitude.toFixed(4)}°`
                      : 'Omitted (No GPS Attached)'}
                  </Text>
                </View>

                {createdAlert.details ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryKey, { color: colors.textMuted }]}>Details</Text>
                    <Text style={[styles.summaryVal, { color: colors.textPrimary }]} numberOfLines={2}>
                      {createdAlert.details}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Bluetooth Broadcast Controls */}
              <View style={[styles.bleActionBox, { backgroundColor: isDark ? '#172554' : '#EFF6FF', borderColor: colors.infoBorder }]}>
                <Text style={[styles.bleActionTitle, { color: colors.infoDark }]}>
                  OFFLINE BLUETOOTH MESH BROADCAST
                </Text>
                <Text style={[styles.bleActionDesc, { color: colors.textSecondary }]}>
                  Advertise distress packet over BLE GATT profile (10–30m range).
                </Text>

                {bleStatusText ? (
                  <View style={styles.bleStatusRow}>
                    <ActivityIndicator size="small" color={colors.info} style={{ marginRight: 8 }} />
                    <Text style={[styles.bleStatusMessage, { color: colors.textPrimary }]}>
                      {bleStatusText}
                    </Text>
                  </View>
                ) : null}

                {bleError ? (
                  <View style={[styles.bleErrorCard, { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder }]}>
                    <Text style={[styles.bleErrorMsg, { color: colors.primaryDark }]}>
                      ⚠️ {bleError}
                    </Text>
                    <Text style={[styles.bleErrorHint, { color: colors.textSecondary }]}>
                      Recovery: Ensure Bluetooth and Location permissions are enabled in Android device settings.
                    </Text>
                  </View>
                ) : null}

                {bleAckInfo ? (
                  <View style={[styles.ackCard, { backgroundColor: colors.successLight, borderColor: colors.successBorder }]}>
                    <Text style={[styles.ackCardTitle, { color: colors.successDark }]}>
                      🎉 Genuine Peer Acknowledgment Confirmed!
                    </Text>
                    <Text style={[styles.ackCardSub, { color: colors.successDark }]}>
                      Receiver Node: {bleAckInfo.receiverId} · {formatTimestamp(bleAckInfo.receivedAt)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.bleBtnRow}>
                  {!isAdvertising ? (
                    <PrimaryButton
                      title="Broadcast via Bluetooth"
                      onPress={handleStartBLEBroadcast}
                      variant={isDrill ? 'primary' : 'danger'}
                      icon="📡"
                      size="lg"
                    />
                  ) : (
                    <PrimaryButton
                      title="Stop BLE Broadcast"
                      onPress={handleStopBLEBroadcast}
                      variant="secondary"
                      icon="⏹️"
                      size="lg"
                    />
                  )}
                </View>
              </View>

              {/* Navigation Options */}
              <View style={styles.postSubmitActions}>
                <PrimaryButton
                  title="View in Emergency History"
                  onPress={() => {
                    bluetoothService.stopAdvertisingSOS();
                    setCreatedAlert(null);
                    navigation.navigate('EmergencyHistory');
                  }}
                  variant="primary"
                  icon="📋"
                />
                <PrimaryButton
                  title="Compose Another Alert"
                  onPress={() => {
                    bluetoothService.stopAdvertisingSOS();
                    setCreatedAlert(null);
                    setDetails('');
                    setBleAckInfo(null);
                    setIsAdvertising(false);
                  }}
                  variant="outline"
                />
              </View>
            </View>
          ) : (
            /* Composer Form */
            <View style={styles.composerForm}>
              {/* Category Selector */}
              <EmergencyTypeSelector
                selectedType={selectedType}
                onSelectType={setSelectedType}
              />

              {/* Optional Narrative Description with Character Counter */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    DISTRESS DETAILS (OPTIONAL)
                  </Text>
                  <Text
                    style={[
                      styles.charCounter,
                      { color: details.length > 160 ? colors.warning : colors.textMuted },
                    ]}
                  >
                    {details.length} / 180
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.borderDark,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={details}
                  onChangeText={(val) => setDetails(val.slice(0, 180))}
                  placeholder="Describe your immediate danger, injuries, landmark, or number of survivors..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={180}
                  accessibilityLabel="Distress details description"
                />
                <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                  Max 180 characters to guarantee single-packet fit within Bluetooth 512-byte MTU.
                </Text>
              </View>

              {/* Location Sensor & Consent Gate */}
              <View
                style={[
                  styles.cardContainer,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                  },
                  shadows.card,
                ]}
              >
                <View style={styles.locationHeaderRow}>
                  <View style={styles.locationTitleGroup}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <View>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        GPS Coordinates
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                        {locationStatus}
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={includeLocation}
                    onValueChange={handleToggleLocation}
                    trackColor={{ false: colors.borderDark, true: colors.info }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Toggle GPS location attachment"
                  />
                </View>

                {isLocating ? (
                  <View style={styles.locatingRow}>
                    <ActivityIndicator size="small" color={colors.info} style={{ marginRight: 8 }} />
                    <Text style={[styles.locatingText, { color: colors.textSecondary }]}>
                      Acquiring GPS fix from satellite hardware...
                    </Text>
                  </View>
                ) : null}

                {includeLocation && acquiredCoords ? (
                  <View style={[styles.coordsPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                    <Text style={[styles.coordsText, { color: colors.textPrimary }]}>
                      Latitude: {acquiredCoords.latitude.toFixed(4)}°, Longitude: {acquiredCoords.longitude.toFixed(4)}°
                    </Text>
                  </View>
                ) : null}

                {/* Explicit Location Sharing Consent */}
                {includeLocation ? (
                  <View style={[styles.consentBox, { borderTopColor: colors.border }]}>
                    <View style={styles.consentRow}>
                      <View style={{ flex: 1, marginRight: spacing.sm }}>
                        <Text style={[styles.consentTitle, { color: colors.textPrimary }]}>
                          Attach Maps URL in Notifications
                        </Text>
                        <Text style={[styles.consentSub, { color: colors.textMuted }]}>
                          Allows emergency contacts to open your coordinates directly in Google Maps.
                        </Text>
                      </View>
                      <Switch
                        value={locationConsent}
                        onValueChange={setLocationConsent}
                        trackColor={{ false: colors.borderDark, true: colors.success }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel="Consent to share clickable map URL with contacts"
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Emergency Contacts Notice */}
              <View
                style={[
                  styles.contactsNotice,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.contactsNoticeIcon}>👥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactsNoticeTitle, { color: colors.textPrimary }]}>
                    Emergency Contacts Dispatch ({enabledContactsCount} active)
                  </Text>
                  <Text style={[styles.contactsNoticeSub, { color: colors.textSecondary }]}>
                    {enabledContactsCount > 0
                      ? 'Enabled contacts will receive automated SMS/Email alerts when cloud connectivity is restored.'
                      : 'No contacts configured. Configure contacts in the Contacts tab.'}
                  </Text>
                </View>
              </View>

              {/* Trigger Review Button */}
              <View style={styles.submitSection}>
                <PrimaryButton
                  title={
                    isDrill
                      ? 'Review & Start Drill'
                      : 'Review & Submit Emergency SOS'
                  }
                  onPress={handleReviewAndSubmit}
                  variant={isDrill ? 'primary' : 'danger'}
                  loading={isSubmitting}
                  icon={isDrill ? '🧪' : '🚨'}
                  size="lg"
                />
              </View>
            </View>
          )}

          {/* Confirmation Modal Guard */}
          <ConfirmationModal
            visible={showConfirmModal}
            title={
              isDrill
                ? '🧪 Confirm Drill Simulation'
                : '🚨 Confirm Emergency SOS'
            }
            severity={isDrill ? 'info' : 'danger'}
            message={
              isDrill
                ? 'You are about to submit a non-emergency training drill. This will be marked as a simulation and will not alert rescue dispatchers.'
                : 'You are about to transmit an official emergency distress alert. It will be persisted in local SQLite and broadcast over Bluetooth to nearby rescuers.'
            }
            confirmLabel={isDrill ? 'Start Drill' : 'Transmit Emergency SOS'}
            cancelLabel="Cancel"
            summaryItems={[
              { label: 'Category', value: selectedTypeConfig.label },
              {
                label: 'Location',
                value: acquiredCoords
                  ? `${acquiredCoords.latitude.toFixed(4)}°, ${acquiredCoords.longitude.toFixed(4)}°`
                  : 'Omitted (No GPS Attached)',
              },
              { label: 'Mode', value: isDrill ? 'Simulation Drill' : 'Live Emergency' },
              { label: 'Contacts', value: `${enabledContactsCount} Enabled Target(s)` },
            ]}
            onConfirm={executeAlertSubmission}
            onCancel={() => setShowConfirmModal(false)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    ...typography.header,
    fontWeight: '800',
    flex: 1,
  },
  drillPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  drillPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  composerForm: {
    paddingHorizontal: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  charCounter: {
    fontSize: 11,
    fontWeight: '700',
  },
  textArea: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    ...typography.body,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  inputHint: {
    ...typography.caption,
    marginTop: 4,
  },
  cardContainer: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  locationIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  cardSub: {
    ...typography.bodySmall,
    marginTop: 1,
  },
  locatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  locatingText: {
    ...typography.bodySmall,
  },
  coordsPill: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  coordsText: {
    ...typography.bodySmallBold,
  },
  consentBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  consentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consentTitle: {
    ...typography.bodySmallBold,
  },
  consentSub: {
    ...typography.caption,
    marginTop: 2,
  },
  contactsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  contactsNoticeIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  contactsNoticeTitle: {
    ...typography.bodySmallBold,
  },
  contactsNoticeSub: {
    ...typography.caption,
    marginTop: 2,
    lineHeight: 16,
  },
  submitSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  resultCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  progressionHeader: {
    marginBottom: spacing.sm,
  },
  progressionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  progressionGrid: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  progressionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  progressionIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  progressionTextCol: {
    flex: 1,
  },
  progressionStepTitle: {
    ...typography.bodySmallBold,
  },
  progressionStepSub: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: 1,
  },
  summaryBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryKey: {
    ...typography.caption,
    fontWeight: '600',
  },
  summaryVal: {
    ...typography.bodySmallBold,
    maxWidth: '65%',
    textAlign: 'right',
  },
  bleActionBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bleActionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  bleActionDesc: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  bleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  bleStatusMessage: {
    ...typography.bodySmallBold,
    flex: 1,
  },
  bleErrorCard: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  bleErrorMsg: {
    ...typography.bodySmallBold,
  },
  bleErrorHint: {
    ...typography.caption,
    marginTop: 2,
  },
  ackCard: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  ackCardTitle: {
    ...typography.bodySmallBold,
  },
  ackCardSub: {
    ...typography.caption,
    marginTop: 2,
  },
  bleBtnRow: {
    marginTop: spacing.sm,
  },
  postSubmitActions: {
    gap: spacing.sm,
  },
});

export default SendSOSScreen;
