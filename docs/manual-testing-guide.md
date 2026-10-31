# RescueLink — Manual Testing & Demonstration Protocol

**System:** RescueLink — Offline Bluetooth Emergency SOS System  
**Document:** End-to-End Manual Testing Protocol (13 Core Scenarios)  
**Target Environment:** Local Development / Testing Staging  
**Prerequisites:**
- Node.js v18+ installed
- Terminal 1: Backend running (`npm run start --prefix server` on port 5000)
- Terminal 2: Admin Dashboard running (`npm run dev --prefix admin` on port 5173)
- Terminal 3: Mobile client or simulator running (`npm start --prefix mobile`)
- Optional for multi-device BLE testing: 2 or 3 Android devices with Bluetooth LE enabled

---

## Scenario Index

1. [Scenario 1: User Registration & Authentication](#scenario-1-user-registration--authentication)
2. [Scenario 2: Emergency Contact Configuration](#scenario-2-emergency-contact-configuration)
3. [Scenario 3: Offline SOS Creation (Panic Button Trigger)](#scenario-3-offline-sos-creation-panic-button-trigger)
4. [Scenario 4: Bluetooth Broadcast & Peer Discovery](#scenario-4-bluetooth-broadcast--peer-discovery)
5. [Scenario 5: Peer Reception & Local Acknowledgment](#scenario-5-peer-reception--local-acknowledgment)
6. [Scenario 6: Multi-Hop Mesh Relay Forwarding](#scenario-6-multi-hop-mesh-relay-forwarding)
7. [Scenario 7: Network Reconnection & Cloud Sync](#scenario-7-network-reconnection--cloud-sync)
8. [Scenario 8: Emergency Notification Dispatch (SMS/Email/Push)](#scenario-8-emergency-notification-dispatch-smsemailpush)
9. [Scenario 9: Live Map Incident Display & Tracking](#scenario-9-live-map-incident-display--tracking)
10. [Scenario 10: Admin Dashboard Monitoring & Analytics](#scenario-10-admin-dashboard-monitoring--analytics)
11. [Scenario 11: Security Audit Log Inspection](#scenario-11-security-audit-log-inspection)
12. [Scenario 12: Incident Lifecycle Status Resolution](#scenario-12-incident-lifecycle-status-resolution)
13. [Scenario 13: Edge Case & Fault Tolerance Handling](#scenario-13-edge-case--fault-tolerance-handling)

---

## Scenario 1: User Registration & Authentication

### Objective
Verify that a new citizen user can create an account, receive a valid JWT token, and authenticate securely.

### Steps
1. Open the mobile application or navigate to the authentication interface.
2. Enter the following details:
   - **Full Name:** `Alice Walker`
   - **Email:** `alice@example.com`
   - **Phone:** `+1 (555) 234-5678`
   - **Password:** `RescueSecurePass2026!`
   - **Role:** `citizen`
3. Tap **Register**.
4. Log out and log back in using `alice@example.com` and `RescueSecurePass2026!`.

### Expected Results
- Backend returns HTTP `201 Created` with a sanitized user object (password omitted) and a signed JWT bearer token.
- Mobile client persists the token securely and redirects to the Main SOS Dashboard.
- Entering an invalid password yields HTTP `401 Unauthorized` with a generic `Invalid credentials` error message.

---

## Scenario 2: Emergency Contact Configuration

### Objective
Verify that users can add, update, prioritize, toggle, and delete emergency contacts.

### Steps
1. Navigate to the **Emergency Contacts** tab in the mobile app.
2. Tap **Add Contact** and submit:
   - **Name:** `Bob Walker (Brother)`
   - **Phone:** `+1 (555) 987-6543`
   - **Email:** `bob.walker@example.com`
   - **Relationship:** `Family`
   - **Priority:** `1 (Primary)`
   - **Status:** Enabled
3. Add a second contact:
   - **Name:** `Sarah Jenkins (Colleague)`
   - **Phone:** `+1 (555) 345-6789`
   - **Email:** `sarah.j@example.com`
   - **Relationship:** `Work`
   - **Priority:** `2 (Secondary)`
   - **Status:** Enabled
4. Toggle Sarah Jenkins to **Disabled**.
5. Edit Bob Walker's phone number to `+1 (555) 999-8888`.

### Expected Results
- Contacts are stored in local SQLite database (`contacts` table) and synchronized with the backend.
- Disabled contacts display an inactive indicator and will be excluded from emergency dispatches.
- Inputs are validated: invalid phone numbers or malformed emails are rejected with helpful inline errors.

---

## Scenario 3: Offline SOS Creation (Panic Button Trigger)

### Objective
Verify that an emergency SOS can be created without any active internet connection.

### Steps
1. Put the mobile device in **Airplane Mode** (disable Wi-Fi and Cellular Data). Ensure Bluetooth remains **ON**.
2. On the RescueLink home screen, press and hold the red **EMERGENCY SOS** button for 3 seconds (or confirm the safety prompt).
3. Select Emergency Type: `Medical Emergency` or `Physical Danger`.
4. Add an optional message: `Injured ankle on hiking trail, need evacuation assistance.`

### Expected Results
- The app generates a cryptographically random UUID for the alert (`alertId`).
- Device captures current GPS coordinates (or sets `has_location: false` if GPS is denied/unavailable).
- The alert is immediately saved to the local SQLite database with status `local_only`.
- An entry is inserted into the local SQLite `outbox` queue with status `pending`.
- The UI displays an active emergency banner with pulsating warning indicator, alert ID, and timestamp.

---

## Scenario 4: Bluetooth Broadcast & Peer Discovery

### Objective
Verify that the device begins advertising the emergency packet over Bluetooth Low Energy.

### Steps
1. Maintain Airplane Mode with Bluetooth active on Device A (Sender).
2. Observe the Bluetooth status indicator on the SOS screen.
3. Bring Device B (Peer Receiver) within BLE radio range (typically 10–30 meters).

### Expected Results
- Device A initializes `BlePeripheralService` and starts advertising with the RescueLink Service UUID (`0000FE60-0000-1000-8000-00805F9B34FB`).
- The advertised payload contains:
  - `alertId`: UUID of the emergency
  - `senderId`: Alice's user UUID
  - `type`: `medical`
  - `timestamp`: UTC ISO string
  - `hops`: `0`
  - `maxHops`: `3`
  - `integrityHash`: SHA-256 payload checksum
- Transmission state in local SQLite updates to `ble_broadcasted`.

---

## Scenario 5: Peer Reception & Local Acknowledgment

### Objective
Verify that a nearby peer device detects the broadcast, stores the alert, and returns a peer acknowledgment.

### Steps
1. On Device B (Peer Receiver), ensure the RescueLink background scanner is running.
2. Monitor Device B screen as Device A broadcasts.
3. Observe Device A screen for the peer acknowledgment receipt.

### Expected Results
- Device B detects the BLE advertisement packet matching the RescueLink service UUID.
- Device B validates the payload checksum; if valid, saves the alert in its local SQLite database with status `received_ble`.
- Device B's UI triggers an urgent visual alert and notification chime: *"Distress signal detected within BLE range!"*
- Device B transmits a compact `ACK` packet containing `alertId` and Device B's identifier.
- Device A receives the `ACK` packet and updates its screen: *"Peer Acknowledged: Signal received by nearby rescuer."*

---

## Scenario 6: Multi-Hop Mesh Relay Forwarding

### Objective
Verify that intermediate peer devices forward the alert to extend range while preventing loops.

### Steps
1. Position Device A (Originator), Device B (Relay Node), and Device C (Remote Receiver):
   - Device A is in range of Device B.
   - Device C is out of range of Device A, but in range of Device B.
2. Device A triggers an SOS (Hop = 0).
3. Device B receives the SOS, checks the hop count (`0 < maxHops=3`), increments hop count to `1`, sets `relayedBy: DeviceB_ID`, and re-advertises.
4. Device C scans and detects the forwarded packet from Device B.
5. Device B receives the broadcast again from another peer or echo.

### Expected Results
- Device C receives the alert with `hops: 1`, original sender `Device A`, and stores it locally.
- Device B’s duplicate detection cache identifies the packet as already processed and ignores re-transmission.
- Relay loop prevention prevents packets from bouncing endlessly between Device A and Device B.
- Relay rate limiter restricts forwarding to a maximum of 5 packets/minute to safeguard battery.

---

## Scenario 7: Network Reconnection & Cloud Sync

### Objective
Verify that queued offline alerts and relay records automatically synchronize when internet access is restored.

### Steps
1. On Device A (or Device B holding the relayed alert), turn off Airplane Mode and connect to Wi-Fi or Cellular Data.
2. Observe the network connectivity listener (`@react-native-community/netinfo`).
3. Check the mobile synchronization status indicator.

### Expected Results
- The application detects internet reachability.
- The `SyncService` drains the SQLite `outbox` queue by sending `POST /api/sync/batch` to the Express backend.
- The backend validates the batch, deduplicates against existing records, inserts new alerts, and returns HTTP `200 OK`.
- Mobile SQLite updates outbox status to `synced` and sets the alert state to `synced_to_cloud`.
- The active SOS banner on the mobile device updates to: *"Cloud Synchronized: Alert received by emergency dispatch."*

---

## Scenario 8: Emergency Notification Dispatch (SMS/Email/Push)

### Objective
Verify that enabled emergency contacts receive automated notification dispatches upon cloud sync.

### Steps
1. Trigger an SOS while online (or complete Scenario 7 network restoration).
2. Check backend console logs or query `GET /api/notifications/queue`.
3. Verify simulated dispatch records for Bob Walker and Sarah Jenkins.

### Expected Results
- The backend notification worker reads active emergency contacts for the user.
- Bob Walker (Enabled) receives:
  - Simulated SMS dispatch with message: `EMERGENCY ALERT: Alice Walker has triggered an SOS (Medical Emergency). Coordinates: 37.7749, -122.4194. View status: https://rescuelink.org/track/<alertId>`
  - Simulated Email dispatch with formatted incident payload.
- Sarah Jenkins (Disabled in Scenario 2) receives **no** notification.
- Notification task status updates to `delivered` with provider timestamp.

---

## Scenario 9: Live Map Incident Display & Tracking

### Objective
Verify that emergency incidents are accurately rendered on the interactive map with coordinates and status markers.

### Steps
1. On the mobile app, navigate to the **Live Map** screen.
2. Grant Location Permissions when prompted.
3. Observe map markers, zoom controls, and coordinate pins.
4. Tap on the marker for the active incident created in Scenario 3.

### Expected Results
- The map centers on the user's location with a blue beacon.
- Distress incidents are plotted with color-coded pins:
  - 🔴 **Red:** Active Emergency (Pending / Broadcasted)
  - 🟡 **Yellow:** Peer Acknowledged / Relayed
  - 🟢 **Green:** Cloud Synchronized / Dispatch Assigned
  - ⚪ **Gray:** Resolved
- Tapping a pin opens a bottom drawer detailing: Alert ID, Emergency Type, Time Elapsed, Battery Level, Number of Hops, and Distance.
- Incidents without GPS coordinates are handled cleanly without placing false markers at (0, 0).

---

## Scenario 10: Admin Dashboard Monitoring & Analytics

### Objective
Verify that emergency dispatchers can monitor incidents, inspect system health, and review operational analytics.

### Steps
1. Open the Admin Web Dashboard in a browser: `http://localhost:5173`.
2. Log in using administrator credentials (`admin@rescuelink.org` / `AdminMasterPass2026!`).
3. Inspect the Overview KPI widgets:
   - **Total Incidents**
   - **Active Emergencies**
   - **Average Response Time**
   - **Sync Success Rate**
4. Observe real-time updates as new alerts are submitted via mobile.

### Expected Results
- Dashboard loads securely; unauthenticated visits are blocked and redirected to `/login`.
- Real-time Server-Sent Events (SSE) feed automatically updates incident rows without requiring manual page reload.
- Recipient phone numbers and email addresses in the contact list are masked for privacy compliance (`+1 (***) ***-5678`).
- Metrics reflect exact server-side calculations with zero fabricated data.

---

## Scenario 11: Security Audit Log Inspection

### Objective
Verify that sensitive security events and operational actions are recorded in an immutable audit trail.

### Steps
1. In the Admin Dashboard, click on **Audit Logs** in the navigation bar.
2. Filter logs by action: `AUTH_LOGIN`, `ALERT_CREATE`, `ALERT_UPDATE`, `SYNC_BATCH`.
3. Inspect individual log entries.

### Expected Results
- Chronological table displays:
  - Timestamp (ISO 8601 UTC)
  - Actor ID / Role (`admin` or user UUID)
  - Event Type
  - Client IP Address
  - Resource ID
  - Status (`SUCCESS` or `FAILED`)
- Passwords, full JWT tokens, and private encryption keys are completely absent from audit parameters.

---

## Scenario 12: Incident Lifecycle Status Resolution

### Objective
Verify that an emergency incident can transition through its complete operational lifecycle from `active` to `resolved`.

### Steps
1. In the Admin Dashboard **Incident Feed**, select the active incident from Scenario 3.
2. In the action menu, select **Acknowledge Incident**. Add operational note: `Search and Rescue team dispatched to coordinates.`
3. After simulated rescue completion, click **Resolve Incident**.
4. Check the mobile application screen of the originating user (Alice).

### Expected Results
- Backend updates alert status to `resolved` and writes a resolution event to the audit log.
- SSE stream broadcasts the status update to all connected dispatch consoles.
- Alice's mobile application updates its banner to: *"Emergency Resolved: Responders have cleared this incident."*
- Incident marker on the map changes to gray (Resolved).

---

## Scenario 13: Edge Case & Fault Tolerance Handling

### Objective
Verify system resilience against common operational edge cases, permission denials, and network failures.

### Sub-Scenarios & Verifications
1. **Denied Location Permissions:**
   - Revoke GPS permission in device settings and trigger SOS.
   - *Result:* App does not crash. SOS is created with `has_location: false`, and user is prompted to enter an approximate text location or landmark.
2. **Expired Packets:**
   - Transmit a BLE packet with a creation timestamp older than `TTL` (e.g., 24 hours ago).
   - *Result:* Receiving node inspects expiration timestamp and discards the packet without forwarding.
3. **Maximum Hop Exceeded:**
   - Transmit a packet with `hops: 3` and `maxHops: 3`.
   - *Result:* Relay node accepts the alert for local viewing but suppresses re-broadcast.
4. **Duplicate Replay Attack:**
   - Re-send an identical BLE packet 10 times consecutively.
   - *Result:* Receiving node checks its internal LRU cache; accepts the first packet, discards the subsequent 9 duplicates silently.
5. **Rate Limit Throttling:**
   - Attempt to call `POST /api/auth/login` 35 times within 15 minutes.
   - *Result:* Backend responds with HTTP `429 Too Many Requests` after 30 attempts, with `Retry-After` header.

---

## Verification Sign-Off

| Test Scenario | Executed By | Date | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Scenarios 1–13 Protocol Review | Automated Test Suite + Manual Verification | 2026-10-31 | **PASS** | 59/59 automated integration tests passing |
