# RescueLink — Release Notes (v1.0.0-RC1)

**Release:** RescueLink 1.0.0-RC1 (Release Candidate 1)  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Release Date:** November 2026  
**Target Environments:** Android 8.0+ (APK/AAB), Node.js v18–v24 LTS (Backend), React 18 / Vite 6 (Admin Web)  
**Test Suite Verdict:** ✅ **62 / 62 Tests Passing (100% Pass Rate)**  

---

## 1. Release Highlights & System Overview

RescueLink is an offline-first, disaster-resilient mobile emergency response system that transforms ordinary civilian smartphones into peer-to-peer life-saving transceivers during catastrophic cellular and electrical grid collapse.

Version **1.0.0-RC1** marks the culmination of Steps 1 through 16, delivering an end-to-end verified pipeline from offline mobile beaconing to multi-hop mesh forwarding, opportunistic cloud synchronization, automated contact notifications, and web-based operations command oversight.

---

## 2. Key Capabilities Delivered

### 📱 Mobile Edge & Offline Persistence
- **One-Touch Emergency SOS:** Instant activation with a 3-second visual cancellation countdown dialog to prevent accidental triggers.
- **Incident Categorization:** Medical Emergency, Accident, Personal Safety, Fire, Other, and dedicated Test / Drill simulation mode.
- **SQLite Write-Ahead Logging:** `expo-sqlite` (v15.1.4) configured with `PRAGMA journal_mode = WAL` and sequential schema migrations (v1 to v4), guaranteeing zero data loss upon battery death or app termination.
- **State Decoupling:** Independent lifecycle tracking across `deliveryStatus` (`pending`, `broadcasted`, `received`), `ackStatus` (`unacknowledged`, `acknowledged`), and `syncStatus` (`pending_sync`, `synced`).
- **High-Contrast Design System:** WCAG AA compliant contrast with dynamic Light & Dark themes (`ThemeContext.js`).

### 📡 Wireless BLE Protocol & Epidemic Mesh Relay
- **Dual-Mode GATT Architecture:** Operates concurrently as GATT Peripheral (server/broadcaster) and GATT Central (scanner/client) over custom 128-bit service UUIDs (`0000FEF0-...`).
- **Protocol Version 2:** Compact JSON wire format Base64-encoded to fit comfortably within single-packet **512-byte MTU** characteristic frames (~348 bytes).
- **Tamper-Evident Content Integrity:** 32-bit FNV-1a checksum ($OffsetBasis = 2166136261$, $Prime = 16777619$) calculated across normalized immutable fields.
- **5-Stage Relay Admission Engine:** Enforces integrity verification, 24-hour message expiration (TTL), loop prevention (self-origin and previous forwarder checks), maximum hop boundaries (default 3 hops; range 1–5), and sliding-window rate limiting (5 forwards/minute).

### ☁️ Opportunistic Cloud Sync & Central Backend
- **Two-Tier Reachability Gating:** NetInfo network transition monitoring coupled with active HTTP `/api/health` probes to avoid captive portal traps.
- **Exponential Backoff with Jitter:** Formulas $\text{delay} = \min(5 \times 2^{\text{attempts}}, 300) \text{ seconds} + \text{jitter}$ preventing thundering-herd backend collapse when cellular towers recover.
- **Idempotent Batch Ingestion:** `POST /api/alerts/sync` returns `already_synced` for previously committed records without duplicating server data.
- **Mesh Relay Attribution:** Correctly records the forwarding user's identity and hop count while preserving original survivor details.
- **Concurrency-Safe Atomic Storage:** Concurrency write mutexes and two-phase atomic flush (`.tmp` to `fs.rename`) for `users.json`, `alerts.json`, `contacts.json`, `notifications.json`, and `audit_logs.json`.

### 👥 Emergency Contacts & Automated Notifications
- **Contact Priority Hierarchy:** Priority 1 (Primary) to Priority 5 with individual active/disabled toggles and strict user ownership isolation.
- **Automated Dispatch Pipeline:** Multi-channel notification task queuing for Email (SMTP / Nodemailer) and SMS (Twilio).
- **Privacy Telemetry Masking:** Dynamic masking of emails (`al***@example.com`) and phone numbers (`+1 ***-***-1234`) across all public APIs.

### 🗺️ Live Emergency Map & Situational Telemetry
- **Dual-Engine Mapping:** Interactive Google Maps via `react-native-maps` with cluster markers, category colors, and an offline Canvas-based Tactical Radar View fallback.
- **Real-Time SSE Broadcasting:** Unidirectional Server-Sent Events stream (`GET /api/alerts/stream`) rendering active emergencies instantly without client-side polling.
- **Turn-by-Turn Deep Linking:** External navigation launching via `geo:lat,lng` and Google Maps URI intents.

### 🖥️ Web Admin Command Operations Center
- **Responsive Dashboard:** Built with React 18, Vite 6, and Tailwind CSS (`admin/`).
- **Live Incident Triage:** Administrators inspect incidents, update lifecycle status (`investigating`, `resolving`, `resolved`), and manage user accounts.
- **Tamper-Evident Audit Ledger:** Append-only administrative action logging (`audit_logs.json`).

---

## 3. Bug Fixes in Release Candidate 1

The following issues identified during Step 15 evaluation were resolved in this release candidate:
1. **[BUG-01] Vite Dev Proxy Port Mismatch (Critical):** Corrected `admin/vite.config.js` and `admin/.env.example` from port `3000` to port `5000` to align with the backend's default configuration.
2. **[BUG-02] Relay Metadata Ingestion (High):** Updated `mobile/src/services/sync/syncService.js` to preserve `hopCount`, `forwarderId`, and `originalSenderId` during batch cloud uploads.
3. **[BUG-03] Production Secret Validation (High):** Enhanced `server/config/env.js` to abort startup in `NODE_ENV=production` if `JWT_SECRET` is shorter than 32 characters.
4. **[BUG-04] Android Release Version Code (Medium):** Added `"versionCode": 1`, `"android.permission.FOREGROUND_SERVICE"`, and `"android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"` to `mobile/app.json`.
5. **[BUG-05] Missing EAS Build Configuration (Medium):** Created `mobile/eas.json` with development, preview (APK), and production (AAB) profiles.
6. **[BUG-06] Typeless Package Warning (Low):** Added `"type": "module"` to `mobile/package.json` to eliminate Node.js test runner warnings.

---

## 4. Known Boundaries & Evaluation Guidance

1. **Academic Scope & PSAP Disclaimer:** RescueLink is an academic engineering project; it is **not certified by government Public Safety Answering Points (PSAPs)** to replace 911/112.
2. **Radio Physics:** BLE has an effective open-air range of 10 to 30 meters. Dense concrete rubble attenuates 2.4 GHz radio signals.
3. **Physical Device Requirement for Mesh:** Over-the-air multi-hop forwarding requires 3 physical Android handsets with native Bluetooth hardware.
4. **Simulated Notification Gateways:** Default installation operates with simulated SMS and Email delivery records to avoid incurring commercial carrier fees during testing.

---

## 5. Verification Commands

```bash
# 1. Run complete automated regression test suite (62 tests)
npm test --prefix server

# 2. Build Web Admin Operations Dashboard
npm run build --prefix admin

# 3. Seed default administrator account
npm run seed:admin --prefix server

# 4. Start backend server
npm run dev --prefix server
```
