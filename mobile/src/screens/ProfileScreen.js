import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

export const ProfileScreen = ({ navigation }) => {
  const { user, token, isAuthenticated, logout } = useAuth();

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
});

export default ProfileScreen;
