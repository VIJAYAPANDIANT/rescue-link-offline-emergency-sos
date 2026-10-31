# RescueLink — Technical Viva Examination & Comprehensive Q&A Guide

**Document:** Technical Defense, Viva Voce Preparation & Architecture Questions  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Audience:** Project Viva Examiners, Technical Evaluators & System Architects  
**Date:** October 2026  

---

## 1. Domain: Core Concepts, Motivation & Architecture

### Q1: Why did you choose Bluetooth Low Energy (BLE) instead of Wi-Fi Direct or Cellular?
**Answer:**  
1. **Zero Infrastructure:** Cellular relies entirely on functional base stations and power grids, which fail during disasters.
2. **Energy Efficiency:** Wi-Fi Direct consumes substantial battery power (~150–250 mA during active negotiation) and requires slow, high-overhead WPS peer handshakes (5–15 seconds). In contrast, BLE operates at ~10–15 mA and supports instant connectionless discovery and lightweight GATT reads within hundreds of milliseconds.
3. **Ubiquity & Permissions:** BLE is supported on 100% of modern smartphones across Android and iOS without requiring hotspot renegotiations or disconnecting the user from existing local networks.

---

### Q2: What is the Store-Carry-and-Forward (Epidemic) routing model?
**Answer:**  
In delay-tolerant networking (DTN), an end-to-end path between the source (survivor) and the destination (cloud server) rarely exists at any single instant in time. Under the Store-Carry-and-Forward model:
- A device **stores** the emergency packet in durable local SQLite storage.
- The physical device is **carried** by human movement (e.g. a civilian walking toward safety).
- When a new neighbor comes within BLE radio range, the device **forwards** the message.
This overcomes the 30-meter physical radio barrier without needing a continuous active mesh chain.

---

### Q3: What is the difference between an Ad-Hoc Mesh and an Epidemic Relay?
**Answer:**  
Traditional ad-hoc mesh networks (like BATMAN or OLSR) maintain continuous routing tables and expect near-instantaneous end-to-end packet delivery. In a disaster zone with severe radio attenuation and sparse node density, maintaining routing tables causes massive protocol overhead and fails due to network partitioning. Epidemic relaying treats packets as asynchronous distress beacons, utilizing opportunistic contacts and storage durability to maximize ultimate delivery probability.

---

## 2. Domain: Bluetooth Low Energy & Protocol Engineering

### Q4: Explain the roles of GATT Central and GATT Peripheral in RescueLink.
**Answer:**  
RescueLink implements a **Dual-Mode Concurrent Architecture**:
- **GATT Peripheral (Broadcaster/Server):** Hosts the custom GATT profile (`0000FEF0-...`), advertises its availability over the air, and serves characteristics for read/notify operations.
- **GATT Central (Scanner/Client):** Scans the 2.4 GHz radio band, discovers advertising peripherals, establishes GATT connections, reads the alert characteristic (`0000FEF1`), and writes acknowledgment receipts (`0000FEF2`).
A device can switch between or execute these roles concurrently depending on whether it is originating an SOS or scanning for neighbors.

---

### Q5: What is the BLE MTU limit and how did you engineer the protocol to fit within it?
**Answer:**  
The default BLE 4.0/4.1 ATT Maximum Transmission Unit (MTU) is 23 bytes (20 payload bytes). However, modern BLE 4.2+ implementations support MTU negotiation up to **512 bytes**.
To guarantee that emergency alerts fit within a single unfragmented GATT characteristic read:
1. We design a compact, minified JSON schema (Protocol v2).
2. Field names and string lengths are bounded (incident details max 180 chars, sender name max 40 chars, coordinates to 4 decimal places).
3. The JSON string is Base64-encoded, producing an on-the-wire payload of ~320 to 380 bytes, well below the 512-byte MTU bound.

---

### Q6: How does the 32-bit FNV-1a checksum guarantee packet integrity during relaying?
**Answer:**  
The Fowler-Noll-Vo (FNV-1a) algorithm computes a deterministic 32-bit hash across normalized immutable fields (`alertId`, `emergencyType`, `details`, `lat`, `lon`, `createdAt`, `originalSenderId`).
- Formula: $Hash = (Hash \oplus Byte) \times Prime \pmod{2^{32}}$, initialized with offset basis $2166136261$.
- Any single-bit modification by a rogue relay node (e.g., tampering with GPS coordinates or emergency type) alters the recalculated hash. Receivers and the cloud server recalculate the hash upon ingestion and immediately reject tampered packets.

---

## 3. Domain: Multi-Hop Relay & Loop Controls

### Q7: How do you prevent routing loops and broadcast storms in the mesh?
**Answer:**  
We enforce five independent control mechanisms in the Relay Admission Engine:
1. **Self-Origin Loop Prevention:** If `alert.originalSenderId === localNodeId`, the device recognizes its own originated alert and refuses to re-broadcast.
2. **LRU Duplicate Cache:** An in-memory cache of the last 200 observed `alertId` values prevents re-processing already-handled alerts.
3. **Hop Count Boundary:** The alert carries `hopCount` (incremented by 1 per hop) and `maxHops` (default 3, max 5). Alerts arriving with `hopCount >= maxHops` are stored locally but never re-broadcast.
4. **Time-To-Live (TTL):** Alerts carry an explicit `expiresAt` timestamp (24 hours). Stale alerts are discarded.
5. **Sliding-Window Rate Limiter:** Nodes enforce a hard cap of 5 forwarded broadcasts per minute.

---

### Q8: What mutable fields change when an alert is forwarded?
**Answer:**  
Only two fields are modified by an intermediate relay forwarder:
1. `hopCount`: Incremented by +1 ($n \to n+1$).
2. `forwarderId`: Updated to the relaying node's anonymous identifier (`node-XXXXXX`).
All other fields (`alertId`, `details`, `latitude`, `longitude`, `createdAt`, `originalSenderId`, `integrityHash`) are strictly immutable and protected by the checksum.

---

## 4. Domain: SQLite Persistence & Offline-First Design

### Q9: Why is SQLite configured in Write-Ahead Logging (WAL) mode?
**Answer:**  
In standard rollback journal mode, writing to an SQLite database locks the entire database file, preventing concurrent reads.
In **WAL mode** (`PRAGMA journal_mode = WAL`):
1. Write transactions are appended to a separate `.wal` file, allowing reader processes to read the main database concurrently without blocking or being blocked by writes.
2. Disk writes are sequential rather than random, substantially increasing write throughput.
3. It guarantees ACID durability even if the application process is terminated unexpectedly or the device loses power mid-write.

---

### Q10: How are database migrations managed across app versions?
**Answer:**  
We utilize SQLite's built-in `PRAGMA user_version` register:
- On initialization, the app queries `PRAGMA user_version`.
- Migration scripts (v1 to v4) are defined sequentially.
- If `user_version` is less than a migration's version number, that migration's DDL script runs inside an atomic transaction (`BEGIN TRANSACTION ... COMMIT`).
- Upon success, `PRAGMA user_version` is updated. This guarantees idempotent, forward-only schema upgrades without data loss.

---

### Q11: Explain the decoupling between `deliveryStatus`, `ackStatus`, and `syncStatus`.
**Answer:**  
An emergency alert must track three independent dimensions:
1. **`deliveryStatus` (`pending`, `broadcasted`, `received`):** Tracks the local device's transmission state over the physical radio.
2. **`ackStatus` (`unacknowledged`, `acknowledged`):** Tracks whether a peer responder has explicitly confirmed receipt of the distress signal.
3. **`syncStatus` (`not_synced`, `synced`):** Tracks whether the record has been committed to the central cloud backend.
Decoupling these fields prevents state overwrite conflicts (e.g., an alert can be `broadcasted` over BLE, `unacknowledged` by peers, yet `synced` to the cloud).

---

## 5. Domain: Cloud Synchronization & Network Detection

### Q12: How do you prevent false positives in network reachability detection?
**Answer:**  
`@react-native-community/netinfo` only detects hardware interface link status (i.e. connected to an SSID or base station). It does not confirm actual end-to-end internet connectivity (e.g. captive portals or disconnected fiber backhaul).
RescueLink implements a two-tier verification:
1. NetInfo detects `isConnected: true`.
2. The client immediately issues an active HTTP probe to `GET /api/health` with a strict 3000ms timeout.
3. Only if the health check responds with HTTP 200 does the sync service trigger outbox processing.

---

### Q13: Explain the exponential backoff algorithm and why randomized jitter is used.
**Answer:**  
- **Backoff Formula:** $\text{delay} = \min(5 \times 2^{\text{attempts}}, 300) \text{ seconds}$.
- **Jitter ($\pm 10–20\%$):** When a cellular tower is restored after a disaster, thousands of phones will simultaneously detect connectivity. If all devices sync on an identical fixed schedule, they cause a **"Thundering Herd"** collapse on the backend ingress. Randomized jitter staggers request timing, smoothing traffic load.

---

### Q14: How does the backend achieve idempotent synchronization?
**Answer:**  
In `POST /api/alerts/sync`, each incoming alert is checked against `alertStore` by unique `alertId`. If the alert already exists, the server records the relay attribution metadata and returns HTTP 200 with `{ id, status: "already_synced" }` rather than inserting a duplicate record or throwing an error.

---

## 6. Domain: Backend, Security & API Architecture

### Q15: Why did you use atomic JSON document storage instead of an external SQL database?
**Answer:**  
1. **Zero-Dependency Portability:** RescueLink's reference backend requires no external database installation, daemon setup, or credential configuration, making it instant to deploy in temporary field command centers.
2. **Concurrency Safety:** Writes are serialized using an in-memory Promise-chain write mutex, and committed via a two-phase atomic write (`fs.writeFile` to `.tmp` followed by atomic `fs.rename`), preventing corrupted JSON files.
3. **Scalability Path:** For enterprise production deployments, the service layer is decoupled from the storage layer, allowing direct migration to PostgreSQL/PostGIS.

---

### Q16: How do Server-Sent Events (SSE) compare to WebSockets for live emergency mapping?
**Answer:**  
1. **Unidirectional Efficiency:** The map and admin dashboard only require server-to-client streaming of incoming incidents; client-to-server commands (status changes) are standard REST calls.
2. **Native HTTP/2 & Reconnection:** SSE runs over standard HTTP, natively inherits TLS, bypasses strict corporate firewalls, and includes automatic client reconnection with `Last-Event-ID`.
3. **Simplicity:** SSE requires no complex socket handshakes or binary framing protocols.

---

### Q17: What security measures prevent credential leakage over the BLE radio mesh?
**Answer:**  
Before any object is serialized for BLE broadcast, `sanitizeBLEPayload` rigorously purges authentication secrets (`token`, `jwt`, `accessToken`, `password`, `passwordHash`, `authorization`). Furthermore, recipient contact details (phone numbers and emails) are masked dynamically in all public and admin-facing telemetry.

---

## 7. Domain: Edge Cases & Failure Scenarios

### Q18: What happens if a relay device runs out of battery mid-transit?
**Answer:**  
Because every received alert is committed to SQLite with WAL mode *before* re-broadcasting, the data remains safely persisted on flash storage. When the phone is recharged hours or days later, the outbox processor will find the record and synchronize it to the cloud if internet is present.

---

### Q19: What prevents malicious actors from spoofing GPS coordinates?
**Answer:**  
1. In the offline mesh, the FNV-1a checksum prevents intermediate nodes from altering the coordinates set by the originator.
2. On the backend, coordinates are strictly validated against physical bounds (latitude between -90 and 90, longitude between -180 and 180).
3. If an attacker origination node fabricates coordinates, the administrative dashboard allows incident commanders to flag the alert as fraudulent and suspend the user account with a permanent audit record.

---

### Q20: Is RescueLink certified to replace 911 / 112 emergency services?
**Answer:**  
**No.** RescueLink is an academic engineering and open research system. It is not certified by government Public Safety Answering Points (PSAPs). It is engineered as a last-resort contingency network for when certified infrastructure has completely collapsed. When conventional phone or satellite networks are functional, citizens must always contact official emergency dispatchers.

---

## 8. Domain: Testing, Verification & Concurrency Engineering

### Q21: How is hardware-dependent BLE functionality verified in an automated CI/CD environment?
**Answer:**  
Hardware-dependent BLE radio chips cannot be physically asserted on headless test runners. We architected a modular separation between the protocol serialization engine (`bleProtocol.js`), the admission state machine (`relayService.js`), and the native hardware bridge (`bleManagerModule.js`).
Automated tests (Modules 3 and 6) mock the transport layer while executing genuine mathematical checksum calculation, Base64 JSON encoding, 512-byte MTU boundary checks, and LRU cache eviction algorithms against the actual production code.

---

### Q22: How did you test for race conditions during concurrent server writes?
**Answer:**  
In Module 10 (Test M10-T02), the test harness triggers 50 simultaneous asynchronous write requests to the storage layer. We verify that our in-memory Promise-chain mutex serializes each disk write sequentially, writing first to a `.tmp` file and executing an atomic `fs.rename`. The test confirms that all 50 writes complete without file locking errors, partial writes, or corrupted JSON documents.

---

## 9. Domain: Emergency Contacts & Automated Notifications

### Q23: How does the notification engine guarantee idempotency across multiple sync retries?
**Answer:**  
Every notification task is tagged with a composite deterministic idempotency key formatted as `${alertId}:${contactId}:${channel}` (e.g. `550e84...:c7a8b...:email`).
Before dispatching via SMTP or SMS, `notificationStore.js` queries whether a task matching this key already exists in `sent` or `queued` state. If so, subsequent dispatches are safely ignored, preventing survivors' contacts from receiving dozens of duplicate panic messages during cellular flapping.

---

### Q24: Why are external notification providers (Twilio/SMTP) simulated by default?
**Answer:**  
1. **Academic Cost & Carrier Compliance:** Production SMS carriers require verified A2P 10DLC campaign registration and per-message telephony fees.
2. **Safety & Ethics:** During development and academic evaluation, live cellular numbers must never be spammed with distress alerts.
3. **Pluggable Architecture:** The provider layer (`emailProvider.js`, `smsProvider.js`) implements a unified interface: if live credentials (`TWILIO_ACCOUNT_SID`, `SMTP_HOST`) are supplied in `.env`, the system dispatches genuine messages; otherwise, it logs delivery to `notifications.json` with a mock transaction ID.

---

## 10. Domain: Geospatial Mapping & Tactical Navigation

### Q25: How does the Dual-Engine Map architecture work on mobile devices?
**Answer:**  
`react-native-maps` requires native Google Play Services binaries and an active Google Maps API key, which may fail on de-googled ROMs, emulators, or devices in low-resource environments.
RescueLink implements a fallback wrapper in `EmergencyMapView.js`:
- If `react-native-maps` is available and coordinates exist, it renders a full vector map with marker clustering and GPS location tracking.
- If native map libraries fail to load or GPS is unavailable, it automatically mounts a lightweight, offline HTML5/React Native Canvas **Tactical Radar View** displaying relative distance rings and cardinal directions.

---

### Q26: Why are unmapped alerts quarantined instead of plotted at (0, 0)?
**Answer:**  
Plotting unmapped alerts at latitude 0, longitude 0 (Null Island in the Gulf of Guinea) creates dangerous false operational data for search-and-rescue teams. RescueLink quarantines incidents lacking valid GPS locks in an **Unmapped Incidents Drawer**, allowing dispatchers to read the survivor's text description (e.g. "Basement of St. Jude Church") without distorting spatial incident clusters on the map.

---

## 11. Domain: Database Performance, Indexing & Scaling

### Q27: What database indexes were created in SQLite and why?
**Answer:**  
Across migrations v1 to v4, we added targeted single and compound B-tree indexes:
- `idx_alerts_createdAt`: Enables $O(\log n)$ chronological sorting for the Emergency History feed.
- `idx_alerts_deliveryStatus` & `idx_alerts_syncStatus`: Enables instant filtering for pending outbox items without full table scans.
- `idx_sync_queue_alertId_action`: Enforces compound deduplication on outbox enqueue.
- `idx_contacts_userId` & `idx_contacts_priority`: Guarantees fast retrieval of contacts sorted by priority tier (1 to 5).
Benchmark measurements demonstrate that querying 500 rows using these indexes takes just **0.66 milliseconds**.

---

### Q28: How does the backend atomic file storage perform compared to a traditional SQL database?
**Answer:**  
In our live benchmark measurements on Windows:
- Server cold boot takes **33.14 ms**.
- Single health checks respond in **4.16 ms**.
- Sequential emergency alert creation takes **13.33 ms** (including disk flush and JSON serialization).
While an atomic JSON document store is bounded to ~250–500 operations/second (sufficient for regional field command centers), enterprise national deployments can seamlessly swap the storage repository for PostgreSQL with PostGIS without changing the Express route handlers or mobile client.

---

## 12. Domain: Limitations, Ethics & Future Evolution

### Q29: Why is Curve25519 / ChaCha20-Poly1305 proposed for End-to-End Encryption (E2EE)?
**Answer:**  
In the current prototype, BLE characteristic payloads are plaintext JSON (sanitized of passwords). An eavesdropper sniffing 2.4 GHz radio frequencies could read a survivor's medical description.
In Phase 1 of our roadmap:
- Public rescue authorities publish public keys.
- The survivor's app encrypts the medical payload using Curve25519 asymmetric key exchange and ChaCha20-Poly1305 AEAD.
- Intermediate relay nodes can inspect unencrypted routing headers (`hopCount`, `maxHops`, `expiresAt`) to forward the packet, but only authorized dispatchers holding the private key can decrypt the survivor's personal medical data.

---

### Q30: How would LoRaWAN integration expand RescueLink's operational capability?
**Answer:**  
While Bluetooth Low Energy is ubiquitous on smartphones, its physical radio horizon is limited to 10–30 meters.
By interfacing the smartphone via BLE with a $25 battery-powered LoRa radio (such as a Meshtastic Semtech SX1262 device operating on license-free 915 MHz or 868 MHz ISM bands), emergency packets can bridge distances of **10 to 15 kilometers** across mountains, valleys, and forests, establishing a regional disaster backbone without cellular towers.
