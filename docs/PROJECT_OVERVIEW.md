# RescueLink — Project Overview

**System Name:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0 (Production-Ready Release)  
**Target Environment:** React Native (Expo SDK 52) Mobile App, Express.js Backend, React + Vite Admin Dashboard  
**Date:** October 2026  

---

## 1. Executive Summary

**RescueLink** is a mission-critical, offline-first mobile emergency distress response system designed for scenarios where traditional telecommunications infrastructure has suffered catastrophic failure. In major natural disasters (such as hurricanes, earthquakes, flash floods, or tsunamis), wilderness search-and-rescue operations, or grid-scale power blackouts, cellular towers and commercial broadband networks become unavailable or congested.

RescueLink bridges this life-safety gap through an innovative, three-tier topology:
1. **Survivors** in zero-connectivity environments compose and persist distress signals in local SQLite databases, broadcasting encrypted, tamper-evident emergency beacons over **Bluetooth Low Energy (BLE)**.
2. **Nearby Civilian or First-Responder Devices** automatically discover, record, and relay these beacons across a controlled **multi-hop epidemic mesh network** ($A \to B \to C$).
3. **Opportunistic Cloud Ingestion Nodes** automatically upload collected mesh payloads to the central rescue cloud backend the moment any node regains cellular or Wi-Fi internet connectivity.
4. **Emergency Services & Dispatchers** monitor real-time incident telemetry through a high-performance **Web Admin Command Center**, while automated multi-channel pipelines dispatch emergency SMS and Email alerts to pre-configured trusted contacts.

---

## 2. Core Architectural Pillars

```
+-----------------------------------------------------------------------------------+
|                                  RESCUELINK                                       |
+-----------------------------------------------------------------------------------+
|  1. Offline-First Durability     | Local SQLite database with Write-Ahead Logging |
|  2. Zero-Infrastructure Comms    | Bluetooth Low Energy GATT mesh protocol (v2)   |
|  3. Multi-Hop Epidemic Relay     | Controlled store-and-forward routing (1-5 hops)|
|  4. Opportunistic Cloud Sync     | Exponential backoff outbox queue with net check|
|  5. Automated Notifications      | Multi-channel SMS & Email dispatch to contacts |
|  6. Real-Time Command & Control  | Web Admin Dashboard with SSE streaming and map |
+-----------------------------------------------------------------------------------+
```

### Pillar 1: Offline-First Persistence
The application operates fully without an active internet connection. All actions—creating an SOS, receiving a peer beacon, acknowledging delivery, recording contacts, and staging notification tasks—are written atomically to an embedded SQLite database configured in Write-Ahead Logging (WAL) mode. The system guarantees zero data loss upon device reboot, app termination, or battery exhaustion.

### Pillar 2: Zero-Infrastructure BLE Mesh
RescueLink requires no cellular towers, Wi-Fi routers, satellite dishes, or internet gateways to transmit emergency signals. Devices utilize dual-role Bluetooth Low Energy hardware adapters (operating concurrently as GATT Central and GATT Peripheral) to exchange serialized 512-byte payloads within an operational radio radius of 10 to 30 meters.

### Pillar 3: Multi-Device Epidemic Relay
Distress alerts travel beyond single-radio line-of-sight through an epidemic store-and-forward relay engine. Participating smartphones act as intermediate nodes, validating packet integrity, incrementing hop counts, verifying time-to-live (TTL) limits, enforcing duplicate suppression, and forwarding alerts to further devices.

### Pillar 4: Opportunistic Cloud Synchronization
When an isolated device or intermediate relay node regains internet connectivity, an intelligent background synchronization service awakens. Using exponential backoff and connection validation, the outbox engine uploads pending local and relayed distress records to the central Express.js cloud backend, attributing relay contributions without compromising survivor identity.

### Pillar 5: Automated Multi-Channel Notifications
Once synchronized with the cloud backend, emergency alerts trigger an automated notification engine. Trusted contacts configured by the survivor are notified via SMTP Email and SMS (Twilio integration). All recipient addresses are strictly masked in client-facing telemetry to preserve user privacy.

### Pillar 6: Real-Time Command & Incident Analytics
Disaster response coordinators and incident commanders utilize a responsive, web-based Admin Dashboard (built with React 18, Vite 6, and Tailwind CSS). The dashboard delivers live incident triage, Server-Sent Events (SSE) streaming, geographic heatmaps, user management, and tamper-evident administrative audit logs.

---

## 3. User Personas & Real-World Use Cases

| Persona | Environment | Connectivity | Primary System Role |
|---|---|---|---|
| **Distressed Survivor** | Collapsed building, backcountry hiking trail, flood zone | **Zero (Offline)** | Triggers single-touch SOS, selects emergency type, provides injuries/needs, broadcasts BLE beacon. |
| **Civilian Bystander / Volunteer** | Moving through disaster perimeter | **Intermittent / Zero** | Device passively receives peer beacons, stores records in SQLite, acts as mobile relay forwarder. |
| **Field Search & Rescue Responder** | Ground search team, boat rescue crew | **Intermittent** | Receives alerts over BLE, sends electronic acknowledgment (ACK), tracks survivors on live tactical map. |
| **Incident Commander / Dispatcher** | Emergency Operations Center (EOC) | **Full Broadband** | Monitors central dashboard, triages active incidents, verifies multi-hop relay telemetry, coordinates units. |

---

## 4. Key Capabilities & Feature Matrix

- **One-Touch SOS Broadcast:** Prominent, accessible emergency trigger with 3-second hold confirmation or immediate dispatch.
- **Categorized Emergency Types:** Medical Emergency, Accident, Personal Safety, Fire, Other, and dedicated Test / Drill simulation mode.
- **Autonomous Location Capture:** Hardware GPS coordinate acquisition with explicit user permission gate and manual/unmapped fallbacks.
- **Cryptographic Packet Integrity:** 32-bit FNV-1a deterministic checksum prevents transit tampering by intermediary forwarding nodes.
- **Bidirectional Acknowledgment (ACK):** Responders can transmit signed electronic receipts back to the survivor over BLE, providing psychological assurance that help is incoming.
- **Relay Loop & Flood Controls:** Maximum hop limits (1–5 hops, default 3), 24-hour message TTL expiration, LRU duplicate suppression cache, and 5-forward/minute sliding window rate limiting.
- **Emergency Contact Prioritization:** Ranked contact hierarchy (Priority 1–5) with active/inactive toggles and multi-channel notification queuing.
- **Dual-Engine Interactive Map:** Full GPS-enabled map view with cluster markers, status color-coding, and an offline tactical radar fallback for non-Google Play devices.
- **Production-Hardened Security:** bcrypt password hashing (10 rounds), expirable JWT authentication, role-based access control, sliding window API rate limiting, and HTTP security headers (`nosniff`, `DENY`, `XSS`, `HSTS`).

---

## 5. Technology Stack Summary

| Subsystem | Framework / Technology | Version | Purpose |
|---|---|---|---|
| **Mobile Client** | React Native / Expo | SDK 52 | Cross-platform offline mobile application |
| **Local Database** | `expo-sqlite` | 15.1.4 | Embedded SQL store with Write-Ahead Logging |
| **BLE Radio (Central)** | `react-native-ble-plx` | 3.5.1 | Scanning, GATT client, peripheral discovery |
| **BLE Radio (Peripheral)**| `react-native-ble-peripheral` | 2.0.1 | Advertising, custom GATT server hosting |
| **Network Monitor** | `@react-native-community/netinfo` | 11.4.1 | Hardware network state & reachability listener |
| **Mapping Engine** | `react-native-maps` | 1.18.0 | Interactive incident navigation & geolocation |
| **Backend API** | Node.js / Express.js | 24.x / 4.21 | RESTful cloud gateway, ingestion & SSE server |
| **Admin Dashboard** | React / Vite / Tailwind CSS | 18.3 / 6.4 | Operations command center & incident triage |
| **Automated Testing** | Node.js Test Harness | Custom | 62 comprehensive integration & verification tests |

---

## 6. Project Safety & Regulatory Disclaimer

> [!CAUTION]
> **RescueLink is an academic engineering and open research implementation.**  
> It is **NOT** certified by government Public Safety Answering Points (PSAPs), the Federal Communications Commission (FCC E911), or European Emergency Number Association (EENA/112). It does not replace dialing certified emergency numbers (911, 112, 999) when standard telephone networks are operational.
