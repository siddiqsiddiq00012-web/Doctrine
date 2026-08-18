import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  AlertTriangle,
  Sun,
  Moon,
  Package,
  ShieldCheck,
  Droplets,
  BookOpen,
  Layers,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Clock
} from 'lucide-react';

const PRODUCT_GUIDE = [
  {
    id: 'cleanser',
    category: 'CLEANSER',
    name: 'Gentle Base Cleanser',
    purpose: 'Remove daily excess sebum, dust, and impurities without stripping natural skin barrier lipids.',
    whenToUse: 'Morning (water rinse or gentle cleanse) & Evening (double cleanse).',
    layerOrder: 'Step 1 — Base Cleansing',
    amountMethod: '1 pump on wet hands, lather gently, massage face for 30–45 seconds.',
    precautions: 'Avoid harsh sulfate cleansers or hot water which degrade skin barrier lipids.'
  },
  {
    id: 'moisturizer',
    category: 'MOISTURIZER',
    name: 'Ceramide Barrier Moisturiser',
    purpose: 'Replenish essential ceramides, fatty acids, and cholesterol to seal in hydration.',
    whenToUse: 'Morning & Evening (Non-negotiable anchor step).',
    layerOrder: 'Step 3 — Barrier Sealing (after serums/masks)',
    amountMethod: 'Pea-to-dime sized amount warmed between fingertips and pressed onto face and neck.',
    precautions: 'Apply on slightly damp skin after active serums for maximum moisture retention.'
  },
  {
    id: 'sunscreen',
    category: 'SUNSCREEN',
    name: 'SPF 50+ PA++++ Sunscreen',
    purpose: 'Broad-spectrum photoprotection against UVA/UVB photoaging and hyperpigmentation.',
    whenToUse: 'Morning daily (Mandatory daytime final step).',
    layerOrder: 'Step 4 — Final Daytime Protection Layer',
    amountMethod: 'Two full finger lengths (approx. 1/4 tsp) applied in two even layers.',
    precautions: 'Reapply if outdoors. Must be thoroughly double-cleansed off in the evening.'
  },
  {
    id: 'niacinamide',
    category: 'ACTIVE SERUM',
    name: '10% Niacinamide Serum',
    purpose: 'Regulate sebum production, refine texture, reduce redness, and fade post-blemish marks.',
    whenToUse: 'Evening routine (after cleansing, before moisturizer).',
    layerOrder: 'Step 2 — Active Treatment Layer',
    amountMethod: '2–3 drops smoothed gently over face until absorbed.',
    precautions: 'If mild tingling occurs, buffer by mixing with Ceramide Moisturiser.'
  },
  {
    id: 'salicylic',
    category: 'EXFOLIATING SERUM',
    name: '2% Salicylic Acid (BHA) Serum',
    purpose: 'Oil-soluble Beta Hydroxy Acid that penetrates pores to dissolve excess sebum and prevent blemishes.',
    whenToUse: 'Targeted evening use on pore-prone areas.',
    layerOrder: 'Step 2 — Spot or Targeted Pore Layer',
    amountMethod: '1–2 drops applied to T-zone or pore-prone areas.',
    precautions: 'Do not layer with physical coffee scrubs or other strong exfoliants on the same night.'
  }
];

const TREATMENT_GUIDE = [
  {
    id: 'potato-aloe',
    name: 'Potato & Aloe Vera Extract',
    category: 'BRIGHTENING & HYDRATION',
    summary: 'Natural topical hydration boost and gentle tone evening',
    ingredients: ['Fresh Potato juice (1-2 tbsp)', 'Pure Aloe Vera gel (1 tbsp)'],
    prepSteps: [
      'Grate fresh raw potato and squeeze through a clean cloth to extract juice.',
      'Mix 1-2 tbsp fresh potato juice with 1 tbsp aloe vera gel in a clean bowl.',
      'Whisk until a smooth, light liquid emulsion is formed.'
    ],
    applySteps: [
      'Cleanse face thoroughly with a gentle cleanser and pat dry.',
      'Apply a thin, even layer across face and neck using fingertips or soft brush.',
      'Avoid immediate eye contours and lip area.'
    ],
    leaveOn: '10–12 minutes until slightly tacky.',
    removal: 'Rinse thoroughly with cool or lukewarm water. Follow immediately with Ceramide Moisturiser.',
    frequency: '2–3 times weekly as desired.',
    precautions: 'Use fresh potato juice immediately after extraction. Perform patch test first if skin is reactive.'
  },
  {
    id: 'multani-mitti',
    name: 'Multani Mitti & Rose Water Mask',
    category: 'PORE PURIFYING & OIL CONTROL',
    summary: 'Deep clay cleansing mask for absorbing excess sebum and purifying pores',
    ingredients: ['Multani Mitti / Fuller\'s Earth (1-2 tbsp)', 'Pure Rose Water (enough for paste)'],
    prepSteps: [
      'Add 1-2 tbsp Multani Mitti powder into a non-metallic bowl.',
      'Gradually pour in rose water while stirring with a spoon.',
      'Mix into a smooth, lump-free spreadable paste.'
    ],
    applySteps: [
      'Cleanse skin and pat dry.',
      'Apply an even layer across T-zone or entire face.',
      'Keep layer uniform — avoid delicate eye and lip areas.'
    ],
    leaveOn: '15–20 minutes (do not allow to dry to painful cracking).',
    removal: 'Splash lukewarm water to re-hydrate mask first, then gently rinse off without harsh rubbing.',
    frequency: '1–2 times weekly max to prevent over-drying.',
    precautions: 'Do not use on damaged or severely compromised skin. Always follow with moisturizer.'
  },
  {
    id: 'rice-honey',
    name: 'Rice Flour, Milk & Honey Mask',
    category: 'SMOOTHING & BARRIER NOURISHMENT',
    summary: 'Gentle skin smoothing mask for texture refinement and hydration',
    ingredients: ['Fine Rice Flour (1 tbsp)', 'Whole Milk or Curd (1 tbsp)', 'Pure Honey (1/2 tsp)'],
    prepSteps: [
      'Combine 1 tbsp fine rice flour and 1/2 tsp honey in a bowl.',
      'Add milk or curd drop by drop while mixing.',
      'Blend into a thick, creamy paste.'
    ],
    applySteps: [
      'Cleanse face gently.',
      'Smooth paste evenly over face using light upward motions.',
      'Avoid immediate under-eye area.'
    ],
    leaveOn: '15 minutes.',
    removal: 'Rinse with warm water using gentle circular motions for mild physical smoothing.',
    frequency: 'Once weekly as desired.',
    precautions: 'Use finely ground rice flour only. Discontinue if redness or irritation occurs.'
  },
  {
    id: 'coffee-scrub',
    name: 'Honey & Yoghurt Coffee Scrub',
    category: 'EXFOLIATION & CIRCULATION',
    summary: 'Gentle physical exfoliant for removing surface dead skin cells',
    ingredients: ['Fine Coffee grounds (1 tbsp)', 'Raw Honey (1 tsp)', 'Plain Yoghurt / Curd (1/2 tsp)'],
    prepSteps: [
      'Mix 1 tbsp fine coffee grounds with 1 tsp honey.',
      'Add 1/2 tsp yoghurt to create a moisturizing scrub mixture.'
    ],
    applySteps: [
      'Apply to damp skin after cleansing.',
      'Massage in very light, gentle circular motions for 60–90 seconds.'
    ],
    leaveOn: '1–2 minutes maximum during gentle massage.',
    removal: 'Rinse completely with lukewarm water.',
    frequency: 'Once every 1–2 weeks max.',
    precautions: 'Do not scrub aggressively. Never use on active inflammatory acne or open blemishes.'
  },
  {
    id: 'gua-sha',
    name: 'Gua Sha Facial Massage Method',
    category: 'LYMPHATIC DRAINAGE & CONTOUR',
    summary: 'Gentle facial tool massage for tension release and fluid movement',
    ingredients: ['Light Facial Oil or Squalane (3-5 drops)', 'Clean Gua Sha tool (Quartz or Jade)'],
    prepSteps: [
      'Cleanse skin and ensure Gua Sha tool is clean and disinfected.',
      'Dispense 3-5 drops of facial oil onto palms and press onto face and neck for slip.'
    ],
    applySteps: [
      'Hold Gua Sha tool flat against skin at a 15-degree angle.',
      'Sweep gently upward along neck toward jawline.',
      'Glide from center of chin along jawline to earlobes (5 strokes per side).',
      'Sweep across cheekbones toward temples with feather-light pressure.'
    ],
    leaveOn: '5–10 minutes massage session duration.',
    removal: 'Pat excess oil gently into skin or blot lightly with a clean tissue.',
    frequency: '1–3 times weekly in the evening as desired.',
    precautions: 'Never drag tool on dry skin without oil glide. Use light pressure only to prevent capillary damage.'
  }
];

export const SkincareView = () => {
  const { setActiveTab } = useApp();

  const [skincareData, setSkincareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Accordion open/close state
  const [expandedTreatmentId, setExpandedTreatmentId] = useState('potato-aloe');
  const [expandedProductId, setExpandedProductId] = useState(null);

  const fetchSkincareData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/skincare/today', { credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Server Response Error (${res.status}): ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      setSkincareData(data);
    } catch (e) {
      console.error('[SkincareView] Load error:', e);
      setError(e.message || 'Failed to communicate with backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkincareData();
  }, [fetchSkincareData]);

  if (loading && !skincareData) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Skincare & Grooming Handbook...
        </div>
      </div>
    );
  }

  if (error && !skincareData) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px' }}>
        <div className="card" style={{ padding: '30px', textAlign: 'center', borderColor: 'var(--accent-red)' }}>
          <AlertCircle size={32} color="var(--accent-red)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Unable to load skincare handbook</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>{error}</p>
          <button className="btn btn-secondary" onClick={fetchSkincareData}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const stockWarnings = skincareData?.stockWarnings || [];

  const toggleTreatment = (id) => {
    setExpandedTreatmentId(prev => (prev === id ? null : id));
  };

  const toggleProduct = (id) => {
    setExpandedProductId(prev => (prev === id ? null : id));
  };

  return (
    <div className="skincare-view" style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* 1. HEADER & ANCHOR RULE BANNER */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--accent-purple)" /> SKIN & GROOMING HANDBOOK
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', marginTop: '4px', color: 'var(--text-primary)' }}>
            Personal Routine & Treatment Reference Guide
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Practical handbook for daily routine steps, product standards, and step-by-step treatment instructions.
          </p>
        </div>

        {/* ANCHOR RULE BANNER */}
        <div style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'var(--accent-blue-subtle, rgba(59, 130, 246, 0.08))',
          border: '1px solid var(--accent-blue)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <ShieldCheck size={20} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Anchor Rule Guidance
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Morning & Evening skincare are core non-negotiable Anchors. If time is limited in the morning, prioritise Evening skincare above all else.
            </div>
          </div>
        </div>
      </div>

      {/* OUT OF STOCK WARNINGS */}
      {stockWarnings.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} color="var(--accent-amber)" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Resource Stock Attention ({stockWarnings.length} Product{stockWarnings.length > 1 ? 's' : ''})
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {stockWarnings.map(w => `${w.name} (${w.isOutOfStock ? 'Out of stock' : 'Low stock: ' + w.currentQty + ' ' + w.unit})`).join(' • ')}
                </div>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveTab('inventory')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Package size={14} /> View Resources
            </button>
          </div>
        </div>
      )}

      {/* 2. MY ROUTINE PROTOCOL */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--accent-blue)" /> Routine Framework
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {/* Morning Routine Reference */}
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Sun size={18} color="var(--accent-amber)" />
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Morning Routine Protocol</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li><strong>Cleanse:</strong> Water rinse or gentle cleanser.</li>
              <li><strong>Natural Hydration / Treatment:</strong> Brightening mask or extract as desired.</li>
              <li><strong>Moisturise:</strong> Ceramide Moisturiser to lock barrier hydration.</li>
              <li><strong>Protect:</strong> Broad-spectrum SPF 50+ PA++++ sunscreen layer.</li>
            </ol>
          </div>

          {/* Evening Routine Reference */}
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Moon size={18} color="var(--accent-purple)" />
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Evening Routine Protocol</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <li><strong>Double Cleanse:</strong> Remove sunscreen and daytime accumulated dirt.</li>
              <li><strong>Target Active / Mask:</strong> 10% Niacinamide, BHA serum, or purifying clay.</li>
              <li><strong>Barrier Repair:</strong> Ceramide Moisturiser for overnight lipid recovery.</li>
              <li><strong>Rest:</strong> Overnight cellular recovery window.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 3. PRODUCT GUIDE */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="var(--accent-purple)" /> Product Guide & Standards
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PRODUCT_GUIDE.map(prod => {
            const isExpanded = expandedProductId === prod.id;
            return (
              <div
                key={prod.id}
                style={{
                  background: 'var(--bg-app)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                <div
                  onClick={() => toggleProduct(prod.id)}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {prod.category}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {prod.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {prod.purpose}
                    </div>
                  </div>

                  <div style={{ color: 'var(--text-secondary)', marginLeft: '12px' }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>WHEN TO USE</span>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{prod.whenToUse}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>LAYER ORDER</span>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{prod.layerOrder}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>AMOUNT & APPLICATION</span>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{prod.amountMethod}</div>
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>PRECAUTIONS</span>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{prod.precautions}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. TREATMENT GUIDE & INSTRUCTIONS (EXPANDABLE ACCORDION) */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '4px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={18} color="var(--accent-blue)" /> Treatment Guide & Preparation Instructions
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Step-by-step preparation, application, and removal guide for natural masks and facial methods.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TREATMENT_GUIDE.map(treat => {
            const isExpanded = expandedTreatmentId === treat.id;
            return (
              <div
                key={treat.id}
                style={{
                  background: 'var(--bg-app)',
                  borderRadius: '10px',
                  border: isExpanded ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                <div
                  onClick={() => toggleTreatment(treat.id)}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--accent-blue-subtle, rgba(59, 130, 246, 0.04))' : 'transparent'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {treat.category}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {treat.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {treat.summary}
                    </div>
                  </div>

                  <div style={{ color: 'var(--text-secondary)', marginLeft: '12px' }}>
                    {isExpanded ? <ChevronUp size={20} color="var(--accent-blue)" /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '13px' }}>
                    {/* WHAT YOU NEED */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        WHAT YOU NEED
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-primary)' }}>
                        {treat.ingredients.map((ing, idx) => (
                          <li key={idx} style={{ marginBottom: '2px' }}>{ing}</li>
                        ))}
                      </ul>
                    </div>

                    {/* PREPARATION */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        PREPARATION
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {treat.prepSteps.map((step, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {/* HOW TO APPLY */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        HOW TO APPLY
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {treat.applySteps.map((step, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {/* DURATION, REMOVAL & FREQUENCY GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: 'var(--bg-card, rgba(0,0,0,0.02))', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>LEAVE ON</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{treat.leaveOn}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>HOW TO REMOVE</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{treat.removal}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>RECOMMENDED FREQUENCY</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-purple)', marginTop: '2px' }}>{treat.frequency}</div>
                      </div>
                    </div>

                    {/* PRECAUTIONS */}
                    <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--accent-amber)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <Info size={16} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-amber)' }}>PRECAUTIONS: </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{treat.precautions}</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. SKINCARE PRINCIPLES & GUIDELINES */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-purple)" /> Skincare Principles & Guidelines
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-blue)', marginBottom: '2px' }}>01</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Cleanse Gently</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
              Avoid repeatedly stripping the skin with harsh cleansers. Protect natural surface lipids.
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-amber)', marginBottom: '2px' }}>02</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Protect Daily</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
              Sunscreen is the mandatory foundation of daytime protection against UV damage.
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-purple)', marginBottom: '2px' }}>03</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Barrier First</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
              Prioritise ceramide barrier repair before applying strong exfoliating acids or active serums.
            </div>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-green)', marginBottom: '2px' }}>04</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Consistency Wins</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
              A simple routine followed consistently beats a complicated routine used occasionally.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
