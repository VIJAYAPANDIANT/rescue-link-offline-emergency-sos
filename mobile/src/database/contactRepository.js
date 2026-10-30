/**
 * RescueLink Emergency Contact Repository
 *
 * Provides SQLite operations for offline storage and querying of emergency contacts.
 */

import { getDatabase } from './database.js';

export class ContactRepository {
  /**
   * Save or update a single contact in SQLite.
   *
   * @param {object} contact
   * @returns {Promise<object>}
   */
  static async upsertContact(contact) {
    if (!contact || !contact.name) {
      throw new Error('Contact name is required.');
    }

    const db = await getDatabase();
    const contactId = contact.contactId || contact.id || `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const priority = typeof contact.priority === 'number' ? contact.priority : 1;
    const isEnabled = contact.isEnabled !== undefined && contact.isEnabled !== null
      ? (contact.isEnabled ? 1 : 0)
      : 1;
    const syncStatus = contact.syncStatus || 'synced';

    await db.runAsync(
      `INSERT INTO contacts (
        contactId,
        userId,
        name,
        phone,
        email,
        relationship,
        priority,
        isEnabled,
        syncStatus,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(contactId) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        email = excluded.email,
        relationship = excluded.relationship,
        priority = excluded.priority,
        isEnabled = excluded.isEnabled,
        syncStatus = excluded.syncStatus,
        updatedAt = excluded.updatedAt;`,
      [
        contactId,
        contact.userId || null,
        contact.name.trim(),
        contact.phone ? contact.phone.trim() : null,
        contact.email ? contact.email.trim().toLowerCase() : null,
        contact.relationship ? contact.relationship.trim() : 'Emergency Contact',
        priority,
        isEnabled,
        syncStatus,
        contact.createdAt || nowIso,
        nowIso,
      ]
    );

    return this.getContactById(contactId);
  }

  /**
   * Batch upsert an array of contacts.
   */
  static async upsertContacts(contactsList) {
    if (!Array.isArray(contactsList)) return [];
    const results = [];
    for (const c of contactsList) {
      const saved = await this.upsertContact(c);
      results.push(saved);
    }
    return results;
  }

  /**
   * Retrieve a contact by contactId.
   */
  static async getContactById(contactId) {
    if (!contactId) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT * FROM contacts WHERE contactId = ? LIMIT 1;',
      [contactId]
    );
    if (!row) return null;
    return this.formatContactRow(row);
  }

  /**
   * Get all contacts, sorted by priority (1 = Primary first), then createdAt.
   */
  static async getAllContacts(userId = null) {
    const db = await getDatabase();
    let query = 'SELECT * FROM contacts';
    const params = [];

    if (userId) {
      query += ' WHERE userId = ? OR userId IS NULL';
      params.push(userId);
    }

    query += ' ORDER BY priority ASC, createdAt ASC;';

    const rows = await db.getAllAsync(query, params);
    return rows.map((r) => this.formatContactRow(r));
  }

  /**
   * Get only enabled contacts.
   */
  static async getEnabledContacts(userId = null) {
    const db = await getDatabase();
    let query = 'SELECT * FROM contacts WHERE isEnabled = 1';
    const params = [];

    if (userId) {
      query += ' AND (userId = ? OR userId IS NULL)';
      params.push(userId);
    }

    query += ' ORDER BY priority ASC, createdAt ASC;';

    const rows = await db.getAllAsync(query, params);
    return rows.map((r) => this.formatContactRow(r));
  }

  /**
   * Delete a contact by contactId.
   */
  static async deleteContact(contactId) {
    if (!contactId) return false;
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM contacts WHERE contactId = ?;', [contactId]);
    return result.changes > 0;
  }

  /**
   * Toggle enabled status of a contact.
   */
  static async toggleContactEnabled(contactId, isEnabled) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    await db.runAsync(
      'UPDATE contacts SET isEnabled = ?, updatedAt = ? WHERE contactId = ?;',
      [isEnabled ? 1 : 0, nowIso, contactId]
    );
    return this.getContactById(contactId);
  }

  /**
   * Format SQLite database row into standard contact object.
   */
  static formatContactRow(row) {
    return {
      id: row.contactId,
      contactId: row.contactId,
      userId: row.userId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      relationship: row.relationship,
      priority: row.priority,
      isEnabled: row.isEnabled === 1,
      syncStatus: row.syncStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
