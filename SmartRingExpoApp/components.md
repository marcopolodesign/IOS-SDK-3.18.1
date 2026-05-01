# Component Reference

> **IMPORTANT:** Keep this file up to date. Whenever a component is **created, modified, or deleted**, update the relevant entry here. This is the single source of truth for component behavior — so future sessions don't need to re-explore the code.

---

## Naming Convention — Cover ↔ Detail

Every metric has two UI surfaces:

| Term | Definition | Example |
|------|-----------|---------|
| **Cover** | The card on the Overview tab that summarises a metric and navigates to the detail page | `CaffeineWindowCard` |
| **Detail** | The full-screen page the cover navigates to (`app/detail/`) | `app/detail/adenosine-detail.tsx` |

Use these terms consistently in code, comments, and conversation. The cover is always the `src/components/home/` card; the detail is always the `app/detail/` screen.

**Known cover → detail pairs:**

| Cover | Detail route |
|-------|-------------|
| `CaffeineWindowCard` | `/detail/adenosine-detail` |
| `DailyHeartRateCard` | `/detail/hr-detail` |
| `SleepHypnogram` / sleep cards | `/detail/sleep-detail` |
| `SpO2Card` (when present) | `/detail/spo2-detail` |

---

## Root Components (`src/components/`)

### `BatteryIndicator`
**File:** `src/components/BatteryIndicator.tsx`
**Props:** `level: number`, `isCharging?: boolean`, `size?: 'small'|'medium'|'large'`, `showPercentage?: boolean`
**Renders:** SVG battery icon with percentage fill. Color scales green → yellow → red by level. Charging bolt overlaid when `isCharging`. Optional percentage text.
**Data:** All from props, no hooks.

---

### `ConnectionStatus`
**File:** `src/components/ConnectionStatus.tsx`
**Props:** `state: ConnectionState`, `deviceName?: string`, `compact?: boolean`
**Renders:** Dot indicator + text label (green=connected, yellow=connecting, red=disconnected). Animated spinner when connecting/reconnecting.
**Data:** All from props, no hooks.

---

### `DeviceCard`
**File:** `src/components/DeviceCard.tsx`
**Props:** `device: DeviceInfo`, `isConnecting?: boolean`, `isConnected?: boolean`, `onPress: () => void`
**Renders:** Card with ring SVG icon, device name/MAC, version chip, RSSI signal bars + dBm, connect/connected badge or loading spinner.
**Logic:** RSSI → signal strength color mapping.

---

### `HeartRateChart`
**File:** `src/components/HeartRateChart.tsx`
**Props:** `data: number[]`, `width?: number`, `height?: number`, `color?: string`, `showLabels?: boolean`, `animated?: boolean`
**Renders:** SVG line chart with gradient area fill, Y-axis + X-axis labels, data point circles. Filters zero values. Handles empty data gracefully.
**Logic:** Dynamic Y-scale from data range.

---

### `MetricCard`
**File:** `src/components/MetricCard.tsx`
**Props:** `title: string`, `value: string|number`, `unit?: string`, `icon?: ReactNode`, `color?: string`, `subtitle?: string`, `onPress?: () => void`, `size?: 'small'|'medium'|'large'`, `style?: ViewStyle`, `animated?: boolean`
**Renders:** Card with icon badge (left), uppercase title, large value + unit, optional subtitle, background glow. Size variants for responsive layout.

---

### `RingIndicator`
**File:** `src/components/RingIndicator.tsx`
**Props:** `value: number`, `maxValue: number`, `size?: number`, `strokeWidth?: number`, `color?: string`, `gradientColors?: [string, string]`, `label?: string`, `unit?: string`, `showPercentage?: boolean`
**Renders:** Circular SVG progress ring with centered value/unit/label. strokeDasharray-based progress. Optional gradient stroke.

---

## UI Components (`src/components/ui/`)

### `AppText`
**File:** `src/components/ui/AppText.tsx`
**Props:** `weight?: 'regular'|'demiBold'`, `children: ReactNode`, plus all RN `TextProps`
**Renders:** `<Text>` with TT-Interphases Pro font family. Simple font-family wrapper — use everywhere instead of raw `<Text>`.

---

## Common Components (`src/components/common/`)

### `FocusLogo`
**File:** `src/components/common/FocusLogo.tsx`
**Props:** `width?: number`, `height?: number`, `color?: string`
**Renders:** Scalable SVG "FOCUS" wordmark with path-based letters.

---

### `GradientInfoCard`
**File:** `src/components/common/GradientInfoCard.tsx`
**Props:** `icon: ReactNode`, `title: string`, `headerValue?: string|number`, `headerSubtitle?: string`, `showArrow?: boolean`, `backgroundImage?: ImageSourcePropType`, `gradientStops?: [{offset, color, opacity}]`, `gradientCenter?: {x,y}`, `gradientRadii?: {rx,ry}`, `style?: ViewStyle`, `onHeaderPress?: () => void`, `headerRight?: ReactNode`, `children: ReactNode`
**Renders:** Radial gradient (or image) header with icon, title, optional arrow link, value/subtitle block. Dark `#222` content area below for flexible body children.
**Usage:** Base card for ReadinessCard, IllnessWatchCard, LastRunContextCard, LiveHeartRateCard. Always prefer extending this rather than creating a new card shell.

---

### `InfoButton`
**File:** `src/components/common/InfoButton.tsx`
**Props:** `metricKey: MetricKey`, `size?: number`, `color?: string`
**Renders:** Small circular "i" SVG button. Tapping opens a bottom-sheet explainer via `useMetricExplainer()` context.
**Data:** `MetricExplainerContext` (global).

---

## Detail Components (`src/components/detail/`)

### `BackArrow`
**File:** `src/components/detail/BackArrow.tsx`
**Props:** None
**Renders:** Simple SVG left-pointing chevron. Used in detail page headers.

---

### `DayNavigator`
**File:** `src/components/detail/DayNavigator.tsx`
**Props:** `days: string[]`, `selectedIndex: number`, `onSelectDay: (index: number) => void`
**Renders:** Horizontal scrollable pill selector. Auto-scrolls selected pill to center via `useEffect` + ref.

---

### `DetailChartContainer`
**File:** `src/components/detail/DetailChartContainer.tsx`
**Props:** `children: ReactNode`, `timeLabels?: string[]`, `height?: number`, `yMin?: string`, `yMax?: string`
**Renders:** Wrapper with fixed-height chart area, optional Y-axis min/max labels, X-axis time label row at bottom.

---

### `DetailPageHeader`
**File:** `src/components/detail/DetailPageHeader.tsx`
**Props:** `title: string`, `rightElement?: ReactNode`, `marginBottom?: number`, `useSafeArea?: boolean`
**Renders:** Back button (calls `router.back()`), centered title, optional right element. Handles safe area inset conditionally.

---

### `DetailStatRow`
**File:** `src/components/detail/DetailStatRow.tsx`
**Props:** `title: string`, `value: string`, `unit?: string`, `icon?: ReactNode`, `accent?: string`, `expandable?: boolean`, `expandedContent?: ReactNode`, `badge?: {label, color}`
**Renders:** Row with optional left accent bar, icon, title/value/unit/badge. If `expandable`, shows chevron toggle + animated expanded content below.
**Logic:** `LayoutAnimation` on toggle, local `expanded` state.

---

### `MetricsGrid`
**File:** `src/components/detail/MetricsGrid.tsx`
**Props:** `metrics: [MetricCell, MetricCell, MetricCell, MetricCell]`, `style?: ViewStyle`; each cell: `{label, value, unit?, accent?, onPress?}`
**Renders:** 2×2 grid of metric cells with dividers. Optional per-cell press handlers.

---

### `TrendBarChart`
**File:** `src/components/detail/TrendBarChart.tsx`
**Props:** `dayEntries: [{label, dateKey}]`, `values: [{dateKey, value}]`, `selectedIndex: number`, `onSelectDay: (index) => void`, `colorFn: (value) => string`, `maxValue: number`, `showValueLabels?: boolean`, `colWidth?: number`, `barWidth?: number`, `chartHeight?: number`, `padV?: number`, `guideLines?: number[]`, `roundedBars?: boolean`, `unselectedOpacity?: number`
**Renders:** Horizontal scrollable SVG bar chart. Bars colored/faded by selection, rolling average trendline overlay, optional guide lines, date labels above bars. Snap-to-column scrolling.
**Logic:** Scroll-based column selection with haptic feedback, snap offsets via `useMemo`.

---

## Explainer Components (`src/components/explainer/`)

### `ExplainerSheet`
**File:** `src/components/explainer/ExplainerSheet.tsx`
**Props:** None (context-driven)
**Renders:** `@gorhom/bottom-sheet` BottomSheetModal with BlurView backdrop. Content driven by `MetricExplainerContext`.

---

### `ExplainerSheetContent`
**File:** `src/components/explainer/ExplainerSheetContent.tsx`
**Props:** `metricKey: MetricKey`, `onClose: () => void`
**Renders:** Scrollable content: accent stripe, title/subtitle, optional chart (dispatched by metric type), body text, optional range bullets, "Got it" button.
**Data:** `getMetricExplanations(t)[metricKey]` for content + chart config.

**Explainer charts:**
- `RangeBarChart.tsx` — Range visualization bars
- `ScoreArcChart.tsx` — Arc gauge for zones
- `SleepStagesBar.tsx` — Sleep stage distribution bar
- `WaveformHint.tsx` — Animated waveform hint

---

## Focus Tab Components (`src/components/focus/`)

### `AskCoachButton`
**File:** `src/components/focus/AskCoachButton.tsx`
**Props:** None
**Renders:** Floating white pill with text input field + send icon. Typewriter-animated placeholder.
**Logic:** `useTypewriter()` hook for placeholder animation. On submit navigates to chat route with query param.

---

### `BaselineJourneyCard`
**File:** `src/components/focus/BaselineJourneyCard.tsx`
**Props:** `daysLogged: number`, `baselines: FocusBaselines | null`, `readiness: ReadinessScore | null`
**Renders:** 3-zone recovery bar (Rest/Easy/Go) with animated score marker dot. Tips block with actionable advice below.
**Logic:** Zone detection from readiness score. Tip generation differs during calibration vs. post-baseline. Component ranking for weak signals.

---

### `FocusScoreRing`
**File:** `src/components/focus/FocusScoreRing.tsx`
**Props:** `score: number | null`, `recommendation: ReadinessRecommendation | null`, `isLoading: boolean`
**Renders:** SVG circular progress ring with centered score + recommendation pill (GO/EASY/REST).
**Logic:** Color: ≥70→green, ≥45→yellow, <45→red.

---

### `IllnessWatchCard`
**File:** `src/components/focus/IllnessWatchCard.tsx`
**Props:** `illness: IllnessWatch | null`, `isLoading: boolean`
**Renders:** `GradientInfoCard` with shield icon, status dot/text, expandable signal rows (HR/HRV/SpO2/Temp/Sleep) with severity pills, summary + detail link. Top edge "collar" gradient is tinted with the status color (`statusColor(status)` — green/amber/red for CLEAR/WATCH/SICK) instead of white, so the card's chrome reflects illness state at a glance. Mounted both on the Coach tab (`FocusScreen`) and inside the Today overview (`OverviewTab`, between Sleep Score and Daily Heart Rate).
**Logic:** Severity calculated from delta strings (e.g. "±3 bpm"), per-signal severity mapping, collapsible sections.

---

### `LastRunContextCard`
**File:** `src/components/focus/LastRunContextCard.tsx`
**Props:** `lastRun: LastRunContext | null`, `isLoading: boolean`, `hasStrava: boolean`
**Renders:** `GradientInfoCard` with run icon, distance + date header, run name + pace, effort verdict badge, explanation quote, HR comparison, expandable body state (sleep/HRV), Strava link.
**Logic:** Date formatting (today/yesterday/X days ago), pace (min:sec/km), effort color coding.

---

### `ReadinessCard`
**File:** `src/components/focus/ReadinessCard.tsx`
**Props:** `readiness: ReadinessScore | null`, `baselines: FocusBaselines | null`, `isLoading: boolean`
**Renders:** `GradientInfoCard` with heart icon, readiness score + recommendation subtitle. Expandable metric bars (HRV/Sleep/RHR/Training). Confidence note. Calibration mode (< 3 days): shows progress dots instead of bars.
**Logic:** Component score bar visualization, expand/collapse local state.

---

## Home Tab Components (`src/components/home/`)

### `HomeHeader`
**File:** `src/components/home/HomeHeader.tsx`
**Props:** `userName?: string`, `streakDays?: number`, `ringBattery?: number`, `isCharging?: boolean`, `avatarUrl?: string`, `onAvatarPress?: () => void`, `deviceType?: 'ring'|'band'`, `isConnected?: boolean`, `isReconnecting?: boolean`, `onReconnect?: () => void`, `isSyncing?: boolean`, `onRefresh?: () => void`, `onBatteryPress?: () => void`
**Renders:** Left: avatar circle + formatted date. Right: streak chip (fire + days) OR reconnect button (when disconnected), battery circular ring (device icon or charging bolt) + refresh spinner.
**Logic:** Conditional reconnect vs. battery/refresh rendering. Battery color from level. Date formatting. Refresh spin animation.
**Data:** No hooks — all state from props.

---

### `SyncStatusSheet`
**File:** `src/components/home/SyncStatusSheet.tsx`
**Props:** `syncProgress: SyncProgressState`, `isSyncing: boolean`, `onFindRings?: () => void`
**Renders:** Modal with BlurView backdrop, animated circular SVG progress ring, percentage inside ring, morphing status message with crossfade/slide-up animation, metric count sub-line during sync, "Find Rings" button on timeout.
**Logic:** Reanimated orchestration (ring progress, message morph, button fade). 40s connection timeout. Auto-dismiss 1s after complete.
**Data:** `SyncProgressState` (phase, metrics) from props, local timeout state.

---

### `LiveHeartRateCard`
**File:** `src/components/home/LiveHeartRateCard.tsx`
**Props:** `headerRight?: ReactNode`
**Renders:** `GradientInfoCard` (red gradient). 4 states:
  1. **Idle** — last measurement or "Ready" button
  2. **Measuring** — countdown ring + live HR + stop button
  3. **Done** — large HR + label + reset/remeasure buttons
  4. **Error** — error text + try again button
**Logic:** NativeEventEmitter listeners for Jstyle realtime data + measurement results. 30s countdown timer. Auto-retry after 6s with no sample. Connection check before start.
**Data:** `useHomeDataContext()` for connection state, `AsyncStorage` for last reading, local state (measuring/countdown/currentHR).

---

### `SleepHypnogram`
**File:** `src/components/home/SleepHypnogram.tsx`
**Renders:** Continuous step chart with a single figure-wide vertical `LinearGradient` (`gradientUnits="userSpaceOnUse"`). Segments = `<Rect>` blocks + 0.75px-wide connector bars. Tooltip/stats row swap on drag.

**Gradient palette (top → bottom):**
- Awake: `#FFFFFF`
- REM: `#F5DEDE`
- Core: `#CC3535`
- Deep: `#8C0B0B`

> **INVARIANT:** `styles.summaryRow.height` and `styles.tooltipReplacement.height` must always be equal (currently both `50`). They occupy the same slot — tooltip swaps in-place on drag. Do NOT change one without changing the other.

---

### `DailyHeartRateCard`
**File:** `src/components/home/DailyHeartRateCard.tsx`
**Renders:** HR line chart for the current day with drag selection via `PanResponder`. Shows current selected HR value on drag.

---

### `DailySleepTrendCard`
**File:** `src/components/home/DailySleepTrendCard.tsx`
**Renders:** Sleep quality trend chart with day navigation (uses `DayNavigator`).

---

### `DailyTimelineCard`
**File:** `src/components/home/DailyTimelineCard.tsx`
**Renders:** Cronología timeline — activity and Strava events displayed as chips in a horizontal/vertical timeline.

---

### `SemiCircularGauge`
**File:** `src/components/home/SemiCircularGauge.tsx`
**Renders:** Semi-circular SVG gauge for displaying a 0–100 score as a partial arc with animated fill and numeric counter.

**Props:**
- `score: number` — 0–100 value; drives arc fill + counting animation (1500ms, `Easing.out(cubic)`)
- `label?: string` — uppercase text above the number (default `'FOCUS SCORE'`)
- `animated?: boolean` — whether to animate score changes (default `true`)
- `phaseKey?: string` — when this string changes, a 250ms Reanimated crossfade hides the label + score swap so metric switches are not jarring
- `size?: number`, `strokeWidth?: number`, `backgroundStrokeWidth?: number` — layout overrides

**Behaviour:** Arc fill uses RN `Animated` (dashoffset interpolation). Text crossfade uses Reanimated `useSharedValue`. Both run simultaneously on phase change — the arc animates from the old to new score while the text briefly fades out, then fades back in with the new label and score.

**Data source:** Driven by `useOverviewGaugePhase()` on the Overview tab. The hook resolves which metric to show based on context (sleep phase, caffeine state, strain, readiness, wind-down window).

---

### `WindDownHero`
**File:** `src/components/home/WindDownHero.tsx`
**Renders:** Alternative hero for the Overview tab's wind-down phase — replaces the `SemiCircularGauge` entirely when `gauge.key === 'wind_down'`. Shows moon icon, target bedtime in large text, a countdown ("in 33 min" / "33 min past target"), and a sleep-debt pill if debt ≥ 30 min.

**Props:**
- `targetBedtimeMs: number` — epoch ms of tonight's target bedtime (from `gauge.meta.targetBedtimeMs`)
- `minsUntilBed: number` — minutes until target (negative = past target), drives countdown text and orange late-state styling
- `sleepDebtTotalMin: number` — total sleep debt in minutes; pill is hidden below 30 min

---

### `HeroLinearGauge`
**File:** `src/components/home/HeroLinearGauge.tsx`
**Renders:** Linear progress bar gauge for hero metrics.

---

### `SleepDebtCard` / `SleepDebtGauge`
**Files:** `src/components/home/SleepDebtCard.tsx`, `src/components/home/SleepDebtGauge.tsx`
**Renders:** Sleep debt display. `SleepDebtCard` is the card shell; `SleepDebtGauge` is the inner gauge visualization.

---

### `NapCard`
**File:** `src/components/home/NapCard.tsx`
**Renders:** Nap duration display card.

---

### `TrainingInsightsCard`
**File:** `src/components/home/TrainingInsightsCard.tsx`
**Renders:** Training-specific insight card (load, recovery, HRV trend in training context).

---

### `BaselineProgressCard`
**File:** `src/components/home/BaselineProgressCard.tsx`
**Renders:** Progress tracker shown during the baseline data collection period (first N days of use). Tapping "View Baseline" navigates to `app/detail/baseline-detail.tsx`.

---

### `BaselineDetailScreen`
**File:** `app/detail/baseline-detail.tsx`
**Route:** `/detail/baseline-detail`
**Renders:** Full-screen baseline progress detail page. Uses the same design system and chrome as `IllnessDetailScreen`: dark background with a deep-blue radial gradient, nav row (BackArrow + BUILDING/READY chip), 80px hero showing overall % complete, 3 recommendation tip lines, then 6 chrome-less signal cards (Sleep, HR, HRV, Temperature, SpO₂, Activity) each with a 36px current value, progress chip (X/N or READY), line chart with 7-day-avg dotted reference, and a calibration warning when not yet ready. Ends with an interactive 7-day "Baseline Progress" trend bar section and a bottom-sheet info modal per metric.
**Data sources:** `useBaselineMode()`, `useHomeDataContext()`, `useMetricHistory<>()` (all 6 metric types).

---

### `BaselineCompleteOverlay`
**File:** `src/components/home/BaselineCompleteOverlay.tsx`
**Renders:** Full-screen or modal overlay shown when baseline collection finishes for the first time.

---

### `FirmwareUpdateSheet`
**File:** `src/components/home/FirmwareUpdateSheet.tsx`
**Renders:** `@gorhom/bottom-sheet` bottom sheet with firmware update UI (version info, progress, confirm/cancel).

---

### `TroubleshootSheet`
**File:** `src/components/home/TroubleshootSheet.tsx`
**Renders:** `@gorhom/bottom-sheet` bottom sheet with step-by-step Bluetooth troubleshooting guide.

---

### `DeviceSheet`
**File:** `src/components/home/DeviceSheet.tsx`
**Renders:** `@gorhom/bottom-sheet` bottom sheet with device info (name, firmware, battery, MAC) and disconnect option.

---

### `MetricInsightCard` / `InsightCard`
**Files:** `src/components/home/MetricInsightCard.tsx`, `src/components/home/InsightCard.tsx`
**Renders:** Insight cards with rich text formatting, metric highlights, and contextual explanations.

---

### `StatsRow`
**File:** `src/components/home/StatsRow.tsx`
**Renders:** Horizontal row of stat chips/badges (e.g. steps/calories/distance summary).

---

### `SleepStagesChart`
**File:** `src/components/home/SleepStagesChart.tsx`
**Renders:** Sleep stage distribution visualization (bar or pie style).

---

### `SleepBaselineTierCard`
**File:** `src/components/home/SleepBaselineTierCard.tsx`
**Renders:** Sleep quality tier card shown during baseline collection (before full baselines are available).

---

### `SleepHypnogramContinuous`
**File:** `src/components/home/SleepHypnogramContinuous.tsx`
**Renders:** Variant of `SleepHypnogram` with no gaps between night segments.

---

### `AnimatedGradientBackground`
**File:** `src/components/home/AnimatedGradientBackground.tsx`
**Renders:** Parallax/animated gradient background used behind home screen content.

---

### `GlassCard`
**File:** `src/components/home/GlassCard.tsx`
**Renders:** Glass-morphism card template (`rgba(255,255,255,0.07)` bg, `rgba(255,255,255,0.12)` border, `borderRadius.xl`). Use as a base shell for new cards when `GradientInfoCard` is too specific.

---

### `CaffeineWindowCard` ← **Adenosine Cover**
**File:** `src/components/home/CaffeineWindowCard.tsx`
**Detail page:** `app/detail/adenosine-detail.tsx` (route `/detail/adenosine-detail`)
**Props:** `wakeHour?: number`, `bedHour?: number` (both passed from `OverviewTab` via `lastNightSleep`)
**Renders:** Green-gradient card. SVG pharmacokinetic curve (real doses only — no phantom baseline). Three coloured phase-zone blocks (pre=orange, open=teal, closed=red). Sleep-limit dashed line at 100 mg. Phase indicator bar (3 segments). Footer text.
**Logic:**
- `recommendedWindow(wakeHour, bedHour)` — Huberman protocol: 2h post-wake delay, 8h before-bed cutoff.
- `clearHour = clearanceHour(doses)` — actual logged drinks only; null when nothing logged (falls back to `window.end`).
- `activePhase` is time-based: `now < window.start → pre`, `≤ openEnd → open`, else `closed`.
- Y-scale always ≥ 400 mg (`MIN_Y_SCALE = MAX_CAFFEINE_MG`); curve hidden when no drinks logged.
**Data:** `useCaffeineTimeline()` for `doses`. `wakeHour`/`bedHour` from `lastNightSleep` via props.
**Navigates to:** `/detail/adenosine-detail` on press.

---

### `LogDrinkSheet`
**File:** `src/components/home/LogDrinkSheet.tsx`
**Props (ref):** `LogDrinkSheetHandle` — exposes `present()` to open the sheet.
**Props (callback):** `onLog: (drink) => Promise<void>`
**Renders:** `@gorhom/bottom-sheet` modal. 9 preset drink tiles (emoji + name + mg), optional name field, caffeine mg stepper (±5 mg), time wheel picker.
**Used by:** `adenosine-detail` (detail page), potentially the cover.

---

## Sleep Components (`src/components/sleep/`)

### `CustomSleepAnalysisCard`
**File:** `src/components/sleep/CustomSleepAnalysisCard.tsx`
**Renders:** Custom sleep analysis visualization (stage breakdown with quality assessment).

---

### `SleepStageTimeline`
**File:** `src/components/sleep/SleepStageTimeline.tsx`
**Renders:** Timeline showing sleep stage transitions across the night.

---

## Component Hierarchy — Today's Tab (Overview)

```
NewHomeScreen
└── OverviewTab
    ├── HomeHeader
    ├── SyncStatusSheet (modal)
    ├── SemiCircularGauge       (readiness/score hero)
    ├── LiveHeartRateCard
    ├── DailyHeartRateCard      ← HR cover       → /detail/hr-detail
    ├── SleepHypnogram          ← sleep covers   → /detail/sleep-detail
    ├── SleepStagesChart
    ├── DailySleepTrendCard
    ├── CaffeineWindowCard      ← adenosine cover → /detail/adenosine-detail
    ├── DailyTimelineCard
    ├── NapCard
    ├── SleepDebtCard → SleepDebtGauge
    ├── TrainingInsightsCard
    ├── BaselineProgressCard    (calibration period only)
    └── BaselineCompleteOverlay (one-time, on calibration finish)
```

## Detail Pages (`app/detail/`)

Each detail page is the full-screen counterpart to its **cover** on the Overview tab.

| Detail file | Cover | Key components |
|-------------|-------|----------------|
| `adenosine-detail.tsx` | `CaffeineWindowCard` | `CaffeineBarChart` (PK bars), `WindowPhaseBar` (3-segment axis), `DrinkSuggestions`, `LogDrinkSheet` |
| `hr-detail.tsx` | `DailyHeartRateCard` | `TrendBarChart`, `MetricsGrid` |
| `sleep-detail.tsx` | sleep cards | `TrendBarChart`, `MetricsGrid`, `SleepHypnogram` |
| `spo2-detail.tsx` | SpO2 card | `TrendBarChart`, `SpO2LineChart` |

**Design rule for all detail pages:** No `backgroundColor` on component wrappers — borders only. Primary CTA buttons use white bg + black text.

## Component Hierarchy — Focus Tab

```
FocusScreen
├── FocusScoreRing
├── ReadinessCard          (extends GradientInfoCard)
├── IllnessWatchCard       (extends GradientInfoCard)
├── LastRunContextCard     (extends GradientInfoCard)
├── BaselineJourneyCard
└── AskCoachButton
```

---

## Update Rules

- **When you modify a component:** Update its entry here — props, logic, data sources, and any invariants.
- **When you create a component:** Add a new entry under the correct category. Add it to the hierarchy section if it's screen-level.
- **When you delete a component:** Remove its entry.
- **Do not defer this update** — it happens in the same task, before the `catchup.md` entry.
