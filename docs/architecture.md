# RescueLink Architecture & Technical Specification

## 1. System Overview

**RescueLink** is an offline-first emergency distress signaling, peer-to-peer relay, and cloud-synchronization system. In disaster scenarios, power grid failures, and remote wilderness areas where cellular and broadband networks fail, RescueLink enables mobile devices to persist emergency beacons in local SQLite storage, broadcast distress signals over custom Bluetooth Low Energy (BLE) GATT profiles, exchange peer acknowledgments, form multi-device mesh forwarding paths, and opportunistically relay distress data to the central cloud once connectivity is restored.

---

## 2. Multi-Device SOS Relay Network Architecture (Step 8)

RescueLink implements a controlled, multi-device epidemic forwarding protocol designed specifically for zero-infrastructure emergency communications. When Device A (the originator) has no cellular coverage, it broadcasts an SOS beacon over Bluetooth Low Energy. Device B discovers and records the beacon, and acting as an intermediate relay hop, forwards it over BLE to Device C. When any device in the relay chain (such as Device C) regains internet access, the distress alert is automatically synchronized with the central cloud backend.

```mermaid
graph TD
    subgraph DeviceA ["Device A: Originator (Offline)"]
        UserA["Survivor / Initiator"] --> ComposerA["Send SOS Screen"]
        ComposerA --> SQLiteA[("SQLite Database<br/>(hopCount = 0, source = 'local')")]
        ComposerA --> AdvA["BLE Broadcaster / GATT Server<br/>(Protocol v2, Integrity Hash)"]
    end

    subgraph Hop1 ["Bluetooth Low Energy Hop 1 (MTU <= 512 Bytes)"]
        AdvA -. "BLE Direct Discovery & Read<br/>(hopCount = 0, alertId = X)" .-> ScannerB["BLE Central Scanner"]
    end

    subgraph DeviceB ["Device B: Intermediate Mesh Relay (Offline)"]
        ScannerB --> RelayEngineB["Relay Admission Engine<br/>• Integrity Check<br/>• TTL / Expiration Check<br/>• Loop Prevention<br/>• Hop Limit Check<br/>• Rate Limiter"]
        RelayEngineB --> SQLiteB[("SQLite Database<br/>(alerts: hopCount = 0, relayStatus = 'eligible')")]
        RelayEngineB --> HistoryB[("Relay History Ledger<br/>(action: 'RECEIVED')")]
        RelayEngineB --> ForwarderB["Forward Alert Engine<br/>• Increment hopCount = 1<br/>• Preserve Original Content & Hash<br/>• Set forwarderId = Node-B"]
        ForwarderB --> AdvB["BLE Broadcaster / GATT Server<br/>(Forwarded Beacon)"]
    end

    subgraph Hop2 ["Bluetooth Low Energy Hop 2 (MTU <= 512 Bytes)"]
        AdvB -. "BLE Forwarded Discovery & Read<br/>(hopCount = 1, forwarderId = Node-B)" .-> ScannerC["BLE Central Scanner"]
    end

    subgraph DeviceC ["Device C: Terminal Relay & Ingestion Gateway (Online)"]
        ScannerC --> RelayEngineC["Relay Admission Engine<br/>(Admitted as Hop 1)"]
        RelayEngineC --> SQLiteC[("SQLite Database<br/>(alerts: hopCount = 1, relayStatus = 'received')")]
        RelayEngineC --> OutboxC["Sync Queue (Outbox)<br/>(Relay Enqueued)"]
        OutboxC --> NetCheckC{"Internet Reachable?<br/>(NetInfo + Health Ping)"}
        NetCheckC -- Online --> CloudSync["Cloud Sync Engine<br/>(POST /api/alerts/sync)"]
    end

    subgraph CentralCloud ["RescueLink Cloud Infrastructure"]
        CloudSync --> ExpressAPI["Express.js REST Gateway"]
        ExpressAPI --> AuthCheck["JWT Authenticated Relay Validation"]
        AuthCheck --> AlertStore[("Central Alert Storage<br/>• Preserves Originator Name & Details<br/>• Records Hop Count & Forwarder ID<br/>• Attributed to Relayed User ID")]
    end
```

---

## 3. Message Protocol Specification (Version 2)

RescueLink uses a compact, versioned JSON message structure Base64-encoded to fit within standard 512-byte BLE characteristic Maximum Transmission Units (MTU).

### 3.1 SOS_ALERT Payload Schema
```json
{
  "version": 2,
  "type": "SOS_ALERT",
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "emergencyType": "Medical Emergency",
  "details": "Compound fracture on ridge trail. Bleeding controlled.",
  "senderName": "Alice Survivor",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "createdAt": "2026-10-30T10:00:00.000Z",
  "expiresAt": "2026-10-31T10:00:00.000Z",
  "originalSenderId": "user-uuid-device-a",
  "forwarderId": "node-7b8c2d",
  "hopCount": 1,
  "maxHops": 3,
  "integrityHash": "4a7f9c2e"
}
```

### 3.2 Protocol Fields Definition
| Field | Type | Description | Mutable by Relay? |
|---|---|---|---|
| `version` | Integer | Protocol specification version (`1` or `2`). | No |
| `type` | String | Fixed message identifier (`SOS_ALERT` or `SOS_ACK`). | No |
| `alertId` | String (UUID) | Immutable unique identifier generated at origin. | No |
| `emergencyType` | String | Category: Medical, Accident, Personal Safety, Fire, Other, Test / Drill. | No |
| `details` | String | Plaintext description bounded to 180 characters. | No |
| `senderName` | String | Survivor display name bounded to 40 characters. | No |
| `latitude` | Number \| null | GPS latitude (4-decimal precision, -90 to 90). | No |
| `longitude` | Number \| null | GPS longitude (4-decimal precision, -180 to 180). | No |
| `createdAt` | String (ISO) | Original alert timestamp at creation. | No |
| `expiresAt` | String (ISO) | Message expiration timestamp (default `createdAt` + 24 hours). | No |
| `originalSenderId`| String \| null | Cryptographic or user identifier of the original author. | No |
| `integrityHash` | String (8 hex) | Deterministic FNV-1a checksum of all immutable fields. | **NEVER** |
| `forwarderId` | String | Anonymous node identifier of the forwarding device (`node-XXXXXX`). | **Yes (Updated by forwarder)** |
| `hopCount` | Integer | Number of network hops completed so far (0 at origin). | **Yes (Incremented by forwarder)** |
| `maxHops` | Integer | Maximum permissible hop limit (default 3, range 1–5). | No |

### 3.3 Cryptographic Content Integrity Validation
To guarantee that forwarders never modify distress coordinates, emergency categories, or details in transit, `computeAlertIntegrityHash` calculates a 32-bit FNV-1a checksum across the normalized immutable fields:
$$\text{Content} = \text{alertId} \parallel \text{emergencyType} \parallel \text{details} \parallel \text{lat} \parallel \text{lon} \parallel \text{createdAt} \parallel \text{originalSenderId}$$

Every intermediate node validates `verifyAlertIntegrity(alert)`. If a forwarding node alters the distress message, coordinates, or emergency type, the hash check fails immediately with `INTEGRITY_MISMATCH`, and the tampered packet is dropped.

---

## 4. Relay Admission Controls & Safeguards

To prevent Denial of Service (DoS), infinite routing loops, and radio congestion, `relayService` executes a multi-stage admission pipeline:

1. **Integrity Validation**: Rejects any message where calculated checksum does not match `integrityHash`.
2. **Expiration Enforcement (TTL)**: Compares `expiresAt` with system clock. Expired alerts are dropped (`EXPIRED`).
3. **Loop Prevention**:
   - Rejects alerts originating from own user ID or own node ID (`LOOP_DETECTED`).
   - Rejects alerts where `forwarderId` matches own node ID (`LOOP_PREVIOUS_FORWARDER`).
   - Rejects alerts already forwarded by this node via SQLite `relay_history` query (`ALREADY_FORWARDED`).
4. **Duplicate Detection**:
   - If `alertId` already exists in SQLite with equal or lower hop count, further re-broadcasts are suppressed (`DUPLICATE_ALERT`).
5. **Relay Enabled Switch**:
   - Responders can toggle "SOS Mesh Relay" in Profile settings.
   - When disabled, incoming alerts are saved locally for personal triage and queued for cloud sync, but **not** forwarded over BLE (`RELAY_DISABLED`).
6. **Maximum Hop Limit Enforcement**:
   - Clamped between 1 and 5 (default 3). If `hopCount >= maxHops`, forwarding is suppressed (`HOP_LIMIT_REACHED`).
7. **Sliding-Window Rate Limiting**:
   - Maximum 5 forward broadcasts per 60-second sliding window (`RATE_LIMIT_EXCEEDED`). Protects radio saturation and battery exhaustion.

---

## 5. SQLite Schema & Migrations

RescueLink uses version-tracked migrations applied via `PRAGMA user_version`:

### Migration v1 (Step 5)
- `alerts`: Core emergency distress records table.
- `message_receipts`: Delivery and acknowledgment receipts table.
- `sync_queue`: Offline outbox queue table.

### Migration v2 (Step 6)
- Adds exponential backoff scheduling (`lastAttemptAt`, `nextRetryAt`) and unique constraints (`idx_sync_queue_alert_op`) to `sync_queue`.

### Migration v3 (Step 8 — Multi-Device Relay)
- Extends `alerts` table with relay metadata:
  ```sql
  ALTER TABLE alerts ADD COLUMN hopCount INTEGER DEFAULT 0;
  ALTER TABLE alerts ADD COLUMN maxHops INTEGER DEFAULT 3;
  ALTER TABLE alerts ADD COLUMN forwarderId TEXT;
  ALTER TABLE alerts ADD COLUMN originalSenderId TEXT;
  ALTER TABLE alerts ADD COLUMN expiresAt TEXT;
  ALTER TABLE alerts ADD COLUMN relayStatus TEXT DEFAULT 'none';
  ALTER TABLE alerts ADD COLUMN lastForwardedAt TEXT;
  ALTER TABLE alerts ADD COLUMN integrityHash TEXT;
  ```
- Creates `relay_history` table for immutable auditing:
  ```sql
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
  ```

---

## 6. BLE Capabilities & Realistic Android Hardware Nuances

| Capability | Supported in React Native `react-native-ble-plx`? | Supported in Android Native SDK? | Implementation in RescueLink |
|---|---|---|---|
| **BLE Central (Scanning & GATT Client)** | ✅ Full Support | ✅ Full Support | `bleCentralService.js` scans for `e0a90001-...`, connects, requests 512 MTU, reads SOS characteristic, writes ACK. |
| **BLE Peripheral (GATT Server & Advertising)** | ❌ Not supported by `react-native-ble-plx` | ✅ Supported via `BluetoothLeAdvertiser` & `BluetoothGattServer` | Handled via `blePeripheralService.js` using `react-native-ble-peripheral` native bridge in Expo Dev Builds (`npx expo run:android`), with clear fallback reports in Expo Go. |
| **Multi-Hop Relay Forwarding** | Supported in hybrid Central/Peripheral mode | Supported via simultaneous multi-role BLE | Central receives SOS, persists to SQLite, triggers Peripheral advertising with incremented hop count. |

> [!NOTE]
> Android 12+ requires runtime permissions: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `BLUETOOTH_ADVERTISE`. Android hardware must support multiple advertising (`BluetoothAdapter.isMultipleAdvertisementSupported()`).

---

## 7. Emergency Contact Management & Multi-Channel SOS Notifications (Step 9)

```mermaid
graph TD
    subgraph Client ["RescueLink Mobile Client"]
        User["User Initiates SOS"] --> Composer["Send SOS Screen"]
        Composer --> Consent{"Location Sharing<br/>Consent Granted?"}
        Consent -- Yes --> MapLink["Attach Google Maps URL<br/>(lat/lon)"]
        Consent -- No --> NoMap["Omit Maps Link<br/>('Location omitted')"]
        Composer --> SQLiteAlert[("SQLite: alerts")]
        Composer --> SQLiteNotif[("SQLite: notification_tasks<br/>(status: 'queued')")]
    end

    subgraph SyncGate ["Transport & Synchronization"]
        SQLiteAlert --> NetDecision{"Internet Available?"}
        NetDecision -- "Offline (BLE Mesh)" --> MeshRelay["Multi-Hop BLE Relay<br/>(Devices A -> B -> C)"]
        NetDecision -- "Online / Synced" --> CloudAPI["POST /api/alerts<br/>or POST /api/alerts/sync"]
        MeshRelay -. "Sync when reachable" .-> CloudAPI
    end

    subgraph Backend ["RescueLink Express Backend"]
        CloudAPI --> NotifService["NotificationService Engine"]
        NotifService --> ContactStore[("Contacts Store<br/>(Enabled & Priority Sorted)")]
        NotifService --> IdempCheck{"Idempotency Key Exists?<br/>(alertId:contactId:channel)"}
        IdempCheck -- "Already Processed" --> Skip["Suppress Duplicate"]
        IdempCheck -- "New Task" --> Dispatch["Async Non-Blocking Dispatch"]
        Dispatch --> EmailProv["Email Provider<br/>(SMTP / Simulated)"]
        Dispatch --> SMSProv["SMS Provider<br/>(Twilio / Simulated)"]
        EmailProv --> EmailDest["Emergency Contact Inbox"]
        SMSProv --> SMSDest["Emergency Contact Mobile Phone"]
        Dispatch --> NotifStore[("Notifications Store<br/>(status: 'sent', providerId)")]
    end
```

### 7.1 Emergency Contact Schema & Priority Tiers
Contacts are defined with:
- `id` / `contactId`: Unique identifier (UUID).
- `userId`: Authenticated user ID (strict ownership isolation; cross-user lookups return 404).
- `name`: 2–60 characters.
- `phone`: Clean numeric 7–15 digit string (E.164 compatible).
- `email`: Standard RFC format.
- `relationship`: Descriptive category (e.g., Spouse, Parent, Doctor, Colleague).
- `priority`:
  - `1`: **Primary** (High urgency, first in dispatch order).
  - `2`: **Secondary** (Medium urgency).
  - `3`: **Standard** (Informational contact).
- `isEnabled`: Boolean flag allowing users to mute notifications without deleting the contact record.

### 7.2 Non-Blocking SOS Dispatch & Idempotency
- **Non-Blocking**: Creating or syncing an SOS alert **never fails** if an external notification provider (SMTP or Twilio) throws an error or times out. Dispatches run as background asynchronous promises.
- **Idempotency Key**: Generated as `${alertId}:${contactId}:${channel}`. Prevents repeated notification dispatches when an alert is re-synced from multiple relay paths.
- **Simulated Provider Fallback**: If `SMTP_USER` or `TWILIO_ACCOUNT_SID` are absent from `.env`, providers automatically operate in `simulated` mode, logging realistic message delivery payloads and provider IDs (`sim-email-...` / `sim-sms-...`) without crashing.

### 7.3 SQLite Schema Migration v4
Adds dedicated tables for contacts and local notification task auditing:
```sql
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contactId TEXT UNIQUE NOT NULL,
  userId TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relationship TEXT DEFAULT 'Emergency Contact',
  priority INTEGER NOT NULL DEFAULT 1 CHECK(priority BETWEEN 1 AND 3),
  isEnabled INTEGER NOT NULL DEFAULT 1 CHECK(isEnabled IN (0, 1)),
  syncStatus TEXT NOT NULL DEFAULT 'synced' CHECK(syncStatus IN ('synced', 'pending_create', 'pending_update', 'pending_delete')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId TEXT UNIQUE NOT NULL,
  alertId TEXT NOT NULL,
  contactId TEXT,
  contactName TEXT,
  channel TEXT NOT NULL CHECK(channel IN ('email', 'sms', 'push')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'sending', 'sent', 'delivered', 'failed')),
  retryCount INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

---

## 8. Comprehensive Automated Test Matrix (44 Tests)

The test runner (`tests/run-all-tests.mjs`) exercises all 7 core subsystems in pure Node.js with in-memory SQLite and ephemeral Express servers:

1. **Module 1**: Authentication, JWT & Security (6 tests)
2. **Module 2**: Emergency Alert REST API & Validation (5 tests)
3. **Module 3**: BLE Protocol & Sanitization (3 tests)
4. **Module 4**: SQLite Offline Persistence & Migrations v1–v3 (4 tests)
5. **Module 5**: Offline Outbox & Cloud Synchronization (7 tests)
6. **Module 6**: Multi-Device SOS Relay Network (10 tests)
7. **Module 7**: Emergency Contact Management & SOS Notifications (9 tests)
   - Input validation (name, phone, email, priority boundaries)
   - User 1 contact creation and priority sorting (Primary before Secondary)
   - Contact detail updates and enabled toggle filtering
   - Ownership isolation (User 2 receives 404 attempting to view/modify User 1 contacts)
   - Contact deletion
   - Location sharing consent gate (Google Maps link present only when consent granted)
   - Credential scrubbing (zero tokens, passwords, or secrets in notification text)
   - Automated non-blocking notification dispatch on SOS alert creation with idempotency
   - Mobile SQLite Migration v4 verification (`contacts` & `notification_tasks` tables)
   - Notification history API queries with user isolation and test dispatch endpoint
