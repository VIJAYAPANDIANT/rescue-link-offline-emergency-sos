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
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ContactRepository } from '../database/contactRepository';
import { apiClient } from '../services/api/apiClient';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, borderRadius, shadows } from '../utils/theme';

export const EmergencyContactsScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

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
      // 1. Load instantly from local SQLite
      const localContacts = await ContactRepository.getAllContacts(user?.id);
      setContacts(localContacts);

      // 2. If authenticated, fetch latest from server and merge into SQLite
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
          setContacts(refreshed);
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
    setRelationship('Emergency Contact');
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

    // Validation
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
        // Edit flow
        const contactId = editingContact.contactId || editingContact.id;
        await ContactRepository.upsertContact({
          ...payload,
          contactId,
          userId: user?.id,
          syncStatus: isAuthenticated ? 'synced' : 'pending_update',
        });

        if (isAuthenticated) {
          apiClient.updateContact(contactId, payload).catch((e) =>
            console.warn('[Contacts] Cloud update warning:', e.message)
          );
        }
      } else {
        // Create flow
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
        apiClient.updateContact(contactId, { isEnabled: nextState }).catch((e) =>
          console.warn('[Contacts] Enabled toggle sync warning:', e.message)
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to toggle contact status: ' + err.message);
    }
  };

  const handleDeleteContact = (contact) => {
    const contactId = contact.contactId || contact.id;

    Alert.alert(
      'Delete Emergency Contact',
      `Are you sure you want to remove ${contact.name} from your emergency contacts list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ContactRepository.deleteContact(contactId);
              setContacts((prev) =>
                prev.filter((c) => c.contactId !== contactId && c.id !== contactId)
              );

              if (isAuthenticated) {
                apiClient.deleteContact(contactId).catch((e) =>
                  console.warn('[Contacts] Cloud deletion warning:', e.message)
                );
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete contact: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const getPriorityLabel = (p) => {
    switch (p) {
      case 1:
        return { label: 'Primary (Priority 1)', color: colors.danger, bg: '#FEE2E2' };
      case 2:
        return { label: 'Secondary (Priority 2)', color: colors.warning, bg: '#FEF3C7' };
      default:
        return { label: 'Standard (Priority 3)', color: colors.info, bg: '#E0F2FE' };
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
          <Text style={styles.screenTitle}>Emergency Contacts</Text>
          <Text style={styles.screenSubtitle}>
            People notified when an SOS alert is triggered
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addIconButton}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add Contact"
        >
          <Text style={styles.addIconText}>＋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>🛡️</Text>
          <Text style={styles.infoBannerText}>
            Contacts are stored locally in SQLite and synchronized securely with your authenticated account. No access to your phone’s address book is required.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No Emergency Contacts Saved"
            description="Add trusted family members, friends, or medical professionals. When you trigger an SOS, RescueLink automatically alerts enabled contacts."
            actionLabel="Add Your First Contact"
            onAction={openAddModal}
          />
        ) : (
          contacts.map((contact) => {
            const prioMeta = getPriorityLabel(contact.priority);
            return (
              <View
                key={contact.contactId || contact.id}
                style={[
                  styles.contactCard,
                  shadows.card,
                  !contact.isEnabled && styles.disabledCard,
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.contactMainInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactRelationship}>
                      {contact.relationship}
                    </Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>
                      {contact.isEnabled ? 'Active' : 'Muted'}
                    </Text>
                    <Switch
                      value={contact.isEnabled}
                      onValueChange={() => handleToggleEnabled(contact)}
                      trackColor={{ false: colors.borderDark, true: colors.success }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>

                {/* Priority Badge */}
                <View style={styles.badgeContainer}>
                  <View style={[styles.priorityBadge, { backgroundColor: prioMeta.bg }]}>
                    <Text style={[styles.priorityBadgeText, { color: prioMeta.color }]}>
                      {prioMeta.label}
                    </Text>
                  </View>
                </View>

                {/* Contact Channels */}
                <View style={styles.channelsSection}>
                  {contact.phone ? (
                    <View style={styles.channelRow}>
                      <Text style={styles.channelIcon}>📞</Text>
                      <Text style={styles.channelValue}>{contact.phone}</Text>
                    </View>
                  ) : null}
                  {contact.email ? (
                    <View style={styles.channelRow}>
                      <Text style={styles.channelIcon}>✉️</Text>
                      <Text style={styles.channelValue}>{contact.email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Actions */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(contact)}
                  >
                    <Text style={styles.actionBtnText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDeleteContact(contact)}
                  >
                    <Text style={[styles.actionBtnText, styles.deleteBtnText]}>
                      🗑️ Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Contact Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.cardElevated]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>FULL NAME *</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Jane Doe"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>PHONE NUMBER (FOR SMS)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. +14155552671"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={20}
              />

              <Text style={styles.fieldLabel}>EMAIL ADDRESS (FOR EMAIL ALERTS)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. contact@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                maxLength={80}
              />

              <Text style={styles.fieldLabel}>RELATIONSHIP</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Spouse, Parent, Doctor, Colleague"
                placeholderTextColor={colors.textMuted}
                value={relationship}
                onChangeText={setRelationship}
                maxLength={40}
              />

              <Text style={styles.fieldLabel}>ALERT PRIORITY</Text>
              <View style={styles.prioritySelector}>
                {[
                  { val: 1, label: '1 - Primary' },
                  { val: 2, label: '2 - Secondary' },
                  { val: 3, label: '3 - Standard' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.val}
                    style={[
                      styles.prioOption,
                      priority === item.val && styles.prioOptionActive,
                    ]}
                    onPress={() => setPriority(item.val)}
                  >
                    <Text
                      style={[
                        styles.prioOptionText,
                        priority === item.val && styles.prioOptionTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActionButtons}>
                <PrimaryButton
                  title={isSaving ? 'Saving...' : editingContact ? 'Update Contact' : 'Save Contact'}
                  onPress={handleSaveContact}
                  variant="primary"
                  disabled={isSaving}
                />
              </View>
            </ScrollView>
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
  addIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: -2,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBannerIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
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
  contactCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabledCard: {
    opacity: 0.6,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  contactMainInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  contactRelationship: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  badgeContainer: {
    marginTop: spacing.xs,
    flexDirection: 'row',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  channelsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  channelIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  channelValue: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
    backgroundColor: '#F3F4F6',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  deleteBtnText: {
    color: colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  formErrorBox: {
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  formErrorText: {
    color: colors.danger,
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
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
  prioritySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  prioOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginHorizontal: 3,
    backgroundColor: '#F9FAFB',
  },
  prioOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  prioOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  prioOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalActionButtons: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
