import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

export const LoginScreen = ({ navigation }) => {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    const result = await login(email.trim(), password);
    if (result.success) {
      navigation.navigate('Home');
    } else {
      setErrorMessage(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleFillDemo = () => {
    setEmail('alex.rivera@rescuelink.org');
    setPassword('securePassword123');
    setErrorMessage(null);
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
            <View style={styles.iconCircle}>
              <Text style={styles.headerIcon}>🛡️</Text>
            </View>
            <Text style={styles.title}>Responder Login</Text>
            <Text style={styles.subtitle}>
              Sign in to authenticate emergency dispatches and access cloud synchronization.
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form Card */}
          <View style={[styles.card, shadows.card]}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="responder@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrorMessage(null);
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrorMessage(null);
                }}
              />
            </View>

            <PrimaryButton
              title="Sign In with JWT"
              onPress={handleLogin}
              variant="primary"
              loading={isLoading}
              icon="🔐"
              style={styles.submitButton}
            />

            {/* Quick Demo Credentials Filler */}
            <TouchableOpacity
              style={styles.demoFillButton}
              activeOpacity={0.7}
              onPress={handleFillDemo}
            >
              <Text style={styles.demoFillText}>
                ⚡ Fill Demo Account (alex.rivera@rescuelink.org)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Action Links */}
          <View style={styles.footerSection}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>
                Need a new responder profile?{' '}
                <Text style={styles.linkHighlight}>Register Here</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.7}
              style={styles.guestButton}
            >
              <Text style={styles.guestButtonText}>
                Skip & Continue as Guest / Offline Responder ➔
              </Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.infoBorder,
  },
  headerIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  errorIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryDark,
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  demoFillButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  demoFillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.infoDark,
  },
  footerSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  linkButton: {
    paddingVertical: spacing.xs,
  },
  linkText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  linkHighlight: {
    color: colors.info,
    fontWeight: '700',
  },
  guestButton: {
    paddingVertical: spacing.xs,
  },
  guestButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
});

export default LoginScreen;
