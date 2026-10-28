/**
 * RescueLink SQLite Schema Migrations
 *
 * Implements version-tracked, safe database migrations for offline persistence.
 */

export const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema: alerts, message_receipts, and sync_queue tables with indexes',
    up: async (db) => {
      // 1. SOS Alerts Table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alertId TEXT UNIQUE NOT NULL,
          senderId TEXT,
          senderName TEXT,
          emergencyType TEXT NOT NULL,
          details TEXT,
          contactDetails TEXT,
          latitude REAL,
          longitude REAL,
          createdAt TEXT NOT NULL,
          source TEXT NOT NULL CHECK(source IN ('local', 'bluetooth', 'server')),
          deliveryStatus TEXT NOT NULL,
          ackStatus TEXT NOT NULL DEFAULT 'unacknowledged' CHECK(ackStatus IN ('unacknowledged', 'acknowledged')),
          syncStatus TEXT NOT NULL DEFAULT 'pending_sync' CHECK(syncStatus IN ('synced', 'pending_sync', 'not_synced')),
          updatedAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_alert_id ON alerts(alertId);
        CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);
        CREATE INDEX IF NOT EXISTS idx_alerts_sync_status ON alerts(syncStatus);
        CREATE INDEX IF NOT EXISTS idx_alerts_delivery_status ON alerts(deliveryStatus);
      `);

      // 2. Message Receipts Table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS message_receipts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alertId TEXT NOT NULL,
          receiptType TEXT NOT NULL,
          receivedAt TEXT NOT NULL,
          senderOrDeviceId TEXT,
          metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_receipts_alert_id ON message_receipts(alertId);
        CREATE INDEX IF NOT EXISTS idx_receipts_received_at ON message_receipts(receivedAt DESC);
      `);

      // 3. Sync Queue (Offline Outbox) Table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alertId TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE_STATUS', 'RESOLVE')),
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
          retryCount INTEGER NOT NULL DEFAULT 0,
          errorMessage TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_alert_id ON sync_queue(alertId);
      `);
    },
  },
];

/**
 * Apply any pending migrations sequentially.
 *
 * @param {object} db - SQLite database instance
 */
export const runMigrations = async (db) => {
  // Ensure schema_migrations table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      appliedAt TEXT NOT NULL,
      description TEXT
    );
  `);

  // Fetch applied versions
  const appliedRows = await db.getAllAsync('SELECT version FROM schema_migrations ORDER BY version ASC;');
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Migrations] Applying migration v${migration.version}: ${migration.description}`);
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, appliedAt, description) VALUES (?, ?, ?);',
        [migration.version, new Date().toISOString(), migration.description]
      );
      console.log(`[Migrations] Migration v${migration.version} applied successfully.`);
    }
  }
};
