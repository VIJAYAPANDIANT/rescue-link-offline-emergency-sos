/**
 * RescueLink Sync Queue (Offline Outbox) Repository
 *
 * Implements an offline outbox pattern with deduplication,
 * exponential backoff scheduling, and reliable cloud sync tracking.
 */

import { getDatabase } from './database.js';

export class SyncQueueRepository {
  /**
   * Enqueue a pending server operation into the offline outbox with deduplication.
   *
   * @param {object} params
   * @param {string} params.alertId - Target alert identifier
   * @param {'CREATE' | 'UPDATE_STATUS' | 'RESOLVE'} params.operation - Server operation type
   * @param {object|string} params.payload - Payload to be dispatched when online
   */
  static async enqueue({ alertId, operation, payload }) {
    if (!alertId || !operation) {
      throw new Error('alertId and operation are required to enqueue sync items.');
    }

    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload || '{}';

    // Deduplication check: if an operation for this alert is already queued
    const existing = await db.getFirstAsync(
      'SELECT id, status, retryCount FROM sync_queue WHERE alertId = ? AND operation = ?;',
      [alertId, operation]
    );

    if (existing) {
      // Refresh existing queue item back to pending with updated payload
      await db.runAsync(
        `UPDATE sync_queue
         SET payload = ?,
             status = 'pending',
             errorMessage = null,
             nextRetryAt = null,
             updatedAt = ?
         WHERE id = ?;`,
        [payloadStr, nowIso, existing.id]
      );

      return {
        id: existing.id,
        alertId,
        operation,
        payload: payloadStr,
        status: 'pending',
        retryCount: existing.retryCount,
        isNew: false,
        updatedAt: nowIso,
      };
    }

    // Insert new queue record
    const result = await db.runAsync(
      `INSERT INTO sync_queue (
        alertId,
        operation,
        payload,
        status,
        retryCount,
        lastAttemptAt,
        nextRetryAt,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, 'pending', 0, NULL, NULL, ?, ?);`,
      [alertId, operation, payloadStr, nowIso, nowIso]
    );

    return {
      id: result.lastInsertRowId,
      alertId,
      operation,
      payload: payloadStr,
      status: 'pending',
      retryCount: 0,
      isNew: true,
      createdAt: nowIso,
    };
  }

  /**
   * Retrieve eligible pending and ready-to-retry outbox items.
   * Excludes items whose backoff timer (nextRetryAt) has not yet elapsed.
   *
   * @param {number} [limit=10]
   */
  static async getEligibleItems(limit = 10) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    const rows = await db.getAllAsync(
      `SELECT * FROM sync_queue
       WHERE status = 'pending'
          OR (status = 'failed' AND (nextRetryAt IS NULL OR nextRetryAt <= ?))
       ORDER BY createdAt ASC
       LIMIT ?;`,
      [nowIso, limit]
    );

    return rows.map((item) => ({
      ...item,
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : item.payload,
    }));
  }

  /**
   * Retrieve all pending outbox queue records.
   */
  static async getPendingItems() {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY createdAt ASC;"
    );

    return rows.map((item) => ({
      ...item,
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : item.payload,
    }));
  }

  /**
   * Mark a sync queue item as actively in-flight / processing.
   */
  static async markAttempt(id) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `UPDATE sync_queue
       SET lastAttemptAt = ?,
           status = 'processing',
           updatedAt = ?
       WHERE id = ?;`,
      [nowIso, nowIso, id]
    );
  }

  /**
   * Mark a sync queue item as failed and schedule next retry via exponential backoff.
   *
   * @param {number} id - Queue item ID
   * @param {string} errorMessage - Error description (secrets stripped)
   * @param {number} [backoffMs=5000] - Delay in milliseconds before next attempt
   */
  static async markFailed(id, errorMessage, backoffMs = 5000) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    const nextRetryAt = new Date(Date.now() + Math.max(0, backoffMs)).toISOString();

    // Sanitize error message to ensure no JWTs/tokens leak
    const sanitizedError = (errorMessage || 'Unknown synchronization error')
      .replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]')
      .substring(0, 300);

    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed',
           retryCount = retryCount + 1,
           lastAttemptAt = ?,
           nextRetryAt = ?,
           errorMessage = ?,
           updatedAt = ?
       WHERE id = ?;`,
      [nowIso, nextRetryAt, sanitizedError, nowIso, id]
    );
  }

  /**
   * Mark a sync queue item as completed and remove it from the outbox.
   */
  static async markCompleted(id) {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  /**
   * Remove a completed sync queue record.
   */
  static async remove(id) {
    return this.markCompleted(id);
  }

  /**
   * Retrieve all failed queue items for diagnostics.
   */
  static async getFailedItems() {
    const db = await getDatabase();
    return db.getAllAsync(
      "SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY updatedAt DESC;"
    );
  }

  /**
   * Retrieve total number of pending and retrying items in the offline outbox.
   */
  static async getPendingCount() {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'processing', 'failed');"
    );
    return row?.count || 0;
  }
}

export default SyncQueueRepository;
