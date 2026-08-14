import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SHAKE_RECIPES, PROTOCOLS } from '../data/doctrineData';
import { Sparkles, Flame, Droplets, Check, BookOpen, ShieldAlert, HeartPulse, ChevronDown, ChevronUp } from 'lucide-react';

export const NutritionCareView = () => {
  const { selectedDate, getOrCreateDailyLog, toggleAnchor, setWaterLiters } = useApp();
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [activeProtocolTab, setActiveProtocolTab] = useState('RECOVERY_HIERARCHY');

  const currentLog = getOrCreateDailyLog(selectedDate);
  const water = currentLog.waterLiters || 0;

  const shakesList = [
    { key: 'massShakeTaken', name: 'Mass Shake (~950–1000 kcal)', calories: '1,000 kcal', desc: 'Oats + Bananas + Peanut Butter + Peanuts + Honey + Buffalo Milk' },
    { key: 'glowShake', name: 'Carrot-Beet Glow Shake (Mon/Thu/Sat AM)', calories: '250 kcal', desc: 'Fresh beetroot + carrots + lemon + water for skin tone & blood flow' },
    { key: 'repairShake', name: 'Papaya Skin Repair Shake (Tue PM)', calories: '200 kcal', desc: 'Papaya + banana + milk + honey for skin cell repair & collagen' },
    { key: 'warmMilk', name: 'Warm Milk + 1 tsp Flaxseed (Thu/Sun)', calories: '180 kcal', desc: 'Post-workout omega-3 barrier protection' },
    { key: 'kanji', name: 'Fermented Rice Kanji (Mon/Thu PM)', calories: '120 kcal', desc: '200 ml probiotic gut-skin axis fortification' }
  ];

  return (
    <div className="nutrition-care-view workspace-medium" style={{ paddingBottom: '40px' }}>
      {/* NUTRITION & MED CARD */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="var(--accent-amber)" /> MED Nutrition & Mass Building
          </span>
          <span className="badge badge-warning">2,700 kcal Target</span>
        </div>
        <div className="card-subtitle">
          Rule: Minimum 2,700 kcal every day, including rest days. Falling below triggers catabolism.
        </div>

        <div
          className={`check-item ${currentLog.anchors.medKcalReached ? 'completed' : ''}`}
          onClick={() => toggleAnchor(selectedDate, 'medKcalReached')}
          style={{ marginBottom: '16px' }}
        >
          <div className="checkbox-custom">
            {currentLog.anchors.medKcalReached && <Check size={14} />}
          </div>
          <div>
            <div className="task-text">MED 2,700 kcal Goal Reached Today</div>
            <div className="task-category">Mandatory Baseline</div>
          </div>
        </div>

        {/* Shakes Quick Logger */}
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
          Doctrine Shakes Quick Log
        </h3>

        {shakesList.map((shake) => {
          const isTaken = !!currentLog.anchors[shake.key];
          return (
            <div
              key={shake.key}
              className={`check-item ${isTaken ? 'completed' : ''}`}
              onClick={() => toggleAnchor(selectedDate, shake.key)}
            >
              <div className="checkbox-custom">
                {isTaken && <Check size={14} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="task-text" style={{ fontSize: '14px' }}>{shake.name}</span>
                  <span className="badge badge-purple">{shake.calories}</span>
                </div>
                <div className="task-category">{shake.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* VERBATIM RECIPE GUIDE EXPANDER */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--accent-blue)" /> Verbatim Recipe Cards
          </span>
          <span className="badge badge-purple">Exact Quantities</span>
        </div>

        <div className="day-tabs" style={{ marginTop: '10px' }}>
          {Object.keys(SHAKE_RECIPES).map((recKey) => {
            const recipe = SHAKE_RECIPES[recKey];
            const isSelected = activeRecipe === recKey;
            return (
              <button
                key={recKey}
                className={`day-tab ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveRecipe(isSelected ? null : recKey)}
              >
                {recipe.title.split('(')[0]}
              </button>
            );
          })}
        </div>

        {activeRecipe && (
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginTop: '12px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {SHAKE_RECIPES[activeRecipe].title}
            </h4>
            <div style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '10px' }}>
              {SHAKE_RECIPES[activeRecipe].subtitle}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Ingredients:</div>
            <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              {SHAKE_RECIPES[activeRecipe].ingredients.map((ing, idx) => (
                <li key={idx}>{ing}</li>
              ))}
            </ul>

            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Preparation Method:</div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {SHAKE_RECIPES[activeRecipe].method}
            </div>
          </div>
        )}
      </div>

      {/* HYDRATION & WATER TRACKER */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={18} color="var(--accent-blue)" /> Hydration Tracker
          </span>
          <span className="badge badge-success">{water} / 4.0 Liters</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setWaterLiters(selectedDate, Math.max(0, water - 0.5))}
          >
            - 0.5 L
          </button>
          <div style={{ flex: 1 }}>
            <div className="progress-container" style={{ height: '10px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, (water / 4) * 100)}%` }}></div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setWaterLiters(selectedDate, water + 0.5)}
          >
            + 0.5 L
          </button>
        </div>
      </div>

      {/* RECOVERY PROTOCOLS & HIERARCHY */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HeartPulse size={18} color="var(--accent-red)" /> Special Protocols & Recovery Rules
          </span>
        </div>

        <div className="day-tabs" style={{ marginTop: '10px' }}>
          <button
            className={`day-tab ${activeProtocolTab === 'RECOVERY_HIERARCHY' ? 'active' : ''}`}
            onClick={() => setActiveProtocolTab('RECOVERY_HIERARCHY')}
          >
            Recovery Hierarchy
          </button>
          <button
            className={`day-tab ${activeProtocolTab === 'MINIMUM_VIABLE_DAY' ? 'active' : ''}`}
            onClick={() => setActiveProtocolTab('MINIMUM_VIABLE_DAY')}
          >
            Minimum Viable Day
          </button>
          <button
            className={`day-tab ${activeProtocolTab === 'SYSTEM_REBOOT' ? 'active' : ''}`}
            onClick={() => setActiveProtocolTab('SYSTEM_REBOOT')}
          >
            System Reboot (48-Hr)
          </button>
          <button
            className={`day-tab ${activeProtocolTab === 'SOCIAL_SURVIVAL' ? 'active' : ''}`}
            onClick={() => setActiveProtocolTab('SOCIAL_SURVIVAL')}
          >
            Social Survival
          </button>
        </div>

        <div style={{ marginTop: '14px' }}>
          {activeProtocolTab === 'RECOVERY_HIERARCHY' && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Priority Allocation when Time/Energy is Limited:</h4>
              {PROTOCOLS.RECOVERY_HIERARCHY.map((item) => (
                <div key={item.rank} style={{ padding: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    {item.rank}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.element} — <span style={{ color: 'var(--accent-blue)' }}>{item.target}</span></div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.why}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeProtocolTab !== 'RECOVERY_HIERARCHY' && (
            <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{PROTOCOLS[activeProtocolTab].title}</h4>
              <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                {PROTOCOLS[activeProtocolTab].rules.map((r, i) => (
                  <li key={i} style={{ marginBottom: '6px' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
