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
import { SOSButton } from '../components/SOSButton';
import { StatusCard } from '../components/StatusCard';
import { apiClient } from '../services/api/apiClient';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { APP_CONFIG, SAFETY_DISCLAIMER } from '../utils/constants';

/**
 * HomeScreen / Emergency Dashboard
 *
 * Core emergency screen presenting:
 * - Immediate red SOS action trigger
 * - Real-time Bluetooth, Connectivity, and GPS indicators
 * - Quick action portals to History and Nearby Devices
 * - High-visibility emergency disclaimer
 */
export const HomeScreen = ({ navigation }) => {
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
          <Text style={styles.sectionCaption}>Offline sensors and radios</Text>
        </View>

        <StatusCard
          title="Bluetooth Radio"
          value="BLE Standby"
          icon="📡"
          variant="info"
          subtitle="Ready for peer-to-peer mesh broadcasting (Step 3)"
        />

        <StatusCard
          title="Internet Connectivity"
          value="Offline Mode"
          icon="📴"
          variant="warning"
          subtitle="No cellular / Wi-Fi detected. Peer mesh will relay alerts."
        />

        <StatusCard
          title="GPS Position"
          value="12.9716° N, 77.5946° E"
          icon="📍"
          variant="info"
          subtitle="Accuracy: ±8.5m · Demo coordinates locked"
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
            RescueLink Prototype v1.0.0 · Step 1 Foundation
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
