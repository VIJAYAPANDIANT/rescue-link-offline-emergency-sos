import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { NotificationRepository } from '../database/notificationRepository';
import { apiClient } from '../services/api/apiClient';
import { notificationQueueService } from '../services/notification/notificationQueueService';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';
import { formatTimestamp } from '../utils/helpers';

export const NotificationHistoryScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filterChannel, setFilterChannel] = useState(null); // null | 'email' | 'sms'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Test Modal State
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testChannel, setTestChannel] = useState('email');
  const [testRecipient, setTestRecipient] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      // 1. Load locally recorded SQLite tasks
      const localTasks = await NotificationRepository.getAllTasks({
        channel: filterChannel,
      });
      setTasks(localTasks);

      // 2. If authenticated, sync with server notification logs
      if (isAuthenticated) {
        await notificationQueueService.syncServerNotifications();
        const refreshed = await NotificationRepository.getAllTasks({
          channel: filterChannel,
        });
        setTasks(refreshed);
      }
    } catch (err) {
      console.warn('[NotificationHistoryScreen] Load tasks warning:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterChannel, isAuthenticated]);

  useEffect(() => {
    setIsLoading(true);
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadNotifications();
  };

  const handleSendTestNotification = async () => {
    if (!testRecipient.trim()) {
      Alert.alert('Required', 'Please enter a test recipient (email or phone).');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await apiClient.testNotification({
        channel: testChannel,
        recipient: testRecipient.trim(),
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: `Dispatched via ${res.data?.provider || 'provider'}: ${res.data?.message || 'Success'}`,
        });
        loadNotifications();
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Failed to dispatch test notification.',
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Network error during test dispatch.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return { label: 'Delivered', bg: '#DCFCE7', text: '#15803D' };
      case 'sent':
        return { label: 'Sent', bg: '#E0F2FE', text: '#0369A1' };
      case 'queued':
        return { label: 'Queued', bg: '#FEF3C7', text: '#B45309' };
      case 'sending':
        return { label: 'Sending...', bg: '#F3E8FF', text: '#7E22CE' };
      case 'failed':
      default:
        return { label: 'Failed', bg: '#FEE2E2', text: '#B91C1C' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.screenTitle}>SOS Notification Logs</Text>
          <Text style={styles.screenSubtitle}>
            Delivery tracking for emergency contact dispatches
          </Text>
        </View>
        <TouchableOpacity
          style={styles.testGatewayBtn}
          onPress={() => {
            setTestResult(null);
            setTestModalVisible(true);
          }}
        >
          <Text style={styles.testGatewayBtnText}>🧪 Test</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: null, label: 'All Channels' },
          { key: 'email', label: '✉️ Email' },
          { key: 'sms', label: '💬 SMS' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key || 'all'}
            style={[
              styles.filterChip,
              filterChannel === tab.key && styles.filterChipActive,
            ]}
            onPress={() => setFilterChannel(tab.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterChannel === tab.key && styles.filterChipTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading notification logs...</Text>
          </View>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No Notification Logs Found"
            description="When an SOS is triggered, notification tasks to your enabled emergency contacts appear here with live delivery status."
            actionLabel="Send Test Notification"
            onAction={() => setTestModalVisible(true)}
          />
        ) : (
          tasks.map((task) => {
            const statusStyle = getStatusBadge(task.status);
            return (
              <View
                key={task.taskId || task.id}
                style={[styles.taskCard, shadows.card]}
              >
                <View style={styles.taskCardHeader}>
                  <View style={styles.channelBadge}>
                    <Text style={styles.channelBadgeText}>
                      {task.channel === 'email' ? '✉️ Email' : '💬 SMS'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusStyle.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusStyle.text },
                      ]}
                    >
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.taskRecipientRow}>
                  <Text style={styles.recipientLabel}>Recipient:</Text>
                  <Text style={styles.recipientValue}>
                    {task.contactName ? `${task.contactName} (${task.recipient})` : task.recipient}
                  </Text>
                </View>

                <View style={styles.taskDetailsRow}>
                  <Text style={styles.metaLabel}>Alert ID:</Text>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {task.alertId}
                  </Text>
                </View>

                <View style={styles.taskDetailsRow}>
                  <Text style={styles.metaLabel}>Timestamp:</Text>
                  <Text style={styles.metaValue}>
                    {formatTimestamp(task.createdAt)}
                  </Text>
                </View>

                {task.errorMessage ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>
                      ⚠️ Error: {task.errorMessage}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Test Notification Modal */}
      <Modal
        visible={testModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTestModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.cardElevated]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Test Notification Gateway</Text>
              <TouchableOpacity onPress={() => setTestModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Send a test distress alert to verify your backend email or SMS provider configuration.
            </Text>

            {testResult ? (
              <View
                style={[
                  styles.testResultBox,
                  testResult.success ? styles.testSuccessBox : styles.testErrorBox,
                ]}
              >
                <Text
                  style={[
                    styles.testResultText,
                    testResult.success ? styles.testSuccessText : styles.testErrorText,
                  ]}
                >
                  {testResult.message}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>CHANNEL</Text>
            <View style={styles.channelSelector}>
              {[
                { val: 'email', label: '✉️ Email' },
                { val: 'sms', label: '💬 SMS' },
              ].map((c) => (
                <TouchableOpacity
                  key={c.val}
                  style={[
                    styles.channelOption,
                    testChannel === c.val && styles.channelOptionActive,
                  ]}
                  onPress={() => setTestChannel(c.val)}
                >
                  <Text
                    style={[
                      styles.channelOptionText,
                      testChannel === c.val && styles.channelOptionTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              {testChannel === 'email' ? 'DESTINATION EMAIL' : 'DESTINATION PHONE NUMBER'}
            </Text>
            <TextInput
              style={styles.inputField}
              placeholder={testChannel === 'email' ? 'e.g. test@example.com' : 'e.g. +14155552671'}
              placeholderTextColor={colors.textMuted}
              keyboardType={testChannel === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              value={testRecipient}
              onChangeText={setTestRecipient}
            />

            <View style={styles.modalButtons}>
              <PrimaryButton
                title={isSendingTest ? 'Sending...' : 'Dispatch Test Alert'}
                onPress={handleSendTestNotification}
                variant="primary"
                disabled={isSendingTest}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? spacing.xl : spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  backIcon: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerTitleContainer: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  testGatewayBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  testGatewayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 14,
  },
  taskCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  channelBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  channelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskRecipientRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  recipientLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginRight: 6,
  },
  recipientValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  taskDetailsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 6,
  },
  metaValue: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  errorBox: {
    marginTop: spacing.sm,
    backgroundColor: '#FEE2E2',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  errorBoxText: {
    color: colors.danger,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textMuted,
    padding: 4,
  },
  modalDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  channelSelector: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  channelOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginHorizontal: 4,
    backgroundColor: '#F9FAFB',
  },
  channelOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  channelOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  channelOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputField: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  testResultBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  testSuccessBox: {
    backgroundColor: '#DCFCE7',
  },
  testSuccessText: {
    color: '#15803D',
    fontSize: 13,
  },
  testErrorBox: {
    backgroundColor: '#FEE2E2',
  },
  testErrorText: {
    color: colors.danger,
    fontSize: 13,
  },
  modalButtons: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
