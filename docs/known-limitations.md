# RescueLink — Known Limitations, Assumptions & Technical Constraints

**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Document:** Technical Boundaries & Hardware Prerequisites  
**Version:** 1.0.0 (Step 12 Production Hardening)  

---

## 1. Life-Safety & Regulatory Disclaimer

> [!CAUTION]
> **NOT A CERTIFIED PUBLIC SAFETY ANSWERING POINT (PSAP) OR E911 REPLACEMENT**  
> RescueLink is an experimental and community-assisted peer-to-peer mesh alerting utility designed for off-grid, disaster-zone, or backcountry scenarios where cellular coverage is absent. It is **not** certified under FCC E911, NENA NG911, or ETSI EN 303 standards. In any jurisdiction where standard emergency telephone services (such as 911, 112, or 999) or satellite SOS are functional, users must always attempt official emergency channels first.

---

## 2. Bluetooth Low Energy (BLE) Radio Constraints

### A. Radio Range & Environmental Obstacles
- **Line-of-Sight Range:** 10–30 meters under typical outdoor terrain with standard smartphone BLE radios.
- **Physical Attenuation:** Dense concrete walls, metal structures, heavy foliage, and earth drastically degrade radio propagation. In sub-surface environments (e.g., collapsed structures, underground basements), range may drop to under 5 meters.

### B. Payload Size & MTU Bounds
- Standard Bluetooth LE 4.2 advertisement packets have an advertisement data limit of 31 bytes. Extended Advertising (Bluetooth 5.0+) supports larger frames, but legacy backward compatibility restricts initial broadcast payload structures.
- GATT connection characteristic transfers support an effective Maximum Transmission Unit (MTU) of up to 512 bytes. RescueLink's JSON wire protocol is aggressively minified and serialized to guarantee single-packet fit within 512 bytes. Attachments (such as photos or voice audio) cannot be transmitted over BLE mesh without custom binary chunking and fragment reassembly.

### C. Mobile OS Background Execution Policies
- **Android Background Restrictions:** Android 10+ imposes background scanning throttles and battery optimization ("Doze" mode). For continuous peer mesh listening, the app requires foreground service notification status (`FOREGROUND_SERVICE_CONNECTED_DEVICE`).
- **iOS CoreBluetooth Restrictions:** iOS aggressively throttles background BLE advertising and scanning. In background mode, iOS does not advertise service UUIDs in the overflow area in the same manner as Android, and scanning intervals are lengthened to conserve battery. Reliable multi-hop relay requires foreground execution or active screen usage on iOS devices.

### D. Expo Go vs. Development Client
- Generic **Expo Go** does not include native BLE binary bindings (`react-native-ble-plx`, `react-native-ble-peripheral`). Real BLE broadcasting and scanning requires an **Expo Development Client** (`npx expo run:android`) or a standalone compiled APK.

---

## 3. Notification Service Fallbacks

- **Simulated Provider Execution:** In the current reference implementation, SMS, Email, and Push notifications are logged and persisted in a persistent queue (`data/notifications.json`) with simulated delivery responses.
- **Live Dispatch Requirement:** Production deployment requires live API keys and active carrier compliance for external SaaS providers:
  - SMS: Twilio / AWS SNS / MessageBird (requires 10DLC registration in the US).
  - Email: SendGrid / Mailgun / AWS SES (requires verified SPF/DKIM DNS records).
  - Push: Expo Push Notification Service or Firebase Cloud Messaging (FCM).

---

## 4. Backend Storage & Concurrency Architecture

- **Atomic File Store:** The current backend utilizes atomic asynchronous JSON document stores (`users.json`, `alerts.json`, `contacts.json`, `notifications.json`, `audit_logs.json`) guarded by in-process file write mutexes.
- **Throughput Bounds:** This lightweight, zero-dependency storage model supports up to ~250–500 concurrent operations per second on standard SSD storage. For enterprise emergency response deployments handling tens of thousands of concurrent incident streams, the storage driver should be migrated to PostgreSQL, CockroachDB, or MongoDB.
- **Single-Server Scope:** Real-time Server-Sent Events (SSE) and in-memory rate limiting operate per single Node.js process instance. Multi-instance cluster scaling requires a shared Redis or Redis-compatible Pub/Sub layer for distributed rate limiting and broadcast fan-out.

---

## 5. Hardware & System Prerequisites

### Mobile Client Devices
- **Operating System:** Android 8.0 (API 26) or higher / iOS 14.0 or higher.
- **Hardware:** Bluetooth 4.2 or higher with BLE Peripheral Mode support (Bluetooth Low Energy Central + Peripheral role capable).
- **Sensors:** Hardware GPS chip for automatic coordinate capture.

### Dispatcher / Admin Workstation
- **Display:** Responsive web browser (Google Chrome 110+, Firefox 115+, Safari 16+, Edge 110+).
- **Network:** Stable broadband or cellular internet connection to receive real-time SSE incident streams.

### Backend Infrastructure
- **Compute:** 1 vCPU, 512 MB RAM minimum (Node.js 18+ or 20+ LTS).
- **Disk:** 1 GB+ persistent SSD volume for JSON stores and audit logs.
