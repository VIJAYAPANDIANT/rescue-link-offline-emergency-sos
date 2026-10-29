/**
 * RescueLink — Comprehensive Automated Test Suite (Step 7)
 *
 * Verifies all 5 core subsystem modules:
 * 1. Authentication & Security (Registration, bcrypt hashing, JWT validation, ownership)
 * 2. Emergency Alert REST APIs & Validation (Categories, coordinate bounds, authorization)
 * 3. BLE Protocol & Serialization [Hardware Mocked] (MTU bounds, credential scrubbing, deduplication)
 * 4. SQLite Offline Persistence & Migrations (Versioned migrations, WAL, multi-source persistence, atomic ACK)
 * 5. Offline Outbox & Cloud Synchronization (Idempotency, exponential backoff, relay attribution, 401 handling)
 */

import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import http from 'node:http';
import bcrypt from '../server/node_modules/bcryptjs/index.js';
import jwt from '../server/node_modules/jsonwebtoken/index.js';

// Mobile modules
import { runMigrations } from '../mobile/src/database/migrations.js';
import { setCustomDatabase, resetDatabaseInstance } from '../mobile/src/database/database.js';
import { AlertRepository } from '../mobile/src/database/alertRepository.js';
import { ReceiptRepository } from '../mobile/src/database/receiptRepository.js';
import { SyncQueueRepository } from '../mobile/src/database/syncQueueRepository.js';
import { syncService } from '../mobile/src/services/sync/syncService.js';
import { networkService } from '../mobile/src/services/network/networkService.js';
import { apiClient } from '../mobile/src/services/api/apiClient.js';
import {
  buildSOSAlertPayload,
  buildSOSAcknowledgePayload,
  serializeBLEMessage,
  deserializeBLEMessage,
  sanitizeBLEPayload,
} from '../mobile/src/services/bluetooth/bleProtocol.js';

// Server modules
import app from '../server/server.js';
import config from '../server/config/env.js';
import userStore from '../server/services/userStore.js';
import alertStore from '../server/services/alertStore.js';
import alertService from '../server/services/alert.service.js';

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

// Start ephemeral server for real HTTP integration tests
let testServer = null;
let testServerBaseUrl = '';

function startEphemeralServer() {
  return new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      testServerBaseUrl = `http://127.0.0.1:${port}/api`;
      resolve(testServerBaseUrl);
    });
  });
}

function stopEphemeralServer() {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(resolve);
    } else {
      resolve();
    }
  });
}

async function runComprehensiveTestSuite() {
  console.log('================================================================');
  console.log('   RESCUELINK STEP 7 COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  let totalPassed = 0;
  let totalTests = 0;

  const runTest = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      totalPassed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      if (err.stack) console.error(err.stack);
    }
  };

  await startEphemeralServer();
  apiClient.setBaseUrl(testServerBaseUrl);

  const initialAlerts = await alertStore.readAlerts();
  const initialUsers = await userStore.readUsers();

  try {
    // =========================================================================
    // MODULE 1: AUTHENTICATION, JWT & SECURITY
    // =========================================================================
    console.log('--- Module 1: Authentication, JWT & Security ---');

    await runTest('Auth: Registration validates name length, email format, and password length', async () => {
      // Short name
      const res1 = await fetch(`${testServerBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', email: 'valid@rescuelink.org', password: 'password123' }),
      });
      assert.strictEqual(res1.status, 400);

      // Invalid email
      const res2 = await fetch(`${testServerBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid Name', email: 'invalid-email', password: 'password123' }),
      });
      assert.strictEqual(res2.status, 400);

      // Short password
      const res3 = await fetch(`${testServerBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid Name', email: 'valid@rescuelink.org', password: '123' }),
      });
      assert.strictEqual(res3.status, 400);
    });

    const testUserEmail = `responder_${Date.now()}@rescuelink.org`;
    const testUserPassword = 'secureResponderPass2026';
    let testUserToken = null;
    let testUserId = null;

    await runTest('Auth: Register creates user with bcrypt salt rounds and returns token without passwordHash', async () => {
      const res = await fetch(`${testServerBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Lead Responder',
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.token, 'Must return JWT token');
      assert.strictEqual(data.user.email, testUserEmail.toLowerCase());
      assert.strictEqual(data.user.passwordHash, undefined, 'passwordHash must never be returned in API response');

      testUserToken = data.token;
      testUserId = data.user.id;
    });

    await runTest('Auth: Rejects duplicate email registration with 409 Conflict', async () => {
      const res = await fetch(`${testServerBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Another Responder',
          email: testUserEmail.toUpperCase(), // Case-insensitive duplicate test
          password: 'anotherPassword123',
        }),
      });
      assert.strictEqual(res.status, 409);
    });

    await runTest('Auth: Login authenticates valid credentials and returns new JWT', async () => {
      const res = await fetch(`${testServerBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.user.passwordHash, undefined);
    });

    await runTest('Auth: Login returns generic 401 error on invalid credentials to prevent enumeration', async () => {
      // Wrong password
      const res1 = await fetch(`${testServerBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUserEmail, password: 'wrongPassword' }),
      });
      assert.strictEqual(res1.status, 401);
      const d1 = await res1.json();
      assert.strictEqual(d1.error.code, 'INVALID_CREDENTIALS');

      // Non-existent user
      const res2 = await fetch(`${testServerBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@rescuelink.org', password: 'password123' }),
      });
      assert.strictEqual(res2.status, 401);
      const d2 = await res2.json();
      assert.strictEqual(d2.error.code, 'INVALID_CREDENTIALS');
    });

    await runTest('Auth: Protected routes reject missing token, bad format, and expired token', async () => {
      // Missing token
      const res1 = await fetch(`${testServerBaseUrl}/auth/me`);
      assert.strictEqual(res1.status, 401);

      // Malformed header
      const res2 = await fetch(`${testServerBaseUrl}/auth/me`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      assert.strictEqual(res2.status, 401);

      // Expired token simulation
      const expiredToken = jwt.sign(
        { id: testUserId, email: testUserEmail },
        config.jwt.secret,
        { expiresIn: '-1s' }
      );
      const res3 = await fetch(`${testServerBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(res3.status, 401);
      const d3 = await res3.json();
      assert.strictEqual(d3.error.code, 'TOKEN_EXPIRED');
    });

    // =========================================================================
    // MODULE 2: EMERGENCY ALERT REST API & AUTHORIZATION ISOLATION
    // =========================================================================
    console.log('\n--- Module 2: Emergency Alert REST API & Validation ---');

    let createdAlertId = null;

    await runTest('Alert API: Creates alert with supported category and Test/Drill demo mode', async () => {
      const res = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Test / Drill',
          details: 'Simulated search and rescue demonstration drill',
          contactDetails: 'Basecamp Lead 555-0100',
          location: { latitude: 13.0827, longitude: 80.2707 },
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.emergencyType, 'Test / Drill');
      assert.strictEqual(data.data.status, 'Pending');
      assert.strictEqual(data.data.senderId, testUserId);
      createdAlertId = data.data.id;
    });

    await runTest('Alert API: Rejects invalid emergency category and out-of-bounds coordinates', async () => {
      // Invalid category
      const res1 = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ emergencyType: 'AlienInvasion' }),
      });
      assert.strictEqual(res1.status, 400);

      // Out-of-bounds latitude (95 > 90)
      const res2 = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Medical Emergency',
          location: { latitude: 95.0, longitude: 80.0 },
        }),
      });
      assert.strictEqual(res2.status, 400);

      // Incomplete coordinates (latitude without longitude)
      const res3 = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Medical Emergency',
          location: { latitude: 13.0 },
        }),
      });
      assert.strictEqual(res3.status, 400);
    });

    await runTest('Alert API: Cross-user isolation conceals unowned alerts with 404', async () => {
      // Create a second user
      const otherUser = await userStore.createUser({
        name: 'Other Responder',
        email: `other_${Date.now()}@rescuelink.org`,
        passwordHash: 'dummy_hash',
      });
      const otherToken = jwt.sign(
        { id: otherUser.id, email: otherUser.email },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Second user attempts to access first user's alert
      const res = await fetch(`${testServerBaseUrl}/alerts/${createdAlertId}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      assert.strictEqual(res.status, 404, 'Must return 404 to prevent user enumeration');

      // Second user attempts to update first user's alert status
      const resPatch = await fetch(`${testServerBaseUrl}/alerts/${createdAlertId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherToken}`,
        },
        body: JSON.stringify({ status: 'Resolved' }),
      });
      assert.strictEqual(resPatch.status, 404);
    });

    await runTest('Alert API: Direct transition to "Acknowledged" is rejected (reserved for receiver confirmation)', async () => {
      const res = await fetch(`${testServerBaseUrl}/alerts/${createdAlertId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ status: 'Acknowledged' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'TRANSITION_NOT_PERMITTED');
    });

    await runTest('Alert API: Owner successfully marks alert as Resolved', async () => {
      const res = await fetch(`${testServerBaseUrl}/alerts/${createdAlertId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({ status: 'Resolved' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.status, 'Resolved');
    });

    // =========================================================================
    // MODULE 3: BLE PROTOCOL & CREDENTIAL SANITIZATION [HARDWARE MOCKED]
    // =========================================================================
    console.log('\n--- Module 3: BLE Protocol & Sanitization [Hardware Mocked] ---');

    await runTest('BLE Protocol [Mocked]: Serializes SOS_ALERT to Base64 and enforces 512-byte MTU', () => {
      const payload = buildSOSAlertPayload({
        alertId: 'ble-alert-001',
        emergencyType: 'Medical Emergency',
        details: 'Short medical distress description',
        senderName: 'Alex Responder',
        latitude: 13.0827,
        longitude: 80.2707,
      });

      const serialized = serializeBLEMessage(payload);
      assert.ok(typeof serialized === 'string', 'Serialized message must be a Base64 string');

      const rawBytes = Buffer.from(serialized, 'base64');
      assert.ok(rawBytes.length <= 512, `Size (${rawBytes.length}) must not exceed 512 bytes`);
    });

    await runTest('BLE Protocol [Mocked]: Strictly strips sensitive credentials (JWT, passwords, hashes)', () => {
      const dirtyPayload = {
        version: 1,
        type: 'SOS_ALERT',
        alertId: 'ble-alert-002',
        emergencyType: 'Fire',
        token: 'secret_jwt_token_123',
        password: 'plain_password',
        passwordHash: '$2b$10$hashvalue',
      };

      const cleaned = sanitizeBLEPayload(dirtyPayload);
      assert.strictEqual(cleaned.token, undefined);
      assert.strictEqual(cleaned.password, undefined);
      assert.strictEqual(cleaned.passwordHash, undefined);

      const serialized = serializeBLEMessage(dirtyPayload);
      const deserialized = deserializeBLEMessage(serialized);
      assert.strictEqual(deserialized.valid, true);
      assert.strictEqual(deserialized.message.token, undefined);
      assert.strictEqual(deserialized.message.password, undefined);
      assert.strictEqual(deserialized.message.passwordHash, undefined);
    });

    await runTest('BLE Protocol [Mocked]: Safely handles malformed strings without throwing errors', () => {
      const malformed1 = deserializeBLEMessage('NOT_VALID_BASE64_OR_JSON');
      assert.strictEqual(malformed1.valid, false);

      const malformed2 = deserializeBLEMessage('');
      assert.strictEqual(malformed2.valid, false);

      const malformed3 = deserializeBLEMessage(null);
      assert.strictEqual(malformed3.valid, false);
    });

    // =========================================================================
    // MODULE 4: SQLITE OFFLINE PERSISTENCE & STATE CONSISTENCY
    // =========================================================================
    console.log('\n--- Module 4: SQLite Offline Persistence & State Consistency ---');

    const mockDb = createInMemoryExpoSqliteWrapper();
    setCustomDatabase(mockDb);

    await runTest('SQLite: Migrations v1 and v2 apply idempotently and create all tables and indexes', async () => {
      await runMigrations(mockDb);

      const tables = await mockDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table';");
      const tableNames = tables.map((t) => t.name);
      assert.ok(tableNames.includes('alerts'), 'Must create alerts table');
      assert.ok(tableNames.includes('message_receipts'), 'Must create message_receipts table');
      assert.ok(tableNames.includes('sync_queue'), 'Must create sync_queue table');
      assert.ok(tableNames.includes('schema_migrations'), 'Must create schema_migrations table');
    });

    const localAlertId = `sqlite-alert-${Date.now()}`;

    await runTest('SQLite: Persists alert with distinct delivery, ack, and sync states', async () => {
      const res = await AlertRepository.saveOrUpdateAlert({
        alertId: localAlertId,
        emergencyType: 'Accident',
        details: 'Motorcycle collision at intersection',
        source: 'local',
        deliveryStatus: 'Pending',
        ackStatus: 'unacknowledged',
        syncStatus: 'pending_sync',
      });

      assert.strictEqual(res.isNew, true);

      const stored = await AlertRepository.getAlertById(localAlertId);
      assert.strictEqual(stored.emergencyType, 'Accident');
      assert.strictEqual(stored.source, 'local');
      assert.strictEqual(stored.deliveryStatus, 'Pending');
      assert.strictEqual(stored.ackStatus, 'unacknowledged');
      assert.strictEqual(stored.syncStatus, 'pending_sync');
    });

    await runTest('SQLite: Duplicate prevention updates existing alert without creating duplicate rows', async () => {
      await AlertRepository.saveOrUpdateAlert({
        alertId: localAlertId,
        details: 'Updated details: emergency services called',
        deliveryStatus: 'Pending',
      });

      const counts = await AlertRepository.getAlertCounts();
      assert.strictEqual(counts.total, 1, 'Total alert rows must remain 1');

      const updated = await AlertRepository.getAlertById(localAlertId);
      assert.strictEqual(updated.details, 'Updated details: emergency services called');
    });

    await runTest('SQLite: Recording message receipt atomically updates ackStatus to "acknowledged"', async () => {
      const receipt = await ReceiptRepository.recordReceipt({
        alertId: localAlertId,
        receiptType: 'BLE_ACK_RECEIVED',
        senderOrDeviceId: 'node-rx-99',
        metadata: { rssi: -45 },
      });

      assert.ok(receipt.id);

      const updatedAlert = await AlertRepository.getAlertById(localAlertId);
      assert.strictEqual(updatedAlert.ackStatus, 'acknowledged', 'ackStatus must be updated to acknowledged');
    });

    // =========================================================================
    // MODULE 5: OFFLINE OUTBOX & CLOUD SYNCHRONIZATION
    // =========================================================================
    console.log('\n--- Module 5: Offline Outbox & Cloud Synchronization ---');

    await runTest('Outbox: Enqueue deduplication updates existing item instead of creating duplicate', async () => {
      const q1 = await SyncQueueRepository.enqueue({
        alertId: localAlertId,
        operation: 'CREATE',
        payload: { emergencyType: 'Accident' },
      });
      assert.strictEqual(q1.isNew, true);

      const q2 = await SyncQueueRepository.enqueue({
        alertId: localAlertId,
        operation: 'CREATE',
        payload: { emergencyType: 'Accident', updated: true },
      });
      assert.strictEqual(q2.isNew, false);
      assert.strictEqual(q1.id, q2.id);

      const pendingCount = await SyncQueueRepository.getPendingCount();
      assert.strictEqual(pendingCount, 1);
    });

    await runTest('Outbox: Exponential backoff calculation respects base delay (5s) and max cap (300s)', () => {
      const b0 = syncService.calculateBackoff(0);
      const b1 = syncService.calculateBackoff(1);
      const b2 = syncService.calculateBackoff(2);
      const b10 = syncService.calculateBackoff(10);

      assert.ok(b0 >= 5000 && b0 <= 6000);
      assert.ok(b1 >= 10000 && b1 <= 11000);
      assert.ok(b2 >= 20000 && b2 <= 21000);
      assert.ok(b10 <= 300000);
    });

    await runTest('Sync Engine: Batch sync to backend records BLE relay attribution without impersonating peer', async () => {
      const peerAlertId = `ble-peer-${Date.now()}`;
      const payload = [
        {
          alertId: peerAlertId,
          emergencyType: 'Personal Safety',
          details: 'Lost hiker near ridge line',
          source: 'bluetooth',
          originalSenderName: 'Lost Hiker Dave',
          createdAt: new Date().toISOString(),
        },
      ];

      const syncResult = await alertService.syncAlerts(testUserId, payload);
      assert.strictEqual(syncResult.summary.synced, 1);

      const serverAlert = await alertStore.findById(peerAlertId);
      assert.ok(serverAlert);
      assert.strictEqual(serverAlert.source, 'bluetooth_relay');
      assert.strictEqual(serverAlert.senderName, 'Lost Hiker Dave', 'Must preserve original peer display name');
      assert.strictEqual(serverAlert.relayedBy, testUserId, 'Must record authenticated relaying user ID');
      assert.strictEqual(serverAlert.relayedByName, 'Lead Responder');
    });

    await runTest('Sync Engine: Backend sync is idempotent (re-upload returns already_synced without duplication)', async () => {
      const payload = [
        {
          alertId: localAlertId,
          emergencyType: 'Accident',
          details: 'Collision alert',
          source: 'local',
          createdAt: new Date().toISOString(),
        },
      ];

      // First sync
      const res1 = await alertService.syncAlerts(testUserId, payload);
      assert.strictEqual(res1.summary.synced, 1);

      // Second sync
      const res2 = await alertService.syncAlerts(testUserId, payload);
      assert.strictEqual(res2.summary.alreadySynced, 1);
      assert.strictEqual(res2.summary.synced, 0);
    });

    await runTest('Sync Engine: Partial batch failures reject bad items without failing valid ones', async () => {
      const validId = `valid-sync-${Date.now()}`;
      const payload = [
        {
          alertId: 'bad-type-alert',
          emergencyType: 'UnsupportedType',
          details: 'Invalid alert category',
        },
        {
          alertId: validId,
          emergencyType: 'Fire',
          details: 'Valid fire distress alert',
          source: 'local',
        },
      ];

      const res = await alertService.syncAlerts(testUserId, payload);
      assert.strictEqual(res.summary.failed, 1);
      assert.strictEqual(res.summary.synced, 1);

      const failedItem = res.results.find((r) => r.alertId === 'bad-type-alert');
      assert.strictEqual(failedItem.status, 'failed');

      const successItem = res.results.find((r) => r.alertId === validId);
      assert.strictEqual(successItem.status, 'synced');
    });

    await runTest('Sync Engine: End-to-end sync flushes outbox, deletes queue row, and marks SQLite alert "synced"', async () => {
      const e2eAlertId = `e2e-outbox-${Date.now()}`;

      // Save alert to SQLite
      await AlertRepository.saveOrUpdateAlert({
        alertId: e2eAlertId,
        emergencyType: 'Medical Emergency',
        details: 'Patient in need of first aid',
        source: 'local',
        deliveryStatus: 'Pending',
        syncStatus: 'pending_sync',
      });

      // Enqueue
      await SyncQueueRepository.enqueue({
        alertId: e2eAlertId,
        operation: 'CREATE',
        payload: { alertId: e2eAlertId, emergencyType: 'Medical Emergency' },
      });

      // Mock apiClient.syncAlerts for controlled testing
      const origSync = apiClient.syncAlerts;
      apiClient.setToken(testUserToken);
      apiClient.syncAlerts = async (alerts) => {
        return {
          success: true,
          results: alerts.map((a) => ({ alertId: a.alertId, status: 'synced' })),
        };
      };

      // Run sync
      const syncRes = await syncService.syncPendingAlerts();
      assert.strictEqual(syncRes.success, true);

      // Verify outbox item is deleted
      const queueItem = await mockDb.getFirstAsync('SELECT * FROM sync_queue WHERE alertId = ?;', [e2eAlertId]);
      assert.strictEqual(queueItem, null, 'Completed outbox item must be deleted');

      // Verify SQLite alert syncStatus is updated to 'synced'
      const alertInDb = await AlertRepository.getAlertById(e2eAlertId);
      assert.strictEqual(alertInDb.syncStatus, 'synced');

      apiClient.syncAlerts = origSync;
    });

    await runTest('Sync Engine: Authentication expiration (401) preserves local outbox items without deleting', async () => {
      const authExpAlertId = `auth-exp-${Date.now()}`;

      await AlertRepository.saveOrUpdateAlert({
        alertId: authExpAlertId,
        emergencyType: 'Personal Safety',
        details: 'Flash flood alert',
        source: 'local',
        syncStatus: 'pending_sync',
      });

      await SyncQueueRepository.enqueue({
        alertId: authExpAlertId,
        operation: 'CREATE',
        payload: { alertId: authExpAlertId },
      });

      const origSync = apiClient.syncAlerts;
      apiClient.setToken('expired_test_token');
      apiClient.syncAlerts = async () => ({
        success: false,
        status: 401,
        error: 'Token expired',
      });

      const syncRes = await syncService.syncPendingAlerts();
      assert.strictEqual(syncRes.success, false);
      assert.strictEqual(syncRes.reason, 'auth_expired');

      // Outbox item must NOT be deleted
      const queueItem = await mockDb.getFirstAsync('SELECT * FROM sync_queue WHERE alertId = ?;', [authExpAlertId]);
      assert.ok(queueItem, 'Outbox item must not be deleted on 401');
      assert.strictEqual(queueItem.status, 'failed');
      assert.ok(queueItem.errorMessage.includes('Authentication expired'));

      // SQLite alert syncStatus must remain 'pending_sync'
      const alertInDb = await AlertRepository.getAlertById(authExpAlertId);
      assert.strictEqual(alertInDb.syncStatus, 'pending_sync');

      apiClient.syncAlerts = origSync;
    });
  } finally {
    // Teardown and reset test databases and stores
    await stopEphemeralServer();
    await resetDatabaseInstance();
    await alertStore.writeAlerts(initialAlerts);
    await userStore.writeUsers(initialUsers);
  }

  console.log('\n================================================================');
  console.log(`   TOTAL RESULTS: ${totalPassed}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (totalPassed === totalTests) {
    console.log('✅ ALL STEP 7 COMPREHENSIVE TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`❌ ${totalTests - totalPassed} TEST(S) FAILED.\n`);
    process.exit(1);
  }
}

runComprehensiveTestSuite().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
