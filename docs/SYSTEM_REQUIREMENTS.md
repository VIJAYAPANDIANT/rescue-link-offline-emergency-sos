# RescueLink — System Requirements Specification (SRS)

**Document:** Software and Hardware Requirements Specification  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0  
**Date:** October 2026  

---

## 1. Functional Requirements (FR)

### FR1: Emergency SOS Creation & Categorization
- **FR1.1:** The mobile client shall provide a prominent, high-contrast SOS activation button accessible immediately upon app launch.
- **FR1.2:** The system shall support categorization of emergency incidents across six distinct types:
  - `Medical Emergency`
  - `Accident`
  - `Personal Safety`
  - `Fire`
  - `Other`
  - `Test / Drill` (Isolated simulation mode)
- **FR1.3:** The user shall be capable of appending an optional incident description (up to 180 characters) detailing trapped count, injuries, or hazards.
- **FR1.4:** The system shall support an emergency trigger confirmation delay (default 3 seconds with visual countdown) to mitigate accidental activations, with an optional instant-trigger override.

### FR2: Local Offline Persistence & Durability
- **FR2.1:** All newly generated, received, or relayed SOS alerts shall be written atomically to an embedded SQLite database before any network or radio transmission is attempted.
- **FR2.2:** The SQLite engine shall operate in Write-Ahead Logging (`PRAGMA journal_mode = WAL`) to guarantee zero corruption and support concurrent read operations during background writes.
- **FR2.3:** The database schema shall support versioned migrations (v1 through v4+) executed automatically on startup.
- **FR2.4:** The local database shall track three independent lifecycle states for every alert: `deliveryStatus`, `ackStatus`, and `syncStatus`.

### FR3: Bluetooth Low Energy (BLE) Broadcasting & Discovery
- **FR3.1:** The mobile client shall instantiate a GATT Peripheral server and advertise a dedicated RescueLink Emergency Service UUID (`0000FEF0-0000-1000-8000-00805F9B34FB`).
- **FR3.2:** The GATT server shall host readable and notify-enabled characteristics for alert payload transmission (`0000FEF1-...`) and acknowledgment receipts (`0000FEF2-...`).
- **FR3.3:** The mobile client shall run an active BLE Central scanner capable of discovering advertising RescueLink peripherals within radio range.
- **FR3.4:** The client shall serialize alert payloads into Base64-encoded JSON strings guaranteed to fit within a single 512-byte Maximum Transmission Unit (MTU) packet.
- **FR3.5:** The BLE serializer shall scrub all sensitive user credentials (JWTs, passwords, password hashes, auth headers) prior to over-the-air transmission.

### FR4: Controlled Multi-Device Epidemic Relay
- **FR4.1:** An intermediate device receiving a peer SOS alert shall evaluate eligibility for multi-hop retransmission.
- **FR4.2:** The relay engine shall increment `hopCount` by 1 and set `forwarderId` to the relaying node's anonymous identifier while preserving `originalSenderId` and immutable survivor details.
- **FR4.3:** The relay engine shall enforce configurable maximum hop bounds (default 3 hops; range 1–5 hops).
- **FR4.4:** The relay engine shall calculate and verify a 32-bit FNV-1a content integrity hash, rejecting any modified or corrupted packets.
- **FR4.5:** The relay engine shall enforce time-to-live (TTL) expiration (default 24 hours from `createdAt`), discarding stale alerts.
- **FR4.6:** The relay engine shall maintain an LRU cache of recently seen `alertId` values to prevent routing loops and message duplication.
- **FR4.7:** The relay engine shall enforce a sliding-window forwarding rate limit (maximum 5 forward broadcasts per minute per node) to conserve battery and radio spectrum.

### FR5: Opportunistic Cloud Synchronization
- **FR5.1:** The mobile client shall monitor network reachability via NetInfo combined with active endpoint reachability probing.
- **FR5.2:** When connectivity transitions to online, the client shall process pending outbox queue records in chronological batches.
- **FR5.3:** The sync engine shall execute exponential backoff retries (base delay 5 seconds, max delay 300 seconds, max 5 attempts) upon network failure.
- **FR5.4:** The backend ingestion API shall be idempotent, acknowledging already-synced alerts without duplicating server records.
- **FR5.5:** The sync payload shall record relay attribution metadata (`relayedByUserId`, `hopCount`, `forwarderId`) to reward mesh contributors while preserving original incident authorship.

### FR6: Emergency Contact Management
- **FR6.1:** Users shall be able to add, view, edit, and delete trusted emergency contacts.
- **FR6.2:** Each contact record shall include validated Name, Phone number (E.164 format), and Email address.
- **FR6.3:** Contacts shall support priority tiering (Priority 1 through 5) and individual enable/disable toggles.
- **FR6.4:** Contacts shall be stored both locally in SQLite and synchronized to the cloud backend under authenticated user ownership.

### FR7: Automated Notification Pipeline
- **FR7.1:** When an SOS alert is synchronized to the cloud backend, the notification service shall query all enabled contacts for the survivor.
- **FR7.2:** The backend shall queue multi-channel notification dispatches via SMTP Email and SMS (Twilio).
- **FR7.3:** Notification history and status tracking shall mask recipient phone numbers and email addresses in all queryable APIs.

### FR8: Live Geospatial Map & Radar Tracking
- **FR8.1:** The mobile application shall display active incidents on an interactive map using `react-native-maps` with GPS tracking.
- **FR8.2:** The map shall support color-coded status markers reflecting emergency categories and priority levels.
- **FR8.3:** Devices lacking Google Play Services or native map binaries shall automatically render a custom Canvas-based Tactical Radar View.
- **FR8.4:** The map screen shall establish a Server-Sent Events (SSE) listener (`GET /api/alerts/stream`) to render incoming incidents in real time without manual polling.

### FR9: Web Admin Command Dashboard & Analytics
- **FR9.1:** The system shall provide a responsive web dashboard for incident commanders and emergency dispatchers.
- **FR9.2:** The dashboard shall present aggregate situational metrics: Total Alerts, Active Alerts, Resolved Incidents, Relayed Alerts, and Mesh Efficiency Ratio.
- **FR9.3:** Administrators shall be able to update incident lifecycle status (`investigating`, `resolving`, `resolved`).
- **FR9.4:** Administrators shall be able to view user lists, inspect relay telemetry, and suspend abusive accounts.

### FR10: Tamper-Evident Audit Logging & Role Authorization
- **FR10.1:** All administrative actions (status changes, user suspensions, config updates) shall generate append-only, tamper-evident audit records.
- **FR10.2:** The backend shall enforce strict role-based access control (RBAC), restricting administrative endpoints exclusively to verified `admin` role tokens.

---

## 2. Non-Functional Requirements (NFR)

| ID | Category | Requirement Specification |
|---|---|---|
| **NFR1** | **Offline Durability** | 100% of emergency alert composition, reading, and acknowledgment workflows must function with zero network connectivity. |
| **NFR2** | **Transmission Constraint** | Over-the-air BLE payloads must not exceed 512 bytes (GATT characteristic MTU limit). |
| **NFR3** | **Data Integrity** | Any single-bit alteration in an emergency packet during relay transit must be detected by the FNV-1a checksum and discarded. |
| **NFR4** | **Sync Idempotency** | Duplicate sync submissions of the same `alertId` must return HTTP 200 with `status: "already_synced"` without data duplication. |
| **NFR5** | **Security & Hashing** | All user passwords must be hashed using `bcrypt` with a minimum of 10 salt rounds before persistence. |
| **NFR6** | **Privacy Protection** | BLE broadcast frames must never transmit user passwords, password hashes, or session tokens. Contact details must be masked in API responses. |
| **NFR7** | **Rate Limiting** | Public APIs must enforce sliding-window rate limiting: maximum 300 requests/minute for standard endpoints; 30 requests/15-minutes for authentication. |
| **NFR8** | **Accessibility & UX** | High-contrast emergency visual tokens (WCAG AA compliant contrast ratio $\ge 4.5:1$) with redundant textual and iconic indicators. |

---

## 3. Hardware & Operating System Specifications

### 3.1 Mobile Client Devices

```
+-----------------------------------------------------------------------------------+
|                         MOBILE CLIENT HARDWARE PROFILE                            |
+-----------------------------------------------------------------------------------+
| Component      | Minimum Requirement               | Recommended Specification    |
|----------------|-----------------------------------|------------------------------|
| OS             | Android 8.0 (Oreo, API level 26)  | Android 12.0+ (API level 31+)|
|                | iOS 14.0                          | iOS 16.0+                    |
| Bluetooth      | Bluetooth 4.2 LE (BLE)            | Bluetooth 5.0+ LE            |
| Peripheral Mode| Supported by hardware chipset     | Dual-mode concurrent support |
| RAM            | 2 GB                              | 4 GB or higher               |
| Internal Disk  | 100 MB free flash storage         | 500 MB free flash storage    |
| Positioning    | Integrated GPS / GLONASS receiver | Multi-band GNSS + Barometer  |
+-----------------------------------------------------------------------------------+
```

### 3.2 Backend Server Infrastructure

- **Runtime:** Node.js v18.x, v20.x, or v24.x LTS.
- **Memory:** Minimum 512 MB RAM (1 GB+ recommended).
- **Storage:** Minimum 1 GB persistent SSD volume for transactional JSON stores and audit trail logs.
- **Network:** Outbound TCP 25/465/587 for SMTP; outbound HTTPS 443 for Twilio SMS API.

### 3.3 Admin Dispatcher Workstation

- **Browser:** Google Chrome 110+, Mozilla Firefox 115+, Apple Safari 16+, Microsoft Edge 110+.
- **Display Resolution:** Minimum $1024 \times 768$ (Fully responsive across mobile, tablet, and multi-monitor operations desks).

---

## 4. Mobile Runtime Permissions Matrix (Android)

RescueLink requires explicit declaration and runtime granting of the following Android permissions in `mobile/app.json`:

```json
"permissions": [
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION",
  "BLUETOOTH",
  "BLUETOOTH_ADMIN",
  "BLUETOOTH_SCAN",
  "BLUETOOTH_ADVERTISE",
  "BLUETOOTH_CONNECT",
  "INTERNET",
  "ACCESS_NETWORK_STATE",
  "FOREGROUND_SERVICE",
  "FOREGROUND_SERVICE_CONNECTED_DEVICE"
]
```

| Permission | API Level | Purpose & Criticality |
|---|---|---|
| `ACCESS_FINE_LOCATION` | All | Required for acquiring high-accuracy GPS coordinates during emergency SOS creation. |
| `ACCESS_COARSE_LOCATION` | All | Fallback approximate positioning when GPS satellite fix is obstructed by debris. |
| `BLUETOOTH_SCAN` | Android 12+ (API 31+) | Allows client to scan for nearby peer emergency beacons (`neverForLocation` flag where applicable). |
| `BLUETOOTH_ADVERTISE` | Android 12+ (API 31+) | Allows device to broadcast SOS beacons as a GATT Peripheral server. |
| `BLUETOOTH_CONNECT` | Android 12+ (API 31+) | Enables reading characteristics, subscribing to notifications, and transmitting ACKs. |
| `INTERNET` | All | Communicating with the Express cloud backend when connectivity is available. |
| `ACCESS_NETWORK_STATE` | All | Monitored by NetInfo to detect offline-to-online transitions for triggering outbox sync. |
| `FOREGROUND_SERVICE` | Android 9+ (API 28+) | Maintains background BLE scanning and mesh relay listening without OS task killer termination. |

---

## 5. Developer Environment Prerequisites

To build and run the complete RescueLink system locally:

1. **Node.js:** v18.0.0 or higher (v24.x tested).
2. **Package Manager:** `npm` (v9+) or `pnpm`.
3. **Mobile Build Tools:**
   - Expo CLI (`npx expo`)
   - Android Studio with Android SDK Platform 34 and Google Play Services.
   - Java Development Kit (JDK 17).
4. **Git:** Distributed version control.
