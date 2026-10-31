# RescueLink — System Architecture Specification

**Document:** Comprehensive System Architecture & Data Flow Guide  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0  
**Date:** October 2026  

---

## 1. System Architectural Overview

RescueLink operates as an asymmetric, distributed, store-and-forward emergency distress signaling network. The architecture is decomposed into three principal tiers:
1. **Edge Tier (Mobile Mesh Nodes):** Offline-first React Native (Expo) clients executing on civilian and responder smartphones, equipped with embedded SQLite storage, dual-mode Bluetooth Low Energy transceivers, and an autonomous epidemic relay engine.
2. **Gateway & Ingestion Tier (Express.js Backend):** High-throughput, stateless Node.js server exposing authenticated RESTful endpoints, SSE real-time broadcast streams, and atomic JSON file persistence.
3. **Command & Operations Tier (Admin Web App & Dispatch Pipelines):** Single-page operations dashboard (React 18, Vite 6, Tailwind CSS) providing live situational telemetry, spatial mapping, and automated SMTP/SMS notification dispatch to emergency contacts.

---

## 2. Diagram 1: Overall System Architecture

The following diagram illustrates the complete end-to-end topology of RescueLink across offline mesh boundaries and cloud-connected command facilities:

```mermaid
graph TD
    subgraph DisasterZone ["Disaster Impact Perimeter (Zero Infrastructure)"]
        subgraph NodeA ["Device A: Survivor (Offline)"]
            UI_A["Mobile UI: Send SOS"] --> SQLite_A[("SQLite Database<br/>WAL Mode")]
            SQLite_A --> Peripheral_A["BLE Peripheral Server<br/>GATT Adv (FEF0)"]
        end

        subgraph NodeB ["Device B: Mobile Relay (Offline)"]
            Scanner_B["BLE Central Scanner"] --> Admission_B["Relay Engine<br/>• Hash Validation<br/>• TTL & Loop Checks<br/>• Rate Limiter"]
            Admission_B --> SQLite_B[("SQLite Database<br/>Store & Forward")]
            SQLite_B --> Peripheral_B["BLE Peripheral Server<br/>Forward Hop (hopCount=1)"]
        end

        Peripheral_A -. "BLE Wireless Hop 1<br/>(MTU <= 512 bytes)" .-> Scanner_B
    end

    subgraph TransitZone ["Perimeter Edge (Intermittent Connectivity)"]
        subgraph NodeC ["Device C: Gateway Node (Online)"]
            Scanner_C["BLE Central Scanner"] --> SQLite_C[("SQLite Database<br/>Relay Record")]
            SQLite_C --> Outbox_C["Outbox Queue<br/>Exponential Backoff"]
            Outbox_C --> NetInfo_C{"NetInfo<br/>Online?"}
        end

        Peripheral_B -. "BLE Wireless Hop 2<br/>(forwarderId=Node-B)" .-> Scanner_C
    end

    subgraph CloudInfrastructure ["RescueLink Central Cloud Infrastructure"]
        NetInfo_C -- "HTTPS REST API<br/>POST /api/alerts/sync" --> ExpressAPI["Express.js API Gateway"]
        
        ExpressAPI --> SecurityMiddleware["Security Middleware<br/>• JWT Verification<br/>• Sliding Rate Limiter<br/>• Security Headers"]
        SecurityMiddleware --> AlertService["Alert Ingestion Service"]
        AlertService --> AtomicStores[("Atomic Storage<br/>• alerts.json<br/>• users.json<br/>• audit_logs.json")]
        
        AlertService --> SSEBroadcaster["SSE Event Stream<br/>GET /api/alerts/stream"]
        AlertService --> NotificationService["Notification Dispatch Engine"]
    end

    subgraph OperationsTier ["Emergency Command & External Gateways"]
        SSEBroadcaster -- "Real-Time Event Stream" --> AdminDashboard["Admin Operations Dashboard<br/>(React + Vite + Tailwind)"]
        NotificationService --> EmailGW["SMTP Email Provider<br/>(Emergency Contacts)"]
        NotificationService --> SMSGW["Twilio SMS Gateway<br/>(Emergency Contacts)"]
    end
```

---

## 3. Diagram 2: Mobile Application Architecture

The mobile client is engineered with clean layer separation, decoupling presentation logic from background hardware and persistence services:

```mermaid
flowchart TD
    subgraph UI_Layer ["Presentation & Navigation Layer"]
        App["App.js / NavigationContainer"]
        Tabs["Emergency Bottom Tabs"]
        HomeScreen["HomeScreen"]
        SendSOS["SendSOSScreen"]
        Nearby["NearbyDevicesScreen"]
        MapScreen["LiveEmergencyMapScreen"]
        ContactsScreen["EmergencyContactsScreen"]
        HistoryScreen["EmergencyHistoryScreen"]
        ProfileScreen["ProfileScreen"]
        
        App --> Tabs
        Tabs --> HomeScreen
        Tabs --> SendSOS
        Tabs --> Nearby
        Tabs --> MapScreen
        Tabs --> ContactsScreen
        Tabs --> HistoryScreen
        Tabs --> ProfileScreen
    end

    subgraph Context_Layer ["State & Theme Contexts"]
        AuthContext["AuthContext<br/>(JWT Token & User Session)"]
        ThemeContext["ThemeContext<br/>(Light / Dark Tokens & Contrast)"]
    end

    subgraph Service_Layer ["Core Domain Services"]
        BleManager["bleManager.js<br/>(Central & Peripheral Lifecycle)"]
        BleProtocol["bleProtocol.js<br/>(Serialization, MTU & FNV-1a)"]
        RelayService["relayService.js<br/>(Admission, Rate Limit & Duplicates)"]
        SyncService["syncService.js<br/>(Outbox Processor & Exponential Backoff)"]
        NetworkService["networkService.js<br/>(NetInfo + Active Reachability Ping)"]
        LocationService["locationService.js<br/>(GPS Capture & Permission Guard)"]
        NotificationQueueService["notificationQueueService.js<br/>(Contact Dispatch)"]
    end

    subgraph Data_Layer ["Persistence & Database Layer"]
        DB["database.js (expo-sqlite, WAL Mode)"]
        Migrations["migrations.js (v1 - v4 Schema Runner)"]
        AlertRepo["alertRepository.js"]
        ReceiptRepo["receiptRepository.js"]
        SyncRepo["syncQueueRepository.js"]
        RelayRepo["relayRepository.js"]
        ContactRepo["contactRepository.js"]
        NotifRepo["notificationRepository.js"]

        DB --> Migrations
        DB --> AlertRepo
        DB --> ReceiptRepo
        DB --> SyncRepo
        DB --> RelayRepo
        DB --> ContactRepo
        DB --> NotifRepo
    end

    UI_Layer --> Context_Layer
    UI_Layer --> Service_Layer
    Service_Layer --> Data_Layer
```

---

## 4. Diagram 3: Backend Architecture

The backend architecture is built with Node.js and Express.js, featuring layered separation of concerns, concurrency-safe atomic file stores, and event-driven broadcasting:

```mermaid
flowchart TD
    subgraph ClientRequests ["Inbound Ingestion & Web Traffic"]
        MobileClient["Mobile App (Sync / Auth / Contacts)"]
        AdminWeb["Admin Web Dashboard (Vite App)"]
    end

    subgraph MiddlewarePipeline ["Express Middleware Pipeline"]
        Cors["CORS Configuration"]
        SecurityHeaders["Security Headers (nosniff, DENY, HSTS)"]
        RateLimiter["Sliding Window Rate Limiter"]
        BodyParser["Express JSON Body Parser (10mb)"]
        AuthMiddleware["JWT Authentication Guard (authenticate)"]
        RoleGuard["RBAC Authorization Guard (authorizeRole)"]

        Cors --> SecurityHeaders --> RateLimiter --> BodyParser
    end

    subgraph RoutingLayer ["Express Routing Modules"]
        AuthRoutes["/api/auth (Login, Register, Me)"]
        AlertRoutes["/api/alerts (CRUD, Sync, Map, Stream)"]
        ContactRoutes["/api/contacts (CRUD Contacts)"]
        NotifRoutes["/api/notifications (Dispatch, History, Test)"]
        AdminRoutes["/api/admin (Overview, Incidents, Users, Audit)"]
        HealthRoutes["/api/health & /api/ready"]
    end

    subgraph ServiceLayer ["Backend Service Engines"]
        AlertService["alert.service.js"]
        NotificationService["notificationService.js"]
        UserStore["userStore.js (Mutex Protected)"]
        AlertStore["alertStore.js (Mutex Protected)"]
        ContactStore["contactStore.js (Mutex Protected)"]
        NotifStore["notificationStore.js (Mutex Protected)"]
        AuditStore["auditStore.js (Mutex Protected)"]
        SSEHub["sseStream.js (Active Client Connections)"]
    end

    subgraph PhysicalStorage ["Durable File Storage (data/)"]
        UsersJSON[("users.json")]
        AlertsJSON[("alerts.json")]
        ContactsJSON[("contacts.json")]
        NotifsJSON[("notifications.json")]
        AuditJSON[("audit_logs.json")]
    end

    ClientRequests --> MiddlewarePipeline
    MiddlewarePipeline --> RoutingLayer
    RoutingLayer --> ServiceLayer
    ServiceLayer --> PhysicalStorage
```

---

## 5. Diagram 4: Admin Dashboard Architecture

The Admin Dashboard provides a real-time reactive command-and-control interface for emergency operators:

```mermaid
flowchart TD
    subgraph ReactFrontend ["Admin Dashboard (React 18 + Vite 6 + Tailwind CSS)"]
        Router["App Router & Protected Route Guard"]
        
        subgraph Views ["Dashboard Views"]
            OverviewView["Overview View (Metric KPI Cards & Quick Stats)"]
            IncidentView["Incidents View (Filterable Grid, Status Updates)"]
            MapTrackingView["Live Emergency Map (Leaflet / Tactical Tracking)"]
            UserManagementView["Users View (Search, Roles, Suspend/Activate)"]
            RelayTelemetryView["Mesh Telemetry View (Hops, Forwarders, Latency)"]
            NotificationView["Notifications View (Masked History & Health)"]
            AuditLogView["Audit Trail View (Tamper-Evident Admin Actions)"]
        end

        subgraph ClientState ["Reactive State & Hooks"]
            AuthHook["useAuth (Admin JWT & Session Storage)"]
            SSEHook["useSSE (Live /api/alerts/stream Listener)"]
            ApiHook["apiClient (Authenticated REST Axios Client)"]
        end
    end

    subgraph BackendAPI ["Express.js Cloud Backend"]
        REST_Endpoints["Admin REST Endpoints (/api/admin/*)"]
        SSE_Stream["SSE Real-Time Stream (/api/alerts/stream)"]
    end

    Router --> Views
    Views --> ClientState
    ClientState --> REST_Endpoints
    SSEHook <--> SSE_Stream
```

---

## 6. Diagram 5: BLE SOS Communication Flow

The physical over-the-air communication lifecycle between an originating device and a nearby receiver node:

```mermaid
sequenceDiagram
    autonumber
    participant Survivor as Survivor (Device A)
    participant BLE_A as Device A BLE Peripheral
    participant BLE_B as Device B BLE Central
    participant Receiver as Responder (Device B)

    Survivor->>BLE_A: Compose SOS & Click "Broadcast SOS"
    BLE_A->>BLE_A: Sanitize Payload (Strip JWTs/Passwords)
    BLE_A->>BLE_A: Calculate 32-bit FNV-1a Integrity Checksum
    BLE_A->>BLE_A: Base64 Encode JSON Payload (MTU <= 512 bytes)
    BLE_A->>BLE_A: Start Advertising Service UUID 0000FEF0

    BLE_B->>BLE_B: Central Scanner Discovers Peripheral (FEF0)
    BLE_B->>BLE_A: Connect to GATT Server
    BLE_B->>BLE_A: Discover Characteristics
    BLE_B->>BLE_A: Read SOS Characteristic (0000FEF1)
    BLE_A-->>BLE_B: Return Encoded Payload Bytes

    BLE_B->>Receiver: Deliver Raw Base64 Payload
    Receiver->>Receiver: Decode & Validate FNV-1a Checksum
    Receiver->>Receiver: Store in SQLite (source='bluetooth', status='received')
    
    Receiver->>BLE_B: Generate Signed ACK Receipt (SOS_ACK)
    BLE_B->>BLE_A: Write Characteristic (0000FEF2) with ACK Payload
    BLE_A->>Survivor: Update SQLite ackStatus to 'acknowledged'
    Note over Survivor,Receiver: Survivor UI updates: "HELP IS ON THE WAY"
```

---

## 7. Diagram 6: Multi-Device Relay Workflow

The controlled epidemic routing mechanism forwarding emergency packets across multiple disconnected devices:

```mermaid
sequenceDiagram
    autonumber
    participant NodeA as Device A (Originator)
    participant NodeB as Device B (Intermediate Relay)
    participant NodeC as Device C (Terminal Relay / Ingestion)
    participant Cloud as RescueLink Cloud Backend

    Note over NodeA: Survivor Offline in Collapse Zone
    NodeA->>NodeA: Generate Alert (hopCount = 0, maxHops = 3)
    NodeA->>NodeB: BLE Wireless Transmission (Hop 1)

    Note over NodeB: Device B Evaluates Admission Policy
    NodeB->>NodeB: 1. Validate FNV-1a Integrity Hash (Pass)
    NodeB->>NodeB: 2. Check Expiration TTL < 24 hrs (Pass)
    NodeB->>NodeB: 3. Verify Loop Prevention: myNodeId != originalSenderId
    NodeB->>NodeB: 4. Check Hop Limit: hopCount (0) < maxHops (3)
    NodeB->>NodeB: 5. Check Rate Limiter: <= 5 forwards / minute
    NodeB->>NodeB: Store in SQLite (alerts & relay_history tables)
    NodeB->>NodeB: Prepare Forward: hopCount = 1, forwarderId = Node-B
    
    NodeB->>NodeC: BLE Wireless Transmission (Hop 2)

    Note over NodeC: Device C Receives & Validates
    NodeC->>NodeC: Verify Integrity Hash (Preserved, matches original)
    NodeC->>NodeC: Record in SQLite (hopCount = 1, forwarderId = Node-B)
    NodeC->>NodeC: Enqueue in Outbox (sync_queue)

    Note over NodeC: Node C Moves into Cellular Coverage
    NodeC->>NodeC: NetInfo Detects Internet Connectivity
    NodeC->>Cloud: POST /api/alerts/sync (Relay Batch Payload)
    Note over Cloud: Cloud Ingests Alert:<br/>• Attributes forward to Node C User ID<br/>• Preserves Survivor A identity & details<br/>• Records Hop Count = 1
    Cloud-->>NodeC: HTTP 200 OK (synced: 1, failed: 0)
    NodeC->>NodeC: Purge Outbox Queue
```

---

## 8. Diagram 7: SQLite Offline Storage Workflow

The transactional storage lifecycle ensuring Write-Ahead durability and migration consistency:

```mermaid
stateDiagram-v2
    [*] --> DatabaseInitialization: App Launches
    
    DatabaseInitialization --> CheckMigrations: Open SQLite Connection
    CheckMigrations --> ApplyMigrations: pragma user_version < 4
    CheckMigrations --> ConfigureWAL: pragma user_version >= 4
    
    ApplyMigrations --> ConfigureWAL: Run v1-v4 DDL Scripts
    
    ConfigureWAL --> Ready: PRAGMA journal_mode = WAL<br/>PRAGMA synchronous = NORMAL<br/>PRAGMA foreign_keys = ON

    state Ready {
        [*] --> Idle
        Idle --> InsertAlert: User Triggers SOS
        InsertAlert --> EnqueueOutbox: Write alerts table
        EnqueueOutbox --> Idle: Write sync_queue table (Atomic Tx)

        Idle --> IngestBLE: Received Peer Beacon
        IngestBLE --> DeduplicateCheck: Check alertId in SQLite
        DeduplicateCheck --> UpdateExisting: Already exists
        DeduplicateCheck --> InsertPeerAlert: New alertId
        InsertPeerAlert --> EnqueueOutbox: Write alerts & sync_queue
        UpdateExisting --> Idle
        
        Idle --> ProcessACK: Received Peer ACK
        ProcessACK --> AtomicACKReceipt: Write message_receipts
        AtomicACKReceipt --> UpdateAckStatus: Set alerts.ackStatus='acknowledged'
        UpdateAckStatus --> Idle
    }
```

---

## 9. Diagram 8: Cloud Synchronization Workflow

The opportunistic synchronization pipeline utilizing exponential backoff retry scheduling:

```mermaid
sequenceDiagram
    autonumber
    participant SyncService as syncService.js (Mobile)
    participant SyncRepo as syncQueueRepository (SQLite)
    participant NetInfo as networkService.js
    participant API as Express /api/alerts/sync

    loop Periodic Check or Network Event
        SyncService->>NetInfo: Is Network Connected & Reachable?
        alt Offline
            SyncService->>SyncService: Sleep until next network change event
        else Online
            SyncService->>SyncRepo: Query Eligible Items (now >= nextRetryAt)
            alt Queue Empty
                SyncService->>SyncService: No pending sync work
            else Items Found (e.g. 5 items)
                SyncService->>SyncService: Package Payload Batch with JWT Bearer
                SyncService->>API: POST /api/alerts/sync
                alt HTTP 200 Success
                    API-->>SyncService: { synced: 4, already_synced: 1, failed: 0 }
                    SyncService->>SyncRepo: Purge Processed Items from Queue
                    SyncService->>SyncService: Update alerts.syncStatus = 'synced'
                else HTTP 401 Unauthorized
                    API-->>SyncService: Unauthorized Token
                    SyncService->>SyncService: Halt Sync & Request User Re-Authentication
                else Network Timeout / 5xx Error
                    API-->>SyncService: Network Error
                    SyncService->>SyncRepo: Calculate Exponential Backoff:<br/>delay = min(5s * 2^attempts, 300s)<br/>nextRetryAt = now + delay
                end
            end
        end
    end
```

---

## 10. Diagram 9: Emergency Notification Workflow

The automated multi-channel contact notification engine triggered upon alert synchronization:

```mermaid
flowchart TD
    Trigger["Cloud Ingestion Service<br/>(Alert Synced or Created)"] --> FetchContacts["Query Enabled Emergency Contacts<br/>for Survivor (contactStore.js)"]
    
    FetchContacts --> ContactCheck{"Any Enabled<br/>Contacts Found?"}
    ContactCheck -- No --> LogSkip["Record Audit Log: No contacts configured"]
    ContactCheck -- Yes --> SortPriority["Sort Contacts by Priority Tier<br/>(Priority 1 to 5)"]

    SortPriority --> QueueTasks["Instantiate Notification Tasks<br/>(notificationStore.js)"]

    QueueTasks --> DispatchLoop["Concurrent Multi-Channel Dispatch Loop"]
    
    subgraph Channels ["Delivery Channels"]
        DispatchLoop --> EmailTask["SMTP Email Dispatcher"]
        DispatchLoop --> SMSTask["Twilio SMS Gateway"]
    end

    EmailTask --> EmailFormat["Format HTML Emergency Alert:<br/>• Survivor Name<br/>• Emergency Category<br/>• Incident Details<br/>• Google Maps Coordinate Link"]
    SMSTask --> SMSFormat["Format Short Text:<br/>'EMERGENCY: [Name] triggered [Type] SOS at [Lat, Lon]. Assistance required.'"]

    EmailFormat --> SendEmail["Transmit to SMTP Server"]
    SMSFormat --> SendSMS["POST to Twilio REST API"]

    SendEmail --> RecordResult["Record Delivery Attempt in notifications.json<br/>(Status: 'sent' or 'failed', Timestamp, Provider ID)"]
    SendSMS --> RecordResult

    RecordResult --> MaskTelemetry["Mask Recipient Details for Privacy:<br/>• al***@example.com<br/>• +1 ***-***-1234"]
    MaskTelemetry --> AdminTelemetry["Expose to Admin Dashboard & Audit Trail"]
```

---

## 11. Diagram 10: SOS Incident Lifecycle

The complete state transition graph of an emergency incident from survivor trigger to final resolution:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Survivor Opens SendSOSScreen
    
    DRAFT --> PENDING: User Presses "SEND SOS"<br/>(3s Countdown Initiated)
    PENDING --> DRAFT: User Cancels During Countdown
    
    PENDING --> BROADCASTED: Local SQLite Write Completed<br/>BLE Advertising Starts
    
    state "Mesh Transmission" as MeshState {
        BROADCASTED --> RECEIVED: Discovered by Nearby Responder
        RECEIVED --> ACKNOWLEDGED: Responder Sends Electronic ACK
        RECEIVED --> RELAY_FORWARDED: Intermediate Node Re-broadcasts
        RELAY_FORWARDED --> RECEIVED: Discovered by Second Hop Node
    }
    
    BROADCASTED --> SYNCING: Direct Network Connection Available
    ACKNOWLEDGED --> SYNCING: Network Connection Available
    RELAY_FORWARDED --> SYNCING: Relay Node Enters Cellular Coverage
    
    SYNCING --> SYNCED: Uploaded to Cloud Backend<br/>(POST /api/alerts/sync)
    
    SYNCED --> INVESTIGATING: Admin Triage at Operations Center
    INVESTIGATING --> RESOLVING: Field Rescue Team Dispatched
    RESOLVING --> RESOLVED: Survivor Safe & Evacuated
    
    RESOLVED --> [*]
```
