import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';

/**
 * ConfirmationModal Component
 *
 * Emergency interaction design guard:
 * Prevents accidental SOS triggers and confirms high-impact actions
 * (e.g. triggering live broadcast, resolving incidents, or logging out).
 */
export const ConfirmationModal = ({
  visible = false,
  title = 'Confirm Action',
  message = '',
  severity = 'danger', // 'danger' | 'warning' | 'info'
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  summaryItems = [], // Array of { label: string, value: string }
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const getSeverityStyle = () => {
    switch (severity) {
      case 'danger':
        return {
          bannerBg: isDark ? '#450A0A' : '#FEE2E2',
          bannerBorder: isDark ? '#B91C1C' : '#FCA5A5',
          bannerIcon: '🚨',
          btnBg: colors.primary,
          btnText: '#FFFFFF',
        };
      case 'warning':
        return {
          bannerBg: isDark ? '#451A03' : '#FEF3C7',
          bannerBorder: isDark ? '#B45309' : '#FDE68A',
          bannerIcon: '⚠️',
          btnBg: colors.warning,
          btnText: '#FFFFFF',
        };
      case 'info':
      default:
        return {
          bannerBg: isDark ? '#172554' : '#EFF6FF',
          bannerBorder: isDark ? '#1D4ED8' : '#93C5FD',
          bannerIcon: 'ℹ️',
          btnBg: colors.info,
          btnText: '#FFFFFF',
        };
    }
  };

  const sev = getSeverityStyle();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
      accessibilityViewIsModal={true}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlayBackground }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
                shadows.modal,
              ]}
              accessibilityRole="alertdialog"
              accessibilityLabel={title}
            >
              {/* Severity Banner */}
              <View
                style={[
                  styles.headerBanner,
                  {
                    backgroundColor: sev.bannerBg,
                    borderBottomColor: sev.bannerBorder,
                  },
                ]}
              >
                <Text style={styles.bannerIcon}>{sev.bannerIcon}</Text>
                <Text
                  style={[
                    styles.title,
                    { color: colors.textPrimary },
                  ]}
                >
                  {title}
                </Text>
              </View>

              <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
                {/* Description */}
                {message ? (
                  <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {message}
                  </Text>
                ) : null}

                {/* Summary Items */}
                {summaryItems && summaryItems.length > 0 ? (
                  <View
                    style={[
                      styles.summaryContainer,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {summaryItems.map((item, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.summaryRow,
                          idx < summaryItems.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                          {item.label}
                        </Text>
                        <Text
                          style={[styles.summaryValue, { color: colors.textPrimary }]}
                          numberOfLines={2}
                        >
                          {item.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              {/* Action Buttons */}
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnCancel,
                    {
                      borderColor: colors.borderDark,
                      backgroundColor: isDark ? colors.surfaceSubtle : '#FFFFFF',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={onCancel}
                  accessibilityRole="button"
                  accessibilityLabel={cancelLabel}
                >
                  <Text style={[styles.btnCancelText, { color: colors.textPrimary }]}>
                    {cancelLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnConfirm,
                    { backgroundColor: sev.btnBg },
                  ]}
                  activeOpacity={0.85}
                  onPress={onConfirm}
                  accessibilityRole="button"
                  accessibilityLabel={confirmLabel}
                >
                  <Text style={[styles.btnConfirmText, { color: sev.btnText }]}>
                    {confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  bannerIcon: {
    fontSize: 22,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    fontWeight: '800',
    flex: 1,
  },
  bodyScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  message: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  summaryContainer: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  summaryLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  summaryValue: {
    ...typography.bodySmallBold,
    flex: 1.5,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  btnCancel: {
    borderWidth: 1,
  },
  btnCancelText: {
    ...typography.buttonText,
  },
  btnConfirm: {
    elevation: 2,
  },
  btnConfirmText: {
    ...typography.buttonText,
  },
});

export default ConfirmationModal;
