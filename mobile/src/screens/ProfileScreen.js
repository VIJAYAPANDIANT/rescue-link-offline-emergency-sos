import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/api/apiClient';
import { relaySettings } from '../services/relay/relaySettings';
import { RelayRepository } from '../database';
import { PrimaryButton } from '../components/PrimaryButton';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { InfoBanner } from '../components/InfoBanner';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';

/**
 * ProfileScreen (Settings & Operational Configuration)
 *
 * Professional responder configuration center:
 * 1. User Profile & Role Authorization
 * 2. Visual Theme Customization (Light, Dark, System)
 * 3. Bluetooth Mesh Relay Settings (Hops limit, node ID, stats)
 * 4. Privacy & Location Consent Settings
 * 5. Dynamic Cloud Gateway Endpoint Diagnostics
 * 6. Guarded Session Sign-Out
 */
export const ProfileScreen = ({ navigation }) => {
  const { user, token, isAuthenticated, logout } = useAuth();
  const { colors, isDark, mode, setMode } = useTheme();

  // Gateway state
  const [serverUrlInput, setServerUrlInput] = useState(apiClient.getBaseUrl());
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState(null);

  // Mesh Relay state
  const [relayEnabled, setRelayEnabled] = useState(relaySettings.isRelayEnabled());
  const [maxHops, setMaxHops] = useState(relaySettings.getMaxHops());
  const [nodeId, setNodeId] = useState(relaySettings.getNodeId());
  const [relayStats, setRelayStats] = useState({ totalReceived: 0, totalForwarded: 0, totalDropped: 0 });

  // Logout modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const loadRelayData = async () => {
      await relaySettings.initialize();
      setRelayEnabled(relaySettings.isRelayEnabled());
      setMaxHops(relaySettings.getMaxHops());
      setNodeId(relaySettings.getNodeId());

      try {
        const stats = await RelayRepository.getRelayStats();
        setRelayStats(stats || { totalReceived: 0, totalForwarded: 0, totalDropped: 0 });
      } catch {
        // Table not yet migrated
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
          message: `Endpoint Verified (HTTP 200). ${res.data?.message || 'Server online.'}`,
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
        message: err.message || 'Connection attempt failed.',
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

  const themeOptions = [
    { key: 'system', label: 'System Default', icon: '📱' },
    { key: 'light', label: 'Light Theme', icon: '☀️' },
    { key: 'dark', label: 'Dark Navy', icon: '🌙' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
            Settings & Profile
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Configure mesh routing, visual theme, privacy, and endpoints
          </Text>
        </View>

        {/* Section 1: Responder Profile */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>RESPONDER SESSION</Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
            shadows.card,
          ]}
        >
          {isAuthenticated && user ? (
            <View>
              <View style={styles.profileHeaderRow}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={styles.avatarIcon}>🛡️</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: colors.textPrimary }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: isDark ? '#172554' : '#EFF6FF', borderColor: colors.infoBorder }]}>
                    <Text style={[styles.roleBadgeText, { color: colors.infoDark }]}>
                      ROLE: {(user.role || 'CITIZEN').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.tokenBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <Text style={[styles.tokenLabel, { color: colors.textMuted }]}>AUTH MECHANISM</Text>
                <Text style={[styles.tokenValue, { color: colors.textPrimary }]}>
                  JWT Bearer Token (HMAC SHA-256) · 7-day Session
                </Text>
              </View>

              <PrimaryButton
                title="Sign Out of Session"
                onPress={() => setShowLogoutModal(true)}
                variant="outline"
                icon="🚪"
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : (
            <View style={styles.guestContainer}>
              <Text style={styles.guestIcon}>👤</Text>
              <Text style={[styles.guestTitle, { color: colors.textPrimary }]}>
                Guest Responder Mode
              </Text>
              <Text style={[styles.guestDesc, { color: colors.textSecondary }]}>
                You can create local SOS alerts and broadcast over Bluetooth. Signing in enables automatic cloud synchronization with central emergency servers.
              </Text>
              <View style={styles.guestBtnRow}>
                <PrimaryButton
                  title="Sign In"
                  onPress={() => navigation.navigate('Login')}
                  variant="primary"
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <PrimaryButton
                  title="Register"
                  onPress={() => navigation.navigate('Register')}
                  variant="outline"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>

        {/* Section 2: Visual Theme Selector */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>VISUAL THEME & ACCESSIBILITY</Text>
          <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
            High-contrast visual styling designed for low-light rescue operations
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
            shadows.card,
          ]}
        >
          <View style={styles.themeOptionsRow}>
            {themeOptions.map((opt) => {
              const isSel = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeOptionBtn,
                    {
                      backgroundColor: isSel
                        ? colors.navyDark
                        : (isDark ? colors.surfaceSubtle : colors.cardBackground),
                      borderColor: isSel ? colors.navy : colors.borderDark,
                    },
                  ]}
                  onPress={() => setMode(opt.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={styles.themeOptionIcon}>{opt.icon}</Text>
                  <Text
                    style={[
                      styles.themeOptionLabel,
                      { color: isSel ? '#FFFFFF' : colors.textPrimary, fontWeight: isSel ? '800' : '600' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 3: Mesh Relay Settings */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>BLUETOOTH LE MESH RELAY</Text>
          <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
            Epidemic multi-hop store-and-forward emergency networking
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
            shadows.card,
          ]}
        >
          <View style={styles.relayToggleRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Participate in Mesh Relay
              </Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Allows your device to forward encrypted distress beacons from nearby offline survivors.
              </Text>
            </View>

            <Switch
              value={relayEnabled}
              onValueChange={handleToggleRelay}
              trackColor={{ false: colors.borderDark, true: colors.success }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle mesh relay participation"
            />
          </View>

          <View style={[styles.nodeIdBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.nodeIdLabel, { color: colors.textMuted }]}>ANONYMOUS MESH NODE ID</Text>
              <Text style={[styles.nodeIdVal, { color: colors.textPrimary }]}>{nodeId || 'node-local'}</Text>
            </View>
            <View style={[styles.privacyPill, { backgroundColor: colors.successLight, borderColor: colors.successBorder }]}>
              <Text style={[styles.privacyPillText, { color: colors.successDark }]}>🔒 ANONYMIZED</Text>
            </View>
          </View>

          {/* Max Hops Stepper */}
          <View style={styles.hopsSection}>
            <Text style={[styles.hopsLabel, { color: colors.textSecondary }]}>
              MAXIMUM RELAY HOP LIMIT (1–5)
            </Text>
            <View style={styles.hopsRow}>
              {[1, 2, 3, 4, 5].map((h) => {
                const isSelected = maxHops === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.hopBtn,
                      {
                        backgroundColor: isSelected
                          ? colors.navyDark
                          : (isDark ? colors.surfaceSubtle : colors.cardBackground),
                        borderColor: isSelected ? colors.navy : colors.borderDark,
                      },
                    ]}
                    onPress={() => handleSelectMaxHops(h)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${h} hops`}
                  >
                    <Text
                      style={[
                        styles.hopBtnText,
                        { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '800' : '600' },
                      ]}
                    >
                      {h} Hop{h > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Relay Telemetry Stats */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.info }]}>{relayStats.totalReceived || 0}</Text>
              <Text style={[styles.statKey, { color: colors.textMuted }]}>Received</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.success }]}>{relayStats.totalForwarded || 0}</Text>
              <Text style={[styles.statKey, { color: colors.textMuted }]}>Forwarded</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.textMuted }]}>{relayStats.totalDropped || 0}</Text>
              <Text style={[styles.statKey, { color: colors.textMuted }]}>Loop Discards</Text>
            </View>
          </View>
        </View>

        {/* Section 4: Cloud Gateway Diagnostics */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>CLOUD GATEWAY ENDPOINT</Text>
          <Text style={[styles.sectionCaption, { color: colors.textMuted }]}>
            Configurable server URL for local drills or field command posts
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
            shadows.card,
          ]}
        >
          <TextInput
            style={[
              styles.urlInput,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.borderDark,
                color: colors.textPrimary,
              },
            ]}
            value={serverUrlInput}
            onChangeText={setServerUrlInput}
            placeholder="http://localhost:5000/api"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Gateway server URL"
          />

          <View style={styles.gatewayActionsRow}>
            <PrimaryButton
              title={isTestingGateway ? 'Testing...' : 'Test Connection'}
              onPress={handleTestGateway}
              variant="primary"
              loading={isTestingGateway}
              icon="⚡"
              size="sm"
              style={{ flex: 1.5, marginRight: spacing.sm }}
            />

            <PrimaryButton
              title="Reset Default"
              onPress={handleResetGateway}
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
            />
          </View>

          {gatewayStatus ? (
            <View
              style={[
                styles.gatewayStatusBox,
                {
                  backgroundColor: gatewayStatus.success
                    ? (isDark ? '#052E16' : '#DCFCE7')
                    : (isDark ? '#450A0A' : '#FEE2E2'),
                  borderColor: gatewayStatus.success
                    ? (isDark ? '#15803D' : '#86EFAC')
                    : (isDark ? '#B91C1C' : '#FCA5A5'),
                },
              ]}
            >
              <Text
                style={[
                  styles.gatewayStatusText,
                  { color: gatewayStatus.success ? (isDark ? '#4ADE80' : '#15803D') : (isDark ? '#F87171' : '#B91C1C') },
                ]}
              >
                {gatewayStatus.success ? '✓' : '⚠️'} {gatewayStatus.message}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Logout Confirmation Modal */}
        <ConfirmationModal
          visible={showLogoutModal}
          title="Sign Out of RescueLink"
          severity="warning"
          message="Signing out revokes your local JWT authorization token. Offline local SOS features will remain active in guest mode."
          confirmLabel="Sign Out"
          cancelLabel="Stay Logged In"
          onConfirm={async () => {
            setShowLogoutModal(false);
            await logout();
          }}
          onCancel={() => setShowLogoutModal(false)}
        />
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
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionCaption: {
    ...typography.caption,
    marginTop: 2,
  },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarIcon: {
    fontSize: 24,
  },
  userName: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  userEmail: {
    ...typography.bodySmall,
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenBox: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tokenValue: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  guestContainer: {
    alignItems: 'center',
    padding: spacing.md,
  },
  guestIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  guestTitle: {
    ...typography.cardTitle,
    fontWeight: '800',
    marginBottom: 4,
  },
  guestDesc: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  guestBtnRow: {
    flexDirection: 'row',
    width: '100%',
  },
  themeOptionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  themeOptionLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  relayToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  cardDesc: {
    ...typography.caption,
    marginTop: 2,
    lineHeight: 16,
  },
  nodeIdBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  nodeIdLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nodeIdVal: {
    ...typography.bodySmallBold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  privacyPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  privacyPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hopsSection: {
    marginBottom: spacing.md,
  },
  hopsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  hopsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  hopBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hopBtnText: {
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  statKey: {
    ...typography.caption,
    marginTop: 2,
  },
  urlInput: {
    height: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.bodySmallBold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: spacing.sm,
  },
  gatewayActionsRow: {
    flexDirection: 'row',
  },
  gatewayStatusBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  gatewayStatusText: {
    ...typography.caption,
    fontWeight: '700',
  },
});

export default ProfileScreen;
