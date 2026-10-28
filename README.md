# RescueLink — Offline Bluetooth Emergency SOS System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v24.x-green.svg)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%20SDK%2052-orange.svg)](https://expo.dev/)

> **Step 1: Project Setup and SOS Mobile UI**

---

## 🚨 Project Overview

**RescueLink** is a mission-critical, offline-first mobile emergency response application. In scenarios involving natural disasters (earthquakes, hurricanes, floods), wilderness expeditions, or catastrophic power grid failures, traditional cellular networks and internet infrastructure frequently fail.

RescueLink bridges this communication gap by establishing a **device-to-device Bluetooth Low Energy (BLE) mesh network**. Smartphones running RescueLink can compose emergency distress beacons, store them in a local SQLite database, and multi-hop relay packets across nearby peers until a node with active internet connectivity is encountered to synchronize the distress data to cloud emergency responders.

---

## ⚠️ Important Safety & Ethical Notice

> [!IMPORTANT]
> **RescueLink is currently in active staged prototype development (Step 1).**
> - In Step 1, the **Send SOS** action creates only a **locally labeled demonstration state or draft**.
> - **No real emergency broadcast, Bluetooth transmission, or 911/112 notification is performed.**
> - This application is **NOT a replacement for certified emergency dispatch services**. In an active emergency where cellular networks are operational, always dial 911 or your local emergency hotline immediately.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Mobile Client** | React Native (JavaScript) + Expo SDK 52 | Cross-platform mobile emergency user interface |
| **Backend API** | Node.js + Express.js | Central REST API server & cloud ingestion |
| **Mesh Transport** | Bluetooth Low Energy (BLE) | Offline peer-to-peer ad-hoc beacon transmission (Step 3) |
| **Local Storage** | SQLite (expo-sqlite) | Offline-first persistent storage for emergency audit logs (Step 3) |
| **Cloud Storage** | MongoDB | Long-term incident persistence and responder dashboards (Step 2+) |
| **Security** | JSON Web Tokens (JWT) & bcrypt | Cryptographic session auth and profile management (Step 2) |
| **Location & Maps** | GPS & Google Maps API | Real-time coordinate lock & spatial emergency visualization |
| **API Testing** | Postman / cURL | HTTP API validation and endpoint verification |

---

## 📁 Repository Structure

```text
c:\Offline Emergency SOS/
├── mobile/
│   ├── App.js                         # Root React Native application entry
│   ├── app.json                       # Expo configuration & app metadata
│   ├── babel.config.js                # Babel compilation config
│   ├── package.json                   # Mobile dependencies & scripts
│   ├── assets/                        # App icons, splash, & metadata assets
│   └── src/
│       ├── components/                # Reusable UI component library
│       │   ├── SOSButton.js           # Animated glowing circular SOS trigger
│       │   ├── StatusCard.js          # Color-coded system status card
│       │   ├── EmergencyTypeSelector.js # Category picker (Medical, Fire, etc.)
│       │   ├── PrimaryButton.js       # Accessible buttons (Danger, Outline, etc.)
│       │   ├── EmptyState.js          # Friendly zero-data state component
│       │   └── index.js
│       ├── screens/                   # Core application screens
│       │   ├── HomeScreen.js          # Emergency dashboard with sensors & quick actions
│       │   ├── SendSOSScreen.js       # SOS composer, review, & confirmation
│       │   ├── NearbyDevicesScreen.js # BLE mesh topology (awaiting Step 3)
│       │   ├── EmergencyHistoryScreen.js # Local offline audit log & drafts
│       │   └── index.js
│       ├── navigation/                # Mobile navigation system
│       │   ├── AppNavigator.js        # Fluid screen router & emergency bottom tabs
│       │   └── index.js
│       ├── services/                  # Business & hardware services
│       │   ├── bluetooth/
│       │   │   └── bluetoothService.js # BLE interface blueprint (Step 3)
│       │   ├── location/
│       │   │   └── locationService.js  # GPS coordinate provider & fallback
│       │   ├── api/
│       │   │   └── apiClient.js        # REST client connecting to Express server
│       │   └── sync/
│       │       └── syncService.js      # Opportunistic cloud sync blueprint
│       ├── database/
│       │   └── dbPlaceholder.js       # SQLite relational schema blueprint
│       └── utils/
│           ├── constants.js           # Emergency categories, status & disclaimers
│           ├── theme.js               # Emergency color palette, spacing & typography
│           └── helpers.js             # Formatter functions (coords, dates, IDs)
├── server/
│   ├── config/
│   │   └── env.js                     # Validated environment loader
│   ├── controllers/
│   │   └── health.controller.js       # Health check controller
│   ├── middleware/
│   │   ├── error.middleware.js        # Central Express error handler
│   │   └── notFound.middleware.js     # Standardized 404 handler
│   ├── models/
│   │   └── alert.model.placeholder.js # MongoDB EmergencyAlert schema blueprint
│   ├── routes/
│   │   ├── health.routes.js           # GET /api/health route
│   │   └── index.js                   # Central route aggregator
│   ├── services/
│   │   └── alert.service.placeholder.js # Alert delivery service blueprint
│   ├── .env                           # Local environment configuration
│   ├── .env.example                   # Environment variable template
│   ├── package.json                   # Server dependencies & scripts
│   └── server.js                      # Express application entry point
├── docs/
│   ├── architecture.md                # System design & multi-hop BLE mesh specs
│   └── api-specs.md                   # REST API documentation
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.x, v20.x, or v24.x installed
- **npm** or **yarn**
- **Expo Go** app on your physical iOS/Android device (optional for mobile testing)

---

### Step 1: Starting the Backend API

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server using Nodemon:
   ```bash
   npm run dev
   ```

   *Alternatively, start in production mode:*
   ```bash
   npm start
   ```

4. Verify backend health in terminal or browser:
   - **URL**: `http://localhost:5000/api/health`
   - **Expected Output**:
     ```json
     {
       "success": true,
       "status": "healthy",
       "message": "RescueLink Emergency SOS Backend API is running smoothly.",
       "service": "RescueLink Backend",
       "version": "1.0.0",
       "timestamp": "2026-10-25T15:00:00.000Z",
       "uptime": "12s",
       "environment": "development"
     }
     ```

---

### Step 2: Starting the Mobile Application

1. Open a new terminal and navigate to the `mobile/` directory:
   ```bash
   cd mobile
   ```

2. Install mobile dependencies:
   ```bash
   npm install
   ```

3. Launch the Expo development server:
   ```bash
   npm start
   ```

4. Preview the mobile UI:
   - Press `w` in the terminal to view in **Web Browser**
   - Press `a` to run on an connected **Android Emulator**
   - Scan the QR code using the **Expo Go** mobile app on your smartphone

---

## 📱 Mobile Screens Overview

### 1. Home / Emergency Dashboard
- **Prominent SOS Button**: Central 170dp circular crimson button with continuous glowing breathing animation.
- **System Status Cards**:
  - Bluetooth Radio (BLE Standby)
  - Internet Connectivity (Offline Mesh Mode)
  - GPS Position (`12.9716° N, 77.5946° E`, accuracy ±8.5m)
  - Backend Server Health (Live HTTP probe against `http://localhost:5000`)
- **Quick Action Portals**: Fast navigation to Nearby Devices & Emergency History.
- **Emergency Disclaimer**: Prominent alert banner reinforcing non-guarantee and official channel protocol.

### 2. Send SOS Screen
- **Emergency Category Selector**: Interactive selection across Medical, Accident, Personal Safety, Fire, and Other.
- **GPS Coordinates Card**: Visual confirmation of attached latitude and longitude.
- **Incident Details Input**: Multiline text area for situation description (people affected, hazards).
- **Optional ICE Contact Input**: Contact name and emergency telephone number.
- **Pre-Dispatch Review**: Summary card confirming category and coordinates before submission.
- **Confirmation Dialog**: System `Alert.alert` verifying intent.
- **Local Demonstration State**: Confirms local draft creation and strictly disclaims live transmission.

### 3. Nearby Devices Screen
- **Radio Status**: BLE peripheral and central standby status.
- **Mesh Pipeline Breakdown**: Clear 3-step explanation of multi-hop forwarding.
- **Friendly Empty State**: Confirms 0 nearby devices without fabricating fake peers.
- **Interactive Test Button**: Triggers simulated BLE stack check.

### 4. Emergency History Screen
- **Session Drafts**: Displays any demonstration drafts created during the current app session.
- **Metadata Cards**: Timestamp, category badge, coordinates, and contact details.
- **Empty State**: Friendly guide when no alerts have been created yet.
- **Architecture Note**: Details upcoming Step 3 SQLite persistent storage.

---

## 🧩 Reusable Component Library

- **`SOSButton`**: Animated pulsing circular trigger with tactile touch feedback and accessible labels.
- **`StatusCard`**: Reusable container displaying subsystem icons, values, and status badges (Green/Blue/Amber/Red).
- **`EmergencyTypeSelector`**: Radio-selectable emergency category list with color coding and descriptive subtitles.
- **`PrimaryButton`**: Accessible multi-variant button supporting `danger`, `primary`, `secondary`, and `outline` states with loading indicators.
- **`EmptyState`**: Zero-data illustration container with descriptive guidance and action triggers.

---

## 🧭 Project Roadmap

- [x] **Step 1: Project Setup and SOS Mobile UI** (Completed)
  - Express server scaffold & `GET /api/health`
  - React Native Expo application structure
  - Reusable emergency design system and components
  - Complete 4-screen mobile workflow
- [x] **Step 2: User Authentication & JWT-Protected APIs** (Completed)
  - Atomic JSON user storage (`server/data/users.json`) with race-condition mutex
  - Password hashing with bcrypt (10 salt rounds)
  - Registration (`POST /api/auth/register`), Login (`POST /api/auth/login`), and Profile (`GET /api/auth/me`)
  - JWT token generation & verification middleware
  - Mobile authentication context (`AuthContext.js`), Login, Register, and Profile screens
- [x] **Step 3: SOS Alert Creation & Emergency Alert Management** (Completed)
  - Concurrency-safe atomic JSON alert store (`server/data/alerts.json`) with serialization lock
  - Robust backend validation: allowed types, coordinates (-90 to 90, -180 to 180), length bounds
  - JWT ownership security: cross-user isolation, automatic sender ID/name derivation
  - REST endpoints: `POST /api/alerts`, `GET /api/alerts`, `GET /api/alerts/:id`, `PATCH /api/alerts/:id/status`
  - React Native Send SOS form connected with authenticated submission, optional location acquisition, and review modal
  - Emergency History connected to live backend with pull-to-refresh and "Mark as Resolved" capability
- [ ] **Step 4: Bluetooth Low Energy (BLE) Mesh & Local SQLite Database**
  - Native BLE peripheral advertising & central scanning
  - Multi-hop packet relaying and receiver acknowledgment
  - Offline-first SQLite database schema & opportunistic sync
- [ ] **Step 5: Cloud Synchronization & First Responder Dashboard**
  - MongoDB migration & cloud ingestion
  - Real-time incident mapping & first responder dispatch interface
