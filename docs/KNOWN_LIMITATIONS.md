# RescueLink — Known Limitations, Assumptions & Technical Constraints

**Document:** System Boundaries, Hardware Prerequisites & Technical Constraints  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0 (Production Hardening)  
**Date:** October 2026  

---

## 1. Life-Safety & Regulatory Disclaimer

> [!CAUTION]
> **NOT A CERTIFIED PUBLIC SAFETY ANSWERING POINT (PSAP) OR E911 REPLACEMENT**  
> RescueLink is an academic engineering and open-research peer-to-peer mesh alerting utility designed for off-grid, disaster-zone, or backcountry scenarios where commercial cellular infrastructure has failed.
> - It is **NOT** certified under FCC E911, NENA NG911, or European ETSI EN 303 standards.
> - In any jurisdiction where standard emergency telephone services (such as 911, 112, or 999) or satellite SOS are functional, users must always attempt official emergency channels first.

---

## 2. Bluetooth Low Energy (BLE) Radio Constraints

### 2.1 Radio Range & Environmental Obstacles
- **Line-of-Sight Range:** Standard smartphone BLE 4.2/5.0 transceivers achieve an effective radio radius of **10 to 30 meters** in open outdoor environments.
- **Physical Attenuation:** Dense reinforced concrete walls, metal structural beams, heavy wet foliage, and subterranean earth drastically degrade 2.4 GHz radio propagation. In collapsed structural rubble, range may be restricted to under 5 meters.

### 2.2 Payload Size & Single-Packet MTU Limit
- GATT characteristic transfers in standard mobile BLE stacks support a practical Maximum Transmission Unit (MTU) of up to **512 bytes**.
- RescueLink's JSON wire protocol is aggressively minified to fit within this 512-byte limit. Large attachments (such as high-resolution survivor photos, live video, or uncompressed audio voice notes) **cannot** be transmitted over the current single-packet BLE mesh without multi-packet fragmentation and reassembly protocols.

### 2.3 Mobile OS Background Execution Policies
- **Android Background Optimization (Doze Mode):** Android 10+ aggressively throttles background BLE scanning intervals to conserve battery. Continuous mesh listening requires keeping the app in the foreground or granting explicit Foreground Service permissions (`FOREGROUND_SERVICE_CONNECTED_DEVICE`).
- **iOS CoreBluetooth Restrictions:** Apple iOS severely restricts background BLE advertising and scanning. In background mode, iOS does not advertise custom service UUIDs in the overflow area in the same manner as Android, and discovery intervals are lengthened. Reliable multi-hop relay requires active foreground execution on iOS devices.

### 2.4 Native Binary Requirements (Expo Go Limitation)
- Standard **Expo Go** does not include native C++/Java binary bindings for `react-native-ble-plx` and `react-native-ble-peripheral`.
- Running real Bluetooth Low Energy peer discovery requires building an **Expo Development Client** (`npx expo run:android`) or compiling a standalone `.apk`.

---

## 3. Positioning & Hardware Sensor Assumptions

### 3.1 GPS Satellite Acquisition (TTFF)
- GPS positioning relies on direct line-of-sight to orbiting GNSS satellites. In subterranean basements, underground subway tunnels, or collapsed concrete rubble, Time-To-First-Fix (TTFF) may fail or suffer multi-path errors.
- **System Mitigation:** RescueLink allows users to trigger unmapped SOS alerts or enter manual descriptions when GPS hardware cannot acquire a lock.

---

## 4. Notification Service Delivery Fallbacks

- **Simulated Provider Execution:** In the default development and testing environment, SMS and Email notifications are processed through local simulation providers (`data/notifications.json`) with simulated delivery transaction IDs.
- **Production Carrier Compliance:** Live production delivery requires external SaaS credentials with carrier-approved registration:
  - SMS: Twilio / AWS SNS (Requires A2P 10DLC campaign registration in North America).
  - Email: SendGrid / Mailgun / AWS SES (Requires verified SPF, DKIM, and DMARC DNS records).

---

## 5. Backend Storage & Horizontal Scaling Bounds

- **Atomic File Store:** The current backend utilizes atomic asynchronous JSON document stores (`users.json`, `alerts.json`, `contacts.json`, `notifications.json`, `audit_logs.json`) protected by in-memory Promise mutexes.
- **Throughput Limits:** This lightweight, zero-dependency storage model supports up to ~250–500 concurrent operations per second on high-speed NVMe SSD storage.
- **Single-Node SSE:** Real-time Server-Sent Events (SSE) broadcasting is managed in-memory per Node.js process. Scaling beyond a single server instance requires an external Redis Pub/Sub cluster to distribute broadcast events across multiple worker nodes.
