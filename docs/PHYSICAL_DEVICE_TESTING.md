# RescueLink — Physical Device Testing & Field Verification Protocol

**Document:** Physical Hardware Test Protocols, Multi-Device Scenarios & Edge Validation  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0-RC1 (Step 17 Android Release Verification)  
**Date:** November 2026  
**Target Environments:** Physical Android Handsets (BLE 4.2+ / Android 8.0–14+)  

---

## 1. Testing Domain Hierarchy: Test Distinction Matrix

To ensure absolute academic and engineering integrity, RescueLink strictly distinguishes between the three tiers of verification:

```
+-----------------------------------------------------------------------------------+
|                           TESTING VERIFICATION TIERS                              |
+---------------------+-------------------------------+-----------------------------+
| 1. AUTOMATED TESTS  | 2. EMULATOR TESTS             | 3. REAL HARDWARE TESTS      |
+---------------------+-------------------------------+-----------------------------+
| • Unit & Integration| • UI Layout & Navigation      | • Physical BLE RF Over-Air  |
| • 62/62 Passed      | • Software Mock BLE Engine    | • Dual-Role GATT Transceiver|
| • In-memory SQLite  | • Single-Instance Networking  | • Hardware GPS Cold Fix     |
| • HTTP Mock Clients | • Loopback (10.0.2.2:5000)    | • Multi-Device Mesh Relay   |
| • Simulated Timing  | • Simulated Location Engine   | • Airplane Mode Off-Grid    |
+---------------------+-------------------------------+-----------------------------+
```

| Verification Tier | Execution Environment | What It Confirms | Limitations |
|---|---|---|---|
| **Tier 1: Automated Test Suite** | Node.js Test Runner (`npm test --prefix server`) | Protocol serialization, MTU enforcement, SQLite schemas, exponential backoffs, auth, and state machines. | Cannot emit physical RF electromagnetic signals or measure actual battery draw. |
| **Tier 2: Android Emulator** | Android Studio Virtual Device (AVD) | UI rendering, screen transitions, dark/light themes, database migrations, and basic HTTP loopback. | Android emulators do not have physical BLE radios to communicate over-the-air with other nearby emulators. |
| **Tier 3: Physical Hardware** | 2 to 3 Physical Android Smartphones | True 2.4 GHz radio propagation, dual-role GATT central/peripheral switching, battery survival, GPS fix under canopy, and real carrier network cutover. | Requires physical handsets with developer options enabled. |

---

## 2. Prerequisites for Physical Field Verification

Before initiating physical device tests:
1. **Device Setup:**
   - **Device A (Survivor / Sender):** Physical Android phone running Android 8.0+.
   - **Device B (Civilian / Relay Node):** Physical Android phone running Android 8.0+.
   - **Device C (Responder / Gateway):** Optional 3rd handset to test 2-hop mesh relay.
2. **Installation:**
   - Sideload `RescueLink-preview.apk` onto all test handsets following [`ANDROID_INSTALLATION_GUIDE.md`](file:///c:/Offline%20Emergency%20SOS/docs/ANDROID_INSTALLATION_GUIDE.md).
3. **Backend Server Setup (For Sync Testing):**
   - Start the Express cloud backend on your workstation:
     ```powershell
     cd "c:\Offline Emergency SOS\server"
     npm run dev
     ```
   - Connect phone and computer to the same Wi-Fi network (or configure the phone's mobile hotspot).
   - In RescueLink **Profile $\to$ Gateway Settings**, set the IP to your workstation (e.g., `http://192.168.1.105:5000/api`) and verify connection.

---

## 3. Physical Device Verification Test Cases

### Test Case 1: App Launch & Cold Start
- **Objective:** Verify that the application launches smoothly from a cold state on physical hardware without crashing or unhandled promise rejections.
- **Preconditions:** RescueLink is installed; app is not running in background.
- **Execution Steps:**
  1. Tap the RescueLink app icon on the home screen / app drawer.
  2. Observe splash screen display and transition to Home screen.
  3. Verify status badges load: `Bluetooth: Active`, `Sync Engine: Idle`.
- **Expected Outcome:**
  - Splash screen displays smoothly for 1–2 seconds.
  - SQLite database initialized (`expo-sqlite` WAL mode).
  - No crash, no red-box errors, UI remains responsive at 60 FPS.
- **Pass/Fail Criteria:** Pass if Home screen renders completely within 3 seconds of icon tap.

---

### Test Case 2: User Registration & Session Persistence
- **Objective:** Verify that an emergency responder can create an account and authenticate offline/online.
- **Execution Steps:**
  1. From Home screen, tap **Profile $\to$ Register**.
  2. Enter:
     - Name: `Jane Doe`
     - Email: `jane.doe@example.com`
     - Password: `Password@123`
  3. Tap **Create Account**.
  4. Force close the app completely (swipe away from Android Recent Apps switcher).
  5. Relaunch RescueLink.
- **Expected Outcome:**
  - Account registered; JWT authentication token stored in local persistence.
  - On relaunch, user session is automatically restored without requiring re-login.
- **Pass/Fail Criteria:** Pass if user profile displays name, role, and node ID after cold restart.

---

### Test Case 3: Emergency SOS Creation & Offline Persistence
- **Objective:** Verify that triggering an emergency SOS works completely offline and commits immediately to local SQLite storage.
- **Preconditions:** Enable **Airplane Mode** on the phone (Wi-Fi and cellular disabled; Bluetooth kept ON).
- **Execution Steps:**
  1. On the Home screen, tap the prominent red **SOS** button.
  2. Select category: **Medical Emergency**.
  3. Observe the 3-second cancellation countdown dialog (verify cancellation button functions).
  4. Allow the countdown to complete.
  5. Check **Emergency History** screen.
- **Expected Outcome:**
  - Alert created with unique UUID.
  - Delivery status: `broadcasted` (or `pending`).
  - Sync status: `pending_sync` (Orange badge).
  - Alert immediately appears in **Emergency History** with full timestamp and category.
- **Pass/Fail Criteria:** Pass if alert is saved locally in SQLite with zero network access.

---

### Test Case 4: Process Kill & Cold Restart Persistence
- **Objective:** Verify SQLite database integrity and guarantee zero alert data loss upon sudden app termination or battery exhaustion.
- **Preconditions:** SOS alert created in Test Case 3 is in `pending_sync` status.
- **Execution Steps:**
  1. Force stop RescueLink via Android **Settings $\to$ Apps $\to$ RescueLink $\to$ Force Stop**.
  2. Power cycle the device (reboot phone) or simply relaunch RescueLink.
  3. Open **Emergency History**.
- **Expected Outcome:**
  - All previously created SOS alerts remain intact with exact timestamps, notes, and states.
  - SQLite WAL journal recovers automatically without corrupting tables.
- **Pass/Fail Criteria:** Pass if 100% of locally saved alerts are retained after reboot.

---

### Test Case 5: Two-Device Direct Over-the-Air BLE SOS Exchange
- **Objective:** Verify direct peer-to-peer distress beaconing and reception between two physical handsets without internet or cellular networks.
- **Hardware Setup:** Device A (Phone 1) and Device B (Phone 2) placed 2–10 meters apart.
- **Preconditions:**
  - Airplane mode ON on both devices.
  - Bluetooth toggled ON on both devices.
- **Execution Steps:**
  1. **Device A:** Trigger an SOS alert ("Accident - North Ridge Trailhead").
  2. Device A starts BLE peripheral advertising on UUID `0000FEF0-0000-1000-8000-00805F9B34FB`.
  3. **Device B:** Open **Nearby Devices** screen and tap **Scan for SOS Signals**.
  4. Observe Device B's scan list for incoming distress packets.
- **Expected Outcome:**
  - Within 5–15 seconds, Device B detects Device A's emergency beacon.
  - Device B displays:
    - Alert ID and Sender Name ("Jane Doe").
    - Category: "Accident".
    - Signal Strength (RSSI in dBm) and relative proximity.
  - Device B automatically saves the received alert into its local SQLite database with `deliveryStatus: 'received'`.
  - Device B transmits a GATT acknowledgment back to Device A, causing Device A's ACK status to turn green (`acknowledged`).
- **Pass/Fail Criteria:** Pass if distress beacon is discovered over RF and logged on Device B within 30 seconds.

---

### Test Case 6: Three-Device Multi-Hop Mesh Relay (Epidemic Routing)
- **Objective:** Verify multi-device hop forwarding across disconnected physical devices.
- **Hardware Setup:**
  - Device A (Survivor): Located at Point 1.
  - Device B (Civilian Relay): Located at Point 2 (~25 meters from A).
  - Device C (Incident Commander / Gateway): Located at Point 3 (~50 meters from A, out of direct BLE range of A, but in range of B).
- **Execution Steps:**
  1. Device A creates and broadcasts an SOS alert (`hopCount: 0`, `maxHops: 3`).
  2. Device B discovers and stores the alert.
  3. Device B's Relay Engine verifies:
     - Message integrity checksum is valid.
     - `hopCount (0) < maxHops (3)`.
     - Message is not expired (< 24 hours old).
  4. Device B forwards the alert over BLE with updated routing header: `hopCount: 1`, `forwarderId: NODE_B`.
  5. Device C scans and receives the forwarded alert.
- **Expected Outcome:**
  - Device C receives the alert even though it was physically impossible to reach Device A directly.
  - Device C's database records:
    - Original Sender: Jane Doe (Device A).
    - Forwarded By: Relay Node B.
    - Hop Count: 1.
- **Pass/Fail Criteria:** Pass if Device C receives survivor's alert with hop count incremented and survivor metadata intact.

---

### Test Case 7: Opportunistic Cloud Synchronization Upon Internet Recovery
- **Objective:** Verify that queued alerts automatically flush to the central cloud backend when an internet connection becomes available.
- **Preconditions:** Device B or Device C has pending alerts in its local sync queue (`pending_sync`). Device is currently in Airplane Mode.
- **Execution Steps:**
  1. Turn OFF Airplane Mode on the device and connect to the local Wi-Fi network (where the Express backend is running).
  2. Observe the RescueLink status banner on the Home screen.
  3. Within 15 seconds, NetInfo detects the active network connection and triggers the background Sync Engine.
  4. Open the Web Admin Dashboard (`http://localhost:5173`) on the workstation.
- **Expected Outcome:**
  - On the mobile phone: Sync badge transitions from `Syncing...` to `Synced` (Green).
  - On the Admin Dashboard: The emergency incident appears in the live incident feed and on the Emergency Map in real time!
  - Both original survivor details and relay path attribution (`hopCount: 1`, `relayedBy: NODE_B`) are correctly displayed on the admin console.
- **Pass/Fail Criteria:** Pass if all pending offline alerts are successfully committed to the central backend without duplicate rows.

---

### Test Case 8: Runtime Permission Denial & Graceful Degradation
- **Objective:** Verify that denying permissions does not crash the application and provides clear guidance to the user.
- **Execution Steps:**
  1. In Android **Settings $\to$ Apps $\to$ RescueLink $\to$ Permissions**, revoke **Location** permission.
  2. Open RescueLink and create an SOS alert.
- **Expected Outcome:**
  - The app does NOT crash.
  - The alert is created successfully with location marked as: `Omitted by sender or unavailable`.
  - The alert is still broadcastable over BLE and storable in SQLite.
- **Pass/Fail Criteria:** Pass if core SOS functionality operates without crashing when location is withheld.

---

## 4. Physical Testing Evidence Collection Checklist

When conducting evaluation sessions for university examiners or project review committees, collect and document the following physical artifacts:

- [ ] **Dual-Device Photograph:** Photo showing Phone A with red "SOS Broadcast Active" screen and Phone B showing "Distress Signal Detected" screen side-by-side with Airplane Mode active.
- [ ] **Admin Dashboard Screenshot:** Screenshot of the web dashboard showing the incident arriving with relay hop telemetry after the gateway phone connects to Wi-Fi.
- [ ] **ADB Logcat Capture:** Terminal text log showing real GATT service discovery events:
  ```bash
  adb logcat -s RescueLink:V BleManager:V ReactNativeJS:V
  ```
- [ ] **Battery Consumption Log:** Android battery usage statistics demonstrating less than 2% battery drain during 30 minutes of background BLE listening.
