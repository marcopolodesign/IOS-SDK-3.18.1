# Sleep Analysis Guide: Raw Data vs. Custom Processing

## A) What's the Rawest Data Available?

### Current Sleep Data (Pre-processed by Ring):
```javascript
sleepSegments: [
  { startTime: "00:58:00", endTime: "01:13:00", type: 2, duration: 15 }
  // type: 2=Light, 3=Deep, 4=REM, 1=Awake
]
```
✅ **This is pre-classified by the ring's firmware**

### Rawer Data Available from SDK:

1. **Scheduled Heart Rate Data** (Background measurements)
   ```javascript
   // SDK provides: getSchedualHeartRateDataWithDayIndexs
   // Returns HR measurements at regular intervals (e.g., every 5-10 minutes)
   [
     { heartRate: 62, timeMinutes: 60 },   // 01:00
     { heartRate: 58, timeMinutes: 70 },   // 01:10
     { heartRate: 54, timeMinutes: 80 },   // 01:20
     // ... throughout the night
   ]
   ```

2. **Manual Heart Rate Data** (User-initiated measurements)
   ```javascript
   // SDK provides: getManualHeartRateDataByDayIndex
   // Returns spot measurements
   ```

3. **Accelerometer Data** (Movement detection)
   - The ring has this, but SDK might not expose it directly
   - Used by firmware to detect:
     * Stillness (deep sleep)
     * Light movement (REM)
     * Significant movement (awake)

## B) How Are Sleep Segments Calculated?

### Ring's Firmware Algorithm (What it does):

The ring calculates sleep stages using:

1. **Heart Rate (HR)**
   - Lower HR → likely deeper sleep
   - Elevated HR → REM or awake

2. **Heart Rate Variability (HRV)**
   - **Deep Sleep:** High HRV, low HR (parasympathetic dominance)
   - **Light Sleep:** Moderate HRV
   - **REM Sleep:** Variable HRV, elevated HR (sympathetic activation)
   - **Awake:** Low HRV, reactive HR

3. **Movement (Accelerometer)**
   - No movement → Deep or light sleep
   - Periodic movement → REM (muscle atonia with occasional twitches)
   - Frequent movement → Awake or transitioning

### Typical Ranges (Simplified):

```
Deep Sleep:    HR 35-50 bpm,  High HRV (50-100ms), No movement
Light Sleep:   HR 45-60 bpm,  Medium HRV (30-60ms), Minimal movement
REM Sleep:     HR 55-70 bpm,  Variable HRV (20-80ms), Occasional movement
Awake:         HR 60-80+ bpm, Low HRV (<30ms), Movement present
```

**⚠️ Important:** These ranges vary GREATLY by individual:
- Athletes: Lower baseline HR
- Age, fitness, health conditions affect ranges
- Individual calibration is critical

## C) Can We Build Our Own System?

### ✅ YES - Here's How:

#### Step 1: Get Raw HR Data Overnight

We already have the SDK method:
```javascript
// Get all HR measurements for last night
const hrData = await QCBandService.getScheduledHeartRate([0]); 
// Returns array of { heartRate, timeMinutes }
```

#### Step 2: Apply Simple Heuristics

```javascript
function classifySleepStage(hr: number, previousHRs: number[]): SleepStage {
  const baseline = calculatePersonalBaseline(previousHRs);
  const hrVariability = calculateHRV(previousHRs);
  
  // Simple rule-based classification
  if (hr < baseline - 10 && hrVariability > 50) {
    return 'deep';
  } else if (hr < baseline - 5) {
    return 'light';
  } else if (hr > baseline + 5 && hrVariability < 30) {
    return 'rem';
  } else if (hr > baseline + 10) {
    return 'awake';
  }
  
  return 'light'; // default
}
```

#### Step 3: Build Custom Algorithm

```javascript
// More sophisticated approach
interface HRDataPoint {
  heartRate: number;
  timeMinutes: number;
  timestamp: number;
}

function analyzeSleep(hrData: HRDataPoint[]): CustomSleepSegment[] {
  const segments: CustomSleepSegment[] = [];
  
  // 1. Calculate personal baseline (average HR while sleeping)
  const baseline = hrData.reduce((sum, d) => sum + d.heartRate, 0) / hrData.length;
  
  // 2. Smooth the data (moving average)
  const smoothed = smoothData(hrData, windowSize: 3);
  
  // 3. Classify each segment
  for (let i = 0; i < smoothed.length; i++) {
    const current = smoothed[i];
    const previous = smoothed.slice(Math.max(0, i - 5), i); // Last 5 readings
    
    // Calculate local HRV (simplified: standard deviation of recent HRs)
    const localHRV = calculateStdDev(previous.map(p => p.heartRate));
    
    // Detect stage transitions
    const stage = classifyStage({
      hr: current.heartRate,
      baseline,
      hrv: localHRV,
      trend: calculateTrend(previous)
    });
    
    segments.push({
      startTime: current.timestamp,
      endTime: current.timestamp + (5 * 60 * 1000), // Assuming 5-min intervals
      stage,
      confidence: calculateConfidence(current, previous)
    });
  }
  
  // 4. Merge similar adjacent segments
  return mergeAdjacentSegments(segments);
}
```

### Pros & Cons of Custom System:

#### ✅ Pros:
- **Personalization:** Tune to YOUR baseline HR/HRV
- **Transparency:** Know exactly how stages are calculated
- **Experimentation:** Test different thresholds
- **Historical Analysis:** Reprocess old data with new algorithms
- **Better Insights:** Combine with other data (Strava workouts, etc.)

#### ❌ Cons:
- **Accuracy:** Ring's firmware has calibration you don't
  - Uses accelerometer data (movement)
  - Uses skin temperature (not exposed to SDK)
  - Uses blood oxygen patterns
  - Years of ML training on real sleep studies
- **Complexity:** Sleep science is nuanced
- **Validation:** Hard to know if you're right without polysomnography
- **Battery:** Getting HR every 5 min drains battery vs ring's optimized schedule

## Recommendation: **Hybrid Approach**

### Best Strategy:

1. **Use Ring's Sleep Segments** as the foundation
   - It has access to ALL sensors (movement, temp, SpO2)
   - Already calibrated and validated
   
2. **Enhance with Custom Analysis**
   ```javascript
   import { getSleep } from '@/utils/ringData';
   
   async function enhancedSleepAnalysis() {
     // Get ring's classification
     const ringSleep = await getSleep();
     
     // Get raw HR data
     const hrData = await QCBandService.getScheduledHeartRate([0]);
     
     // Calculate YOUR metrics on top
     return {
       // Ring's data
       ...ringSleep,
       
       // Your custom analysis
       personalBaseline: calculateBaseline(hrData),
       restfulnessScore: calculateRestfulness(hrData),
       hrvAverage: calculateHRV(hrData),
       lowHRPeriods: findLowHRPeriods(hrData), // Extra deep sleep indicator
       hrvRecovery: calculateRecoveryScore(hrData),
       
       // Cross-reference
       ringVsCustom: compareClassifications(ringSleep, customAnalysis(hrData))
     };
   }
   ```

3. **Add Context from Other Sources**
   ```javascript
   // Combine with workout data
   const strava = await getStravaActivities();
   const recovery = calculateRecoveryNeed(strava.recentWorkouts);
   
   // Adjust interpretation
   if (recovery.needsRest && sleep.deepMinutes < 90) {
     recommendations.push("Try earlier bedtime for more deep sleep");
   }
   ```

## Implementation Plan

### Phase 1: Get Raw HR Data ✅
Already have SDK access:
- `getScheduledHeartRate([0])` - overnight HR
- `getManualHeartRate(0)` - spot checks

### Phase 2: Visualize Raw Data
Create a chart showing:
- HR throughout the night
- Ring's sleep stage overlay
- Your HR baseline

### Phase 3: Custom Metrics
Calculate:
- Personal HR baseline
- HRV from HR data
- Restfulness score
- Sleep efficiency

### Phase 4: Compare & Validate
- Plot ring's stages vs your HR data
- Find discrepancies
- Refine your algorithm

## Code Example: Getting Raw HR Data

```javascript
// Add to src/utils/ringData/heartRate.ts

/**
 * Get overnight heart rate data for sleep analysis
 * @param dayIndex 0 = last night, 1 = night before, etc.
 */
export async function getOvernightHeartRate(dayIndex: number = 0) {
  const data = await QCBandService.getScheduledHeartRate([dayIndex]);
  
  // Filter for nighttime hours (assuming 10 PM - 8 AM)
  const nightData = data.filter(d => {
    const hour = Math.floor(d.timeMinutes / 60);
    return hour >= 22 || hour <= 8;
  });
  
  return {
    measurements: nightData,
    baseline: calculateAverage(nightData.map(d => d.heartRate)),
    min: Math.min(...nightData.map(d => d.heartRate)),
    max: Math.max(...nightData.map(d => d.heartRate)),
    hrv: calculateHRV(nightData.map(d => d.heartRate))
  };
}

function calculateHRV(heartRates: number[]): number {
  // Simple HRV: standard deviation of HR
  const mean = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
  const variance = heartRates.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / heartRates.length;
  return Math.sqrt(variance);
}
```

## Battery Impact

Getting HR every 5 minutes overnight:
- **Ring's schedule:** ~8-10 measurements/night (optimized)
- **Your schedule:** ~96 measurements/night (every 5 min for 8 hours)
- **Battery impact:** ~2-3x more drain

**Recommendation:** Use ring's scheduled measurements (already optimized) rather than forcing more frequent reads.

## Conclusion

**Answer to your questions:**

**A) Rawest data?** 
- Sleep segments = ring's processed output ✅
- Rawer data = `getScheduledHeartRate()` for overnight HR ✅
- Rawest data = accelerometer + PPG sensor (not exposed by SDK) ❌

**B) Can we make our own system?**
- **YES**, using overnight HR data ✅
- **BUT** won't be as accurate without movement/temp/SpO2 data ⚠️
- **BEST** approach: Use ring's data + add your own metrics on top 🎯

The ring's firmware has years of calibration. Use it as foundation, enhance with personalized analysis!

