/**
 * RescueLink Database Service Module
 *
 * Central export for SQLite database initialization, versioned migrations,
 * and repositories.
 */

export { getDatabase, resetDatabaseInstance, setCustomDatabase } from './database.js';
export { runMigrations, MIGRATIONS } from './migrations.js';
export { AlertRepository } from './alertRepository.js';
export { ReceiptRepository } from './receiptRepository.js';
export { SyncQueueRepository } from './syncQueueRepository.js';

import { getDatabase } from './database.js';
import { AlertRepository } from './alertRepository.js';
import { ReceiptRepository } from './receiptRepository.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export const databaseService = {
  getDatabase,
  alerts: AlertRepository,
  receipts: ReceiptRepository,
  syncQueue: SyncQueueRepository,
};

export default databaseService;
