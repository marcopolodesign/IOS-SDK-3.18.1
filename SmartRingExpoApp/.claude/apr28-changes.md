# Apr 28 Session — Changes to Reapply

Quick-reference guide for re-applying the Apr 28 session work on top of a clean baseline.
Full implementation details are in `catchup.md` — search for the date headers listed under each item.

---

## 1. FocusScreen — Dark animated blob background + layout
**catchup entry:** `2026-04-28: Coach UI polish` + perf fix entry

- Background: `SvgXml` with a two-path blob (`#AC0D0D` + `#FF753F`, `feGaussianBlur stdDeviation="50"`) sized at `SCREEN_HEIGHT * 0.9`.
- Two infinite Reanimated loops: `blobFloat` (7.2 s sin, drives `translateX/Y`) + `overlayOpacity` (9.8 s sin, drives stacked `LinearGradient` overlay).
- **MUST use `useFocusEffect` + `cancelAnimation` cleanup** (not `useEffect`) — otherwise the blob runs offscreen and tanks Today-tab FPS. See perf-fix catchup entry.
- Layout: `FocusScoreRing` → `LastRunContextCard` card in scrollview; `AskCoachButton` pinned `position:absolute` at `bottom: tabBarHeight + 24`.

---

## 2. AskCoachButton — Comet animation + card materialise
**catchup entries:** `AskCoachButton — dark BlurView card`, `colored comet animation`, `replay animation on every Coach tab focus`, `FocusScreen — AskCoachButton pinned above tab bar`

- Three shared values: `dashOffset`, `beamOpacity`, `cardOpacity`.
- Four comet layers (`CometLayerConfig[]`) with colors `['#4F8EF7', '#7C5CEF', '#A97CF8', '#C9A7FF']` (blue→violet→lavender).
- Animation sequence: comet sweeps ~4.2 s, then `beamOpacity → 0` + `cardOpacity → 1` simultaneously (card "materialises").
- `useFocusEffect` re-triggers `runAnimation` on every Coach tab focus (not just first mount).
- `cardBg` is plain `View` (`backgroundColor: '#000'`, opacity animated via `cardOpacity`). No `BlurView`.
- Mode selector (Coach / Analyst) in toolbar row; `CoachMode` type is in `src/types/focus.types.ts`.

---

## 3. IllnessWatchCard — Siri-style multi-hue gradient border + OverviewTab
**catchup entries:** `IllnessWatchCard — added to Today overview`, `Siri-style multi-hue gradient border`

- Mounted in `OverviewTab.tsx` between Sleep Score card and Daily Heart Rate card.
- Top-edge collar uses a `LinearGradient` that is `statusColor(status)` — green/amber/red.
- The gradient border attempt (Siri-style) was later simplified to a plain semi-opaque border due to complexity.
- Current state: `edgeColors = useMemo([collarColor+'80', collarColor+'00'])` for 4 edge `LinearGradient`s.
- **`React.memo` with custom comparator** (checks `status`, `score`, `stale`) — required because `illness` is a new object reference on every parent render.

---

## 4. LastRunContextCard — Inline title row + HR range body text
**catchup entry:** `2026-04-28: LastRunContextCard — title restructure + HR range body text`

- Header: single inline `Text` row: **Last Run** · 5.2 km · Yesterday · As expected ›
- Body text built from run fields: *"A solid run at 4:54/km. Your effort of 148 BPM matched your expected range of 140–156 BPM"* (harder/easier variants).
- `hrRangeLow` / `hrRangeHigh` = `expectedHR ± 8` — added to `LastRunContext` type + `ReadinessService`.
- "Talk this through →" chip that deep-links to coach with explanation pre-filled.
- Translation keys: `last_run.body_as_expected/harder/easier`, `last_run.talk_through`.

---

## 5. Sleep features — Manual bedtime editor + gap fill
**catchup entries:** `2026-04-28: Sleep edit UX`, `Sleep gap-fill — ultradian model`, `Sleep override — score recalculation + hypnogram boundary labels`

### SleepTimeEditModal (`src/components/sleep/SleepTimeEditModal.tsx`) — NEW FILE
- Horizontal drag timeline (6 PM → 2 PM, 20 h span). Moon/sun thumb handles, 15-min snap, `PanResponder` per handle.

### SleepOverrideService (`src/services/SleepOverrideService.ts`) — NEW FILE
- AsyncStorage CRUD keyed by local date (`sleep_time_override_v1`).

### SleepGapFillService (`src/services/SleepGapFillService.ts`) — NEW FILE
- `fillSleepGap(gapStart, gapEnd)` — ultradian model (3 cycle templates), returns `SleepSegment[]` with `isInferred: true`.

### useHomeData.ts wiring
- `getSleepOverride()` called in `fetchData` — if gap ≥ 10 min, calls `fillSleepGap` + prepends inferred segments.
- `applyOverrideNow()` in hook return — instant hypnogram update without BLE sync. Called from `SleepTab.onSaved`.
- `pushSleepOverrideToSupabase()` — fire-and-forget Supabase update after override applied.

### SleepHypnogram.tsx changes
- Inferred rects render at `opacity={0.4}`.
- Dashed "RING ON" vertical separator at inferred/real boundary.
- "Estimated" / "Recorded data" labels at 8px, 35% opacity.
- BEDTIME shows `~11:00 PM` (tilde prefix) when inferred data present.

---

## 6. AIChatScreen — Input bold + chip spacing
**catchup entry:** `2026-04-28: Coach UI polish — bold input, chip spacing`

- `styles.input.fontFamily` → `demiBold`.
- `inputContainer.marginTop` → 20 (was 8).

---

## 7. Sleep stage mapping fix (Apr 28)
**catchup entry:** `2026-04-28: Sleep — Stage mapping fix`

In `useHomeData.ts` `mapSleepType()`:
```
1 → 'deep'
2 → 'core'
3 → 'rem'
default → 'awake'
```
*(Was wrong before — 3↔4 swapped.)*

Also in `src/utils/ringData/sleep.ts` — updated stale QCBand comment.

---

## 8. Nap detection fix (Apr 28)
**catchup entry:** `2026-04-28: Fix false nap detection from adjacent 2-hour ring chunks`

In `deriveFromRaw` (`useHomeData.ts`):
- `durationMin = arr.length * unit` (NOT `totalSleepTime`) for block grouping.
- Early-morning sleep-tail guard: blocks with `startHour < 9 && endHour < 9` are never classified as naps.

---

## 9. Performance fixes (this session — already on `perf/focus-screen-fix`)

| Fix | File | Change |
|-----|------|--------|
| Offscreen blob animation | `FocusScreen.tsx` | `useEffect` → `useFocusEffect` + `cancelAnimation` cleanup |
| Debug log on every sync | `useHomeData.ts` | Removed stages block + 2 override console.logs |
| IllnessWatchCard re-renders | `IllnessWatchCard.tsx` | `React.memo` with value-equality comparator |

---

## File inventory — new files to restore

| File | What it is |
|------|-----------|
| `src/components/sleep/SleepTimeEditModal.tsx` | Drag timeline sleep editor modal |
| `src/services/SleepOverrideService.ts` | AsyncStorage CRUD for bed/wake overrides |
| `src/services/SleepGapFillService.ts` | Ultradian gap-fill for missing ring data |
