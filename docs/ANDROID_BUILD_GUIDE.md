# RescueLink — Android Release Build & Deployment Manual

**Document:** Android APK/AAB Compilation, Native Build Workflows, Build Profiles & Troubleshooting  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0-RC1 (Step 17 Android Release Verification)  
**Date:** November 2026  
**Target Environments:** Android 8.0+ (API 26+) / Target SDK 34 (Android 14)  

---

## 1. Architecture & Native Build Workflow

RescueLink utilizes React Native with Expo (SDK 52) configured under the **Continuous Native Generation (CNG) / Prebuild Workflow**. 

```
                                  +------------------------------------+
                                  |    RescueLink React Native App     |
                                  |   (mobile/src, app.json, SQLite)   |
                                  +-----------------+------------------+
                                                    |
                                    [Expo Config Plugins & CNG]
                                                    |
                    +-------------------------------+-------------------------------+
                    |                                                               |
                    v                                                               v
    +--------------------------------+                              +--------------------------------+
    |     METHOD A: EAS CLOUD        |                              |     METHOD B: LOCAL GRADLE     |
    +--------------------------------+                              +--------------------------------+
    | • Zero local Android SDK setup |                              | • Complete offline independence|
    | • eas build -p android         |                              | • npx expo prebuild            |
    | • Hosted Linux compilation     |                              | • ./gradlew assembleRelease    |
    | • Generates downloadable APK   |                              | • Outputs to local disk        |
    +--------------------------------+                              +--------------------------------+
```

### Why Standard Expo Go Cannot Run RescueLink
Standard Expo Go is a generic pre-compiled sandbox that does not bundle custom native C++ and Java binary drivers. Because RescueLink requires:
1. **`react-native-ble-plx`:** Native Android Bluetooth GATT Central client and L2CAP channel drivers.
2. **`react-native-ble-peripheral`:** Native Android BluetoothAdvertiser and BluetoothGattServer drivers.
3. **`expo-sqlite`:** Embedded SQLite engine with native Write-Ahead Logging (`WAL`) mode.
4. **`react-native-maps`:** Google Play Services Maps SDK native libraries.

RescueLink **cannot execute in standard Expo Go**. It must be compiled as:
- An **Expo Development Client** (`development` profile),
- A **Standalone Installable APK** (`preview` profile), or
- A **Production Android App Bundle** (`production` profile).

---

## 2. Android Manifest & Permissions Configuration

All Android permissions and hardware feature requests are declared in [`mobile/app.json`](file:///c:/Offline%20Emergency%20SOS/mobile/app.json) and compiled into the native `AndroidManifest.xml`:

```json
"android": {
  "package": "com.rescuelink.emergency.sos",
  "versionCode": 1,
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSy_RESCUELINK_EMERGENCY_MAPS_KEY"
    }
  },
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

### Permission Purpose & Android OS Mapping
| Permission Name | Minimum API | Purpose in RescueLink |
|---|---|---|
| `BLUETOOTH` | API 1 (Legacy) | Basic Bluetooth communication for Android 11 and earlier. |
| `BLUETOOTH_ADMIN` | API 1 (Legacy) | Initiating discovery and modifying Bluetooth settings on Android 11 and earlier. |
| `BLUETOOTH_SCAN` | API 31 (Android 12+) | Discovers nearby peer distress beacons without location disclosure. |
| `BLUETOOTH_CONNECT` | API 31 (Android 12+) | Connects to GATT servers on peer devices to read alert characteristics and transmit ACKs. |
| `BLUETOOTH_ADVERTISE` | API 31 (Android 12+) | Broadcasts the phone as an emergency beacon GATT server. |
| `ACCESS_FINE_LOCATION` | API 1 | Acquires GPS coordinates during an active emergency; required on Android 6–11 for BLE scanning. |
| `ACCESS_COARSE_LOCATION` | API 1 | Approximate location fallback when satellite GPS is obscured by building rubble. |
| `ACCESS_NETWORK_STATE` | API 1 | Monitored by NetInfo to trigger opportunistic sync when connectivity returns. |
| `INTERNET` | API 1 | Communicates with the Express cloud backend when an internet gateway is reachable. |
| `FOREGROUND_SERVICE` | API 28 (Android 9+) | Prevents the OS from killing the BLE mesh listener service during screen-off sleep. |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE` | API 34 (Android 14+) | Explicit Android 14 category for Bluetooth continuous peripheral/central connections. |

---

## 3. EAS Build Configuration Profiles (`eas.json`)

The build configuration is maintained in [`mobile/eas.json`](file:///c:/Offline%20Emergency%20SOS/mobile/eas.json):

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
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://10.0.2.2:5000/api"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://10.0.2.2:5000/api"
      }
    },
    "preview-prod": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.rescuelink.org/api"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.rescuelink.org/api"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Purpose of Each Build Profile:

1. **`development` Profile:**
   - **Output:** Debug APK with Expo Development Client.
   - **Target Audience:** Core engineers writing and live-reloading React Native code.
   - **Key Benefit:** Connects to the local Metro bundler (`npx expo start`) while retaining full native BLE access.
2. **`preview` Profile (Local Evaluation & Physical Device Testing):**
   - **Output:** Self-contained Standalone Release `.apk`.
   - **Target Audience:** College project evaluators, peer testers, and field responders.
   - **Key Benefit:** Directly installable on any physical Android phone without Metro bundler or Expo Go. Defaults to emulator loopback or LAN IP; backend URL can be dynamically adjusted in-app via **Profile $\to$ Gateway Settings**.
3. **`preview-prod` Profile:**
   - **Output:** Standalone Release `.apk` configured with production cloud endpoints (`https://api.rescuelink.org/api`).
4. **`production` Profile:**
   - **Output:** Optimized Google Play App Bundle (`.aab`).
   - **Target Audience:** Official Google Play Store release or private track internal testing.
   - **Key Benefit:** Enables Google Play dynamic delivery and split APK optimization for smaller download sizes.

---

## 4. Step-by-Step Compilation Guides

### Method A: EAS Cloud Build (Zero Local Toolchain Required)

This method offloads the native compilation to Expo's managed cloud infrastructure.

#### Prerequisites:
1. An Expo account at [expo.dev](https://expo.dev).
2. EAS CLI installed globally:
   ```bash
   npm install -g eas-cli
   ```

#### Build Execution Commands:
1. **Log in to EAS:**
   ```bash
   eas login
   ```
2. **Configure EAS Project (First time only):**
   ```bash
   cd mobile
   eas project:init
   ```
3. **Generate Standalone APK for Physical Testing:**
   ```bash
   eas build --platform android --profile preview
   ```
   *EAS will upload the source, apply config plugins, invoke Gradle in the cloud, sign the APK with an auto-generated Expo keystore, and provide a direct download URL and QR code.*
4. **Generate Google Play App Bundle (AAB):**
   ```bash
   eas build --platform android --profile production
   ```

---

### Method B: Local Native Compilation via Gradle (Offline / On-Premise)

This method executes entirely on your local development workstation without cloud dependencies.

#### Prerequisites:
- **Operating System:** Windows 10/11, macOS, or Linux.
- **Java Development Kit:** OpenJDK 17 (`java -version`).
- **Android Studio & SDK:**
  - Android SDK Platform 34 (Android 14).
  - Android SDK Build-Tools 34.0.0.
  - Android NDK (Side by side) 26.1+.
- **Environment Variables:**
  - `ANDROID_HOME` pointing to your Android SDK directory (e.g. `%LOCALAPPDATA%\Android\Sdk`).
  - `JAVA_HOME` pointing to JDK 17.
  - `PATH` containing `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\cmdline-tools\latest\bin`.

#### Local Compilation Commands:
1. **Generate Native Android Project Structure:**
   ```bash
   cd mobile
   npx expo prebuild --platform android --clean
   ```
   *This evaluates `app.json`, runs config plugins, and creates the native `mobile/android/` directory with `build.gradle`, `settings.gradle`, and `AndroidManifest.xml`.*
2. **Build Standalone Release APK:**
   ```bash
   cd android
   # On Windows PowerShell:
   .\gradlew.bat assembleRelease
   # On macOS / Linux:
   ./gradlew assembleRelease
   ```
3. **Locate Compiled Artifacts:**
   - **Release APK:** `mobile/android/app/build/outputs/apk/release/app-release.apk`
   - **Release AAB:** `mobile/android/app/build/outputs/bundle/release/app-release.aab`
4. **Direct Local Run on Connected Device:**
   ```bash
   cd mobile
   npx expo run:android --variant release
   ```

---

## 5. Keystore Management & Signing Security

> [!WARNING]
> **Zero Credential Exposure Rule:**  
> Never commit private keystores (`*.jks`, `*.keystore`) or keystore passwords to git repositories!

### How RescueLink Handles Keystores:
1. **EAS Cloud Builds:**
   - EAS securely manages signing credentials in an encrypted cloud vault.
   - Credentials can be inspected or rotated via `eas credentials`.
2. **Local Debug Builds:**
   - Gradle automatically generates a local debug keystore (`~/.android/debug.keystore`) with default credentials (`android / androiddebugkey`).
3. **Local Production Signing:**
   - To sign manually, generate a private keystore:
     ```bash
     keytool -genkey -v -keystore rescuelink-release.keystore -alias rescuelink -keyalg RSA -keysize 2048 -validity 10000
     ```
   - Store passwords in local environment variables (`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`) and add `*.keystore` and `*.jks` to `.gitignore`.

---

## 6. Build Troubleshooting & FAQs

### Issue 1: Gradle Build Fails with `OutOfMemoryError` (Metaspace or Heap)
- **Fix:** In `mobile/android/gradle.properties`, increase JVM allocation:
  ```properties
  org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
  ```

### Issue 2: `Could not determine the dependencies of task ':app:compileReleaseJavaWithJavac'`
- **Fix:** Ensure Java 17 is active. React Native 0.76+ and Expo SDK 52 require JDK 17. Run `java -version` and verify it reports version 17.x.

### Issue 3: Duplicate Class / DEX Merge Conflicts
- **Fix:** Run `./gradlew clean` inside `mobile/android`, delete `.cxx` and `app/build`, and rebuild.

### Issue 4: Android Prebuild Inconsistency
- **Fix:** If `app.json` permissions or plugins are altered, always run `npx expo prebuild --platform android --clean` to ensure old build caches are cleared.
