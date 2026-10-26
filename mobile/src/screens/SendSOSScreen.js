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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { EmergencyTypeSelector } from '../components/EmergencyTypeSelector';
import { PrimaryButton } from '../components/PrimaryButton';
import { EMERGENCY_TYPES } from '../utils/constants';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatCoordinates, generateDraftId } from '../utils/helpers';

/**
 * SendSOSScreen
 *
 * Emergency SOS configuration and dispatch flow:
 * 1. Emergency Type Selection (Medical, Accident, Safety, Fire, Other)
 * 2. Location Indicator with coordinates & accuracy
 * 3. Additional Details input
 * 4. Optional Contact Details input
 * 5. Review Step & Pre-dispatch Summary
 * 6. Native Confirmation Alert
 * 7. Local Draft Creation (Safety Rule: Never claims real emergency dispatch in Step 1)
 */
export const SendSOSScreen = ({ navigation, route }) => {
  const onDraftCreated = route.params?.onDraftCreated;
  const { user } = useAuth();

  // Form State
  const [selectedType, setSelectedType] = useState('medical');
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDraft, setCreatedDraft] = useState(null);

  // Simulated GPS Coordinates (Safe prototype demonstration)
  const currentLocation = {
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 8.5,
  };

  const selectedTypeConfig =
    EMERGENCY_TYPES.find((t) => t.id === selectedType) || EMERGENCY_TYPES[0];

  // Trigger Confirmation Dialog
  const handleReviewAndSubmit = () => {
    Alert.alert(
      '⚠️ Confirm SOS Draft Creation',
      `You are creating a ${selectedTypeConfig.label} draft alert.\n\nNOTE: In this Step 1 prototype, this will be saved as a local draft only. No live broadcast or call to 911/112 will be performed.\n\nProceed to save draft?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Create Local Draft',
          style: 'destructive',
          onPress: executeLocalDraftCreation,
        },
      ]
    );
  };

  // Execute Local Demonstration Draft Creation
  const executeLocalDraftCreation = () => {
    setIsSubmitting(true);

    setTimeout(() => {
      const draftRecord = {
        id: generateDraftId(),
        emergencyType: selectedTypeConfig.id,
        emergencyLabel: selectedTypeConfig.label,
        symbol: selectedTypeConfig.symbol,
        color: selectedTypeConfig.color,
        details: details.trim() || 'No additional details provided.',
        contactName: contactName.trim() || 'Not specified',
        contactPhone: contactPhone.trim() || 'Not specified',
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
        },
        status: 'LOCAL DEMO DRAFT',
        isBroadcasted: false,
        isDemo: true,
        createdAt: new Date().toISOString(),
      };

      // Notify parent/global handler if provided
      if (typeof onDraftCreated === 'function') {
        onDraftCreated(draftRecord);
      }

      setCreatedDraft(draftRecord);
      setIsSubmitting(false);
    }, 600);
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
              Prepare offline emergency report payload
            </Text>
          </View>

          {/* Success Result Card (If Draft Created) */}
          {createdDraft ? (
            <View style={[styles.successContainer, shadows.cardElevated]}>
              <View style={styles.successHeader}>
                <Text style={styles.successBadge}>LOCAL DEMONSTRATION STATE</Text>
                <Text style={styles.successTitle}>Draft Created Successfully</Text>
              </View>

              <View style={styles.alertNoticeBox}>
                <Text style={styles.alertNoticeText}>
                  🛡️ This emergency draft has been saved to local memory only. Real BLE mesh
                  broadcasting and cloud gateway relaying are awaiting Step 3. No emergency
                  services or responders have been notified.
                </Text>
              </View>

              <View style={styles.draftDetailsCard}>
                <Text style={styles.draftIdText}>ID: {createdDraft.id}</Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Type: </Text>
                  {createdDraft.symbol} {createdDraft.emergencyLabel}
                </Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Location: </Text>
                  {formatCoordinates(
                    createdDraft.location.latitude,
                    createdDraft.location.longitude,
                    createdDraft.location.accuracy
                  )}
                </Text>
                <Text style={styles.draftRow}>
                  <Text style={styles.draftLabel}>Details: </Text>
                  {createdDraft.details}
                </Text>
              </View>

              <View style={styles.successActions}>
                <PrimaryButton
                  title="View in Emergency History"
                  onPress={() => {
                    setCreatedDraft(null);
                    navigation.navigate('EmergencyHistory');
                  }}
                  variant="primary"
                />
                <PrimaryButton
                  title="Back to Dashboard"
                  onPress={() => {
                    setCreatedDraft(null);
                    navigation.navigate('Home');
                  }}
                  variant="outline"
                />
              </View>
            </View>
          ) : (
            <>
              {/* Location Indicator Card */}
              <View style={[styles.locationCard, shadows.card]}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationTitle}>Attached GPS Coordinates</Text>
                    <Text style={styles.locationCoords}>
                      {formatCoordinates(
                        currentLocation.latitude,
                        currentLocation.longitude,
                        currentLocation.accuracy
                      )}
                    </Text>
                  </View>
                  <View style={styles.gpsActiveBadge}>
                    <Text style={styles.gpsActiveText}>GPS LOCKED</Text>
                  </View>
                </View>
                <Text style={styles.locationNote}>
                  Location will be embedded into the local broadcast beacon.
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
                  INCIDENT DETAILS (OPTIONAL BUT RECOMMENDED)
                </Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe your situation (e.g. 2 people trapped, need oxygen, severe bleeding)..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={details}
                  onChangeText={setDetails}
                  textAlignVertical="top"
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
                />
                <TextInput
                  style={[styles.textInput, { marginTop: spacing.sm }]}
                  placeholder="ICE Emergency Phone Number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={contactPhone}
                  onChangeText={setContactPhone}
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
                  <Text style={styles.reviewLabel}>GPS Lock:</Text>
                  <Text style={styles.reviewValue}>
                    {currentLocation.latitude.toFixed(4)}° N,{' '}
                    {currentLocation.longitude.toFixed(4)}° E
                  </Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Dispatch Mode:</Text>
                  <Text style={styles.reviewValue}>Local Demonstration Draft</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionContainer}>
                <PrimaryButton
                  title="Create SOS Draft (Demonstration)"
                  onPress={handleReviewAndSubmit}
                  variant="danger"
                  loading={isSubmitting}
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
  locationCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    marginBottom: spacing.sm,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  locationCoords: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.info,
    marginTop: 2,
  },
  gpsActiveBadge: {
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  gpsActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.infoDark,
  },
  locationNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
    backgroundColor: colors.warningLight,
    color: colors.warningDark,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  alertNoticeBox: {
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.sm,
  },
  alertNoticeText: {
    fontSize: 12,
    color: colors.warningDark,
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
  successActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

export default SendSOSScreen;
