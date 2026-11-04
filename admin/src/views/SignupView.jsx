import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldIcon, AlertCircleIcon, CheckCircleIcon, ChevronLeftIcon } from '../components/Icons';

export default function SignupView({ onBackToHome, onSwitchToLogin, onSignupSuccess }) {
  const { register } = useAdminAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name || name.trim().length < 2) {
      setError('Please provide a full name with at least 2 characters.');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(name.trim(), email.trim(), password, role);
      if (res.user?.role === 'admin') {
        setSuccessMsg('Administrator account created! Directing to Command Center...');
        setTimeout(() => {
          if (onSignupSuccess) onSignupSuccess();
        }, 500);
      } else {
        setSuccessMsg(`Account created successfully for ${res.user?.name || name} (${role})! You can now log in.`);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please verify your details or use a different email.');
      setLoading(false);
    }
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

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-red-500/25 mb-4">
            <ShieldIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Create Account</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Join the RescueLink Disaster Response & Mesh Operations
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start space-x-2.5 text-xs text-red-300">
            <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-300">
            <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <p className="leading-relaxed">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Full Name / Call Sign
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Commander Jane Doe"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane.doe@rescuelink.org"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Password (min 6 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Operational Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition ${
                  role === 'admin'
                    ? 'bg-red-600/20 border-red-500 text-red-300 font-bold'
                    : 'bg-navy-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setRole('responder')}
                className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition ${
                  role === 'responder'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-navy-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Responder
              </button>
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition ${
                  role === 'user'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                    : 'bg-navy-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                Civilian
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {role === 'admin' && '⭐ Full access to Command Center, Incidents, Users & Audit Logs.'}
              {role === 'responder' && '🚑 Emergency field personnel authorization.'}
              {role === 'user' && '📱 Standard civilian account for mobile distress signaling.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        {/* Switch to Login */}
        {onSwitchToLogin && (
          <div className="mt-6 text-center text-xs text-slate-400">
            Already registered with RescueLink?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-red-400 hover:text-red-300 font-semibold underline transition ml-1"
            >
              Sign In here
            </button>
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            RescueLink Disaster Network • Zero-Infrastructure Resilient SOS
          </p>
        </div>
      </div>
    </div>
  );
}
