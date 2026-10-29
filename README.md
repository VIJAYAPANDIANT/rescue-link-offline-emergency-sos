# RescueLink — Offline Bluetooth Emergency SOS System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v24.x-green.svg)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%20SDK%2052-orange.svg)](https://expo.dev/)
[![SQLite](https://img.shields.io/badge/Storage-expo--sqlite%20v15-blue.svg)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
[![BLE](https://img.shields.io/badge/Mesh-Bluetooth%20Low%20Energy-brightgreen.svg)](https://github.com/dotintent/react-native-ble-plx)

> **Major Project — Comprehensive Staged Implementation (Steps 1–6 Completed)**

---

## 🚨 Project Overview

**RescueLink** is a mission-critical, offline-first mobile emergency distress response system. During major natural disasters (earthquakes, cyclones, floods), wilderness expeditions, or catastrophic power grid collapse, cellular infrastructure and commercial internet services often fail entirely.

RescueLink bridges this communication gap through a **device-to-device Bluetooth Low Energy (BLE) direct signaling architecture** combined with **local SQLite offline persistence**. Smartphones running RescueLink can compose distress beacons offline, store them in a durable local SQLite ledger, broadcast beacons directly to nearby peers over custom BLE GATT profiles, and transmit genuine acknowledgments between sender and receiver devices without cellular connectivity.

---

## ⚠️ Important Safety & Ethical Notice

> [!IMPORTANT]
> **RescueLink is an academic engineering project.**
> - While RescueLink implements real Bluetooth Low Energy peer transmission, genuine GATT message exchange, and durable offline SQLite storage, it is **NOT certified by government public safety answering points (PSAPs)**.
> - This software is **NOT a replacement for certified 911, 112, or local emergency dispatch hotlines**.
> - In an active emergency where cellular networks or landlines are available, always contact official emergency services immediately.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose | Implementation Status |
|---|---|---|---|
| **Mobile Client** | React Native (JavaScript) + Expo SDK 52 | Cross-platform emergency UI design system | ✅ Completed (Step 1) |
| **Backend API** | Node.js + Express.js | Central REST API server & cloud ingestion | ✅ Completed (Steps 1–3) |
| **Security** | JSON Web Tokens (JWT) + bcrypt | Authentication, password hashing & profile security | ✅ Completed (Step 2) |
| **Alert Management** | Atomic JSON File Storage + REST API | Concurrency-safe incident management & validation | ✅ Completed (Step 3) |
| **BLE Central (Receiver)** | `react-native-ble-plx` | Scanning, GATT service discovery, SOS message reading | ✅ Completed (Step 4) |
| **BLE Peripheral (Sender)** | `react-native-ble-peripheral` | Custom GATT server hosting & beacon advertising | ✅ Completed (Step 4) |
| **Local Storage** | `expo-sqlite` (v15.1.4) | Offline WAL persistence, schema migrations, receipts & outbox | ✅ Completed (Step 5) |
| **Connectivity & NetInfo** | `@react-native-community/netinfo` (v11.4.1) | Live network monitoring & internet reachability verification | ✅ Completed (Step 6) |
| **Cloud Synchronization** | Opportunistic Sync Engine + Express REST | Outbox batch processing, exponential backoff, & BLE relay attribution | ✅ Completed (Step 6) |
| **Location & Maps** | GPS + Google Maps API | Real-time coordinate lock & spatial visualization | ✅ Completed (Step 1, optional) |
| **Mesh & Cloud Routing** | Multi-hop Mesh Gossip + Responder Feed | Multi-peer relay routing & central incident map | ⏳ Planned (Step 7) |

---

## 📁 Repository Structure

```text
c:\Offline Emergency SOS/
├── mobile/
│   ├── App.js                         # Root React Native application entry
│   ├── app.json                       # Expo configuration, permissions & plugins
│   ├── babel.config.js                # Babel compilation config
│   ├── package.json                   # Mobile dependencies & scripts
│   ├── assets/                        # Adaptive icons, splash, & metadata assets
│   └── src/
│       ├── components/                # Reusable UI component library
│       │   ├── SOSButton.js           # Animated pulsing circular emergency trigger
│       │   ├── StatusCard.js          # Color-coded subsystem status card
│       │   ├── EmergencyTypeSelector.js # Category picker (Medical, Fire, Accident, etc.)
│       │   ├── PrimaryButton.js       # Accessible buttons (Danger, Outline, Success)
│       │   ├── EmptyState.js          # Zero-data state with actions
│       │   └── index.js
│       ├── screens/                   # Core application screens
│       │   ├── HomeScreen.js          # Emergency dashboard with live subsystem sensors
│       │   ├── SendSOSScreen.js       # SOS composer, offline draft, & BLE broadcaster
│       │   ├── NearbyDevicesScreen.js # BLE receiver scanner, SOS reader, & ACK sender
│       │   ├── EmergencyHistoryScreen.js # SQLite-backed persistent emergency ledger
│       │   ├── LoginScreen.js         # Responder JWT authentication
│       │   ├── RegisterScreen.js      # Account registration screen
│       │   ├── ProfileScreen.js       # Responder credentials & session management
│       │   └── index.js
│       ├── navigation/                # Mobile navigation system
│       │   ├── AppNavigator.js        # Fluid screen router & emergency bottom tabs
│       │   └── index.js
│       ├── context/
│       │   └── AuthContext.js         # JWT auth state provider & AsyncStorage sync
│       ├── database/                  # SQLite Persistence Subsystem (Step 5 & 6)
│       │   ├── database.js            # SQLite connection, PRAGMA WAL, & lifecycle
│       │   ├── migrations.js          # Versioned schema migrations runner (v1 & v2)
│       │   ├── alertRepository.js     # SOS alert CRUD, upsert, and multi-source queries
│       │   ├── receiptRepository.js   # Message delivery & ACK receipts with atomic transactions
│       │   ├── syncQueueRepository.js # Offline outbox queue with deduplication & retry backoff
│       │   └── index.js               # Central database export
│       ├── services/                  # Business & hardware services
│       │   ├── bluetooth/             # Bluetooth Low Energy Subsystem (Step 4)
│       │   │   ├── bleConstants.js    # Custom 128-bit UUIDs, protocol limits, states
│       │   │   ├── bleProtocol.js     # Version 1 JSON message serializer & sanitization
│       │   │   ├── blePermissions.js  # Android 6–14+ dynamic runtime permissions
│       │   │   ├── bleManagerModule.js# Safe native BLE bridge resolver
│       │   │   ├── bleCentralService.js# Receiver scanning, connect, read, ACK write
│       │   │   ├── blePeripheralService.js# Sender GATT server & advertising beacon
│       │   │   └── bluetoothService.js# Unified Central & Peripheral coordinator
│       │   ├── location/
│       │   │   └── locationService.js # GPS coordinate provider & fallback
│       │   ├── network/               # Network Connectivity Subsystem (Step 6)
│       │   │   └── networkService.js  # Live NetInfo monitor & reachability checker
│       │   ├── api/
│       │   │   └── apiClient.js       # REST client with syncAlerts batch ingestion
│       │   └── sync/                  # Cloud Synchronization Engine (Step 6)
│       │       └── syncService.js     # Opportunistic outbox sync & exponential backoff
│       └── utils/
│           ├── constants.js           # Emergency categories, status & disclaimers
│           ├── theme.js               # Emergency color palette, spacing & typography
│           └── helpers.js             # Formatter functions (coords, dates, IDs)
├── server/
│   ├── config/
│   │   └── env.js                     # Validated environment loader
│   ├── controllers/
│   │   ├── health.controller.js       # Health check controller
│   │   ├── auth.controller.js         # Register, Login, & Profile controllers
│   │   └── alert.controller.js        # Alert CRUD, status, & validation controllers
│   ├── middleware/
│   │   ├── auth.middleware.js         # JWT verification & senderId attachment
│   │   ├── error.middleware.js        # Central Express error handler
│   │   └── notFound.middleware.js     # Standardized 404 handler
│   ├── data/                          # Atomic Server Persistence
│   │   ├── users.json                 # Thread-safe atomic JSON user store
│   │   └── alerts.json                # Concurrency-locked atomic JSON alert store
│   ├── routes/
│   │   ├── health.routes.js           # GET /api/health route
│   │   ├── auth.routes.js             # /api/auth routes
│   │   ├── alert.routes.js            # /api/alerts routes
│   │   └── index.js                   # Central route aggregator
│   ├── services/
│   │   └── storage.service.js         # Atomic mutex file write utility
│   ├── .env                           # Local environment configuration
│   ├── .env.example                   # Environment variable template
│   ├── package.json                   # Server dependencies & scripts
│   └── server.js                      # Express application entry point
├── docs/
│   ├── architecture.md                # System design & multi-hop BLE mesh specs
│   └── api-specs.md                   # REST API & BLE GATT protocol documentation
├── .gitignore
└── README.md
```

---

## 📡 Bluetooth Low Energy (BLE) Protocol Specification

All RescueLink peer devices communicate directly over custom 128-bit GATT profiles:

| Entity | UUID | GATT Role & Permissions | Description |
|---|---|---|---|
| **RescueLink Emergency Service** | `e0a90001-b5a3-f393-e0a9-e50e24dcca9e` | Primary Service | Service identification in BLE advertising beacons |
| **SOS Alert Characteristic** | `e0a90002-b5a3-f393-e0a9-e50e24dcca9e` | `Read`, `Notify` (0x01 Read) | Sender peripheral hosts distress alert; Receiver Central reads |
| **SOS Acknowledgment Characteristic** | `e0a90003-b5a3-f393-e0a9-e50e24dcca9e` | `Write`, `Notify` (0x10 Write with response) | Receiver Central writes confirmed ACK back to Sender |

### Message Formats (Version 1 JSON)

#### 1. Distress Alert Payload (`SOS_ALERT`)
```json
{
  "version": 1,
  "type": "SOS_ALERT",
  "alertId": "DRAFT-7X9B-42K1",
  "emergencyType": "Medical Emergency",
  "details": "Severe allergic reaction, breathing difficulty",
  "senderName": "Alex Rivera",
  "latitude": 13.0827,
  "longitude": 80.2707,
  "createdAt": "2026-10-28T16:40:00.000Z"
}
```

#### 2. Receiver Acknowledgment Payload (`SOS_ACK`)
```json
{
  "version": 1,
  "type": "SOS_ACK",
  "alertId": "DRAFT-7X9B-42K1",
  "receiverId": "rx-3a8f9c",
  "receivedAt": "2026-10-28T16:41:12.300Z"
}
```

**Security & Size Constraints**:
- Maximum MTU payload size: **512 bytes**.
- Credential sanitization: Passwords, password hashes, and JWT tokens are stripped prior to serialization.
- All received BLE alerts display the mandatory disclaimer:
  > *"⚠️ Received directly over nearby Bluetooth. Not verified by a central server."*

---

## 💾 SQLite Offline Database Subsystem

RescueLink uses modern `expo-sqlite` (v15.1.4) with **Write-Ahead Logging (WAL)** mode as the local single source of truth.

### Database Tables:

1. **`alerts`**: Stores emergency distress records from all sources.
   - `alertId`: Unique identifier (Indexed, Unique constraint).
   - `senderId`, `senderName`, `emergencyType`, `details`, `contactDetails`, `latitude`, `longitude`.
   - `source`: `'local'`, `'bluetooth'`, or `'server'`.
   - `deliveryStatus`: `'pending'`, `'received'`, `'broadcasted'`, or `'Resolved'`.
   - `ackStatus`: `'unacknowledged'` or `'acknowledged'`.
   - `syncStatus`: `'synced'`, `'pending_sync'`, or `'not_synced'`.
   - `createdAt`, `updatedAt`.
2. **`message_receipts`**: Audit log of delivery and acknowledgment receipts.
   - `alertId`, `receiptType` (`'BLE_ACK_SENT'`, `'BLE_ACK_RECEIVED'`), `receivedAt`, `senderOrDeviceId`, `metadata`.
   - Transactional link: recording a receipt atomically updates `alerts.ackStatus = 'acknowledged'`.
3. **`sync_queue`**: Offline outbox queue for operations created while offline.
   - `alertId`, `operation` (`'CREATE'`, `'UPDATE_STATUS'`, `'RESOLVE'`), `payload`, `status` (`'pending'`, `'processing'`, `'failed'`), `retryCount`, `lastAttemptAt`, `nextRetryAt`, `errorMessage`.
   - **Migration v2**: Added exponential backoff retry scheduling timestamps (`lastAttemptAt`, `nextRetryAt`), index on `(status, nextRetryAt)`, and unique deduplication index on `(alertId, operation)` preventing duplicate queue items.

---

## 📱 Mobile Screens Overview

### 1. Home / Emergency Dashboard
- **Centerpiece SOS Button**: Circular crimson trigger with breathing visual glow.
- **System Subsystem Status Cards**:
  - **Responder Session**: JWT Authenticated or Guest Mode.
  - **Bluetooth Radio**: Real hardware state (BLE Ready Powered On / Disabled / Dev Build Required).
  - **SQLite Offline Storage**: Active WAL ledger with real-time stored record counts.
  - **Cloud Synchronization**: Real-time outbox sync status with pending queue counter and auto-sync state.
  - **Network Connectivity**: Backend Online (HTTP 200) or Offline / Local Mode.
  - **GPS Location Sensor**: Real-time coordinate lock status.
  - **RescueLink Server**: Express backend health check.
- **Quick Action Portals**: Navigation to Send SOS, Nearby Devices, and Emergency History.

### 2. Send SOS Screen (Sender Workflow)
- **Category Picker**: Medical Emergency, Accident, Personal Safety, Fire, Other.
- **Optional GPS Location**: User-consented coordinate acquisition.
- **Immediate SQLite Persistence**: Alert is saved locally in SQLite **before** any network attempt.
- **Online vs. Offline Dispatch**:
  - If online, submits to `POST /api/alerts` and marks record `syncStatus = 'synced'`.
  - If offline, saves local draft and queues `operation: 'CREATE'` in `sync_queue` outbox.
- **Deliberate BLE Broadcast**: User taps **"Broadcast via Bluetooth"** to activate the GATT server and advertise beacons.
- **Live Acknowledgment Listener**: When a nearby receiver confirms receipt over BLE, the screen presents a positive confirmation card and updates SQLite.

### 3. Nearby Devices Screen (Receiver Workflow)
- **Hardware Verification**: Validates Bluetooth radio and runtime permissions.
- **Real BLE Scanning**: Scans specifically for `RESCUELINK_SERVICE_UUID` with a 30-second timeout.
- **Discovered Peer List**: Shows genuine discovered devices with live RSSI signal strength (no fake devices).
- **Connect & Read SOS**: Establishes GATT connection, negotiates MTU 512, reads `SOS_ALERT_CHAR_UUID`, and persists alert into SQLite with `source = 'bluetooth'`.
- **Duplicate Protection**: Automatically detects previously processed `alertId`s and badges duplicates.
- **Transmit BLE Acknowledgment**: Writes `SOS_ACK` with confirmation back to the sender and records receipt in SQLite.

### 4. Emergency History Screen (Offline Ledger & Cloud Sync Hub)
- **Single Source of Truth**: Reads all records directly from SQLite for instant offline loading.
- **Cloud Synchronization Hub**:
  - **Sync Now Action**: Immediate manual synchronization trigger with in-flight spinner.
  - **Sync Status Bar**: Shows pending outbox count, last sync timestamp, and network connectivity state.
- **Multi-Filter Tabs**: Filter by Source (`All`, `Local`, `BLE Direct`, `Server Synced`) and Status (`All`, `Pending`, `Resolved`).
- **Comprehensive Badges**:
  - **Source**: 📱 Local Draft, 📡 BLE Direct, ☁️ Server Synced
  - **Delivery**: ⏳ Pending, ✉️ Transmitted, 🏁 Resolved
  - **Acknowledgment**: ✅ Confirmed, ⏳ Unacknowledged
  - **Cloud Sync**: 🟢 Synced, 🟡 Pending Sync, ⚪ Local Only
- **Mark as Resolved**: Updates SQLite delivery status immediately and queues sync operation.
- **Pull-to-Refresh**: Synchronizes with cloud backend if online, preserving local state.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x, v20.x, or v24.x installed
- **npm** or **yarn**
- **Android SDK & Command Line Tools** (For running native BLE development builds)

---

### Step 1: Starting the Backend Server

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server with Nodemon:
   ```bash
   npm run dev
   ```

4. Verify backend health:
   - **URL**: `http://localhost:5000/api/health`
   - **Response**:
     ```json
     {
       "success": true,
       "status": "healthy",
       "message": "RescueLink Emergency SOS Backend API is running smoothly."
     }
     ```

---

### Step 2: Running the Mobile Application

> [!NOTE]
> Native Bluetooth Low Energy (`react-native-ble-plx`, `react-native-ble-peripheral`) and `expo-sqlite` require an **Expo Development Build**. They cannot run inside standard Expo Go.

1. Navigate to the `mobile/` directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch Metro Bundler:
   ```bash
   npx expo start
   ```

4. Run on an Android device or emulator with native module support:
   ```bash
   npx expo run:android
   ```

---

## 🧪 Automated Verification & Test Results

The codebase includes automated tests across all subsystems:

| Test Suite | Coverage | Status |
|---|---|---|
| **Babel Compilation** | Verified syntax across all screens, database repositories, and BLE services | **PASS** (10/10 files) |
| **Expo Config** | Validated plugins (`expo-sqlite`, `react-native-ble-plx`) & Android permissions | **PASS** |
| **Backend REST APIs** | Tested `/api/health`, `/api/auth/register`, `/api/auth/login`, `/api/alerts` (GET/POST) | **PASS** |
| **BLE Protocol** | Verified Base64 serialization, deserialization, credential scrubbing, & 512 MTU limit | **PASS** |
| **SQLite Migrations** | Tested Migration v1 execution, index creation, and idempotency | **PASS** |
| **Multi-Source Persistence** | Verified saving `local`, `bluetooth`, and `server` alerts into SQLite | **PASS** |
| **Duplicate Prevention** | Verified re-saving existing `alertId` updates details without duplicate row creation | **PASS** |
| **Atomic Receipts & Ack** | Verified recording message receipt atomically updates `alerts.ackStatus` to `acknowledged` | **PASS** |
| **Offline Outbox Queue** | Tested enqueuing operations, error tracking (`retryCount`), and item removal | **PASS** |
| **Outbox Migration v2** | Added `lastAttemptAt`, `nextRetryAt`, retry index, and unique deduplication index | **PASS** |
| **Outbox Deduplication** | Verified duplicate `enqueue` calls update existing row without adding duplicate items | **PASS** |
| **Backoff Scheduling** | Verified retry backoff timers exclude unready items from eligible batches | **PASS** |
| **SyncService Algorithm** | Verified exponential backoff calculation bounds (5s base, 300s max cap) and concurrency locks | **PASS** |
| **Backend `POST /api/alerts/sync`** | Verified authenticated batch sync, idempotency (`already_synced`), and validation bounds | **PASS** |
| **BLE Relay Attribution** | Verified relayed BLE alerts record `source: bluetooth_relay`, relay node user ID, and original sender | **PASS** |
| **Partial Failure Resilience** | Verified per-item validation errors flag individual failed alerts without aborting batch | **PASS** |
| **End-to-End Sync Flow** | Verified successful sync deletes outbox item and updates SQLite alert to `'synced'` | **PASS** |
| **Auth Expiry Safety** | Verified 401 Unauthorized marks outbox item failed without deleting or corrupting local records | **PASS** |

---

## 🧭 Project Roadmap

- [x] **Step 1: Project Setup and SOS Mobile UI** (Completed)
  - Express server scaffold & `GET /api/health`
  - React Native Expo application structure
  - Reusable emergency design system and components
  - Complete 4-screen mobile workflow
- [x] **Step 2: User Authentication & JWT-Protected APIs** (Completed)
  - Atomic JSON user storage (`server/data/users.json`) with race-condition mutex
  - Password hashing with bcrypt (10 salt rounds)
  - Registration (`POST /api/auth/register`), Login (`POST /api/auth/login`), and Profile (`GET /api/auth/me`)
  - JWT token generation & verification middleware
  - Mobile authentication context (`AuthContext.js`), Login, Register, and Profile screens
- [x] **Step 3: SOS Alert Creation & Emergency Alert Management** (Completed)
  - Concurrency-safe atomic JSON alert store (`server/data/alerts.json`) with serialization lock
  - Robust backend validation: allowed types, coordinates (-90 to 90, -180 to 180), length bounds
  - JWT ownership security: cross-user isolation, automatic sender ID/name derivation
  - REST endpoints: `POST /api/alerts`, `GET /api/alerts`, `GET /api/alerts/:id`, `PATCH /api/alerts/:id/status`
  - React Native Send SOS form connected with authenticated submission, optional location acquisition, and review modal
  - Emergency History connected to live backend with pull-to-refresh and "Mark as Resolved" capability
- [x] **Step 4: Real Bluetooth Low Energy (BLE) Communication** (Completed)
  - BLE Central (`react-native-ble-plx`) & Peripheral (`react-native-ble-peripheral`) native architecture
  - Custom 128-bit GATT Service (`e0a90001-...`) and Characteristics for Alert Read/Notify (`e0a90002-...`) and Acknowledgment Write (`e0a90003-...`)
  - Version 1 JSON Message Protocol with MTU 512-byte safety bounds, Base64 serialization, and credential sanitization
  - Sender workflow in `SendSOSScreen.js`: online backend creation or offline local draft, deliberate BLE broadcast trigger, live GATT status, and ACK listener
  - Receiver workflow in `NearbyDevicesScreen.js`: discovery scan, real device list with RSSI metrics, GATT connection, offline alert validation, offline security disclaimer, and genuine BLE ACK transmission
  - Comprehensive unit test suite covering protocol validation, malformed payloads, schema checks, and payload bounds
- [x] **Step 5: SQLite Offline Storage & Reliable Alert Persistence** (Completed)
  - Integrated `expo-sqlite` (~15.1.4) with WAL journal mode and foreign keys enabled
  - Versioned migration runner (`schema_migrations`, v1 initial schema)
  - Tables created: `alerts`, `message_receipts`, and `sync_queue` (offline outbox) with indexed lookups
  - Multi-source alert persistence: User local drafts, incoming BLE distress messages, and server sync
  - Duplicate prevention: Stable `alertId` upserting preserving confirmed acknowledgments and pending sync states
  - Message receipts repository with atomic transactions updating alert `ackStatus`
  - Offline outbox queue (`sync_queue`) tracking operations (`CREATE`, `UPDATE_STATUS`, `RESOLVE`) without requiring live server
  - Emergency History screen reading directly from SQLite as single source of truth with source/status filtering, badges, and pull-to-refresh
- [x] **Step 6: Reliable Offline-to-Cloud Synchronization** (Completed)
  - Integrated `@react-native-community/netinfo` with live state detection, reachability verification, and automatic reconnect triggers
  - Database Migration v2: added `lastAttemptAt`, `nextRetryAt`, retry index, and deduplication unique index on `(alertId, operation)`
  - Outbox repository with idempotent `enqueue`, backoff scheduling, and sanitized error recording
  - Dedicated backend endpoint `POST /api/alerts/sync` with per-item reporting (`synced`, `already_synced`, `failed`)
  - Strict attribution separation: direct author (`source: 'local'`) vs. peer BLE relay (`source: 'bluetooth_relay'`, `relayedBy: req.user.id`, preserving original peer display name)
  - Client synchronization engine (`syncService.js`) with concurrency lock, exponential backoff with jitter (5s base, 5m cap), and non-destructive 401 handling
  - UI integrations: Dashboard `Cloud Synchronization` card with live outbox metrics; Emergency History with "Sync Now" action, sync status bar, and distinct Delivery / Acknowledgment / Cloud Sync badges
- [ ] **Step 7: Multi-hop BLE Mesh Routing & Incident Operations Map**
  - Multi-hop mesh gossip relaying across peer swarms
  - Real-time GIS distress map and first responder incident feed
  - Opportunistic sync engine processing `sync_queue` outbox
  - Real-time incident mapping & first responder dispatch interface

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
