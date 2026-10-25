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

## 2. Planned Endpoints (Step 2+)

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | Step 2 |
| `POST` | `/api/auth/login` | Login and obtain JWT token | Step 2 |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Step 2 |
| `POST` | `/api/alerts` | Ingest synced emergency alert | Step 4 |
| `GET` | `/api/alerts` | Query active emergency alerts | Step 4 |
| `POST` | `/api/alerts/:id/ack` | Acknowledge alert reception | Step 4 |
