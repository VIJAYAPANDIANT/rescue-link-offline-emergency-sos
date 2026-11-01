# RescueLink — Android Release Build & Deployment Manual

**Document:** Android APK/AAB Compilation, Native Permissions & Hardware Sideloading Guide  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0-RC1 (Release Candidate 1)  
**Date:** November 2026  

---

## 1. Native Build Architecture & Prerequisites

RescueLink requires native hardware access to smartphone Bluetooth Low Energy radios and hardware GPS positioning chips:
- `react-native-ble-plx` (GATT Central scanner and client)
- `react-native-ble-peripheral` (GATT Peripheral broadcaster and server)
- `expo-sqlite` (Embedded SQLite database engine with WAL mode)
- `react-native-maps` (Google Play Services Maps SDK)

> [!IMPORTANT]
> **Expo Go Incompatibility Notice:**  
> Because `react-native-ble-plx` and `react-native-ble-peripheral` require native C++/Java binary bindings, **RescueLink cannot execute inside standard Expo Go**. It must be compiled using an **Expo Development Client** or built into a standalone **Android APK / AAB**.

### Workstation Prerequisites
- **Node.js:** v18.x, v20.x, or v24.x LTS.
- **Java Development Kit (JDK):** OpenJDK 17.
- **Android Studio:** Android SDK Platform 34 (Android 14) and Android SDK Build-Tools 34.0.0.
- **Environment Variables:**
  - `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`
  - `PATH` includes `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\cmdline-tools\latest\bin`
- **Expo CLI & EAS CLI:** `npm install -g eas-cli`

---

## 2. Android Manifest & Permissions Configuration

All Android permissions are declared in [`mobile/app.json`](file:///c:/Offline%20Emergency%20SOS/mobile/app.json) and compiled into `AndroidManifest.xml`:

```json
"android": {
  "package": "com.rescuelink.emergency.sos",
  "versionCode": 1,
  "permissions": [
    "android.permission.BLUETOOTH",
    "android.permission.BLUETOOTH_ADMIN",
    "android.permission.BLUETOOTH_CONNECT",
    "android.permission.BLUETOOTH_SCAN",
    "android.permission.BLUETOOTH_ADVERTISE",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.INTERNET",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"
  ]
}
```

### Permission Criticality Table:
| Permission Name | API Level | Purpose & Necessity in RescueLink |
|---|---|---|
| `BLUETOOTH_SCAN` | Android 12+ (API 31+) | Discovers nearby peer emergency distress beacons over BLE. |
| `BLUETOOTH_CONNECT` | Android 12+ (API 31+) | Reads SOS characteristics and transmits peer ACK receipts. |
| `BLUETOOTH_ADVERTISE` | Android 12+ (API 31+) | Hosts GATT server and broadcasts emergency beacon. |
| `ACCESS_FINE_LOCATION` | All | Acquires accurate GPS fix for trapped survivor coordinates. (Also required on Android 6–11 for BLE scanning). |
| `ACCESS_COARSE_LOCATION` | All | Approximate cellular/Wi-Fi positioning fallback when GPS fix is obstructed by debris. |
| `ACCESS_NETWORK_STATE` | All | Monitored by NetInfo to trigger opportunistic sync when internet connectivity is detected. |
| `INTERNET` | All | Transmits outbox batches to Express backend when online. |
| `FOREGROUND_SERVICE` | Android 9+ (API 28+) | Maintains continuous BLE mesh listening without OS battery task termination. |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE` | Android 14+ (API 34+) | Declares foreground service type for Bluetooth peripheral/central connection continuity. |

---

## 3. Build Methods

### Method A: Standalone APK via EAS Cloud Build (Recommended for Testers)

EAS Build compiles the native binaries in the cloud without requiring a high-powered local Android Studio setup.

1. **Install and Log in to EAS:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Verify `mobile/eas.json` Configuration:**
   The repository includes [`mobile/eas.json`](file:///c:/Offline%20Emergency%20SOS/mobile/eas.json) with three build profiles:
   - `development`: Debug APK with Expo Development Client.
   - `preview`: Sideloadable standalone release `.apk` (self-contained, no Expo Go needed).
   - `production`: Optimized Google Play `.aab` (Android App Bundle).

3. **Trigger Standalone APK Build:**
   ```bash
   cd mobile
   eas build --platform android --profile preview
   ```
   *EAS will upload the source, compile the Gradle project, and output a direct `.apk` download link.*

---

### Method B: Local Native Compilation via Gradle (Offline / On-Premise)

For environments with Android Studio and JDK 17 installed locally:

1. **Prebuild Native Android Project:**
   ```bash
   cd mobile
   npx expo prebuild --platform android --clean
   ```
   *This generates the `mobile/android/` native folder with configured `build.gradle` and `AndroidManifest.xml`.*

2. **Compile Release APK via Gradle:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   *The compiled APK will be located at: `mobile/android/app/build/outputs/apk/release/app-release.apk`.*

3. **Run Directly on USB-Connected Android Device:**
   ```bash
   cd mobile
   npx expo run:android --variant release
   ```

---

## 4. Physical Device Sideloading & Installation Protocol

1. **Enable Developer Options on Android Device:**
   - Go to **Settings $\to$ About Phone**.
   - Tap **Build Number** 7 times until *"You are now a developer!"* appears.
   - In **Settings $\to$ System $\to$ Developer Options**, enable:
     - **USB Debugging**
     - **Install via USB**
2. **Install Standalone APK via ADB:**
   ```bash
   adb install -r app-release.apk
   ```
3. **First-Launch Permission Granting:**
   - Launch **RescueLink**.
   - Android will prompt:
     - *"Allow RescueLink to find, connect to, and determine the relative position of nearby devices?"* $\to$ Tap **Allow**.
     - *"Allow RescueLink to access this device's location?"* $\to$ Tap **While using the app** (or **Precise** location).

---

## 5. Verification Checklist for Physical Field Testing

Once sideloaded onto two or more physical Android handsets:
- [ ] Verify Bluetooth is switched ON on both handsets.
- [ ] Verify both handsets display "Bluetooth Active" on the Home readiness dashboard.
- [ ] Enable **Airplane Mode** on both handsets to guarantee zero cellular/Wi-Fi reliance.
- [ ] On Device A: Compose SOS and tap "Broadcast SOS".
- [ ] On Device B: Open "Nearby Devices" and tap "Scan for SOS Signals".
- [ ] Confirm Device B discovers Device A's emergency beacon within 5 to 15 seconds.
- [ ] Confirm Device B can transmit an electronic ACK receipt back to Device A.
