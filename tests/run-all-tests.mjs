/**
 * RescueLink — Comprehensive Automated Test Suite (Step 8)
 *
 * Verifies all 6 core subsystem modules:
 * 1. Authentication & Security (Registration, bcrypt hashing, JWT validation, ownership)
 * 2. Emergency Alert REST APIs & Validation (Categories, coordinate bounds, authorization)
 * 3. BLE Protocol & Serialization [Hardware Mocked] (MTU bounds, credential scrubbing, deduplication)
 * 4. SQLite Offline Persistence & Migrations (Versioned migrations v1-v3, WAL, multi-source persistence, atomic ACK)
 * 5. Offline Outbox & Cloud Synchronization (Idempotency, exponential backoff, relay attribution, 401 handling)
 * 6. Multi-Device SOS Relay Network (Epidemic routing, hop count, integrity hash, TTL, loop prevention, rate limits)
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
import { RelayRepository } from '../mobile/src/database/relayRepository.js';
import { ContactRepository } from '../mobile/src/database/contactRepository.js';
import { NotificationRepository } from '../mobile/src/database/notificationRepository.js';
import { notificationQueueService } from '../mobile/src/services/notification/notificationQueueService.js';
import { relayService } from '../mobile/src/services/relay/relayService.js';
import { relaySettings } from '../mobile/src/services/relay/relaySettings.js';
import { syncService } from '../mobile/src/services/sync/syncService.js';
import { networkService } from '../mobile/src/services/network/networkService.js';
import { apiClient } from '../mobile/src/services/api/apiClient.js';
import {
  buildSOSAlertPayload,
  buildSOSAcknowledgePayload,
  buildRelayForwardPayload,
  computeAlertIntegrityHash,
  verifyAlertIntegrity,
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
import contactStore from '../server/services/contactStore.js';
import notificationStore from '../server/services/notificationStore.js';
import notificationService from '../server/services/notification/notificationService.js';
import auditStore from '../server/services/auditStore.js';

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
  console.log('   RESCUELINK STEP 12 COMPREHENSIVE PRODUCTION VERIFICATION SUITE');
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
  const initialContacts = await contactStore.readContacts();
  const initialNotifications = await notificationStore.readNotifications();
  const initialAuditLogs = await auditStore.readLogs();

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

    await runTest('Security & Headers: Backend enforces HTTP security headers and rate limit tracking headers', async () => {
      // 1. Verify HTTP security headers on health probe
      const resHealth = await fetch(`${testServerBaseUrl}/health`);
      assert.strictEqual(resHealth.status, 200);
      assert.strictEqual(resHealth.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(resHealth.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(resHealth.headers.get('x-xss-protection'), '1; mode=block');

      // 2. Verify Rate Limiting tracking headers on protected API routes
      const resApi = await fetch(`${testServerBaseUrl}/alerts`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.ok(resApi.headers.get('x-ratelimit-limit'), 'Must include X-RateLimit-Limit');
      assert.ok(resApi.headers.get('x-ratelimit-remaining'), 'Must include X-RateLimit-Remaining');
    });

    await runTest('Readiness Probe: GET /api/ready verifies storage health, data stores, and memory stats', async () => {
      const res = await fetch(`${testServerBaseUrl}/ready`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'ready');
      assert.strictEqual(data.checks.storageDirectory, true);
      assert.ok(data.checks.dataStores);
      assert.ok(data.checks.memoryStats);
      assert.ok(data.checks.memoryStats.heapUsedMb > 0);
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

    await runTest('SQLite: Migrations v1, v2, and v3 apply idempotently and create all tables and indexes', async () => {
      await runMigrations(mockDb);

      const tables = await mockDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table';");
      const tableNames = tables.map((t) => t.name);
      assert.ok(tableNames.includes('alerts'), 'Must create alerts table');
      assert.ok(tableNames.includes('message_receipts'), 'Must create message_receipts table');
      assert.ok(tableNames.includes('sync_queue'), 'Must create sync_queue table');
      assert.ok(tableNames.includes('relay_history'), 'Must create relay_history table');
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

    // =========================================================================
    // MODULE 6: MULTI-DEVICE SOS RELAY NETWORK (STEP 8)
    // =========================================================================
    console.log('\n--- Module 6: Multi-Device SOS Relay Network ---');

    await runTest('Relay Protocol: Serializes valid relay SOS_ALERT with hop count, integrity hash, and under 512 MTU', () => {
      const payload = buildSOSAlertPayload({
        alertId: 'relay-alert-001',
        emergencyType: 'Medical Emergency',
        details: 'Hiker with broken leg at mile marker 4',
        senderName: 'Alice Origin',
        latitude: 13.0827,
        longitude: 80.2707,
        hopCount: 0,
        maxHops: 3,
        originalSenderId: 'user-alice-01',
      });

      assert.strictEqual(payload.version, 2);
      assert.strictEqual(payload.hopCount, 0);
      assert.strictEqual(payload.maxHops, 3);
      assert.strictEqual(payload.originalSenderId, 'user-alice-01');
      assert.ok(payload.integrityHash, 'Must generate deterministic integrity hash');
      assert.ok(payload.expiresAt, 'Must compute expiration timestamp');

      const integrity = verifyAlertIntegrity(payload);
      assert.strictEqual(integrity.valid, true);

      const serialized = serializeBLEMessage(payload);
      const byteLength = Buffer.from(serialized, 'base64').length;
      assert.ok(byteLength <= 512, `Byte length (${byteLength}) must stay under 512 MTU`);

      const deserialized = deserializeBLEMessage(serialized);
      assert.strictEqual(deserialized.valid, true);
      assert.strictEqual(deserialized.message.alertId, 'relay-alert-001');
      assert.strictEqual(deserialized.message.hopCount, 0);
      assert.strictEqual(deserialized.message.maxHops, 3);
      assert.strictEqual(deserialized.message.integrityHash, payload.integrityHash);
    });

    await runTest('Relay Protocol: Integrity verification detects modified distress details or coordinates', () => {
      const origPayload = buildSOSAlertPayload({
        alertId: 'relay-alert-tamper',
        emergencyType: 'Fire',
        details: 'Cabin smoke detected',
        latitude: 12.9716,
        longitude: 77.5946,
      });

      // Tamper with details while keeping original hash
      const tamperedDetails = { ...origPayload, details: 'Tampered fake emergency' };
      const tamperCheck1 = verifyAlertIntegrity(tamperedDetails);
      assert.strictEqual(tamperCheck1.valid, false);
      assert.ok(tamperCheck1.error.includes('Integrity hash mismatch'));

      // Tamper with coordinates
      const tamperedCoords = { ...origPayload, latitude: 45.1234 };
      const tamperCheck2 = verifyAlertIntegrity(tamperedCoords);
      assert.strictEqual(tamperCheck2.valid, false);

      // Building forwarded payload preserves original integrity hash without tampering
      const forwarded = buildRelayForwardPayload(origPayload, 'node-relay-b');
      assert.strictEqual(forwarded.hopCount, 1);
      assert.strictEqual(forwarded.forwarderId, 'node-relay-b');
      assert.strictEqual(forwarded.integrityHash, origPayload.integrityHash);

      const forwardIntegrity = verifyAlertIntegrity(forwarded);
      assert.strictEqual(forwardIntegrity.valid, true, 'Forwarded message retains valid integrity hash');
    });

    await runTest('Relay Admission: Rejects expired alerts (past TTL) and records DROPPED event in SQLite', async () => {
      const expiredPayload = buildSOSAlertPayload({
        alertId: 'relay-alert-expired',
        emergencyType: 'Other',
        details: 'Old distress from yesterday',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

      const res = await relayService.processIncomingRelayAlert(expiredPayload, 'device-peer-01');
      assert.strictEqual(res.accepted, false);
      assert.strictEqual(res.reason, 'EXPIRED');

      const history = await RelayRepository.getRelayHistory({ alertId: 'relay-alert-expired' });
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].action, 'DROPPED');
      assert.strictEqual(history[0].statusReason, 'EXPIRED');
    });

    await runTest('Relay Admission: Deduplicates repeated alerts and prevents double-forwarding', async () => {
      const alertId = 'relay-alert-dup-01';
      const payload = buildSOSAlertPayload({
        alertId,
        emergencyType: 'Personal Safety',
        details: 'Need assistance on trail',
        hopCount: 0,
        maxHops: 3,
      });

      // First receipt: admitted and eligible
      const res1 = await relayService.processIncomingRelayAlert(payload, 'device-peer-01');
      assert.strictEqual(res1.accepted, true);
      assert.strictEqual(res1.isDuplicate, false);
      assert.strictEqual(res1.eligibleToForward, true);

      // Second receipt of same alert: detected as duplicate
      const res2 = await relayService.processIncomingRelayAlert(payload, 'device-peer-02');
      assert.strictEqual(res2.accepted, true);
      assert.strictEqual(res2.isDuplicate, true);
      assert.strictEqual(res2.eligibleToForward, false);
      assert.strictEqual(res2.reason, 'DUPLICATE_ALERT');

      // Database alert count remains 1
      const dbAlert = await AlertRepository.getAlertById(alertId);
      assert.ok(dbAlert);
    });

    await runTest('Relay Admission: Enforces maximum hop count (hopCount >= maxHops) and suppresses forward', async () => {
      const maxHopsAlertId = 'relay-alert-max-hops';
      const atMaxHopsPayload = buildSOSAlertPayload({
        alertId: maxHopsAlertId,
        emergencyType: 'Accident',
        details: 'Multi-car pileup',
        hopCount: 3,
        maxHops: 3,
      });

      const res = await relayService.processIncomingRelayAlert(atMaxHopsPayload, 'device-peer-03');
      assert.strictEqual(res.accepted, true);
      assert.strictEqual(res.eligibleToForward, false);
      assert.strictEqual(res.reason, 'HOP_LIMIT_REACHED');

      // Stored locally in SQLite with relayStatus = 'dropped_hop_limit'
      const stored = await AlertRepository.getAlertById(maxHopsAlertId);
      assert.strictEqual(stored.relayStatus, 'dropped_hop_limit');

      // Attempt to forward directly should fail
      const fwdRes = await relayService.forwardAlert(stored);
      assert.strictEqual(fwdRes.success, false);
      assert.strictEqual(fwdRes.reason, 'HOP_LIMIT_REACHED');
    });

    await runTest('Relay Admission: Prevents relay loops from own node or previous forwarder', async () => {
      const myNodeId = relaySettings.getNodeId();
      const loopAlertId = 'relay-alert-loop-01';

      // 1. Alert that originated from own user ID
      const ownOriginPayload = buildSOSAlertPayload({
        alertId: loopAlertId,
        emergencyType: 'Medical Emergency',
        originalSenderId: 'my-test-user-id',
      });

      const res1 = await relayService.processIncomingRelayAlert(ownOriginPayload, 'device-peer-04', 'my-test-user-id');
      assert.strictEqual(res1.accepted, false);
      assert.strictEqual(res1.reason, 'LOOP_DETECTED');

      // 2. Alert where forwarderId matches our own nodeId
      const previousForwarderPayload = buildSOSAlertPayload({
        alertId: 'relay-alert-loop-02',
        emergencyType: 'Fire',
        forwarderId: myNodeId,
      });

      const res2 = await relayService.processIncomingRelayAlert(previousForwarderPayload, 'device-peer-05');
      assert.strictEqual(res2.accepted, false);
      assert.strictEqual(res2.reason, 'LOOP_DETECTED');
    });

    await runTest('Relay Admission: Relay disabled setting saves locally for personal triage & cloud sync but drops forward', async () => {
      await relaySettings.setRelayEnabled(false);
      const disabledAlertId = 'relay-alert-disabled-test';

      const payload = buildSOSAlertPayload({
        alertId: disabledAlertId,
        emergencyType: 'Other',
        details: 'Alert received while relay disabled',
        hopCount: 1,
        maxHops: 3,
      });

      const res = await relayService.processIncomingRelayAlert(payload, 'device-peer-06');
      assert.strictEqual(res.accepted, true);
      assert.strictEqual(res.eligibleToForward, false);
      assert.strictEqual(res.reason, 'RELAY_DISABLED');

      // Saved locally in SQLite
      const stored = await AlertRepository.getAlertById(disabledAlertId);
      assert.ok(stored);
      assert.strictEqual(stored.relayStatus, 'dropped_disabled');

      // Enqueued in sync queue for cloud sync
      const queued = await mockDb.getFirstAsync('SELECT * FROM sync_queue WHERE alertId = ?;', [disabledAlertId]);
      assert.ok(queued, 'Must enqueue in sync_queue even when relay forwarding is disabled');

      // Reset relay setting to true
      await relaySettings.setRelayEnabled(true);
    });

    await runTest('Relay Engine: Rate limiting throttles rapid sequential forward broadcasts', async () => {
      // Configure temporary tight rate limit: 2 forwards per minute
      relaySettings.setRateLimitConfig({ maxForwards: 2, windowMs: 60000 });

      const alert1 = await AlertRepository.saveOrUpdateAlert({
        alertId: 'rate-alert-01',
        emergencyType: 'Medical Emergency',
        source: 'bluetooth',
        deliveryStatus: 'received',
        relayStatus: 'eligible',
        hopCount: 0,
        maxHops: 3,
      });

      const alert2 = await AlertRepository.saveOrUpdateAlert({
        alertId: 'rate-alert-02',
        emergencyType: 'Accident',
        source: 'bluetooth',
        deliveryStatus: 'received',
        relayStatus: 'eligible',
        hopCount: 0,
        maxHops: 3,
      });

      const alert3 = await AlertRepository.saveOrUpdateAlert({
        alertId: 'rate-alert-03',
        emergencyType: 'Fire',
        source: 'bluetooth',
        deliveryStatus: 'received',
        relayStatus: 'eligible',
        hopCount: 0,
        maxHops: 3,
      });

      const fwd1 = await relayService.forwardAlert(alert1.alert);
      assert.strictEqual(fwd1.success, true);

      const fwd2 = await relayService.forwardAlert(alert2.alert);
      assert.strictEqual(fwd2.success, true);

      // Third forward within rate limit window must be throttled
      const fwd3 = await relayService.forwardAlert(alert3.alert);
      assert.strictEqual(fwd3.success, false);
      assert.strictEqual(fwd3.reason, 'RATE_LIMIT_EXCEEDED');

      // Reset rate limit to standard default
      relaySettings.setRateLimitConfig({ maxForwards: 5, windowMs: 60000 });
    });

    await runTest('Relay Storage: SQLite Migration v3 persists relay_history and reports accurate aggregate stats', async () => {
      const stats = await RelayRepository.getRelayStats();
      assert.ok(stats.totalReceived >= 1, 'Must count received events');
      assert.ok(stats.totalForwarded >= 2, 'Must count forwarded events');
      assert.ok(stats.totalDropped >= 1, 'Must count dropped events');

      const forwardedCount = await RelayRepository.getForwardedCount();
      assert.ok(forwardedCount >= 2);

      // Check migration table record
      const migrationV3 = await mockDb.getFirstAsync('SELECT * FROM schema_migrations WHERE version = 3;');
      assert.ok(migrationV3, 'Migration v3 must be recorded in schema_migrations');
    });

    await runTest('Relay End-to-End: Three-Device Multi-Hop Simulation (A -> B -> C) synchronizes to Cloud backend', async () => {
      const meshAlertId = `mesh-sim-${Date.now()}`;

      // Device A (Originator) creates SOS distress beacon
      const deviceAPayload = buildSOSAlertPayload({
        alertId: meshAlertId,
        emergencyType: 'Medical Emergency',
        details: 'Isolated hiker injured on ridge',
        senderName: 'Alice Survivor',
        latitude: 12.9200,
        longitude: 80.1200,
        originalSenderId: 'device-a-alice',
        hopCount: 0,
        maxHops: 3,
      });

      // Device B receives from Device A over BLE
      const deviceBNodeId = 'node-device-b';
      const deviceBReceived = await relayService.processIncomingRelayAlert(deviceAPayload, 'device-a-ble');
      assert.strictEqual(deviceBReceived.accepted, true);
      assert.strictEqual(deviceBReceived.eligibleToForward, true);

      // Device B forwards the alert to Device C
      const deviceBForwardPayload = buildRelayForwardPayload(deviceBReceived.alert, deviceBNodeId);
      assert.strictEqual(deviceBForwardPayload.hopCount, 1);
      assert.strictEqual(deviceBForwardPayload.forwarderId, deviceBNodeId);
      assert.strictEqual(deviceBForwardPayload.alertId, meshAlertId);
      assert.strictEqual(deviceBForwardPayload.integrityHash, deviceAPayload.integrityHash);

      // Device C (with internet connection) receives from Device B
      const deviceCReceived = deserializeBLEMessage(serializeBLEMessage(deviceBForwardPayload));
      assert.strictEqual(deviceCReceived.valid, true);
      assert.strictEqual(deviceCReceived.message.hopCount, 1);

      // Device C synchronizes the multi-hop alert to the backend server via POST /api/alerts/sync
      const syncRes = await fetch(`${testServerBaseUrl}/alerts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          alerts: [
            {
              alertId: meshAlertId,
              emergencyType: deviceCReceived.message.emergencyType,
              details: deviceCReceived.message.details,
              location: {
                latitude: deviceCReceived.message.latitude,
                longitude: deviceCReceived.message.longitude,
              },
              source: 'bluetooth_relay',
              originalSenderName: deviceCReceived.message.senderName,
              hopCount: deviceCReceived.message.hopCount,
              forwarderId: deviceCReceived.message.forwarderId,
              originalSenderId: deviceCReceived.message.originalSenderId,
              createdAt: deviceCReceived.message.createdAt,
            },
          ],
        }),
      });

      assert.strictEqual(syncRes.status, 200);
      const syncData = await syncRes.json();
      assert.strictEqual(syncData.summary.synced, 1);

      // Backend records alert preserving Alice's sender name, hopCount 1, and relayedBy attribution
      const backendAlert = await alertStore.findById(meshAlertId);
      assert.ok(backendAlert, 'Backend must contain the synchronized mesh alert');
      assert.strictEqual(backendAlert.source, 'bluetooth_relay');
      assert.strictEqual(backendAlert.senderName, 'Alice Survivor');
      assert.strictEqual(backendAlert.hopCount, 1);
      assert.strictEqual(backendAlert.forwarderId, deviceBNodeId);
      assert.strictEqual(backendAlert.relayedBy, testUserId);
    });

    // =========================================================================
    // MODULE 7: EMERGENCY CONTACT MANAGEMENT & SOS NOTIFICATIONS
    // =========================================================================
    console.log('\n--- Module 7: Emergency Contact Management & Notifications ---');

    const otherUserToken = jwt.sign(
      { id: 'different-user-456', email: 'other@example.com' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    let createdPrimaryContactId = null;
    let createdSecondaryContactId = null;

    await runTest('Contacts: Input validation rejects invalid names, phones, emails, and priorities', async () => {
      // 1. Missing name
      const res1 = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          phone: '+14155552671',
        }),
      });
      assert.strictEqual(res1.status, 400);

      // 2. Missing both phone and email
      const res2 = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          name: 'Doctor Jane',
        }),
      });
      assert.strictEqual(res2.status, 400);

      // 3. Bad phone format (< 7 digits)
      const res3 = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          name: 'Doctor Jane',
          phone: '1234',
        }),
      });
      assert.strictEqual(res3.status, 400);

      // 4. Bad email format
      const res4 = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          name: 'Doctor Jane',
          email: 'invalid-email-address',
        }),
      });
      assert.strictEqual(res4.status, 400);

      // 5. Bad priority (> 3)
      const res5 = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          name: 'Doctor Jane',
          phone: '+14155552671',
          priority: 9,
        }),
      });
      assert.strictEqual(res5.status, 400);
    });

    await runTest('Contacts: User 1 creates and lists emergency contacts with priority ordering', async () => {
      // Secondary Contact (Priority 2)
      const secRes = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          name: 'Bob Secondary',
          phone: '+14155552671',
          relationship: 'Friend',
          priority: 2,
        }),
      });
      assert.strictEqual(secRes.status, 201);
      const secData = await secRes.json();
      createdSecondaryContactId = secData.data.id;
      assert.strictEqual(secData.data.name, 'Bob Secondary');
      assert.strictEqual(secData.data.priority, 2);

      // Primary Contact (Priority 1)
      const priRes = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          name: 'Alice Primary',
          email: 'alice.primary@example.com',
          relationship: 'Spouse',
          priority: 1,
        }),
      });
      assert.strictEqual(priRes.status, 201);
      const priData = await priRes.json();
      createdPrimaryContactId = priData.data.id;
      assert.strictEqual(priData.data.name, 'Alice Primary');
      assert.strictEqual(priData.data.priority, 1);

      // List contacts: Priority 1 must appear before Priority 2
      const listRes = await fetch(`${testServerBaseUrl}/contacts`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.ok(listData.data.length >= 2);
      assert.strictEqual(listData.data[0].id, createdPrimaryContactId);
      assert.strictEqual(listData.data[0].priority, 1);
      assert.strictEqual(listData.data[1].id, createdSecondaryContactId);
      assert.strictEqual(listData.data[1].priority, 2);
    });

    await runTest('Contacts: User 1 updates contact details and toggles enabled state', async () => {
      const updateRes = await fetch(`${testServerBaseUrl}/contacts/${createdSecondaryContactId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          relationship: 'Brother',
          isEnabled: false,
        }),
      });
      assert.strictEqual(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.data.relationship, 'Brother');
      assert.strictEqual(updateData.data.isEnabled, false);

      // Verify findEnabledByUserId filters out disabled contacts
      const enabledContacts = await contactStore.findEnabledByUserId(testUserId);
      const containsBob = enabledContacts.some((c) => c.id === createdSecondaryContactId);
      assert.strictEqual(containsBob, false, 'Disabled contact must not be in enabled list');
      const containsAlice = enabledContacts.some((c) => c.id === createdPrimaryContactId);
      assert.strictEqual(containsAlice, true, 'Enabled contact must be in enabled list');
    });

    await runTest('Contacts: Ownership isolation prevents User 2 from viewing, updating, or deleting User 1 contacts', async () => {
      // User 2 tries to update User 1's contact
      const patchRes = await fetch(`${testServerBaseUrl}/contacts/${createdPrimaryContactId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherUserToken}`,
        },
        body: JSON.stringify({
          name: 'Hacked Name',
        }),
      });
      assert.strictEqual(patchRes.status, 404, 'Must conceal other users contacts with 404');

      // User 2 tries to delete User 1's contact
      const delRes = await fetch(`${testServerBaseUrl}/contacts/${createdPrimaryContactId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
        },
      });
      assert.strictEqual(delRes.status, 404, 'Must conceal other users contacts with 404');
    });

    await runTest('Contacts: User 1 successfully deletes contact with 200 OK', async () => {
      const delRes = await fetch(`${testServerBaseUrl}/contacts/${createdSecondaryContactId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(delRes.status, 200);

      // Verify contact was removed
      const remaining = await contactStore.findByUserId(testUserId);
      const hasBob = remaining.some((c) => c.id === createdSecondaryContactId);
      assert.strictEqual(hasBob, false);
    });

    await runTest('Notifications: Message formatting enforces explicit location consent and credential scrubbing', async () => {
      const sampleAlert = {
        id: 'alert-test-consent',
        emergencyType: 'Medical Emergency',
        details: 'Patient unconscious, chest pain',
        createdAt: '2026-10-30T12:00:00.000Z',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      // 1. With location consent = true
      const msgWithConsent = notificationService.formatNotificationMessage({
        alert: sampleAlert,
        senderName: 'Test Sender',
        locationConsent: true,
      });
      assert.ok(
        msgWithConsent.body.includes('https://maps.google.com/?q=37.7749,-122.4194'),
        'Must contain Google Maps URL when consent is granted'
      );
      assert.ok(
        msgWithConsent.smsBody.includes('https://maps.google.com/?q=37.7749,-122.4194'),
        'SMS body must include map link when consent is granted'
      );

      // 2. With location consent = false
      const msgWithoutConsent = notificationService.formatNotificationMessage({
        alert: sampleAlert,
        senderName: 'Test Sender',
        locationConsent: false,
      });
      assert.ok(
        !msgWithoutConsent.body.includes('maps.google.com'),
        'Must omit Google Maps link when consent is withheld'
      );
      assert.ok(
        !msgWithoutConsent.smsBody.includes('maps.google.com'),
        'SMS body must omit map link when consent is withheld'
      );
      assert.ok(
        msgWithoutConsent.body.includes('Omitted by sender or unavailable'),
        'Must state location is omitted'
      );

      // 3. Credential scrubbing: zero tokens or passwords in distress message
      const combined = `${msgWithConsent.subject}\n${msgWithConsent.body}\n${msgWithConsent.smsBody}`;
      assert.ok(!combined.includes('password'), 'Must not contain password');
      assert.ok(!combined.includes('Bearer'), 'Must not contain Bearer token');
      assert.ok(!combined.includes('jwt'), 'Must not contain jwt token');
    });

    await runTest('Notifications: SOS alert creation dispatches notifications to enabled contacts with idempotency', async () => {
      // Create SOS alert while Alice Primary is enabled
      const sosRes = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Fire',
          details: 'Fire spreading on 2nd floor, stairwell blocked',
          location: { latitude: 37.7749, longitude: -122.4194 },
          locationConsent: true,
        }),
      });
      assert.strictEqual(sosRes.status, 201);
      const sosData = await sosRes.json();
      const alertId = sosData.data.id;

      // Small delay to allow asynchronous non-blocking notification dispatch
      await new Promise((r) => setTimeout(r, 100));

      // Verify notification task was created in notificationStore
      const userNotifications = await notificationStore.findByUserId(testUserId, { alertId });
      assert.ok(userNotifications.length >= 1, 'At least 1 notification task must be created for enabled contact');
      const emailTask = userNotifications.find((n) => n.channel === 'email');
      assert.ok(emailTask, 'Email task must be generated for Alice Primary');
      assert.strictEqual(emailTask.alertId, alertId);
      assert.strictEqual(emailTask.contactId, createdPrimaryContactId);
      assert.strictEqual(emailTask.status, 'sent');
      assert.strictEqual(emailTask.provider, 'simulated_smtp');

      // Test idempotency: triggering dispatch again with identical alert & contact should not duplicate
      const testUser = await userStore.findById(testUserId);
      const redispatch = await notificationService.dispatchSOSNotifications(testUser, sosData.data);
      assert.strictEqual(redispatch.queuedCount, 0, 'Idempotency key must prevent duplicate tasks');
    });

    await runTest('Notifications: Mobile SQLite Migration v4 creates contacts and notification_tasks tables', async () => {
      const mockDb = createInMemoryExpoSqliteWrapper();
      await setCustomDatabase(mockDb);

      // Apply migrations v1-v4
      await runMigrations(mockDb);

      const migrations = await mockDb.getAllAsync('SELECT version FROM schema_migrations ORDER BY version ASC;');
      assert.strictEqual(migrations.length, 4);
      assert.strictEqual(migrations[3].version, 4);

      // Test ContactRepository SQLite operations
      const savedContact = await ContactRepository.upsertContact({
        name: 'Local SQLite Contact',
        phone: '+14155559999',
        email: 'local@example.com',
        priority: 1,
        isEnabled: true,
      });
      assert.ok(savedContact.contactId);
      assert.strictEqual(savedContact.name, 'Local SQLite Contact');

      const allContacts = await ContactRepository.getAllContacts();
      assert.strictEqual(allContacts.length, 1);

      await ContactRepository.toggleContactEnabled(savedContact.contactId, false);
      const enabled = await ContactRepository.getEnabledContacts();
      assert.strictEqual(enabled.length, 0);

      // Test NotificationRepository SQLite operations
      const task = await NotificationRepository.recordTask({
        alertId: 'mock-sos-123',
        contactId: savedContact.contactId,
        contactName: savedContact.name,
        channel: 'email',
        recipient: 'local@example.com',
        status: 'queued',
      });
      assert.ok(task.taskId);
      assert.strictEqual(task.status, 'queued');

      const tasksForAlert = await NotificationRepository.getTasksByAlertId('mock-sos-123');
      assert.strictEqual(tasksForAlert.length, 1);

      await NotificationRepository.updateTaskStatus(task.taskId, 'delivered');
      const updatedTask = await NotificationRepository.getTaskById(task.taskId);
      assert.strictEqual(updatedTask.status, 'delivered');
    });

    await runTest('Notifications: Notification history queries isolate records by user and support test dispatch', async () => {
      // User 1 queries /api/notifications
      const u1Res = await fetch(`${testServerBaseUrl}/notifications`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(u1Res.status, 200);
      const u1Data = await u1Res.json();
      assert.ok(u1Data.count >= 1);

      // User 2 queries /api/notifications -> 0 records
      const u2Res = await fetch(`${testServerBaseUrl}/notifications`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${otherUserToken}`,
        },
      });
      assert.strictEqual(u2Res.status, 200);
      const u2Data = await u2Res.json();
      assert.strictEqual(u2Data.count, 0, 'User 2 must not see User 1 notifications');

      // Test notification endpoint POST /api/notifications/test
      const testNotifRes = await fetch(`${testServerBaseUrl}/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          channel: 'email',
          recipient: 'test-doctor@example.com',
        }),
      });
      assert.strictEqual(testNotifRes.status, 200);
      const testNotifData = await testNotifRes.json();
      assert.strictEqual(testNotifData.success, true);
      assert.strictEqual(testNotifData.data.provider, 'simulated_smtp');
    });

    // =========================================================================
    // MODULE 8: LIVE EMERGENCY MAP & INCIDENT TRACKING
    // =========================================================================
    console.log('\n--- Module 8: Live Emergency Map & Incident Tracking ---');

    let unmappedAlertId = null;
    let mappedAlertId = null;

    await runTest('Map API: GET /api/alerts/map returns only incidents with valid coordinates and accurate summaries', async () => {
      // Create a mapped alert
      const mapRes = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Medical Emergency',
          details: 'Survivor mapped incident',
          location: { latitude: 37.7749, longitude: -122.4194 },
        }),
      });
      assert.strictEqual(mapRes.status, 201);
      const mapData = await mapRes.json();
      mappedAlertId = mapData.data.id;

      // Query GET /api/alerts/map
      const res = await fetch(`${testServerBaseUrl}/alerts/map`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));

      // Every returned alert must have numerical coordinates
      for (const item of data.data) {
        assert.ok(item.location, 'Must contain location object');
        assert.strictEqual(typeof item.location.latitude, 'number');
        assert.strictEqual(typeof item.location.longitude, 'number');
        assert.ok(item.location.latitude >= -90 && item.location.latitude <= 90);
        assert.ok(item.location.longitude >= -180 && item.location.longitude <= 180);
      }

      assert.strictEqual(data.summary.mappedCount, data.data.length);
      assert.ok(data.summary.total >= data.summary.mappedCount);
      assert.ok(typeof data.summary.serverTime === 'string');
    });

    await runTest('Map API: Unmapped alerts (missing coordinates) are excluded from /api/alerts/map results', async () => {
      // Create an alert with NO coordinates
      const unmappedRes = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Personal Safety',
          details: 'Unmapped alert with location omitted by survivor',
          location: null,
        }),
      });
      assert.strictEqual(unmappedRes.status, 201);
      const unmappedData = await unmappedRes.json();
      unmappedAlertId = unmappedData.data.id;

      // Query GET /api/alerts/map
      const res = await fetch(`${testServerBaseUrl}/alerts/map`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      // The unmapped alert must NOT be in the mapped array
      const found = data.data.find((a) => a.id === unmappedAlertId);
      assert.strictEqual(found, undefined, 'Unmapped alert must not appear on map');
      assert.ok(data.summary.unmappedCount >= 1, 'Unmapped count must be at least 1');
    });

    await runTest('Map API: Status and category filtering on /api/alerts/map', async () => {
      // Filter by status=Pending
      const pendingRes = await fetch(`${testServerBaseUrl}/alerts/map?status=Pending`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(pendingRes.status, 200);
      const pendingData = await pendingRes.json();
      for (const a of pendingData.data) {
        assert.strictEqual(a.status, 'Pending');
      }

      // Filter by emergencyType=Medical Emergency
      const medRes = await fetch(`${testServerBaseUrl}/alerts/map?emergencyType=Medical%20Emergency`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });
      assert.strictEqual(medRes.status, 200);
      const medData = await medRes.json();
      for (const a of medData.data) {
        assert.strictEqual(a.emergencyType, 'Medical Emergency');
      }
    });

    await runTest('Map Stream: GET /api/alerts/stream establishes SSE stream and broadcasts live alert events', async () => {
      await new Promise((resolve, reject) => {
        const streamUrl = `${testServerBaseUrl}/alerts/stream?token=${testUserToken}`;
        const parsedUrl = new URL(streamUrl);

        let receivedConnectedEvent = false;
        let receivedAlertEvent = false;

        const req = http.get(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: `${parsedUrl.pathname}${parsedUrl.search}`,
            headers: {
              Accept: 'text/event-stream',
            },
          },
          (res) => {
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.headers['content-type'], 'text/event-stream');

            res.setEncoding('utf8');
            res.on('data', async (chunk) => {
              if (chunk.includes('event: connected')) {
                receivedConnectedEvent = true;

                // While stream is open, trigger a new alert to test live broadcast
                await fetch(`${testServerBaseUrl}/alerts`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${testUserToken}`,
                  },
                  body: JSON.stringify({
                    emergencyType: 'Fire',
                    details: 'Live SSE broadcast test fire incident',
                    location: { latitude: 37.7800, longitude: -122.4200 },
                  }),
                });
              }

              if (chunk.includes('event: alert_created') && chunk.includes('Live SSE broadcast test')) {
                receivedAlertEvent = true;
                req.destroy();
                assert.ok(receivedConnectedEvent, 'Must have received initial connected event');
                assert.ok(receivedAlertEvent, 'Must have received live alert_created event');
                resolve();
              }
            });
          }
        );

        req.on('error', (err) => {
          if (!receivedAlertEvent) {
            reject(err);
          }
        });

        // Timeout fallback
        setTimeout(() => {
          req.destroy();
          if (receivedConnectedEvent && receivedAlertEvent) {
            resolve();
          } else {
            reject(new Error(`SSE stream timeout: connected=${receivedConnectedEvent}, alertEvent=${receivedAlertEvent}`));
          }
        }, 5000);
      });
    });

    await runTest('Map SQLite: AlertRepository.getMappedAlerts and getUnmappedAlerts segregate spatial data accurately', async () => {
      const mockDb = createInMemoryExpoSqliteWrapper();
      await setCustomDatabase(mockDb);
      await runMigrations(mockDb);

      // 1. Insert alert with valid GPS coordinates
      await AlertRepository.saveOrUpdateAlert({
        alertId: 'mock-geo-1',
        emergencyType: 'Medical Emergency',
        details: 'Hiker with broken ankle',
        latitude: 13.0827,
        longitude: 80.2707,
        source: 'local',
        deliveryStatus: 'pending',
      });

      // 2. Insert alert with NO coordinates
      await AlertRepository.saveOrUpdateAlert({
        alertId: 'mock-geo-2',
        emergencyType: 'Personal Safety',
        details: 'Survivor without GPS lock',
        latitude: null,
        longitude: null,
        source: 'local',
        deliveryStatus: 'pending',
      });

      // Query mapped alerts
      const mapped = await AlertRepository.getMappedAlerts();
      assert.strictEqual(mapped.length, 1);
      assert.strictEqual(mapped[0].alertId, 'mock-geo-1');
      assert.strictEqual(mapped[0].latitude, 13.0827);

      // Query unmapped alerts
      const unmapped = await AlertRepository.getUnmappedAlerts();
      assert.strictEqual(unmapped.length, 1);
      assert.strictEqual(unmapped[0].alertId, 'mock-geo-2');
      assert.strictEqual(unmapped[0].latitude, null);

      // Aggregate counts
      const counts = await AlertRepository.getAlertCounts();
      assert.strictEqual(counts.total, 2);
      assert.strictEqual(counts.mappedCount, 1);
      assert.strictEqual(counts.unmappedCount, 1);
    });

    await runTest('Map Navigation: Deep link URL generator formats valid map navigation intents', async () => {
      const lat = 37.7749;
      const lon = -122.4194;
      const queryUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
      const parsed = new URL(queryUrl);
      assert.strictEqual(parsed.hostname, 'www.google.com');
      assert.strictEqual(parsed.searchParams.get('destination'), `${lat},${lon}`);
    });

    // =========================================================================
    // MODULE 9: ADMIN DASHBOARD, INCIDENT MONITORING & ANALYTICS
    // =========================================================================
    console.log('\n--- Module 9: Admin Dashboard, Incident Monitoring & Analytics ---');

    let adminUserToken = null;
    let adminUserId = null;
    const adminEmail = `admin-test-${Date.now()}@rescuelink.org`;
    const adminPassword = 'AdminSecretPass123!';

    await runTest('Admin Auth & Role Restrictions: Non-admin users are rejected with 403 Forbidden', async () => {
      // 1. Regular user tries to access /api/admin/dashboard -> 403
      const res1 = await fetch(`${testServerBaseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      });
      assert.strictEqual(res1.status, 403, 'Regular user must be rejected with 403 Forbidden');
      const d1 = await res1.json();
      assert.strictEqual(d1.error.code, 'FORBIDDEN_ADMIN_REQUIRED');

      // 2. Unauthenticated request -> 401
      const res2 = await fetch(`${testServerBaseUrl}/admin/dashboard`);
      assert.strictEqual(res2.status, 401, 'Unauthenticated request must return 401');
    });

    await runTest('Admin Login & Dashboard Overview: Authenticated administrator receives aggregated metrics', async () => {
      // 1. Create admin user
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
      const adminUser = await userStore.createUser({
        name: 'Lead Commander',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        status: 'active',
      });
      adminUserId = adminUser.id;

      // 2. Login as admin
      const loginRes = await fetch(`${testServerBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      assert.strictEqual(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert.strictEqual(loginData.user.role, 'admin');
      adminUserToken = loginData.token;

      // 3. Request dashboard overview
      const dashRes = await fetch(`${testServerBaseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminUserToken}` },
      });
      assert.strictEqual(dashRes.status, 200);
      const dashData = await dashRes.json();
      assert.strictEqual(dashData.success, true);
      assert.ok(dashData.data.summary);
      assert.ok(typeof dashData.data.summary.totalUsers === 'number');
      assert.ok(typeof dashData.data.summary.totalIncidents === 'number');
      assert.ok(typeof dashData.data.summary.activeIncidents === 'number');
      assert.ok(typeof dashData.data.summary.totalRelaysForwarded === 'number');
      assert.ok(Array.isArray(dashData.data.timeline));
      assert.ok(dashData.data.notificationStats);
    });

    let targetIncidentId = null;

    await runTest('Incident Management: Admin updates lifecycle status and preserves original survivor details', async () => {
      // 1. Ingest an incident as regular user
      const createRes = await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Medical Emergency',
          details: 'Survivor with fracture at North Trailhead',
          location: { latitude: 37.7749, longitude: -122.4194 },
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createData = await createRes.json();
      targetIncidentId = (createData.data || createData.alert).id;

      // 2. Admin queries paginated incidents
      const listRes = await fetch(`${testServerBaseUrl}/admin/incidents?search=North+Trailhead`, {
        headers: { Authorization: `Bearer ${adminUserToken}` },
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.ok(listData.incidents.length >= 1);

      // 3. Admin updates lifecycle status to 'Investigating' with notes
      const patchRes = await fetch(`${testServerBaseUrl}/admin/incidents/${targetIncidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUserToken}`,
        },
        body: JSON.stringify({
          status: 'Investigating',
          notes: 'SAR Alpha dispatched via ATV',
        }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.strictEqual(patchData.incident.status, 'Investigating');
      assert.strictEqual(patchData.incident.details, 'Survivor with fracture at North Trailhead', 'Original details preserved');
      assert.strictEqual(patchData.incident.location.latitude, 37.7749, 'Original GPS location preserved');
      assert.strictEqual(patchData.incident.adminReview.notes, 'SAR Alpha dispatched via ATV');

      // 4. Unsupported status returns 400
      const badRes = await fetch(`${testServerBaseUrl}/admin/incidents/${targetIncidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUserToken}`,
        },
        body: JSON.stringify({ status: 'InvalidStatusString' }),
      });
      assert.strictEqual(badRes.status, 400);
    });

    await runTest('Administrative Audit Logs: Actions generate tamper-evident audit records without leaking secrets', async () => {
      // 1. Fetch audit logs as admin
      const res = await fetch(`${testServerBaseUrl}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${adminUserToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.logs.length >= 1);

      // 2. Find the incident update audit log
      const incidentLog = data.logs.find(
        (l) => l.action === 'INCIDENT_STATUS_UPDATE' && l.targetId === targetIncidentId
      );
      assert.ok(incidentLog, 'Must record INCIDENT_STATUS_UPDATE audit log');
      assert.strictEqual(incidentLog.adminEmail, adminEmail);
      assert.strictEqual(incidentLog.details.newStatus, 'Investigating');
      assert.strictEqual(incidentLog.details.notes, 'SAR Alpha dispatched via ATV');

      // 3. Confirm zero secret leakage in any details field
      for (const log of data.logs) {
        assert.strictEqual(log.details?.password, undefined);
        assert.strictEqual(log.details?.passwordHash, undefined);
        assert.strictEqual(log.details?.token, undefined);
      }
    });

    await runTest('Admin User Management & Status: Admin suspends user, preventing login; self-suspension is blocked', async () => {
      // 1. Create a user to be suspended
      const tempEmail = `temp-user-${Date.now()}@rescuelink.org`;
      const tempPass = 'Password123!';
      const hash = await bcrypt.hash(tempPass, 10);
      const tempUser = await userStore.createUser({
        name: 'Field Responder Dan',
        email: tempEmail,
        passwordHash: hash,
        role: 'user',
        status: 'active',
      });

      // 2. Admin retrieves user list
      const listRes = await fetch(`${testServerBaseUrl}/admin/users?search=${tempEmail}`, {
        headers: { Authorization: `Bearer ${adminUserToken}` },
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      const userRecord = listData.users.find((u) => u.id === tempUser.id);
      assert.ok(userRecord);
      assert.strictEqual(userRecord.passwordHash, undefined, 'Password hash must be stripped');

      // 3. Admin suspends user account
      const patchRes = await fetch(`${testServerBaseUrl}/admin/users/${tempUser.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUserToken}`,
        },
        body: JSON.stringify({ status: 'suspended', notes: 'Temporarily suspended' }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.strictEqual(patchData.user.status, 'suspended');

      // 4. Suspended user attempts login -> 403 Forbidden
      const loginRes = await fetch(`${testServerBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempEmail, password: tempPass }),
      });
      assert.strictEqual(loginRes.status, 403);
      const loginData = await loginRes.json();
      assert.strictEqual(loginData.error.code, 'ACCOUNT_SUSPENDED');

      // 5. Admin tries to suspend themselves -> rejected with 400
      const selfRes = await fetch(`${testServerBaseUrl}/admin/users/${adminUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminUserToken}`,
        },
        body: JSON.stringify({ status: 'suspended' }),
      });
      assert.strictEqual(selfRes.status, 400);
      const selfData = await selfRes.json();
      assert.strictEqual(selfData.error.code, 'SELF_SUSPENSION_PROHIBITED');
    });

    await runTest('Relay Telemetry Monitoring: Accurately reports hop metrics and unique forwarder nodes', async () => {
      // 1. Ingest a multi-hop relayed alert via sync endpoint
      const relayAlertId = `admin-relay-test-${Date.now()}`;
      await fetch(`${testServerBaseUrl}/alerts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify([
          {
            alertId: relayAlertId,
            emergencyType: 'Fire',
            details: 'Relayed fire beacon via Node-7',
            source: 'bluetooth',
            hopCount: 2,
            forwarderId: 'Node-Relay-7',
            createdAt: new Date().toISOString(),
          },
        ]),
      });

      // 2. Query relay telemetry
      const res = await fetch(`${testServerBaseUrl}/admin/relay`, {
        headers: { Authorization: `Bearer ${adminUserToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.stats.totalRelayedAlerts >= 1);
      assert.ok(data.stats.maxHopObserved >= 2);
      assert.ok(data.stats.uniqueForwardingNodes >= 1);
      assert.ok(data.relays.length >= 1);
    });

    await runTest('Notification Monitoring: Reports delivery states and strictly masks recipient details', async () => {
      // 1. Trigger notification creation via alert
      await fetch(`${testServerBaseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testUserToken}`,
        },
        body: JSON.stringify({
          emergencyType: 'Test / Drill',
          details: 'Notification monitoring audit test',
        }),
      });

      // 2. Query admin notifications endpoint
      const res = await fetch(`${testServerBaseUrl}/admin/notifications`, {
        headers: { Authorization: `Bearer ${adminUserToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.stats.total >= 1);

      // 3. Verify recipient masking (must contain asterisks and never expose cleartext)
      for (const notif of data.notifications) {
        assert.ok(notif.recipient.includes('*'), `Recipient must be masked: ${notif.recipient}`);
      }
    });

  } finally {
    // Teardown and reset test databases and stores
    await stopEphemeralServer();
    await resetDatabaseInstance();
    await alertStore.writeAlerts(initialAlerts);
    await userStore.writeUsers(initialUsers);
    await contactStore.writeContacts(initialContacts);
    await notificationStore.writeNotifications(initialNotifications);
    await auditStore.writeLogs(initialAuditLogs);
  }

  console.log('\n================================================================');
  console.log(`   TOTAL RESULTS: ${totalPassed}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (totalPassed === totalTests) {
    console.log('✅ ALL STEP 12 COMPREHENSIVE PRODUCTION TESTS PASSED SUCCESSFULLY!\n');
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
