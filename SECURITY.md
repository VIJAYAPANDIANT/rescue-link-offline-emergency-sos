# Security Policy & Vulnerability Disclosure

**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Classification:** Disaster-Resilient Life-Safety Emergency Response Architecture  
**Status:** Active Maintenance (Release Candidate v1.0.0-RC1)  

---

## 1. Supported Versions

Security patches and vulnerability remediation are actively prioritized for the following releases:

| Version / Branch | Supported | Security Notes |
|---|---|---|
| **1.0.0-RC1 / `main`** | :white_check_mark: Yes | Current production release candidate. |
| **< 1.0.0** | :x: No | Historical development stages (Steps 1–15). Please upgrade to `main`. |

---

## 2. Threat Model & Security Posture Overview

RescueLink operates across two distinct operational environments with unique threat surfaces:

```
[Threat Surface A: RF Wireless Mesh]          [Threat Surface B: Cloud Dispatch API]
  • Peer-to-Peer Bluetooth Low Energy           • Express.js REST API & SSE Broadcasts
  • Unauthenticated Radio Broadcasts            • JWT Bearer Token Authentication
  • Air-Gap Physical Proximity                  • Role-Based Access Control (Admin / Responder)
  • FNV-1a Message Tamper-Evidence              • Bcrypt Password Hashing (10 Salt Rounds)
  • Zero Session Token Leakage OTA              • Recipient PII Telemetry Masking
```

### Key Security Safeguards Implemented:
1. **Zero Over-The-Air Credential Exposure:**  
   The `sanitizeBLEPayload()` utility strictly strips all user passwords, session JWT tokens, authorization headers, and internal database keys before serializing an alert into a 512-byte BLE broadcast packet.
2. **Production Secret Enforcement:**  
   The cloud backend strictly verifies in `NODE_ENV=production` that `JWT_SECRET` is non-default and contains at least 32 characters of cryptographic entropy. Insecure boots are automatically intercepted and aborted.
3. **Recipient Privacy Protection:**  
   Emergency contact emails and phone numbers are dynamically masked across all public APIs and logs (e.g., `al***@example.com`, `+1 ***-***-1234`).
4. **Relay Flood Protection:**  
   The multi-device relay engine enforces strict 5-stage admission control: FNV-1a checksum validation, 24-hour message expiration (TTL), self-origin rejection, previous forwarder loop prevention, hop count bounds ($\le 3$), and sliding-window rate limiting (maximum 5 forwards/minute).
5. **Administrative Privilege Isolation:**  
   Administrative endpoints (`/api/admin/*`) require explicit `admin` role claims in verified JWT tokens. Admins are blocked from self-suspension to prevent accidental lockout.

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability or cryptographic defect in RescueLink, **please do not disclose it publicly** via GitHub Issues or public forums. Instead, report it privately to the project maintainers:

- **Security Contact:** `security@rescuelink.org` (or directly contact project maintainer)
- **Encryption:** If submitting sensitive proof-of-concept exploits, please request our PGP public key.

### Please Include in Your Report:
1. Subsystem affected (`mobile`, `server`, `admin`, or `ble`).
2. Type of vulnerability (e.g., authentication bypass, SQL injection, relay flood exhaustion, token leakage).
3. Step-by-step reproduction instructions or proof-of-concept payload.
4. Potential real-world impact on civilian life safety during an emergency.

---

## 4. Response Timeline & Disclosure SLA

Maintainers are committed to responsive and transparent vulnerability handling:
- **Initial Acknowledgment:** Within 48 hours of report submission.
- **Triage & Severity Assessment:** Within 5 business days.
- **Fix & Patch Deployment:** Critical vulnerabilities are prioritized for resolution within 14 business days.
- **Public Advisory:** Published in GitHub Security Advisories upon patch release, crediting the reporting researcher (if desired).

---

## 5. Safe Harbor

Any research conducted in good faith against local, isolated, non-production test deployments in adherence with this policy will be considered authorized. We will not pursue legal action against researchers who report vulnerabilities responsibly without attempting data exfiltration or service disruption.
