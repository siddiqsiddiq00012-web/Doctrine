import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, CheckSquare, Calendar, Clock, User, Dumbbell, Sparkles, Utensils, Package, Terminal, Settings } from 'lucide-react';

export const Navbar = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'today', label: 'Today', icon: CheckSquare },
    { id: 'skincare', label: 'Skincare', icon: Sparkles },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'week', label: 'Week', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'training', label: 'Training', icon: Dumbbell },
    { id: 'nutrition', label: 'Care & Food', icon: Utensils },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'dataeng', label: 'Data Eng', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav className="bottom-nav">
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
