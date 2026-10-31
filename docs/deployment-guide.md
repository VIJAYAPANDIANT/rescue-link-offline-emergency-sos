# RescueLink — Production Deployment & Operations Guide

**System:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0 (Step 12 Production Hardening)  
**Target Architecture:**
- **Backend:** Node.js / Express Containerized Service or Systemd Daemon
- **Admin Dashboard:** Static Web App (Vite React) on Edge CDN (Vercel / Netlify / Nginx)
- **Mobile Client:** React Native Expo (Android APK / AAB & iOS IPA via EAS Build)

---

## 1. Environment Configuration Matrix

RescueLink enforces strict startup validation for environment variables. Ensure the following variables are configured per environment.

### Backend Environment Variables (`server/.env`)

| Variable | Development Default | Production Recommendation | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development` | `production` | Enables production security headers, error masking, and optimized logging |
| `PORT` | `5000` | `5000` or assigned container port | HTTP server listen port |
| `JWT_SECRET` | `your_jwt_secret_key_here` | 64+ char random hex string (`openssl rand -hex 32`) | Cryptographic secret for signing JWT tokens |
| `CORS_ORIGIN` | `*` | `https://admin.rescuelink.org,https://app.rescuelink.org` | Comma-separated list of allowed web origins |
| `STORAGE_DIR` | `./data` | `/var/lib/rescuelink/data` (persistent volume) | Path to persistent JSON storage files |
| `RATE_LIMIT_MAX` | `300` | `300` | Max requests per minute per IP on public API |
| `AUTH_RATE_LIMIT_MAX` | `30` | `30` | Max login/register attempts per 15 minutes per IP |

> [!CAUTION]
> The backend will abort startup (`process.exit(1)`) in `production` mode if `JWT_SECRET` is left as default or contains fewer than 32 characters.

### Admin Dashboard Environment Variables (`admin/.env`)

| Variable | Development Default | Production Recommendation | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:5000/api` | `https://api.rescuelink.org/api` | Base URL of the backend REST & SSE API |

### Mobile Client Environment Variables (`mobile/.env`)

| Variable | Development Default | Production Recommendation | Purpose |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL`| `http://10.0.2.2:5000/api` | `https://api.rescuelink.org/api` | Backend API URL reachable by mobile devices |

---

## 2. Backend Deployment Options

### Option A: Docker Containerization (Recommended)

1. **Dockerfile (`server/Dockerfile`):**
   ```dockerfile
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .

   FROM node:20-alpine
   WORKDIR /app
   RUN apk add --no-cache curl
   COPY --from=builder /app /app

   # Create persistent data volume mount point
   VOLUME /app/data
   ENV NODE_ENV=production
   EXPOSE 5000

   # Health probe
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
       restart: always
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
         - PORT=5000
         - JWT_SECRET=${JWT_SECRET}
         - CORS_ORIGIN=https://admin.rescuelink.org
         - STORAGE_DIR=/app/data
       volumes:
         - rescuelink-data:/app/data

   volumes:
     rescuelink-data:
       driver: local
   ```

3. **Deploy:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

---

### Option B: Platform-as-a-Service (Render / Railway)

1. **Render.com:**
   - Create a **Web Service** connected to your GitHub repository.
   - Root Directory: `server`
   - Build Command: `npm install --omit=dev`
   - Start Command: `node server.js`
   - Add a **Persistent Disk** mounted at `/app/data` (minimum 1 GB) to preserve JSON data stores across deploys.
   - Configure Environment Variables: `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN`.
   - Health Check Path: `/api/health`.

2. **Railway.app:**
   - Deploy from repo with root directory `server`.
   - Add a persistent volume mounted to `/app/data`.
   - Set environment variables via Railway dashboard.

---

### Option C: Ubuntu Linux VPS via Systemd

1. **Install Node.js & Dependencies:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Setup User & Directory:**
   ```bash
   sudo useradd -r -s /bin/false rescuelink
   sudo mkdir -p /var/www/rescuelink/server /var/lib/rescuelink/data
   sudo chown -R rescuelink:rescuelink /var/www/rescuelink /var/lib/rescuelink
   ```

3. **Deploy Server Code:**
   ```bash
   cd /var/www/rescuelink/server
   npm ci --omit=dev
   ```

4. **Create Systemd Service (`/etc/systemd/system/rescuelink.service`):**
   ```ini
   [Unit]
   Description=RescueLink Backend API
   After=network.target

   [Service]
   Type=simple
   User=rescuelink
   WorkingDirectory=/var/www/rescuelink/server
   ExecStart=/usr/bin/node server.js
   Restart=on-failure
   RestartSec=10
   Environment=NODE_ENV=production
   Environment=PORT=5000
   Environment=JWT_SECRET=super_secret_production_key_hex_64_chars_here
   Environment=STORAGE_DIR=/var/lib/rescuelink/data
   Environment=CORS_ORIGIN=https://admin.rescuelink.org

   [Install]
   WantedBy=multi-user.target
   ```

5. **Start and Enable Service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now rescuelink
   sudo systemctl status rescuelink
   ```

---

## 3. Admin Dashboard Deployment (Vite + React)

The Admin Dashboard builds into a lightweight static SPA (`admin/dist`).

### Step 1: Production Build
```bash
cd admin
npm ci
npm run build
```
This produces minified assets in `admin/dist/`.

### Step 2: Edge Hosting

#### Vercel
1. Set Framework Preset to **Vite**.
2. Root Directory: `admin`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Configure SPA Rewrites in `admin/vercel.json`:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
6. Set Environment Variable: `VITE_API_URL=https://api.rescuelink.org/api`.

#### Netlify
1. Publish Directory: `admin/dist`
2. Build Command: `npm run build`
3. Add `admin/public/_redirects`:
   ```text
   /*    /index.html   200
   ```
4. Set Environment Variable: `VITE_API_URL=https://api.rescuelink.org/api`.

#### Nginx Reverse Proxy & Static Host
```nginx
server {
    listen 80;
    server_name admin.rescuelink.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.rescuelink.org;

    ssl_certificate /etc/letsencrypt/live/admin.rescuelink.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.rescuelink.org/privkey.pem;

    root /var/www/rescuelink/admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

---

## 4. Mobile Application Build (Android & iOS)

> [!IMPORTANT]
> Because RescueLink relies on low-level native Bluetooth peripheral and central radio operations (`react-native-ble-plx`, `react-native-ble-peripheral`), the app **cannot** run BLE features inside the standard Expo Go sandboxed client. It requires an **Expo Development Client** or a **Standalone APK / AAB Build**.

### Prerequisites
- Install EAS CLI: `npm install -g eas-cli`
- Log in to Expo: `eas login`

### Step 1: Configure `eas.json` (`mobile/eas.json`)
```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Step 2: Build Standalone Android APK for Field Testing
```bash
cd mobile
eas build --platform android --profile preview
```
Once compilation completes, download the resulting `.apk` file directly onto Android physical test devices.

### Step 3: Run Local Development Build (With Native Modules)
```bash
cd mobile
npx expo prebuild
npx expo run:android
```

---

## 5. Storage Persistence & Backup Procedures

RescueLink backend stores data in JSON document files under `STORAGE_DIR`:
- `users.json`: User accounts and hashed credentials
- `alerts.json`: Emergency incidents, statuses, and hop paths
- `contacts.json`: Emergency contact books
- `notifications.json`: Multi-channel notification dispatch records
- `audit_logs.json`: Security audit trails

### Automated Daily Backup Script (`scripts/backup.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/rescuelink"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/rescuelink_backup_$DATE.tar.gz" -C /var/lib/rescuelink data

# Retain last 30 daily backups
find "$BACKUP_DIR" -type f -name "rescuelink_backup_*.tar.gz" -mtime +30 -delete
echo "Backup completed: $BACKUP_DIR/rescuelink_backup_$DATE.tar.gz"
```

Add to cron:
```bash
0 2 * * * /usr/local/bin/backup.sh >> /var/log/rescuelink_backup.log 2>&1
```

### Recovery Procedure
1. Stop backend: `sudo systemctl stop rescuelink`
2. Restore archive: `tar -xzf /var/backups/rescuelink/rescuelink_backup_20261031_020000.tar.gz -C /var/lib/rescuelink`
3. Verify integrity: `curl http://localhost:5000/api/ready`
4. Start backend: `sudo systemctl start rescuelink`

---

## 6. Monitoring & Health Probes

### Orchestrator Probes
- **Liveness Probe:** `GET /api/health`
  - Returns `200 OK` with `{ status: "UP", uptime: 1234, timestamp: "..." }`
  - Safe for frequent polling (exempt from rate limiter).
- **Readiness Probe:** `GET /api/ready`
  - Returns `200 OK` if all 5 JSON storage files are readable and writable, and reports heap memory stats.
  - Returns `503 Service Unavailable` if disk storage fails or permissions are corrupted.

### Recommended Alerting Rules
- Trigger alert if `GET /api/health` returns non-200 for 3 consecutive 15-second cycles.
- Trigger alert if `heapUsedMb > 400MB` (Node process memory leak indicator).
- Monitor rate limit hits via HTTP 429 response rate spikes in web server access logs.
