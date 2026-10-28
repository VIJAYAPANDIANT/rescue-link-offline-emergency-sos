/**
 * RescueLink Message Receipt Repository
 *
 * Persists delivery and acknowledgment receipts (BLE ACKs, server receipts)
 * with transactional consistency to the alerts table.
 */

import { getDatabase } from './database.js';

export class ReceiptRepository {
  /**
   * Record a new message receipt and update alert ackStatus atomically.
   *
   * @param {object} params
   * @param {string} params.alertId - Target emergency alert identifier
   * @param {string} params.receiptType - Receipt kind (e.g. 'BLE_ACK_RECEIVED', 'BLE_ACK_SENT', 'SERVER_CONFIRMED')
   * @param {string} [params.senderOrDeviceId] - Identifier of the peer device or server
   * @param {object|string} [params.metadata] - Optional additional payload metadata
   */
  static async recordReceipt({ alertId, receiptType, senderOrDeviceId, metadata }) {
    if (!alertId || !receiptType) {
      throw new Error('alertId and receiptType are required to record a receipt.');
    }

    const db = await getDatabase();
    const receivedAt = new Date().toISOString();
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata || null;

    // Execute within a transaction to ensure receipt recording and alert ack update succeed together
    const executeTx = async () => {
      // 1. Insert message receipt
      await db.runAsync(
        `INSERT INTO message_receipts (
          alertId,
          receiptType,
          receivedAt,
          senderOrDeviceId,
          metadata
        ) VALUES (?, ?, ?, ?, ?);`,
        [alertId, receiptType, receivedAt, senderOrDeviceId || null, metadataStr]
      );

      // 2. Atomically update alert acknowledgment state
      await db.runAsync(
        `UPDATE alerts
         SET ackStatus = 'acknowledged', updatedAt = ?
         WHERE alertId = ?;`,
        [receivedAt, alertId]
      );
    };

    if (typeof db.withTransactionAsync === 'function') {
      await db.withTransactionAsync(executeTx);
    } else {
      await executeTx();
    }

    return {
      alertId,
      receiptType,
      receivedAt,
      senderOrDeviceId,
      metadata: metadataStr,
    };
  }

  /**
   * Retrieve all receipts for a specific emergency alert.
   */
  static async getReceiptsForAlert(alertId) {
    if (!alertId) return [];
    const db = await getDatabase();
    return db.getAllAsync(
      'SELECT * FROM message_receipts WHERE alertId = ? ORDER BY receivedAt DESC;',
      [alertId]
    );
  }

  /**
   * Retrieve recent receipts across all alerts.
   */
  static async getAllReceipts(limit = 50) {
    const db = await getDatabase();
    return db.getAllAsync(
      'SELECT * FROM message_receipts ORDER BY receivedAt DESC LIMIT ?;',
      [limit]
    );
  }
}

export default ReceiptRepository;
