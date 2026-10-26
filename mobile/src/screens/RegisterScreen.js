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

export const RegisterScreen = ({ navigation }) => {
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    // Frontend validation
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    const result = await register(name.trim(), email.trim(), password);
    if (result.success) {
      navigation.navigate('Home');
    } else {
      setErrorMessage(result.error || 'Registration failed. Please try again.');
    }
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
              <Text style={styles.headerIcon}>📝</Text>
            </View>
            <Text style={styles.title}>Register Account</Text>
            <Text style={styles.subtitle}>
              Create a cryptographic responder profile for RescueLink.
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
              <Text style={styles.inputLabel}>FULL NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Jane Doe"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setErrorMessage(null);
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="jane@example.com"
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
              <Text style={styles.inputLabel}>PASSWORD (MIN 6 CHARACTERS) *</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CONFIRM PASSWORD *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setErrorMessage(null);
                }}
              />
            </View>

            <PrimaryButton
              title="Create Account"
              onPress={handleRegister}
              variant="primary"
              loading={isLoading}
              icon="🚀"
              style={styles.submitButton}
            />
          </View>

          {/* Switch to Login */}
          <View style={styles.footerSection}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>
                Already registered?{' '}
                <Text style={styles.linkHighlight}>Log In Here</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.7}
              style={styles.guestButton}
            >
              <Text style={styles.guestButtonText}>
                Cancel & Return to Dashboard
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

export default RegisterScreen;
