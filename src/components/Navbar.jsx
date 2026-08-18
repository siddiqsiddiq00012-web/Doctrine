import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckSquare, LayoutDashboard, Wallet, Dumbbell, Sparkles } from 'lucide-react';

export const Navbar = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'today', label: 'Today', icon: CheckSquare },
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'training', label: 'Training', icon: Dumbbell },
    { id: 'skincare', label: 'Skin & Grooming', icon: Sparkles }
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
          >
            <Icon className="nav-icon" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

