import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api/apiClient';
import { relaySettings } from '../services/relay/relaySettings';
import { RelayRepository } from '../database';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

export const ProfileScreen = ({ navigation }) => {
  const { user, token, isAuthenticated, logout } = useAuth();
  const [serverUrlInput, setServerUrlInput] = useState(apiClient.getBaseUrl());
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState(null);

  // Step 8: Multi-Device Mesh Relay State
  const [relayEnabled, setRelayEnabled] = useState(relaySettings.isRelayEnabled());
  const [maxHops, setMaxHops] = useState(relaySettings.getMaxHops());
  const [nodeId, setNodeId] = useState(relaySettings.getNodeId());
  const [relayStats, setRelayStats] = useState({ totalReceived: 0, totalForwarded: 0, totalDropped: 0 });

  useEffect(() => {
    const loadRelayData = async () => {
      await relaySettings.initialize();
      setRelayEnabled(relaySettings.isRelayEnabled());
      setMaxHops(relaySettings.getMaxHops());
      setNodeId(relaySettings.getNodeId());

      try {
        const stats = await RelayRepository.getRelayStats();
        setRelayStats(stats);
      } catch (e) {
        // Table not yet migrated or empty
      }
    };
    loadRelayData();
  }, []);

  const handleToggleRelay = async (val) => {
    setRelayEnabled(val);
    await relaySettings.setRelayEnabled(val);
  };

  const handleSelectMaxHops = async (hops) => {
    setMaxHops(hops);
    await relaySettings.setMaxHops(hops);
  };

  const handleTestGateway = async () => {
    setIsTestingGateway(true);
    setGatewayStatus(null);
    try {
      apiClient.setBaseUrl(serverUrlInput);
      const res = await apiClient.checkHealth();
      if (res.success) {
        setGatewayStatus({
          success: true,
          message: `Reachable! ${res.data?.message || 'Server is online.'}`,
        });
      } else {
        setGatewayStatus({
          success: false,
          message: res.error || 'Server unreachable at this address.',
        });
      }
    } catch (err) {
      setGatewayStatus({
        success: false,
        message: err.message || 'Connection failed.',
      });
    } finally {
      setIsTestingGateway(false);
    }
  };

  const handleResetGateway = () => {
    apiClient.resetBaseUrl();
    const defaultUrl = apiClient.getBaseUrl();
    setServerUrlInput(defaultUrl);
    setGatewayStatus({
      success: true,
      message: `Reset to default: ${defaultUrl}`,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Responder Profile</Text>
          <Text style={styles.screenSubtitle}>
            Cryptographic identity & cloud synchronization settings
          </Text>
        </View>

        {isAuthenticated && user ? (
          <View style={styles.profileContainer}>
            {/* User Identity Card */}
            <View style={[styles.profileCard, shadows.cardElevated]}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.avatarInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.jwtBadge}>
                    <Text style={styles.jwtBadgeText}>AUTHENTICATED VIA JWT</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Account Metadata */}
              <View style={styles.metadataList}>
                <View style={styles.metadataRow}>
                  <Text style={styles.metaLabel}>Responder ID:</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {user.id}
                  </Text>
                </View>

                <View style={styles.metadataRow}>
                  <Text style={styles.metaLabel}>Registered At:</Text>
                  <Text style={styles.metaValue}>
                    {formatTimestamp(user.createdAt)}
                  </Text>
                </View>

                <View style={styles.metadataRow}>
                  <Text style={styles.metaLabel}>Auth Mechanism:</Text>
                  <Text style={styles.metaValue}>JSON Web Token (HMAC SHA-256)</Text>
                </View>

                <View style={styles.metadataRow}>
                  <Text style={styles.metaLabel}>Token Payload:</Text>
                  <Text style={styles.metaValueToken} numberOfLines={2}>
                    {token ? `${token.substring(0, 32)}...` : 'Active'}
                  </Text>
                </View>
              </View>

              <View style={styles.authNoticeBox}>
                <Text style={styles.authNoticeText}>
                  🔒 When offline, your device can still sign local SOS beacons. When online,
                  your JWT allows seamless relay into the backend emergency ledger.
                </Text>
              </View>

              <PrimaryButton
                title="Log Out of Session"
                onPress={logout}
                variant="outline"
                icon="🚪"
                style={styles.logoutButton}
              />
            </View>
          </View>
        ) : (
          <View style={styles.guestContainer}>
            <EmptyState
              icon="👤"
              badgeText="Guest Responder Mode"
              title="Not Logged In"
              description="You are currently running RescueLink as a local guest. You can still trigger and compose offline SOS broadcasts, but cloud synchronization requires an authenticated responder account."
              actionLabel="Sign In with Account"
              onAction={() => navigation.navigate('Login')}
            />

            <PrimaryButton
              title="Create New Responder Profile"
              onPress={() => navigation.navigate('Register')}
              variant="primary"
              icon="📝"
            />
          </View>
        )}

        {/* Step 8: Multi-Device SOS Mesh Relay Settings */}
        <View style={[styles.profileCard, shadows.card, { marginTop: spacing.md }]}>
          <View style={styles.relayToggleHeader}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={styles.cardHeaderTitle}>📡 SOS Mesh Relay Network</Text>
              <Text style={styles.cardHeaderCaption}>
                Cooperate in emergency forwarding to help nearby distress beacons reach rescuers.
              </Text>
            </View>
            <Switch
              value={relayEnabled}
              onValueChange={handleToggleRelay}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={relayEnabled ? colors.primary : colors.surfaceSubtle}
            />
          </View>

          {/* Node Identity Box */}
          <View style={styles.nodeIdBox}>
            <View>
              <Text style={styles.nodeIdLabel}>ANONYMOUS MESH NODE ID</Text>
              <Text style={styles.nodeIdValue}>{nodeId || 'Generating...'}</Text>
            </View>
            <View style={styles.privacyBadge}>
              <Text style={styles.privacyBadgeText}>🔒 PRIVACY PRESERVED</Text>
            </View>
          </View>
          <Text style={styles.nodeIdExplanation}>
            This randomized identifier routes multi-hop packets without leaking your name, phone, or email.
          </Text>

          <View style={styles.divider} />

          {/* Maximum Hops Selector */}
          <Text style={styles.inputLabel}>Maximum Relay Hops:</Text>
          <View style={styles.hopsRow}>
            {[1, 2, 3, 4, 5].map((h) => {
              const isSelected = maxHops === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.hopPill, isSelected && styles.hopPillActive]}
                  onPress={() => handleSelectMaxHops(h)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.hopPillText, isSelected && styles.hopPillTextActive]}>
                    {h} Hop{h > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hopsExplanation}>
            Controls how many sequential devices may forward an SOS before it halts to prevent network saturation.
          </Text>

          <View style={styles.divider} />

          {/* Relay Statistics */}
          <Text style={styles.inputLabel}>Relay Network Activity:</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{relayStats.totalForwarded}</Text>
              <Text style={styles.statLabel}>Forwarded</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{relayStats.totalReceived}</Text>
              <Text style={styles.statLabel}>Received</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{relayStats.totalDropped}</Text>
              <Text style={styles.statLabel}>Filtered / Dropped</Text>
            </View>
          </View>
        </View>

        {/* Emergency Contacts & Notifications Section */}
        <View style={[styles.profileCard, shadows.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardHeaderTitle}>🚨 Emergency Contacts & SOS Alerts</Text>
          <Text style={styles.cardHeaderCaption}>
            Manage trusted emergency contacts and review multi-channel (Email / SMS) delivery status.
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <PrimaryButton
              title="Manage Emergency Contacts"
              onPress={() => navigation.navigate('Contacts')}
              variant="primary"
              icon="👥"
            />
            <PrimaryButton
              title="View SOS Notification Logs"
              onPress={() => navigation.navigate('NotificationHistory')}
              variant="outline"
              icon="🔔"
            />
          </View>
        </View>

        {/* Server Gateway & Network Settings */}
        <View style={[styles.profileCard, shadows.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardHeaderTitle}>🌐 Server Gateway Configuration</Text>
          <Text style={styles.cardHeaderCaption}>
            Configure the Express backend API address for Android emulators, physical devices, or LAN testing.
          </Text>

          <Text style={styles.inputLabel}>Backend API Base URL:</Text>
          <TextInput
            style={styles.gatewayInput}
            value={serverUrlInput}
            onChangeText={setServerUrlInput}
            placeholder="http://192.168.1.X:5000/api"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.gatewayButtonRow}>
            <TouchableOpacity
              style={[styles.gatewayTestBtn, isTestingGateway && styles.btnDisabled]}
              onPress={handleTestGateway}
              disabled={isTestingGateway}
              activeOpacity={0.8}
            >
              {isTestingGateway ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.gatewayTestBtnText}>Test Connection</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gatewayResetBtn}
              onPress={handleResetGateway}
              activeOpacity={0.8}
            >
              <Text style={styles.gatewayResetBtnText}>Reset Default</Text>
            </TouchableOpacity>
          </View>

          {gatewayStatus && (
            <View
              style={[
                styles.gatewayStatusBox,
                gatewayStatus.success ? styles.statusSuccess : styles.statusError,
              ]}
            >
              <Text style={styles.gatewayStatusText}>
                {gatewayStatus.success ? '✅ ' : '⚠️ '}
                {gatewayStatus.message}
              </Text>
            </View>
          )}
        </View>

        {/* Security & Protocol Safeguards */}
        <View style={[styles.profileCard, shadows.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardHeaderTitle}>🛡️ Security & Privacy Safeguards</Text>
          <View style={styles.securityItem}>
            <Text style={styles.securityBullet}>•</Text>
            <Text style={styles.securityText}>
              <Text style={{ fontWeight: '700' }}>Credential Isolation:</Text> Passwords, bcrypt hashes, and JWT tokens are strictly stripped and never transmitted over Bluetooth Low Energy.
            </Text>
          </View>
          <View style={styles.securityItem}>
            <Text style={styles.securityBullet}>•</Text>
            <Text style={styles.securityText}>
              <Text style={{ fontWeight: '700' }}>Relay Integrity:</Text> Peer distress alerts relayed via Bluetooth are tagged as <Text style={{ fontStyle: 'italic' }}>bluetooth_relay</Text>, recording the authenticated relaying node without forging sender identity.
            </Text>
          </View>
          <View style={styles.securityItem}>
            <Text style={styles.securityBullet}>•</Text>
            <Text style={styles.securityText}>
              <Text style={{ fontWeight: '700' }}>Payload Boundaries:</Text> BLE packets are validated against a 512-byte MTU limit to prevent buffer overruns and packet fragmentation.
            </Text>
          </View>
        </View>

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
  profileContainer: {
    marginVertical: spacing.sm,
  },
  profileCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  jwtBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  jwtBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.successDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  metadataList: {
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaValueToken: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.infoDark,
    maxWidth: 200,
  },
  authNoticeBox: {
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  authNoticeText: {
    fontSize: 11,
    color: colors.infoDark,
    lineHeight: 16,
  },
  logoutButton: {
    marginTop: spacing.xs,
  },
  guestContainer: {
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  actionContainer: {
    marginTop: spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardHeaderCaption: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  gatewayInput: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: spacing.md,
  },
  gatewayButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gatewayTestBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayTestBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  gatewayResetBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayResetBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  gatewayStatusBox: {
    marginTop: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  statusError: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  gatewayStatusText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  securityItem: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    paddingRight: spacing.sm,
  },
  securityBullet: {
    fontSize: 14,
    color: colors.primary,
    marginRight: 6,
    lineHeight: 18,
  },
  securityText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    flex: 1,
  },
  relayToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nodeIdBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  nodeIdLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  nodeIdValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  privacyBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  privacyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.successDark,
  },
  nodeIdExplanation: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  hopsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  hopPill: {
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  hopPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  hopPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hopPillTextActive: {
    color: colors.textInverse,
  },
  hopsExplanation: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default ProfileScreen;
