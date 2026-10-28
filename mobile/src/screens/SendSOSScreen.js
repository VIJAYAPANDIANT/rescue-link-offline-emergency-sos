import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api/apiClient';
import { locationService } from '../services/location/locationService';
import { EmergencyTypeSelector } from '../components/EmergencyTypeSelector';
import { PrimaryButton } from '../components/PrimaryButton';
import { EMERGENCY_TYPES } from '../utils/constants';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatCoordinates, generateDraftId } from '../utils/helpers';

/**
 * SendSOSScreen
 *
 * Emergency SOS configuration and backend submission:
 * 1. Emergency Type Selection (Medical Emergency, Accident, Personal Safety, Fire, Other)
 * 2. Optional Location Acquisition & Indicator (Attached / Unavailable / Omitted)
 * 3. Additional Details input
 * 4. Optional Contact Details input
 * 5. Pre-dispatch Review & Confirmation Dialog
 * 6. Authenticated Submission to POST /api/alerts
 * 7. Success & Error States with clear safety disclaimers
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

    if (!isAuthenticated) {
      Alert.alert(
        'Authentication Required',
        'You are currently in Guest Mode. Please sign in with your responder account to submit emergency alerts to the backend.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }

    Alert.alert(
      '⚠️ Confirm Emergency SOS Submission',
      `You are creating an emergency alert:\n\nType: ${selectedTypeConfig.label}\nLocation: ${
        acquiredCoords ? `${acquiredCoords.latitude}°, ${acquiredCoords.longitude}°` : 'None (Omitted)'
      }\n\nNotice: This creates a permanent alert record on the RescueLink backend. Direct Bluetooth mesh broadcast and 911 dispatch await subsequent modules.\n\nProceed to submit?`,
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

  // Submit Alert to Backend API
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

    const response = await apiClient.createAlert(payload);
    setIsSubmitting(false);

    if (response.success && response.data) {
      setCreatedAlert(response.data);

      // Also notify parent if handler provided
      if (typeof onDraftCreated === 'function') {
        onDraftCreated(response.data);
      }
    } else {
      setErrorMessage(
        response.error || 'Failed to submit emergency alert. Please verify your connection.'
      );
    }
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
              Broadcast emergency distress beacon to backend database
            </Text>
          </View>

          {/* Guest Mode Warning Banner if not logged in */}
          {!isAuthenticated ? (
            <View style={styles.guestBanner}>
              <Text style={styles.guestIcon}>⚠️</Text>
              <View style={styles.guestTextContainer}>
                <Text style={styles.guestTitle}>Guest Mode Active</Text>
                <Text style={styles.guestMessage}>
                  Please sign in to record alerts in the central backend.
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

          {/* Success Result Card (After Backend 201 Response) */}
          {createdAlert ? (
            <View style={[styles.successContainer, shadows.cardElevated]}>
              <View style={styles.successHeader}>
                <Text style={styles.successBadge}>BACKEND RECORD CREATED (HTTP 201)</Text>
                <Text style={styles.successTitle}>Alert Submitted Successfully</Text>
              </View>

              <View style={styles.alertNoticeBox}>
                <Text style={styles.alertNoticeText}>
                  🛡️ Confirmed: Your emergency alert has been securely stored in the RescueLink
                  backend database. Real device-to-device BLE mesh relaying and official dispatch
                  (911/112) await subsequent modules.
                </Text>
              </View>

              <View style={styles.draftDetailsCard}>
                <Text style={styles.draftIdText}>ALERT ID: {createdAlert.id}</Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Status: </Text>
                  <Text style={styles.statusPending}>{createdAlert.status}</Text>
                </Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Type: </Text>
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

              <View style={styles.successActions}>
                <PrimaryButton
                  title="View in Emergency History"
                  onPress={() => {
                    setCreatedAlert(null);
                    navigation.navigate('EmergencyHistory');
                  }}
                  variant="primary"
                  icon="📋"
                />
                <PrimaryButton
                  title="Create Another Alert"
                  onPress={() => {
                    setCreatedAlert(null);
                    setDetails('');
                  }}
                  variant="secondary"
                />
                <PrimaryButton
                  title="Back to Dashboard"
                  onPress={() => {
                    setCreatedAlert(null);
                    navigation.navigate('Home');
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
                    {isAuthenticated ? user.name : 'Guest User'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionContainer}>
                <PrimaryButton
                  title={isSubmitting ? 'Submitting SOS...' : 'Send Emergency SOS'}
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
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
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
    color: colors.warningDark,
  },
  guestMessage: {
    fontSize: 11,
    color: colors.warningDark,
  },
  guestLoginBtn: {
    backgroundColor: colors.warningDark,
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
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  alertNoticeBox: {
    backgroundColor: colors.infoLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  alertNoticeText: {
    fontSize: 12,
    color: colors.infoDark,
    lineHeight: 17,
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
  successActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

export default SendSOSScreen;
