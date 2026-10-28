import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api/apiClient';
import { locationService } from '../services/location/locationService';
import { bluetoothService, BLE_STATES } from '../services/bluetooth/bluetoothService';
import { EmergencyTypeSelector } from '../components/EmergencyTypeSelector';
import { PrimaryButton } from '../components/PrimaryButton';
import { EMERGENCY_TYPES } from '../utils/constants';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatCoordinates, generateDraftId, formatTimestamp } from '../utils/helpers';

/**
 * SendSOSScreen (Sender Workflow)
 *
 * 1. Creates SOS alert via backend API if authenticated and online.
 * 2. Retains local alert creation path if backend is unreachable.
 * 3. Provides deliberate action to broadcast alert via real BLE advertising.
 * 4. Displays real BLE states (Advertising, Connected, Ack Received, Error).
 * 5. Cleans up BLE advertising resources on unmount.
 */
export const SendSOSScreen = ({ navigation, route }) => {
  const onDraftCreated = route.params?.onDraftCreated;
  const { user, isAuthenticated } = useAuth();

  // Form State
  const [selectedType, setSelectedType] = useState('medical');
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [createdAlert, setCreatedAlert] = useState(null);

  // Location State
  const [includeLocation, setIncludeLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Location omitted by user');
  const [acquiredCoords, setAcquiredCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

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

  // Update contactName when user logs in
  useEffect(() => {
    if (user?.name && !contactName) {
      setContactName(user.name);
    }
  }, [user]);

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
      setLocationStatus('Location attached');
    } else {
      setAcquiredCoords(null);
      setLocationStatus(locResult.status || 'Location unavailable');
    }
  };

  const selectedTypeConfig =
    EMERGENCY_TYPES.find((t) => t.id === selectedType) || EMERGENCY_TYPES[0];

  // Trigger Confirmation Dialog before sending
  const handleReviewAndSubmit = () => {
    setErrorMessage(null);

    const locSummary = acquiredCoords
      ? `${acquiredCoords.latitude}°, ${acquiredCoords.longitude}°`
      : 'None (Omitted)';

    Alert.alert(
      '⚠️ Confirm Emergency SOS Submission',
      `Category: ${selectedTypeConfig.label}\nLocation: ${locSummary}\n\nNotice: This records an official emergency alert. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Emergency Alert',
          style: 'destructive',
          onPress: executeAlertSubmission,
        },
      ]
    );
  };

  // Submit Alert to Backend API or fallback to Offline Local Draft
  const executeAlertSubmission = async () => {
    if (isSubmitting) return; // Prevent duplicate submissions
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
    };

    if (isAuthenticated) {
      // 1. Online / Authenticated Path
      const response = await apiClient.createAlert(payload);
      setIsSubmitting(false);

      if (response.success && response.data) {
        setCreatedAlert(response.data);
        if (typeof onDraftCreated === 'function') {
          onDraftCreated(response.data);
        }
      } else {
        // Backend unavailable or error -> Offer offline fallback
        Alert.alert(
          'Server Unreachable',
          'Unable to reach the RescueLink backend. Would you like to create an offline local alert and broadcast it over Bluetooth?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create Offline Alert',
              onPress: () => createOfflineAlert(payload),
            },
          ]
        );
      }
    } else {
      // 2. Guest / Offline Mode
      setIsSubmitting(false);
      createOfflineAlert(payload);
    }
  };

  // Create offline local alert
  const createOfflineAlert = (payload) => {
    const localAlert = {
      id: generateDraftId(),
      emergencyType: payload.emergencyType,
      details: payload.details || '',
      contactDetails: payload.contactDetails || '',
      location: payload.location,
      senderName: contactName.trim() || 'Anonymous Responder',
      status: 'Offline (Local Only)',
      isOffline: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCreatedAlert(localAlert);
    if (typeof onDraftCreated === 'function') {
      onDraftCreated(localAlert);
    }
  };

  // Start BLE Advertising
  const handleStartBLEBroadcast = async () => {
    if (!createdAlert) return;

    setBleError(null);
    setBleStatusText('Initializing BLE advertising...');

    const result = await bluetoothService.startAdvertisingSOS(
      createdAlert,
      (ack) => {
        // Callback invoked when receiver sends ACK
        setBleAckInfo(ack);
        setBleStatusText('Receiver acknowledgment confirmed over BLE!');
        Alert.alert(
          '🎉 Acknowledgment Received!',
          `Nearby receiver (${ack.receiverId}) has confirmed receipt of your distress alert over Bluetooth.`,
          [{ text: 'OK' }]
        );
      }
    );

    if (result.success) {
      setIsAdvertising(true);
      setBleStatusText('Broadcasting SOS beacon over Bluetooth (GATT Service Active)...');
    } else {
      setIsAdvertising(false);
      setBleError(result.error);
      setBleStatusText(null);
    }
  };

  // Stop BLE Advertising
  const handleStopBLEBroadcast = async () => {
    await bluetoothService.stopAdvertisingSOS();
    setIsAdvertising(false);
    setBleStatusText('BLE broadcasting stopped.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
            <Text style={styles.screenTitle}>Send Emergency SOS</Text>
            <Text style={styles.screenSubtitle}>
              Broadcast emergency distress beacon over BLE & backend
            </Text>
          </View>

          {/* Guest Mode Warning Banner if not logged in */}
          {!isAuthenticated ? (
            <View style={styles.guestBanner}>
              <Text style={styles.guestIcon}>ℹ️</Text>
              <View style={styles.guestTextContainer}>
                <Text style={styles.guestTitle}>Guest / Offline Mode</Text>
                <Text style={styles.guestMessage}>
                  Alerts will be generated locally with unique IDs and can be broadcast over Bluetooth.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.guestLoginBtn}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.guestLoginBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>❌</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Success / Alert Ready Card */}
          {createdAlert ? (
            <View style={[styles.successContainer, shadows.cardElevated]}>
              <View style={styles.successHeader}>
                <Text
                  style={[
                    styles.successBadge,
                    createdAlert.isOffline && styles.offlineBadge,
                  ]}
                >
                  {createdAlert.isOffline
                    ? 'OFFLINE LOCAL ALERT CREATED'
                    : 'BACKEND RECORD CREATED (HTTP 201)'}
                </Text>
                <Text style={styles.successTitle}>Alert Ready for Broadcast</Text>
              </View>

              {/* Alert Details Card */}
              <View style={styles.draftDetailsCard}>
                <Text style={styles.draftIdText}>ALERT ID: {createdAlert.id}</Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Status: </Text>
                  <Text style={styles.statusPending}>{createdAlert.status}</Text>
                </Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Category: </Text>
                  {createdAlert.emergencyType}
                </Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Sender: </Text>
                  {createdAlert.senderName}
                </Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Location: </Text>
                  {createdAlert.location
                    ? `${createdAlert.location.latitude.toFixed(4)}°, ${createdAlert.location.longitude.toFixed(4)}°`
                    : 'None (Omitted)'}
                </Text>
                {createdAlert.details ? (
                  <Text style={styles.draftRow}>
                    <Text style={styles.draftLabel}>Details: </Text>
                    {createdAlert.details}
                  </Text>
                ) : null}
              </View>

              {/* BLE Broadcast Section */}
              <View style={styles.bleSectionBox}>
                <Text style={styles.bleSectionTitle}>BLUETOOTH LOW ENERGY (BLE) TRANSMISSION</Text>
                <Text style={styles.bleSectionDesc}>
                  Broadcast this alert to nearby RescueLink smartphones within 10-30 meters.
                </Text>

                {bleStatusText ? (
                  <View style={styles.bleStatusBox}>
                    <ActivityIndicator size="small" color={colors.info} style={{ marginRight: 6 }} />
                    <Text style={styles.bleStatusText}>{bleStatusText}</Text>
                  </View>
                ) : null}

                {bleError ? (
                  <View style={styles.bleErrorBox}>
                    <Text style={styles.bleErrorText}>⚠️ {bleError}</Text>
                  </View>
                ) : null}

                {bleAckInfo ? (
                  <View style={styles.ackCard}>
                    <Text style={styles.ackBadge}>GENUINE BLE ACK CONFIRMED</Text>
                    <Text style={styles.ackTitle}>Receiver Confirmed Receipt</Text>
                    <Text style={styles.ackText}>
                      Receiver ID: {bleAckInfo.receiverId}
                    </Text>
                    <Text style={styles.ackText}>
                      Confirmed At: {formatTimestamp(bleAckInfo.receivedAt)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.bleActionButtons}>
                  {!isAdvertising ? (
                    <PrimaryButton
                      title="Broadcast via Bluetooth"
                      onPress={handleStartBLEBroadcast}
                      variant="danger"
                      icon="📡"
                    />
                  ) : (
                    <PrimaryButton
                      title="Stop BLE Broadcast"
                      onPress={handleStopBLEBroadcast}
                      variant="secondary"
                      icon="⏹️"
                    />
                  )}
                </View>
              </View>

              {/* Navigation Actions */}
              <View style={styles.successActions}>
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
            <>
              {/* Location Selector Card */}
              <View style={[styles.locationCard, shadows.card]}>
                <View style={styles.locationHeaderRow}>
                  <View style={styles.locationHeaderLeft}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <View>
                      <Text style={styles.locationTitle}>GPS Location</Text>
                      <Text style={styles.locationStatusText}>{locationStatus}</Text>
                    </View>
                  </View>
                  <Switch
                    value={includeLocation}
                    onValueChange={handleToggleLocation}
                    trackColor={{ false: colors.borderDark, true: colors.info }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {includeLocation && acquiredCoords ? (
                  <View style={styles.coordsBox}>
                    <Text style={styles.coordsText}>
                      Coordinates: {acquiredCoords.latitude.toFixed(4)}° N,{' '}
                      {acquiredCoords.longitude.toFixed(4)}° E
                    </Text>
                  </View>
                ) : null}

                {includeLocation && isLocating ? (
                  <Text style={styles.locatingText}>📡 Contacting GPS sensors...</Text>
                ) : null}

                <Text style={styles.locationHelper}>
                  Location is completely optional. You can safely transmit emergency dispatches without coordinates.
                </Text>
              </View>

              {/* 1. Emergency Type Selector */}
              <EmergencyTypeSelector
                selectedType={selectedType}
                onSelectType={setSelectedType}
              />

              {/* 2. Additional Details Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>
                  INCIDENT DETAILS (OPTIONAL)
                </Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe your situation (e.g. 2 people trapped, smoke spreading, severe bleeding)..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={details}
                  onChangeText={setDetails}
                  textAlignVertical="top"
                  maxLength={1000}
                />
              </View>

              {/* 3. Optional Contact Information */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>EMERGENCY CONTACT DETAILS (OPTIONAL)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Your Name / Identifier"
                  placeholderTextColor={colors.textMuted}
                  value={contactName}
                  onChangeText={setContactName}
                  maxLength={100}
                />
                <TextInput
                  style={[styles.textInput, { marginTop: spacing.sm }]}
                  placeholder="ICE Emergency Phone Number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  maxLength={50}
                />
              </View>

              {/* 4. Pre-dispatch Review Step */}
              <View style={[styles.reviewCard, shadows.card]}>
                <Text style={styles.reviewHeading}>REVIEW SOS SUMMARY</Text>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Category:</Text>
                  <Text style={[styles.reviewValue, { color: selectedTypeConfig.color }]}>
                    {selectedTypeConfig.symbol} {selectedTypeConfig.label}
                  </Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Location:</Text>
                  <Text style={styles.reviewValue}>
                    {acquiredCoords
                      ? `${acquiredCoords.latitude.toFixed(4)}°, ${acquiredCoords.longitude.toFixed(4)}°`
                      : 'None (Omitted)'}
                  </Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Sender:</Text>
                  <Text style={styles.reviewValue}>
                    {contactName.trim() || (isAuthenticated ? user.name : 'Anonymous')}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionContainer}>
                <PrimaryButton
                  title={isSubmitting ? 'Creating SOS...' : 'Create SOS Alert'}
                  onPress={handleReviewAndSubmit}
                  variant="danger"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  icon="🚨"
                />
                <PrimaryButton
                  title="Cancel & Return"
                  onPress={() => navigation.goBack()}
                  variant="outline"
                  disabled={isSubmitting}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  guestIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  guestTextContainer: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.infoDark,
  },
  guestMessage: {
    fontSize: 11,
    color: colors.infoDark,
  },
  guestLoginBtn: {
    backgroundColor: colors.info,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  guestLoginBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  errorIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
    lineHeight: 16,
  },
  locationCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locationStatusText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  coordsBox: {
    backgroundColor: colors.infoLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  coordsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.infoDark,
  },
  locatingText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.info,
    marginTop: spacing.xs,
  },
  locationHelper: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs + 2,
    lineHeight: 15,
  },
  inputSection: {
    marginVertical: spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 90,
  },
  reviewCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reviewLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reviewValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionContainer: {
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  successContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginVertical: spacing.md,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successBadge: {
    backgroundColor: colors.successLight,
    color: colors.successDark,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  offlineBadge: {
    backgroundColor: colors.warningLight,
    color: colors.warningDark,
    borderColor: colors.warningBorder,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  draftDetailsCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  draftIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  draftRow: {
    fontSize: 13,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  draftLabel: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusPending: {
    fontWeight: '800',
    color: colors.warningDark,
  },
  bleSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  bleSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  bleSectionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  bleStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  bleStatusText: {
    fontSize: 12,
    color: colors.infoDark,
    fontWeight: '600',
    flex: 1,
  },
  bleErrorBox: {
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  bleErrorText: {
    fontSize: 12,
    color: colors.primaryDark,
  },
  ackCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  ackBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.successDark,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  ackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.successDark,
    marginBottom: 4,
  },
  ackText: {
    fontSize: 11,
    color: colors.successDark,
  },
  bleActionButtons: {
    marginTop: spacing.xs,
  },
  successActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

export default SendSOSScreen;
