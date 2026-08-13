import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { INITIAL_INVENTORY, PREPARED_FOR_TOMORROW_TEMPLATES } from '../data/doctrineData';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const getTodayStr = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // User Preferences State
  const [userPreferences, setUserPreferences] = useState({
    customDisplayName: '',
    theme: 'light',
    timeFormat: '12h',
    weekStart: 'MONDAY',
  });

  // Backend DB Daily Executions cache
  const [dailyLogs, setDailyLogs] = useState({});

  // Local storage fallbacks for inventory, workout logs, sunday reviews, data engineering
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = localStorage.getItem('doctrine_inventory');
      return saved ? JSON.parse(saved) : INITIAL_INVENTORY;
    } catch (e) {
      return INITIAL_INVENTORY;
    }
  });

  const [workoutLogs, setWorkoutLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('doctrine_workout_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [sundayReviews, setSundayReviews] = useState(() => {
    try {
      const saved = localStorage.getItem('doctrine_sunday_reviews');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [dataEngineering, setDataEngineering] = useState(() => {
    try {
      const saved = localStorage.getItem('doctrine_data_engineering');
      return saved ? JSON.parse(saved) : {
        lastStudied: 'SQL Window Functions & Partitioning',
        nextStartingPoint: 'PySpark Structured Streaming & Kafka Integration',
        currentCourse: 'Data Engineering Masterclass 2026',
        totalMinutes: 720,
        logs: [
          { date: getTodayStr(), minutes: 60, topic: 'Spark Optimization & Repartitioning', notes: 'Completed benchmark tests on 10GB dataset.' }
        ]
      };
    } catch (e) {
      return { lastStudied: '', nextStartingPoint: '', currentCourse: '', totalMinutes: 0, logs: [] };
    }
  });

  // 1. Fetch User Preferences from Backend
  const fetchUserPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/user/preferences', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserPreferences(data);
      }
    } catch (e) {
      console.error('Failed to fetch user preferences:', e);
    }
  }, []);

  // Update preferences on backend
  const updateUserPreferences = async (newPrefs) => {
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPrefs)
      });
      if (res.ok) {
        const data = await res.json();
        setUserPreferences(data.preferences);
        return { success: true };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || 'Save failed' };
      }
    } catch (e) {
      console.error('Error saving user preferences:', e);
      return { success: false, error: e.message };
    }
  };

  // 2. Check Authenticated Session on Mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          fetchUserPreferences();
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth verification failed:', err);
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, [fetchUserPreferences]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Apply Theme Attribute to DOM
  useEffect(() => {
    const activeTheme = userPreferences.theme || 'light';
    if (activeTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (activeTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [userPreferences.theme]);

  // 3. Fetch Historical Date Record from Backend DB
  const fetchHistoryForDate = useCallback(async (dateStr) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/history/${dateStr}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const { execution, tasks } = data;

        const completedTasks = {};
        const namaz = { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false };
        const anchors = { medKcalReached: false, amSkincare: false, pmSkincare: false, massShakeTaken: false };
        const preparedForTomorrow = {};

        tasks.forEach(t => {
          const isDone = t.status === 'COMPLETED';
          if (t.taskKey.startsWith('namaz_')) {
            const prayerName = t.taskKey.replace('namaz_', '');
            namaz[prayerName] = isDone;
          } else if (t.taskKey.startsWith('anchor_')) {
            const anchorName = t.taskKey.replace('anchor_', '');
            anchors[anchorName] = isDone;
          } else if (t.taskKey.startsWith('prep_')) {
            const prepId = t.taskKey.replace('prep_', '');
            preparedForTomorrow[prepId] = isDone;
          } else {
            completedTasks[t.taskKey] = {
              completed: isDone,
              timestamp: t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
            };
          }
        });

        const formattedLog = {
          date: execution.date,
          dayOfWeek: execution.dayOfWeek,
          completedTasks,
          namaz,
          tahajjud: Boolean(execution.tahajjud),
          anchors,
          preparedForTomorrow,
          waterLiters: execution.waterLiters || 0,
          notes: execution.notes || ''
        };

        setDailyLogs(prev => ({ ...prev, [dateStr]: formattedLog }));
      }
    } catch (e) {
      console.error(`Failed to fetch history for ${dateStr}:`, e);
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedDate) {
      fetchHistoryForDate(selectedDate);
    }
  }, [user, selectedDate, fetchHistoryForDate]);

  // Centralized Time Formatter
  const formatTimeDisplay = (timeString) => {
    if (!timeString) return '';
    if (userPreferences.timeFormat === '24h') {
      // Convert "06:00 AM" to "06:00"
      const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const period = match[3] ? match[3].toUpperCase() : '';
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }
    }
    return timeString;
  };

  // Helper to ensure daily log state fallback
  const getOrCreateDailyLog = (dateStr) => {
    if (dailyLogs[dateStr]) {
      return dailyLogs[dateStr];
    }
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayName = dayNames[dateObj.getDay()];

    return {
      date: dateStr,
      dayOfWeek: dayName,
      completedTasks: {},
      namaz: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
      tahajjud: false,
      anchors: { medKcalReached: false, amSkincare: false, pmSkincare: false, massShakeTaken: false },
      preparedForTomorrow: PREPARED_FOR_TOMORROW_TEMPLATES.reduce((acc, item) => {
        acc[item.id] = false;
        return acc;
      }, {}),
      waterLiters: 0,
      notes: ''
    };
  };

  // Toggle actions backed by Server DB
  const toggleTask = async (dateStr, taskId) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/history/${dateStr}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ taskKey: taskId })
      });
      if (res.ok) {
        fetchHistoryForDate(dateStr);
      }
    } catch (e) {
      console.error('Toggle task error:', e);
    }
  };

  const toggleNamaz = async (dateStr, prayer) => {
    if (!user) return;
    await toggleTask(dateStr, `namaz_${prayer}`);
  };

  const toggleAnchor = async (dateStr, anchorKey) => {
    if (!user) return;
    await toggleTask(dateStr, `anchor_${anchorKey}`);
  };

  const togglePrepItem = async (dateStr, prepId) => {
    if (!user) return;
    await toggleTask(dateStr, `prep_${prepId}`);
  };

  const toggleTahajjud = async (dateStr) => {
    if (!user) return;
    const currentLog = getOrCreateDailyLog(dateStr);
    const nextVal = !currentLog.tahajjud;
    try {
      const res = await fetch(`/api/history/${dateStr}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tahajjud: nextVal })
      });
      if (res.ok) {
        fetchHistoryForDate(dateStr);
      }
    } catch (e) {
      console.error('Tahajjud toggle error:', e);
    }
  };

  const setWaterLiters = async (dateStr, liters) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/history/${dateStr}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ waterLiters: liters })
      });
      if (res.ok) {
        fetchHistoryForDate(dateStr);
      }
    } catch (e) {
      console.error('Water update error:', e);
    }
  };

  // Inventory actions
  const updateInventoryItem = (id, updates) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const addInventoryItem = (newItem) => {
    setInventory(prev => [...prev, { ...newItem, id: 'inv-' + Date.now() }]);
  };

  const deleteInventoryItem = (id) => {
    setInventory(prev => prev.filter(item => item.id !== id));
  };

  const toggleInCart = (id) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, inCart: !item.inCart } : item));
  };

  const markPurchasedAndRestock = (id) => {
    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          currentQty: item.currentQty + item.purchaseQty,
          inCart: false,
          lastPurchased: getTodayStr()
        };
      }
      return item;
    }));
  };

  // Workout actions
  const logWorkoutSession = (session) => {
    setWorkoutLogs(prev => [session, ...prev]);
  };

  // Data Engineering actions
  const updateDataEngState = (updates) => {
    setDataEngineering(prev => ({ ...prev, ...updates }));
  };

  const addDataEngLog = (logEntry) => {
    setDataEngineering(prev => ({
      ...prev,
      totalMinutes: prev.totalMinutes + (Number(logEntry.minutes) || 0),
      lastStudied: logEntry.topic || prev.lastStudied,
      nextStartingPoint: logEntry.nextStartingPoint || prev.nextStartingPoint,
      logs: [logEntry, ...prev.logs]
    }));
  };

  // Sunday review actions
  const saveSundayReview = (dateStr, reviewData) => {
    setSundayReviews(prev => ({ ...prev, [dateStr]: reviewData }));
  };

  // Logout Action
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setDailyLogs({});
    }
  };

  // Export & Import
  const exportData = () => {
    const data = {
      user,
      userPreferences,
      dailyLogs,
      inventory,
      workoutLogs,
      sundayReviews,
      dataEngineering,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doctrine_backup_${getTodayStr()}.json`;
    a.click();
  };

  const importData = (jsonData) => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.dailyLogs) setDailyLogs(parsed.dailyLogs);
      if (parsed.inventory) setInventory(parsed.inventory);
      if (parsed.workoutLogs) setWorkoutLogs(parsed.workoutLogs);
      if (parsed.sundayReviews) setSundayReviews(parsed.sundayReviews);
      if (parsed.dataEngineering) setDataEngineering(parsed.dataEngineering);
      alert('Data imported successfully!');
    } catch (e) {
      alert('Invalid backup file formatting.');
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      loadingAuth,
      logout,
      userPreferences,
      updateUserPreferences,
      formatTimeDisplay,
      activeTab,
      setActiveTab,
      selectedDate,
      setSelectedDate,
      getTodayStr,
      getOrCreateDailyLog,
      dailyLogs,
      fetchHistoryForDate,
      toggleTask,
      toggleNamaz,
      toggleTahajjud,
      toggleAnchor,
      togglePrepItem,
      setWaterLiters,
      inventory,
      updateInventoryItem,
      addInventoryItem,
      deleteInventoryItem,
      toggleInCart,
      markPurchasedAndRestock,
      workoutLogs,
      logWorkoutSession,
      sundayReviews,
      saveSundayReview,
      dataEngineering,
      updateDataEngState,
      addDataEngLog,
      exportData,
      importData
    }}>
      {children}
    </AppContext.Provider>
  );
};
