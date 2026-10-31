# RescueLink — Project Evidence & Screenshot Capture Checklist

**Document:** Demonstration Screenshot Checklist, Capture Guidelines & Evidence Registry  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0 (Step 15 Final Evaluation)  
**Date:** October 2026  

---

## 1. Evidence Collection Policy & Integrity Statement

> [!IMPORTANT]
> **Zero Fabrication Policy:**  
> In compliance with strict engineering and academic ethics, **no synthetic or fake screenshots have been fabricated**. This document provides the official registry of demonstration screenshots required for final project evaluation, accompanied by the exact capture protocols, expected on-screen states, and designated filenames.
>
> When executing the demonstration on physical Android devices and a workstation browser, capture each screen following the procedures below and place the resulting image files directly into this directory (`docs/evidence/`).

---

## 2. Screenshot Master Checklist

| # | Screen / State | Target Filename | Platform | Primary Visual Verification Elements | Capture Status |
|---|---|---|---|---|---|
| **01** | **Home / Readiness Dashboard** | `01_home_screen.png` | Mobile (Android) | Status cards for Bluetooth (Active), Internet Connectivity (Online/Offline), Location (GPS Locked), and recent activity list. | 📋 Ready for Capture |
| **02** | **Send SOS Composer** | `02_send_sos_screen.png` | Mobile (Android) | High-contrast emergency category selector, details input box, GPS coordinate readout, and large red "SEND SOS" button. | 📋 Ready for Capture |
| **03** | **SOS Activation & Confirmation** | `03_sos_confirmation_modal.png` | Mobile (Android) | Confirmation modal displaying 3-second safety countdown, cancellation button, and instant broadcast override. | 📋 Ready for Capture |
| **04** | **Nearby Bluetooth Devices / Scanner**| `04_nearby_bluetooth_devices.png`| Mobile (Android) | Active BLE radar/scanner displaying discovered peer emergency beacons with RSSI signal bars and node IDs. | 📋 Ready for Capture |
| **05** | **Received Peer SOS & ACK** | `05_received_sos_alert.png` | Mobile (Android) | Discovered peer incident card displaying survivor details, medical type, distance/RSSI, and "Send ACK" button. | 📋 Ready for Capture |
| **06** | **Emergency Alert History Ledger** | `06_alert_history_ledger.png` | Mobile (Android) | SQLite-backed incident history showing status badges: Local (Saved), Broadcasted (BLE), Acknowledged (ACK), and Synced. | 📋 Ready for Capture |
| **07** | **Offline Mode Operation** | `07_offline_mode_indicator.png`| Mobile (Android) | Airplane mode enabled; status banner displaying *"Offline — Local SQLite Persistence & BLE Mesh Active"*. | 📋 Ready for Capture |
| **08** | **Cloud Synchronization & Outbox** | `08_cloud_sync_status.png` | Mobile (Android) | Cloud sync dashboard card showing outbox item count, pending sync queue, and "Sync Now" action upon reconnecting. | 📋 Ready for Capture |
| **09** | **Emergency Contacts Manager** | `09_emergency_contacts_manager.png`| Mobile (Android) | Saved trusted contacts list with Priority 1–5 badges, active/disabled toggles, and E.164 phone numbers. | 📋 Ready for Capture |
| **10** | **Notification History & Audit Log** | `10_notification_history_log.png` | Mobile (Android) | Delivery log displaying multi-channel dispatch attempts (Email/SMS) with masked recipient privacy protection. | 📋 Ready for Capture |
| **11** | **Live Emergency Map** | `11_live_emergency_map.png` | Mobile (Android) | Interactive GPS map with color-coded incident markers, user location pin, cluster counts, and bottom incident drawer. | 📋 Ready for Capture |
| **12** | **Admin Dashboard Overview** | `12_admin_dashboard_overview.png` | Web (Vite/React) | Operations center KPI metrics: Total Incidents, Active Emergencies, Resolved Incidents, Mesh Efficiency, and Category Charts. | 📋 Ready for Capture |
| **13** | **Admin Incident Management** | `13_admin_incident_triage.png` | Web (Vite/React) | Live incident triage grid with search, emergency category filters, lifecycle transition actions, and survivor telemetry. | 📋 Ready for Capture |
| **14** | **Mesh Telemetry & Audit Logs** | `14_admin_mesh_analytics.png` | Web (Vite/React) | BLE multi-hop distribution charts, active forwarder node analytics, and immutable administrative security audit ledger. | 📋 Ready for Capture |

---

## 3. Step-by-Step Screenshot Capture Procedures

### Mobile Client Screenshots (Screenshots 01–11)
- **Environment:** Physical Android device running compiled debug APK (`npx expo run:android`) or Expo Development Client.
- **Capture Shortcut:** Press **Power + Volume Down** simultaneously on Android, or execute:
  ```bash
  adb exec-out screencap -p > docs/evidence/<filename>.png
  ```

#### Detailed Capture Scenarios:
1. **`01_home_screen.png`:**
   - Launch app. Ensure Bluetooth is ON. Capture the main screen showing subsystem health indicators.
2. **`02_send_sos_screen.png`:**
   - Navigate to "Send SOS" tab. Select "Medical Emergency", enter "Trapped in room 204", verify coordinates appear.
3. **`03_sos_confirmation_modal.png`:**
   - Tap "SEND SOS". Capture during the 3-second visual countdown modal.
4. **`04_nearby_bluetooth_devices.png`:**
   - On Device B, open "Nearby Devices" tab and tap "Scan for SOS Signals". Capture while scanning animation is active.
5. **`05_received_sos_alert.png`:**
   - When Device A's beacon is discovered by Device B, capture the incident card showing RSSI and "Send ACK" button.
6. **`06_alert_history_ledger.png`:**
   - Open "History" tab. Ensure at least two alerts (one local, one received via BLE) are visible with their status badges.
7. **`07_offline_mode_indicator.png`:**
   - Turn on Airplane Mode. Return to the Home screen and capture the offline status indicator card.
8. **`08_cloud_sync_status.png`:**
   - Turn Airplane Mode OFF. Capture the Home screen when NetInfo transitions back to "Online" and shows outbox status.
9. **`09_emergency_contacts_manager.png`:**
   - Navigate to "Contacts" tab. Capture list with two test contacts (e.g. "Dr. Test Responder" - Priority 1).
10. **`10_notification_history_log.png`:**
    - Navigate to "Notification History" screen. Capture showing masked email/phone and "sent" status badges.
11. **`11_live_emergency_map.png`:**
    - Navigate to "Live Map" tab. Capture interactive map with at least one emergency marker and incident bottom sheet.

---

### Admin Dashboard Screenshots (Screenshots 12–14)
- **Environment:** Web browser (Google Chrome / Edge) connected to `http://localhost:5173`.
- **Capture Shortcut:** Use browser DevTools (Ctrl+Shift+P $\to$ "Capture full size screenshot") or Windows Snipping Tool (Win+Shift+S).

#### Detailed Capture Scenarios:
12. **`12_admin_dashboard_overview.png`:**
    - Log in to Admin Dashboard as `admin@rescuelink.org`. Capture Overview screen with KPI cards and charts.
13. **`13_admin_incident_triage.png`:**
    - Click "Incidents" in the sidebar. Capture table showing emergency records, status badges, and triage buttons.
14. **`14_admin_mesh_analytics.png`:**
    - Click "Mesh Relay" or "Audit Logs" in the sidebar. Capture relay hop distributions and administrative action log.
