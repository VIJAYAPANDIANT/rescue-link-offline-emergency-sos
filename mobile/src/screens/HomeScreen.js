import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SOSButton } from '../components/SOSButton';
import { StatusCard } from '../components/StatusCard';
import { apiClient } from '../services/api/apiClient';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { APP_CONFIG, SAFETY_DISCLAIMER } from '../utils/constants';

/**
 * HomeScreen / Emergency Dashboard
 *
 * Core emergency screen presenting:
 * - Responder Identity / JWT authentication status
 * - Immediate red SOS action trigger
 * - Real-time Bluetooth, Connectivity, GPS, and Server indicators
 * - Quick action portals to History, Nearby Devices, and Account
 * - High-visibility emergency disclaimer
 */
export const HomeScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const [serverStatus, setServerStatus] = useState('Checking...');
  const [isServerHealthy, setIsServerHealthy] = useState(false);

  // Check backend health on mount
  useEffect(() => {
    let isMounted = true;
    apiClient.checkHealth().then((res) => {
      if (isMounted) {
        if (res.success) {
          setServerStatus('Connected (HTTP 200)');
          setIsServerHealthy(true);
        } else {
          setServerStatus('Offline (Backend Unreachable)');
          setIsServerHealthy(false);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSOSPress = () => {
    navigation.navigate('SendSOS');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Responder Session Banner */}
        <View style={styles.topBarRow}>
          {isAuthenticated && user ? (
            <TouchableOpacity
              style={styles.responderPill}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.responderDot} />
              <Text style={styles.responderText} numberOfLines={1}>
                {user.name} (JWT Active)
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.guestPill}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.guestText}>👤 Guest Mode · Tap to Log In</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.profileIconBtn}
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Account Profile"
          >
            <Text style={styles.profileIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandBadge}>OFFLINE-READY</Text>
          </View>
          <Text style={styles.appTitle}>{APP_CONFIG.APP_NAME}</Text>
          <Text style={styles.appSubtitle}>{APP_CONFIG.APP_SUBTITLE}</Text>
        </View>

        {/* Safety Disclaimer Warning Box */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerIcon}>⚠️</Text>
          <View style={styles.disclaimerTextContainer}>
            <Text style={styles.disclaimerTitle}>Emergency Protocol Notice</Text>
            <Text style={styles.disclaimerText}>{SAFETY_DISCLAIMER.SHORT}</Text>
          </View>
        </View>

        {/* Centerpiece SOS Emergency Trigger */}
        <View style={styles.sosSection}>
          <SOSButton
            onPress={handleSOSPress}
            title="SOS"
            subtitle="TAP FOR EMERGENCY"
          />
          <Text style={styles.sosHelperText}>
            Tap to open emergency report form. Your coordinates and emergency type will be prepared.
          </Text>
        </View>

        {/* System Connectivity & Sensor Status */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SYSTEM STATUS</Text>
          <Text style={styles.sectionCaption}>Offline sensors, radios, & session</Text>
        </View>

        <StatusCard
          title="Responder Session"
          value={isAuthenticated ? 'JWT Authenticated' : 'Guest Mode'}
          icon="🛡️"
          variant={isAuthenticated ? 'success' : 'warning'}
          subtitle={
            isAuthenticated
              ? `Signed in as ${user.name} (${user.email})`
              : 'Anonymous responder. Cloud synchronization requires signing in.'
          }
        />

        <StatusCard
          title="Bluetooth Radio"
          value="BLE Standby"
          icon="📡"
          variant="info"
          subtitle="Idle · No active BLE peer connection exists"
        />

        <StatusCard
          title="Network Connectivity"
          value={isServerHealthy ? 'Backend Online' : 'Offline / Local Mode'}
          icon="🌐"
          variant={isServerHealthy ? 'success' : 'warning'}
          subtitle={
            isServerHealthy
              ? 'Connected to RescueLink API (http://localhost:5000)'
              : 'Server offline or unreachable'
          }
        />

        <StatusCard
          title="GPS Location Sensor"
          value="Available on Request"
          icon="📍"
          variant="info"
          subtitle="Coordinates are optional and attached only with user consent"
        />

        <StatusCard
          title="RescueLink Server"
          value={serverStatus}
          icon="🖥️"
          variant={isServerHealthy ? 'success' : 'warning'}
          subtitle={
            isServerHealthy
              ? 'Local Express server responding at http://localhost:5000'
              : 'Backend server offline or not yet started'
          }
        />

        {/* Quick Actions Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, shadows.card]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('NearbyDevices')}
            accessibilityRole="button"
            accessibilityLabel="View Nearby Devices"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.infoLight }]}>
              <Text style={styles.actionIcon}>👥</Text>
            </View>
            <Text style={styles.actionCardTitle}>Nearby Devices</Text>
            <Text style={styles.actionCardSubtitle}>
              Scan for nearby BLE mesh nodes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, shadows.card]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('EmergencyHistory')}
            accessibilityRole="button"
            accessibilityLabel="View Emergency History"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <Text style={styles.actionCardTitle}>Emergency History</Text>
            <Text style={styles.actionCardSubtitle}>
              Review local drafts and alerts
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            RescueLink Prototype v1.0.0 · Step 2 Authentication & Offline SOS
          </Text>
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
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  responderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.successBorder,
    maxWidth: '80%',
  },
  responderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  responderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.successDark,
  },
  guestPill: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  profileIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconText: {
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  brandRow: {
    marginBottom: spacing.xs,
  },
  brandBadge: {
    backgroundColor: colors.infoLight,
    color: colors.infoDark,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
    letterSpacing: 0.8,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  disclaimerIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  disclaimerTextContainer: {
    flex: 1,
  },
  disclaimerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warningDark,
    marginBottom: 2,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.warningDark,
    lineHeight: 16,
  },
  sosSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  sosHelperText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  sectionCaption: {
    fontSize: 11,
    color: colors.textMuted,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});

export default HomeScreen;
