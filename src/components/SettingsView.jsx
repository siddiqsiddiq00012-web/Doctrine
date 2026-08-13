import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NON_NEGOTIABLE_RULES, ACTIVE_INGREDIENTS } from '../data/doctrineData';
import {
  User as UserIcon,
  Shield,
  Download,
  Upload,
  LogOut,
  Check,
  Moon,
  Sun,
  Monitor,
  Sparkles,
  Save,
  AlertCircle
} from 'lucide-react';

export const SettingsView = () => {
  const {
    user,
    logout,
    userPreferences,
    updateUserPreferences,
    activeAvatarUrl,
    exportData,
    importData
  } = useApp();

  const fileInputRef = useRef(null);

  // Active section inside Settings
  const [activeSection, setActiveSection] = useState('profile');

  // Edit form state
  const [customName, setCustomName] = useState('');
  const [bio, setBio] = useState('');
  const [theme, setTheme] = useState('light');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [weekStart, setWeekStart] = useState('MONDAY');

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Sync state with userPreferences
  useEffect(() => {
    if (userPreferences) {
      setCustomName(userPreferences.customDisplayName || user?.displayName || '');
      setBio(userPreferences.bio || '');
      setTheme(userPreferences.theme || 'light');
      setTimeFormat(userPreferences.timeFormat || '12h');
      setWeekStart(userPreferences.weekStart || 'MONDAY');
    }
  }, [userPreferences, user]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();

    if (bio.length > 160) {
      setSaveStatus({ type: 'error', message: 'Bio cannot exceed 160 characters' });
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    const result = await updateUserPreferences({
      customDisplayName: customName,
      bio,
      theme,
      timeFormat,
      weekStart
    });

    setSaving(false);
    if (result.success) {
      setSaveStatus({ type: 'success', message: 'Preferences saved successfully' });
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus({ type: 'error', message: result.error || 'Failed to save preferences' });
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

  const formattedJoinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Active Member';

  return (
    <div className="settings-view" style={{ maxWidth: '840px', margin: '0 auto' }}>
      
      {/* 1. HERO USER PROFILE CARD (CLEAN: NO GOOGLE VERIFIED BADGE, NO DOCTRINE METRICS) */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            {activeAvatarUrl ? (
              <img
                src={activeAvatarUrl}
                alt={user.displayName}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />
            ) : (
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <UserIcon size={36} color="var(--accent-blue)" />
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                {userPreferences?.customDisplayName || user?.displayName || 'Personal Account'}
              </h2>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {user?.email}
            </p>

            {userPreferences?.bio && (
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '6px', fontStyle: 'italic' }}>
                "{userPreferences.bio}"
              </p>
            )}

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              <span>Joined: <strong>{formattedJoinDate}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECTION TABS NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '12px',
        marginBottom: '16px',
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'profile', label: 'Personal Preferences', icon: UserIcon },
          { id: 'data', label: 'Data & Privacy', icon: Download },
          { id: 'account', label: 'Account & Security', icon: Shield },
          { id: 'reference', label: 'Doctrine Reference', icon: Sparkles }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                borderRadius: '8px'
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SAVE FEEDBACK ALERT */}
      {saveStatus && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 600,
          backgroundColor: saveStatus.type === 'success' ? 'var(--accent-green-subtle)' : 'var(--accent-red-subtle)',
          color: saveStatus.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${saveStatus.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`
        }}>
          {saveStatus.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* 3. SECTION 1: PERSONAL PREFERENCES */}
      {activeSection === 'profile' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserIcon size={18} color="var(--accent-blue)" /> Personal Preferences
            </span>
          </div>

          <form onSubmit={handleSavePreferences}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Application Display Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={user?.displayName || 'Enter preferred name'}
                className="form-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px', borderRadius: '8px' }}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Personal Bio
                </label>
                <span style={{ fontSize: '12px', color: bio.length > 160 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>
                  {bio.length} / 160
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                placeholder="Building my future one system at a time."
                className="form-input"
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px', borderRadius: '8px', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '10px 20px', fontSize: '14px' }}>
                {saving ? 'Saving...' : <><Save size={15} /> Save Preferences</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. SECTION 2: DATA & PRIVACY */}
      {activeSection === 'data' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} color="var(--accent-blue)" /> Data Backup & Privacy Control
            </span>
          </div>
          <div className="card-subtitle" style={{ marginTop: '4px' }}>
            Export your entire Doctrine tracking database to JSON or import from another device.
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ flex: 1, minWidth: '180px', padding: '12px' }} onClick={exportData}>
              <Download size={16} /> Export JSON Backup
            </button>

            <button className="btn btn-secondary" style={{ flex: 1, minWidth: '180px', padding: '12px' }} onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Import Backup
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ marginTop: '20px', padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-card-subtle)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Privacy Guarantee:</strong> Your data is stored locally in your private SQLite database (`doctrine.db`) and associated exclusively with your authenticated Google identity. It is never sold or transmitted to third parties.
          </div>
        </div>
      )}

      {/* 5. SECTION 3: ACCOUNT & SECURITY */}
      {activeSection === 'account' && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-title" style={{ marginBottom: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--accent-green)" /> Account Security & Session Management
            </span>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-card-subtle)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Google OAuth Connection</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Connected via Google Cloud OAuth 2.0</div>
              </div>
              <span className="badge badge-success">Active</span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              Session Security: HTTP-Only Signed Cookies (`doctrine_session`, 7-day TTL).
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-red)' }}>Sign Out</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Terminate active authenticated session on this device.</div>
            </div>

            <button
              onClick={logout}
              className="btn"
              style={{
                backgroundColor: 'var(--accent-red-subtle)',
                color: 'var(--accent-red)',
                border: '1px solid var(--accent-red)',
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px'
              }}
            >
              <LogOut size={16} /> Sign Out Now
            </button>
          </div>
        </div>
      )}

      {/* 6. SECTION 4: DOCTRINE REFERENCE */}
      {activeSection === 'reference' && (
        <>
          <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
            <div className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="var(--accent-amber)" /> Non-Negotiable Rules Reference (Verbatim)
              </span>
            </div>
            <div style={{ marginTop: '12px' }}>
              {NON_NEGOTIABLE_RULES.map((r) => (
                <div key={r.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{r.rule}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-purple)" /> Active Ingredient Schedule
              </span>
            </div>
            <div style={{ marginTop: '12px' }}>
              {ACTIVE_INGREDIENTS.map((item, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-purple)' }}>{item.days}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{item.active}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
