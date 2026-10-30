import React, { useState, useEffect } from 'react';
import { useAdminAuth } from './context/AdminAuthContext';
import adminApi from './api/adminApi';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

import LoginView from './views/LoginView';
import OverviewView from './views/OverviewView';
import IncidentsView from './views/IncidentsView';
import UsersView from './views/UsersView';
import RelayView from './views/RelayView';
import NotificationsView from './views/NotificationsView';
import AnalyticsView from './views/AnalyticsView';
import AuditLogsView from './views/AuditLogsView';

export default function App() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState(null);

  const fetchDashboard = async () => {
    if (!isAuthenticated) return;
    setIsRefreshing(true);
    try {
      const res = await adminApi.getDashboard();
      if (res.data) setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard overview:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboard();
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center text-slate-400 text-xs">
        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mr-3" />
        Initializing RescueLink Command Center...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const handleSelectIncidentFromOverview = (incident) => {
    setSelectedIncidentForDetail(incident);
    setActiveTab('incidents');
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Emergency Dashboard Overview',
          subtitle: 'Live situational metrics, distress alert status & gateway telemetry',
        };
      case 'incidents':
        return {
          title: 'SOS Incident Management',
          subtitle: 'Search, review, geolocate, and update emergency distress lifecycles',
        };
      case 'users':
        return {
          title: 'Registered Users & Responders',
          subtitle: 'Manage responder accounts, security privileges, and account statuses',
        };
      case 'relay':
        return {
          title: 'Bluetooth Low Energy Mesh Telemetry',
          subtitle: 'Epidemic forwarding depth, hop metrics, and network node paths',
        };
      case 'notifications':
        return {
          title: 'Emergency Notification Dispatch Audits',
          subtitle: 'SMTP Email and Twilio SMS delivery confirmations with masked privacy',
        };
      case 'analytics':
        return {
          title: 'Situational Analytics & Trends',
          subtitle: 'Empirical distress data visualized without fabricated metrics',
        };
      case 'audit-logs':
        return {
          title: 'Administrative Security & Action Audit Ledger',
          subtitle: 'Chronological record of status updates, account modifications, and logins',
        };
      default:
        return { title: 'Admin Command', subtitle: '' };
    }
  };

  const { title, subtitle } = getTabTitle();

  return (
    <div className="min-h-screen bg-navy-900 text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onRefresh={fetchDashboard}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              data={dashboardData}
              onSelectIncident={handleSelectIncidentFromOverview}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentsView
              initialIncident={selectedIncidentForDetail}
              onClearInitialIncident={() => setSelectedIncidentForDetail(null)}
            />
          )}

          {activeTab === 'users' && <UsersView />}

          {activeTab === 'relay' && <RelayView />}

          {activeTab === 'notifications' && <NotificationsView />}

          {activeTab === 'analytics' && <AnalyticsView data={dashboardData} />}

          {activeTab === 'audit-logs' && <AuditLogsView />}
        </main>
      </div>
    </div>
  );
}
