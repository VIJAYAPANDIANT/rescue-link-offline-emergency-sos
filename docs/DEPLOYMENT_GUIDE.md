# RescueLink — Production Deployment & Operations Guide

**Document:** Complete Deployment, Containerization & Infrastructure Operations Manual  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0 (Production Release)  
**Date:** October 2026  

---

## 1. System Deployment Architecture

The RescueLink production environment is structured across three runtime targets:
1. **Express.js API & Ingestion Backend:** Containerized Node.js service running behind an HTTPS reverse proxy (Nginx or Cloud PaaS).
2. **React Admin Command Dashboard:** Static Single-Page Application (SPA) built with Vite and distributed globally over an Edge CDN (Vercel, Netlify, or Nginx).
3. **Mobile Client Applications:** Native Android APK/AAB compiled via Expo Application Services (EAS) with full BLE binary drivers.

---

## 2. Environment Configuration Matrix

### 2.1 Backend Environment Variables (`server/.env`)

| Variable Name | Development Value | Production Recommendation | Security Criticality |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | **High** (Enforces 32-char secret check, security headers, and error masking) |
| `PORT` | `5000` | `5000` or `$PORT` | Low |
| `JWT_SECRET` | `your_jwt_secret_key_here` | 64+ char random hex (`openssl rand -hex 32`) | **Critical** (Server exits if default or $< 32$ chars in production) |
| `CORS_ORIGIN` | `*` | `https://admin.rescuelink.org,https://app.rescuelink.org` | **High** (Restricts browser API access) |
| `STORAGE_DIR` | `./data` | `/var/lib/rescuelink/data` (persistent mount) | **Critical** (Must persist across container restarts) |
| `RATE_LIMIT_MAX` | `300` | `300` | Medium (Max requests/minute on public API) |
| `AUTH_RATE_LIMIT_MAX`| `30` | `30` | High (Max login attempts/15-min window) |
| `SMTP_HOST` | `smtp.example.com` | Verified SMTP relay (e.g., SendGrid, Mailgun) | Medium |
| `TWILIO_ACCOUNT_SID` | `AC_demo` | Production Twilio Account SID | High |

### 2.2 Admin Dashboard Environment Variables (`admin/.env`)

| Variable Name | Development Value | Production Recommendation | Description |
|---|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` | `https://api.rescuelink.org/api` | Base URL of the backend REST & SSE API |

### 2.3 Mobile Client Environment Variables (`mobile/.env`)

| Variable Name | Development Value | Production Recommendation | Description |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:5000/api` | `https://api.rescuelink.org/api` | Cloud endpoint reachable by mobile devices |

---

## 3. Backend Deployment Procedures

### Option A: Docker Containerization (Recommended)

1. **Dockerfile (`server/Dockerfile`):**
```dockerfile
# Multi-stage build for minimal attack surface
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /app /app

# Ensure persistent data directory exists
RUN mkdir -p /app/data
VOLUME /app/data

ENV NODE_ENV=production
EXPOSE 5000

# Container liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
```

2. **Docker Compose (`docker-compose.prod.yml`):**
```yaml
version: '3.8'

services:
  rescuelink-api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: rescuelink-api
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=5000
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://admin.rescuelink.org
      - STORAGE_DIR=/app/data
    volumes:
      - rescuelink-data:/app/data
    ports:
      - "127.0.0.1:5000:5000"

volumes:
  rescuelink-data:
    driver: local
```

3. **Launch Service:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

### Option B: Cloud PaaS (Render / Railway / Fly.io)

1. **Deploy to Render / Railway:**
   - Connect GitHub repository.
   - Set Root Directory: `server`.
   - Build Command: `npm ci --only=production`.
   - Start Command: `node server.js`.
   - Attach a **Persistent Disk** mounted at `/app/data` (size: 5 GB).
   - Configure Environment Variables (`NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN`).

---

### Option C: Linux Systemd Daemon + Nginx Reverse Proxy

1. **Create Systemd Service (`/etc/systemd/system/rescuelink.service`):**
```ini
[Unit]
Description=RescueLink Emergency Cloud Gateway
After=network.target

[Service]
Type=simple
User=rescuelink
WorkingDirectory=/opt/rescuelink/server
EnvironmentFile=/opt/rescuelink/server/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rescuelink

[Install]
WantedBy=multi-user.target
```

2. **Configure Nginx with SSE & WebSocket Support (`/etc/nginx/sites-available/rescuelink`):**
```nginx
server {
    server_name api.rescuelink.org;

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE (Server-Sent Events) Streaming Configuration
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/api.rescuelink.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rescuelink.org/privkey.pem;
}
```

---

## 4. Admin Dashboard Deployment (Vite SPA)

The Admin Dashboard builds into high-efficiency static assets (HTML, CSS, JS):

```bash
cd admin
npm install
npm run build
```
Output directory: `admin/dist`

### Static CDN Deployment (Vercel / Netlify / Cloudflare Pages)
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:** `VITE_API_URL=https://api.rescuelink.org/api`
- **SPA Rewrite Rule:** Route all requests to `/index.html` (e.g. `/* /index.html 200` in Netlify `_redirects`).

---

## 5. Mobile Application Compilation (Expo & EAS)

> [!IMPORTANT]
> Because RescueLink requires native hardware Bluetooth Low Energy drivers (`react-native-ble-plx`, `react-native-ble-peripheral`), it **cannot** run inside standard Expo Go. It must be built using an Expo Development Client or compiled into a standalone APK.

### 5.1 Local Development Build (Android)
```bash
cd mobile
npm install
# Generate android native project & launch debug APK on USB-connected device
npx expo run:android
```

### 5.2 Production Standalone Build (Expo Application Services - EAS)
1. **Install EAS CLI:**
```bash
npm install -g eas-cli
eas login
```

2. **Configure `eas.json`:**
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.rescuelink.org/api"
      }
    }
  }
}
```

3. **Execute Cloud Build:**
```bash
eas build --platform android --profile production
```
Download the resulting standalone `.apk` directly to responder test devices.

---

## 6. Maintenance, Health Probes & Backup Strategy

### 6.1 Automated Health Probes
Configure your monitoring tool (Datadog, UptimeRobot, Prometheus) to query:
- `GET https://api.rescuelink.org/api/health` (every 60 seconds)
- `GET https://api.rescuelink.org/api/ready` (every 5 minutes)

### 6.2 Data Backup & Recovery
All emergency incidents, users, contacts, and audit logs are safely stored in `server/data/`. Schedule an automated daily cron job to create encrypted backups:
```bash
# Automated Daily Backup Script
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/rescuelink_data_${DATE}.tar.gz /var/lib/rescuelink/data/
```
