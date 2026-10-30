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
  {
    version: 2,
    description: 'Add retry scheduling metadata (lastAttemptAt, nextRetryAt) and deduplication index to sync_queue',
    up: async (db) => {
      // 1. Add backoff retry columns
      await db.execAsync(`
        ALTER TABLE sync_queue ADD COLUMN lastAttemptAt TEXT;
        ALTER TABLE sync_queue ADD COLUMN nextRetryAt TEXT;
      `);

      // 2. Prune any stale duplicates before creating unique index
      await db.execAsync(`
        DELETE FROM sync_queue
        WHERE id NOT IN (
          SELECT MAX(id) FROM sync_queue GROUP BY alertId, operation
        );
      `);

      // 3. Create index for retry polling and unique index to prevent duplicate queue items
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(status, nextRetryAt);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_alert_op ON sync_queue(alertId, operation);
      `);
    },
  },
  {
    version: 3,
    description: 'Add multi-device relay routing columns to alerts and create relay_history table',
    up: async (db) => {
      // 1. Add relay routing fields to alerts table
      await db.execAsync(`
        ALTER TABLE alerts ADD COLUMN hopCount INTEGER DEFAULT 0;
        ALTER TABLE alerts ADD COLUMN maxHops INTEGER DEFAULT 3;
        ALTER TABLE alerts ADD COLUMN forwarderId TEXT;
        ALTER TABLE alerts ADD COLUMN originalSenderId TEXT;
        ALTER TABLE alerts ADD COLUMN expiresAt TEXT;
        ALTER TABLE alerts ADD COLUMN relayStatus TEXT DEFAULT 'none';
        ALTER TABLE alerts ADD COLUMN lastForwardedAt TEXT;
        ALTER TABLE alerts ADD COLUMN integrityHash TEXT;

        CREATE INDEX IF NOT EXISTS idx_alerts_relay_status ON alerts(relayStatus);
        CREATE INDEX IF NOT EXISTS idx_alerts_hop_count ON alerts(hopCount);
      `);

      // 2. Create relay_history table for auditing all relay received/forwarded/dropped events
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS relay_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alertId TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('RECEIVED', 'FORWARDED', 'DROPPED')),
          hopCount INTEGER NOT NULL DEFAULT 0,
          forwarderId TEXT,
          previousHopId TEXT,
          statusReason TEXT,
          timestamp TEXT NOT NULL,
          metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_relay_history_alert_id ON relay_history(alertId);
        CREATE INDEX IF NOT EXISTS idx_relay_history_action ON relay_history(action);
        CREATE INDEX IF NOT EXISTS idx_relay_history_timestamp ON relay_history(timestamp DESC);
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
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      console.log(`[Migrations] Migration v${migration.version} applied successfully.`);
    }
  }
};
