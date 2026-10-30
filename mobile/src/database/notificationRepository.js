/**
 * RescueLink Notification Tasks Repository
 *
 * Provides SQLite operations for recording and managing local notification tasks
 * when SOS alerts are triggered offline or online.
 */

import { getDatabase } from './database.js';

export class NotificationRepository {
  /**
   * Record a new notification task.
   */
  static async recordTask({
    taskId = null,
    alertId,
    contactId = null,
    contactName = null,
    channel,
    recipient,
    status = 'queued',
    errorMessage = null,
  }) {
    if (!alertId || !channel || !recipient) {
      throw new Error('alertId, channel, and recipient are required to record a notification task.');
    }

    const db = await getDatabase();
    const finalTaskId = taskId || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO notification_tasks (
        taskId,
        alertId,
        contactId,
        contactName,
        channel,
        recipient,
        status,
        retryCount,
        errorMessage,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      ON CONFLICT(taskId) DO UPDATE SET
        status = excluded.status,
        errorMessage = excluded.errorMessage,
        updatedAt = excluded.updatedAt;`,
      [
        finalTaskId,
        alertId,
        contactId,
        contactName,
        channel,
        recipient,
        status,
        errorMessage,
        nowIso,
        nowIso,
      ]
    );

    return this.getTaskById(finalTaskId);
  }

  /**
   * Get task by taskId.
   */
  static async getTaskById(taskId) {
    if (!taskId) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT * FROM notification_tasks WHERE taskId = ? LIMIT 1;',
      [taskId]
    );
    if (!row) return null;
    return this.formatTaskRow(row);
  }

  /**
   * Retrieve all notification tasks associated with a specific alert.
   */
  static async getTasksByAlertId(alertId) {
    if (!alertId) return [];
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      'SELECT * FROM notification_tasks WHERE alertId = ? ORDER BY createdAt ASC;',
      [alertId]
    );
    return rows.map((r) => this.formatTaskRow(r));
  }

  /**
   * Retrieve all notification tasks with optional channel filtering.
   */
  static async getAllTasks({ channel = null, limit = 50, offset = 0 } = {}) {
    const db = await getDatabase();
    let query = 'SELECT * FROM notification_tasks';
    const params = [];

    if (channel) {
      query += ' WHERE channel = ?';
      params.push(channel);
    }

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?;';
    params.push(limit, offset);

    const rows = await db.getAllAsync(query, params);
    return rows.map((r) => this.formatTaskRow(r));
  }

  /**
   * Update the status and error of a notification task.
   */
  static async updateTaskStatus(taskId, status, errorMessage = null) {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    await db.runAsync(
      `UPDATE notification_tasks
       SET status = ?,
           errorMessage = ?,
           retryCount = CASE WHEN ? = 'failed' THEN retryCount + 1 ELSE retryCount END,
           updatedAt = ?
       WHERE taskId = ?;`,
      [status, errorMessage, status, nowIso, taskId]
    );
    return this.getTaskById(taskId);
  }

  /**
   * Format SQLite row into standardized notification task object.
   */
  static formatTaskRow(row) {
    return {
      id: row.taskId,
      taskId: row.taskId,
      alertId: row.alertId,
      contactId: row.contactId,
      contactName: row.contactName,
      channel: row.channel,
      recipient: row.recipient,
      status: row.status,
      retryCount: row.retryCount,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
