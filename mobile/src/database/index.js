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
export { RelayRepository } from './relayRepository.js';

import { getDatabase } from './database.js';
import { AlertRepository } from './alertRepository.js';
import { ReceiptRepository } from './receiptRepository.js';
import { SyncQueueRepository } from './syncQueueRepository.js';
import { RelayRepository } from './relayRepository.js';

export const databaseService = {
  getDatabase,
  alerts: AlertRepository,
  receipts: ReceiptRepository,
  syncQueue: SyncQueueRepository,
  relay: RelayRepository,
};

export default databaseService;
