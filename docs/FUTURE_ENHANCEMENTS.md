# RescueLink — Future Enhancements & Architectural Roadmap

**Document:** System Evolution, Planned Enhancements & Research Roadmap  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0  
**Date:** October 2026  

---

## 1. Architectural Evolution Roadmap

```
+───────────────────────────────────────────────────────────────────────────────+
|                       RESCUELINK EVOLUTION PHASES                             |
+───────────────────────────────────────────────────────────────────────────────+
| Phase 1: Cryptographic E2EE           | Curve25519 & ChaCha20-Poly1305        |
| Phase 2: Distributed Cloud Cluster    | PostgreSQL (PostGIS) & Redis Pub/Sub  |
| Phase 3: LoRaWAN & Satellite Bridging | Meshtastic 915MHz & Iridium Satellite |
| Phase 4: Audio Distress Clips         | Low-bitrate Opus binary fragmentation |
| Phase 5: AI Geospatial Triage         | DBSCAN spatial clustering & routing   |
+───────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Phase 1: Cryptographic End-to-End Encryption (E2EE)

### Objective
Provide complete cryptographic confidentiality for emergency survivor details over open radio frequencies, preventing eavesdropping by untrusted civilian intermediary relay nodes.

### Proposed Cryptographic Architecture
- **Key Exchange:** Curve25519 (X25519) Diffie-Hellman key exchange.
- **Symmetric Cipher:** ChaCha20-Poly1305 Authenticated Encryption with Associated Data (AEAD).
- **Public Key Infrastructure (PKI):**
  - Emergency Operations Centers (EOC) register authoritative public keys on the cloud backend.
  - Survivors' mobile apps download trusted public keys during initial online setup.
  - When composing an SOS offline, the payload body (details, phone numbers, exact medical conditions) is encrypted using the public key of the regional emergency authority.
  - Intermediate mesh forwarders can inspect routing headers (hop count, expiration, emergency category) to facilitate relaying, but cannot decrypt the survivor's private health or identity data.

---

## 3. Phase 2: Distributed Enterprise Cloud Clustering

### Objective
Scale the central backend from a single-node prototype (~500 req/sec) to a high-availability, horizontally-scalable distributed cloud handling millions of simultaneous disaster reports.

### Proposed Architecture
- **Primary Database:** Migrate from JSON document stores to **PostgreSQL** with the **PostGIS** geospatial extension for sub-millisecond bounding-box and spatial proximity queries.
- **Distributed Cache & Message Broker:** Integrate **Redis Cluster** to manage:
  - Global sliding-window rate limiting across multiple backend pods.
  - Redis Pub/Sub backplane for real-time Server-Sent Events (SSE) and WebSocket event fan-out across multiple container instances.
- **Orchestration:** Deploy on Kubernetes (EKS / GKE) with automated Horizontal Pod Autoscaling (HPA) triggered by CPU utilization and request ingress volume.

---

## 4. Phase 3: Hardware LoRaWAN & Satellite Bridging

### Objective
Extend the communication range beyond BLE's 30-meter radio horizon to span tens of kilometers across rugged wilderness, mountain ranges, and flooded valleys.

```
[Survivor Phone] ──(BLE 30m)──► [Civilian Phone with LoRa Bridge] 
                                            │ (915 MHz LoRa - 15 km)
                                            ▼
[Search & Rescue Base Camp] ◄──(LoRa)── [Mountain Peak Repeater]
```

### Proposed Integration
- **LoRa Mesh Integration (Meshtastic / Semtech SX1262):** Interface smartphones via Bluetooth with low-cost ($25) battery-powered LoRa radios operating on license-free 915 MHz (Americas) or 868 MHz (Europe) ISM bands.
- **Direct Satellite SOS Bridge:** Integrate with next-generation 3GPP Release 17 Non-Terrestrial Network (NTN) satellite modems (Iridium Certus / Globalstar) to establish direct-to-orbit emergency telemetry when all ground mesh nodes fail.

---

## 5. Phase 4: Low-Bitrate Opus Audio Distress Clips

### Objective
Enable trapped survivors who are unable to type (due to severe crush injuries, blindness, or smoke inhalation) to transmit short 5-second voice distress memos over the offline BLE mesh.

### Proposed Implementation
- **Compression:** Compress 5-second voice memos using the **Opus Audio Codec** at 6 kbps, yielding an audio payload of approximately 3.75 kilobytes.
- **Binary Fragmentation Protocol:** Implement a Stop-and-Wait or Selective-Repeat chunking protocol splitting the 3.75 KB audio buffer into 8 sequential 512-byte GATT frames with 16-bit sequence numbers and CRC-32 integrity validation.
- **Reassembly:** Receiving devices reassemble the fragments into an `.opus` or `.m4a` file for playback by ground responders.

---

## 6. Phase 5: AI-Driven Geospatial Triage & Resource Routing

### Objective
Empower disaster response coordinators with automated situational intelligence to optimize ground rescue operations during mass-casualty events.

### Proposed Capabilities
- **Spatial Incident Clustering (DBSCAN):** Automatically cluster thousands of scattered distress signals into distinct geographic incident zones (e.g., "Collapsed Apartment Complex Alpha", "Flooded School Zone Beta").
- **Triage Priority Ranking:** Utilize NLP to parse incident descriptions, prioritizing life-threatening trauma (e.g., severe arterial bleeding, structural collapse) over minor property damage.
- **Optimal Route Dispatch:** Integrate elevation models and flood terrain maps to calculate the safest, fastest overland ingress paths for rescue boat crews and search-and-rescue teams.
