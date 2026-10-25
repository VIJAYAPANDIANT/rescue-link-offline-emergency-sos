/**
 * SQLite Database Service Blueprint
 *
 * NOTE: SQLite local database integration will be implemented in Step 3 using expo-sqlite.
 * This blueprint documents the tables and indexes designed for offline resilience.
 *
 * Tables:
 * 1. alerts
 *    - id TEXT PRIMARY KEY
 *    - type TEXT NOT NULL
 *    - details TEXT
 *    - contact_name TEXT
 *    - contact_phone TEXT
 *    - latitude REAL
 *    - longitude REAL
 *    - accuracy REAL
 *    - status TEXT (draft, active, relayed, synced, resolved)
 *    - created_at TEXT NOT NULL
 *    - is_synced INTEGER DEFAULT 0
 *
 * 2. nearby_devices
 *    - device_id TEXT PRIMARY KEY
 *    - device_name TEXT
 *    - rssi INTEGER
 *    - last_seen TEXT NOT NULL
 *    - hops_distance INTEGER DEFAULT 1
 *
 * 3. sync_queue
 *    - queue_id TEXT PRIMARY KEY
 *    - alert_id TEXT NOT NULL
 *    - retry_count INTEGER DEFAULT 0
 *    - last_attempt TEXT
 */

export const DB_CONFIG = {
  name: 'rescuelink_offline.db',
  version: '1.0.0',
  status: 'Schema blueprint ready for Step 3 expo-sqlite integration',
};

export default DB_CONFIG;
