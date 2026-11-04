import React, { useState, useEffect } from 'react';
import {
  ShieldAlertIcon,
  ShieldIcon,
  ActivityIcon,
  RadioIcon,
  UsersIcon,
  BellIcon,
  MapPinIcon,
  CheckCircleIcon,
  MenuIcon,
  CloseIcon,
  ExternalLinkIcon,
} from '../components/Icons';

export default function HomeView({ onOpenLogin, onOpenSignup, onOpenDashboard, isAuthenticated = false }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [gatewayLatency, setGatewayLatency] = useState(null);

  // Probe backend health status on mount
  useEffect(() => {
    let active = true;
    const checkGateway = async () => {
      const startTime = performance.now();
      try {
        const res = await fetch('/api/health');
        if (!active) return;
        if (res.ok) {
          const latency = Math.round(performance.now() - startTime);
          setGatewayStatus('online');
          setGatewayLatency(latency);
        } else {
          setGatewayStatus('offline');
        }
      } catch (err) {
        if (!active) return;
        setGatewayStatus('offline');
      }
    };

    checkGateway();
    const interval = setInterval(checkGateway, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col font-sans selection:bg-red-500/30 selection:text-white">
      {/* ============================================================== */}
      {/* 1. TOP NAVBAR / HEADER (Backlog / Header with Login & Signup)   */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-navy-900/85 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                <ShieldAlertIcon className="w-6 h-6" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-white">RescueLink</span>
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Offline Bluetooth Emergency SOS & Mesh Relay
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition">Capabilities</a>
            <a href="#architecture" className="hover:text-white transition">Architecture</a>
            <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
            <a href="#status" className="hover:text-white transition">Gateway Telemetry</a>
          </nav>

          {/* Top Header Action Buttons: Login & Signup OR Go to Dashboard */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* Live Gateway Pill */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-navy-850 border border-slate-800 text-xs mr-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  gatewayStatus === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : gatewayStatus === 'offline'
                    ? 'bg-amber-400'
                    : 'bg-slate-500 animate-ping'
                }`}
              />
              <span className="text-slate-400 text-[11px]">
                Gateway:{' '}
                <strong className={gatewayStatus === 'online' ? 'text-emerald-400' : 'text-amber-400'}>
                  {gatewayStatus === 'online' ? `Online (${gatewayLatency}ms)` : 'Connecting...'}
                </strong>
              </span>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 rounded-xl shadow-lg shadow-red-600/30 transition transform hover:-translate-y-0.5 flex items-center space-x-1.5"
              >
                <span>Command Center</span>
                <span>→</span>
              </button>
            ) : (
              <>
                {/* Login Button */}
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition shadow-sm"
                >
                  Log In
                </button>

                {/* Signup Button */}
                <button
                  type="button"
                  onClick={onOpenSignup}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 rounded-xl shadow-lg shadow-red-600/30 transition transform hover:-translate-y-0.5"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex sm:hidden items-center space-x-2">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg"
              >
                Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg"
              >
                Log In
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white focus:outline-none"
            >
              {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 pt-3 pb-5 border-b border-slate-800 bg-navy-850 space-y-3">
            <nav className="flex flex-col space-y-2 text-sm text-slate-300">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Capabilities
              </a>
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Architecture
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                How It Works
              </a>
              <a
                href="#status"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white"
              >
                Gateway Telemetry
              </a>
            </nav>
            <div className="pt-3 border-t border-slate-700/60 flex space-x-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDashboard();
                  }}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-center text-white bg-red-600 rounded-lg"
                >
                  Go to Command Center
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-center text-slate-200 bg-slate-800 border border-slate-700 rounded-lg"
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSignup();
                    }}
                    className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-center text-white bg-red-600 rounded-lg"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 2. HERO SECTION                                                */}
      {/* ============================================================== */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Glow ambient background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-red-600/10 blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-10 w-[400px] h-[300px] bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold mb-6 shadow-inner">
            <RadioIcon className="w-4 h-4 text-red-400 animate-pulse" />
            <span>Decentralized Zero-Infrastructure Disaster Mesh Network</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Offline Bluetooth Emergency SOS &{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-red-400">
              Mesh Relay System
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            When cellular towers, power grids, and internet backbones collapse during catastrophic disasters,
            RescueLink empowers civilians and emergency first responders to transmit distress signals peer-to-peer
            over Bluetooth Low Energy without cellular coverage or WiFi.
          </p>

          {/* Call to Actions */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm uppercase tracking-wider shadow-xl shadow-red-600/30 transition transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
            >
              <ShieldIcon className="w-5 h-5" />
              <span>Launch Command Center</span>
            </button>

            <button
              type="button"
              onClick={onOpenSignup}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white font-bold text-sm uppercase tracking-wider transition shadow-lg flex items-center justify-center space-x-2"
            >
              <UsersIcon className="w-5 h-5 text-amber-400" />
              <span>Register Account</span>
            </button>
          </div>

          {/* Credential Quick-Pill for Evaluation */}
          <div className="mt-6 inline-flex items-center space-x-2 text-xs text-slate-400 bg-navy-850/80 border border-slate-800 px-4 py-2 rounded-xl">
            <span className="font-semibold text-slate-300">Demo Admin Login:</span>
            <code className="text-red-400 bg-navy-900 px-2 py-0.5 rounded font-mono text-[11px]">
              admin@rescuelink.org
            </code>
            <span className="text-slate-600">•</span>
            <code className="text-amber-400 bg-navy-900 px-2 py-0.5 rounded font-mono text-[11px]">
              Admin@RescueLink2026
            </code>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. CORE METRICS STRIP                                          */}
      {/* ============================================================== */}
      <section id="status" className="border-y border-slate-800/80 bg-navy-850/60 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-xl bg-navy-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black text-red-400 font-mono">100%</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                Zero-Infrastructure Offline
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Operates without SIM or WiFi</p>
            </div>

            <div className="p-4 rounded-xl bg-navy-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">128-bit</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                Custom GATT Profile
              </div>
              <p className="text-[11px] text-slate-500 mt-1">FEF0 Service on 2.4 GHz ISM</p>
            </div>

            <div className="p-4 rounded-xl bg-navy-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">WAL Mode</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                SQLite Resilience
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Zero draft loss on power-cut</p>
            </div>

            <div className="p-4 rounded-xl bg-navy-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">FNV-1a</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
                Tamper Verification
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Integrity preserved across hops</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. KEY SYSTEM CAPABILITIES                                     */}
      {/* ============================================================== */}
      <section id="features" className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-red-500 mb-2">
              Disaster-Grade Engineering
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Six Pillars of Disaster Resilience
            </h3>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Every subsystem in RescueLink was engineered specifically to endure real-world communication breakdowns,
              radio congestion, and intermittent network access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-slate-800 hover:border-red-500/50 transition group">
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                <RadioIcon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Zero-Infrastructure BLE Mesh</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct device-to-device distress packet transmission using custom 128-bit Bluetooth Low Energy GATT
                services. Bypasses damaged cell phone towers and severed fiber connections entirely.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-slate-800 hover:border-amber-500/50 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                <ActivityIcon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Durable SQLite WAL Outbox</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Distress alerts, contact payloads, and relay packets are immediately persisted to local SQLite
                databases with Write-Ahead Logging. Never loses an SOS draft upon phone reboot or sudden battery exhaustion.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-slate-800 hover:border-emerald-500/50 transition group">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                <ShieldIcon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Tamper-Evident Multi-Hop Relay</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Uses Epidemic store-and-forward relay bounded by a strict 3-hop limit, 24-hour TTL, and 32-bit FNV-1a
                canonical checksums. Prevents broadcast storm saturation and unauthorized alert modification.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-slate-800 hover:border-blue-500/50 transition group">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                <MapPinIcon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Incident Command GIS Radar</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                First responders track incoming distress alerts on an interactive spatial GIS radar map. Displays
                real-time coordinates, triage priority badges, survivor notes, and battery/medical state.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-slate-800 hover:border-purple-500/50 transition group">
              <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                <BellIcon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Automated Dispatch & Notifications</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When any mesh node touches an active internet link, alerts synchronize to cloud servers, instantly triggering
                Twilio SMS and Nodemailer SMTP notifications to designated emergency family contacts.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-navy-850 border border-slate-800 hover:border-red-500/50 transition group">
              <div className="w-12 h-12 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5 group-hover:scale-110 transition">
                <UsersIcon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Role-Based Access & Audit Ledger</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cryptographic JWT authentication separates civilian distress signalers, active first responders, and
                incident command administrators. Full immutable audit trail recorded for all status updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. HOW IT WORKS / SOS LIFECYCLE                                */}
      {/* ============================================================== */}
      <section id="how-it-works" className="py-20 bg-navy-850/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 mb-2">
              Autonomous Lifecycle
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              From Civilian Distress to Rescuer Dispatch
            </h3>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Follow how an emergency signal propagates from an isolated, offline disaster zone to the central emergency
              command operations room.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 relative">
              <div className="text-xs font-black text-red-500 mb-2 font-mono">PHASE 01</div>
              <h5 className="text-base font-bold text-white mb-2">Offline SOS Created</h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                Survivor triggers emergency SOS with GPS coordinates, medical notes, and category. SQLite WAL immediately
                records the alert locally.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 relative">
              <div className="text-xs font-black text-amber-500 mb-2 font-mono">PHASE 02</div>
              <h5 className="text-base font-bold text-white mb-2">BLE Mesh Broadcast</h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smartphone advertises distress packet over 2.4 GHz Bluetooth Low Energy GATT (`0000FEF0-...`) to all
                nearby devices in range.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 relative">
              <div className="text-xs font-black text-emerald-500 mb-2 font-mono">PHASE 03</div>
              <h5 className="text-base font-bold text-white mb-2">Store-and-Forward Relay</h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                Passing devices buffer the alert, verify the 32-bit FNV-1a checksum, increment hop count ($\le 3$), and
                forward onward toward coverage zones.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 relative">
              <div className="text-xs font-black text-blue-500 mb-2 font-mono">PHASE 04</div>
              <h5 className="text-base font-bold text-white mb-2">Gateway Sync & Dispatch</h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a relay node regains internet, it syncs to the cloud backend. Emergency contacts receive SMS/Email,
                and Command Center coordinates rescue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6. CALL TO ACTION & PORTAL ACCESS                              */}
      {/* ============================================================== */}
      <section className="py-16 bg-gradient-to-b from-navy-900 to-[#060b17] border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-red-600 via-amber-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-red-500/25 mb-6">
            <ShieldAlertIcon className="w-8 h-8" />
          </div>

          <h3 className="text-3xl font-black text-white tracking-tight">
            Ready to inspect the Emergency Operations Platform?
          </h3>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
            Log in to access the real-time Incident Command Dashboard, view live distress logs, responder rosters,
            and Bluetooth relay telemetry.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 transition transform hover:-translate-y-0.5"
            >
              Sign In as Administrator
            </button>
            <button
              type="button"
              onClick={onOpenSignup}
              className="w-full sm:w-auto px-8 py-3.5 bg-navy-800 hover:bg-navy-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition"
            >
              Register New Account
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 7. FOOTER                                                      */}
      {/* ============================================================== */}
      <footer className="mt-auto border-t border-slate-800 bg-[#040811] py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldIcon className="w-4 h-4 text-red-500" />
            <span className="font-bold text-slate-400">RescueLink</span>
            <span>— Offline Bluetooth Emergency SOS System</span>
          </div>

          <div className="flex items-center space-x-6">
            <button type="button" onClick={onOpenLogin} className="hover:text-slate-300 transition">
              Admin Login
            </button>
            <button type="button" onClick={onOpenSignup} className="hover:text-slate-300 transition">
              Sign Up
            </button>
            <span className="text-slate-600">|</span>
            <span>React 18 • Vite 6 • Express • SQLite WAL • BLE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
