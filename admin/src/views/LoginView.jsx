import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldIcon, AlertCircleIcon, ChevronLeftIcon } from '../components/Icons';

export default function LoginView({ onBackToHome, onSwitchToSignup }) {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both administrator email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setEmail('admin@rescuelink.org');
    setPassword('Admin@RescueLink2026');
    setError('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#060b17] via-[#0b1120] to-[#111827]">
      <div className="w-full max-w-md bg-navy-850 border border-slate-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        {/* Back to Home Button */}
        {onBackToHome && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60"
            >
              <ChevronLeftIcon className="w-4 h-4 mr-1 text-slate-400" />
              Back to Home
            </button>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center text-white shadow-xl shadow-red-500/25 mb-4">
            <ShieldIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">RescueLink Admin</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Emergency Distress Operations & Incident Command
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start space-x-2.5 text-xs text-red-300">
            <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Administrator Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rescuelink.org"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Auto-fill Demo Admin
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Command Center'}
          </button>
        </form>

        {/* Switch to Sign Up */}
        {onSwitchToSignup && (
          <div className="mt-6 text-center text-xs text-slate-400">
            Don't have an administrator account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-red-400 hover:text-red-300 font-semibold underline transition ml-1"
            >
              Sign Up here
            </button>
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Role-Based Access Protected. Default seeded credentials:
            <br />
            <code className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded text-[10px] mt-1 inline-block">
              admin@rescuelink.org / Admin@RescueLink2026
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
