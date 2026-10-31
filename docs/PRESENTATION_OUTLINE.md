# RescueLink — Project Presentation Outline & Slide Deck

**Document:** 18-Slide Final Project Defense & Academic Presentation Guide  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Audience:** Academic Review Board, Faculty Examiners & Industry Panel  
**Date:** October 2026  

---

## Slide 1: Title & Project Identity
- **Slide Title:** RescueLink — Offline Bluetooth Emergency SOS System
- **Subtitle:** A Resilient, Multi-Hop Mesh Network for Disaster-Zone Distress Signaling & Situational Awareness
- **Presenter Names:** [Student / Team Members]
- **Department / Faculty:** Department of Computer Science & Engineering
- **Institution:** [College / University Name]
- **Presenter Notes:** Welcome the examiners. State that RescueLink addresses the total collapse of telecommunication infrastructure during catastrophic disasters, turning ordinary smartphones into peer-to-peer life-saving transceivers.

---

## Slide 2: The Critical Problem — Disaster Grid Collapse
- **Bullet Points:**
  - Natural disasters (earthquakes, cyclones, floods) routinely destroy cellular base stations and fiber backhaul.
  - Municipal power blackouts exhaust cell tower backup generators within hours.
  - Traditional emergency numbers (911/112) fail completely when infrastructure is down.
  - The "Golden 24 Hours": Trapped victims have charged smartphones with active radios, but no cellular connection.
- **Visuals:** Diagram of severed cell towers vs. isolated trapped survivor.
- **Presenter Notes:** Cite historical incidents: Hurricane Katrina, Great East Japan Earthquake, and Turkey-Syria Earthquake where thousands had phones with battery, but zero bars of signal.

---

## Slide 3: Motivation & Research Gaps
- **Bullet Points:**
  - **Satellite SOS:** High hardware cost ($300–$600), requires line-of-sight to the open sky, fails inside collapsed buildings.
  - **Walkie-Talkies:** Analog only, no GPS coordinates, no persistent store-and-forward routing, no cloud bridging.
  - **The Missing Link:** A zero-cost, software-only solution leveraging existing Bluetooth Low Energy (BLE) hardware already present in billions of smartphones.
- **Presenter Notes:** Emphasize that RescueLink requires no extra hardware dongles, special SIM cards, or paid subscriptions.

---

## Slide 4: The Proposed Solution — RescueLink
- **Bullet Points:**
  - **Tier 1 (Edge):** Offline-first mobile app on React Native Expo with local SQLite WAL persistence.
  - **Tier 2 (Mesh):** Controlled multi-device epidemic BLE relay routing ($A \to B \to C$) using custom GATT services.
  - **Tier 3 (Cloud Bridge):** Opportunistic synchronization with exponential backoff once any node touches internet.
  - **Tier 4 (Command & Dispatch):** Web Admin Operations Center with live SSE stream and automated SMS/Email dispatch.
- **Visuals:** High-level 3-tier architecture overview diagram.

---

## Slide 5: System Architecture & Data Flow
- **Bullet Points:**
  - End-to-end data lifecycle: Composition $\to$ SQLite Write $\to$ BLE Broadcast $\to$ Peer Relay $\to$ Cloud Ingestion $\to$ Admin Map.
  - Clear decoupling between radio communication, local database, and cloud transport.
  - Asymmetric communication design: Optimized for battery conservation and high reliability.
- **Visuals:** System architecture flowchart from `docs/SYSTEM_ARCHITECTURE.md`.
- **Presenter Notes:** Walk the board through the flow: Device A is deep in rubble; Device B is a passerby; Device C is a rescue team with cellular connectivity.

---

## Slide 6: Mobile Client Architecture (React Native & Expo)
- **Bullet Points:**
  - Cross-platform architecture built on React Native & Expo SDK 52.
  - Clean separation: Presentation Layer $\to$ Contexts (Auth, Theme) $\to$ Service Engines $\to$ SQLite Repositories.
  - High-contrast emergency UI design system (WCAG AA compliant) with dual Light/Dark theme support.
  - Non-reliance on third-party cloud services during core SOS workflows.
- **Visuals:** Mobile application architecture diagram.

---

## Slide 7: Offline-First Persistence (SQLite & WAL Mode)
- **Bullet Points:**
  - Utilizes `expo-sqlite` (v15.1.4) with Write-Ahead Logging (`PRAGMA journal_mode = WAL`).
  - Guarantees zero data loss: Local write occurs *before* any radio broadcast attempt.
  - Versioned migration pipeline (v1 to v4) executed automatically on app startup.
  - Multi-state decoupling: `deliveryStatus`, `ackStatus`, and `syncStatus` operate independently.
- **Presenter Notes:** Explain why WAL mode is essential: it allows concurrent background reads during active database writes without table locks.

---

## Slide 8: BLE Protocol Design & MTU Constraints
- **Bullet Points:**
  - Dual-mode BLE: Operates concurrently as GATT Central (Scanner) and GATT Peripheral (Server).
  - Dedicated RescueLink Service UUID (`0000FEF0-...`) and Alert/ACK Characteristics.
  - 512-Byte Maximum Transmission Unit (MTU) single-packet constraint.
  - Base64-encoded minified JSON wire format (Protocol v2).
  - Deterministic 32-bit FNV-1a content integrity checksum prevents transit tampering.
- **Visuals:** Packet structure table showing immutable vs. mutable routing fields.

---

## Slide 9: Multi-Device Epidemic Relay Network
- **Bullet Points:**
  - Controlled Store-Carry-and-Forward routing: Overcomes the 30-meter single-hop radio horizon.
  - Hop Count control: Increments per hop; bounded to configurable `maxHops` (default 3).
  - Loop Prevention: Checks `originalSenderId` against local node ID.
  - Duplicate Suppression: In-memory LRU cache of recently seen alert IDs.
  - Rate Limiting: Max 5 forward broadcasts per minute to prevent battery depletion.
- **Visuals:** Sequence diagram of multi-hop relay ($A \to B \to C$).

---

## Slide 10: Opportunistic Cloud Synchronization & Backoff
- **Bullet Points:**
  - Persistent Outbox pattern (`sync_queue` table).
  - Two-tier reachability detection: Hardware NetInfo listener + active HTTP health probe (prevents captive portal traps).
  - Exponential backoff retry formula: $\text{delay} = \min(5 \times 2^{\text{attempts}}, 300) \text{ seconds} + \text{jitter}$.
  - Server-side idempotency: Re-uploaded alerts return `already_synced` without creating duplicates.
  - Accurate relay attribution: Records who forwarded the alert without impersonating the survivor.

---

## Slide 11: Multi-Channel Emergency Notification Pipeline
- **Bullet Points:**
  - Cloud backend queries survivor's pre-configured emergency contacts upon alert ingestion.
  - Prioritized dispatch: Contacts sorted by priority tiers (Priority 1 through 5).
  - Multi-Channel delivery: Automated SMTP Email (HTML alert with map link) and Twilio SMS.
  - Recipient Privacy: Phone numbers and email addresses are masked (`ja***@example.com`) across all public APIs.

---

## Slide 12: Live Geospatial Map & Radar Tracking
- **Bullet Points:**
  - Interactive map powered by `react-native-maps` with dynamic pin clustering and category color-coding.
  - Real-time Server-Sent Events (SSE) stream (`/api/alerts/stream`) renders new incidents instantly without polling.
  - Explicit user location consent gate: GPS captured only with permission; supports unmapped alerts.
  - Dual-engine architecture: Automatically falls back to a Canvas-based Tactical Radar View on devices lacking Google Play Services.

---

## Slide 13: Central Cloud Backend Architecture
- **Bullet Points:**
  - Node.js & Express.js REST API gateway with SSE event broadcasting.
  - Concurrency-safe atomic JSON file storage guarded by in-memory Promise write mutexes.
  - Atomic two-phase disk writes (`.tmp` file write followed by `fs.rename`) prevent corrupted documents.
  - Deep readiness probe (`/api/ready`) monitoring storage health, document counts, and memory RSS.

---

## 14. Slide 14: Web Admin Command Center & Analytics
- **Bullet Points:**
  - Responsive web dashboard built with React 18, Vite 6, and Tailwind CSS.
  - Live incident triage: Admins update status (`investigating`, `resolving`, `resolved`).
  - Situational metrics: Active emergencies, resolution rates, and mesh relay efficiency ratio.
  - Security oversight: User account management, audit logs, and mesh telemetry inspection.
- **Visuals:** Screenshots of the Overview, Live Map, and Incident Triage views.

---

## Slide 15: Security, Threat Model & Privacy Hardening
- **Bullet Points:**
  - **STRIDE Threat Modeling:** Hardened against spoofing, tampering, information disclosure, and DoS.
  - **Zero-Trust Passwords:** bcrypt hashing with 10 salt rounds; constant-time comparison.
  - **Strict RBAC:** Role-based access control enforced at the Express route middleware layer.
  - **Credential Scrubbing:** Automatically purges JWTs and passwords before BLE broadcast.
  - **Self-Lockout Protection:** Admins cannot suspend their own active accounts.

---

## Slide 16: Verification & Testing Results
- **Bullet Points:**
  - Comprehensive automated test suite: **62 / 62 Tests Passed (100% Success Rate)** across 11 core modules.
  - Verified authentication, BLE serialization, SQLite migrations, relay routing, map endpoints, and admin RBAC.
  - Physical multi-device field testing: Confirmed 2-device direct BLE exchange and 3-device multi-hop mesh relay.
- **Visuals:** Terminal output screenshot showing all 62 tests passing cleanly in ~11 seconds.

---

## Slide 17: Live Demonstration Walkthrough
- **Demonstration Steps:**
  1. **Step 1:** Place Device A into Airplane Mode (Offline) $\to$ Trigger Medical Emergency SOS.
  2. **Step 2:** Show Device A persisting alert to SQLite and broadcasting BLE beacon.
  3. **Step 3:** Device B (also Offline) scans, receives beacon, and sends an ACK receipt.
  4. **Step 4:** Show Device A UI updating instantly to "Acknowledged — Help is on the way".
  5. **Step 5:** Device B re-broadcasts as Hop 1; Device C receives beacon and connects to Wi-Fi.
  6. **Step 6:** Show Admin Dashboard receiving the incident via SSE stream in real time.

---

## Slide 18: Conclusion, Limitations & Future Roadmap
- **Bullet Points:**
  - **Project Achievements:** Built a fully functional, verified offline-first emergency mesh network from edge to cloud.
  - **Known Boundaries:** BLE 30m radio range, 512-byte MTU limit, mobile OS background execution policies, not a certified 911 PSAP.
  - **Future Roadmap:** Cryptographic E2EE (Curve25519), LoRaWAN 915 MHz long-range bridging, and AI geospatial incident clustering.
  - **Q&A Session:** Invite questions from the examiners.
