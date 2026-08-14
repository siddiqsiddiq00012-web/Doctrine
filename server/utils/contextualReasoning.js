// Server helper for deterministic task reasoning ("Why Today Matters")

export function getTaskContext(taskKey, category, taskName = '', dayOfWeek = 'MONDAY', deCurrentTopic = null) {
  const nameLower = (taskName || '').toLowerCase();
  const keyLower = (taskKey || '').toLowerCase();

  // 1. Data Engineering Tasks
  if (category === 'DATA_ENG' || keyLower.includes('de') || nameLower.includes('data engineering')) {
    const topic = deCurrentTopic || 'SQL JOINs & Window Functions';
    return {
      goal: 'Data Engineering Mastery Goal',
      reason: `Part of your current ${topic} stage in the ordered Data Engineering roadmap. Completing today's session advances prerequisite topics toward pipeline competency.`,
      source: 'Data Engineering Roadmap'
    };
  }

  // 2. Workouts
  if (category === 'WORKOUT' || nameLower.includes('workout') || nameLower.includes('cardio')) {
    if (dayOfWeek === 'MONDAY' || dayOfWeek === 'FRIDAY' || nameLower.includes('workout a')) {
      return {
        goal: 'Strength & Hypertrophy Goal',
        reason: 'Stimulates primary muscle groups through progressive overload, setting an anabolic tone for muscle recovery.',
        source: 'Doctrine Physical Architecture'
      };
    } else if (dayOfWeek === 'WEDNESDAY' || nameLower.includes('workout b')) {
      return {
        goal: 'Stability & Connective Tissue Goal',
        reason: 'Reinforces stabilizer muscles, core endurance, and connective tissue integrity for long-term joint health.',
        source: 'Doctrine Physical Architecture'
      };
    } else {
      return {
        goal: 'Cardio & Active Recovery Goal',
        reason: 'Increases peripheral circulation to shuttle oxygen and essential nutrients to muscle tissues, hair follicles, and skin cells.',
        source: 'Doctrine Physical Architecture'
      };
    }
  }

  // 3. Posture / Decompression
  if (category === 'POSTURE' || nameLower.includes('dead hang') || nameLower.includes('wall angel') || nameLower.includes('cat-cow')) {
    return {
      goal: 'Spinal Health & Posture Correction Goal',
      reason: 'Decompresses intervertebral discs and corrects thoracic kyphosis to align your posture.',
      source: 'Doctrine Posture Protocol'
    };
  }

  // 4. Skincare
  if (category === 'SKINCARE' || nameLower.includes('skincare')) {
    if (nameLower.includes('morning') || nameLower.includes('cleanse') || nameLower.includes('spf') || nameLower.includes('potato')) {
      return {
        goal: 'Skin Barrier & Photoprotection Goal',
        reason: 'Protects skin from UV damage, maintains hydration, and prevents free radical oxidation throughout daylight hours.',
        source: 'Doctrine Skincare Protocol'
      };
    } else {
      return {
        goal: 'Cellular Turnover & Barrier Repair Goal',
        reason: 'Clears accumulated impurities, delivers targeted active ingredients, and locks in ceramide barrier repair overnight.',
        source: 'Doctrine Skincare Protocol'
      };
    }
  }

  // 5. Hair Care
  if (category === 'HAIR' || nameLower.includes('hair') || nameLower.includes('scalp') || nameLower.includes('dermaroll')) {
    return {
      goal: 'Hair Density & Follicle Nourishment Goal',
      reason: 'Supplies essential fatty acids and stimulates scalp micro-circulation to nourish hair follicles.',
      source: 'Doctrine Hair Protocol'
    };
  }

  // 6. Nutrition & Mass Shake
  if (category === 'NUTRITION' || nameLower.includes('mass shake') || nameLower.includes('dinner') || nameLower.includes('meal') || nameLower.includes('kanji')) {
    if (nameLower.includes('mass shake')) {
      return {
        goal: 'Caloric MED Goal (2,700 kcal)',
        reason: 'Provides critical 950–1000 kcal baseline floor to prevent catabolism of muscle, skin, and hair.',
        source: 'Doctrine MED Rule'
      };
    } else if (nameLower.includes('glow') || nameLower.includes('papaya')) {
      return {
        goal: 'Nutrient Density & Skin Brightening Goal',
        reason: 'Delivers potent carotenoids, nitrates, and vitamin C for gut-skin axis health.',
        source: 'Doctrine Nutrition Architecture'
      };
    } else if (nameLower.includes('kanji') || nameLower.includes('curd')) {
      return {
        goal: 'Gut Microflora & Probiotic Goal',
        reason: 'Enriches gut microbiome to optimize nutrient absorption and reduce systemic inflammation.',
        source: 'Doctrine Gut-Skin Axis'
      };
    } else {
      return {
        goal: 'Caloric MED & Anabolic Nutrition Goal',
        reason: 'Contributes to daily 2,700 kcal threshold and 100g protein floor to sustain cellular repair.',
        source: 'Doctrine MED Rule'
      };
    }
  }

  // 7. Sleep & Rest
  if (category === 'SLEEP' || nameLower.includes('sleep')) {
    return {
      goal: 'Growth Hormone & Deep Recovery Goal',
      reason: 'Triggers peak nocturnal growth hormone release and cellular repair window.',
      source: 'Doctrine Recovery Hierarchy'
    };
  }

  // 8. Namaz
  if (category === 'NAMAZ' || keyLower.startsWith('namaz_')) {
    return {
      goal: 'Spiritual Anchor & Mindfulness Goal',
      reason: 'Establishes daily spiritual grounding, structured pause, and mental discipline.',
      source: 'Doctrine Anchor System'
    };
  }

  // 9. Anchors
  if (category === 'ANCHOR' || keyLower.startsWith('anchor_')) {
    return {
      goal: 'Doctrine Anchor Non-Negotiable',
      reason: 'Core non-negotiable anchor required to maintain daily momentum even on minimum viable days.',
      source: 'Doctrine Anchor Rule'
    };
  }

  // 10. Preparation
  if (category === 'PREPARATION' || keyLower.startsWith('prep_')) {
    return {
      goal: 'Execution Friction Reduction Goal',
      reason: 'Pre-configures tomorrow\'s environment to eliminate decision fatigue and secure early morning momentum.',
      source: 'Doctrine Evening Prep'
    };
  }

  // 11. Fallback for unmapped tasks
  return {
    goal: 'Doctrine Execution Plan',
    reason: 'Part of today\'s scheduled Doctrine plan.',
    source: 'Doctrine Plan'
  };
}
