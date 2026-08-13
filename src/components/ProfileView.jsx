import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  User as UserIcon,
  Settings,
  Edit3,
  Camera,
  RotateCcw,
  Check,
  AlertCircle,
  Mail,
  Calendar,
  Save,
  ArrowLeft
} from 'lucide-react';

export const ProfileView = () => {
  const {
    user,
    userPreferences,
    updateUserPreferences,
    activeAvatarUrl,
    setActiveTab
  } = useApp();

  // Distinct Modes: 'view' | 'edit'
  const [isEditing, setIsEditing] = useState(false);

  // Form Editing State
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Sync form state when userPreferences change or entering edit mode
  useEffect(() => {
    if (userPreferences) {
      const currentName = userPreferences.customDisplayName || user?.displayName || '';
      const currentBio = userPreferences.bio || '';
      const currentAvatar = userPreferences.customAvatarUrl || '';
      setEditName(currentName);
      setEditBio(currentBio);
      setAvatarUrlInput(currentAvatar);
      setImagePreview(currentAvatar || user?.avatarUrl || '');
    }
  }, [userPreferences, user, isEditing]);

  // Client-side Image Optimization & Resizing via HTML5 Canvas (300x300 max)
  const handleImageFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select a valid image file (JPEG, PNG, WebP)' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setStatusMessage({ type: 'error', text: 'Image file size must be under 10MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed WebP/JPEG Data URI for instant local storage
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarUrlInput(optimizedDataUrl);
        setImagePreview(optimizedDataUrl);
        setStatusMessage(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRevertToGoogleAvatar = () => {
    setAvatarUrlInput('');
    setImagePreview(user?.avatarUrl || '');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (editBio.length > 160) {
      setStatusMessage({ type: 'error', text: 'Bio cannot exceed 160 characters' });
      return;
    }

    if (!editName.trim()) {
      setStatusMessage({ type: 'error', text: 'Display name cannot be empty' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    const result = await updateUserPreferences({
      customDisplayName: editName.trim(),
      bio: editBio.trim(),
      customAvatarUrl: avatarUrlInput ? avatarUrlInput : null
    });

    setSaving(false);

    if (result.success) {
      setStatusMessage({ type: 'success', text: 'Profile saved successfully' });
      setTimeout(() => {
        setStatusMessage(null);
        setIsEditing(false);
      }, 800);
    } else {
      setStatusMessage({ type: 'error', text: result.error || 'Failed to save profile' });
    }
  };

  const displayName = userPreferences?.customDisplayName || user?.displayName || 'Doctrine User';
  const bioText = userPreferences?.bio || '';

  const joinDateStr = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Active Member';

  // ----------------------------------------------------
  // 1. VIEW PROFILE MODE (CLEAN PERSONAL PROFILE ONLY)
  // ----------------------------------------------------
  if (!isEditing) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '12px 4px' }}>
        
        {/* Main Personal Profile Card */}
        <div className="card" style={{
          padding: '32px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}>
          
          {/* Profile Photo */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            {activeAvatarUrl ? (
              <img
                src={activeAvatarUrl}
                alt={displayName}
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--border-color)',
                  boxShadow: 'var(--shadow-md)'
                }}
              />
            ) : (
              <div style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid var(--border-color)',
              }}>
                <UserIcon size={48} color="var(--accent-blue)" />
              </div>
            )}
          </div>

          {/* User Display Name */}
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
            margin: '0 0 4px 0'
          }}>
            {displayName}
          </h1>

          {/* Email Address */}
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: '0 0 16px 0'
          }}>
            <Mail size={14} />
            <span>{user?.email}</span>
          </p>

          {/* Personal Bio */}
          <div style={{
            width: '100%',
            maxWidth: '480px',
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            marginBottom: '24px',
            textAlign: bioText ? 'left' : 'center'
          }}>
            {bioText ? (
              <p style={{
                fontSize: '14px',
                color: 'var(--text-primary)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                margin: 0
              }}>
                {bioText}
              </p>
            ) : (
              <p style={{
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
                margin: 0
              }}>
                No personal bio added yet. Tap "Edit Profile" below to write your bio.
              </p>
            )}
          </div>

          {/* Account Meta Badges */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            marginBottom: '28px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} /> Joined {joinDateStr}
            </span>
          </div>

          {/* Clean Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            width: '100%',
            maxWidth: '380px'
          }}>
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '10px'
              }}
            >
              <Edit3 size={16} /> Edit Profile
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '10px'
              }}
            >
              <Settings size={16} /> Settings
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. EDIT PROFILE MODE (SEPARATE OVERLAY EXPERIENCE)
  // ----------------------------------------------------
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '12px 4px' }}>
      <div className="card" style={{ padding: '28px 24px' }}>
        
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', borderRadius: '8px' }}
              title="Cancel"
            >
              <ArrowLeft size={16} />
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
              Edit Profile
            </h2>
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 600,
            backgroundColor: statusMessage.type === 'success' ? 'var(--accent-green-subtle)' : 'var(--accent-red-subtle)',
            color: statusMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
            border: `1px solid ${statusMessage.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`
          }}>
            {statusMessage.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile}>
          
          {/* 1. Profile Picture Editing & Live Preview */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '28px',
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ position: 'relative' }}>
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Profile Preview"
                  style={{
                    width: '88px',
                    height: '88px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--border-color)'
                  }}
                />
              ) : (
                <div style={{
                  width: '88px',
                  height: '88px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-blue-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserIcon size={44} color="var(--accent-blue)" />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <label
                className="btn btn-secondary"
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px'
                }}
              >
                <Camera size={14} /> Upload Photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {avatarUrlInput && (
                <button
                  type="button"
                  onClick={handleRevertToGoogleAvatar}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '8px',
                    color: 'var(--accent-amber)'
                  }}
                >
                  <RotateCcw size={14} /> Use Google Photo
                </button>
              )}
            </div>
          </div>

          {/* 2. Application Display Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Display Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your preferred display name"
              className="form-input"
              style={{ width: '100%', padding: '12px 14px', fontSize: '14px', borderRadius: '8px' }}
              required
            />
          </div>

          {/* 3. Personal Bio */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Personal Bio
              </label>
              <span style={{ fontSize: '12px', color: editBio.length > 160 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>
                {editBio.length} / 160
              </span>
            </div>

            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Building my future one system at a time."
              className="form-input"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                borderRadius: '8px',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: '14px', borderRadius: '8px' }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ padding: '10px 22px', fontSize: '14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {saving ? 'Saving...' : <><Save size={15} /> Save Changes</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
