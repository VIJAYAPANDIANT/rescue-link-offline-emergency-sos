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
  "timestamp": "2026-10-25T15:00:00.000Z",
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

#### Error Responses
- `400 Bad Request` (`VALIDATION_ERROR`): Missing or invalid fields.
- `409 Conflict` (`EMAIL_ALREADY_EXISTS`): Email is already registered.

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

#### Error Responses
- `400 Bad Request` (`MISSING_FIELDS`): Missing email or password.
- `401 Unauthorized` (`INVALID_CREDENTIALS`): Email not found or password incorrect.

---

### `GET /api/auth/me`
Retrieves the profile of the currently authenticated responder.

#### Request
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**: None

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

#### Error Responses
- `401 Unauthorized` (`TOKEN_REQUIRED`): Missing `Authorization` header.
- `401 Unauthorized` (`TOKEN_INVALID`): Tampered or malformed token.
- `401 Unauthorized` (`TOKEN_EXPIRED`): Expired token.
- `404 Not Found` (`USER_NOT_FOUND`): User ID in token does not match any record.

---

## 3. Postman Testing Guide

1. **Register**: Send a `POST` request to `http://localhost:5000/api/auth/register` with `{ "name": "...", "email": "...", "password": "..." }`. Copy the `token` from the response.
2. **Access Protected Route**: Send a `GET` request to `http://localhost:5000/api/auth/me`. In the **Authorization** tab, select **Bearer Token** and paste the copied token.
3. **Login**: Send a `POST` request to `http://localhost:5000/api/auth/login` to obtain a fresh token.

---

## 4. Planned Endpoints (Step 3+)

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| `POST` | `/api/alerts` | Ingest synced emergency alert | Step 4 |
| `GET` | `/api/alerts` | Query active emergency alerts | Step 4 |
| `POST` | `/api/alerts/:id/ack` | Acknowledge alert reception | Step 4 |
