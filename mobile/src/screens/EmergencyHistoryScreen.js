import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatCoordinates, formatTimestamp } from '../utils/helpers';

/**
 * EmergencyHistoryScreen
 *
 * Displays local emergency alert drafts and audit logs stored on device.
 *
 * Integrity Rules:
 * - Does NOT fabricate fake history records.
 * - Displays session-created demonstration drafts or a friendly empty state.
 * - Explains Step 3 SQLite database persistence.
 */
export const EmergencyHistoryScreen = ({ navigation, drafts = [], onClearDrafts }) => {
  const hasRecords = drafts.length > 0;

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
            Local offline audit log of emergency records
          </Text>
        </View>

        {/* Local Storage Architecture Note */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>💾</Text>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Offline SQLite Storage (Step 3)</Text>
            <Text style={styles.infoText}>
              In upcoming Step 3, records will be permanently persisted to encrypted
              local SQLite storage and synced automatically once cellular or Wi-Fi becomes available.
            </Text>
          </View>
        </View>

        {/* Dynamic Records List or Empty State */}
        {hasRecords ? (
          <View style={styles.recordsContainer}>
            <View style={styles.recordsHeader}>
              <Text style={styles.recordsCountTitle}>
                LOCAL SESSION DRAFTS ({drafts.length})
              </Text>
              {onClearDrafts && (
                <Text style={styles.clearText} onPress={onClearDrafts}>
                  Clear Drafts
                </Text>
              )}
            </View>

            {drafts.map((record) => (
              <View key={record.id} style={[styles.recordCard, shadows.card]}>
                <View style={styles.recordHeaderRow}>
                  <View style={styles.typeBadgeContainer}>
                    <Text style={styles.recordSymbol}>{record.symbol}</Text>
                    <Text
                      style={[
                        styles.recordTypeLabel,
                        { color: record.color || colors.textPrimary },
                      ]}
                    >
                      {record.emergencyLabel}
                    </Text>
                  </View>

                  <View style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>{record.status}</Text>
                  </View>
                </View>

                <View style={styles.recordBody}>
                  <Text style={styles.recordDetailLabel}>DETAILS</Text>
                  <Text style={styles.recordDetailText}>{record.details}</Text>

                  <View style={styles.metadataGrid}>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metaLabel}>GPS Coordinates:</Text>
                      <Text style={styles.metaValue}>
                        {formatCoordinates(
                          record.location.latitude,
                          record.location.longitude,
                          record.location.accuracy
                        )}
                      </Text>
                    </View>

                    <View style={styles.metadataItem}>
                      <Text style={styles.metaLabel}>Created At:</Text>
                      <Text style={styles.metaValue}>
                        {formatTimestamp(record.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.metadataItem}>
                      <Text style={styles.metaLabel}>Contact:</Text>
                      <Text style={styles.metaValue}>
                        {record.contactName} ({record.contactPhone})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.safetyFootnote}>
                    <Text style={styles.safetyFootnoteText}>
                      ⚠️ Demonstration record only. Not broadcasted to emergency responders.
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="📋"
            badgeText="Zero Records Found"
            title="No Emergency Alerts Recorded"
            description="You have not created any emergency reports in this session. Any SOS drafts you create from the Send SOS screen or receive over the BLE mesh will be cataloged here."
            actionLabel="Create an SOS Report"
            onAction={() => navigation.navigate('SendSOS')}
          />
        )}

        {/* Action Button */}
        <View style={styles.actionContainer}>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    marginBottom: spacing.md,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.infoDark,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: colors.infoDark,
    lineHeight: 16,
  },
  recordsContainer: {
    marginVertical: spacing.sm,
  },
  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recordsCountTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  recordCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  recordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordSymbol: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  recordTypeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  draftBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.warningDark,
  },
  recordBody: {
    paddingTop: spacing.sm,
  },
  recordDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  recordDetailText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  metadataGrid: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  metadataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  safetyFootnote: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  safetyFootnoteText: {
    fontSize: 10,
    color: colors.warningDark,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: spacing.md,
  },
});

export default EmergencyHistoryScreen;
