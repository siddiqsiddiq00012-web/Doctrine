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
  ArrowLeft,
  LogOut
} from 'lucide-react';

export const ProfileView = () => {
  const {
    user,
    logout,
    userPreferences,
    updateUserPreferences,
    uploadUserAvatar,
    deleteUserAvatar,
    activeAvatarUrl,
    setActiveTab
  } = useApp();

  // Distinct Modes: 'view' | 'edit'
  const [isEditing, setIsEditing] = useState(false);

  const DEFAULT_BIO = 'Perhaps a life is measured less by what it gathers than by what it gradually becomes. In the space between what is given and what is chosen, character takes shape.';
  const DEFAULT_AVATAR = '/profile-picture.jpg';

  // Form Editing State
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [selectedImageDataUri, setSelectedImageDataUri] = useState(null); // Pending new file upload
  const [revertToGoogle, setRevertToGoogle] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Sync form state when userPreferences change or entering edit mode
  useEffect(() => {
    if (userPreferences) {
      const currentName = userPreferences.customDisplayName || user?.displayName || '';
      const currentBio = userPreferences.bio || DEFAULT_BIO;
      const currentAvatar = userPreferences.customAvatarUrl || DEFAULT_AVATAR;
      setEditName(currentName);
      setEditBio(currentBio);
      setSelectedImageDataUri(null);
      setRevertToGoogle(false);
      setImagePreview(currentAvatar || user?.avatarUrl || DEFAULT_AVATAR);
    }
  }, [userPreferences, user, isEditing]);

  // Client-side Image Optimization & Canvas Cropping (400x400 max)
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
        const MAX_SIZE = 400;
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

        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSelectedImageDataUri(optimizedDataUrl);
        setRevertToGoogle(false);
        setImagePreview(optimizedDataUrl);
        setStatusMessage(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRevertToGoogleAvatar = () => {
    setSelectedImageDataUri(null);
    setRevertToGoogle(true);
    setImagePreview(user?.avatarUrl || '');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (editBio.length > 180) {
      setStatusMessage({ type: 'error', text: 'Bio cannot exceed 180 characters' });
      return;
    }

    if (!editName.trim()) {
      setStatusMessage({ type: 'error', text: 'Display name cannot be empty' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      // 1. Handle Avatar File Upload / Revert if modified
      if (selectedImageDataUri) {
        const avatarRes = await uploadUserAvatar(selectedImageDataUri);
        if (!avatarRes.success) {
          setSaving(false);
          setStatusMessage({ type: 'error', text: avatarRes.error || 'Failed to save avatar image' });
          return;
        }
      } else if (revertToGoogle) {
        const revertRes = await deleteUserAvatar();
        if (!revertRes.success) {
          setSaving(false);
          setStatusMessage({ type: 'error', text: revertRes.error || 'Failed to revert avatar photo' });
          return;
        }
      }

      // 2. Save Name & Bio Preferences
      const prefRes = await updateUserPreferences({
        customDisplayName: editName.trim(),
        bio: editBio.trim()
      });

      setSaving(false);

      if (prefRes.success) {
        setStatusMessage({ type: 'success', text: 'Profile saved successfully' });
        setTimeout(() => {
          setStatusMessage(null);
          setIsEditing(false);
        }, 600);
      } else {
        setStatusMessage({ type: 'error', text: prefRes.error || 'Failed to save preferences' });
      }
    } catch (err) {
      setSaving(false);
      setStatusMessage({ type: 'error', text: err.message || 'Error updating profile' });
    }
  };

  const displayName = userPreferences?.customDisplayName || user?.displayName || 'Doctrine User';
  const bioText = userPreferences?.bio || DEFAULT_BIO;

  const joinDateStr = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : 'Member';

  // ----------------------------------------------------
  // 1. VIEW PROFILE MODE (MODERN UN-BOXED SOCIAL PROFILE UX)
  // ----------------------------------------------------
  if (!isEditing) {
    return (
      <div className="profile-view workspace-readable" style={{
        padding: '36px 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>

        {/* LARGE PROMINENT PROFILE PHOTO */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          {activeAvatarUrl ? (
            <img
              src={activeAvatarUrl}
              alt={displayName}
              style={{
                width: '112px',
                height: '112px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--border-color)',
                boxShadow: 'var(--shadow-md)',
                transition: 'transform 0.2s ease'
              }}
            />
          ) : (
            <div style={{
              width: '112px',
              height: '112px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-blue-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <UserIcon size={56} color="var(--accent-blue)" />
            </div>
          )}
        </div>

        {/* DISPLAY NAME */}
        <h1 style={{
          fontSize: '26px',
          fontWeight: 800,
          letterSpacing: '-0.6px',
          color: 'var(--text-primary)',
          margin: '0 0 4px 0'
        }}>
          {displayName}
        </h1>

        {/* EMAIL ADDRESS */}
        <p style={{
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          margin: '0 0 18px 0',
          fontWeight: 500
        }}>
          <Mail size={13} />
          <span>{user?.email}</span>
        </p>

        {/* NATURAL TYPOGRAPHY BIO (UN-BOXED, HUMAN PROFILE TEXT) */}
        <div style={{
          width: '100%',
          maxWidth: '440px',
          marginBottom: '20px'
        }}>
          {bioText ? (
            <p style={{
              fontSize: '15px',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              margin: 0,
              fontWeight: 400
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
              No personal bio added yet.
            </p>
          )}
        </div>

        {/* SUBTLE ACCOUNT META INFORMATION */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          marginBottom: '32px'
        }}>
          <Calendar size={13} />
          <span>Joined {joinDateStr}</span>
        </div>

        {/* MODERN ACTION BAR */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          maxWidth: '360px'
        }}>
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '11px 20px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '24px',
                boxShadow: 'var(--shadow-sm)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Edit3 size={15} /> Edit Profile
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '11px 20px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '24px',
                cursor: 'pointer'
              }}
            >
              <Settings size={15} /> Settings
            </button>
          </div>

          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderRadius: '24px',
              color: 'var(--accent-red)',
              borderColor: 'var(--border-color)',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>

      </div>
    );
  }

  // ----------------------------------------------------
  // 2. EDIT PROFILE MODE (DEDICATED MODAL / OVERLAY UX)
  // ----------------------------------------------------
  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsEditing(false)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}
            title="Cancel"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px', margin: 0 }}>
            Edit Profile
          </h2>
        </div>
      </div>

      {/* Feedback Alert */}
      {statusMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
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
        
        {/* 1. Contextual Avatar Photo Editor */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '28px'
        }}>
          <div style={{ position: 'relative', cursor: 'pointer' }}>
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Profile Preview"
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />
            ) : (
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <UserIcon size={48} color="var(--accent-blue)" />
              </div>
            )}

            {/* Contextual Camera Badge Overlay */}
            <label
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                backgroundColor: 'var(--accent-blue)',
                color: '#ffffff',
                borderRadius: '50%',
                padding: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
                border: '2px solid var(--bg-primary)'
              }}
              title="Change profile photo"
            >
              <Camera size={14} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <label
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '16px'
              }}
            >
              Change Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileUpload}
                style={{ display: 'none' }}
              />
            </label>

            {(userPreferences?.customAvatarUrl || selectedImageDataUri) && (
              <button
                type="button"
                onClick={handleRevertToGoogleAvatar}
                className="btn btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '16px',
                  color: 'var(--accent-amber)'
                }}
              >
                <RotateCcw size={12} style={{ marginRight: '4px' }} /> Use Google Photo
              </button>
            )}
          </div>
        </div>

        {/* 2. Display Name Input */}
        <div style={{ marginBottom: '22px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Display Name
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your preferred display name"
            className="form-input"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '15px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)'
            }}
            required
          />
        </div>

        {/* 3. Personal Bio Textarea */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Personal Bio
            </label>
            <span style={{ fontSize: '12px', color: editBio.length > 180 ? 'var(--accent-red)' : 'var(--text-tertiary)' }}>
              {editBio.length} / 180
            </span>
          </div>

          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            maxLength={180}
            rows={3}
            placeholder="Building my future one system at a time."
            className="form-input"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '15px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="btn btn-secondary"
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '20px' }}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600, borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {saving ? 'Saving...' : <><Save size={15} /> Save Changes</>}
          </button>
        </div>

      </form>
    </div>
  );
};
