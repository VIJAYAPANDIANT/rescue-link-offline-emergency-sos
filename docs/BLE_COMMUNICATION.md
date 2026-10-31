# RescueLink — Bluetooth Low Energy (BLE) Communication Protocol

**Document:** BLE Wireless Protocol Specification & Relay Admission Architecture  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** Protocol v2 (Step 8 Multi-Device Mesh)  
**Date:** October 2026  

---

## 1. BLE Hardware & Radio Architecture

RescueLink operates over commercial 2.4 GHz Bluetooth Low Energy (BLE 4.2+) radio hardware available in modern smartphones. To support bidirectional discovery, receipt, and re-transmission without requiring cellular towers or local routers, participating mobile devices operate in **Dual-Mode Concurrent BLE Roles**:

1. **GATT Peripheral (Broadcaster / Server):**
   - Instantiated using `react-native-ble-peripheral`.
   - Advertises the dedicated RescueLink Emergency Service UUID.
   - Hosts custom GATT characteristics serving the serialized alert payload and accepting peer delivery receipts.
2. **GATT Central (Scanner / Client):**
   - Instantiated using `react-native-ble-plx`.
   - Continuously or periodically scans for nearby advertising peripherals matching the RescueLink service UUID.
   - Connects, discovers characteristics, reads the active alert payload, and writes back an acknowledgment (ACK).

```
+-----------------------------------------------------------------------------------+
|                        GATT PROFILE SPECIFICATION                                 |
+-----------------------------------------------------------------------------------+
| Service UUID        | 0000FEF0-0000-1000-8000-00805F9B34FB                        |
|---------------------|-------------------------------------------------------------|
| Characteristic 1    | 0000FEF1-0000-1000-8000-00805F9B34FB                        |
| (SOS Payload)       | Properties: READ | NOTIFY                                    |
|                     | Description: Serves Base64-encoded SOS_ALERT payload        |
|---------------------|-------------------------------------------------------------|
| Characteristic 2    | 0000FEF2-0000-1000-8000-00805F9B34FB                        |
| (ACK Receipt)       | Properties: WRITE | NOTIFY                                   |
|                     | Description: Receives Base64-encoded SOS_ACK confirmation   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Wire Protocol Specification (Version 2)

RescueLink enforces strict single-frame transmission bounds. Payloads are serialized to compact JSON and Base64-encoded, guaranteeing they fit comfortably within standard **512-byte Maximum Transmission Unit (MTU)** characteristic frames.

### 2.1 SOS_ALERT Wire Payload Schema
```json
{
  "version": 2,
  "type": "SOS_ALERT",
  "alertId": "550e8400-e29b-41d4-a716-446655440000",
  "emergencyType": "Medical Emergency",
  "details": "Compound fracture on ridge trail. Bleeding controlled.",
  "senderName": "Alice Survivor",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "createdAt": "2026-10-31T10:00:00.000Z",
  "expiresAt": "2026-11-01T10:00:00.000Z",
  "originalSenderId": "user-uuid-device-a",
  "forwarderId": "node-7b8c2d",
  "hopCount": 1,
  "maxHops": 3,
  "integrityHash": "4a7f9c2e"
}
```

### 2.2 Protocol Field Definitions & Mutability Rules

| Field Name | Type | Size / Range | Description | Mutability Rule |
|---|---|---|---|---|
| `version` | Integer | `1` or `2` | Wire protocol version identifier. | Immutable |
| `type` | String | `"SOS_ALERT"` | Protocol packet type header. | Immutable |
| `alertId` | String (UUID) | 36 characters | Cryptographic unique ID generated at origin. | Immutable |
| `emergencyType`| String | Category enum | Medical, Accident, Personal Safety, Fire, Other, Drill. | Immutable |
| `details` | String | Max 180 chars | Survivor incident description. | Immutable |
| `senderName` | String | Max 40 chars | Survivor display name. | Immutable |
| `latitude` | Float \| null | -90.0000 to 90.0000 | GPS Latitude (4-decimal precision $\approx 11\text{m}$). | Immutable |
| `longitude` | Float \| null | -180.0000 to 180.0000| GPS Longitude (4-decimal precision). | Immutable |
| `createdAt` | String (ISO) | 24 characters | Original alert creation timestamp. | Immutable |
| `expiresAt` | String (ISO) | 24 characters | Message expiration (default `createdAt` + 24 hrs). | Immutable |
| `originalSenderId`| String \| null | UUID / Hash | Cryptographic identifier of originating device. | Immutable |
| `integrityHash`| String (Hex) | 8 characters | 32-bit FNV-1a checksum of immutable fields. | **NEVER MUTABLE** |
| `forwarderId` | String | `node-XXXXXX` | Anonymous node ID of the relaying peer. | **Mutable (Updated per hop)** |
| `hopCount` | Integer | 0 to `maxHops` | Number of mesh hops traversed (0 at origin). | **Mutable (Incremented +1)** |
| `maxHops` | Integer | 1 to 5 (default 3) | Maximum network hop boundary. | Immutable |

---

## 3. Cryptographic Content Integrity Validation

To guarantee that intermediate relay devices cannot tamper with emergency categories, survivor details, or GPS coordinates in transit, `computeAlertIntegrityHash` generates a deterministic 32-bit FNV-1a checksum across the normalized immutable fields.

### 3.1 Mathematical Specification
$$\text{OffsetBasis} = 2166136261 \quad (0\text{x}811\text{C}9\text{DC}5)$$
$$\text{Prime} = 16777619 \quad (0\text{x}01000193)$$
$$\text{For each byte } b \text{ in normalized string: } Hash = (Hash \oplus b) \times Prime \pmod{2^{32}}$$

### 3.2 Normalized Input Construction
$$\text{String} = \text{alertId} \parallel \text{emergencyType} \parallel \text{details} \parallel \text{lat} \parallel \text{lon} \parallel \text{createdAt} \parallel \text{originalSenderId}$$

### 3.3 Verification Logic
When any device receives a packet over BLE or during cloud ingestion:
```javascript
const recalculatedHash = computeAlertIntegrityHash(alert);
if (recalculatedHash !== alert.integrityHash) {
  // Reject immediately: packet corrupted or modified in transit
  throw new Error('Integrity validation failed: message modified');
}
```

---

## 4. Security Scrubbing: Credential Leakage Protection

Prior to any BLE payload generation, `sanitizeBLEPayload` rigorously inspects and purges sensitive fields from the in-memory object:
- **Authentication Secrets Stripped:** `token`, `jwt`, `accessToken`, `password`, `passwordHash`, `authorization`, `auth`.
- **Sanitized String Bounding:** Strings are trimmed and bounded to ensure single-packet MTU compliance.

```javascript
export function sanitizeBLEPayload(data) {
  const sanitized = { ...data };
  delete sanitized.token;
  delete sanitized.jwt;
  delete sanitized.accessToken;
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.authorization;
  delete sanitized.auth;
  return sanitized;
}
```

---

## 5. Multi-Device Relay Admission Engine

When an intermediate node discovers an incoming BLE beacon, it passes the alert through a 5-stage admission pipeline before committing it to storage or scheduling a forwarding broadcast:

```
[Inbound BLE Frame]
        │
        ▼
1. Integrity Check ───────► (Hash Mismatch?) ───────────► [REJECT & LOG]
        │ Valid
        ▼
2. Expiration Check ──────► (now > expiresAt?) ─────────► [DISCARD (STALE)]
        │ Fresh (< 24h)
        ▼
3. Loop Prevention ───────► (myNodeId == originalSenderId 
        │                    or already seen in LRU?) ──► [SUPPRESS FORWARD]
        ▼
4. Hop Boundary Check ────► (hopCount >= maxHops?) ─────► [STORE ONLY / NO FORWARD]
        │ hopCount < maxHops
        ▼
5. Rate Limiter Check ────► (> 5 forwards/min?) ────────► [THROTTLE FORWARD]
        │ Eligible
        ▼
[Commit to SQLite & Schedule Re-Broadcast (hopCount + 1)]
```

### 5.1 Loop Prevention & Duplicate Suppression
- **Self-Origin Loop Prevention:** If `alert.originalSenderId === localNodeId`, the device recognizes its own originated alert and refuses to re-broadcast.
- **LRU Duplicate Cache:** An in-memory Least-Recently-Used (LRU) set of the last 200 observed `alertId` values ensures identical beacons received multiple times from different neighbors are processed once and never echo-forwarded back into the mesh.

### 5.2 Hop Boundary & Expiration Controls
- **Maximum Hop Boundary:** Alerts are bounded to a maximum of 3 hops (configurable 1–5). Alerts arriving with `hopCount >= maxHops` are stored locally for eventual cloud sync if this device reaches connectivity, but are **not** re-transmitted over BLE.
- **Time-To-Live (TTL):** Alerts carry an explicit `expiresAt` ISO timestamp (24 hours after creation). Stale alerts arriving after expiration are rejected immediately to prevent network congestion from lingering disaster records.

### 5.3 Sliding-Window Rate Limiting
To conserve mobile battery life and prevent radio spectrum exhaustion during mass-casualty events, the forwarder maintains a sliding 60-second window tracking forwarding events. Nodes enforce a maximum threshold of **5 forwarded broadcasts per minute**.
