# RescueLink — REST & SSE API Documentation

**Document:** Comprehensive Cloud API Reference Specification  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0  
**Date:** October 2026  

---

## 1. API Conventions & Standard Headers

### 1.1 Base URL
- **Local Development:** `http://localhost:5000/api`
- **Android Emulator Loopback:** `http://10.0.2.2:5000/api`
- **Production Recommendation:** `https://api.rescuelink.org/api`

### 1.2 Authentication
All protected routes require a valid JSON Web Token (JWT) transmitted via the standard HTTP `Authorization` header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### 1.3 HTTP Security Headers Enforced
Every response transmitted by the backend includes standard protective headers:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 1.4 Rate Limiting Headers
Public and authenticated endpoints enforce sliding-window rate limiters. Response headers report client quota status:
```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 298
X-RateLimit-Reset: 1730386800
```

---

## 2. Authentication & Identity Endpoints

### 2.1 Register New User
Creates a new civilian, responder, or administrator user account. Passwords are automatically hashed with `bcrypt` (10 salt rounds).

- **Endpoint:** `POST /api/auth/register`
- **Auth Required:** No
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!",
  "role": "user"
}
```
- **Validation Rules:**
  - `name`: String, 2 to 60 characters.
  - `email`: Valid RFC 5322 email string (automatically normalized to lowercase).
  - `password`: String, minimum 8 characters.
  - `role`: Optional string (`user` or `admin`; defaults to `user`).
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "role": "user",
      "createdAt": "2026-10-31T10:00:00.000Z"
    }
  }
}
```
- **Error Responses:**
  - `400 Bad Request`: Validation failure (short password, invalid email format).
  - `409 Conflict`: Email already registered.

---

### 2.2 Login User
Authenticates user credentials and issues a signed JSON Web Token.

- **Endpoint:** `POST /api/auth/login`
- **Auth Required:** No (Rate limited to 30 requests/15-minutes)
- **Request Body:**
```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePassword123!"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "role": "user"
    }
  }
}
```
- **Error Responses:**
  - `401 Unauthorized`: Generic `"Invalid credentials"` message to prevent account enumeration.
  - `403 Forbidden`: Account is suspended by an administrator.

---

### 2.3 Get Current User Profile
Retrieves authenticated user details based on the transmitted JWT token.

- **Endpoint:** `GET /api/auth/me`
- **Auth Required:** Yes (`Bearer <token>`)
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "role": "user",
    "createdAt": "2026-10-31T10:00:00.000Z"
  }
}
```

---

## 3. Health & Readiness Endpoints

### 3.1 Basic Health Check
Liveness probe for load balancers and container orchestrators.

- **Endpoint:** `GET /api/health`
- **Auth Required:** No
- **Success Response (`200 OK`):**
```json
{
  "status": "healthy",
  "uptime": 3612.45,
  "timestamp": "2026-10-31T11:00:00.000Z"
}
```

---

### 3.2 Deep Readiness Probe
Verifies subsystem integrity, file storage write access, and memory statistics.

- **Endpoint:** `GET /api/ready`
- **Auth Required:** No
- **Success Response (`200 OK`):**
```json
{
  "status": "ready",
  "storage": "writable",
  "dataStores": {
    "users": 14,
    "alerts": 82,
    "contacts": 28,
    "notifications": 115,
    "auditLogs": 49
  },
  "memory": {
    "rssMB": 42.15,
    "heapUsedMB": 18.64
  },
  "timestamp": "2026-10-31T11:00:00.000Z"
}
```

---

## 4. Emergency Alerts REST Endpoints

### 4.1 Create Emergency Alert (Direct Cloud Dispatch)
Creates an emergency alert directly on the backend when cellular or Wi-Fi connectivity is present.

- **Endpoint:** `POST /api/alerts`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "emergencyType": "Medical Emergency",
  "details": "Trapped on 3rd floor staircase. Two injured.",
  "senderName": "Jane Doe",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```
- **Validation Rules:**
  - `emergencyType`: One of `Medical Emergency`, `Accident`, `Personal Safety`, `Fire`, `Other`, `Test / Drill`.
  - `latitude`: Number between -90 and 90 (required if longitude is provided).
  - `longitude`: Number between -180 and 180 (required if latitude is provided).
  - `details`: String, up to 500 characters.
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "c7a8b9d0-1234-4567-89ab-cdef01234567",
    "emergencyType": "Medical Emergency",
    "details": "Trapped on 3rd floor staircase. Two injured.",
    "senderName": "Jane Doe",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "status": "pending",
    "createdAt": "2026-10-31T10:05:00.000Z"
  }
}
```

---

### 4.2 List User's Alerts
Retrieves all alerts authored by or visible to the authenticated user.

- **Endpoint:** `GET /api/alerts`
- **Auth Required:** Yes
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "emergencyType": "Medical Emergency",
      "details": "Trapped on 3rd floor staircase. Two injured.",
      "senderName": "Jane Doe",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "status": "broadcasted",
      "createdAt": "2026-10-31T10:05:00.000Z"
    }
  ]
}
```

---

### 4.3 Get Alert by ID
Fetches a single emergency incident by unique identifier.

- **Endpoint:** `GET /api/alerts/:id`
- **Auth Required:** Yes
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "c7a8b9d0-1234-4567-89ab-cdef01234567",
    "emergencyType": "Medical Emergency",
    "details": "Trapped on 3rd floor staircase. Two injured.",
    "senderName": "Jane Doe",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "status": "broadcasted",
    "createdAt": "2026-10-31T10:05:00.000Z"
  }
}
```
- **Error Response:** `404 Not Found` if the alert does not exist or belongs to another user (non-admin).

---

### 4.4 Update Alert Status
Updates the lifecycle status of an emergency alert.

- **Endpoint:** `PATCH /api/alerts/:id/status`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "status": "Resolved"
}
```
- **Allowed Transitions:** Direct transition to `Acknowledged` is rejected (reserved for receiver confirmation). Owners can mark alerts as `Resolved`.

---

### 4.5 Acknowledge Alert (Receiver Confirmation)
Allows a responder or receiving node to confirm delivery of an emergency beacon.

- **Endpoint:** `POST /api/alerts/:id/acknowledge`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "responderName": "Search Team Lead",
  "note": "Ground unit en route with stretcher"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Alert acknowledged successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "Acknowledged",
    "acknowledgedAt": "2026-10-31T10:12:00.000Z"
  }
}
```

---

### 4.6 Opportunistic Mesh Sync Ingestion
Ingests batches of local and multi-device relayed alerts collected offline.

- **Endpoint:** `POST /api/alerts/sync`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "alerts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "emergencyType": "Medical Emergency",
      "details": "Compound fracture on ridge trail.",
      "senderName": "Alice Survivor",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "createdAt": "2026-10-31T09:30:00.000Z",
      "originalSenderId": "survivor-node-1",
      "forwarderId": "node-7b8c2d",
      "hopCount": 2,
      "maxHops": 3,
      "integrityHash": "4a7f9c2e"
    }
  ]
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "synced": 1,
  "already_synced": 0,
  "failed": 0,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "synced"
    }
  ]
}
```

---

### 4.7 Live Map Spatial Query
Returns mapped emergency incidents containing valid geospatial coordinates.

- **Endpoint:** `GET /api/alerts/map`
- **Auth Required:** Yes
- **Query Parameters:**
  - `status`: Optional filter (`pending`, `broadcasted`, `acknowledged`, `resolved`).
  - `type`: Optional category filter (`Medical Emergency`, `Fire`, etc.).
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "total": 1,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "emergencyType": "Medical Emergency",
      "senderName": "Alice Survivor",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "status": "broadcasted",
      "createdAt": "2026-10-31T09:30:00.000Z"
    }
  ]
}
```

---

### 4.8 Real-Time Server-Sent Events (SSE) Stream
Maintains a continuous HTTP event stream broadcasting live alert events to map and dashboard clients.

- **Endpoint:** `GET /api/alerts/stream`
- **Auth Required:** Yes (`?token=<JWT>` or `Authorization: Bearer <JWT>`)
- **Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- **Stream Event Example:**
```http
event: alert_created
data: {"id":"550e8400-e29b-41d4-a716-446655440000","emergencyType":"Fire","latitude":37.775,"longitude":-122.418}
```

---

## 5. Emergency Contacts Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/contacts` | List authenticated user's emergency contacts |
| `POST` | `/api/contacts` | Create a new contact (validates name, phone, email, priority) |
| `PUT` | `/api/contacts/:id` | Update contact information or toggle enabled status |
| `DELETE` | `/api/contacts/:id` | Delete an emergency contact |

---

## 6. Notification Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/notifications/dispatch` | Enqueue automated SMS/Email dispatch for an alert |
| `GET` | `/api/notifications/history` | Query masked notification delivery audit trail |
| `POST` | `/api/notifications/test` | Test dispatch an emergency notification to user's contacts |

---

## 7. Administrative Endpoints (Admin Role Required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/overview` | Aggregated dashboard KPI counters and system metrics |
| `GET` | `/api/admin/incidents` | Comprehensive filterable list of all incidents |
| `PATCH` | `/api/admin/incidents/:id/status` | Triage incident status (`investigating`, `resolving`, `resolved`) |
| `GET` | `/api/admin/users` | List all users with account status and roles |
| `PATCH` | `/api/admin/users/:id/status` | Suspend or activate a user account |
| `GET` | `/api/admin/audit-logs` | Retrieve immutable administrative audit trail |
| `GET` | `/api/admin/relays` | Telemetry on mesh hops and relay forwarders |
| `GET` | `/api/admin/notifications` | Delivery states and masked recipient audit log |
