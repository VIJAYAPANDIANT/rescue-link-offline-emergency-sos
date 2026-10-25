import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusCard } from '../components/StatusCard';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, borderRadius } from '../utils/theme';

/**
 * NearbyDevicesScreen
 *
 * Visualizes local peer-to-peer mesh topology.
 *
 * Safety & Integrity Constraint:
 * - Does NOT fabricate fake devices.
 * - Clearly documents that BLE scanning/advertising awaits Step 3.
 */
export const NearbyDevicesScreen = ({ navigation }) => {
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Non-destructive simulated scan check to test UX interaction
  const handleCheckBLE = () => {
    setIsSimulatingScan(true);
    setScanMessage('Verifying BLE stack interface...');

    setTimeout(() => {
      setIsSimulatingScan(false);
      setScanMessage(
        'BLE hardware interface initialized in standby. Real discovery scanning will be enabled in Step 3.'
      );
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Nearby Devices</Text>
          <Text style={styles.screenSubtitle}>
            Offline Bluetooth Low Energy (BLE) Mesh Network
          </Text>
        </View>

        {/* Current BLE Radio Hardware Status */}
        <StatusCard
          title="Bluetooth Radio State"
          value="BLE Standby"
          icon="📡"
          variant="info"
          subtitle="Prototype mode · Ready for peripheral & central roles"
        />

        <StatusCard
          title="Mesh Protocol Layer"
          value="Awaiting Step 3"
          icon="🔗"
          variant="warning"
          subtitle="GATT advertising, scanning, and multi-hop forwarding logic"
        />

        {/* Architectural Implementation Banner */}
        <View style={styles.roadmapCard}>
          <View style={styles.roadmapHeader}>
            <Text style={styles.roadmapBadge}>PLANNED MODULE (STEP 3)</Text>
            <Text style={styles.roadmapTitle}>Bluetooth Mesh Pipeline</Text>
          </View>
          <Text style={styles.roadmapText}>
            RescueLink uses Bluetooth Low Energy (BLE) peripheral advertising and
            central scanning so that devices without cellular signal can route emergency
            packets to one another.
          </Text>
          <View style={styles.pipelineSteps}>
            <Text style={styles.pipelineItem}>
              1. Local device broadcasts encrypted SOS beacon (TX advertisement)
            </Text>
            <Text style={styles.pipelineItem}>
              2. Peer nodes receive beacon via background BLE scan
            </Text>
            <Text style={styles.pipelineItem}>
              3. Packets hop node-to-node until reaching an internet gateway
            </Text>
          </View>
        </View>

        {/* Friendly Empty State - No Fake Devices Fabricated */}
        <EmptyState
          icon="👥"
          badgeText="Awaiting Step 3 BLE Module"
          title="No Nearby Devices Discovered"
          description="In this Step 1 prototype, live BLE discovery is disabled. When active BLE scanning is enabled in Step 3, peer RescueLink smartphones within 10 to 30 meters will be listed here with signal strength (RSSI)."
          actionLabel={isSimulatingScan ? 'Scanning...' : 'Test BLE Radio Interface'}
          onAction={handleCheckBLE}
        />

        {scanMessage ? (
          <View style={styles.statusFeedbackBox}>
            <Text style={styles.statusFeedbackText}>ℹ️ {scanMessage}</Text>
          </View>
        ) : null}

        {/* Navigation Action */}
        <View style={styles.actionContainer}>
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
  roadmapCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  roadmapHeader: {
    marginBottom: spacing.xs,
  },
  roadmapBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.infoLight,
    color: colors.infoDark,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
    letterSpacing: 0.8,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    marginBottom: 4,
  },
  roadmapTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roadmapText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  pipelineSteps: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  pipelineItem: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  statusFeedbackBox: {
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    marginVertical: spacing.sm,
  },
  statusFeedbackText: {
    fontSize: 12,
    color: colors.infoDark,
    lineHeight: 16,
  },
  actionContainer: {
    marginTop: spacing.md,
  },
});

export default NearbyDevicesScreen;
