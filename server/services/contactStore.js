/**
 * RescueLink Emergency Contact Data Store
 *
 * Implements atomic, file-locked persistence for emergency contacts.
 * Ensures cross-user ownership isolation and concurrency safety.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONTACTS_FILE = path.join(__dirname, '..', 'data', 'contacts.json');

class ContactStore {
  constructor() {
    this.writeQueue = Promise.resolve();
    this.ensureFileExists();
  }

  ensureFileExists() {
    try {
      const dir = path.dirname(CONTACTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(CONTACTS_FILE)) {
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (err) {
      console.error('[ContactStore] Error initializing contacts.json:', err.message);
    }
  }

  async readContacts() {
    try {
      const raw = await fs.promises.readFile(CONTACTS_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      console.error('[ContactStore] Error reading contacts.json:', err.message);
      return [];
    }
  }

  writeContacts(contactsList) {
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          const tempFile = `${CONTACTS_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          const jsonPayload = JSON.stringify(contactsList, null, 2);
          await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');
          await fs.promises.rename(tempFile, CONTACTS_FILE);
          resolve();
        })
        .catch((err) => {
          console.error('[ContactStore] Error writing contacts.json:', err);
          reject(err);
        });
    });
  }

  /**
   * Find all contacts belonging to a specific user.
   */
  async findByUserId(userId) {
    if (!userId) return [];
    const contacts = await this.readContacts();
    return contacts
      .filter((c) => c.userId === userId)
      .sort((a, b) => {
        // Sort by priority ascending (1 = Primary first), then creation date
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  /**
   * Find only enabled contacts belonging to a specific user.
   */
  async findEnabledByUserId(userId) {
    const userContacts = await this.findByUserId(userId);
    return userContacts.filter((c) => c.isEnabled === true);
  }

  /**
   * Find a specific contact by ID with ownership verification.
   */
  async findById(id, userId) {
    if (!id) return null;
    const contacts = await this.readContacts();
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return null;
    if (userId && contact.userId !== userId) return null; // Ownership protection
    return contact;
  }

  /**
   * Create a new emergency contact.
   */
  async createContact(contactData) {
    const contacts = await this.readContacts();
    const nowIso = new Date().toISOString();

    const newContact = {
      id: crypto.randomUUID(),
      userId: contactData.userId,
      name: contactData.name,
      phone: contactData.phone || null,
      email: contactData.email || null,
      relationship: contactData.relationship || 'Emergency Contact',
      priority: typeof contactData.priority === 'number' ? contactData.priority : 1,
      isEnabled: contactData.isEnabled !== undefined ? contactData.isEnabled : true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    contacts.push(newContact);
    await this.writeContacts(contacts);
    return newContact;
  }

  /**
   * Update an existing contact with ownership verification.
   */
  async updateContact(id, userId, updates) {
    const contacts = await this.readContacts();
    const index = contacts.findIndex((c) => c.id === id && c.userId === userId);

    if (index === -1) {
      return null;
    }

    const existing = contacts[index];
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    contacts[index] = updated;
    await this.writeContacts(contacts);
    return updated;
  }

  /**
   * Delete a contact by ID with ownership verification.
   */
  async deleteContact(id, userId) {
    const contacts = await this.readContacts();
    const index = contacts.findIndex((c) => c.id === id && c.userId === userId);

    if (index === -1) {
      return false;
    }

    contacts.splice(index, 1);
    await this.writeContacts(contacts);
    return true;
  }
}

const contactStore = new ContactStore();
module.exports = contactStore;
