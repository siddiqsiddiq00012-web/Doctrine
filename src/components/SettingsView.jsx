import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sun,
  Moon,
  Monitor,
  Clock,
  Calendar,
  Shield,
  Download,
  Upload,
  LogOut,
  Check,
  AlertCircle,
  Eye,
  Sliders
} from 'lucide-react';

export const SettingsView = () => {
  const {
    user,
    logout,
    userPreferences,
    updateUserPreferences,
    exportData,
    importData
  } = useApp();

  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  const currentTheme = userPreferences?.theme || 'light';
  const currentWeekStart = userPreferences?.weekStart || 'MONDAY';
  const currentReducedMotion = userPreferences?.reducedMotion || 'system';

  const handleUpdateSetting = async (key, value) => {
    setSaving(true);
    setStatusMessage(null);

    const payload = {
      theme: key === 'theme' ? value : currentTheme,
      weekStart: key === 'weekStart' ? value : currentWeekStart,
      reducedMotion: key === 'reducedMotion' ? value : currentReducedMotion
    };

    const res = await updateUserPreferences(payload);
    setSaving(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Setting updated' });
      setTimeout(() => setStatusMessage(null), 1500);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update setting' });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      importData(event.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings-view workspace-readable" style={{ padding: '24px 16px 40px' }}>
      
      {/* 1. HEADER */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.6px', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
          Settings
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
          Application preferences, accessibility controls, and account session management.
        </p>
      </div>

      {/* FEEDBACK ALERT */}
      {statusMessage && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
          backgroundColor: statusMessage.type === 'success' ? 'var(--accent-green-subtle)' : 'var(--accent-red-subtle)',
          color: statusMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${statusMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`
        }}>
          {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. APPEARANCE SECTION */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)', marginBottom: '10px', paddingLeft: '4px' }}>
          Appearance
        </h2>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Theme</span>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{currentTheme}</span>
          </div>

          {/* Segmented Control Selector */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: '10px',
            padding: '3px',
            gap: '4px',
            border: '1px solid var(--border-color)'
          }}>
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'system', label: 'System', icon: Monitor }
            ].map(item => {
              const Icon = item.icon;
              const isSelected = currentTheme === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleUpdateSetting('theme', item.id)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--bg-primary)' : 'transparent',
                    color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. ADVANCED PRESENTATION & DISPLAY PREFERENCES (DEPRIORITIZED COLLAPSIBLE SECTION) */}
      <div style={{ marginBottom: '28px' }}>
        <details style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          <summary style={{
            padding: '16px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Advanced System & Display Preferences</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Expand to configure</span>
          </summary>

          <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
            {/* Time Format Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color="var(--text-secondary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Time Format</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Standardized 12-hour AM/PM format (e.g. 8:30 PM)</div>
                </div>
              </div>

              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: 'var(--accent-blue-subtle)',
                color: 'var(--accent-blue)'
              }}>
                12-Hour AM/PM
              </span>
            </div>

            {/* Week Start Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="var(--text-secondary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>First Day of Week</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Calendar view start day</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleUpdateSetting('weekStart', 'MONDAY')}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: currentWeekStart === 'MONDAY' ? 'var(--accent-blue-subtle)' : 'transparent',
                    color: currentWeekStart === 'MONDAY' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Monday
                </button>
                <button
                  onClick={() => handleUpdateSetting('weekStart', 'SUNDAY')}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: currentWeekStart === 'SUNDAY' ? 'var(--accent-blue-subtle)' : 'transparent',
                    color: currentWeekStart === 'SUNDAY' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Sunday
                </button>
              </div>
            </div>

            {/* Reduce Motion Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Eye size={18} color="var(--text-secondary)" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Reduce Motion</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Minimize UI transition animations</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleUpdateSetting('reducedMotion', 'system')}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: currentReducedMotion === 'system' ? 'var(--accent-blue-subtle)' : 'transparent',
                    color: currentReducedMotion === 'system' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Default
                </button>
                <button
                  onClick={() => handleUpdateSetting('reducedMotion', 'reduced')}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: currentReducedMotion === 'reduced' ? 'var(--accent-blue-subtle)' : 'transparent',
                    color: currentReducedMotion === 'reduced' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Reduced
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* 5. DATA & PRIVACY SECTION */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)', marginBottom: '10px', paddingLeft: '4px' }}>
          Data & Privacy
        </h2>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button
              onClick={exportData}
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '10px'
              }}
            >
              <Download size={15} /> Export Backup (JSON)
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '10px'
              }}
            >
              <Upload size={15} /> Restore Backup
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, lineHeight: '1.4' }}>
            Your data (Profile information, daily execution logs, preferences) is stored locally in your private SQLite database (`doctrine.db`) and associated exclusively with your authenticated account.
          </p>
        </div>
      </div>

      {/* 6. ACCOUNT SECTION */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-tertiary)', marginBottom: '10px', paddingLeft: '4px' }}>
          Account & Session
        </h2>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={18} color="var(--accent-green)" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Google Account</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user?.email}</div>
              </div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', backgroundColor: 'var(--accent-green-subtle)', color: 'var(--accent-green)' }}>
              Connected
            </span>
          </div>

          <button
            onClick={logout}
            className="btn"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: 'var(--accent-red-subtle)',
              color: 'var(--accent-red)',
              border: '1px solid var(--accent-red)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

    </div>
  );
};
