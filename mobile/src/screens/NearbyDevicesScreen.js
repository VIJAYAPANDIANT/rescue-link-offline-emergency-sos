import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { bluetoothService, BLE_STATES } from '../services/bluetooth/bluetoothService';
import { ReceiptRepository } from '../database';
import { relayService } from '../services/relay/relayService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StatusCard } from '../components/StatusCard';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { InfoBanner } from '../components/InfoBanner';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

/**
 * NearbyDevicesScreen (BLE Central Receiver & Mesh Ingestion)
 *
 * Professional mesh peer discovery & reception flow:
 * 1. Bluetooth radio readiness check with permission guidance
 * 2. Active scanning with RSSI signal indicators and timeout controls
 * 3. GATT connection & SOS payload decoding
 * 4. Two-way BLE acknowledgment (ACK) reply
 * 5. Multi-device mesh relay forwarding
 */
export const NearbyDevicesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  // BLE Hardware State
  const [hardwareStatus, setHardwareStatus] = useState('Checking BLE radio...');
  const [hardwareVariant, setHardwareVariant] = useState('info');
  const [isBleReady, setIsBleReady] = useState(false);
  const [permissionMissing, setPermissionMissing] = useState(false);

  // Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [scanMessage, setScanMessage] = useState(null);

  // Connection State
  const [activeDeviceId, setActiveDeviceId] = useState(null);
  const [connectionState, setConnectionState] = useState(BLE_STATES.IDLE);
  const [isConnecting, setIsConnecting] = useState(false);

  // Received Alert State
  const [receivedAlert, setReceivedAlert] = useState(null);
  const [ackStatus, setAckStatus] = useState('none'); // 'none' | 'sending' | 'acknowledged' | 'failed'
  const [ackData, setAckData] = useState(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  // Relay State
  const [isForwardingRelay, setIsForwardingRelay] = useState(false);
  const [relayForwardStatus, setRelayForwardStatus] = useState(null);

  const activeDeviceRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    activeDeviceRef.current = activeDeviceId;
  }, [activeDeviceId]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    checkBLEAvailability();

    return () => {
      if (isScanningRef.current) {
        bluetoothService.stopScanning();
      }
      if (activeDeviceRef.current) {
        bluetoothService.disconnectDevice(activeDeviceRef.current);
      }
    };
  }, []);

  const checkBLEAvailability = async () => {
    try {
      const result = await bluetoothService.checkBluetoothAvailability();
      if (result.supported) {
        if (result.state === BLE_STATES.IDLE || result.state === 'PoweredOn') {
          setHardwareStatus('BLE Ready (Powered On)');
          setHardwareVariant('success');
          setIsBleReady(true);
          setPermissionMissing(false);
        } else if (result.state === BLE_STATES.PERMISSION_REQUIRED) {
          setHardwareStatus('Permissions Required');
          setHardwareVariant('warning');
          setIsBleReady(false);
          setPermissionMissing(true);
          setScanMessage('Android requires Nearby Devices & Location permissions for BLE scanning.');
        } else {
          setHardwareStatus('Bluetooth Disabled');
          setHardwareVariant('warning');
          setIsBleReady(false);
          setScanMessage('Please enable Bluetooth in your device settings.');
        }
      } else {
        setHardwareStatus('Native BLE Module Required');
        setHardwareVariant('info');
        setIsBleReady(false);
        setScanMessage(
          result.message || 'Native BLE scanning requires an Expo Development Client build (npx expo run:android).'
        );
      }
    } catch {
      setHardwareStatus('BLE Standby');
      setHardwareVariant('info');
      setIsBleReady(true);
    }
  };

  // Start BLE Discovery Scan
  const handleStartScan = async () => {
    setScanMessage(null);
    setDiscoveredDevices([]);

    const result = await bluetoothService.startScanningForSenders({
      onDeviceFound: (device) => {
        setDiscoveredDevices((prev) => {
          const exists = prev.some((d) => d.id === device.id);
          if (exists) {
            return prev.map((d) => (d.id === device.id ? device : d));
          }
          return [...prev, device];
        });
      },
      onError: (err) => {
        setIsScanning(false);
        setScanMessage(`Scan error: ${err.message}`);
      },
      onScanStopped: () => {
        setIsScanning(false);
        setScanMessage('Scan window concluded (30s timeout).');
      },
    });

    if (result.success) {
      setIsScanning(true);
      setScanMessage('Scanning for nearby RescueLink SOS beacons...');
    } else {
      setIsScanning(false);
      setScanMessage(result.error || 'Failed to start BLE scan.');
      if (result.state === BLE_STATES.PERMISSION_REQUIRED) {
        setPermissionMissing(true);
      }
    }
  };

  // Stop Scan
  const handleStopScan = () => {
    bluetoothService.stopScanning();
    setIsScanning(false);
    setScanMessage('Scan stopped by user.');
  };

  // Connect to Discovered Device & Read SOS Alert
  const handleConnectAndReadAlert = async (device) => {
    try {
      setIsConnecting(true);
      setActiveDeviceId(device.id);
      setConnectionState(BLE_STATES.CONNECTING);
      setScanMessage(`Connecting to ${device.name || 'RescueLink Node'} (${device.id})...`);
      setAckStatus('none');
      setAckData(null);

      if (isScanning) {
        bluetoothService.stopScanning();
        setIsScanning(false);
      }

      const result = await bluetoothService.connectAndReceiveAlert(
        device.id,
        async (alert) => {
          try {
            const relayResult = await relayService.processIncomingRelayAlert(
              alert,
              device.id,
              user?.id
            );

            if (relayResult.alert) {
              setReceivedAlert({
                ...alert,
                ...relayResult.alert,
                isDuplicate: relayResult.isDuplicate || false,
                eligibleToForward: relayResult.eligibleToForward,
                relayReason: relayResult.reason,
              });
            } else {
              setReceivedAlert({
                ...alert,
                eligibleToForward: false,
                relayReason: relayResult.reason || 'Rejected by mesh relay policy',
              });
            }
          } catch (dbErr) {
            console.warn('[NearbyDevicesScreen] Relay processing warning:', dbErr.message);
            setReceivedAlert(alert);
          }
        }
      );

      if (result.success && result.alert) {
        setConnectionState(BLE_STATES.CONNECTED);
        setScanMessage(`Connected to ${device.name || 'Peer'}. Distress alert received!`);
      }
    } catch (err) {
      setConnectionState(BLE_STATES.ERROR);
      setScanMessage(`Failed to read SOS alert: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Transmit Genuine BLE Acknowledgment (ACK)
  const handleSendAcknowledgment = async () => {
    if (!activeDeviceId || !receivedAlert) return;

    try {
      setIsAcknowledging(true);
      setAckStatus('sending');

      const targetAlertId = receivedAlert.alertId || receivedAlert.id;
      const ackPayload = {
        alertId: targetAlertId,
        receiverId: user?.id || 'anonymous_rescuer',
        receivedAt: new Date().toISOString(),
      };

      const result = await bluetoothService.sendAcknowledgment(
        activeDeviceId,
        ackPayload
      );

      if (result.success) {
        setAckStatus('acknowledged');
        setAckData(ackPayload);

        try {
          await ReceiptRepository.recordReceipt({
            alertId: targetAlertId,
            receiptType: 'BLE_ACK_SENT',
            senderOrDeviceId: activeDeviceId,
            metadata: ackPayload,
          });
        } catch (dbErr) {
          console.warn('[NearbyDevicesScreen] SQLite receipt recording warning:', dbErr.message);
        }

        Alert.alert(
          '✓ Acknowledgment Transmitted',
          'Your confirmation receipt was written to the sender node over Bluetooth Low Energy.'
        );
      } else {
        setAckStatus('failed');
      }
    } catch {
      setAckStatus('failed');
    } finally {
      setIsAcknowledging(false);
    }
  };

  // Forward Alert over Mesh Relay
  const handleForwardAlert = async () => {
    if (!receivedAlert || !receivedAlert.eligibleToForward) return;

    try {
      setIsForwardingRelay(true);
      setRelayForwardStatus('Forwarding distress beacon over BLE mesh...');

      const forwardResult = await relayService.forwardRelayAlert(
        receivedAlert,
        user?.id
      );

      if (forwardResult.success) {
        setRelayForwardStatus(`Alert re-broadcasted! Relayed as Hop ${forwardResult.hopCount}`);
        setReceivedAlert((prev) => ({
          ...prev,
          hopCount: forwardResult.hopCount,
          eligibleToForward: false,
          relayStatus: 'forwarded',
        }));
      } else {
        setRelayForwardStatus(`Relay suppressed: ${forwardResult.reason}`);
      }
    } catch (err) {
      setRelayForwardStatus(`Relay failed: ${err.message}`);
    } finally {
      setIsForwardingRelay(false);
    }
  };

  const getRssiBadge = (rssi) => {
    if (!rssi) return { text: 'N/A', variant: 'info' };
    if (rssi > -65) return { text: `${rssi} dBm (Strong)`, variant: 'success' };
    if (rssi > -80) return { text: `${rssi} dBm (Fair)`, variant: 'warning' };
    return { text: `${rssi} dBm (Weak)`, variant: 'danger' };
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
            Nearby Mesh Peers
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Discover distress beacons and relay emergency alerts off-grid
          </Text>
        </View>

        {/* Permission Guidance Banner */}
        {permissionMissing ? (
          <InfoBanner
            variant="warning"
            icon="⚠️"
            title="Bluetooth Permissions Required"
            message="Android requires 'Nearby Devices' and 'Location' permissions for Bluetooth Low Energy discovery. Coordinates are not tracked; this is an OS security requirement for BLE radio scanning."
            actionLabel="Review Settings"
            onAction={checkBLEAvailability}
            style={{ marginHorizontal: spacing.lg }}
          />
        ) : null}

        {/* Hardware Status */}
        <View style={styles.statusSection}>
          <StatusCard
            title="Bluetooth Subsystem"
            value={hardwareStatus}
            icon="📡"
            variant={hardwareVariant}
            subtitle={
              isScanning
                ? 'Central scanner actively listening on service UUID 0000FE60...'
                : 'Central scanner in standby'
            }
          />
        </View>

        {/* Scan Action Controls */}
        <View style={styles.scanControls}>
          {!isScanning ? (
            <PrimaryButton
              title="Start BLE Discovery Scan"
              onPress={handleStartScan}
              variant="primary"
              icon="🔍"
              size="lg"
            />
          ) : (
            <PrimaryButton
              title="Stop Scanning"
              onPress={handleStopScan}
              variant="secondary"
              icon="⏹️"
              size="lg"
            />
          )}

          {isScanning ? (
            <View style={[styles.scanningIndicator, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.info} style={{ marginRight: 8 }} />
              <Text style={[styles.scanningText, { color: colors.textPrimary }]}>
                Scanning BLE spectrum (30s window)...
              </Text>
            </View>
          ) : null}

          {scanMessage && !isScanning ? (
            <Text style={[styles.scanMessageText, { color: colors.textMuted }]}>
              {scanMessage}
            </Text>
          ) : null}
        </View>

        {/* Received Distress Alert Card */}
        {receivedAlert ? (
          <View
            style={[
              styles.receivedAlertCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.primaryBorder,
              },
              shadows.cardElevated,
            ]}
          >
            <View style={styles.receivedAlertHeader}>
              <View style={styles.receivedAlertTitleRow}>
                <Text style={styles.alertIcon}>🚨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.receivedAlertTitle, { color: colors.textPrimary }]}>
                    Incoming Emergency Distress Beacon
                  </Text>
                  <Text style={[styles.receivedAlertSub, { color: colors.textSecondary }]}>
                    Received via direct BLE GATT characteristic read
                  </Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <StatusBadge type="category" value={receivedAlert.emergencyType} size="sm" />
                <StatusBadge type="source" value="bluetooth_relay" size="sm" label={`Hop ${receivedAlert.hopCount || 0}`} />
              </View>
            </View>

            <View style={[styles.alertDetailGrid, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>Survivor Name</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                  {receivedAlert.senderName || 'Anonymous Survivor'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>Alert UUID</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]} numberOfLines={1}>
                  {receivedAlert.alertId || receivedAlert.id}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textMuted }]}>GPS Coordinates</Text>
                <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
                  {receivedAlert.latitude && receivedAlert.longitude
                    ? `${Number(receivedAlert.latitude).toFixed(4)}°, ${Number(receivedAlert.longitude).toFixed(4)}°`
                    : 'Omitted (No GPS Attached)'}
                </Text>
              </View>

              {receivedAlert.details ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Survivor Message</Text>
                  <Text style={[styles.detailVal, { color: colors.textPrimary }]} numberOfLines={3}>
                    {receivedAlert.details}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Acknowledgment & Relay Action Buttons */}
            <View style={styles.responseActions}>
              {ackStatus !== 'acknowledged' ? (
                <PrimaryButton
                  title="Send Peer Confirmation (ACK)"
                  onPress={handleSendAcknowledgment}
                  variant="success"
                  loading={isAcknowledging}
                  icon="🤝"
                />
              ) : (
                <View style={[styles.ackConfirmedBox, { backgroundColor: colors.successLight, borderColor: colors.successBorder }]}>
                  <Text style={[styles.ackConfirmedText, { color: colors.successDark }]}>
                    ✓ Peer Acknowledgment Delivered over Bluetooth
                  </Text>
                </View>
              )}

              {receivedAlert.eligibleToForward ? (
                <PrimaryButton
                  title="Forward over Mesh Relay"
                  onPress={handleForwardAlert}
                  variant="navy"
                  loading={isForwardingRelay}
                  icon="📡"
                  style={{ marginTop: spacing.xs }}
                />
              ) : (
                <Text style={[styles.relayReasonText, { color: colors.textMuted }]}>
                  Mesh relay: {receivedAlert.relayReason || 'Maximum hop depth reached'}
                </Text>
              )}

              {relayForwardStatus ? (
                <Text style={[styles.relayStatusReport, { color: colors.infoDark }]}>
                  {relayForwardStatus}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Discovered Devices Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            DISCOVERED BLUETOOTH PEERS ({discoveredDevices.length})
          </Text>
        </View>

        {discoveredDevices.length > 0 ? (
          <View style={styles.devicesList}>
            {discoveredDevices.map((device) => {
              const rssiInfo = getRssiBadge(device.rssi);
              const isCurrent = activeDeviceId === device.id;

              return (
                <View
                  key={device.id}
                  style={[
                    styles.deviceCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: isCurrent ? colors.info : colors.border,
                    },
                    shadows.card,
                  ]}
                >
                  <View style={styles.deviceHeaderRow}>
                    <View style={styles.deviceIconCircle}>
                      <Text style={styles.deviceIcon}>📱</Text>
                    </View>

                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={[styles.deviceName, { color: colors.textPrimary }]}>
                        {device.name || 'RescueLink Peripheral'}
                      </Text>
                      <Text style={[styles.deviceMac, { color: colors.textMuted }]}>
                        ID: {device.id}
                      </Text>
                    </View>

                    <StatusBadge
                      type="generic"
                      value={rssiInfo.text}
                      size="sm"
                    />
                  </View>

                  <View style={styles.deviceActionRow}>
                    <PrimaryButton
                      title={
                        isConnecting && isCurrent
                          ? 'Connecting & Reading...'
                          : 'Connect & Read Alert'
                      }
                      onPress={() => handleConnectAndReadAlert(device)}
                      variant={isCurrent ? 'navy' : 'primary'}
                      loading={isConnecting && isCurrent}
                      icon="📥"
                      size="sm"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="📡"
            title="No Nearby Peers Detected"
            description="Tap 'Start BLE Discovery Scan' to search for active RescueLink emergency beacons within 10–30 meters."
            style={{ marginHorizontal: spacing.lg }}
          />
        )}
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
  screenTitle: {
    ...typography.header,
    fontWeight: '800',
  },
  screenSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  statusSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  scanControls: {
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  scanningText: {
    ...typography.bodySmallBold,
  },
  scanMessageText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  devicesList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  deviceCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginRight: spacing.sm,
  },
  deviceIcon: {
    fontSize: 18,
  },
  deviceName: {
    ...typography.cardTitle,
    fontSize: 14,
    fontWeight: '700',
  },
  deviceMac: {
    ...typography.caption,
    marginTop: 1,
  },
  deviceActionRow: {
    marginTop: spacing.xs,
  },
  receivedAlertCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginVertical: spacing.sm,
  },
  receivedAlertHeader: {
    marginBottom: spacing.md,
  },
  receivedAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  receivedAlertTitle: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  receivedAlertSub: {
    ...typography.caption,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  alertDetailGrid: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    ...typography.caption,
    fontWeight: '600',
  },
  detailVal: {
    ...typography.bodySmallBold,
    maxWidth: '65%',
    textAlign: 'right',
  },
  responseActions: {
    gap: spacing.xs,
  },
  ackConfirmedBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  ackConfirmedText: {
    ...typography.bodySmallBold,
  },
  relayReasonText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  relayStatusReport: {
    ...typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default NearbyDevicesScreen;
