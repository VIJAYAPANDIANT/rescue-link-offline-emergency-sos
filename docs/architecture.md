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

## 8. Live Emergency Map & Situational Incident Tracking Architecture (Step 10)

RescueLink incorporates a dual-mode geographic situational awareness interface designed to operate reliably across production devices, emulators, web previews, and fully offline environments:

```mermaid
graph TD
    subgraph MobileApp ["Mobile Incident Command Interface"]
        MapView["EmergencyMapView Switcher"]
        MapView -->|"Google Play Services / Native"| NativeMap["react-native-maps<br/>(Google Maps Engine)"]
        MapView -->|"Expo Go / Web / No Play Services"| RadarMap["Tactical Vector Radar Canvas<br/>(100% Offline Safe)"]
        
        LiveMapScreen["LiveEmergencyMapScreen"]
        LiveMapScreen --> MapView
        LiveMapScreen --> FilterBar["Category Filter Bar<br/>(All, Medical, Fire, Accident, etc.)"]
        LiveMapScreen --> GPSButton["User GPS Button<br/>(Permission Gated)"]
        LiveMapScreen --> UnmappedModal["Unmapped Incidents Drawer<br/>(Alerts lacking valid GPS)"]
        LiveMapScreen --> BottomSheet["Incident Details Sheet<br/>• Separated States<br/>• External Maps Deep Link"]
    end

    subgraph DataFeeds ["Data Feeds & Connectivity State"]
        LocalDB[("Local SQLite WAL<br/>(getMappedAlerts / getUnmappedAlerts)")] --> LiveMapScreen
        
        ConnState{"Connectivity & Stream Status"}
        ConnState -->|"Online & SSE Stream Open"| SSEFeed["SSE: GET /api/alerts/stream<br/>🟢 Live (Real-Time SSE)"]
        ConnState -->|"Online & SSE Fallback"| PollFeed["Poll: GET /api/alerts/map<br/>🟡 Periodic Polling (15s)"]
        ConnState -->|"Offline / Flight Mode"| CacheFeed["Local Cache Only<br/>⚪ Offline (SQLite Cache)"]
    end

    subgraph BackendGateway ["RescueLink Express Gateway"]
        SSEFeed --> StreamCtrl["alert.controller.streamAlerts<br/>(text/event-stream + keep-alive)"]
        PollFeed --> MapCtrl["alert.controller.getMappedAlerts<br/>(Summary Counts + Mapped Filter)"]
        StreamCtrl --> AlertStore[("Central Alert Storage")]
        MapCtrl --> AlertStore
    end
```

### 8.1 Dual-Engine Map Rendering & Graceful Fallback
- **Native Map Engine**: Uses `react-native-maps` (v1.18.0) backed by Google Play Services on Android (`com.google.android.geo.API_KEY`). Provides interactive vector tiles, pinch-to-zoom, compass bearing, and satellite/terrain layers.
- **Tactical Vector Radar Fallback**: In Expo Go, web browsers, or emulators without Google Play Services or where native binary modules are unavailable, the system automatically falls back to an SVG/Canvas-style **Tactical Vector Radar View**. This tactical view normalizes incident latitudes and longitudes relative to the user's location or the incident bounding box, rendering concentric tactical distance rings, radar crosshairs, and color-coded pulse pins without crashing or requiring network access.

### 8.2 Strict Coordinate Validation & Unmapped Incident Isolation
- **No Coordinate Fabrication**: Distress incidents without valid GPS coordinates are **never** plotted at `(0, 0)` or guessed.
- **Unmapped Incidents Drawer**: Incidents where `latitude` or `longitude` is missing or out of valid bounds (`[-90, 90]`, `[-180, 180]`) are segregated into `unmappedIncidents`. The UI displays a warning banner and quick-access badge (`⚠️ N Unmapped Incidents`) allowing responders to inspect the unmapped distress records in a dedicated modal drawer.

### 8.3 Standardized Incident Color Coding & Visual Hierarchy
Emergency pins are color-coded uniformly across the native map and tactical vector canvas:

| Emergency Type | Marker Color | Hex Code | Icon |
|---|---|---|---|
| **Medical** | Crimson Red | `#EF4444` | 🏥 |
| **Fire** | Amber Orange | `#F97316` | 🔥 |
| **Accident** | Sunflower Yellow | `#EAB308` | ⚠️ |
| **Personal Safety** | Royal Purple | `#8B5CF6` | 🛡️ |
| **Test / Drill** | Emerald Green | `#10B981` | 🧪 |
| **Other / General** | Ocean Blue | `#3B82F6` | ❓ |

### 8.4 Live Real-Time Ingestion: SSE + Polling Fallover
- **Server-Sent Events (SSE)**: Responders connect to `GET /api/alerts/stream?token=<JWT>`. The server holds open an HTTP `text/event-stream` connection, periodically transmitting keep-alive comments (`: keep-alive`) and immediately streaming newly ingested or updated incidents (`event: alert_created`, `event: alert_updated`).
- **Periodic Polling Failover**: If the mobile device or network proxy does not support persistent HTTP streaming, the client seamlessly falls back to 15-second polling of `GET /api/alerts/map`.
- **Live Status Badges**: The screen explicitly displays current synchronization telemetry so responders always know data freshness:
  - 🟢 **Live (Real-Time SSE)**: Active persistent HTTP event stream.
  - 🟡 **Periodic Polling (15s)**: Fallback polling active.
  - ⚪ **Offline (SQLite Cache)**: Operating entirely on local SQLite database cache.

### 8.5 Incident Details & Deep Linking
Selecting any map marker opens an actionable bottom sheet detailing:
- Emergency Type, Alert ID, and relative/absolute timestamp.
- Originator metadata and raw GPS coordinates with high precision.
- **Separated State Indicators**: Delivery status, acknowledgment confirmation, cloud sync state, and relay hop count ($n$ hops).
- **Navigation Deep Link**: "Navigate with Maps" button launching Google Maps / Apple Maps directions (`geo:lat,lng?q=lat,lng` / `https://maps.google.com/?q=lat,lng`).

---

## 9. Web Admin Dashboard, Emergency Monitoring & Security Architecture (Step 11)

RescueLink incorporates a dedicated, responsive web-based command dashboard (`admin/`) built with React, Vite, and Tailwind CSS. It communicates securely with the central Express.js backend to provide operations oversight, incident triage, responder user management, Bluetooth Low Energy mesh telemetry, notification delivery monitoring, and security audit logging.

```mermaid
graph TD
    subgraph WebAdmin ["RescueLink Admin Dashboard (React + Vite)"]
        AdminLogin["Admin Login<br/>(JWT + Role Gate)"]
        SidebarNav["Sidebar Navigation"]
        OverviewTab["📊 Overview Dashboard<br/>(Real Telemetry, KPIs & Timeline)"]
        IncidentTab["🚨 Incident Management<br/>(Search, Filter, Map, Lifecycle Triage)"]
        UserTab["👥 User Management<br/>(Role Assignment, Suspend / Activate)"]
        RelayTab["📡 Relay Monitoring<br/>(Hop Depth Distribution, Node Paths)"]
        NotifTab["🔔 Notification Audits<br/>(Masked Delivery, Provider Status)"]
        AnalyticsTab["📈 Situational Analytics<br/>(Real Empirical Trends)"]
        AuditTab["📜 Audit Ledger<br/>(Tamper-Evident Security Log)"]

        SidebarNav --> OverviewTab
        SidebarNav --> IncidentTab
        SidebarNav --> UserTab
        SidebarNav --> RelayTab
        SidebarNav --> NotifTab
        SidebarNav --> AnalyticsTab
        SidebarNav --> AuditTab
    end

    subgraph SecurityLayer ["Backend Security & RBAC Middleware"]
        AuthMiddleware["authenticateToken<br/>(JWT Header / Query Check)"]
        AdminMiddleware["requireAdmin<br/>(Role: 'admin', Status: 'active')"]
        AuthMiddleware --> AdminMiddleware
    end

    subgraph BackendAPI ["Express.js Admin REST Endpoints"]
        AdminMiddleware --> DashEP["GET /api/admin/dashboard"]
        AdminMiddleware --> IncidentsEP["GET & PATCH /api/admin/incidents"]
        AdminMiddleware --> UsersEP["GET & PATCH /api/admin/users"]
        AdminMiddleware --> RelayEP["GET /api/admin/relay"]
        AdminMiddleware --> NotifEP["GET /api/admin/notifications"]
        AdminMiddleware --> AuditEP["GET /api/admin/audit-logs"]
    end

    subgraph PersistentStorage ["Atomic Server Data Stores"]
        DashEP --> AlertStore[("alerts.json")]
        DashEP --> UserStore[("users.json")]
        DashEP --> NotifStore[("notifications.json")]
        IncidentsEP --> AlertStore
        UsersEP --> UserStore
        RelayEP --> AlertStore
        NotifEP --> NotifStore
        IncidentsEP -. "Audit Record" .-> AuditStore[("audit_logs.json")]
        UsersEP -. "Audit Record" .-> AuditStore
        AuditEP --> AuditStore
    end
```

### 9.1 Role-Based Access Control (RBAC) & Authentication
- **Admin Role Enforcement**: All routes mounted under `/api/admin` require both `authenticateToken` and `requireAdmin`. Unauthenticated requests yield `401 Unauthorized`; authenticated non-admin users yield `403 Forbidden` (`FORBIDDEN_ADMIN_REQUIRED`).
- **Account Status Verification**: Accounts marked `suspended` or `deactivated` are strictly blocked from logging in (`403 Forbidden: ACCOUNT_SUSPENDED`).
- **Self-Protection Guardrails**: Administrators cannot suspend or demote their own account (`SELF_SUSPENSION_PROHIBITED`, `SELF_DEMOTION_PROHIBITED`), preventing accidental administrative lockout.
- **Initial Setup Utility**: Secure initial administrator provisioning script (`server/scripts/create-admin.js` / `npm run seed:admin`) with bcrypt password hashing (10 salt rounds) and administrative audit logging. Zero hardcoded passwords or committed secrets.

### 9.2 Incident Lifecycle Triage & Immutability Guarantees
- **Administrative Lifecycle Statuses**: Authorized administrators can transition incidents through operational states: `Pending` $\to$ `Open` $\to$ `Investigating` $\to$ `Dispatched` $\to$ `Acknowledged` $\to$ `Resolved` or `False Alarm`.
- **Survivor Data Preservation**: Updating an incident's administrative status **never** alters the survivor's original distress narrative, GPS coordinates, local BLE delivery state, or peer acknowledgment receipt.
- **Audit Attachment**: Every status change creates an immutable audit record in `server/data/audit_logs.json` and embeds a reviewer stamp (`adminReview`) on the incident record.

### 9.3 Privacy-Preserving Recipient Masking
- In compliance with privacy standards, notification recipient endpoints are strictly masked in administrative views:
  - Email addresses: `j***e@example.com`
  - Phone numbers: `+1***890`
- Zero raw phone numbers, email addresses, or survivor credentials are leaked in administrative monitoring logs.

### 9.4 Empirical Analytics Without Data Fabrication
- The dashboard overview and analytics visualizations compute metrics solely from verified records stored in `alerts.json`, `notifications.json`, `users.json`, and `audit_logs.json`.
- In the absence of data, clean empty states are rendered; synthetic sample statistics or fabricated trend curves are strictly prohibited.

---

## 10. Comprehensive Automated Test Matrix (62 Tests)

The test runner (`tests/run-all-tests.mjs`) exercises all core subsystems in pure Node.js with in-memory SQLite and ephemeral Express servers:

1. **Module 1**: Authentication, JWT & Security (6 tests)
2. **Module 2**: Emergency Alert REST API & Validation (5 tests)
3. **Module 3**: BLE Protocol & Sanitization (3 tests)
4. **Module 4**: SQLite Offline Persistence & Migrations v1–v5 (4 tests)
5. **Module 5**: Offline Outbox & Cloud Synchronization (7 tests)
6. **Module 6**: Multi-Device SOS Relay Network (10 tests)
7. **Module 7**: Emergency Contact Management & SOS Notifications (9 tests)
8. **Module 8**: Live Emergency Map & Incident Tracking (6 tests)
9. **Module 9**: Admin Dashboard, Incident Monitoring & Analytics (7 tests)
10. **Module 10 (Step 12)**: Production Hardening & Readiness Verification (2 tests)
11. **Module 11 (Step 13)**: UI/UX Design System, Theming & Accessibility Contract (3 tests)
   - `UI Design System`: Complete token coverage across light and dark palettes conforming to WCAG AA contrast
   - `Emergency Interaction Design`: Independent lifecycle state separation across delivery, acknowledgment, and sync states
   - `Test Mode Isolation`: Non-emergency simulation drills carry explicit drill metadata and do not summon real responders

---

## 11. Production Hardening & Operational Resilience (Step 12)

### 11.1 Defense-in-Depth Security Architecture
```mermaid
flowchart TD
    Client["Client Request (Mobile / Admin Web)"] --> Headers["Security Headers & Frame Guards<br/>(nosniff, X-Frame-Options, XSS-Protection)"]
    Headers --> RateLimit["Sliding Window Token Bucket Rate Limiter<br/>• Global: 300 req/min per IP<br/>• Auth: 30 req/15min per IP"]
    RateLimit --> BodyLimit["Request Size Guard<br/>(express.json: 1MB limit)"]
    BodyLimit --> AuthMiddleware["JWT & Role Authorization<br/>(Bearer Token Check, 7-day TTL)"]
    AuthMiddleware --> InputValidation["Strict Schema & Parameter Validation<br/>(Zero SQL / Command Injection)"]
    InputValidation --> CoreLogic["Controller Execution & Storage Mutex"]
    CoreLogic --> Storage[("Atomic JSON Stores / SQLite WAL")]
    CoreLogic --> Masking["Response Sanitization & Privacy Masking"]
    Masking --> SafeResponse["Sanitized JSON Response"]
```

### 11.2 Environment Startup Validation
During server initialization (`server/config/env.js`), the runtime validates:
- `PORT`: Valid positive integer between 1024 and 65535.
- `JWT_SECRET`: Minimum 32-character high-entropy secret; halts startup in `production` if defaults or weak strings are detected.
- `CORS_ORIGIN`: Configured to explicit origins in production environments.

### 11.3 Health & Readiness Probes
- `GET /api/health`: High-speed liveness check returning process status, uptime, and timestamp. Exempted from rate limiting for zero-overhead load balancer health polling.
- `GET /api/ready`: Comprehensive operational readiness check validating read and write filesystem permissions on `users.json`, `alerts.json`, `contacts.json`, `notifications.json`, and `audit_logs.json`, alongside live process RSS and V8 heap memory statistics.

### 11.4 Graceful Shutdown Engine
Handles `SIGTERM` and `SIGINT` signals with a 10-second drain window, closing active keep-alive HTTP connections and pending storage write locks before terminating the process cleanly without data corruption.

---

## 12. Design System & Accessibility Architecture (Step 13)

### 12.1 Emergency Visual Identity & Color Philosophy
RescueLink's design system adheres strictly to emergency response ergonomics:
- **Dark Navy (`#0F172A` / `#0B1120`)**: Provides primary structural authority, high contrast, and reduces eye strain in nocturnal or blackout environments.
- **Crimson Red (`#DC2626` / `#EF4444`)**: Reserved exclusively for active emergency SOS alerts and destructive confirmation actions.
- **Emerald Green (`#16A34A` / `#22C55E`)**: Communicates positive confirmation (verified BLE peer acknowledgment, delivered SMS/Email notifications).
- **Tangerine Orange (`#EA580C` / `#F97316`)**: Communicates non-critical warnings (pending outbox queues, disabled relays, Bluetooth warnings).
- **Cobalt Blue (`#2563EB` / `#3B82F6`)**: Indicates GPS location, simulation drills (`Test / Drill`), and general telemetry.

### 12.2 Multi-State Progression Architecture
Emergency distress progression is cleanly decomposed into 4 independent lifecycle stages:
1. **Stage 1: Saved Locally in SQLite**: Immediate transaction commit to local WAL database with zero network dependencies.
2. **Stage 2: BLE Transmission**: Active advertisement of compact 512-byte GATT frames over Bluetooth Low Energy.
3. **Stage 3: Peer Confirmed (ACK)**: Genuine peer confirmation written back by a discovering central node over BLE.
4. **Stage 4: Cloud Synchronized**: Opportunistic batch upload to central rescue servers once internet connectivity is confirmed.

### 12.3 Accessibility & Universal Design Guardrails
- **Color Independence**: Every emergency status badge incorporates an explicit icon glyph (`🚨`, `📡`, `🤝`, `☁️`, `✓`, `✕`, `⏳`) alongside high-contrast text labels. Color is **never** used alone to convey critical life-safety states.
- **Large Touch Targets**: All interactive triggers, buttons, and navigation tabs enforce a minimum touch bounding box of 48x48 dp.
- **Simulation Drill Isolation**: Non-emergency drills are given distinctive blue/cyan styling and explicit `DRILL` pills to prevent false-alarm confusion during field training.
