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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ContactRepository } from '../database/contactRepository';
import { apiClient } from '../services/api/apiClient';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyState } from '../components/EmptyState';
import { InfoBanner } from '../components/InfoBanner';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { spacing, borderRadius, typography, shadows } from '../utils/theme';

/**
 * EmergencyContactsScreen
 *
 * Professional emergency contact registry:
 * - Priority-based dispatch ordering (Primary, Secondary, Standard)
 * - Per-contact enabled/disabled status toggle
 * - Email and SMS notification delivery preferences
 * - Explicit privacy & consent guarantee (Zero unauthorized address book access)
 */
export const EmergencyContactsScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();

  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [deletingContact, setDeletingContact] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('Emergency Contact');
  const [priority, setPriority] = useState(1);
  const [formError, setFormError] = useState(null);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const localContacts = await ContactRepository.getAllContacts(user?.id);
      setContacts(localContacts || []);

      if (isAuthenticated) {
        const response = await apiClient.getContacts();
        if (response.success && Array.isArray(response.data)) {
          await ContactRepository.upsertContacts(
            response.data.map((c) => ({
              ...c,
              contactId: c.id,
              userId: user?.id,
              syncStatus: 'synced',
            }))
          );
          const refreshed = await ContactRepository.getAllContacts(user?.id);
          setContacts(refreshed || []);
        }
      }
    } catch (err) {
      console.warn('[EmergencyContactsScreen] Failed to load contacts:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const openAddModal = () => {
    setEditingContact(null);
    setName('');
    setPhone('');
    setEmail('');
    setRelationship('Family / Rescuer');
    setPriority(1);
    setFormError(null);
    setModalVisible(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setName(contact.name || '');
    setPhone(contact.phone || '');
    setEmail(contact.email || '');
    setRelationship(contact.relationship || 'Emergency Contact');
    setPriority(contact.priority || 1);
    setFormError(null);
    setModalVisible(true);
  };

  const handleSaveContact = async () => {
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 60) {
      setFormError('Contact name must be between 2 and 60 characters.');
      return;
    }

    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedPhone && !trimmedEmail) {
      setFormError('Please provide at least a phone number or an email address.');
      return;
    }

    if (trimmedPhone) {
      const digits = trimmedPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        setFormError('Phone number must contain between 7 and 15 digits.');
        return;
      }
    }

    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setFormError('Please enter a valid email address.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        name: trimmedName,
        phone: trimmedPhone || null,
        email: trimmedEmail || null,
        relationship: relationship.trim() || 'Emergency Contact',
        priority: Number(priority),
        isEnabled: editingContact ? editingContact.isEnabled : true,
      };

      if (editingContact) {
        const contactId = editingContact.contactId || editingContact.id;
        await ContactRepository.upsertContact({
          ...payload,
          contactId,
          userId: user?.id,
          syncStatus: isAuthenticated ? 'synced' : 'pending_update',
        });

        if (isAuthenticated) {
          apiClient.updateContact(contactId, payload).catch(() => {});
        }
      } else {
        const localId = `contact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        let finalId = localId;

        if (isAuthenticated) {
          const res = await apiClient.createContact(payload);
          if (res.success && res.data?.id) {
            finalId = res.data.id;
          }
        }

        await ContactRepository.upsertContact({
          ...payload,
          contactId: finalId,
          userId: user?.id,
          syncStatus: isAuthenticated ? 'synced' : 'pending_create',
        });
      }

      setModalVisible(false);
      await loadContacts();
    } catch (err) {
      setFormError(err.message || 'Failed to save contact.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (contact) => {
    const contactId = contact.contactId || contact.id;
    const nextState = !contact.isEnabled;

    try {
      await ContactRepository.toggleContactEnabled(contactId, nextState);
      setContacts((prev) =>
        prev.map((c) =>
          (c.contactId === contactId || c.id === contactId)
            ? { ...c, isEnabled: nextState }
            : c
        )
      );

      if (isAuthenticated) {
        apiClient.updateContact(contactId, { isEnabled: nextState }).catch(() => {});
      }
    } catch (e) {
      console.warn('[Contacts] Toggle error:', e.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingContact) return;
    const contactId = deletingContact.contactId || deletingContact.id;

    try {
      await ContactRepository.deleteContact(contactId);
      setContacts((prev) => prev.filter((c) => (c.contactId || c.id) !== contactId));

      if (isAuthenticated) {
        apiClient.deleteContact(contactId).catch(() => {});
      }
      setDeletingContact(null);
    } catch (e) {
      Alert.alert('Delete Error', e.message);
    }
  };

  const getPriorityBadge = (p) => {
    switch (Number(p)) {
      case 1:
        return {
          label: 'Priority 1 (Primary)',
          bg: isDark ? '#450A0A' : '#FEE2E2',
          border: isDark ? '#B91C1C' : '#FCA5A5',
          color: isDark ? '#F87171' : '#B91C1C',
        };
      case 2:
        return {
          label: 'Priority 2 (Secondary)',
          bg: isDark ? '#451A03' : '#FEF3C7',
          border: isDark ? '#B45309' : '#FDE68A',
          color: isDark ? '#FBBF24' : '#B45309',
        };
      case 3:
      default:
        return {
          label: 'Priority 3 (Standard)',
          bg: isDark ? '#172554' : '#EFF6FF',
          border: isDark ? '#1D4ED8' : '#93C5FD',
          color: isDark ? '#60A5FA' : '#1D4ED8',
        };
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
                Emergency Contacts
              </Text>
              <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                Automated SMS/Email notification recipients ({contacts.length} saved)
              </Text>
            </View>

            <PrimaryButton
              title="+ Add"
              onPress={openAddModal}
              variant="primary"
              size="sm"
            />
          </View>
        </View>

        {/* Privacy & Consent Notice Banner */}
        <InfoBanner
          variant="info"
          icon="🛡️"
          title="Privacy & Permission Guarantee"
          message="RescueLink never accesses your phone's address book without permission. Contacts are stored securely in local SQLite and notified only when you actively trigger an emergency SOS."
          style={{ marginHorizontal: spacing.lg }}
        />

        {/* Contacts List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.info} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading emergency contacts from SQLite...
            </Text>
          </View>
        ) : contacts.length > 0 ? (
          <View style={styles.contactsList}>
            {contacts.map((contact) => {
              const priBadge = getPriorityBadge(contact.priority);
              const contactId = contact.contactId || contact.id;

              return (
                <View
                  key={contactId}
                  style={[
                    styles.contactCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: contact.isEnabled ? colors.border : colors.borderDark,
                      opacity: contact.isEnabled ? 1 : 0.65,
                    },
                    shadows.card,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.nameSection}>
                      <Text style={[styles.contactName, { color: colors.textPrimary }]}>
                        {contact.name}
                      </Text>
                      <Text style={[styles.relationshipText, { color: colors.textMuted }]}>
                        {contact.relationship || 'Emergency Contact'}
                      </Text>
                    </View>

                    <View style={styles.toggleSection}>
                      <Switch
                        value={contact.isEnabled}
                        onValueChange={() => handleToggleEnabled(contact)}
                        trackColor={{ false: colors.borderDark, true: colors.success }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel={`Toggle notification for ${contact.name}`}
                      />
                    </View>
                  </View>

                  {/* Priority & Channel Badges */}
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.priorityPill,
                        {
                          backgroundColor: priBadge.bg,
                          borderColor: priBadge.border,
                        },
                      ]}
                    >
                      <Text style={[styles.priorityPillText, { color: priBadge.color }]}>
                        {priBadge.label}
                      </Text>
                    </View>

                    {contact.phone ? (
                      <View style={[styles.channelPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                        <Text style={[styles.channelPillText, { color: colors.textSecondary }]}>
                          📱 SMS: {contact.phone}
                        </Text>
                      </View>
                    ) : null}

                    {contact.email ? (
                      <View style={[styles.channelPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                        <Text style={[styles.channelPillText, { color: colors.textSecondary }]}>
                          ✉️ Email: {contact.email}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions Footer */}
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => openEditModal(contact)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit contact ${contact.name}`}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.info }]}>
                        ✏️ Edit Contact
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setDeletingContact(contact)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete contact ${contact.name}`}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                        🗑️ Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="👥"
            title="No Contacts Configured"
            description="Add trusted family, colleagues, or local search-and-rescue teams who should receive automated distress notifications."
            actionLabel="+ Add First Contact"
            onAction={openAddModal}
            style={{ marginHorizontal: spacing.lg }}
          />
        )}

        {/* Add / Edit Contact Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlayBackground }]}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
                shadows.modal,
              ]}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                >
                  <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {formError ? (
                  <View style={[styles.formErrorBox, { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder }]}>
                    <Text style={[styles.formErrorText, { color: colors.primaryDark }]}>
                      ⚠️ {formError}
                    </Text>
                  </View>
                ) : null}

                {/* Name Input */}
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>FULL NAME *</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderDark, color: colors.textPrimary }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. John Doe"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    accessibilityLabel="Full name input"
                  />
                </View>

                {/* Phone Input */}
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>PHONE NUMBER (SMS)</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderDark, color: colors.textPrimary }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. +1 (555) 234-5678"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    accessibilityLabel="Phone number input"
                  />
                </View>

                {/* Email Input */}
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderDark, color: colors.textPrimary }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="e.g. rescuer@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    accessibilityLabel="Email address input"
                  />
                </View>

                {/* Relationship Input */}
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>RELATIONSHIP / ROLE</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderDark, color: colors.textPrimary }]}
                    value={relationship}
                    onChangeText={setRelationship}
                    placeholder="e.g. Brother, Local Clinic, Leader"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Relationship input"
                  />
                </View>

                {/* Priority Selector */}
                <View style={styles.modalInputGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>NOTIFICATION PRIORITY</Text>
                  <View style={styles.prioritySelectorRow}>
                    {[1, 2, 3].map((p) => {
                      const isSel = Number(priority) === p;
                      const pLabel = p === 1 ? '1 - Primary' : p === 2 ? '2 - Secondary' : '3 - Standard';
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.priorityOption,
                            {
                              backgroundColor: isSel
                                ? colors.navyDark
                                : (isDark ? colors.surfaceSubtle : colors.cardBackground),
                              borderColor: isSel ? colors.navy : colors.borderDark,
                            },
                          ]}
                          onPress={() => setPriority(p)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSel }}
                          accessibilityLabel={pLabel}
                        >
                          <Text
                            style={[
                              styles.priorityOptionText,
                              { color: isSel ? '#FFFFFF' : colors.textPrimary, fontWeight: isSel ? '800' : '600' },
                            ]}
                          >
                            {pLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <PrimaryButton
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  variant="secondary"
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <PrimaryButton
                  title={editingContact ? 'Update Contact' : 'Save Contact'}
                  onPress={handleSaveContact}
                  variant="primary"
                  loading={isSaving}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          visible={!!deletingContact}
          title="Delete Emergency Contact"
          severity="danger"
          message={`Are you sure you want to remove ${deletingContact?.name} from your emergency contacts registry?`}
          confirmLabel="Delete Contact"
          cancelLabel="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingContact(null)}
          summaryItems={
            deletingContact
              ? [
                  { label: 'Name', value: deletingContact.name },
                  { label: 'Phone', value: deletingContact.phone || 'None' },
                  { label: 'Email', value: deletingContact.email || 'None' },
                ]
              : []
          }
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    ...typography.header,
    fontWeight: '800',
  },
  screenSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
  },
  contactsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  contactCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nameSection: {
    flex: 1,
  },
  contactName: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  relationshipText: {
    ...typography.caption,
    marginTop: 1,
  },
  toggleSection: {
    marginLeft: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  priorityPill: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  channelPill: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  channelPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
  },
  actionBtn: {
    paddingVertical: spacing.xs,
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },
  modalBackdrop: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.cardTitle,
    fontWeight: '800',
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.md,
  },
  formErrorBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  formErrorText: {
    ...typography.bodySmallBold,
  },
  modalInputGroup: {
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modalInput: {
    height: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityOptionText: {
    fontSize: 11,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
  },
});

export default EmergencyContactsScreen;
