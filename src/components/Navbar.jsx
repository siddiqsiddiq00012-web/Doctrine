import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, CheckSquare, Utensils, Terminal, User } from 'lucide-react';

export const Navbar = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'today', label: 'Today', icon: CheckSquare },
    { id: 'nutrition', label: 'Food', icon: Utensils },
    { id: 'dataeng', label: 'Data', icon: Terminal },
    { id: 'profile', label: 'Profile', icon: User }
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

