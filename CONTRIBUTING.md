# Contributing to RescueLink

Thank you for your interest in contributing to **RescueLink — Offline Bluetooth Emergency SOS System**!

RescueLink is an open-source, disaster-resilient mobile and mesh networking project designed to provide life-saving communication during complete infrastructure, cellular, and electrical power grid collapse.

To maintain code reliability, cryptographic integrity, and emergency readiness, all contributors are expected to adhere to the guidelines outlined below.

---

## 1. Development Principles & Code of Conduct

When contributing to RescueLink, adhere to these fundamental engineering principles:
1. **Offline-First Resilience:** The mobile client must remain fully functional with zero internet connectivity. Features must never fail catastrophically if network, GPS, or external services are unreachable.
2. **Zero-Fabrication Integrity:** Never commit synthetic test records, fake screenshots, or mocked hardware claims as physical evidence. Testing tiers (Automated vs. Emulator vs. Physical Handset) must be explicitly identified.
3. **Strict Credential Hygiene:** Never commit secrets, API keys, JWT secrets, passwords, or Android signing keystores. Always utilize `.env.example` templates.
4. **Data Integrity & Non-Destructive Mutations:** Emergency alerts stored in SQLite or synced to the backend must be immutable. Original survivor details, timestamps, and coordinates must never be overwritten during mesh forwarding.

---

## 2. Workstation Setup

### Prerequisites
- **Node.js:** v18.x, v20.x, or v24.x LTS (`node -v`)
- **npm:** v9.x or higher (`npm -v`)
- **Git:** v2.30+ (`git --version`)
- **Java Development Kit (For Android compilation):** OpenJDK 17 (`java -version`)
- **Expo CLI & EAS CLI (Optional for cloud builds):** `npm install -g eas-cli`

### Local Setup
1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/rescue-link-offline-emergency-sos.git
   cd rescue-link-offline-emergency-sos
   ```

2. **Install dependencies across subsystems:**
   ```bash
   # Install server dependencies
   cd server && npm install

   # Install mobile client dependencies
   cd ../mobile && npm install

   # Install web admin dashboard dependencies
   cd ../admin && npm install
   ```

3. **Configure local environment files:**
   ```bash
   # Server environment
   cp server/.env.example server/.env

   # Mobile environment
   cp mobile/.env.example mobile/.env

   # Admin dashboard environment
   cp admin/.env.example admin/.env
   ```

---

## 3. Running Subsystems Locally

Start services in separate terminal windows:

### Terminal 1: Cloud Backend (Express.js on Port 5000)
```bash
cd server
npm run dev
# Health check: http://localhost:5000/api/health
```

### Terminal 2: Web Admin Operations Dashboard (Vite on Port 5173)
```bash
cd admin
npm run dev
# Dashboard: http://localhost:5173
```

### Terminal 3: Mobile Application (Expo Metro Bundler)
```bash
cd mobile
npx expo start
```

---

## 4. Running the Test Suite

Before committing changes or opening a pull request, run the unified regression test suite:

```bash
cd server
npm test
```

**Requirements:**
- All **62 / 62 integration tests** across all 11 modules must pass with zero failures.
- If adding new features, author corresponding automated tests in `tests/` or sub-modules to maintain 100% test pass fidelity.

---

## 5. Git Branching & Commit Conventions

### Branch Naming Strategy
- Feature branches: `feat/<short-description>` (e.g., `feat/ble-l2cap-channels`)
- Bug fixes: `fix/<defect-id-or-description>` (e.g., `fix/sync-outbox-retry`)
- Documentation: `docs/<guide-name>` (e.g., `docs/android-field-testing`)

### Commit Message Guidelines (Conventional Commits)
Use structured commit messages:
```
<type>(<scope>): <short imperative summary>

[optional body explaining context and rationale]

[optional footer referencing issues or defects]
```

**Allowed Types:**
- `feat`: A new user-facing feature or capability.
- `fix`: A bug fix or defect resolution.
- `docs`: Documentation updates or additions.
- `test`: Adding or updating automated tests.
- `refactor`: Code changes that neither fix bugs nor add features.
- `perf`: Performance optimizations.
- `chore`: Build scripts, dependencies, or configuration adjustments.

*Example:*
```
feat(mobile): add foreground service notification channel for BLE mesh
fix(sync): include relay hopCount and forwarderId in batch payload
docs(readme): update system architecture diagrams with epidemic routing
```

---

## 6. Pull Request Submission Checklist

Before submitting a Pull Request:
- [ ] Read the [Security Policy](SECURITY.md) and confirm no private secrets or credentials are included.
- [ ] Verify that `npm test --prefix server` executes cleanly with 100% pass rate.
- [ ] Ensure `npm run build --prefix admin` completes without Vite compilation warnings.
- [ ] Run `npx expo config --type public` in `mobile/` to verify Expo schema validity.
- [ ] Update corresponding markdown documentation in `docs/` and `README.md` if architectural behavior changes.
- [ ] Write a clear, concise PR summary linking to any relevant issue tickets.
