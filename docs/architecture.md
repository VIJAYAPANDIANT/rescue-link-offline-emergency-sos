# RescueLink Architecture & Technical Specification

## System Overview

RescueLink is an **Offline Bluetooth Emergency SOS System** designed to facilitate emergency messaging and device-to-device mesh forwarding in disaster zones, remote regions, or cellular network outages.

```text
[ Emergency User ]
        │
        ▼ (Local Draft / SOS Activation)
[ React Native App (Mobile) ]
        │
   ┌────┴──────────────────────────┐
   ▼                               ▼
[ SQLite Local Database ]    [ BLE Mesh Layer ]
(Offline Logs & Queue)      (Advertising & Scanning)
                                   │
                                   ▼
                         [ Nearby Peer Devices ]
                                   │
                         (Opportunistic Relay)
                                   ▼
                        [ Peer with Internet ]
                                   │
                                   ▼ (HTTPS REST API)
                       [ Express Backend + MongoDB ]
                                   │
                                   ▼
                      [ Emergency Dispatch / Responders ]
```

---

## Core Components

### 1. Mobile Client (React Native + Expo)
- **Role**: User-facing emergency dashboard, quick-trigger SOS button, emergency form, and local device discovery dashboard.
- **Language**: JavaScript (ES6+).
- **Offline Storage**: SQLite database for local logs, queued alerts, and cached emergency contacts.
- **Hardware Integration**: Bluetooth Low Energy (BLE) peripheral/central roles, GPS/Location services.

### 2. Backend Server (Node.js + Express)
- **Role**: Central emergency ingestion, authentication, cloud persistence, and emergency responder dispatch.
- **Database**: MongoDB (cloud records, user profiles, synced incident reports).
- **Security**: JWT authentication, rate limiting, data sanitization.

### 3. Step 1 Boundaries & Safety Scoping
- **Implemented in Step 1**:
  - Express backend scaffold with `/api/health`.
  - Error-handling middleware and CORS configuration.
  - Complete Mobile SOS UI (Dashboard, Send SOS, Nearby Devices, Emergency History).
  - Component library (`SOSButton`, `StatusCard`, `EmergencyTypeSelector`, `PrimaryButton`, `EmptyState`).
  - Navigation flow.
- **Placeholders (Awaiting Next Steps)**:
  - Bluetooth scanning and advertising (Step 3).
  - SQLite persistent database storage (Step 3).
  - MongoDB user authentication and JWT middleware (Step 2).
  - Real emergency dispatching (Step 4).
