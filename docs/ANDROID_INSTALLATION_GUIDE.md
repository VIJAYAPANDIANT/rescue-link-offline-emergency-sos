# RescueLink — Physical Android Device Installation Guide

**Document:** Physical Handset Sideloading, Runtime Permissions & On-Device Configuration  
**Project:** RescueLink — Offline Bluetooth Emergency SOS System  
**Version:** 1.0.0-RC1 (Step 17 Android Release Verification)  
**Target OS:** Android 8.0 (API 26) through Android 14+ (API 34+)  
**Target Hardware:** Physical Android Smartphones with Bluetooth 4.2+ (BLE)  

---

## 1. Overview & Installation Prerequisites

RescueLink is designed to run directly on physical Android smartphones to facilitate off-grid Bluetooth Low Energy (BLE) emergency beaconing and mesh relaying. Because RescueLink uses native C++/Java BLE bindings (`react-native-ble-plx` and `react-native-ble-peripheral`), it **cannot** run in standard Expo Go; it must be installed as a **standalone APK** (`preview` build) or compiled as an **Expo Development Client** (`development` build).

### Hardware Requirements for Physical Testing
- **Minimum 2 Physical Android Phones:** Needed to test peer-to-peer over-the-air SOS transmission (Device A $\to$ Device B).
- **3 Physical Android Phones (Recommended):** Needed to verify multi-hop epidemic mesh forwarding (Device A $\to$ Device B $\to$ Device C).
- **Operating System:** Android 8.0 (Oreo / API 26) or higher. Android 12+ (API 31+) is strongly recommended to test modern Android `NEARBY_DEVICES` runtime permission flows.
- **Hardware Radios:** Bluetooth 4.2 or 5.0+ with BLE Peripheral and Central support, GPS receiver.
- **USB Cable:** USB-C or Micro-USB data cable for ADB sideloading (or local Wi-Fi / file transfer).

---

## 2. Preparing the Android Device

Before installing an APK directly (sideloading), you must enable developer and sideloading permissions on the phone:

### Step 2.1: Enable Developer Options & USB Debugging
1. Open the phone's **Settings**.
2. Scroll to **About Phone** (or **About Device**).
3. Locate the **Build Number** (on some devices, under **Software Information**).
4. Tap **Build Number** rapidly **7 times**. A toast message will appear: *"You are now a developer!"*.
5. Return to the main **Settings** menu and select **System $\to$ Developer Options** (or find **Developer Options** at the bottom of Settings).
6. Enable:
   - **USB Debugging:** Allows installing APKs and viewing real-time logs via ADB.
   - **Install via USB:** Allows installing apps over USB debugging (common on Xiaomi/MIUI/ColorOS).

### Step 2.2: Enable "Install Unknown Apps" (For Direct On-Device Sideloading)
If installing the APK downloaded directly via a browser, file manager, or chat app:
1. Go to **Settings $\to$ Apps $\to$ Special App Access $\to$ Install Unknown Apps**.
2. Select the app used to download/transfer the file (e.g., **Chrome**, **Files by Google**, or **Drive**).
3. Toggle ON **Allow from this source**.

---

## 3. Installation Methods

### Method A: Sideloading via USB & ADB (Recommended for Engineers & Developers)

1. Connect the Android phone to your workstation with a USB data cable.
2. In PowerShell or Command Prompt, verify the device is detected:
   ```bash
   adb devices
   ```
   *If prompted on the phone, check "Always allow from this computer" and tap **Allow**.*
3. Install the RescueLink APK:
   ```bash
   adb install -r path/to/RescueLink-preview.apk
   ```
   *Parameters:*
   - `-r`: Reinstalls existing app, preserving internal SQLite database tables and emergency cache.
   - `-d`: Allows version code downgrade if testing previous builds.
4. Verify successful output:
   ```
   Performing Streamed Install
   Success
   ```

---

### Method B: Direct On-Device Installation (Without Workstation Connection)

1. Transfer the APK file (`RescueLink-preview.apk`) to the device via:
   - Direct download from your private EAS build link.
   - Local network file share or web server.
   - USB flash drive or SD card.
2. Open the device's **Files** or **Downloads** app.
3. Tap on `RescueLink-preview.apk`.
4. If prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*, tap **Settings** and enable **Allow from this source**, then tap back.
5. Tap **Install**.
6. If Google Play Protect displays a prompt *"Unrecognized app details"*, tap **More details** and select **Install anyway** (standard warning for self-signed development/preview builds).

---

## 4. First-Time Launch & Android Runtime Permissions

When RescueLink launches for the first time, Android requires explicit user consent for Bluetooth radio access and hardware positioning:

```
+-------------------------------------------------------------+
|               RESCUELINK FIRST LAUNCH FLOW                  |
+-------------------------------------------------------------+
|  1. Splash Screen & SQLite DB Migration Initialization       |
|  2. Android 12+ Permission Dialog: Nearby Devices           |
|  3. Android Location Permission Dialog: Precise Location    |
|  4. Navigation to Welcome / Onboarding Screen                |
+-------------------------------------------------------------+
```

### Permission Prompts Explained:

1. **Nearby Devices (Android 12+ / API 31+):**
   - *Android Prompt:* *"Allow RescueLink to find, connect to, and determine the relative position of nearby devices?"*
   - *Action:* Tap **Allow**.
   - *Technical Backing:* Grants `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and `BLUETOOTH_ADVERTISE`. Without this permission, the app cannot send or receive BLE distress beacons.

2. **Location Permission (All Android Versions):**
   - *Android Prompt:* *"Allow RescueLink to access this device's location?"*
   - *Action:* Select **While using the app** and ensure **Precise** is toggled ON.
   - *Technical Backing:* Grants `ACCESS_FINE_LOCATION`. This allows RescueLink to acquire accurate GPS coordinates for survivors during an SOS trigger. On Android 6–11, this permission is also required by the OS to perform BLE scanning.

3. **Verify App Readiness:**
   - On the RescueLink **Home Screen**, confirm that the status header shows:
     - **Bluetooth:** `Active` (Green indicator)
     - **Sync Engine:** `Idle` or `Connected`
     - **Node ID:** Displays unique 8-character device identifier (e.g., `NODE-7B2F`)

---

## 5. Connecting Physical Handset to Local Backend (College / Lab Evaluation)

During offline testing, devices operate completely without internet. However, to verify **cloud synchronization** when internet connectivity is restored:

1. Connect the physical phone and the backend computer to the **same local Wi-Fi network** (or phone hotspot).
2. Find the local workstation's IP address:
   - On Windows: Run `ipconfig` (e.g., `192.168.1.105`).
   - On Mac/Linux: Run `ifconfig` or `ip a`.
3. In the RescueLink mobile app:
   - Tap **Profile** in the bottom navigation bar.
   - Scroll down to **Gateway Diagnostics & Settings**.
   - Enter your computer's IP address and port:
     ```
     http://192.168.1.105:5000/api
     ```
   - Tap **Test Gateway Connection**.
   - Confirm status changes to: `Endpoint Verified (HTTP 200). Server online.`
4. Now, any SOS alerts queued locally during an off-grid scenario will automatically flush and sync to your local backend when internet or local Wi-Fi is restored!

---

## 6. Troubleshooting Common Installation & Runtime Errors

### Problem 1: `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
- **Cause:** A previous version with a different signing key or mismatched `versionCode` is already installed.
- **Solution:** Uninstall the existing app from the device first via `adb uninstall com.rescuelink.emergency.sos` or long-press the app icon and tap **Uninstall**, then reinstall the new APK.

### Problem 2: Play Protect Blocks Installation ("Blocked by Play Protect")
- **Cause:** Google Play Protect flags standalone APKs signed with debug/self-signed certificates.
- **Solution:** Tap **Install anyway** (or temporarily open Play Store $\to$ Profile icon $\to$ Play Protect $\to$ Settings gear $\to$ disable *Scan apps with Play Protect* during evaluation).

### Problem 3: Bluetooth Scan Fails Immediately on Android 12+
- **Cause:** The user denied the "Nearby Devices" runtime permission.
- **Solution:** Open Android **Settings $\to$ Apps $\to$ RescueLink $\to$ Permissions $\to$ Nearby Devices**, and toggle to **Allow**. Ensure Bluetooth is also toggled ON in the Android Quick Settings drawer.

### Problem 4: Server Connection Refused (`ECONNREFUSED` or Timeout)
- **Cause:** Using `http://localhost:5000` or `http://10.0.2.2:5000` on a physical device.
- **Solution:** `localhost` on a physical phone refers to the phone itself, and `10.0.2.2` only works inside the Android emulator. On a physical phone, you must specify the actual LAN IP address of your backend workstation (e.g., `http://192.168.x.x:5000/api`) and ensure Windows Firewall permits incoming TCP traffic on port 5000.
