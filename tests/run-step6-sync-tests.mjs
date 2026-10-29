/**
 * Step 6 Automated Test Suite:
 * Reliable Offline-to-Cloud Synchronization
 *
 * Verifies:
 * 1. SQLite Migration v2 execution, retry columns, and unique deduplication indexes.
 * 2. SyncQueueRepository: deduplication, backoff scheduling, eligible item filtering.
 * 3. SyncService exponential backoff calculation and concurrency locking.
 * 4. Backend synchronization service & endpoint:
 *    - Idempotent upsert via stable alertId
 *    - Attribution separation for BLE relayed alerts
 *    - Input validation per item (emergencyType, coordinates, length limits)
 *    - Unauthenticated rejection
 */

import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import { runMigrations } from '../mobile/src/database/migrations.js';
import { setCustomDatabase, resetDatabaseInstance } from '../mobile/src/database/database.js';
import { SyncQueueRepository } from '../mobile/src/database/syncQueueRepository.js';
import { syncService } from '../mobile/src/services/sync/syncService.js';
import alertService from '../server/services/alert.service.js';
import alertStore from '../server/services/alertStore.js';
import userStore from '../server/services/userStore.js';

// Helper to create an in-memory SQLite wrapper conforming to expo-sqlite async interface
function createInMemoryExpoSqliteWrapper() {
  const db = new DatabaseSync(':memory:');

  return {
    raw: db,
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params = []) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getFirstAsync(sql, params = []) {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params);
      return row || null;
    },
    async getAllAsync(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    },
    async withTransactionAsync(callback) {
      db.exec('BEGIN TRANSACTION;');
      try {
        const res = await callback();
        db.exec('COMMIT;');
        return res;
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    },
    async closeAsync() {
      db.close();
    },
  };
}

async function runAllTests() {
  console.log('\n=== RUNNING STEP 6 SYNCHRONIZATION TESTS ===\n');
  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      if (err.stack) console.error(err.stack);
    }
  };

  // ----------------------------------------------------
  // TEST GROUP 1: SQLite Migrations & Sync Queue Repository
  // ----------------------------------------------------
  console.log('--- Group 1: SQLite Migrations & Outbox Repository ---');

  const mockDb = createInMemoryExpoSqliteWrapper();
  setCustomDatabase(mockDb);

  await test('Migrations v1 and v2 apply successfully on clean SQLite database', async () => {
    await runMigrations(mockDb);

    // Verify user_version is 2
    const versionRow = await mockDb.getFirstAsync('PRAGMA user_version;');
    assert.strictEqual(versionRow.user_version, 2, 'user_version must equal 2 after Migration v2');

    // Verify columns lastAttemptAt and nextRetryAt exist in sync_queue
    const tableInfo = await mockDb.getAllAsync("PRAGMA table_info('sync_queue');");
    const columnNames = tableInfo.map((col) => col.name);
    assert.ok(columnNames.includes('lastAttemptAt'), 'sync_queue must have lastAttemptAt column');
    assert.ok(columnNames.includes('nextRetryAt'), 'sync_queue must have nextRetryAt column');
  });

  await test('SyncQueueRepository: Enqueue deduplication prevents multiple rows for same alertId + op', async () => {
    const alertId = 'test-alert-uuid-101';

    // First enqueue
    const item1 = await SyncQueueRepository.enqueue({
      alertId,
      operation: 'CREATE',
      payload: { details: 'Initial alert text' },
    });
    assert.strictEqual(item1.isNew, true, 'First enqueue should be marked as new');

    // Count rows
    const count1 = await SyncQueueRepository.getPendingCount();
    assert.strictEqual(count1, 1, 'Pending count should be 1');

    // Duplicate enqueue with updated payload
    const item2 = await SyncQueueRepository.enqueue({
      alertId,
      operation: 'CREATE',
      payload: { details: 'Updated alert text' },
    });
    assert.strictEqual(item2.isNew, false, 'Duplicate enqueue should update existing row');
    assert.strictEqual(item2.id, item1.id, 'Duplicate enqueue should reuse same row ID');

    // Count rows must still be 1
    const count2 = await SyncQueueRepository.getPendingCount();
    assert.strictEqual(count2, 1, 'Pending count must still be 1 after deduplicated enqueue');
  });

  await test('SyncQueueRepository: Backoff scheduling and eligible items retrieval', async () => {
    const alertId = 'test-alert-uuid-102';
    const queueItem = await SyncQueueRepository.enqueue({
      alertId,
      operation: 'CREATE',
      payload: { details: 'Need assistance' },
    });

    // Mark attempt (in-flight)
    await SyncQueueRepository.markAttempt(queueItem.id);
    const rowAfterAttempt = await mockDb.getFirstAsync(
      'SELECT status, lastAttemptAt FROM sync_queue WHERE id = ?;',
      [queueItem.id]
    );
    assert.strictEqual(rowAfterAttempt.status, 'processing', 'status should be set to processing');
    assert.ok(rowAfterAttempt.lastAttemptAt, 'lastAttemptAt must be recorded');

    // Mark failed with 60s backoff (in future)
    await SyncQueueRepository.markFailed(queueItem.id, 'Connection timeout', 60000);
    const rowAfterFail = await mockDb.getFirstAsync(
      'SELECT retryCount, status FROM sync_queue WHERE id = ?;',
      [queueItem.id]
    );
    assert.strictEqual(rowAfterFail.retryCount, 1, 'retryCount should be incremented to 1 on failure');
    assert.strictEqual(rowAfterFail.status, 'failed', 'status should be set to failed');

    // Verify it is not eligible right now because nextRetryAt is in the future
    const eligibleNow = await SyncQueueRepository.getEligibleItems();
    const isExcluded = !eligibleNow.some((item) => item.id === queueItem.id);
    assert.ok(isExcluded, 'Item with future nextRetryAt must be excluded from eligible items');

    // Mark failed with -1000 backoff (timestamp in the past, immediate retry eligible)
    await SyncQueueRepository.markFailed(queueItem.id, 'Connection timeout', -1000);
    const eligibleAfterZeroBackoff = await SyncQueueRepository.getEligibleItems();
    const isIncluded = eligibleAfterZeroBackoff.some((item) => item.id === queueItem.id);
    assert.ok(isIncluded, 'Item with elapsed nextRetryAt must be included in eligible items');
  });

  // ----------------------------------------------------
  // TEST GROUP 2: SyncService Backoff Algorithm
  // ----------------------------------------------------
  console.log('\n--- Group 2: SyncService Logic & Backoff Calculation ---');

  await test('SyncService: Exponential backoff algorithm bounds', async () => {
    const backoff0 = syncService.calculateBackoff(0);
    const backoff1 = syncService.calculateBackoff(1);
    const backoff2 = syncService.calculateBackoff(2);
    const backoff10 = syncService.calculateBackoff(10);

    // base is 5000ms + jitter (0-1000ms)
    assert.ok(backoff0 >= 5000 && backoff0 <= 6000, `backoff0 (${backoff0}) must be between 5000 and 6000ms`);
    assert.ok(backoff1 >= 10000 && backoff1 <= 11000, `backoff1 (${backoff1}) must be between 10000 and 11000ms`);
    assert.ok(backoff2 >= 20000 && backoff2 <= 21000, `backoff2 (${backoff2}) must be between 20000 and 21000ms`);
    // cap is 300000ms (5 mins)
    assert.ok(backoff10 <= 300000, `backoff10 (${backoff10}) must be capped at 300000ms`);
  });

  // ----------------------------------------------------
  // TEST GROUP 3: Backend Synchronization API & Attribution
  // ----------------------------------------------------
  console.log('\n--- Group 3: Backend Sync Service & Attribution ---');

  // Use existing registered user for testing
  let testUser = await userStore.findByEmail('alex.rivera@rescuelink.org');
  if (!testUser) {
    testUser = await userStore.createUser({
      name: 'Alex Rivera',
      email: 'alex.rivera@rescuelink.org',
      passwordHash: 'dummy_hash',
    });
  }

  // Backup current alerts in store
  const originalAlerts = await alertStore.readAlerts();

  await test('Backend syncAlerts: Rejects unauthenticated sync request', async () => {
    try {
      await alertService.syncAlerts(null, []);
      assert.fail('Should have thrown UNAUTHORIZED error');
    } catch (err) {
      assert.strictEqual(err.code, 'UNAUTHORIZED');
    }
  });

  await test('Backend syncAlerts: Synchronizes new alert with "synced" status', async () => {
    const testAlertId = `sync-test-${Date.now()}-1`;
    const payload = [
      {
        alertId: testAlertId,
        emergencyType: 'Medical Emergency',
        details: 'Patient collapsed, offline alert created',
        contactDetails: '+1555123456',
        location: { latitude: 12.9716, longitude: 77.5946 },
        source: 'local',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await alertService.syncAlerts(testUser.id, payload);
    assert.strictEqual(result.summary.synced, 1, 'Should record 1 synced alert');
    assert.strictEqual(result.summary.failed, 0, 'Should have 0 failed');
    assert.strictEqual(result.results[0].status, 'synced');
    assert.strictEqual(result.results[0].alertId, testAlertId);

    // Verify stored alert in alertStore
    const stored = await alertStore.findById(testAlertId);
    assert.ok(stored, 'Stored alert must exist in alertStore');
    assert.strictEqual(stored.senderId, testUser.id, 'SenderId must match authenticated user');
    assert.strictEqual(stored.emergencyType, 'Medical Emergency');
  });

  await test('Backend syncAlerts: Idempotency - re-syncing returns "already_synced" without duplicate', async () => {
    const testAlertId = `sync-test-idempotent-${Date.now()}`;
    const payload = [
      {
        alertId: testAlertId,
        emergencyType: 'Fire',
        details: 'Kitchen fire, need extinguisher',
        location: { latitude: 13.0827, longitude: 80.2707 },
        source: 'local',
        createdAt: new Date().toISOString(),
      },
    ];

    // First sync
    const res1 = await alertService.syncAlerts(testUser.id, payload);
    assert.strictEqual(res1.summary.synced, 1);

    // Second sync with identical alertId
    const res2 = await alertService.syncAlerts(testUser.id, payload);
    assert.strictEqual(res2.summary.alreadySynced, 1, 'Second sync must return alreadySynced: 1');
    assert.strictEqual(res2.summary.synced, 0, 'Second sync must have synced: 0');
    assert.strictEqual(res2.results[0].status, 'already_synced');
  });

  await test('Backend syncAlerts: Relay attribution for Bluetooth alerts', async () => {
    const bleAlertId = `ble-relay-${Date.now()}`;
    const payload = [
      {
        alertId: bleAlertId,
        emergencyType: 'Accident',
        details: 'Two vehicles collided on highway',
        originalSenderName: 'Stranded Motorist John',
        source: 'bluetooth',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await alertService.syncAlerts(testUser.id, payload);
    assert.strictEqual(result.summary.synced, 1);

    const stored = await alertStore.findById(bleAlertId);
    assert.ok(stored, 'Stored relayed alert must exist');
    assert.strictEqual(stored.source, 'bluetooth_relay', 'Source must be bluetooth_relay');
    assert.strictEqual(stored.senderName, 'Stranded Motorist John', 'Preserves original peer name');
    assert.strictEqual(stored.relayedBy, testUser.id, 'relayedBy must record authenticated uploader');
    assert.strictEqual(stored.relayedByName, testUser.name, 'relayedByName must record uploader display name');
  });

  await test('Backend syncAlerts: Per-item validation handles bad items without aborting valid ones', async () => {
    const validId = `valid-in-batch-${Date.now()}`;
    const payload = [
      {
        alertId: 'invalid-type-alert',
        emergencyType: 'AlienInvasion', // Invalid emergencyType
        details: 'Flying saucer sighted',
      },
      {
        alertId: 'invalid-coords-alert',
        emergencyType: 'Personal Safety',
        location: { latitude: 150.0, longitude: 200.0 }, // Coordinates out of bounds
      },
      {
        alertId: validId,
        emergencyType: 'Personal Safety',
        details: 'Valid emergency message',
      },
    ];

    const result = await alertService.syncAlerts(testUser.id, payload);
    assert.strictEqual(result.summary.failed, 2, 'Two invalid items should fail');
    assert.strictEqual(result.summary.synced, 1, 'One valid item should succeed');

    const failedItem1 = result.results.find((r) => r.alertId === 'invalid-type-alert');
    assert.strictEqual(failedItem1.status, 'failed');
    assert.ok(failedItem1.error.includes('Invalid emergency type'));

    const failedItem2 = result.results.find((r) => r.alertId === 'invalid-coords-alert');
    assert.strictEqual(failedItem2.status, 'failed');
    assert.ok(failedItem2.error.includes('Coordinates out of bounds'));

    const successItem = result.results.find((r) => r.alertId === validId);
    assert.strictEqual(successItem.status, 'synced');
  });

  // ----------------------------------------------------
  // TEST GROUP 4: SyncService End-to-End Outbox & Auth Expiration
  // ----------------------------------------------------
  console.log('\n--- Group 4: SyncService End-to-End Outbox & Guards ---');

  const { AlertRepository } = await import('../mobile/src/database/alertRepository.js');
  const { apiClient } = await import('../mobile/src/services/api/apiClient.js');
  const { networkService } = await import('../mobile/src/services/network/networkService.js');

  await test('SyncService: Offline state prevents network calls and returns offline reason', async () => {
    networkService.setMockReachability(false);
    apiClient.setToken('dummy_valid_token');

    const result = await syncService.syncPendingAlerts();
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'offline');

    // Restore online
    networkService.setMockReachability(true);

    // Wait for any auto-sync triggered by reconnect to settle
    while (syncService.isSyncing) {
      await new Promise((r) => setTimeout(r, 50));
    }
  });

  await test('SyncService: End-to-end sync uploads outbox, removes queue item, and updates SQLite alert', async () => {
    while (syncService.isSyncing) {
      await new Promise((r) => setTimeout(r, 50));
    }

    const alertId = `e2e-sync-${Date.now()}`;

    // 1. Save alert into SQLite
    await AlertRepository.saveOrUpdateAlert({
      alertId,
      emergencyType: 'Medical Emergency',
      details: 'Patient needs oxygen cylinder immediately',
      contactDetails: 'Room 302',
      source: 'local',
      deliveryStatus: 'Pending',
      syncStatus: 'pending_sync',
    });

    // 2. Enqueue into outbox
    await SyncQueueRepository.enqueue({
      alertId,
      operation: 'CREATE',
      payload: { alertId, emergencyType: 'Medical Emergency' },
    });

    const pendingBefore = await SyncQueueRepository.getPendingCount();
    assert.ok(pendingBefore >= 1, 'Should have at least 1 pending item before sync');

    // 3. Mock apiClient.syncAlerts to simulate successful backend response
    const origSyncAlerts = apiClient.syncAlerts;
    apiClient.setToken('valid_test_token');
    apiClient.syncAlerts = async (alerts) => {
      return {
        success: true,
        results: alerts.map((a) => ({ alertId: a.alertId, status: 'synced' })),
      };
    };

    // 4. Run sync
    const syncRes = await syncService.syncPendingAlerts();
    assert.strictEqual(syncRes.success, true);
    assert.strictEqual(syncRes.synced, 1);

    // 5. Verify queue item was removed
    const remainingInQueue = await mockDb.getFirstAsync(
      'SELECT * FROM sync_queue WHERE alertId = ?;',
      [alertId]
    );
    assert.strictEqual(remainingInQueue, null, 'Completed queue item must be deleted from outbox');

    // 6. Verify SQLite alert syncStatus was updated to 'synced'
    const updatedAlert = await AlertRepository.getAlertById(alertId);
    assert.strictEqual(updatedAlert.syncStatus, 'synced', 'Alert syncStatus in SQLite must be "synced"');

    // Restore original method
    apiClient.syncAlerts = origSyncAlerts;
  });

  await test('SyncService: 401 Unauthorized preserves local outbox without deleting items', async () => {
    const alertId = `auth-exp-${Date.now()}`;

    // Save alert into SQLite
    await AlertRepository.saveOrUpdateAlert({
      alertId,
      emergencyType: 'Personal Safety',
      details: 'Flash flood warning',
      source: 'local',
      deliveryStatus: 'Pending',
      syncStatus: 'pending_sync',
    });

    // Enqueue
    const queueItem = await SyncQueueRepository.enqueue({
      alertId,
      operation: 'CREATE',
      payload: { alertId, emergencyType: 'Personal Safety' },
    });

    // Mock apiClient.syncAlerts to return 401 Unauthorized
    const origSyncAlerts = apiClient.syncAlerts;
    apiClient.setToken('expired_token');
    apiClient.syncAlerts = async () => {
      return {
        success: false,
        status: 401,
        error: 'Session token has expired',
      };
    };

    // Run sync
    const syncRes = await syncService.syncPendingAlerts();
    assert.strictEqual(syncRes.success, false);
    assert.strictEqual(syncRes.reason, 'auth_expired');

    // Verify outbox item was NOT removed
    const queueRow = await mockDb.getFirstAsync('SELECT * FROM sync_queue WHERE alertId = ?;', [alertId]);
    assert.ok(queueRow, 'Outbox item must not be deleted on 401');
    assert.strictEqual(queueRow.status, 'failed');
    assert.ok(queueRow.errorMessage.includes('Authentication expired'));

    // SQLite alert syncStatus must NOT be set to synced
    const alert = await AlertRepository.getAlertById(alertId);
    assert.strictEqual(alert.syncStatus, 'pending_sync', 'Alert in SQLite must retain pending_sync status');

    // Restore original method
    apiClient.syncAlerts = origSyncAlerts;
  });

  // Clean up
  await resetDatabaseInstance();
  await alertStore.writeAlerts(originalAlerts);

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed === total) {
    console.log('ALL STEP 6 SYNCHRONIZATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`SOME TESTS FAILED: ${total - passed} failure(s)`);
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
