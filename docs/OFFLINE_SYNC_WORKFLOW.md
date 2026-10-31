# RescueLink — Offline Synchronization Workflow & Outbox Engine

**Document:** Offline Synchronization, Outbox Pattern & Resilience Architecture  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0  
**Date:** October 2026  

---

## 1. Offline-First Architectural Philosophy

In traditional mobile application design, network requests precede local persistence. If the network call fails or times out, the user is presented with an error modal, and the data is lost unless explicitly re-entered.

In an emergency disaster scenario, this network-first paradigm is fatal. RescueLink adheres strictly to the **Offline-First Outbox Pattern**:

```
[User Action / BLE Reception]
             │
             ▼
[Atomic SQLite Transaction] ──► (Guaranteed Local Durability)
             │
             ├──► 1. Commit to `alerts` table
             └──► 2. Commit to `sync_queue` table
             │
             ▼
[Opportunistic Background Sync Engine]
             │ (Awaits Validated Internet Reachability)
             ▼
[POST /api/alerts/sync] ──────► [Purge Outbox on HTTP 200]
```

1. **Local Durability is Pre-eminent:** An emergency alert is considered successfully saved the microsecond it is committed to local SQLite storage with Write-Ahead Logging.
2. **Network Decoupling:** Radio transmission (BLE) and cloud synchronization (HTTPS) are asynchronous background consumers of the local database ledger.
3. **Zero Data Loss Guarantee:** Even if the smartphone immediately runs out of battery, experiences an OS crash, or is power-cycled, all pending emergency records remain intact and will resume synchronization upon restart.

---

## 2. The Persistent Outbox Pattern (`sync_queue`)

The outbox is implemented as a persistent table (`sync_queue`) in SQLite.

### 2.1 Outbox Schema Reference
```sql
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  alertId TEXT NOT NULL,
  action TEXT NOT NULL,           -- 'CREATE' | 'STATUS_UPDATE' | 'ACKNOWLEDGE' | 'RELAY'
  payload TEXT NOT NULL,          -- Serialized JSON envelope
  status TEXT NOT NULL,          -- 'pending' | 'in_progress' | 'completed' | 'failed'
  attempts INTEGER DEFAULT 0,
  lastAttemptAt TEXT,
  nextRetryAt TEXT,
  createdAt TEXT NOT NULL
);
```

### 2.2 Deduplication on Enqueue
To prevent queue bloating when the user edits or updates an alert multiple times offline, `enqueueSyncItem` executes an upsert check:
- If a record with matching `(alertId, action)` already exists in `pending` or `failed` state, its payload and timestamp are updated in place, rather than inserting duplicate rows.

---

## 3. Network Detection & Active Reachability Probing

A common failure mode in mobile disaster applications is trusting OS-level network state blindly. For example:
- A device may connect to a Wi-Fi router whose internet fiber backhaul has been severed.
- A device may connect to a captive Wi-Fi portal (such as a hotel or airport login page).

RescueLink employs a **two-tier reachability verification pipeline**:

```
[NetInfo Event: isConnected == true]
                 │
                 ▼
[Active Reachability Probe: GET /api/health (timeout 3000ms)]
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[Probe Success]     [Probe Fails / Captive Portal]
       │                   │
[Transition ONLINE]  [Remain OFFLINE (Suppress Sync)]
```

1. **Hardware State Monitoring:** `@react-native-community/netinfo` subscribes to cellular and Wi-Fi interface status changes.
2. **Active Liveness Probe:** When `isConnected` transitions to `true`, `networkService.js` issues a lightweight HTTP `GET /api/health` probe with a strict 3000ms timeout.
3. **Confirmed Online Transition:** Only when the health probe returns HTTP 200 with `{ "status": "healthy" }` does the sync engine awaken to process pending outbox items.

---

## 4. Exponential Backoff & Retry Algorithm

When network requests fail due to transient packet loss, weak cellular signal, or server-side throttling (HTTP 429 / 5xx), the sync engine applies an exponential backoff schedule.

### 4.1 Mathematical Formulation
$$\text{BaseDelay} = 5\text{ seconds}$$
$$\text{MaxDelay} = 300\text{ seconds (5 minutes)}$$
$$\text{Delay}_n = \min\left(\text{BaseDelay} \times 2^{\text{attempts}}, \text{MaxDelay}\right)$$
$$\text{Jitter} = \text{Random}(0.0, 0.2) \times \text{Delay}_n$$
$$\text{ScheduledRetryAt} = \text{CurrentTime} + \text{Delay}_n + \text{Jitter}$$

### 4.2 Retry Schedule Table

| Attempt ($n$) | Base Calculation | Delay with Jitter ($\pm 10\%$) | Cumulative Time Elapsed |
|---|---|---|---|
| **1** | $5 \times 2^0 = 5\text{s}$ | $\approx 5.5\text{s}$ | 5.5 seconds |
| **2** | $5 \times 2^1 = 10\text{s}$ | $\approx 11\text{s}$ | 16.5 seconds |
| **3** | $5 \times 2^2 = 20\text{s}$ | $\approx 22\text{s}$ | 38.5 seconds |
| **4** | $5 \times 2^3 = 40\text{s}$ | $\approx 44\text{s}$ | 1 minute 22 seconds |
| **5** | $5 \times 2^4 = 80\text{s}$ | $\approx 88\text{s}$ | 2 minutes 50 seconds |
| **6+** | $\min(160\text{s}, 300\text{s})$| $\approx 176\text{s}$ | 5 minutes 46 seconds |

### 4.3 Thundering Herd Prevention
In disaster zones, cellular towers frequently recover in batches. When a cell site powers back on, thousands of smartphones may simultaneously attempt to upload their offline queues. The inclusion of randomized jitter spreads out synchronization bursts across the time spectrum, preventing catastrophic backend ingress collapse.

---

## 5. Cloud Ingestion & Relay Attribution

When a sync payload reaches the backend (`POST /api/alerts/sync`), the cloud ingestion engine performs atomic deduplication and relay attribution:

### 5.1 Idempotent Ingestion Logic
```javascript
// Server Ingestion Check
const existingAlert = await alertStore.findById(incomingAlert.id);
if (existingAlert) {
  // Alert already exists in cloud database
  results.push({ id: incomingAlert.id, status: 'already_synced' });
  continue;
}
```

### 5.2 Relay Attribution Without Identity Impersonation
When Device C relays an alert authored by Survivor A:
- **Author Identity Preserved:** The alert record preserves `senderName: "Alice Survivor"`, `originalSenderId: "survivor-node-1"`, original coordinates, and timestamp.
- **Relay Contribution Acknowledged:** The cloud record appends:
  - `relayedByUserId: "user-uuid-device-c"`
  - `relayedAt: "2026-10-31T10:15:00.000Z"`
  - `hopCount: 2`
  - `forwarderId: "node-7b8c2d"`
- This enables emergency response dispatchers to track the physical propagation path of the message through the disaster zone while correctly prioritizing the actual survivor's identity and medical needs.
