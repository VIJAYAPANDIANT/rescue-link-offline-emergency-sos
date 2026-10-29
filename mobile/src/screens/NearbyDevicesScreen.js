import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { bluetoothService, BLE_STATES } from '../services/bluetooth/bluetoothService';
import { AlertRepository, ReceiptRepository, SyncQueueRepository } from '../database';
import { StatusCard } from '../components/StatusCard';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatCoordinates, formatTimestamp } from '../utils/helpers';

/**
 * NearbyDevicesScreen (BLE Central / Receiver Workflow)
 *
 * Implements:
 * 1. Scanning for nearby RescueLink SOS peripheral broadcasters.
 * 2. Real discovered device list with RSSI signal metrics (no fake devices).
 * 3. Connecting to a selected sender node over GATT.
 * 4. Reading and validating the SOS distress message offline (without internet).
 * 5. Displaying distress details with offline security disclaimer and duplicate checking.
 * 6. Transmitting genuine acknowledgment over BLE (GATT write confirmation).
 * 7. Disconnecting and clean teardown on unmount.
 */
export const NearbyDevicesScreen = ({ navigation }) => {
  // BLE Hardware State
  const [hardwareStatus, setHardwareStatus] = useState('Checking BLE interface...');
  const [hardwareVariant, setHardwareVariant] = useState('info');
  const [isBleReady, setIsBleReady] = useState(false);

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

  // References for unmount cleanup
  const activeDeviceRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    activeDeviceRef.current = activeDeviceId;
  }, [activeDeviceId]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // Check BLE stack readiness on mount
  useEffect(() => {
    checkBLEAvailability();

    // Clean up scans and connections on unmount
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
    const result = await bluetoothService.checkBluetoothAvailability();
    if (result.supported) {
      if (result.state === BLE_STATES.IDLE) {
        setHardwareStatus('BLE Ready (Powered On)');
        setHardwareVariant('success');
        setIsBleReady(true);
      } else {
        setHardwareStatus('Bluetooth Disabled');
        setHardwareVariant('warning');
        setIsBleReady(false);
        setScanMessage('Please enable Bluetooth in your device settings.');
      }
    } else {
      setHardwareStatus(result.message || 'BLE Native Module Unavailable');
      setHardwareVariant('danger');
      setIsBleReady(false);
      setScanMessage(
        result.message ||
          'Native BLE requires an Expo Development Build (npx expo run:android). Not supported in Expo Go.'
      );
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
        Alert.alert(
          'Bluetooth Permissions Required',
          'RescueLink needs Bluetooth Scan & Connect permissions to discover nearby SOS alerts. Please grant them in device settings.'
        );
      }
    }
  };

  // Stop BLE Discovery Scan
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
      setScanMessage(`Connecting to ${device.name} (${device.id})...`);
      setAckStatus('none');
      setAckData(null);

      // Stop scanning before connecting
      if (isScanning) {
        bluetoothService.stopScanning();
        setIsScanning(false);
      }

      const result = await bluetoothService.connectAndReceiveAlert(
        device.id,
        async (alert) => {
          // Persist incoming BLE distress alert to SQLite
          try {
            const saveRes = await AlertRepository.saveOrUpdateAlert({
              alertId: alert.alertId,
              senderName: alert.senderName,
              emergencyType: alert.emergencyType,
              details: alert.details,
              latitude: alert.latitude,
              longitude: alert.longitude,
              source: 'bluetooth',
              deliveryStatus: 'received',
              ackStatus: 'unacknowledged',
              syncStatus: 'pending_sync',
              createdAt: alert.createdAt,
            });

            if (!saveRes.isNew) {
              alert.isDuplicate = true;
            }

            // Enqueue into offline outbox for cloud relay when connectivity is available
            try {
              await SyncQueueRepository.enqueue({
                alertId: alert.alertId,
                operation: 'CREATE',
                payload: {
                  alertId: alert.alertId,
                  emergencyType: alert.emergencyType,
                  details: alert.details,
                  latitude: alert.latitude,
                  longitude: alert.longitude,
                  source: 'bluetooth',
                  originalSenderName: alert.senderName,
                  createdAt: alert.createdAt,
                },
              });
            } catch (qErr) {
              console.warn('[NearbyDevicesScreen] SQLite queue relay warning:', qErr.message);
            }
          } catch (dbErr) {
            console.warn('[NearbyDevicesScreen] SQLite save alert warning:', dbErr.message);
          }
          setReceivedAlert(alert);
        }
      );

      if (result.success && result.alert) {
        setConnectionState(BLE_STATES.CONNECTED);
        setReceivedAlert(result.alert);
        setScanMessage(`Connected to ${device.name}. Distress alert received!`);
      }
    } catch (err) {
      console.error('[NearbyDevicesScreen] Connect/Read error:', err.message);
      setConnectionState(BLE_STATES.ERROR);
      setScanMessage(`Failed to read SOS alert: ${err.message}`);
      Alert.alert('Connection Failed', err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Transmit Genuine Acknowledgment over BLE
  const handleSendAcknowledgment = async () => {
    if (!activeDeviceId || !receivedAlert?.alertId) {
      Alert.alert('Error', 'No active connection or alert ID to acknowledge.');
      return;
    }

    try {
      setIsAcknowledging(true);
      setAckStatus('sending');

      const result = await bluetoothService.sendAcknowledgment(
        activeDeviceId,
        receivedAlert.alertId
      );

      if (result.success) {
        setAckStatus('acknowledged');
        setAckData(result.ackData);

        // Record confirmed ACK receipt in SQLite and mark alert acknowledged
        try {
          await ReceiptRepository.recordReceipt({
            alertId: receivedAlert.alertId,
            receiptType: 'BLE_ACK_SENT',
            senderOrDeviceId: activeDeviceId,
            metadata: result.ackData,
          });
        } catch (dbErr) {
          console.warn('[NearbyDevicesScreen] SQLite receipt save warning:', dbErr.message);
        }

        Alert.alert(
          '✅ Acknowledgment Transmitted',
          `Genuine BLE ACK successfully written to sender device for Alert ID ${receivedAlert.alertId}.`
        );
      }
    } catch (err) {
      console.error('[NearbyDevicesScreen] ACK error:', err.message);
      setAckStatus('failed');
      Alert.alert('Acknowledgment Failed', err.message);
    } finally {
      setIsAcknowledging(false);
    }
  };

  // Disconnect from Active Device
  const handleDisconnect = async () => {
    if (activeDeviceId) {
      await bluetoothService.disconnectDevice(activeDeviceId);
      setActiveDeviceId(null);
      setConnectionState(BLE_STATES.DISCONNECTED);
      setScanMessage('Disconnected from device.');
    }
  };

  // Clear current received alert from screen
  const handleClearAlert = () => {
    if (activeDeviceId) {
      bluetoothService.disconnectDevice(activeDeviceId);
    }
    setActiveDeviceId(null);
    setReceivedAlert(null);
    setAckStatus('none');
    setAckData(null);
    setConnectionState(BLE_STATES.IDLE);
    setScanMessage(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Nearby SOS Devices</Text>
          <Text style={styles.screenSubtitle}>
            Offline BLE Mesh Receiver · Scan, Connect & Acknowledge
          </Text>
        </View>

        {/* Hardware & BLE Status */}
        <StatusCard
          title="BLE Hardware Status"
          value={hardwareStatus}
          icon="📡"
          variant={hardwareVariant}
          subtitle="Real Bluetooth Low Energy Central subsystem"
        />

        {/* Active Connection Status if connected */}
        {activeDeviceId ? (
          <StatusCard
            title="Connected Sender Node"
            value={connectionState}
            icon="🔗"
            variant={connectionState === BLE_STATES.CONNECTED ? 'success' : 'warning'}
            subtitle={`Device ID: ${activeDeviceId}`}
          />
        ) : null}

        {/* Scan Controls */}
        <View style={styles.controlsRow}>
          {!isScanning ? (
            <PrimaryButton
              title="Start BLE Scan"
              onPress={handleStartScan}
              variant="primary"
              icon="🔍"
              disabled={isConnecting}
            />
          ) : (
            <PrimaryButton
              title="Stop BLE Scan"
              onPress={handleStopScan}
              variant="secondary"
              icon="⏹️"
            />
          )}
        </View>

        {/* Scan Message / In-progress Indicator */}
        {scanMessage ? (
          <View style={styles.statusBox}>
            {isScanning ? (
              <ActivityIndicator
                size="small"
                color={colors.info}
                style={{ marginRight: 8 }}
              />
            ) : (
              <Text style={styles.statusEmoji}>ℹ️</Text>
            )}
            <Text style={styles.statusBoxText}>{scanMessage}</Text>
          </View>
        ) : null}

        {/* Received Distress Alert Card */}
        {receivedAlert ? (
          <View style={[styles.alertCard, shadows.cardElevated]}>
            <View style={styles.alertCardHeader}>
              <View style={styles.alertBadgeRow}>
                <Text style={styles.emergencyBadge}>
                  🚨 {receivedAlert.emergencyType || 'EMERGENCY'}
                </Text>
                {receivedAlert.isDuplicate ? (
                  <Text style={styles.duplicateBadge}>DUPLICATE ALERT</Text>
                ) : null}
              </View>
              <Text style={styles.alertCardTitle}>Incoming SOS Distress Alert</Text>
            </View>

            {/* Offline Disclaimer */}
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerIcon}>⚠️</Text>
              <Text style={styles.disclaimerText}>
                Received directly over nearby Bluetooth. Not verified by a central server.
              </Text>
            </View>

            {/* Alert Content Table */}
            <View style={styles.alertDetailsTable}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Alert ID:</Text>
                <Text style={styles.detailValue} selectable>
                  {receivedAlert.alertId}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sender Name:</Text>
                <Text style={styles.detailValueBold}>
                  {receivedAlert.senderName || 'Anonymous'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Timestamp:</Text>
                <Text style={styles.detailValue}>
                  {formatTimestamp(receivedAlert.createdAt)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>GPS Coordinates:</Text>
                <Text style={styles.detailValue}>
                  {typeof receivedAlert.latitude === 'number' &&
                  typeof receivedAlert.longitude === 'number'
                    ? formatCoordinates(receivedAlert.latitude, receivedAlert.longitude)
                    : 'None (Omitted by sender)'}
                </Text>
              </View>

              {receivedAlert.details ? (
                <View style={styles.detailsBlock}>
                  <Text style={styles.detailLabel}>Distress Details:</Text>
                  <Text style={styles.detailsBlockText}>{receivedAlert.details}</Text>
                </View>
              ) : null}
            </View>

            {/* Acknowledgment Section */}
            <View style={styles.ackSection}>
              {ackStatus === 'acknowledged' ? (
                <View style={styles.ackSuccessCard}>
                  <Text style={styles.ackSuccessTitle}>✅ Acknowledgment Confirmed</Text>
                  <Text style={styles.ackSuccessText}>
                    Genuine BLE ACK sent to sender. Receiver Node ID:{' '}
                    {ackData?.receiverId || 'Local-Receiver'}
                  </Text>
                </View>
              ) : (
                <PrimaryButton
                  title={isAcknowledging ? 'Transmitting ACK...' : 'Acknowledge Receipt over BLE'}
                  onPress={handleSendAcknowledgment}
                  variant="success"
                  icon="🤝"
                  disabled={isAcknowledging}
                />
              )}
            </View>

            {/* Alert Actions: Disconnect / Clear */}
            <View style={styles.alertActionButtons}>
              <TouchableOpacity
                style={styles.disconnectBtn}
                onPress={handleDisconnect}
                activeOpacity={0.7}
              >
                <Text style={styles.disconnectBtnText}>Disconnect Device</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearAlert}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>Dismiss Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Discovered Devices List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            DISCOVERED NODES ({discoveredDevices.length})
          </Text>
          <Text style={styles.sectionCaption}>
            Real Bluetooth broadcasters discovered within range
          </Text>
        </View>

        {discoveredDevices.length === 0 ? (
          <EmptyState
            icon="👥"
            badgeText={isScanning ? 'Scan in Progress' : 'No Devices Found'}
            title="No Nearby Senders Discovered"
            description="When another device is advertising an emergency SOS beacon on the Send SOS screen, it will appear here with its signal strength (RSSI)."
            actionLabel={isScanning ? 'Scanning...' : 'Scan for Devices'}
            onAction={isScanning ? handleStopScan : handleStartScan}
          />
        ) : (
          <View style={styles.deviceList}>
            {discoveredDevices.map((device) => {
              const isSelected = activeDeviceId === device.id;
              return (
                <View
                  key={device.id}
                  style={[
                    styles.deviceCard,
                    shadows.card,
                    isSelected && styles.deviceCardActive,
                  ]}
                >
                  <View style={styles.deviceInfoRow}>
                    <View style={styles.deviceIconCircle}>
                      <Text style={styles.deviceIcon}>📱</Text>
                    </View>
                    <View style={styles.deviceDetails}>
                      <Text style={styles.deviceName}>{device.name}</Text>
                      <Text style={styles.deviceId} numberOfLines={1}>
                        ID: {device.id}
                      </Text>
                      <Text style={styles.deviceRssi}>
                        Signal: {device.rssi ? `${device.rssi} dBm` : 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deviceActionRow}>
                    {isSelected ? (
                      <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>● Connected</Text>
                      </View>
                    ) : (
                      <PrimaryButton
                        title={isConnecting ? 'Connecting...' : 'Connect & Read SOS'}
                        onPress={() => handleConnectAndReadAlert(device)}
                        variant="primary"
                        disabled={isConnecting}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Navigation Portal Back */}
        <View style={styles.footerAction}>
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
  controlsRow: {
    marginVertical: spacing.sm,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  statusEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  statusBoxText: {
    flex: 1,
    fontSize: 13,
    color: colors.infoDark,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  sectionCaption: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 1,
  },
  deviceList: {
    gap: spacing.sm,
  },
  deviceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceCardActive: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  deviceIcon: {
    fontSize: 22,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  deviceId: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  deviceRssi: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.infoDark,
    marginTop: 2,
  },
  deviceActionRow: {
    marginTop: spacing.xs,
  },
  connectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  connectedBadgeText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  alertCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginVertical: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  alertCardHeader: {
    marginBottom: spacing.sm,
  },
  alertBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 6,
  },
  emergencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    letterSpacing: 0.5,
  },
  duplicateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningLight,
    color: colors.warningDark,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    letterSpacing: 0.5,
  },
  alertCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    gap: 6,
  },
  disclaimerIcon: {
    fontSize: 16,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.warningDark,
    fontWeight: '600',
    lineHeight: 15,
  },
  alertDetailsTable: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: 8,
    marginVertical: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  detailValueBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  detailsBlock: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsBlockText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 3,
    lineHeight: 18,
  },
  ackSection: {
    marginTop: spacing.md,
  },
  ackSuccessCard: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  ackSuccessTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.successDark,
    marginBottom: 2,
  },
  ackSuccessText: {
    fontSize: 12,
    color: colors.successDark,
    lineHeight: 16,
  },
  alertActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  disconnectBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
  },
  disconnectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  footerAction: {
    marginTop: spacing.xl,
  },
});

export default NearbyDevicesScreen;
