# RescueLink API Specifications

## Base URL
- Local Development: `http://localhost:5000`
- Mobile Emulation (Android): `http://10.0.2.2:5000`
- LAN Device: `http://<YOUR_LOCAL_IP>:5000`

---

## 1. System Health Check

### `GET /api/health`
Checks whether the Express server is up and responsive.

#### Request
- **Method**: `GET`
- **Headers**: None required
- **Body**: None

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "status": "healthy",
  "message": "RescueLink Emergency SOS Backend API is running smoothly.",
  "service": "RescueLink Backend",
  "version": "1.0.0",
  "timestamp": "2026-10-28T16:00:00.000Z",
  "uptime": "42s",
  "environment": "development"
}
```

---

## 2. Authentication Endpoints (Step 2)

### `POST /api/auth/register`
Registers a new emergency responder or civilian account.

#### Request
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "name": "Alex Rivera",
  "email": "alex.rivera@rescuelink.org",
  "password": "securePassword123"
}
```

#### Validation Rules
- `name`: String, minimum 2 characters.
- `email`: Valid email format. Automatically normalized to lowercase and trimmed.
- `password`: String, minimum 6 characters. Hashed using `bcrypt` (10 rounds).

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "User registered successfully.",
  "user": {
    "id": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
    "name": "Alex Rivera",
    "email": "alex.rivera@rescuelink.org",
    "createdAt": "2026-10-26T18:32:30.615Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /api/auth/login`
Authenticates user credentials and issues a signed JSON Web Token (JWT).

#### Request
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "email": "alex.rivera@rescuelink.org",
  "password": "securePassword123"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Login successful.",
  "user": {
    "id": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
    "name": "Alex Rivera",
    "email": "alex.rivera@rescuelink.org",
    "createdAt": "2026-10-26T18:32:30.615Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `GET /api/auth/me`
Retrieves the profile of the currently authenticated responder.

#### Request
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "user": {
    "id": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
    "name": "Alex Rivera",
    "email": "alex.rivera@rescuelink.org",
    "createdAt": "2026-10-26T18:32:30.615Z"
  }
}
```

---

## 3. Emergency Alert Endpoints (Step 3)

All alert endpoints require a valid JWT via `Authorization: Bearer <token>`.

### `POST /api/alerts`
Creates an emergency distress alert.

#### Request
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
```json
{
  "emergencyType": "Medical Emergency",
  "details": "Severe heat exhaustion and dehydration",
  "contactDetails": "ICE: 555-0199",
  "location": {
    "latitude": 13.0827,
    "longitude": 80.2707
  }
}
```

#### Validation & Derivation Rules
- `emergencyType`: **Required**. Must be one of:
  - `"Medical Emergency"`
  - `"Accident"`
  - `"Personal Safety"`
  - `"Fire"`
  - `"Other"`
- `details`: **Optional**. String up to 1000 characters.
- `contactDetails`: **Optional**. String up to 200 characters.
- `location`: **Optional**. If provided:
  - Both `latitude` and `longitude` are required together.
  - `latitude`: Finite number between -90 and 90.
  - `longitude`: Finite number between -180 and 180.
  - If omitted or null, `location: null`.
- `senderId`: **Derived** from the verified JWT payload (`req.user.id`).
- `senderName`: **Derived** from the user's registered account profile (`user.name`).
- `status`: **Server-assigned** initial value is always `"Pending"`.
- `id`, `createdAt`, `updatedAt`: **Server-generated**.

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "Emergency alert created successfully",
  "data": {
    "id": "8366b220-e42d-458c-94b6-500f3fd9047e",
    "senderId": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
    "senderName": "Alex Rivera",
    "emergencyType": "Medical Emergency",
    "details": "Severe heat exhaustion and dehydration",
    "contactDetails": "ICE: 555-0199",
    "location": {
      "latitude": 13.0827,
      "longitude": 80.2707
    },
    "status": "Pending",
    "createdAt": "2026-10-28T16:40:00.000Z",
    "updatedAt": "2026-10-28T16:40:00.000Z"
  }
}
```

#### Error Responses
- `400 Bad Request` (`INVALID_EMERGENCY_TYPE`): Unknown category.
- `400 Bad Request` (`INCOMPLETE_COORDINATES`): Only latitude or longitude provided without the other.
- `400 Bad Request` (`INVALID_LATITUDE` / `INVALID_LONGITUDE`): Coordinates out of bounds.
- `401 Unauthorized` (`TOKEN_REQUIRED` / `TOKEN_INVALID`): Missing or invalid JWT.

---

### `GET /api/alerts`
Retrieves all alerts created by the authenticated user, sorted newest first.

#### Request
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Query Parameters**:
  - `status` *(optional)*: Filter by `"Pending"`, `"Acknowledged"`, or `"Resolved"`.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Alerts retrieved successfully",
  "data": [
    {
      "id": "8366b220-e42d-458c-94b6-500f3fd9047e",
      "senderId": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
      "senderName": "Alex Rivera",
      "emergencyType": "Medical Emergency",
      "details": "Severe heat exhaustion and dehydration",
      "contactDetails": "ICE: 555-0199",
      "location": {
        "latitude": 13.0827,
        "longitude": 80.2707
      },
      "status": "Pending",
      "createdAt": "2026-10-28T16:40:00.000Z",
      "updatedAt": "2026-10-28T16:40:00.000Z"
    }
  ]
}
```

---

### `GET /api/alerts/:id`
Retrieves a specific alert by ID owned by the authenticated user.

#### Request
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Alert retrieved successfully",
  "data": {
    "id": "8366b220-e42d-458c-94b6-500f3fd9047e",
    "senderId": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
    "senderName": "Alex Rivera",
    "emergencyType": "Medical Emergency",
    "details": "Severe heat exhaustion and dehydration",
    "contactDetails": "ICE: 555-0199",
    "location": {
      "latitude": 13.0827,
      "longitude": 80.2707
    },
    "status": "Pending",
    "createdAt": "2026-10-28T16:40:00.000Z",
    "updatedAt": "2026-10-28T16:40:00.000Z"
  }
}
```

#### Error Responses
- `404 Not Found` (`ALERT_NOT_FOUND`): Alert does not exist OR belongs to another user (prevents data leakage).

---

### `PATCH /api/alerts/:id/status`
Allows the sender to update their alert status to `"Resolved"`.

#### Request
- **Method**: `PATCH`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
```json
{
  "status": "Resolved"
}
```

#### Transition Rules
- Supported transition in Step 3: `"Pending"` → `"Resolved"`.
- Direct transition to `"Acknowledged"` is rejected (HTTP 400), as acknowledgment is reserved for receiver device confirmation in Step 4.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Alert status updated successfully",
  "data": {
    "id": "8366b220-e42d-458c-94b6-500f3fd9047e",
    "senderId": "f97186f6-14af-42e6-b6b9-1b2c393acfe9",
    "senderName": "Alex Rivera",
    "emergencyType": "Medical Emergency",
    "status": "Resolved",
    "updatedAt": "2026-10-28T16:45:00.000Z"
  }
}
```

---

## 4. Postman Testing Guide (12 Test Scenarios)

1. **Create Alert with Valid JWT**: `POST /api/alerts` with Bearer token and valid body → `201 Created`.
2. **Each Supported Type**: Test `"Medical Emergency"`, `"Accident"`, `"Personal Safety"`, `"Fire"`, and `"Other"` → all return `201 Created`.
3. **Alert Without Location**: Send body without `location` → returns `201 Created` with `"location": null`.
4. **Reject Invalid Type**: Send `emergencyType: "Alien Invasion"` → `400 Bad Request` (`INVALID_EMERGENCY_TYPE`).
5. **Reject Invalid Coordinates**:
   - Only `latitude` without `longitude` → `400 Bad Request` (`INCOMPLETE_COORDINATES`).
   - `latitude: 95.0` → `400 Bad Request` (`INVALID_LATITUDE`).
   - `longitude: 200.0` → `400 Bad Request` (`INVALID_LONGITUDE`).
6. **List Authenticated Alerts**: `GET /api/alerts` → `200 OK`, sorted newest first.
7. **Retrieve Alert by ID**: `GET /api/alerts/:id` with creator's token → `200 OK`.
8. **Update Alert to Resolved**: `PATCH /api/alerts/:id/status` with `{"status": "Resolved"}` → `200 OK`.
9. **Request Without JWT**: `GET /api/alerts` without `Authorization` header → `401 Unauthorized` (`TOKEN_REQUIRED`).
10. **Cross-User Access Check**: `GET /api/alerts/:id` using a different user's JWT → `404 Not Found` (`ALERT_NOT_FOUND`).
11. **Cross-User Modify Check**: `PATCH /api/alerts/:id/status` using a different user's JWT → `404 Not Found` (`ALERT_NOT_FOUND`).
12. **Disk Persistence Check**: Inspect `server/data/alerts.json` to verify atomic writes and state persistence across server restarts.

---

## 5. Planned Endpoints (Step 4+)

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| `POST` | `/api/alerts/:id/ack` | Receiver BLE acknowledgement | Step 4 |
| `POST` | `/api/sync/mesh` | Multi-hop BLE mesh batch packet ingestion | Step 4 |
| `GET` | `/api/responder/live-feed` | Real-time map distress feed for first responders | Step 4 |
