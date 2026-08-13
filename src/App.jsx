import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TodayView } from './components/TodayView';
import { WeekView } from './components/WeekView';
import { TrainingView } from './components/TrainingView';
import { NutritionCareView } from './components/NutritionCareView';
import { InventoryView } from './components/InventoryView';
import { DataEngineeringView } from './components/DataEngineeringView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { ShieldCheck, LogOut, User as UserIcon, Settings } from 'lucide-react';

const MainContent = () => {
  const { user, loadingAuth, logout, activeTab, setActiveTab, userPreferences } = useApp();

  if (loadingAuth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        color: 'var(--text-secondary, #888)',
        fontSize: '14px'
      }}>
        Verifying Doctrine OS Security Session...
      </div>
    );
  }

  // Render Login View if Unauthenticated
  if (!user) {
    return <LoginView />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'today': return <TodayView />;
      case 'week': return <WeekView />;
      case 'training': return <TrainingView />;
      case 'nutrition': return <NutritionCareView />;
      case 'inventory': return <InventoryView />;
      case 'dataeng': return <DataEngineeringView />;
      case 'settings': return <SettingsView />;
      default: return <TodayView />;
    }
  };

  const displayName = userPreferences?.customDisplayName || user?.displayName || 'Doctrine User';

  return (
    <div className="app-container">
      {/* APP TOP BRAND HEADER */}
      <header className="app-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px'
      }}>
        <div
          className="brand-title"
          onClick={() => setActiveTab('today')}
          style={{ cursor: 'pointer' }}
        >
          <ShieldCheck size={24} color="var(--accent-blue)" />
          <span>DOCTRINE OS</span>
          <span className="brand-badge">Self-Mastery</span>
        </div>

        {/* AUTHENTICATED USER BAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '8px',
              transition: 'background-color 0.15s ease'
            }}
            title="Open Profile & Settings"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
              />
            ) : (
              <UserIcon size={20} color="var(--text-secondary)" />
            )}
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {displayName}
            </span>
          </button>

          <button
            onClick={logout}
            title="Logout"
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '6px'
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* ACTIVE SCREEN CONTENT */}
      <main>
        {renderTab()}
      </main>

      {/* APPLE-STYLE BOTTOM NAVBAR */}
      <Navbar />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
