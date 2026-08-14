import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HomeView } from './components/HomeView';
import { TodayView } from './components/TodayView';
import { HistoryView } from './components/HistoryView';
import { WeekView } from './components/WeekView';
import { ProfileView } from './components/ProfileView';
import { TrainingView } from './components/TrainingView';
import { NutritionCareView } from './components/NutritionCareView';
import { InventoryView } from './components/InventoryView';
import { DataEngineeringView } from './components/DataEngineeringView';
import { SkincareView } from './components/SkincareView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { OverflowMenu } from './components/OverflowMenu';
import { ShieldCheck, User as UserIcon } from 'lucide-react';

const MainContent = () => {
  const { user, loadingAuth, activeTab, setActiveTab, userPreferences, activeAvatarUrl } = useApp();

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
        Verifying Doctrine Security Session...
      </div>
    );
  }

  // Login gate temporarily bypassed for instant full-site access
  // if (!user) {
  //   return <LoginView />;
  // }

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <HomeView />;
      case 'today': return <TodayView />;
      case 'skincare': return <SkincareView />;
      case 'history': return <HistoryView />;
      case 'week': return <WeekView />;
      case 'profile': return <ProfileView />;
      case 'training': return <TrainingView />;
      case 'nutrition': return <NutritionCareView />;
      case 'inventory': return <InventoryView />;
      case 'dataeng': return <DataEngineeringView />;
      case 'settings': return <SettingsView />;
      default: return <HomeView />;
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
        padding: '12px 16px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div
          className="brand-title"
          onClick={() => setActiveTab('home')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.3px' }}
        >
          <ShieldCheck size={22} color="var(--accent-blue)" />
          <span>DOCTRINE</span>
        </div>

        {/* HEADER ACTIONS: MINIMAL PROFILE CONTROL + OVERFLOW MENU */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: activeTab === 'profile' ? 'var(--accent-blue-subtle)' : 'none',
              border: activeTab === 'profile' ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
              borderRadius: '50%',
              cursor: 'pointer',
              padding: 0,
              overflow: 'hidden',
              transition: 'all 0.15s ease'
            }}
            aria-label="View profile"
            title={displayName}
          >
            {activeAvatarUrl ? (
              <img
                src={activeAvatarUrl}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <UserIcon size={18} color={activeTab === 'profile' ? 'var(--accent-blue)' : 'var(--text-secondary)'} />
            )}
          </button>

          <OverflowMenu />
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
