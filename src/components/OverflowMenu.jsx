import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MoreVertical, Sparkles, Dumbbell, Package, Clock, Settings, Wallet, ShoppingBag, Target } from 'lucide-react';

export const OverflowMenu = () => {
  const { activeTab, setActiveTab } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const secondaryItems = [
    { id: 'goals', label: 'Goals & Hierarchy', icon: Target },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'cart', label: 'Cart', icon: ShoppingBag },
    { id: 'skincare', label: 'Skincare & Grooming', icon: Sparkles },
    { id: 'training', label: 'Training', icon: Dumbbell },
    { id: 'inventory', label: 'Resources', icon: Package },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const isSecondaryActive = secondaryItems.some(item => item.id === activeTab);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Close on Escape key press
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (tabId) => {
    setActiveTab(tabId);
    setIsOpen(false);
  };

  return (
    <div className="overflow-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`overflow-trigger-btn ${isSecondaryActive ? 'secondary-active' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="More navigation options"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="More navigation options"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          background: isSecondaryActive ? 'var(--accent-blue-subtle)' : 'var(--bg-card)',
          color: isSecondaryActive ? 'var(--accent-blue)' : 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div
          className="overflow-dropdown-menu"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '210px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            boxShadow: 'var(--shadow-md)',
            padding: '6px',
            zIndex: 1100,
            animation: 'fadeInScale 0.15s ease-out'
          }}
        >
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                role="menuitem"
                className={`overflow-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                  color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--accent-blue)' : 'var(--text-secondary)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
