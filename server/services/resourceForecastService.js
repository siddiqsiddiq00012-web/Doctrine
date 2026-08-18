import { resourceStock, resourceEvents } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { cryptoNative } from '../utils/crypto.js';
import { INITIAL_INVENTORY } from '../../src/data/doctrineData.js';

// Explicit Doctrine / Resource usage rates (in unit per day) when consumption history is sparse
export const DOCTRINE_USAGE_RATES = {
  'inv-1': { rate: 3.0, unit: 'pcs/day', source: 'Doctrine (3 eggs/day average)' },
  'inv-2': { rate: 0.5, unit: 'liters/day', source: 'Doctrine (500 ml milk/day average)' },
  'inv-3': { rate: 0.04, unit: 'kg/day', source: 'Doctrine (40 g oats/day)' },
  'inv-4': { rate: 0.15, unit: 'kg/day', source: 'Doctrine (150 g curd/day)' },
  'inv-5': { rate: 2.0, unit: 'pcs/day', source: 'Doctrine (2 bananas/day)' },
  'inv-6': { rate: 20.0, unit: 'g/day', source: 'Doctrine (20 g peanut butter/day)' },
  'inv-7': { rate: 40.0, unit: 'g/day', source: 'Doctrine (40 g peanuts/day)' },
  'inv-8': { rate: 15.0, unit: 'g/day', source: 'Doctrine (15 g honey/day)' },
  'inv-9': { rate: 20.0, unit: 'g/day', source: 'Doctrine (20 g ghee/day)' },
  'inv-10': { rate: 5.0, unit: 'g/day', source: 'Doctrine (1 tsp flaxseed post-workout)' },
  'inv-11': { rate: 4.3, unit: 'g/day', source: 'Doctrine (bi-weekly fenugreek treatment)' },
  'inv-12': { rate: 0.107, unit: 'kg/day', source: 'Doctrine (Mon/Thu/Sat Glow Shake)' },
  'inv-13': { rate: 0.028, unit: 'pcs/day', source: 'Doctrine (Tuesday Papaya Shake)' },
  'inv-14': { rate: 1.0, unit: 'capsules/day', source: 'Doctrine (1 Biotin/day)' },
  'inv-15': { rate: 2.0, unit: 'tablets/day', source: 'Doctrine (1,000 mg MSM/day)' },
  'inv-16': { rate: 1.0, unit: 'softgels/day', source: 'Doctrine (1 Vit D3+K2/day)' },
  'inv-17': { rate: 1.0, unit: 'capsules/day', source: 'Doctrine (1 Vit E/day)' },
  'inv-18': { rate: 5.0, unit: 'g/day', source: 'Doctrine (1 tsp Amla/day)' },
  'inv-19': { rate: 0.033, unit: 'bottle/day', source: 'Doctrine (AM/PM daily cleanse)' },
  'inv-20': { rate: 0.033, unit: 'tubes/day', source: 'Doctrine (AM double SPF 50+)' },
  'inv-21': { rate: 0.033, unit: 'jar/day', source: 'Doctrine (AM/PM ceramide moisturiser)' },
  'inv-22': { rate: 0.02, unit: 'bottle/day', source: 'Doctrine (Mon/Wed/Fri AM Salicylic Acid)' },
  'inv-23': { rate: 0.02, unit: 'bottle/day', source: 'Doctrine (Tue/Thu/Sat/Sun PM Niacinamide)' },
  'inv-24': { rate: 10.0, unit: 'g/day', source: 'Doctrine (Tue/Sun Multani Mitti mask)' },
  'inv-25': { rate: 5.0, unit: 'ml/day', source: 'Doctrine (Tue/Sun Rose Water mask)' },
  'inv-26': { rate: 0.02, unit: 'bottle/day', source: 'Doctrine (Tue/Sat mild shampoo wash)' },
  'inv-27': { rate: 5.0, unit: 'ml/day', source: 'Doctrine (Mon/Thu/Sat Hair Oil application)' },
  'inv-28': { rate: 0.3, unit: 'leaves/day', source: 'Doctrine (Wed/Sat/Sun Aloe Vera mask)' },
  'inv-29': { rate: 0, unit: 'pc/day', source: 'Durable tool (zero depletion rate)' }
};

/**
 * DETERMINISTIC RESOURCE FORECAST SERVICE
 * Computes authoritative inventory state, depletion dates, 7-day projected deficits,
 * usage rates, and recommended purchase quantities for a user.
 */
export async function calculateResourceForecasts(db, userId) {
  if (!userId) {
    throw new Error('[ResourceForecastService Error] userId is required');
  }

  // Fetch existing stock records for user
  const dbStocks = await db
    .select()
    .from(resourceStock)
    .where(eq(resourceStock.userId, userId));

  const stockMap = new Map(dbStocks.map((s) => [s.resourceId, s]));

  // Ensure every Doctrine item has a stock record in DB
  const missingValues = [];
  const nowIso = new Date().toISOString();

  INITIAL_INVENTORY.forEach((item) => {
    if (!stockMap.has(item.id)) {
      const newId = cryptoNative.randomUUID();
      missingValues.push({
        id: newId,
        userId,
        resourceId: item.id,
        currentQty: item.currentQty,
        inCart: false,
        lastPurchased: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      stockMap.set(item.id, {
        id: newId,
        userId,
        resourceId: item.id,
        currentQty: item.currentQty,
        inCart: false,
        lastPurchased: null,
      });
    }
  });

  if (missingValues.length > 0) {
    await db.insert(resourceStock).values(missingValues);
  }

  // Fetch past event logs for user
  const events = await db
    .select()
    .from(resourceEvents)
    .where(eq(resourceEvents.userId, userId))
    .orderBy(desc(resourceEvents.createdAt));

  let fullyStockedCount = 0;
  let needsPurchaseCount = 0;
  let totalEstimatedCost = 0;

  const resources = INITIAL_INVENTORY.map((item) => {
    const stockRec = stockMap.get(item.id);
    const currentQty = stockRec ? stockRec.currentQty : item.currentQty;
    const inCart = stockRec ? Boolean(stockRec.inCart) : false;
    const required = item.purchaseQty || (item.minStockLevel ? item.minStockLevel * 2 : 1);

    const needed = Math.max(0, required - currentQty);
    const surplus = Math.max(0, currentQty - required);
    const progressPct = required > 0 ? Math.min(100, Math.round((currentQty / required) * 100)) : 100;

    let status = 'STOCKED';
    if (currentQty <= 0) {
      status = 'NOT STARTED';
      needsPurchaseCount++;
    } else if (currentQty <= item.minStockLevel || needed > 0) {
      status = 'NEEDS PURCHASE';
      needsPurchaseCount++;
    } else if (currentQty > required) {
      status = 'SURPLUS';
      fullyStockedCount++;
    } else if (currentQty === required) {
      status = 'FULLY STOCKED';
      fullyStockedCount++;
    } else {
      status = 'PARTIALLY STOCKED';
    }

    if (item.estimatedPrice && needed > 0) {
      totalEstimatedCost += item.estimatedPrice;
    }

    // FORECAST COMPUTATION FOR RESOURCE ITEM
    const consumptionEvents = events.filter(e => e.resourceId === item.id && e.eventType === 'CONSUMPTION');
    let dailyUsageRate = 0;
    let confidence = 'LOW';
    let usageSource = 'Insufficient usage data';

    if (consumptionEvents.length >= 2) {
      const totalAmount = consumptionEvents.reduce((sum, e) => sum + (e.amount || 0), 0);
      const dates = consumptionEvents.map(e => e.date).sort();
      const dFirst = new Date(dates[0]);
      const dLast = new Date(dates[dates.length - 1]);
      const daysDiff = Math.max(1, Math.round((dLast - dFirst) / (1000 * 60 * 60 * 24)) + 1);
      dailyUsageRate = totalAmount / daysDiff;
      confidence = 'HIGH';
      usageSource = `Actual consumption history (${consumptionEvents.length} events over ${daysDiff} days)`;
    } else {
      const fallback = DOCTRINE_USAGE_RATES[item.id];
      if (fallback && fallback.rate > 0) {
        dailyUsageRate = fallback.rate;
        confidence = 'MEDIUM';
        usageSource = fallback.source;
      } else if (fallback && fallback.rate === 0) {
        dailyUsageRate = 0;
        confidence = 'HIGH';
        usageSource = fallback.source;
      } else {
        dailyUsageRate = 0;
        confidence = 'LOW';
        usageSource = 'Insufficient usage data';
      }
    }

    dailyUsageRate = Math.round(dailyUsageRate * 1000) / 1000;
    const expectedWeeklyUsage = Math.round(dailyUsageRate * 7 * 100) / 100;

    let daysToDepletion = Infinity;
    let depletionDate = null;

    if (dailyUsageRate > 0) {
      daysToDepletion = Math.max(0, currentQty / dailyUsageRate);
      const now = new Date();
      const depDate = new Date(now.getTime() + daysToDepletion * 24 * 60 * 60 * 1000);
      const y = depDate.getFullYear();
      const m = String(depDate.getMonth() + 1).padStart(2, '0');
      const d = String(depDate.getDate()).padStart(2, '0');
      depletionDate = `${y}-${m}-${d}`;
    }

    const projected7DayUsage = expectedWeeklyUsage;
    const projected7DayRemaining = Math.max(0, Math.round((currentQty - projected7DayUsage) * 100) / 100);
    const projectedDeficit = Math.max(0, Math.round((projected7DayUsage - currentQty) * 100) / 100);

    let recommendedPurchaseQty = 0;
    if (projectedDeficit > 0 || currentQty <= item.minStockLevel) {
      const neededQty = Math.max(projectedDeficit, Math.max(0, (item.purchaseQty || item.minStockLevel * 2) - currentQty));
      recommendedPurchaseQty = Math.max(item.purchaseQty || 1, Math.ceil(neededQty));
    }

    let forecastState = 'SUFFICIENT';
    if (dailyUsageRate === 0 && item.id !== 'inv-29') {
      forecastState = 'INSUFFICIENT DATA';
    } else if (currentQty <= 0) {
      forecastState = 'PROJECTED DEPLETION';
    } else if (daysToDepletion <= 7) {
      forecastState = 'PROJECTED DEPLETION';
    } else if (recommendedPurchaseQty > 0 || currentQty <= item.minStockLevel) {
      forecastState = 'PURCHASE RECOMMENDED';
    } else if (currentQty <= item.minStockLevel * 1.5) {
      forecastState = 'LOW STOCK';
    } else if (currentQty >= required * 1.5 || daysToDepletion >= 30) {
      forecastState = 'SURPLUS';
    }

    const forecast = {
      dailyUsageRate,
      expectedWeeklyUsage,
      daysToDepletion: daysToDepletion === Infinity ? null : Math.round(daysToDepletion * 10) / 10,
      depletionDate,
      projected7DayUsage,
      projected7DayRemaining,
      projectedDeficit,
      recommendedPurchaseQty,
      forecastState,
      confidence,
      usageSource,
    };

    return {
      ...item,
      currentQty,
      inCart,
      required,
      needed,
      surplus,
      progressPct,
      status,
      lastPurchased: stockRec ? stockRec.lastPurchased : null,
      forecast,
    };
  });

  return {
    resources,
    summary: {
      totalItems: INITIAL_INVENTORY.length,
      fullyStockedCount,
      needsPurchaseCount,
      totalEstimatedCost,
    },
  };
}
