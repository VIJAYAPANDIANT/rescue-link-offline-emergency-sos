# RescueLink — Project Screenshots & Visual Evidence Directory

**Directory Purpose:** Official repository for captured mobile and web interface screenshots.  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Document Reference:** [`docs/evidence/SCREENSHOT_CHECKLIST.md`](file:///c:/Offline%20Emergency%20SOS/docs/evidence/SCREENSHOT_CHECKLIST.md)  

---

## 1. Zero-Fabrication Policy

In adherence to strict open-source and academic engineering standards, **no synthetic or fake screenshots are pre-packaged**. 

This directory is designated to receive real screenshots captured directly from physical Android devices and authenticated workstation browsers during evaluation demonstrations.

---

## 2. Screenshot Checklist & Expected Files

When conducting a live demonstration or physical hardware test, capture each screen following the instructions below and save the files with these exact names:

| Filename | Screen Description | Source Platform |
|---|---|---|
| `01_home_screen.png` | Home readiness dashboard showing Bluetooth, Sync, and Location status | Mobile (Android) |
| `02_send_sos_screen.png` | Emergency composer with category selection and GPS coordinates | Mobile (Android) |
| `03_sos_confirmation_modal.png` | 3-second safety cancellation countdown dialog | Mobile (Android) |
| `04_nearby_bluetooth_devices.png` | BLE radar scanning for nearby peer emergency signals | Mobile (Android) |
| `05_received_sos_alert.png` | Discovered peer incident card with RSSI signal and "Send ACK" | Mobile (Android) |
| `06_alert_history_ledger.png` | SQLite incident history showing Local, Broadcasted, ACK, Synced badges | Mobile (Android) |
| `07_offline_mode_indicator.png` | Airplane mode enabled; offline persistence active indicator | Mobile (Android) |
| `08_cloud_sync_status.png` | NetInfo reconnection and outbox queue sync flushing | Mobile (Android) |
| `09_emergency_contacts_manager.png`| Saved emergency contacts with Priority 1–5 badges | Mobile (Android) |
| `10_notification_history_log.png` | Multi-channel dispatch log with masked recipient privacy protection | Mobile (Android) |
| `11_live_emergency_map.png` | Interactive map with color-coded incident markers and incident drawer | Mobile (Android) |
| `12_admin_dashboard_overview.png` | Web Operations Center KPI metrics, category charts, and stats | Web (Admin) |
| `13_admin_incident_triage.png` | Incident management grid with lifecycle transition actions | Web (Admin) |
| `14_admin_mesh_analytics.png` | Multi-hop distribution charts and administrative audit log | Web (Admin) |

---

## 3. How to Capture Screenshots on Android

### Method A: Hardware Key Combination
On the physical Android handset, press **Power + Volume Down** simultaneously. The image will be saved to your device's `Pictures/Screenshots/` folder.

### Method B: ADB Command Line
With the device connected via USB with USB Debugging enabled:
```bash
adb exec-out screencap -p > docs/screenshots/01_home_screen.png
```

---

## 4. Live Demonstration Video Placeholder

- **Video Demonstration:** *Available upon evaluation recording*
- **Demo Script:** [`docs/PROJECT_DEMO_SCRIPT.md`](file:///c:/Offline%20Emergency%20SOS/docs/PROJECT_DEMO_SCRIPT.md) (Contains both the 5-minute quick script and 10-minute deep-dive script).
