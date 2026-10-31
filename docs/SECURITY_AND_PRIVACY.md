# RescueLink — Security, Threat Model & Privacy Engineering

**Document:** System Threat Model, Cryptographic Controls & Privacy Hardening  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0  
**Date:** October 2026  

---

## 1. Threat Model (STRIDE Methodology)

Because RescueLink operates in contested, chaotic disaster zones utilizing broadcast radio frequencies (Bluetooth LE) and untrusted intermediary relay nodes, the architecture is hardened against the full **STRIDE** threat taxonomy:

| Threat Category | Disaster Mesh Risk | RescueLink Mitigation Strategy |
|---|---|---|
| **Spoofing** | Adversary attempts to forge emergency alerts or claim false responder identity. | - Cryptographic `originalSenderId` bound to alert origin.<br/>- Server-side JWT signature verification for authenticated ingestion.<br/>- Distinct `relayedByUserId` attribution. |
| **Tampering** | Intermediary relay node alters victim GPS coordinates, severity, or medical details. | - **32-bit FNV-1a Content Integrity Checksum:** Any alteration to normalized immutable fields results in immediate packet rejection by receivers and the cloud gateway. |
| **Repudiation** | Node denies having received or forwarded an alert. | - Atomic `message_receipts` table in SQLite.<br/>- Append-only `relay_history` and cloud `audit_logs.json` tracking all administrative actions. |
| **Information Disclosure** | Adversary sniffs BLE packets or queries APIs to harvest personal contact information. | - **Credential Scrubbing:** BLE serializer strips JWTs, passwords, and tokens before broadcast.<br/>- **Recipient Masking:** Contact emails and phone numbers are strictly masked in public and admin APIs. |
| **Denial of Service** | Malicious or malfunctioning node floods the radio spectrum with spam broadcasts. | - **Sliding-Window Rate Limiting:** Nodes enforce a max of 5 forward broadcasts per minute.<br/>- **Hop Boundary:** Max hop limit (default 3) prevents endless message circulation.<br/>- **Backend Rate Limit:** Express limits public IPs to 300 requests/minute. |
| **Elevation of Privilege** | Ordinary user attempts to access administrative triage endpoints or suspend accounts. | - **Role-Based Access Control (RBAC):** Backend enforces `authorizeRole('admin')` at the route layer, completely independent of frontend controls. |

---

## 2. Authentication & Identity Management

### 2.1 Password Hashing Architecture
User passwords are treated with zero-trust principles. Passwords are never stored in plaintext or logged.
- **Algorithm:** `bcrypt` with a minimum cost factor of **10 salt rounds**.
- **Timing Attack Resistance:** Password comparison uses constant-time bcrypt verification.

### 2.2 JWT Verification & Expiration
- **Algorithm:** HMAC SHA-256 (`HS256`).
- **Signature Secret:** Configured via `JWT_SECRET`. In `production` mode, the server strictly validates that `JWT_SECRET` is non-default and contains at least **32 characters** (aborting startup with `process.exit(1)` if insecure).
- **Token Invalidation:** Malformed, unsigned, or expired tokens immediately return `401 Unauthorized` and trigger client-side session cleanup.

### 2.3 Account Enumeration Mitigation
When an unauthenticated actor attempts to log in with an invalid email or password:
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```
The system returns a generic 401 error message regardless of whether the email was found or the password was incorrect, preventing malicious adversaries from compiling user lists.

---

## 3. Role-Based Access Control (RBAC) & Route Protection

The Express backend implements two decoupled security middleware layers:

```javascript
// 1. Authentication Guard: Validates token signature & extracts user
router.use(authenticate);

// 2. Authorization Guard: Validates role hierarchy
router.use(authorizeRole('admin'));
```

### 3.1 Strict Administrative Restrictions
- Ordinary users attempting to access `/api/admin/*` receive `403 Forbidden`.
- **Self-Suspension Guard:** An administrator cannot suspend their own active account, preventing accidental total lockout of administrative capabilities.

### 3.2 Cross-User Data Isolation
- Non-admin users querying `/api/alerts/:id` can only access alerts they personally created.
- Attempts to query or modify an alert belonging to another user return `404 Not Found` (rather than 403), entirely concealing the existence of other records.

---

## 4. Privacy Engineering & Data Minimization

### 4.1 Over-the-Air BLE Credential Stripping
Because BLE advertising packets and GATT read requests are transmitted unencrypted over open 2.4 GHz radio frequencies, the application enforces automated sanitization before serializing any payload.

```javascript
// Automatically scrubs auth tokens, passwords, and internal hashes
export function sanitizeBLEPayload(data) {
  const sanitized = { ...data };
  delete sanitized.token;
  delete sanitized.jwt;
  delete sanitized.accessToken;
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.authorization;
  delete sanitized.auth;
  return sanitized;
}
```

### 4.2 Recipient Privacy & Telemetry Masking
When emergency notifications are recorded in `notifications.json` or displayed on the admin dashboard, recipient phone numbers and email addresses are dynamically masked:

```
Raw Email:        jane.doe@example.com  ──► Masked: ja***@example.com
Raw Phone (E.164):+14155552671          ──► Masked: +1 415-***-2671
```

### 4.3 Location Consent Guard & Simulation Isolation
- **Explicit Location Consent:** The mobile client never accesses device GPS hardware without explicit user permission. If location access is denied, the user can still broadcast an unmapped emergency SOS containing text descriptions.
- **Drill / Simulation Isolation:** Alerts categorized under `Test / Drill` are tagged with explicit demo metadata, preventing panic among responders and isolating simulation exercises from real-world operations.

---

## 5. Network Hardening & HTTP Security Headers

Every HTTP transaction is protected by standard defensive headers:

```http
# Prevent MIME-type sniffing attacks
X-Content-Type-Options: nosniff

# Prevent clickjacking by denying iframe embedding
X-Frame-Options: DENY

# Enable browser XSS filtering
X-XSS-Protection: 1; mode=block

# Enforce secure HTTPS connections for 1 year
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Rate Limiting Architecture
- **Global Public Limit:** 300 requests per minute per IP address.
- **Authentication Limiter:** 30 requests per 15-minute sliding window per IP to mitigate automated brute-force attacks.
- **Mesh Forwarding Limiter:** 5 forward broadcasts per minute per mobile node to preserve radio airtime and battery reserves.
