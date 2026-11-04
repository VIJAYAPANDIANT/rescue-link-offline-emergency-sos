import React from 'react';
import {
  ActivityIcon,
  ShieldAlertIcon,
  UsersIcon,
  RadioIcon,
  BellIcon,
  BarChartIcon,
  FileTextIcon,
  LogOutIcon,
  ShieldIcon,
  CloseIcon,
} from './Icons';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function Sidebar({ activeTab, setActiveTab, mobileOpen = false, onCloseMobile, onNavigateHome, onLogout }) {
  const { user, logout } = useAdminAuth();

  const handleLogout = () => {
    logout();
    if (onLogout) onLogout();
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: ActivityIcon },
    { id: 'incidents', label: 'Incident Management', icon: ShieldAlertIcon },
    { id: 'users', label: 'User Accounts', icon: UsersIcon },
    { id: 'relay', label: 'Relay Network', icon: RadioIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'analytics', label: 'Analytics & Trends', icon: BarChartIcon },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileTextIcon },
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
              <ShieldIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-wide flex items-center">
                Rescue<span className="text-red-500">Link</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Emergency Command
              </p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
              aria-label="Close navigation drawer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Admin Profile Footer */}
      <div className="p-4 border-t border-slate-800 bg-navy-900/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs uppercase shrink-0">
              {user?.name ? user.name[0] : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] text-purple-400 truncate font-semibold uppercase">Command Dispatcher</p>
            </div>
          </div>
        </div>

        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="w-full mb-2 flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition"
            aria-label="View RescueLink public landing page"
          >
            <span>Public Home Portal</span>
            <span className="text-red-400">↗</span>
          </button>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-red-950/40 hover:text-red-400 hover:border-red-500/40 text-xs font-semibold transition"
          aria-label="Sign out of command session"
        >
          <LogOutIcon className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-navy-850 border-r border-slate-800 flex-col h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden flex"
          onClick={onCloseMobile}
        >
          <div
            className="w-72 bg-navy-850 border-r border-slate-800 h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
